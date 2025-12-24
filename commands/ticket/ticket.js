const {
    V2ComponentBuilder,
    EmbedBuilder,
    ChannelType,
    PermissionFlagsBits
} = require('../../structures/v2Components');
const { PermissionsBitField } = require('discord.js');
const ticketPanelSchema = require('../../models/ticket');

const lastRenameMap = new Map();
const MAX_PANELS = 5;
const MAX_TICKET_MEMBERS = 10;
const RENAME_COOLDOWN = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 3;

module.exports = {
    name: 'ticket',
    aliases: [],
    premium: false,
    subcommand: ['panel setup', 'panel enable', 'panel disable', 'panel reset', 'panel list', 'member add', 'member remove', 'channel open', 'channel close', 'channel delete', 'channel rename'],
    category: 'ticket',
    run: async (client, message, args) => {
        const v2 = new V2ComponentBuilder(client);

        const createEmbed = (description, options = {}) => {
            const embed = new EmbedBuilder()
                .setColor(options.color || client.color)
                .setDescription(description);

            if (options.title) embed.setTitle(options.title);
            if (options.thumbnail) embed.setThumbnail(options.thumbnail);
            if (options.fields) embed.addFields(options.fields);
            if (options.footer) embed.setFooter(options.footer);
            if (options.author) embed.setAuthor(options.author);
            if (options.timestamp) embed.setTimestamp();

            return embed;
        };

        const sendError = (description, footer = null) => {
            const embed = createEmbed(`${client.emoji.cross} | ${description}`);
            if (footer) embed.setFooter(footer);
            return message.channel.send({ embeds: [embed] });
        };

        const sendSuccess = (description) => {
            return message.channel.send({
                embeds: [createEmbed(`${client.emoji.tick} | ${description}`)]
            });
        };

        const createLogEmbed = (options) => {
            const { title, description, fields = [], author, footer } = options;

            const embed = new EmbedBuilder()
                .setColor(client.color)
                .setDescription(description)
                .setTimestamp();

            if (title) embed.setTitle(title);
            if (author) embed.setAuthor(author);
            if (fields.length > 0) embed.addFields(fields);
            if (footer) embed.setFooter(footer);

            return embed;
        };

        if (!args[0]) {
            return message.channel.send({
                embeds: [
                    new EmbedBuilder()
                        .setColor(client.color)
                        .setThumbnail(message.guild.iconURL({ dynamic: true }) || message.author.displayAvatarURL({ dynamic: true }))
                        .setTitle('Ticket System Commands')
                        .setDescription('Use the commands below to manage your ticket system effectively.')
                        .addFields([
                            {
                                name: `${message.guild.prefix}ticket panel setup <panelname>`,
                                value: `\`Create a new ticket panel with the specified name.\``,
                                inline: false
                            },
                            {
                                name: `${message.guild.prefix}ticket panel enable <panelname>`,
                                value: `\`Enable an existing ticket panel to accept ticket requests.\``,
                                inline: false
                            },
                            {
                                name: `${message.guild.prefix}ticket panel disable <panelname>`,
                                value: `\`Disable a ticket panel to stop accepting ticket requests.\``,
                                inline: false
                            },
                            {
                                name: `${message.guild.prefix}ticket panel reset <panelname/all>`,
                                value: `\`Reset a specific ticket panel or all ticket panels at once.\``,
                                inline: false
                            },
                            {
                                name: `${message.guild.prefix}ticket panel list`,
                                value: `\`Show a list of all configured ticket panels.\``,
                                inline: false
                            },
                            {
                                name: `${message.guild.prefix}ticket member add <@mention/userid>`,
                                value: `\`Add a member to the ticket channel so they can view and participate.\``,
                                inline: false
                            },
                            {
                                name: `${message.guild.prefix}ticket member remove <@mention/userid>`,
                                value: `\`Remove a member from the ticket channel.\``,
                                inline: false
                            },
                            {
                                name: `${message.guild.prefix}ticket channel open <#channel/id>`,
                                value: `\`Reopen a previously closed ticket channel.\``,
                                inline: false
                            },
                            {
                                name: `${message.guild.prefix}ticket channel close <#channel/id>`,
                                value: `\`Close an open ticket channel.\``,
                                inline: false
                            },
                            {
                                name: `${message.guild.prefix}ticket channel rename <#channel/id> <new-name>`,
                                value: `\`Rename a ticket channel to a new name.\``,
                                inline: false
                            },
                            {
                                name: `${message.guild.prefix}ticket channel delete <#channel/id>`,
                                value: `\`Permanently delete a ticket channel.\``,
                                inline: false
                            }
                        ])
                        .setFooter({ text: 'Ticket System', iconURL: client.user.displayAvatarURL() })
                        .setTimestamp()
                ]
            });
        }

        if (!message.guild.members.me.permissions.has('Administrator')) {
            return sendError(`I must have \`Administrator\` Permissions to run this command`);
        }

        if (args[0].toLowerCase() === 'panel') {
            if (!args[1]) {
                return sendError(`Please specify a subcommand: setup, enable, disable, reset, or list`);
            }

            if (['setup', 'list', 'enable', 'disable', 'reset'].includes(args[1].toLowerCase()) && !message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return sendError(`You must have \`Administrator\` permissions to run this command.`);
            }

            if (['setup', 'list', 'enable', 'disable', 'reset'].includes(args[1].toLowerCase()) && !client.util.hasHigher(message.member)) {
                return message.channel.send({
                    embeds: [
                        createEmbed(`${client.emoji.cross} | You must have a higher role than the bot to run this command.`, { timestamp: true })
                    ]
                });
            }

            if (args[1].toLowerCase() === 'setup') {
                await handlePanelSetup(client, message, args, v2, sendError, sendSuccess, createEmbed);
            } else if (args[1].toLowerCase() === 'enable') {
                await handlePanelEnable(client, message, args, sendError, sendSuccess, createEmbed);
            } else if (args[1].toLowerCase() === 'disable') {
                await handlePanelDisable(client, message, args, sendError, sendSuccess, createEmbed);
            } else if (args[1].toLowerCase() === 'reset') {
                await handlePanelReset(client, message, args, sendError, sendSuccess, createEmbed);
            } else if (args[1].toLowerCase() === 'list') {
                await handlePanelList(client, message, sendError, createEmbed);
            }
        } else if (args[0].toLowerCase() === 'member') {
            if (!args[1]) {
                return sendError(`Please specify a subcommand: add or remove`);
            }

            if (['remove', 'add'].includes(args[1].toLowerCase()) && !message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
                return sendError(`You must have \`Manage Channels\` permissions to run this command.`);
            }

            if (args[1].toLowerCase() === 'add') {
                await handleMemberAdd(client, message, args, sendError, sendSuccess, createEmbed);
            } else if (args[1].toLowerCase() === 'remove') {
                await handleMemberRemove(client, message, args, sendError, sendSuccess, createEmbed);
            }
        } else if (args[0].toLowerCase() === 'channel') {
            if (!args[1]) {
                return sendError(`Please specify a subcommand: open, close, delete, or rename`);
            }

            if (['rename', 'close', 'delete', 'open'].includes(args[1].toLowerCase()) && !message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
                return message.channel.send({
                    embeds: [
                        createEmbed(`${client.emoji.cross} | You must have \`Manage Channels\` permissions to run this command.`, { timestamp: true })
                    ]
                });
            }

            if (args[1].toLowerCase() === 'rename') {
                await handleChannelRename(client, message, args, sendError, sendSuccess, createEmbed);
            } else if (args[1].toLowerCase() === 'close') {
                await handleChannelClose(client, message, args, sendError, createEmbed, createLogEmbed);
            } else if (args[1].toLowerCase() === 'delete') {
                await handleChannelDelete(client, message, args, sendError, createEmbed, createLogEmbed);
            } else if (args[1].toLowerCase() === 'open') {
                await handleChannelOpen(client, message, args, sendError, createEmbed, createLogEmbed);
            } else {
                return message.channel.send({
                    embeds: [
                        new EmbedBuilder()
                            .setFooter({ text: `Powered By Team Excel.` })
                            .setColor(client.color)
                            .setAuthor({ name: message.guild.name, iconURL: message.guild.iconURL({ dynamic: true }) || client.user.displayAvatarURL() })
                            .setDescription(`${client.config.baseText}\n\`${message.guild.prefix}ticket\`\nShows you the current page.\n\n\`${message.guild.prefix}ticket setup\`\nSets up the ticket system.\n\n\`${message.guild.prefix}ticket reset\`\nResets the ticket system.\n\n\`${message.guild.prefix}ticket add <member>\`\nAdds a member to a ticket.\n\n\`${message.guild.prefix}ticket remove <member>\`\nRemoves a member from the ticket.\n\n\`${message.guild.prefix}ticket delete [channelId]\`\nDeletes an existing ticket.\n\n\`${message.guild.prefix}ticket close [channelId]\`\nCloses an opened ticket.`)
                    ]
                });
            }
        }
    }
};

