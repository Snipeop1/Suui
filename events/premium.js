const {
    V2ComponentBuilder,
    CooldownManager,
    EmbedBuilder
} = require('../structures/v2Components');

const LEADERBOARD_CHANNEL_ID = '1291385147442331740';
const LEADERBOARD_MESSAGE_ID = '1291389782165033085';
const UPDATE_INTERVAL = 300000; // 5 minutes
const COOLDOWN_DURATION = 300000; // 5 minutes

module.exports = async (client) => {
    const v2 = new V2ComponentBuilder(client);
    const cooldowns = new CooldownManager();
    let leaderboardMessageId = LEADERBOARD_MESSAGE_ID;

    const createPremiumStatusButton = () => {
        return v2.createActionRow(
            v2.createPrimaryButton('check_premium_status', 'Check My Premium Status')
        );
    };

    const createLeaderboardEmbed = (leaderboardContent) => {
        return new EmbedBuilder()
            .setColor(client.color)
            .setTitle('Premium User Leaderboard')
            .setDescription(leaderboardContent)
            .setFooter({ text: 'Premium Leaderboard is live updating every 5 minutes' });
    };

    const updateLeaderboard = async () => {
        try {
            const keys = await client.db.all();
            const premiumUsers = keys.filter(key => key.ID.startsWith('uprem_') && key.data === 'true');

            if (premiumUsers.length === 0) {
                return 'No premium users found.';
            }

            const currentTime = Date.now();
            const premiumUserList = await Promise.all(premiumUsers.map(async user => {
                const userId = user.ID.split('_')[1];
                const userEnd = await client.db.get(`upremend_${userId}`);
                const userCount = await client.db.get(`upremcount_${userId}`);

                if (userEnd > currentTime) {
                    return {
                        userId,
                        userCount: parseInt(userCount || 0),
                        userEnd: parseInt(userEnd || 0)
                    };
                }
                return null;
            }));

            const validPremiumUsers = premiumUserList.filter(user => user !== null);

            if (validPremiumUsers.length === 0) {
                return 'No active premium users found.';
            }

            const sortedUsers = validPremiumUsers.sort((a, b) => b.userCount - a.userCount).slice(0, 10);
            const leaderboard = sortedUsers.map(user =>
                `<@${user.userId}> - Premium Count: \`${user.userCount}\` - Expiry: <t:${Math.floor(user.userEnd / 1000)}:R>`
            );

            return `**Top 10 Premium Users**:\n${leaderboard.join('\n')}`;
        } catch (error) {
            console.error('Error updating leaderboard:', error);
            return 'Error fetching leaderboard data.';
        }
    };

    client.on('ready', async () => {
        try {
            const leaderboardChannel = client.channels.cache.get(LEADERBOARD_CHANNEL_ID) ||
                await client.channels.fetch(LEADERBOARD_CHANNEL_ID).catch(() => null);

            if (!leaderboardChannel) {
                console.error('Leaderboard channel not found');
                return;
            }

            let leaderboardMessage;
            try {
                leaderboardMessage = leaderboardChannel.messages.cache.get(leaderboardMessageId) ||
                    await leaderboardChannel.messages.fetch(leaderboardMessageId).catch(() => null);
            } catch (err) {
                console.error(`Error fetching leaderboard message: ${err.message}`);
            }

            if (!leaderboardMessage) {
                const initialLeaderboard = await updateLeaderboard();
                const embed = createLeaderboardEmbed(initialLeaderboard);
                const row = createPremiumStatusButton();

                leaderboardMessage = await leaderboardChannel.send({
                    embeds: [embed],
                    components: [row]
                });
                leaderboardMessageId = leaderboardMessage.id;
            }

            setInterval(async () => {
                try {
                    const updatedLeaderboard = await updateLeaderboard();
                    const updatedEmbed = createLeaderboardEmbed(updatedLeaderboard);
                    const row = createPremiumStatusButton();

                    await leaderboardMessage.edit({
                        embeds: [updatedEmbed],
                        components: [row]
                    });
                } catch (err) {
                    console.error(`Error editing leaderboard message: ${err.message}`);
                }
            }, UPDATE_INTERVAL);
        } catch (error) {
            console.error('Error initializing premium leaderboard:', error);
        }
    });

    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isButton() || interaction.customId !== 'check_premium_status') return;

        try {
            const userId = interaction.user.id;
            const cooldownKey = `premium_check_${userId}`;
            const cooldownCheck = cooldowns.check(cooldownKey);

            if (cooldownCheck.onCooldown) {
                return interaction.reply({
                    content: `You can check your premium status again in ${cooldownCheck.remaining} seconds.`,
                    ephemeral: true
                });
            }

            cooldowns.set(cooldownKey, COOLDOWN_DURATION);

            const userPremiumData = await client.db.get(`uprem_${userId}`);
            const isPremium = userPremiumData === 'true';
            const userCount = await client.db.get(`upremcount_${userId}`);
            const userEnd = await client.db.get(`upremend_${userId}`);

            const statusMessage = isPremium
                ? `You have premium status with count: \`${userCount}\` - Expiry: <t:${Math.floor(userEnd / 1000)}:R>`
                : `You do not have premium status.`;

            await interaction.reply({
                content: statusMessage,
                ephemeral: true
            });
        } catch (error) {
            console.error('Error checking premium status:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: 'An error occurred while checking your premium status.',
                    ephemeral: true
                }).catch(() => {});
            }
        }
    });
};
