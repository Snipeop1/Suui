const {
    EmbedBuilder,
    Collection,
    WebhookClient,
    ButtonStyle,
    ActionRowBuilder,
    ButtonBuilder,
    StringSelectMenuBuilder,
    AttachmentBuilder,
    PermissionsBitField,
    ChannelType,
    Partials,
    ComponentType
} = require('discord.js');
const { getSettingsar } = require('../models/welcome.js');
const lodash = require('lodash');
const { V2ComponentBuilder, CooldownManager } = require('./v2Components');

this.config = require(`${process.cwd()}/config.json`);
let globalCooldown;

module.exports = class Util {
    constructor(client) {
        this.client = client;
        this.v2 = new V2ComponentBuilder(client);
        this.cooldownManager = new CooldownManager();
    }

    async sendPreview(settings, member) {
        if (!settings.welcome?.enabled)
            return 'Welcome message not enabled in this server';

        const targetChannel = member.guild.channels.cache.get(
            settings.welcome.channel
        );
        if (!targetChannel)
            return 'No channel is configured to send welcome message';

        const response = await this.client.util.buildGreeting(
            member,
            'WELCOME',
            settings.welcome
        );

        let time = settings.welcome.autodel;
        await this.client.util.sendMessage(targetChannel, response, time);

        return `Sent welcome preview to ${targetChannel.toString()}`;
    }

    async setStatus(settings, status) {
        const enabled = status.toUpperCase() === 'ON' ? true : false;
        settings.welcome.enabled = enabled;
        await settings.save();
        return `Configuration saved! Welcome message ${enabled ? '**enabled**' : '**disabled**'}`;
    }

    async setChannel(settings, channel) {
        if (!this.client.util.canSendEmbeds(channel)) {
            return (
                'Ugh! I cannot send greeting to that channel? I need the `Write Messages` and `Embed Links` permissions in ' +
                channel.toString()
            );
        }
        settings.welcome.channel = channel.id;
        await settings.save();
        return `Configuration saved! Welcome message will be sent to ${channel ? channel.toString() : 'Not found'}`;
    }

    async setDescription(settings, desc) {
        settings.welcome.embed.description = desc;
        await settings.save();
        return 'Configuration saved! Welcome message updated';
    }

    async setTitle(settings, title) {
        settings.welcome.embed.title = title;
        await settings.save();
        return 'Configuration saved! Welcome message updated';
    }

    async setImage(settings, image) {
        settings.welcome.embed.image = image;
        await settings.save();
        return 'Configuration saved! Welcome image updated';
    }

    async setThumbnail(settings, status) {
        settings.welcome.embed.thumbnail =
            status.toUpperCase() === 'ON' ? true : false;
        await settings.save();
        return 'Configuration saved! Welcome message updated';
    }

    canSendEmbeds(channel) {
        return channel.permissionsFor(channel.guild.members.me).has(['SendMessages', 'EmbedLinks']);
    }

    async buildGreeting(member, type, config) {
        if (!config) return;
        let content = config.content
            ? await this.client.util.parse(config.content, member)
            : `<@${member.user.id}>`;
        const embed = this.embed()
            .setColor(config.embed.color || this.client.color);

        if (config.embed.description) {
            embed.setDescription(
                await this.client.util.parse(config.embed.description, member)
            );
        }

        if (config.embed.thumbnail) {
            embed.setThumbnail(member.user.displayAvatarURL({ dynamic: true }));
        }
        if (config.embed.image) {
            embed.setImage(
                await this.client.util.parse(config.embed.image, member)
            );
        }
        if (config.embed.title) {
            embed.setTitle(
                await this.client.util.parse(config.embed.title, member)
            );
        }
        if (config.embed.footer) {
            embed.setFooter({
                text: await this.client.util.parse(config.embed.footer, member)
            });
        }

        if (
            !config.content &&
            !config.embed.description &&
            !config.embed.footer
        ) {
            return {
                content: `<@${member.user.id}>`,
                embeds: [
                    this.embed()
                        .setColor(this.client.color)
                        .setDescription(
                            `Hey ${member.displayName}, Welcome to the server <a:welcome:1188456678392348702>.`
                        )
                ]
            };
        }
        return { content, embeds: [embed] };
    }

    async sendMessage(channel, content, seconds) {
        if (!channel || !content) return;
        const perms = new PermissionsBitField(['ViewChannel', 'SendMessages']);
        if (content.embeds && content.embeds.length > 0) {
            perms.add('EmbedLinks');
        }
        if (
            channel.type !== ChannelType.DM &&
            !channel.permissionsFor(channel.guild.members.me).has(perms)
        )
            return;
        try {
            if (!seconds || seconds == 0) return await channel.send(content);
            const reply = await channel.send(content);
            setTimeout(
                () => reply.deletable && reply.delete().catch(() => {}),
                seconds * 1000
            );
        } catch (ex) {
            return;
        }
    }

    async sendWelcome(member, settings) {
        const config = (await getSettingsar(member.guild))?.welcome;
        if (!config || !config.enabled) return;

        const channel = member.guild.channels.cache.get(config.channel);
        if (!channel) return;

        const response = await this.client.util.buildGreeting(
            member,
            'WELCOME',
            config
        );

        this.client.util.sendMessage(
            channel,
            response,
            settings.welcome.autodel
        );
    }

    isHex(text) {
        return /^#[0-9A-F]{6}$/i.test(text);
    }

    async parse(content, member) {
        let mention = `<@${member.user.id}>`;
        return content
            .replaceAll(/\\n/g, '\n')
            .replaceAll(/{server}/g, member.guild.name)
            .replaceAll(/{count}/g, member.guild.memberCount)
            .replaceAll(/{member:name}/g, member.displayName)
            .replaceAll(/{member:mention}/g, mention)
            .replaceAll(/{member:id}/g, member.user.id)
            .replaceAll(/{member:created_at}/g, `<t:${Math.round(member.user.createdTimestamp / 1000)}:R>`);
    }

    async purgeMessages(issuer, channel, type, amount, argument) {
        if (
            !channel
                .permissionsFor(issuer)
                .has(['ManageMessages', 'ReadMessageHistory'])
        ) {
            return 'MEMBER_PERM';
        }

        if (
            !channel
                .permissionsFor(channel.guild.members.me)
                .has(['ManageMessages', 'ReadMessageHistory'])
        ) {
            return 'BOT_PERM';
        }

        const toDelete = new Collection();

        try {
            const messages = await channel.messages.fetch(
                { limit: amount },
                { cache: false, force: true }
            );

            for (const message of messages.values()) {
                if (toDelete.size >= amount) break;
                if (!message.deletable) continue;

                if (type === 'ALL') {
                    toDelete.set(message.id, message);
                } else if (type === 'ATTACHMENT') {
                    if (message.attachments.size > 0) {
                        toDelete.set(message.id, message);
                    }
                } else if (type === 'BOT') {
                    if (message.author.bot) {
                        toDelete.set(message.id, message);
                    }
                } else if (type === 'LINK') {
                    if (this.containsLink(message.content)) {
                        toDelete.set(message.id, message);
                    }
                } else if (type === 'TOKEN') {
                    if (message.content.includes(argument)) {
                        toDelete.set(message.id, message);
                    }
                } else if (type === 'USER') {
                    if (message.author.id === argument) {
                        toDelete.set(message.id, message);
                    }
                }
            }

            if (toDelete.size === 0) return 'NO_MESSAGES';

            const deletedMessages = await channel.bulkDelete(toDelete, true);
            return deletedMessages.size;
        } catch (ex) {
            return 'ERROR';
        }
    }

    containsLink(text) {
        const urlRegex = /(https?:\/\/[^\s]+)/gi;
        return urlRegex.test(text);
    }

    async isExtraOwner(member, guild) {
        const data = await this.client.db.get(`extraowner_${guild.id}`);
        if (!data) return false;
        if (data?.owner?.includes(member.id)) return true;
        else return false;
    }

    hasHigher(member) {
        if (
            member.roles.highest.position <=
                member.guild.members.me.roles.highest.position &&
            member.user.id != member.guild.ownerId
        )
            return false;
        else return true;
    }

    async selectMenuHandle(interaction) {
        try {
            let options = interaction.values;
            const funny = options[0];
            const embed = this.embed()
                .setAuthor({
                    name: this.client.user.username,
                    iconURL: this.client.user.displayAvatarURL()
                })
                .setColor(this.client.color)
                .setThumbnail(
                    interaction.guild.iconURL({
                        dynamic: true
                    })
                );

            const categoryHandlers = {
                'antinuke': { category: 'security', name: 'Antinuke', emoji: '<:Antinuke:1374825414337233048>' },
                'moderation': { category: 'mod', name: 'Moderation', emoji: '<:Moderation:1374825363993006310>' },
                'automod': { category: 'automod', name: 'Automod', emoji: '<:Automod:1374825328580759662>' },
                'logger': { category: 'logging', name: 'Logging', emoji: '<:Logger:1374825300650627072>' },
                'utility': { category: 'info', name: 'Utility', emoji: '<:Utility:1374825272011919430>' },
                'serverutility': { category: 'leaderboard', name: 'Server Utility', emoji: '<:ServerUtility:1374825231381696663>' },
                'verification': { category: 'verification', name: 'Verification', emoji: '<:Verification:1374825164960960640>' },
                'jointocreate': { category: 'jointocreate', name: 'Join To Create', emoji: '<:Jtc:1374825143817339021>' },
                'voice': { category: 'voice', name: 'Voice', emoji: '<:Voice:1374825114201489468>' },
                'customrole': { category: 'customrole', name: 'Customrole', emoji: '<:CustomRole:1374825086741119098>' },
                'welcomer': { category: 'welcomer', name: 'Welcomer', emoji: '<:Welcome:1374825054961008710>' },
                'autoresponder': { category: 'autoresponder', name: 'Auto Responder', emoji: '<:AutoResponder:1374825195164008620>' },
                'sticky': { category: 'sticky', name: 'Sticky', emoji: '<:Sticky:1374825026921955389>' },
                'ticket': { category: 'ticket', name: 'Ticket', emoji: '<:Tickets:1374824970055716925>' }
            };

            const handler = categoryHandlers[funny];
            if (handler) {
                let cmdList = [];
                interaction.client.commands
                    .filter((cmd) => cmd.category === handler.category)
                    .forEach((cmd) => {
                        if (cmd.subcommand && cmd.subcommand.length) {
                            cmdList.push(`\`${cmd.name}\``);
                            cmd.subcommand.forEach((subCmd) => {
                                cmdList.push(`\`${cmd.name} ${subCmd}\``);
                            });
                        } else {
                            cmdList.push(`\`${cmd.name}\``);
                        }
                    });

                const joinedCmdList = cmdList.sort().join(', ');

                if (joinedCmdList.length <= 1024) {
                    embed.addFields({
                        name: `**${handler.emoji} ${handler.name} \`[${cmdList.length}]\`**`,
                        value: joinedCmdList || 'No commands found'
                    });
                    return interaction.reply({ embeds: [embed], ephemeral: true });
                } else {
                    const embed1 = this.embed()
                        .setTitle(`${handler.name} Commands`)
                        .setColor(interaction.client.color);

                    const embed2 = this.embed()
                        .setTitle(`${handler.name} Commands`)
                        .setColor(interaction.client.color);

                    const half = Math.ceil(cmdList.length / 2);
                    const firstHalf = cmdList.slice(0, half).join(', ');
                    const secondHalf = cmdList.slice(half).join(', ');

                    embed1.addFields({
                        name: `**${handler.emoji} ${handler.name} \`[${half}]\`**`,
                        value: firstHalf
                    });
                    embed2.addFields({
                        name: `**${handler.emoji} ${handler.name} \`[${cmdList.length - half}]\`**`,
                        value: secondHalf
                    });

                    return interaction.reply({ embeds: [embed1, embed2], ephemeral: true });
                }
            }
        } catch (err) {
            return;
        }
    }

    countCommandsAndSubcommands = () => {
        let totalCount = 0;

        this.client.commands.forEach(command => {
            totalCount++;

            if (command.subcommand && Array.isArray(command.subcommand)) {
                totalCount += command.subcommand.length;
            }
        });

        return totalCount;
    };

    async manageAfk(message, client) {
        const db = require('../models/afk.js');
        let data = await db.findOne({
            Member: message.author.id,
            $or: [
                { Guild: message.guildId },
                { Guild: null }
            ]
        });

        if (data) {
            if (message.author.id === data.Member) {
                if (data.Guild === message.guildId || data.Guild === null) {
                    await data.deleteOne();
                    return message.reply({
                        embeds: [
                            this.embed()
                                .setColor(client.color)
                                .setDescription(`I Removed Your AFK.`)
                        ]
                    });
                }
            }
        }

        const memberMentioned = message.mentions.users.first();
        if (memberMentioned) {
            data = await db.findOne({
                Member: memberMentioned.id,
                $or: [
                    { Guild: message.guildId },
                    { Guild: null }
                ]
            });

            if (data) {
                message.reply({
                    embeds: [
                        this.embed()
                            .setColor(client.color)
                            .setDescription(
                                `<@${memberMentioned.id}> went AFK <t:${Math.round(data.Time / 1000)}:R>\n\nFor Reason: **${data.Reason}**`
                            )
                    ]
                });
            }
        }
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(2))} ${sizes[i]}`;
    }

    ownerbutton() {
        return this.v2.createActionRow(
            this.v2.createDangerButton('DELETE_BUT', 'DELETE')
        );
    }

    async setPrefix(message, client) {
        let prefix = await this.client.db.get(`prefix_${message?.guild?.id}`) || client.config.PREFIX;
        if (prefix === null) prefix = client.config.PREFIX;
        message.guild.prefix = prefix;
    }

    async noprefix() {
        let data = (await this.client.db.get(`noprefix_${this.client.user.id}`))
            ? await this.client.db.get(`noprefix_${this.client.user.id}`)
            : [];
        this.client.noprefix = data;
    }

    async blacklist() {
        let data = (await this.client.db.get(
            `blacklist_${this.client.user.id}`
        ))
            ? await this.client.db.get(`blacklist_${this.client.user.id}`)
            : [];
        this.client.blacklist = data;
    }

    async blacklistserver() {
        let data = (await this.client.db.get(
            `blacklistserver_${this.client.user.id}`
        ))
            ? await this.client.db.get(`blacklistserver_${this.client.user.id}`)
            : [];
        this.client.blacklistserver = data;
    }

    async sleep(ms) {
        return await new Promise((resolve) => setTimeout(resolve, ms));
    }

    async handleRateLimit() {
        globalCooldown = true;
        await this.client.util.sleep(5000);
        globalCooldown = false;
    }

    async FuckYou(
        member,
        reason = 'Not Whitelisted | Performed Suspicious Activity'
    ) {
        try {
            member.guild = member.guild;
            await member.guild.members
                .ban(member.id, {
                    reason: reason
                })
                .catch(() => {});
        } catch (err) {
            return;
        }
    }

    embed() {
        return new EmbedBuilder();
    }

    async ExcelPagination(membersList, title, client, message) {
        const pages = lodash.chunk(membersList, 10);
        let currentPage = 0;

        const generateEmbed = () => {
            return this.embed()
                .setTitle(title)
                .setDescription(pages[currentPage].join('\n'))
                .setColor(client.color)
                .setAuthor({
                    name: message.guild.name,
                    iconURL: message.guild.iconURL({ dynamic: true }) || client.user.displayAvatarURL()
                })
                .setFooter({
                    text: `Page: ${currentPage + 1}/${pages.length}`,
                    iconURL: client.user.displayAvatarURL()
                });
        };

        if (pages.length === 0) {
            return message.channel.send({
                embeds: [
                    this.embed()
                        .setDescription('No Data found')
                        .setAuthor({
                            name: message.guild.name,
                            iconURL: message.guild.iconURL({ dynamic: true }) || client.user.displayAvatarURL()
                        })
                        .setFooter({
                            text: 'Page: 0',
                            iconURL: client.user.displayAvatarURL()
                        })
                        .setColor(client.color)
                        .setThumbnail(client.user.displayAvatarURL())
                ]
            });
        }

        if (pages.length === 1) {
            return message.channel.send({ embeds: [generateEmbed()] });
        }

        let buttonBack = this.v2.createSecondaryButton('1', null, '◀', true);
        let buttonHome = this.v2.createSecondaryButton('2', null, '⏹', false);
        let buttonForward = this.v2.createSecondaryButton('3', null, '▶️', false);
        let buttonFirst = this.v2.createSecondaryButton('4', null, '⏮', true);
        let buttonLast = this.v2.createSecondaryButton('5', null, '⏭', false);

        const getRow = () => this.v2.createActionRow(
            buttonFirst,
            buttonBack,
            buttonHome,
            buttonForward,
            buttonLast
        );

        let swapmsg = await message.channel.send({
            embeds: [generateEmbed()],
            components: [getRow()]
        });

        const collector = swapmsg.createMessageComponentCollector({
            filter: (i) => i.isButton() && i.user.id === message.member.id,
            time: 60000,
            componentType: ComponentType.Button
        });

        collector.on('collect', async (b) => {
            if (b.customId == '1') {
                if (currentPage !== 0) {
                    currentPage--;
                    if (currentPage === 0) {
                        buttonBack = this.v2.createSecondaryButton('1', null, '◀', true);
                        buttonFirst = this.v2.createSecondaryButton('4', null, '⏮', true);
                    }
                    buttonForward = this.v2.createSecondaryButton('3', null, '▶️', false);
                    buttonLast = this.v2.createSecondaryButton('5', null, '⏭', false);
                }
            } else if (b.customId == '2') {
                buttonBack = this.v2.createSecondaryButton('1', null, '◀', true);
                buttonForward = this.v2.createSecondaryButton('3', null, '▶️', true);
                buttonHome = this.v2.createSecondaryButton('2', null, '⏹', true);
                buttonFirst = this.v2.createSecondaryButton('4', null, '⏮', true);
                buttonLast = this.v2.createSecondaryButton('5', null, '⏭', true);
            } else if (b.customId == '3') {
                if (currentPage < pages.length - 1) {
                    currentPage++;
                    if (currentPage === pages.length - 1) {
                        buttonForward = this.v2.createSecondaryButton('3', null, '▶️', true);
                        buttonLast = this.v2.createSecondaryButton('5', null, '⏭', true);
                    }
                    buttonBack = this.v2.createSecondaryButton('1', null, '◀', false);
                    buttonFirst = this.v2.createSecondaryButton('4', null, '⏮', false);
                }
            } else if (b.customId == '4') {
                currentPage = 0;
                buttonBack = this.v2.createSecondaryButton('1', null, '◀', true);
                buttonFirst = this.v2.createSecondaryButton('4', null, '⏮', true);
                buttonForward = this.v2.createSecondaryButton('3', null, '▶️', false);
                buttonLast = this.v2.createSecondaryButton('5', null, '⏭', false);
            } else if (b.customId == '5') {
                currentPage = pages.length - 1;
                buttonForward = this.v2.createSecondaryButton('3', null, '▶️', true);
                buttonLast = this.v2.createSecondaryButton('5', null, '⏭', true);
                buttonBack = this.v2.createSecondaryButton('1', null, '◀', false);
                buttonFirst = this.v2.createSecondaryButton('4', null, '⏮', false);
            }

            await swapmsg.edit({
                embeds: [generateEmbed()],
                components: [getRow()]
            });

            await b.deferUpdate();
        });

        collector.on('end', () => {
            if (swapmsg) {
                buttonBack = this.v2.createSecondaryButton('1', null, '◀', true);
                buttonForward = this.v2.createSecondaryButton('3', null, '▶️', true);
                buttonHome = this.v2.createSecondaryButton('2', null, '⏹', true);
                buttonLast = this.v2.createSecondaryButton('5', null, '⏭', true);
                buttonFirst = this.v2.createSecondaryButton('4', null, '⏮', true);
                swapmsg.edit({
                    components: [getRow()]
                });
            }
        });
    }

    async checkAndLeaveNonPremiumGuilds(client) {
        try {
            const guilds = await client.guilds.fetch();
            for (const guild of guilds.values()) {
                const isPremium = await client.db.get(`sprem_${guild.id}`);
                if (!isPremium) {
                    const interval = setInterval(async () => {
                        try {
                            let nonguild = client.guilds.cache.get(guild.id);
                            if (nonguild) {
                                await client.util.sleep(2000);
                                await nonguild.leave();
                                console.log(`Left guild: ${guild.name}`);
                            }
                        } catch (error) {
                            console.error(`Failed to leave guild ${guild.name}:`, error);
                        } finally {
                            clearInterval(interval);
                        }
                    }, 60000);
                }
            }
        } catch (error) {
            console.error('Failed to check and leave non-premium guilds:', error);
        }
    }

    async BlacklistCheck(guild) {
        try {
            let data = await this.client.db.get(`blacklistserver_${this.client.user.id}`) || [];
            if (data.includes(guild.id)) {
                return true;
            } else {
                return false;
            }
        } catch (error) {
            return false;
        }
    }

    convertTime(ms) {
        const seconds = Math.floor((ms / 1000) % 60);
        const minutes = Math.floor((ms / (1000 * 60)) % 60);
        const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);

        const hoursStr = hours < 10 ? `0${hours}` : hours;
        const minutesStr = minutes < 10 ? `0${minutes}` : minutes;
        const secondsStr = seconds < 10 ? `0${seconds}` : seconds;

        return `${hoursStr}:${minutesStr}:${secondsStr}`;
    }

    async sendBooster(guild, member) {
        const db = require(`${process.cwd()}/models/boost.js`);
        const data = await db.findOne({ Guild: guild.id });
        if (!data || !data.Boost) return;
        try {
            let channel = guild.channels.cache.get(data.Boost);
            if (!channel) return;
            let count = guild.premiumSubscriptionCount;
            const embed = this.embed()
                .setColor(guild.roles.premiumSubscriberRole.color)
                .setAuthor({
                    name: `NEW BOOSTER`,
                    iconURL: `https://cdn.discordapp.com/emojis/1035418876470640660.gif`
                })
                .setThumbnail(member.displayAvatarURL({ dynamic: true }))
                .setDescription(
                    `**<@${member.id}> Just Boosted ${guild.name}. Thank You So Much For Boosting Our Server. We Now Have Total ${count} Boosts On Our Server!!**`
                )
                .setFooter({
                    text: `Server Boosted`,
                    iconURL: guild.iconURL({ dynamic: true })
                })
                .setTimestamp();
            await channel.send({ embeds: [embed] });
        } catch (err) {
            return;
        }
    }

    async pagination(message, description, desc = '') {
        let previousbut = this.v2.createSuccessButton('queueprev', null, '<:ARROW1:1182736084766036059>');
        let nextbut = this.v2.createSuccessButton('queuenext', null, '<:ARROW:1182735884978765957>');
        let row = this.v2.createActionRow(previousbut, nextbut);

        const pages = lodash.chunk(description, 10).map((x) => x.join(`\n`));
        let page = 0;
        let msg;

        if (pages.length <= 1) {
            return await message.channel.send({
                content: desc + this.client.util.codeText(pages[page])
            });
        } else {
            msg = await message.channel.send({
                content: desc + this.client.util.codeText(pages[page]),
                components: [row]
            });
        }

        const collector = message.channel.createMessageComponentCollector({
            filter: (b) => {
                if (b.user.id === message.author.id) return true;
                else {
                    b.reply({
                        ephemeral: true,
                        content: `Only **${message.author.tag}** can use this button, run the command again to use the queue menu.`
                    });
                    return false;
                }
            },
            time: 60000 * 5,
            idle: 30e3,
            componentType: ComponentType.Button
        });

        collector.on('collect', async (b) => {
            if (!b.deferred) await b.deferUpdate().catch(() => {});
            if (b.message.id !== msg.id) return;
            if (b.customId === 'queueprev') {
                page = page - 1 < 0 ? pages.length - 1 : --page;
                return await msg
                    .edit({
                        content: desc + this.client.util.codeText(pages[page])
                    })
                    .catch(() => {});
            } else if (b.customId === 'queuenext')
                page = page + 1 >= pages.length ? 0 : ++page;
            if (!msg) return;
            return await msg
                .edit({
                    content: desc + this.client.util.codeText(pages[page])
                })
                .catch(() => {});
        });

        collector.on('end', async () => {
            await msg.edit({ components: [] }).catch(() => {});
        });
    }

    codeText(text, type = 'js') {
        return `\`\`\`${type}\n${text}\`\`\``;
    }

    async haste(text) {
        const req = await this.client.snek.post(
            'https://haste.ntmnathan.com/documents',
            { text }
        );
        return `https://haste.ntmnathan.com/${req.data.key}`;
    }

    removeDuplicates(arr) {
        return [...new Set(arr)];
    }

    removeDuplicates2(arr) {
        return [...new Set(arr)];
    }

    createHelpSelectMenu() {
        const categories = [
            { label: 'Antinuke', value: 'antinuke', description: 'Security commands', emoji: '<:Antinuke:1374825414337233048>' },
            { label: 'Moderation', value: 'moderation', description: 'Moderation commands', emoji: '<:Moderation:1374825363993006310>' },
            { label: 'Automod', value: 'automod', description: 'Automod commands', emoji: '<:Automod:1374825328580759662>' },
            { label: 'Logger', value: 'logger', description: 'Logging commands', emoji: '<:Logger:1374825300650627072>' },
            { label: 'Utility', value: 'utility', description: 'Utility commands', emoji: '<:Utility:1374825272011919430>' },
            { label: 'Server Utility', value: 'serverutility', description: 'Server utility commands', emoji: '<:ServerUtility:1374825231381696663>' },
            { label: 'Verification', value: 'verification', description: 'Verification commands', emoji: '<:Verification:1374825164960960640>' },
            { label: 'Join To Create', value: 'jointocreate', description: 'Voice commands', emoji: '<:Jtc:1374825143817339021>' },
            { label: 'Voice', value: 'voice', description: 'Voice moderation', emoji: '<:Voice:1374825114201489468>' },
            { label: 'Custom Role', value: 'customrole', description: 'Custom role commands', emoji: '<:CustomRole:1374825086741119098>' },
            { label: 'Welcomer', value: 'welcomer', description: 'Welcome commands', emoji: '<:Welcome:1374825054961008710>' },
            { label: 'Auto Responder', value: 'autoresponder', description: 'Auto responder commands', emoji: '<:AutoResponder:1374825195164008620>' },
            { label: 'Sticky', value: 'sticky', description: 'Sticky message commands', emoji: '<:Sticky:1374825026921955389>' },
            { label: 'Ticket', value: 'ticket', description: 'Ticket commands', emoji: '<:Tickets:1374824970055716925>' }
        ];

        return this.v2.createActionRow(
            this.v2.createStringSelectMenu({
                customId: 'help_category',
                placeholder: 'Select a category',
                options: categories
            })
        );
    }
};