async function handlePanelSetup(client, message, args, v2, sendError, sendSuccess, createEmbed) {
    const panelName = args.slice(2).join(' ');

    if (!panelName) {
        return sendError(
            `Please provide a valid panel name to get started!`,
            { text: `Example: ${message.guild.prefix}ticket panel setup <panelname>`, iconURL: message.author.displayAvatarURL({ dynamic: true }) }
        );
    }

    if (panelName.length > 100) {
        return sendError(
            `The panel name cannot exceed 100 characters. Please provide a shorter name.`,
            { text: `Panel name provided: ${panelName.length}/100 characters`, iconURL: message.author.displayAvatarURL({ dynamic: true }) }
        );
    }

    const existingSetup = await ticketPanelSchema.findOne({ guildId: message.guild.id });

    if (existingSetup && existingSetup.panels.length >= MAX_PANELS) {
        return sendError(`You cannot \`create\` more than ${MAX_PANELS} ticket panels.`);
    }

    if (existingSetup && existingSetup.panels.some(panel => panel.panelName.toLowerCase() === panelName.toLowerCase())) {
        return sendError(`A ticket panel with the name \`${panelName}\` already exists.`);
    }

    async function promptUser(promptMessage, validationFn) {
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            await message.channel.send({
                embeds: [createEmbed(promptMessage)]
            });

            const filter = response => response.author.id === message.author.id;
            try {
                const userResponse = await message.channel.awaitMessages({ filter, max: 1, time: 30000, errors: ['time'] });
                const result = validationFn(userResponse.first());
                if (result) return result;

                await sendError(`Invalid input. Please try again. (${attempt}/${MAX_ATTEMPTS})`);
            } catch (error) {
                await sendError(`You didn't respond in time. (${attempt}/${MAX_ATTEMPTS})`);
            }

            if (attempt === MAX_ATTEMPTS) return null;
        }
    }

    const panelId = existingSetup ? `panel-${existingSetup.panels.length + 1}` : 'panel-1';

    const ticketSetup = {
        panelId: panelId,
        panelName: panelName,
        guildId: message.guild.id,
        channelId: null,
        categoryId: null,
        logsChannelId: null,
        supportRoleId: null,
        staffRoleId: null,
        transcriptChannelId: null
    };

    const channel = await promptUser(
        `Please provide the ticket creation channel.`,
        (response) => {
            const ch = response.mentions.channels.first() || message.guild.channels.cache.get(response.content);
            return ch && ch.type === ChannelType.GuildText ? ch.id : null;
        }
    );
    if (!channel) return sendError(`Failed to set up ticket panel.`);
    ticketSetup.channelId = channel;

    const category = await promptUser(
        `Please provide the ticket creation category.`,
        (response) => {
            const cat = response.mentions.channels.first() || message.guild.channels.cache.get(response.content);
            return cat && cat.type === ChannelType.GuildCategory ? cat.id : null;
        }
    );
    if (!category) return sendError(`Failed to set up ticket panel.`);
    ticketSetup.categoryId = category;

    const logsDecision = await promptUser(
        `Do you need a ticket logs channel? Respond with \`yes\` or \`no\`.`,
        (response) => ['yes', 'no'].includes(response.content.toLowerCase()) ? response.content.toLowerCase() : null
    );
    if (!logsDecision) return sendError(`Failed to set up ticket panel.`);

    if (logsDecision === 'yes') {
        const logsChannel = await promptUser(
            `Please provide the ticket logs channel.`,
            (response) => {
                const ch = response.mentions.channels.first() || message.guild.channels.cache.get(response.content);
                return ch && ch.type === ChannelType.GuildText ? ch.id : null;
            }
        );
        if (!logsChannel) return sendError(`Failed to set up ticket panel.`);
        ticketSetup.logsChannelId = logsChannel;
    }

    const transcriptDecision = await promptUser(
        `Do you need a transcript channel? Respond with \`yes\` or \`no\`.`,
        (response) => ['yes', 'no'].includes(response.content.toLowerCase()) ? response.content.toLowerCase() : null
    );
    if (!transcriptDecision) return sendError(`Failed to set up ticket panel.`);

    if (transcriptDecision === 'yes') {
        const transcriptChannel = await promptUser(
            `Please provide the transcript channel.`,
            (response) => {
                const ch = response.mentions.channels.first() || message.guild.channels.cache.get(response.content);
                return ch && ch.type === ChannelType.GuildText ? ch.id : null;
            }
        );
        if (!transcriptChannel) return sendError(`Failed to set up ticket panel.`);
        ticketSetup.transcriptChannelId = transcriptChannel;
    }

    const supportRoleDecision = await promptUser(
        `Do you want to set a support role? Respond with \`yes\` or \`no\`.`,
        (response) => ['yes', 'no'].includes(response.content.toLowerCase()) ? response.content.toLowerCase() : null
    );
    if (!supportRoleDecision) return sendError(`Failed to set up ticket panel.`);

    if (supportRoleDecision === 'yes') {
        const supportRole = await promptUser(
            `Please provide the support role.`,
            (response) => {
                const role = response.mentions.roles.first() || message.guild.roles.cache.get(response.content);
                return role ? role.id : null;
            }
        );
        if (!supportRole) return sendError(`Failed to set up ticket panel.`);
        ticketSetup.supportRoleId = supportRole;
    }

    const staffRoleDecision = await promptUser(
        `Do you want to set a staff role? Respond with \`yes\` or \`no\`.`,
        (response) => ['yes', 'no'].includes(response.content.toLowerCase()) ? response.content.toLowerCase() : null
    );
    if (!staffRoleDecision) return sendError(`Failed to set up ticket panel.`);

    if (staffRoleDecision === 'yes') {
        const staffRole = await promptUser(
            `Please provide the staff role.`,
            (response) => {
                const role = response.mentions.roles.first() || message.guild.roles.cache.get(response.content);
                return role ? role.id : null;
            }
        );
        if (!staffRole) return sendError(`Failed to set up ticket panel.`);
        ticketSetup.staffRoleId = staffRole;
    }

    if (existingSetup) {
        existingSetup.panels.push(ticketSetup);
        await existingSetup.save();
    } else {
        await new ticketPanelSchema({
            guildId: message.guild.id,
            panels: [ticketSetup]
        }).save();
    }

    const row = v2.createActionRow(
        v2.createSecondaryButton(`ticket_setup_${panelId}`, 'Create Tickets', '📨')
    );

    const ticketChannel = message.guild.channels.cache.get(channel);
    if (ticketChannel) {
        await ticketChannel.send({
            embeds: [
                new EmbedBuilder()
                    .setTitle(`${panelName} Ticket`)
                    .setDescription(`Click on the button below to create a ticket.`)
                    .setAuthor({ name: message.guild.name, iconURL: message.guild.iconURL({ dynamic: true }) || client.user.displayAvatarURL() })
                    .setTimestamp()
                    .setColor(client.color)
            ],
            components: [row]
        });
    }

    const successMsg = await sendSuccess(`Ticket \`panel\` has been set up in <#${channel}>!`);
    setTimeout(() => {
        if (successMsg) successMsg.delete().catch(() => null);
    }, 3000);
}

