const {
    V2ComponentBuilder,
    EmbedBuilder
} = require('../../structures/v2Components');

const CATEGORY_OPTIONS_1 = [
    {
        label: 'AntiNuke',
        description: 'Get All AntiNuke Command List',
        value: 'antinuke',
        emoji: '<:Antinuke:1374825414337233048>'
    },
    {
        label: 'Moderation',
        description: 'Get All Moderation Command List',
        value: 'moderation',
        emoji: '<:Moderation:1374825363993006310>'
    },
    {
        label: 'Automod',
        description: 'Get All Automod Command List',
        value: 'automod',
        emoji: '<:Automod:1374825328580759662>'
    },
    {
        label: 'Logger',
        description: 'Get All Logger Command List',
        value: 'logger',
        emoji: '<:Logger:1374825300650627072>'
    },
    {
        label: 'Utility',
        description: 'Get All Utility Command List',
        value: 'utility',
        emoji: '<:Utility:1374825272011919430>'
    },
    {
        label: 'Server Utility',
        description: 'Get All Server Utility Command List',
        value: 'serverutility',
        emoji: '<:ServerUtility:1374825231381696663>'
    },
    {
        label: 'Auto Responder',
        description: 'Get All Auto Responder Command List',
        value: 'autoresponder',
        emoji: '<:AutoResponder:1374825195164008620>'
    }
];

const CATEGORY_OPTIONS_2 = [
    {
        label: 'Verification',
        description: 'Get All Verification Command List',
        value: 'verification',
        emoji: '<:Verification:1374825164960960640>'
    },
    {
        label: 'Join To Create',
        description: 'Get All Join To Create Command List',
        value: 'jointocreate',
        emoji: '<:Jtc:1374825143817339021>'
    },
    {
        label: 'Voice',
        description: 'Get All Voice Command List',
        value: 'voice',
        emoji: '<:Voice:1374825114201489468>'
    },
    {
        label: 'Custom Role',
        description: 'Get All Custom Role Command List',
        value: 'customrole',
        emoji: '<:CustomRole:1374825086741119098>'
    },
    {
        label: 'Welcomer',
        description: 'Get All Welcomer Command List',
        value: 'welcomer',
        emoji: '<:Welcome:1374825054961008710>'
    },
    {
        label: 'Sticky',
        description: 'Get All Sticky Command List',
        value: 'sticky',
        emoji: '<:Sticky:1374825026921955389>'
    },
    {
        label: 'Ticket',
        description: 'Get All Ticket Command List',
        value: 'ticket',
        emoji: '<:Tickets:1374824970055716925>'
    }
];

const CATEGORY_DISPLAY = {
    category1: [
        "> **<:Antinuke:1374825414337233048> `:` AntiNuke**",
        "> **<:Moderation:1374825363993006310> `:` Moderation**",
        "> **<:Automod:1374825328580759662> `:` Automod**",
        "> **<:Logger:1374825300650627072> `:` Logger**",
        "> **<:Utility:1374825272011919430> `:` Utility**",
        "> **<:ServerUtility:1374825231381696663> `:` Server Utility**",
        "> **<:AutoResponder:1374825195164008620> `:` Auto Responder**"
    ],
    category2: [
        "> **<:Verification:1374825164960960640> `:` Verification**",
        "> **<:Jtc:1374825143817339021> `:` Join To Create**",
        "> **<:Voice:1374825114201489468> `:` Voice**",
        "> **<:CustomRole:1374825086741119098> `:` Custom Role**",
        "> **<:Welcome:1374825054961008710> `:` Welcomer**",
        "> **<:Sticky:1374825026921955389> `:` Sticky**",
        "> **<:Tickets:1374824970055716925> `:` Ticket**"
    ]
};

const DEVELOPER_ID = '870040788539678791';

module.exports = {
    name: 'help',
    aliases: ['h'],
    category: 'info',
    cooldown: 5,
    premium: true,
    run: async (client, message, args) => {
        const v2 = new V2ComponentBuilder(client);
        const prefix = message.guild?.prefix || client.config.PREFIX;

        const row1 = v2.createActionRow(
            v2.createStringSelectMenu({
                customId: 'helpop',
                placeholder: `❯ ${client.user.username} Get Started!`,
                options: CATEGORY_OPTIONS_1
            })
        );

        const row2 = v2.createActionRow(
            v2.createStringSelectMenu({
                customId: 'helpop2',
                placeholder: `❯ ${client.user.username} Get Started!`,
                options: CATEGORY_OPTIONS_2
            })
        );

        const developerUser = client.users.cache.get(DEVELOPER_ID) ||
            await client.users.fetch(DEVELOPER_ID).catch(() => null);

        const embed = new EmbedBuilder()
            .setColor(client.color)
            .setAuthor({
                name: message.author.tag,
                iconURL: message.author.displayAvatarURL({ dynamic: true })
            })
            .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
            .setDescription(
                `${client.emoji.dot} **Prefix for this server:** \`${prefix}\`\n` +
                `${client.emoji.dot} **Total Commands:** \`${client.util.countCommandsAndSubcommands(client)}\`\n` +
                `${client.emoji.dot} **Type \`&antinuke enable\` to get started!**\n\n${client.config.baseText}`
            )
            .addFields(
                {
                    name: '<:Categories:1374820972800114699> **__Categories__**',
                    value: CATEGORY_DISPLAY.category1.join('\n'),
                    inline: true
                },
                {
                    name: '\u200B',
                    value: CATEGORY_DISPLAY.category2.join('\n'),
                    inline: true
                },
                {
                    name: "<:links:1376478232840507564> **__Links__**",
                    value: `**[Invite Me](https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot) | [Support Server](https://discord.gg/excelbot)**`
                }
            )
            .setFooter({
                text: `Powered By Team Excel`,
                iconURL: developerUser?.displayAvatarURL({ dynamic: true }) || client.user.displayAvatarURL()
            });

        await message.channel.send({ embeds: [embed], components: [row1, row2] });
    }
};
