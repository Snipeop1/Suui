const {
    V2ComponentBuilder,
    EmbedBuilder,
    AttachmentBuilder,
    TextInputStyle,
    PermissionFlagsBits
} = require('../structures/v2Components');
const { PermissionsBitField } = require('discord.js');
const { CaptchaGenerator } = require('captcha-canvas');

const captchaMap = new Map();

const RESTRICTED_PERMISSIONS = [
    'KickMembers',
    'BanMembers',
    'Administrator',
    'ManageChannels',
    'ManageGuild',
    'MentionEveryone',
    'ManageRoles',
    'ManageWebhooks',
    'ManageEvents',
    'ModerateMembers'
];

module.exports = async (client) => {
    const v2 = new V2ComponentBuilder(client);

    const generateRandomText = (length) => {
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        return result;
    };

    const createCaptchaEmbed = () => {
        return new EmbedBuilder()
            .setColor(client.color)
            .setTitle(`${client.emoji.verification} Hello! Are you human? Let's find out!\n\`Please type the captcha below to be able to access this server!Captcha Verification\`\n**Additional Notes:**\n`)
            .setDescription(`${client.emoji.tracedcolor} Type out the traced colored characters from left to right.\n ${client.emoji.decoy} Ignore the decoy characters spread-around.\n ${client.emoji.cases}You have to respect characters cases (upper/lower case)!`)
            .setImage('attachment://captcha.png')
            .setFooter({ text: 'Verification Period: 1 minutes' })
            .setTimestamp();
    };

    const createEnterCodeButton = () => {
        return v2.createActionRow(
            v2.createPrimaryButton('show_verification_modal', 'Enter Code')
        );
    };

    const createVerificationModal = () => {
        return v2.createModal({
            customId: 'verify_captcha',
            title: 'Verify Yourself',
            components: [
                v2.createActionRow(
                    v2.createShortTextInput('captcha_code', 'Enter the code shown in the image', {
                        required: true,
                        minLength: 6,
                        maxLength: 6,
                        placeholder: 'Enter 6-character code'
                    })
                )
            ]
        });
    };

    const generateCaptcha = (captchaText) => {
        const captcha = new CaptchaGenerator()
            .setDimension(150, 450)
            .setCaptcha({ text: captchaText, size: 60, color: "#000000" })
            .setDecoy({ size: 40, total: 20, opacity: 0.5 })
            .setTrace({ color: "#000000" });

        return captcha.generateSync();
    };

    const checkRolePermissions = (role) => {
        const rolePermissions = new PermissionsBitField(role.permissions.bitfield)
            .toArray()
            .filter((perm) => RESTRICTED_PERMISSIONS.includes(perm))
            .map((perm) => `\`${perm}\``)
            .join(', ');

        return rolePermissions;
    };

    client.on('interactionCreate', async (interaction) => {
        try {
            if (interaction.isButton() && interaction.customId === 'start_verification') {
                await handleStartVerification(interaction);
            } else if (interaction.isButton() && interaction.customId === 'show_verification_modal') {
                await handleShowModal(interaction);
            } else if (interaction.isModalSubmit() && interaction.customId === 'verify_captcha') {
                await handleVerifyCaptcha(interaction);
            }
        } catch (error) {
            console.error('Verification error:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: 'An error occurred during verification. Please try again.',
                    ephemeral: true
                }).catch(() => {});
            }
        }
    });

    async function handleStartVerification(interaction) {
        const { guild, member } = interaction;
        const data = await client.db.get(`verification_${guild.id}`);
        if (!data) return;

        await interaction.deferReply({ ephemeral: true });

        const captchaText = generateRandomText(6);
        const buffer = generateCaptcha(captchaText);
        const attachment = new AttachmentBuilder(buffer, { name: 'captcha.png' });

        const embed = createCaptchaEmbed();
        const row = createEnterCodeButton();

        const verificationChannel = guild.channels.cache.get(data.channelId);
        if (!verificationChannel) {
            return interaction.followUp({
                content: 'Verification channel not found.',
                ephemeral: true
            });
        }

        await interaction.followUp({
            embeds: [embed],
            components: [row],
            files: [attachment]
        });

        captchaMap.set(member.id, captchaText);

        setTimeout(async () => {
            if (captchaMap.has(member.id)) {
                captchaMap.delete(member.id);
            }
        }, 60000);
    }

    async function handleShowModal(interaction) {
        const { member } = interaction;

        if (!captchaMap.has(member.id)) {
            return interaction.reply({
                content: 'Your verification session has expired. Please click the verification button again.',
                ephemeral: true
            });
        }

        await interaction.showModal(createVerificationModal());
    }

    async function handleVerifyCaptcha(interaction) {
        const { member, guild } = interaction;
        const enteredCode = interaction.fields.getTextInputValue('captcha_code');
        const data = await client.db.get(`verification_${guild.id}`);

        if (!data) {
            return interaction.reply({
                content: 'Verification system is not configured for this server.',
                ephemeral: true
            });
        }

        const storedCaptchaText = captchaMap.get(member.id);

        if (!storedCaptchaText) {
            return interaction.reply({
                content: 'Your verification session has expired. Please start again.',
                ephemeral: true
            });
        }

        if (enteredCode === storedCaptchaText) {
            const role = guild.roles.cache.get(data.verifiedrole);

            if (!role) {
                return interaction.reply({
                    content: 'Verified role not found. Please contact a server administrator.',
                    ephemeral: true
                });
            }

            const rolePermissions = checkRolePermissions(role);

            if (rolePermissions.length > 0) {
                await interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(client.color)
                            .setDescription(
                                `${client.emoji.cross} | I can't add <@&${role.id}> to you because it has ${rolePermissions} permissions\nPlease contact the server admin or owner to resolve this issue`
                            )
                    ],
                    ephemeral: true
                });

                if (role.editable) {
                    await role.setPermissions([
                        PermissionsBitField.Flags.ViewChannel,
                        PermissionsBitField.Flags.SendMessages,
                        PermissionsBitField.Flags.Connect,
                        PermissionsBitField.Flags.Speak
                    ], 'Dangerous permissions have been successfully removed from the Verified role to ensure enhanced security').catch(() => null);
                }
                return;
            }

            if (role.position < guild.members.me.roles.highest.position) {
                await member.roles.add(role.id, 'Successfully Passed the Verification System');
                await interaction.reply({
                    content: 'You have been successfully verified!',
                    ephemeral: true
                });
                captchaMap.delete(member.id);
            } else {
                await interaction.reply({
                    content: `I'm unable to assign this role because its position is higher than or equal to my highest role position. Please contact the server admin or owner to resolve this issue.`,
                    ephemeral: true
                });
            }
        } else {
            await interaction.reply({
                content: 'Verification failed. The code you entered is incorrect. Please try again.',
                ephemeral: true
            });
        }
    }
};