async function handlePanelEnable(client, message, args, sendError, sendSuccess, createEmbed) {
    const panelName = args.slice(2).join(' ').trim();
    if (!panelName) {
        return sendError(`Please provide a panel name.`);
    }

    const data = await ticketPanelSchema.findOne({ guildId: message.guild.id });
    if (!data) {
        return sendError(`Ticket system is not set up.`);
    }

    const panel = data.panels.find(p => p.panelName === panelName);
    if (!panel) {
        return sendError(`Panel not found.`);
    }

    if (panel.enabled) {
        return sendError(`Panel is already enabled.`);
    }

    panel.enabled = true;
    await data.save();

    return sendSuccess(`Panel \`${panelName}\` has been enabled.`);
}

async function handlePanelDisable(client, message, args, sendError, sendSuccess, createEmbed) {
    const panelName = args.slice(2).join(' ').trim();
    if (!panelName) {
        return sendError(`Please provide a panel name.`);
    }

    const data = await ticketPanelSchema.findOne({ guildId: message.guild.id });
    if (!data) {
        return sendError(`Ticket system is not set up.`);
    }

    const panel = data.panels.find(p => p.panelName === panelName);
    if (!panel) {
        return sendError(`Panel not found.`);
    }

    if (!panel.enabled) {
        return sendError(`Panel is already disabled.`);
    }

    panel.enabled = false;
    await data.save();

    return sendSuccess(`Panel \`${panelName}\` has been disabled.`);
}

