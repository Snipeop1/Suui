const {
    V2ComponentBuilder,
    CooldownManager,
    EmbedBuilder,
    ButtonStyle,
    ComponentType
} = require('../structures/v2Components');
const ticketPanelSchema = require('../models/ticket');
const discordTranscripts = require('discord-html-transcripts');

const transcriptCooldowns = new CooldownManager();
const closeCooldowns = new CooldownManager();
const deleteCooldowns = new CooldownManager();
const closeRenameCooldowns = new CooldownManager();
const openRenameCooldowns = new CooldownManager();

module.exports = async (client) => {
    const v2 = new V2ComponentBuilder(client);

    const createTicketButtons = () => ({
        closeButton: v2.createSecondaryButton('close', 'Close', '🔒'),
        deleteButton: v2.createSecondaryButton('delete', 'Delete', '💣'),
        transcriptButton: v2.createSecondaryButton('transcript', 'Generate Transcripts', '📃'),
        openButton: v2.createSecondaryButton('Open', 'Open', '🔓')
    });

    const createCloseRow = () => {
        const { closeButton } = createTicketButtons();
        return v2.createActionRow(closeButton);
    };

    const createManageRow = () => {
        const { deleteButton, transcriptButton, openButton } = createTicketButtons();
        return v2.createActionRow(deleteButton, transcriptButton, openButton);
    };

    const createLogEmbed = (options) => {
        const {
            title,
            description,
            fields = [],
            author,
            color,
            footer
        } = options;

        const embed = new EmbedBuilder()
            .setColor(color || client.color)
            .setDescription(description)
            .setTimestamp();

        if (title) embed.setTitle(title);
        if (author) embed.setAuthor(author);
        if (fields.length > 0) embed.addFields(fields);
        if (footer) embed.setFooter(footer);

        return embed;
    };

    client.on("interactionCreate", async (i) => {
        try {
            if (!i.isButton()) return;

            if (i.customId.startsWith("ticket_setup_")) {
                await handleTicketCreate(i);
            } else if (i.customId === "close") {
                await handleTicketClose(i);
            } else if (i.customId === "delete") {
                await handleTicketDelete(i);
            } else if (i.customId === "Open") {
                await handleTicketOpen(i);
            } else if (i.customId === "transcript") {
                await handleTicketTranscript(i);
            }
        } catch (e) {
            console.error(e);
            if (!i.replied && !i.deferred) {
                return i.reply({
                    content: `${client.emoji.cross} | Something went wrong.`,
                    ephemeral: true
                }).catch(() => {});
            }
        }
    });

    async function handleTicketCreate(i) {
        const panelId = i.customId.split("_")[2];
        const data = await ticketPanelSchema.findOne({ guildId: i.guild.id });

        if (!data) {
            return i.reply({
                content: `${client.emoji.cross} | Ticket system is not set up.`,
                ephemeral: true
            });
        }

        const userTicket = data.createdBy.find(
            ticket => ticket.userId === i.user.id &&
                ticket.panelId === panelId &&
                ticket.status === "open"
        );

        if (userTicket) {
            return i.reply({
                content: `${client.emoji.cross} | You cannot create more than 1 ticket in this panel.`,
                ephemeral: true
            });
        }

        const panel = data.panels.find(panel => panel.panelId === panelId);
        if (!panel) {
            return i.reply({
                content: `${client.emoji.cross} | Panel not found.`,
                ephemeral: true
            });
        }

        if (!panel.enabled) {
            return i.reply({
                content: `${client.emoji.cross} | This panel is currently disabled.`,
                ephemeral: true
            });
        }

        const panelName = panel.panelName || `ticket`;
        const ticketChannelName = `${panelName}-${i.user.username}`;
        const categoryChannel = i.guild.channels.cache.get(panel.categoryId);

        const permissionOverwrites = [
            {
                id: i.guild.id,
                deny: ["ViewChannel"],
            },
            {
                id: i.user.id,
                allow: ["ViewChannel", "SendMessages", "ReadMessageHistory", "EmbedLinks", "AttachFiles", "AddReactions"],
            },
            {
                id: client.user.id,
                allow: ["ManageChannels"],
            },
        ];

        if (panel.staffRoleId) {
            permissionOverwrites.push({
                id: panel.staffRoleId,
                allow: ["ViewChannel", "SendMessages", "ReadMessageHistory", "EmbedLinks", "AttachFiles", "AddReactions"],
            });
        }

        if (panel.supportRoleId) {
            permissionOverwrites.push({
                id: panel.supportRoleId,
                allow: ["ViewChannel", "SendMessages", "ReadMessageHistory", "EmbedLinks", "AttachFiles", "AddReactions"],
            });
        }

        const channel = await i.guild.channels.create({
            name: ticketChannelName,
            type: 0,
            parent: categoryChannel,
            permissionOverwrites: permissionOverwrites,
        });

        panel.channels.push(channel.id);
        data.createdBy.push({ userId: i.user.id, panelId, channelId: channel.id });
        await data.save();

        const content = panel.staffRoleId
            ? `Welcome <@${i.user.id}>, <@&${panel.staffRoleId}> staff will assist you shortly!`
            : `Welcome <@${i.user.id}>!`;

        const ticketlogs = panel.logsChannelId
            ? i.guild.channels.cache.get(panel.logsChannelId)
            : null;

        if (ticketlogs) {
            const logEmbed = createLogEmbed({
                author: {
                    name: `Ticket Created`,
                    iconURL: i.user.displayAvatarURL({ dynamic: true })
                },
                description: `A new ticket has been created.`,
                color: client.color,
                fields: [
                    { name: 'Ticket Owner', value: `<@${i.user.id}>`, inline: true },
                    { name: 'Ticket Channel', value: `<#${channel.id}>`, inline: true },
                    { name: 'Ticket Action', value: 'Created', inline: true },
                    { name: 'Panel Name', value: panel.panelName, inline: true },
                    { name: 'Panel ID', value: panel.panelId, inline: true },
                ],
                footer: { text: `Ticket ID: ${channel.id}` }
            });

            ticketlogs.send({ embeds: [logEmbed] }).catch(() => null);
        }

        const welcomeEmbed = new EmbedBuilder()
            .setDescription("Support will be with you shortly.\nTo close this ticket click the 🔒 button.")
            .setColor(client.color);

        await channel.send({
            content: content,
            embeds: [welcomeEmbed],
            components: [createCloseRow()],
        });

        return i.reply({
            content: `<:Check:1375899259932508180> | Ticket created: <#${channel.id}>`,
            ephemeral: true
        });
    }

    async function handleTicketClose(i) {
        const cooldownKey = `close_${i.channel.id}`;
        const cooldownCheck = closeCooldowns.check(cooldownKey);

        if (cooldownCheck.onCooldown) {
            return i.reply({
                content: `Please wait ${cooldownCheck.remaining} seconds before closing this ticket again.`,
                ephemeral: true
            });
        }

        closeCooldowns.set(cooldownKey, 10 * 1000);

        const data = await ticketPanelSchema.findOne({ guildId: i.guild.id });
        if (!data) {
            return i.reply({
                content: `${client.emoji.cross} | Ticket system is not set up.`,
                ephemeral: true
            });
        }

        const panel = data.panels.find(panel => panel.channels.includes(i.channel.id));
        if (!panel) {
            return i.reply({
                content: `${client.emoji.cross} | This ticket does not belong to a valid panel.`,
                ephemeral: true
            });
        }

        const ticketIndex = data.createdBy.findIndex(
            ticket => ticket.panelId === panel.panelId && ticket.channelId === i.channel.id
        );

        if (ticketIndex === -1) {
            return i.reply({
                content: `${client.emoji.cross} | Could not find the ticket in the database.`,
                ephemeral: true
            });
        }

        const ticketCreator = data.createdBy[ticketIndex]?.userId;
        const member = i.guild.members.cache.get(ticketCreator) ||
            await i.guild.members.fetch(ticketCreator).catch(() => null);

        if (!member) {
            return i.reply({
                content: `${client.emoji.cross} | Could not find the ticket creator.`,
                ephemeral: true
            });
        }

        if (!i.member.permissions.has("ManageChannels") && i.user.id !== member?.id) {
            return i.reply({
                content: `${client.emoji.cross} | You don't have permission to close this ticket.`,
                ephemeral: true
            });
        }

        const isAlreadyClosed = i.channel.permissionOverwrites.cache.get(member.id)?.deny.has(['ViewChannel', 'SendMessages']);
        if (isAlreadyClosed) {
            return i.reply({
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`Ticket <#${i.channel.id}> is already **closed**`)
                        .setColor(client.color)
                ],
                ephemeral: true
            });
        }

        await i.channel.permissionOverwrites.edit(member.id, { ViewChannel: false, SendMessages: false });
        data.createdBy[ticketIndex].status = 'closed';

        const renameCooldownKey = `closeRename_${i.channel.id}`;
        const renameCooldownCheck = closeRenameCooldowns.check(renameCooldownKey);

        if (!renameCooldownCheck.onCooldown) {
            const originalName = i.channel.name.replace(/^closed-/, '');
            await i.channel.setName(`closed-${originalName}`).catch(console.error);
            closeRenameCooldowns.set(renameCooldownKey, 10 * 60 * 1000);
        }

        await data.save();

        await i.reply({
            embeds: [
                new EmbedBuilder()
                    .setDescription(`Ticket <#${i.channel.id}> has been **closed** by ${i.user.tag}`)
                    .setColor(client.color)
            ],
            components: [createManageRow()],
        });

        const ticketlogs = panel.logsChannelId
            ? i.guild.channels.cache.get(panel.logsChannelId)
            : null;

        if (ticketlogs) {
            const logEmbed = createLogEmbed({
                author: {
                    name: `Ticket Closed`,
                    iconURL: i.user.displayAvatarURL({ dynamic: true })
                },
                description: `A ticket has been closed.`,
                color: client.color,
                fields: [
                    { name: 'Ticket Owner', value: `<@${ticketCreator}>`, inline: true },
                    { name: 'Closed By', value: `<@${i.user.id}>`, inline: true },
                    { name: 'Ticket Channel', value: i.channel.name, inline: true },
                    { name: 'Ticket Action', value: 'Closed', inline: true },
                    { name: 'Panel Name', value: panel.panelName, inline: true },
                    { name: 'Panel ID', value: panel.panelId, inline: true },
                    { name: 'Ticket ID', value: i.channel.id, inline: true }
                ],
                footer: { text: `Ticket closed in panel: ${panel.panelName}` }
            });

            ticketlogs.send({ embeds: [logEmbed] }).catch(() => {});
        }
    }

    async function handleTicketDelete(i) {
        const cooldownKey = `delete_${i.channel.id}`;
        const cooldownCheck = deleteCooldowns.check(cooldownKey);

        if (cooldownCheck.onCooldown) {
            return i.reply({
                content: `Please wait ${cooldownCheck.remaining} seconds before deleting this ticket again.`,
                ephemeral: true
            });
        }

        deleteCooldowns.set(cooldownKey, 10 * 1000);

        const data = await ticketPanelSchema.findOne({ guildId: i.guild.id });
        if (!data) {
            return i.reply({
                content: `${client.emoji.cross} | Ticket system is not set up.`,
                ephemeral: true
            });
        }

        const panel = data.panels.find(p => p.channels.includes(i.channel.id));
        if (!panel) {
            return i.reply({
                content: `${client.emoji.cross} | This ticket does not belong to a valid panel.`,
                ephemeral: true
            });
        }

        const ticketIndex = data.createdBy.findIndex(
            ticket => ticket.panelId === panel.panelId && ticket.channelId === i.channel.id
        );

        if (ticketIndex === -1) {
            return i.reply({
                content: `${client.emoji.cross} | Could not find the ticket in the database.`,
                ephemeral: true
            });
        }

        const ticketCreator = data.createdBy[ticketIndex]?.userId;

        const channelIndex = panel.channels.indexOf(i.channel.id);
        if (channelIndex !== -1) {
            panel.channels.splice(channelIndex, 1);
        }

        const creatorIndex = data.createdBy.findIndex(
            ticket => ticket.panelId === panel.panelId && ticket.channelId === i.channel.id
        );

        if (creatorIndex !== -1) {
            data.createdBy.splice(creatorIndex, 1);
        }

        await data.save();

        const ticketlogs = panel.logsChannelId
            ? i.guild.channels.cache.get(panel.logsChannelId)
            : null;

        if (ticketlogs) {
            const logEmbed = createLogEmbed({
                author: {
                    name: `Ticket Deleted`,
                    iconURL: i.user.displayAvatarURL({ dynamic: true })
                },
                description: `A ticket has been deleted.`,
                color: client.color,
                fields: [
                    { name: 'Ticket Owner', value: `<@${ticketCreator}>`, inline: true },
                    { name: 'Deleted By', value: `<@${i.user.id}>`, inline: true },
                    { name: 'Ticket Channel', value: i.channel.name, inline: true },
                    { name: 'Ticket Action', value: 'Deleted', inline: true },
                    { name: 'Panel Name', value: panel.panelName, inline: true },
                    { name: 'Panel ID', value: panel.panelId, inline: true },
                    { name: 'Ticket ID', value: i.channel.id, inline: true }
                ],
                footer: { text: `Ticket deleted from panel: ${panel.panelName}` }
            });

            ticketlogs.send({ embeds: [logEmbed] }).catch(() => {});
        }

        await i.reply({ content: "Deleting this ticket in 3 seconds...", ephemeral: true });
        await client.util.sleep(3000);
        await i.channel.delete().catch(() => null);
    }

    async function handleTicketOpen(i) {
        const data = await ticketPanelSchema.findOne({ guildId: i.guild.id });
        if (!data) {
            return i.reply({
                content: `${client.emoji.cross} | Ticket system is not set up.`,
                ephemeral: true
            });
        }

        const panel = data.panels.find(panel => panel.channels.includes(i.channel.id));
        if (!panel) {
            return i.reply({
                content: `${client.emoji.cross} | This ticket does not belong to a valid panel.`,
                ephemeral: true
            });
        }

        const ticketIndex = data.createdBy.findIndex(
            ticket => ticket.panelId === panel.panelId && ticket.channelId === i.channel.id
        );

        if (ticketIndex === -1) {
            return i.reply({
                content: `${client.emoji.cross} | Could not find the ticket in the database.`,
                ephemeral: true
            });
        }

        const ticketCreator = data.createdBy[ticketIndex]?.userId;
        const member = i.guild.members.cache.get(ticketCreator) ||
            await i.guild.members.fetch(ticketCreator).catch(() => null);

        if (!member) {
            return i.reply({
                content: `${client.emoji.cross} | Could not find the ticket creator.`,
                ephemeral: true
            });
        }

        const isOpen = i.channel.permissionOverwrites.cache.get(member.id)?.allow.has(['ViewChannel', 'SendMessages']);
        if (isOpen) {
            return i.reply({
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`Ticket <#${i.channel.id}> is already **opened**`)
                        .setColor(client.color)
                ],
                ephemeral: true
            });
        }

        await i.channel.permissionOverwrites.edit(member.id, { ViewChannel: true, SendMessages: true });
        data.createdBy[ticketIndex].status = 'open';

        if (i.channel.name.startsWith('closed-')) {
            const renameCooldownKey = `openRename_${i.channel.id}`;
            const renameCooldownCheck = openRenameCooldowns.check(renameCooldownKey);

            if (!renameCooldownCheck.onCooldown) {
                const newName = i.channel.name.replace(/^closed-/, '');
                await i.channel.setName(newName).catch(console.error);
                openRenameCooldowns.set(renameCooldownKey, 10 * 60 * 1000);
            } else {
                await i.reply({
                    content: `Channel rename on cooldown. Skipping rename operation. Try again in ${Math.ceil(renameCooldownCheck.remaining / 60)} minutes.`,
                    ephemeral: true
                });
            }
        }

        await data.save();

        const ticketlogs = panel.logsChannelId
            ? i.guild.channels.cache.get(panel.logsChannelId)
            : null;

        if (ticketlogs) {
            const logEmbed = createLogEmbed({
                author: {
                    name: `Ticket Opened`,
                    iconURL: i.user.displayAvatarURL({ dynamic: true })
                },
                description: `A ticket has been opened.`,
                color: client.color,
                fields: [
                    { name: 'Ticket Owner', value: `<@${ticketCreator}>`, inline: true },
                    { name: 'Opened By', value: `<@${i.user.id}>`, inline: true },
                    { name: 'Ticket Channel', value: `<#${i.channel.id}>`, inline: true },
                    { name: 'Ticket Action', value: 'Opened', inline: true },
                    { name: 'Panel Name', value: panel.panelName, inline: true },
                    { name: 'Panel ID', value: panel.panelId, inline: true },
                    { name: 'Ticket ID', value: i.channel.id, inline: true }
                ],
                footer: { text: `Ticket opened on panel: ${panel.panelName}` }
            });

            ticketlogs.send({ embeds: [logEmbed] }).catch(() => {});
        }

        await i.reply({
            embeds: [
                new EmbedBuilder()
                    .setDescription(`Ticket <#${i.channel.id}> has been **opened** by ${i.user.tag}`)
                    .setColor(client.color)
            ],
        });
    }

    async function handleTicketTranscript(i) {
        try {
            const data = await ticketPanelSchema.findOne({ guildId: i.guild.id });
            if (!data) {
                return i.reply({
                    content: `${client.emoji.cross} | Ticket system is not set up.`,
                    ephemeral: true
                });
            }

            const panel = data.panels.find(panel => panel.channels.includes(i.channel.id));
            if (!panel) {
                return i.reply({
                    content: `${client.emoji.cross} | This ticket does not belong to a valid panel.`,
                    ephemeral: true
                });
            }

            const ticketChannel = i.channel;
            const transcriptChannelId = panel.transcriptChannelId;

            if (!transcriptChannelId) {
                return i.reply({
                    content: `${client.emoji.cross} | Transcript channel is not set up for this ticket panel.`,
                    ephemeral: true
                });
            }

            const transcriptChannel = i.guild.channels.cache.get(transcriptChannelId);
            if (!transcriptChannel) {
                return i.reply({
                    content: `${client.emoji.cross} | Transcript channel not found.`,
                    ephemeral: true
                });
            }

            const ticketCreator = data.createdBy.find(
                ticket => ticket?.panelId === panel?.panelId && panel?.channels.includes(i.channel.id)
            )?.userId;

            const cooldownKey = `transcript_${ticketChannel.id}`;
            const cooldownCheck = transcriptCooldowns.check(cooldownKey);

            if (cooldownCheck.onCooldown) {
                return i.reply({
                    content: `${client.emoji.cross} | Please wait ${cooldownCheck.remaining} seconds before generating another transcript.`,
                    ephemeral: true
                });
            }

            const fetchAllMessages = async (channel) => {
                let messages = [];
                let lastMessageId = null;
                let fetchedMessages;

                do {
                    fetchedMessages = await channel.messages.fetch({ limit: 100, before: lastMessageId });
                    messages = messages.concat(Array.from(fetchedMessages.values()));
                    lastMessageId = fetchedMessages.last()?.id;
                } while (fetchedMessages.size > 0);

                return messages;
            };

            const allMessages = await fetchAllMessages(ticketChannel);
            const sortedMessages = allMessages.reverse();

            const transcript = await discordTranscripts.generateFromMessages(sortedMessages, ticketChannel, {
                returnType: 'attachment',
                filename: `${panel.panelName}-${ticketChannel.name}-transcript.html`,
                saveImages: true,
                footerText: `${panel.panelName} Ticket Transcript Exported`,
                callbacks: {
                    resolveChannel: (channelId) => i.guild.channels.cache.get(channelId),
                    resolveUser: (userId) => i.client.users.fetch(userId),
                    resolveRole: (roleId) => i.guild.roles.cache.get(roleId),
                },
                poweredBy: false,
                ssr: true
            });

            const transcriptMessage = await transcriptChannel.send({
                content: `Transcript for the ticket in ${ticketChannel.name} has been generated.`,
                files: [transcript]
            });

            const transcriptFileURL = transcriptMessage.attachments.first()?.url;

            const participants = new Set();
            allMessages.forEach(message => participants.add(message.author.tag));
            const participantList = [...participants].map((user, index) => `**${index + 1}** - ${user}`).join('\n');

            const transcriptEmbed = new EmbedBuilder()
                .setColor('#2F3136')
                .setAuthor({ name: i.user.tag, iconURL: i.user.displayAvatarURL() })
                .setTitle('Ticket Transcript')
                .addFields(
                    { name: 'Ticket Owner', value: `<@${ticketCreator || "N/A"}>`, inline: true },
                    { name: 'Ticket Name', value: ticketChannel.name, inline: true },
                    { name: 'Panel Name', value: panel.panelName || "N/A", inline: true },
                    { name: 'Transcript', value: 'Attached below', inline: true },
                    { name: 'Direct Transcript', value: 'Use Button', inline: true },
                    { name: 'Users in Transcript', value: participantList || 'No participants', inline: true }
                )
                .setFooter({ text: `Ticket ID: ${ticketChannel.id}`, iconURL: i.guild.iconURL() })
                .setTimestamp();

            const row = v2.createActionRow(
                v2.createLinkButton(transcriptFileURL, 'Direct Download Link', '📄')
            );

            await transcriptChannel.send({
                embeds: [transcriptEmbed],
                components: [row]
            });

            transcriptCooldowns.set(cooldownKey, 60 * 1000);

            await i.reply({
                content: `${client.emoji.tick} | Transcript has been successfully sent to the transcript channel.`,
                ephemeral: true
            });

            const ticketlogs = panel.logsChannelId
                ? i.guild.channels.cache.get(panel.logsChannelId)
                : null;

            if (ticketlogs) {
                const logEmbed = createLogEmbed({
                    author: {
                        name: `Ticket Transcript`,
                        iconURL: i.user.displayAvatarURL({ dynamic: true })
                    },
                    description: `A ticket transcript has been generated.`,
                    color: client.color,
                    fields: [
                        { name: 'Ticket Owner', value: `<@${ticketCreator}>`, inline: true },
                        { name: 'Transcript Generated By', value: `<@${i.user.id}>`, inline: true },
                        { name: 'Ticket Channel', value: `<#${i.channel.id}>`, inline: true },
                        { name: 'Ticket Action', value: 'Transcript Generated', inline: true },
                        { name: 'Panel Name', value: panel.panelName, inline: true },
                        { name: 'Panel ID', value: panel.panelId, inline: true },
                        { name: 'Transcript Channel', value: `<#${panel.transcriptChannelId}>`, inline: true }
                    ],
                    footer: { text: `Transcript generated for panel: ${panel.panelName}` }
                });

                ticketlogs.send({ embeds: [logEmbed] }).catch(() => {});
            }
        } catch (error) {
            console.error('Error generating transcript:', error);
            return i.reply({
                content: `${client.emoji.cross} | Failed to generate or send the transcript. Please try again later.`,
                ephemeral: true
            });
        }
    }
};