async function handlePanelReset(client, message, args, sendError, sendSuccess, createEmbed) {
    if (!args[2]) {
        return sendError(`Please provide the panel name or use \`all\` to reset all panels.`);
    }

    const panelName = args[2].trim();

    if (panelName.toLowerCase() === 'all') {
        const data = await ticketPanelSchema.findOneAndDelete({ guildId: message.guild.id });

        if (!data) {
            return sendError(`There's **no** ticket setup to reset.`);
        }

        return sendSuccess(`Successfully **cleared** all ticket panels.`);
    }

    const data = await ticketPanelSchema.findOne({ guildId: message.guild.id });

    if (!data || !data.panels || data.panels.length === 0) {
        return sendError(`No panels are currently set up.`);
    }

    const panelIndex = data.panels.findIndex(panel => panel.panelName.toLowerCase() === panelName.toLowerCase());

    if (panelIndex === -1) {
        return sendError(`A panel with the name \`${panelName}\` doesn't exist.`);
    }

    data.panels.splice(panelIndex, 1);

    if (data.panels.length === 0) {
        await ticketPanelSchema.findOneAndDelete({ guildId: message.guild.id });
    } else {
        await data.save();
    }

    return sendSuccess(`Successfully \`reset\` the panel \`${panelName}\`.`);
}

async function handlePanelList(client, message, sendError, createEmbed) {
    const data = await ticketPanelSchema.findOne({ guildId: message.guild.id });

    if (!data || !data.panels || data.panels.length === 0) {
        return sendError(`No ticket panels are set up in this guild.`);
    }

    const panelList = data.panels.map((panel, index) => {
        return `**${index + 1}. Panel Name:** \`${panel.panelName}\`\n**Panel ID:** ${panel.panelId}\n**Ticket Channel:** <#${panel.channelId}>\n**Category ID:** ${panel.categoryId}\n**Logs Channel:** ${panel.logsChannelId ? `<#${panel.logsChannelId}>` : 'None'}\n**Transcript Channel:** ${panel.transcriptChannelId ? `<#${panel.transcriptChannelId}>` : 'None'}\n**Panel Status:** ${panel.enabled ? `Enabled` : 'Disabled'}\n`;
    }).join("\n");

    return message.channel.send({
        embeds: [
            new EmbedBuilder()
                .setColor(client.color)
                .setTitle('Ticket Panels List')
                .setDescription(panelList)
                .setTimestamp()
        ]
    });
}

async function handleMemberAdd(client, message, args, sendError, sendSuccess, createEmbed) {
    const data = await ticketPanelSchema.findOne({ guildId: message.guild.id });

    if (!data) {
        return sendError(`There's \`no\` ticket setup yet!`);
    }

    const ticketPanel = data.panels.find(panel => panel.channels.includes(message.channel.id));
    if (!ticketPanel) {
        return sendError(`This channel \`isn't\` a valid ticket channel.`);
    }

    const members = message.channel.members;
    if (members.size >= MAX_TICKET_MEMBERS) {
        return sendError(`You can only add up to \`${MAX_TICKET_MEMBERS}\` members in this ticket.`);
    }

    if (!args[2]) {
        return sendError(`Please specify a member to add using the correct format: \`${message.guild.prefix}ticket member add <member>\`.`);
    }

    const member = message.mentions.members.first() ||
        message.guild.members.cache.get(args[2]) ||
        await message.guild.members.fetch(args[2]).catch(() => null);

    if (!member) {
        return sendError(`Member \`not\` found.`);
    }

    if (ticketPanel.supportRoleId) {
        const supportRole = await message.guild.roles.fetch(ticketPanel.supportRoleId).catch(() => null);
        if (supportRole) {
            member.roles.add(supportRole).catch(() => null);
        }
    }

    if (ticketPanel.staffRoleId) {
        const staffRole = await message.guild.roles.fetch(ticketPanel.staffRoleId).catch(() => null);
        if (staffRole) {
            member.roles.add(staffRole).catch(() => null);
        }
    }

    try {
        await message.channel.permissionOverwrites.edit(member.id, {
            SendMessages: true,
            AddReactions: true,
            ViewChannel: true
        });
        return sendSuccess(`Successfully added <@!${member.id}> to the \`ticket\` channel.`);
    } catch (error) {
        return sendError(`Unable to \`add\` the member to the ticket.`);
    }
}

async function handleMemberRemove(client, message, args, sendError, sendSuccess, createEmbed) {
    const data = await ticketPanelSchema.findOne({ guildId: message.guild.id });

    if (!data) {
        return sendError(`There's \`no\` ticket setup yet!`);
    }

    const ticketPanel = data.panels.find(panel => panel.channels.includes(message.channel.id));
    if (!ticketPanel) {
        return sendError(`This channel \`isn't\` a valid ticket channel.`);
    }

    if (!args[2]) {
        return sendError(`Please specify a member to remove using the correct format: \`${message.guild.prefix}ticket member remove <member>\`.`);
    }

    const member = message.mentions.members.first() ||
        message.guild.members.cache.get(args[2]) ||
        await message.guild.members.fetch(args[2]).catch(() => null);

    if (!member) {
        return sendError(`Member \`not\` found.`);
    }

    if (ticketPanel.supportRoleId) {
        const supportRole = await message.guild.roles.fetch(ticketPanel.supportRoleId).catch(() => null);
        if (supportRole && member.roles.cache.has(supportRole.id)) {
            member.roles.remove(supportRole).catch(() => null);
        }
    }

    if (ticketPanel.staffRoleId) {
        const staffRole = await message.guild.roles.fetch(ticketPanel.staffRoleId).catch(() => null);
        if (staffRole && member.roles.cache.has(staffRole.id)) {
            member.roles.remove(staffRole).catch(() => null);
        }
    }

    try {
        await message.channel.permissionOverwrites.edit(member.id, {
            ViewChannel: false
        });
        return sendSuccess(`Successfully removed <@!${member.id}> from the \`ticket\` channel.`);
    } catch (error) {
        return sendError(`Unable to \`remove\` the member from the ticket.`);
    }
}

async function handleChannelRename(client, message, args, sendError, sendSuccess, createEmbed) {
    const data = await ticketPanelSchema.findOne({ guildId: message.guild.id });

    if (!data) {
        return sendError(`There's \`no\` ticket setup yet!`);
    }

    if (!args[2]) {
        return sendError(`Please provide a channel to rename.`);
    }

    try {
        const channel = await getChannelFromMention(message, args[2]) ||
            message.guild.channels.cache.get(args[2]);

        if (!channel) {
            return sendError(`Please provide a valid channel.`);
        }

        const panel = data.panels.find(panel => panel.channels.includes(channel.id));
        if (!panel) {
            return sendError(`This channel \`isn't\` a ticket channel!`);
        }

        const now = Date.now();
        const lastRename = lastRenameMap.get(channel.id) || 0;
        const timeDiff = now - lastRename;

        if (timeDiff < RENAME_COOLDOWN) {
            return sendError(`You can rename this ticket only once every 10 minutes!`);
        }

        const newName = args.slice(3).join(' ');
        if (!newName) {
            return sendError(`Please provide a valid channel name.`);
        }

        await channel.setName(newName, 'Ticket channel renamed').catch(() => null);
        lastRenameMap.set(channel.id, Date.now());

        return sendSuccess(`The channel has been \`successfully\` renamed to **${newName}**.`);
    } catch (e) {
        console.log(e);
        return sendError(`Unable to \`rename\` the channel!`);
    }
}

async function handleChannelClose(client, message, args, sendError, createEmbed, createLogEmbed) {
    const data = await ticketPanelSchema.findOne({ guildId: message.guild.id });

    if (!data) {
        return sendError(`There's \`no\` ticket setup yet!`);
    }

    if (!args[2]) {
        return sendError(`Please provide a channel to close.`);
    }

    try {
        const channel = await getChannelFromMention(message, args[2]) ||
            message.guild.channels.cache.get(args[2]);

        if (!channel) {
            return sendError(`Please provide a valid channel.`);
        }

        const panel = data.panels.find(panel => panel.channels.includes(channel.id));
        if (!panel) {
            return sendError(`This channel isn't part of any ticket panel!`);
        }

        const ticketIndex = data.createdBy.findIndex(ticket => ticket.panelId === panel.panelId && ticket.channelId === channel.id);
        if (ticketIndex === -1) {
            return sendError(`Could not find the ticket in the database.`);
        }

        const ticketCreator = data.createdBy[ticketIndex]?.userId;
        const member = message.guild.members.cache.get(ticketCreator) ||
            await message.guild.members.fetch(ticketCreator).catch(() => null);

        if (!message.member.permissions.has("ManageChannels") && message.author.id !== member?.id) {
            return message.reply({ content: `${client.emoji.cross} | You don't have permission to close this ticket.` });
        }

        if (member) {
            const isOpen = channel.permissionOverwrites.cache.get(member.id)?.deny.has(['ViewChannel', 'SendMessages']);
            if (isOpen) {
                return message.reply({
                    embeds: [createEmbed(`Ticket <#${channel.id}> is already **closed**.`)]
                });
            }

            await channel.permissionOverwrites.edit(member.id, { ViewChannel: false, SendMessages: false });
        }

        data.createdBy[ticketIndex].status = 'closed';
        await data.save();

        await message.channel.send({
            embeds: [createEmbed(`Ticket <#${channel.id}> has been **closed** by ${message.author.tag}.`)]
        });

        const ticketlogs = panel.logsChannelId ? message.guild.channels.cache.get(panel.logsChannelId) : null;
        if (ticketlogs) {
            await ticketlogs.send({
                embeds: [
                    createLogEmbed({
                        author: { name: `Ticket Closed`, iconURL: message.author.displayAvatarURL({ dynamic: true }) },
                        description: `A ticket has been closed.`,
                        fields: [
                            { name: 'Ticket Owner', value: `<@${ticketCreator}>`, inline: true },
                            { name: 'Closed By', value: `<@${message.author.id}>`, inline: true },
                            { name: 'Ticket Channel', value: channel.name, inline: true },
                            { name: 'Ticket Action', value: 'Closed', inline: true },
                            { name: 'Panel Name', value: panel.panelName, inline: true },
                            { name: 'Panel ID', value: panel.panelId, inline: true },
                            { name: 'Ticket ID', value: channel.id, inline: true }
                        ],
                        footer: { text: `Ticket closed in panel: ${panel.panelName}` }
                    })
                ]
            }).catch(() => null);
        } else if (panel.logsChannelId) {
            panel.logsChannelId = null;
            await data.save();
        }
    } catch (error) {
        console.error(error);
        return sendError(`Unable to close the ticket!`);
    }
}

async function handleChannelDelete(client, message, args, sendError, createEmbed, createLogEmbed) {
    const data = await ticketPanelSchema.findOne({ guildId: message.guild.id });

    if (!data) {
        return sendError(`There's \`no\` ticket setup yet!`);
    }

    if (!args[2]) {
        return sendError(`Please provide a channel to delete.`);
    }

    try {
        const channel = await getChannelFromMention(message, args[2]) ||
            message.guild.channels.cache.get(args[2]);

        if (!channel) {
            return sendError(`Please provide a valid channel.`);
        }

        const panel = data.panels.find(panel => panel.channels.includes(channel.id));
        if (!panel) {
            return sendError(`This channel isn't part of any ticket panel!`);
        }

        const ticketIndex = data.createdBy.findIndex(ticket => ticket.panelId === panel.panelId && ticket.channelId === channel.id);
        if (ticketIndex === -1) {
            return sendError(`Could not find the ticket in the database.`);
        }

        const ticketCreator = data.createdBy[ticketIndex]?.userId;

        const channelIndex = panel.channels.indexOf(channel.id);
        if (channelIndex !== -1) {
            panel.channels.splice(channelIndex, 1);
        }

        if (ticketIndex !== -1) {
            data.createdBy.splice(ticketIndex, 1);
        }

        await data.save();

        const ticketlogs = panel.logsChannelId ? message.guild.channels.cache.get(panel.logsChannelId) : null;
        if (ticketlogs) {
            await ticketlogs.send({
                embeds: [
                    createLogEmbed({
                        author: { name: `Ticket Deleted`, iconURL: message.author.displayAvatarURL({ dynamic: true }) },
                        description: `A ticket has been deleted.`,
                        fields: [
                            { name: 'Ticket Owner', value: `<@${ticketCreator}>`, inline: true },
                            { name: 'Deleted By', value: `<@${message.author.id}>`, inline: true },
                            { name: 'Ticket Channel', value: channel.name, inline: true },
                            { name: 'Panel Name', value: panel.panelName, inline: true },
                            { name: 'Panel ID', value: panel.panelId, inline: true },
                            { name: 'Ticket ID', value: channel.id, inline: true }
                        ],
                        footer: { text: `Ticket deleted from panel: ${panel.panelName}` }
                    })
                ]
            }).catch(() => null);
        } else if (panel.logsChannelId) {
            panel.logsChannelId = null;
            await data.save();
        }

        await message.reply(`${client.emoji.tick} | Deleting this **ticket** in 3 seconds...`);
        await client.util.sleep(3000);
        await channel.delete().catch(() => null);
    } catch (error) {
        console.error(error);
        return sendError(`Unable to delete the ticket!`);
    }
}

async function handleChannelOpen(client, message, args, sendError, createEmbed, createLogEmbed) {
    const data = await ticketPanelSchema.findOne({ guildId: message.guild.id });

    if (!data) {
        return sendError(`Ticket system is not set up yet!`);
    }

    if (!args[2]) {
        return sendError(`Please provide a channel to open.`);
    }

    try {
        const channel = await getChannelFromMention(message, args[2]) ||
            message.guild.channels.cache.get(args[2]);

        if (!channel) {
            return sendError(`Please provide a valid channel.`);
        }

        const panel = data.panels.find(panel => panel.channels.includes(channel.id));
        if (!panel) {
            return sendError(`This channel isn't part of any ticket panel!`);
        }

        const ticketIndex = data.createdBy.findIndex(ticket => ticket.panelId === panel.panelId && ticket.channelId === channel.id);
        if (ticketIndex === -1) {
            return sendError(`Ticket not found in the database.`);
        }

        const ticketCreator = data.createdBy[ticketIndex]?.userId;
        const member = message.guild.members.cache.get(ticketCreator) ||
            await message.guild.members.fetch(ticketCreator).catch(() => null);

        if (member) {
            const isOpen = channel.permissionOverwrites.cache.get(member.id)?.allow.has(['ViewChannel', 'SendMessages']);
            if (isOpen) {
                return message.channel.send({
                    embeds: [createEmbed(`Ticket <#${channel.id}> is already **open**.`)]
                });
            }

            await channel.permissionOverwrites.edit(member.id, { ViewChannel: true, SendMessages: true });
        }

        data.createdBy[ticketIndex].status = 'open';
        await data.save();

        const ticketlogs = panel.logsChannelId ? message.guild.channels.cache.get(panel.logsChannelId) : null;
        if (ticketlogs) {
            await ticketlogs.send({
                embeds: [
                    createLogEmbed({
                        author: { name: `Ticket Opened`, iconURL: message.author.displayAvatarURL({ dynamic: true }) },
                        description: `A ticket has been reopened.`,
                        fields: [
                            { name: 'Ticket Owner', value: `<@${ticketCreator}>`, inline: true },
                            { name: 'Opened By', value: `<@${message.author.id}>`, inline: true },
                            { name: 'Ticket Channel', value: `<#${channel.id}>`, inline: true },
                            { name: 'Ticket Action', value: 'Opened', inline: true },
                            { name: 'Panel Name', value: panel.panelName, inline: true },
                            { name: 'Panel ID', value: panel.panelId, inline: true },
                            { name: 'Ticket ID', value: channel.id, inline: true }
                        ],
                        footer: { text: `Ticket opened on panel: ${panel.panelName}` }
                    })
                ]
            }).catch(() => null);
        } else if (panel.logsChannelId) {
            panel.logsChannelId = null;
            await data.save();
        }

        return message.channel.send({
            embeds: [createEmbed(`Ticket <#${channel.id}> has been **opened** by ${message.author.tag}.`)]
        });
    } catch (error) {
        console.error(error);
        return sendError(`Unable to open the ticket!`);
    }
}

async function getChannelFromMention(message, mention) {
    if (!mention) return null;

    const matches = mention.match(/^<#(\d+)>$/);
    if (!matches) return null;

    const channelId = matches[1];
    return await message.guild.channels.fetch(channelId).catch(() => null) || message.channel;
}
