const {
    V2ComponentBuilder,
    CooldownManager,
    PermissionFlagsBits,
    ChannelType,
    ComponentType,
    TextInputStyle
} = require('../structures/v2Components');
const GuildConfig = require('../models/guildconfig');

const vcCooldowns = new CooldownManager();

const VOICE_CUSTOM_IDS = [
    'lock', 'unlock', 'hide', 'unhide',
    'vckick', 'vcmute', 'vcunmute', 'vcdeaf', 'vcundeaf', 'vcban',
    'channelname', 'changeregion', 'userlimit', 'changebitrate', 'transferownership',
    'selectUserToKick', 'selectUserToBan', 'selectUserToMute', 'selectUserToDeaf',
    'selectUserToUndeaf', 'selectUserToUnmute', 'selectUserToTransferOwnership',
    'selectRegion', 'channelnameModal', 'userlimitModal', 'bitrateModal'
];

const REGIONS = [
    { label: 'India', value: 'india' },
    { label: 'Brazil', value: 'brazil' },
    { label: 'Hong Kong', value: 'hongkong' },
    { label: 'Japan', value: 'japan' },
    { label: 'Rotterdam', value: 'rotterdam' },
    { label: 'Russia', value: 'russia' },
    { label: 'Singapore', value: 'singapore' },
    { label: 'South Korea', value: 'south-korea' },
    { label: 'South Africa', value: 'southafrica' },
    { label: 'Sydney', value: 'sydney' },
    { label: 'US Central', value: 'us-central' },
    { label: 'US East', value: 'us-east' },
    { label: 'US South', value: 'us-south' },
    { label: 'US West', value: 'us-west' }
];

module.exports = async (client) => {
    const v2 = new V2ComponentBuilder(client);

    const getMaxBitrate = (guild) => {
        const boostLevel = guild.premiumTier;
        switch (boostLevel) {
            case 1: return 128000;
            case 2: return 256000;
            case 3: return 384000;
            default: return 96000;
        }
    };

    const createUserSelectRow = (customId, placeholder, members, filterFn = null) => {
        const filteredMembers = filterFn ? members.filter(filterFn) : members;
        const options = filteredMembers.map(member => ({
            label: member.user.username,
            value: member.id
        })).slice(0, 24);

        return v2.createActionRow(
            v2.createStringSelectMenu({
                customId,
                placeholder,
                options,
                maxValues: Math.min(options.length, 24)
            })
        );
    };

    const createChannelNameModal = () => {
        return v2.createModal({
            customId: 'channelnameModal',
            title: 'Change Channel Name',
            components: [
                v2.createActionRow(
                    v2.createShortTextInput('channelnameInput', 'Enter new channel name:', {
                        required: true,
                        maxLength: 24,
                        minLength: 1
                    })
                )
            ]
        });
    };

    const createUserLimitModal = () => {
        return v2.createModal({
            customId: 'userlimitModal',
            title: 'Change User Limit',
            components: [
                v2.createActionRow(
                    v2.createShortTextInput('userlimitInput', 'Enter new user limit:', {
                        required: true,
                        placeholder: '0-99'
                    })
                )
            ]
        });
    };

    const createBitrateModal = (maxBitrate) => {
        return v2.createModal({
            customId: 'bitrateModal',
            title: 'Change Bitrate',
            components: [
                v2.createActionRow(
                    v2.createShortTextInput('bitrateInput', `Enter new bitrate (max: ${maxBitrate / 1000} kbps):`, {
                        required: true,
                        placeholder: `8-${maxBitrate / 1000}`
                    })
                )
            ]
        });
    };

    const createRegionSelectRow = () => {
        return v2.createActionRow(
            v2.createStringSelectMenu({
                customId: 'selectRegion',
                placeholder: 'Select a region',
                options: REGIONS
            })
        );
    };

    client.on('voiceStateUpdate', async (oldState, newState) => {
        try {
            const guild = newState.guild;
            const guildConfig = await GuildConfig.findOne({ guildId: guild.id });
            if (!guildConfig) return;

            const hubChannel = guild.channels.cache.get(guildConfig.hubChannelId) ||
                await guild.channels.fetch(guildConfig.hubChannelId).catch(() => null);
            const categoryChannel = guild.channels.cache.get(guildConfig.categoryId) ||
                await guild.channels.fetch(guildConfig.categoryId).catch(() => null);

            if (!hubChannel || !categoryChannel) {
                await GuildConfig.deleteOne({ guildId: guild.id });
                return;
            }

            if (oldState.channel) {
                const tempChannel = guildConfig.tempVoiceChannels.find(ch => ch.channelId === oldState.channel.id);
                if (tempChannel) {
                    const voiceChannel = guild.channels.cache.get(tempChannel.channelId);
                    if (voiceChannel) {
                        if (oldState.member.id === tempChannel.ownerId) {
                            if (voiceChannel.members.size > 0 && !newState.member.user.bot) {
                                const newOwner = voiceChannel.members.first();
                                if (newOwner) {
                                    await GuildConfig.updateOne(
                                        { guildId: guild.id, 'tempVoiceChannels.channelId': voiceChannel.id },
                                        { $set: { 'tempVoiceChannels.$.ownerId': newOwner.id } }
                                    );
                                    await voiceChannel.setName(`${newOwner.user.displayName}'s Vc`).catch(() => null);
                                }
                            } else {
                                await voiceChannel.delete().catch(() => null);
                                await GuildConfig.updateOne(
                                    { guildId: guild.id },
                                    { $pull: { tempVoiceChannels: { channelId: voiceChannel.id } } }
                                );
                            }
                        } else if (voiceChannel.members.size === 0) {
                            await voiceChannel.delete().catch(() => null);
                            await GuildConfig.updateOne(
                                { guildId: guild.id },
                                { $pull: { tempVoiceChannels: { channelId: voiceChannel.id } } }
                            );
                        }
                    }
                }
            }

            if (newState.channelId === guildConfig.hubChannelId && !newState.member.user.bot) {
                const newChannel = await guild.channels.create({
                    name: `${newState.member.user.displayName}'s Vc`,
                    type: ChannelType.GuildVoice,
                    parent: guildConfig.categoryId,
                    permissionOverwrites: [
                        {
                            id: guild.id,
                            allow: [
                                PermissionFlagsBits.ViewChannel,
                                PermissionFlagsBits.Speak,
                                PermissionFlagsBits.Connect
                            ]
                        }
                    ]
                });

                await newState.setChannel(newChannel);
                await GuildConfig.updateOne(
                    { guildId: guild.id },
                    { $push: { tempVoiceChannels: { channelId: newChannel.id, ownerId: newState.member.id } } }
                );
            }
        } catch (error) {
            console.error('Voice state update error:', error);
        }
    });

    client.on('interactionCreate', async interaction => {
        if (!interaction.isButton() && !interaction.isStringSelectMenu() && !interaction.isModalSubmit()) return;
        if (!VOICE_CUSTOM_IDS.includes(interaction.customId)) return;

        try {
            const guildConfig = await GuildConfig.findOne({ guildId: interaction?.guild?.id });
            if (!guildConfig) return;

            const member = interaction.guild.members.cache.get(interaction.user.id);
            const voiceChannel = member?.voice?.channel;
            const tempChannel = guildConfig.tempVoiceChannels.find(ch => ch?.channelId === voiceChannel?.id);

            if (!voiceChannel || !tempChannel) {
                return interaction.reply({
                    content: `It seems you either don't have a temporary channel or you're not currently in a voice channel. Please ensure you're in the correct voice channel and try again.`,
                    ephemeral: true
                });
            }

            if (tempChannel?.ownerId !== interaction?.user?.id) {
                return interaction.reply({
                    content: `You are not the owner of this voice channel.`,
                    ephemeral: true
                });
            }

            const maxBitrate = getMaxBitrate(interaction.guild);
            const membersArray = Array.from(voiceChannel.members.values());

            switch (interaction.customId) {
                case 'lock':
                    await handleLock(interaction, voiceChannel);
                    break;

                case 'unlock':
                    await handleUnlock(interaction, voiceChannel);
                    break;

                case 'hide':
                    await handleHide(interaction, voiceChannel);
                    break;

                case 'unhide':
                    await handleUnhide(interaction, voiceChannel);
                    break;

                case 'vckick':
                    await handleKickMenu(interaction, voiceChannel, membersArray);
                    break;

                case 'vcmute':
                    await handleMuteMenu(interaction, voiceChannel, membersArray);
                    break;

                case 'vcunmute':
                    await handleUnmuteMenu(interaction, voiceChannel, membersArray);
                    break;

                case 'vcdeaf':
                    await handleDeafMenu(interaction, voiceChannel, membersArray);
                    break;

                case 'vcundeaf':
                    await handleUndeafMenu(interaction, voiceChannel, membersArray);
                    break;

                case 'vcban':
                    await handleBanMenu(interaction, voiceChannel, membersArray);
                    break;

                case 'channelname':
                    await interaction.showModal(createChannelNameModal());
                    break;

                case 'changeregion':
                    await interaction.reply({
                        content: 'Select a region for the voice channel:',
                        components: [createRegionSelectRow()],
                        ephemeral: true
                    });
                    break;

                case 'selectRegion':
                    const region = interaction.values[0];
                    await voiceChannel.setRTCRegion(region);
                    return interaction.reply({
                        content: `Voice channel region has been changed to ${region}.`,
                        ephemeral: true
                    });

                case 'userlimit':
                    await interaction.showModal(createUserLimitModal());
                    break;

                case 'changebitrate':
                    await interaction.showModal(createBitrateModal(maxBitrate));
                    break;

                case 'transferownership':
                    await handleTransferMenu(interaction, voiceChannel, membersArray);
                    break;

                case 'selectUserToTransferOwnership':
                    await handleTransferOwnership(interaction, voiceChannel, guildConfig);
                    break;

                case 'selectUserToKick':
                    await handleKickUsers(interaction, voiceChannel);
                    break;

                case 'selectUserToBan':
                    await handleBanUsers(interaction, voiceChannel);
                    break;

                case 'selectUserToMute':
                    await handleMuteUsers(interaction, voiceChannel);
                    break;

                case 'selectUserToUnmute':
                    await handleUnmuteUsers(interaction, voiceChannel);
                    break;

                case 'selectUserToDeaf':
                    await handleDeafUsers(interaction, voiceChannel);
                    break;

                case 'selectUserToUndeaf':
                    await handleUndeafUsers(interaction, voiceChannel);
                    break;

                case 'bitrateModal':
                    await handleBitrateModal(interaction, voiceChannel, maxBitrate);
                    break;

                case 'channelnameModal':
                    await handleChannelNameModal(interaction, voiceChannel);
                    break;

                case 'userlimitModal':
                    await handleUserLimitModal(interaction, voiceChannel);
                    break;
            }
        } catch (e) {
            console.error('Voice channel interaction error:', e);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: 'An error occurred while processing your request.',
                    ephemeral: true
                }).catch(() => {});
            }
        }
    });

    async function handleLock(interaction, voiceChannel) {
        try {
            await voiceChannel.permissionOverwrites.edit(interaction.guild.id, {
                Connect: false
            });
            return interaction.reply({ content: 'Voice channel has been locked.', ephemeral: true });
        } catch (err) {
            return interaction.reply({ content: 'Unknown Error Occurred', ephemeral: true });
        }
    }

    async function handleUnlock(interaction, voiceChannel) {
        try {
            await voiceChannel.permissionOverwrites.edit(interaction.guild.id, {
                Connect: true
            });
            return interaction.reply({ content: 'Voice channel has been unlocked.', ephemeral: true });
        } catch (err) {
            return interaction.reply({ content: 'Unknown Error Occurred', ephemeral: true });
        }
    }

    async function handleHide(interaction, voiceChannel) {
        try {
            await voiceChannel.permissionOverwrites.edit(interaction.guild.id, {
                ViewChannel: false
            });
            return interaction.reply({ content: 'Voice channel has been hidden.', ephemeral: true });
        } catch (err) {
            return interaction.reply({ content: 'Unknown Error Occurred', ephemeral: true });
        }
    }

    async function handleUnhide(interaction, voiceChannel) {
        try {
            await voiceChannel.permissionOverwrites.edit(interaction.guild.id, {
                ViewChannel: true
            });
            return interaction.reply({ content: 'Voice channel has been unhidden.', ephemeral: true });
        } catch (err) {
            return interaction.reply({ content: 'Unknown Error Occurred', ephemeral: true });
        }
    }

    async function handleKickMenu(interaction, voiceChannel, membersArray) {
        if (membersArray.length === 0) {
            return interaction.reply({ content: 'There are no users in the voice channel.', ephemeral: true });
        }

        const kickRow = createUserSelectRow(
            'selectUserToKick',
            'Select a user to kick',
            membersArray
        );

        await interaction.reply({
            content: 'Select a user to kick from the voice channel:',
            components: [kickRow],
            ephemeral: true
        });
    }

    async function handleMuteMenu(interaction, voiceChannel, membersArray) {
        const unmutedMembers = membersArray.filter(member => !member.voice.serverMute);
        if (unmutedMembers.length === 0) {
            return interaction.reply({ content: 'There are no users unmuted in voice channel', ephemeral: true });
        }

        const muteRow = createUserSelectRow(
            'selectUserToMute',
            'Select a user to Mute',
            membersArray,
            member => !member.voice.serverMute
        );

        await interaction.reply({
            content: 'Select a user to mute from the voice channel:',
            components: [muteRow],
            ephemeral: true
        });
    }

    async function handleUnmuteMenu(interaction, voiceChannel, membersArray) {
        const mutedMembers = membersArray.filter(member => member.voice.serverMute);
        if (mutedMembers.length === 0) {
            return interaction.reply({ content: 'There are no users muted in voice channel', ephemeral: true });
        }

        const unmuteRow = createUserSelectRow(
            'selectUserToUnmute',
            'Select a user to Unmute',
            membersArray,
            member => member.voice.serverMute
        );

        await interaction.reply({
            content: 'Select a user to unmute from the voice channel:',
            components: [unmuteRow],
            ephemeral: true
        });
    }

    async function handleDeafMenu(interaction, voiceChannel, membersArray) {
        const undeafenedMembers = membersArray.filter(member => !member.voice.serverDeaf);
        if (undeafenedMembers.length === 0) {
            return interaction.reply({ content: 'There are no users undeafened in voice channel', ephemeral: true });
        }

        const deafRow = createUserSelectRow(
            'selectUserToDeaf',
            'Select a user to deafen',
            membersArray,
            member => !member.voice.serverDeaf
        );

        await interaction.reply({
            content: 'Select a user to deafen from the voice channel:',
            components: [deafRow],
            ephemeral: true
        });
    }

    async function handleUndeafMenu(interaction, voiceChannel, membersArray) {
        const deafenedMembers = membersArray.filter(member => member.voice.serverDeaf);
        if (deafenedMembers.length === 0) {
            return interaction.reply({ content: 'There are no users deafened in voice channel', ephemeral: true });
        }

        const undeafRow = createUserSelectRow(
            'selectUserToUndeaf',
            'Select a user to undeafen',
            membersArray,
            member => member.voice.serverDeaf
        );

        await interaction.reply({
            content: 'Select a user to undeafen from the voice channel:',
            components: [undeafRow],
            ephemeral: true
        });
    }

    async function handleBanMenu(interaction, voiceChannel, membersArray) {
        if (membersArray.length === 0) {
            return interaction.reply({ content: 'There are no users in the voice channel.', ephemeral: true });
        }

        const banRow = createUserSelectRow(
            'selectUserToBan',
            'Select a user to ban',
            membersArray
        );

        await interaction.reply({
            content: 'Select a user to ban from the voice channel:',
            components: [banRow],
            ephemeral: true
        });
    }

    async function handleTransferMenu(interaction, voiceChannel, membersArray) {
        if (membersArray.length === 0) {
            return interaction.reply({ content: 'There are no users in the voice channel.', ephemeral: true });
        }

        const transferRow = createUserSelectRow(
            'selectUserToTransferOwnership',
            'Select a user to transfer ownership',
            membersArray
        );

        await interaction.reply({
            content: 'Select a user to transfer ownership of the voice channel:',
            components: [transferRow],
            ephemeral: true
        });
    }

    async function handleTransferOwnership(interaction, voiceChannel, guildConfig) {
        const newOwnerId = interaction.values[0];
        const newOwner = voiceChannel.members.get(newOwnerId);

        if (newOwnerId === interaction.user.id) {
            return interaction.reply({
                content: `You cannot transfer ownership to yourself, you already own it.`,
                ephemeral: true
            });
        }

        if (newOwner) {
            await GuildConfig.updateOne(
                { guildId: interaction.guild.id, 'tempVoiceChannels.channelId': voiceChannel.id },
                { $set: { 'tempVoiceChannels.$.ownerId': newOwner.id } }
            );
            await voiceChannel.setName(`${newOwner.user.displayName}'s Vc`).catch(() => null);
            return interaction.reply({
                content: `Ownership has been transferred to ${newOwner.user.tag}.`,
                ephemeral: true
            });
        } else {
            return interaction.reply({ content: 'User is not in the voice channel.', ephemeral: true });
        }
    }

    async function handleKickUsers(interaction, voiceChannel) {
        await interaction.deferReply({ ephemeral: true });
        const userIds = interaction.values;
        let success = 0;

        for (const userId of userIds) {
            const memberToKick = voiceChannel.members.get(userId);
            if (memberToKick) {
                await memberToKick.voice.disconnect().catch(() => null);
                success++;
            }
        }

        return interaction.editReply({
            content: `\`${success}\` Users have been kicked from the voice channel.`
        });
    }

    async function handleBanUsers(interaction, voiceChannel) {
        await interaction.deferReply({ ephemeral: true });
        const userIds = interaction.values;
        let success = 0;

        for (const userId of userIds) {
            const memberToBan = voiceChannel.members.get(userId);
            if (memberToBan) {
                await memberToBan.voice.disconnect().catch(() => null);
                await voiceChannel.permissionOverwrites.edit(memberToBan.id, {
                    Connect: false,
                    ViewChannel: false
                }).catch(() => null);
                success++;
            }
        }

        return interaction.editReply({
            content: `\`${success}\` Users have been banned from the voice channel.`
        });
    }

    async function handleMuteUsers(interaction, voiceChannel) {
        await interaction.deferReply({ ephemeral: true });
        const userIds = interaction.values;
        let success = 0;

        for (const userId of userIds) {
            const memberToMute = voiceChannel.members.get(userId);
            if (memberToMute) {
                await memberToMute.voice.setMute(true).catch(() => null);
                success++;
            }
        }

        return interaction.editReply({
            content: `\`${success}\` Users have been muted in the voice channel.`
        });
    }

    async function handleUnmuteUsers(interaction, voiceChannel) {
        await interaction.deferReply({ ephemeral: true });
        const userIds = interaction.values;
        let success = 0;

        for (const userId of userIds) {
            const memberToUnmute = voiceChannel.members.get(userId);
            if (memberToUnmute) {
                await memberToUnmute.voice.setMute(false).catch(() => null);
                success++;
            }
        }

        return interaction.editReply({
            content: `\`${success}\` Users have been unmuted in the voice channel.`
        });
    }

    async function handleDeafUsers(interaction, voiceChannel) {
        await interaction.deferReply({ ephemeral: true });
        const userIds = interaction.values;
        let success = 0;

        for (const userId of userIds) {
            const memberToDeaf = voiceChannel.members.get(userId);
            if (memberToDeaf) {
                await memberToDeaf.voice.setDeaf(true).catch(() => null);
                success++;
            }
        }

        return interaction.editReply({
            content: `\`${success}\` Users have been deafened in the voice channel.`
        });
    }

    async function handleUndeafUsers(interaction, voiceChannel) {
        await interaction.deferReply({ ephemeral: true });
        const userIds = interaction.values;
        let success = 0;

        for (const userId of userIds) {
            const memberToUndeaf = voiceChannel.members.get(userId);
            if (memberToUndeaf) {
                await memberToUndeaf.voice.setDeaf(false).catch(() => null);
                success++;
            }
        }

        return interaction.editReply({
            content: `\`${success}\` Users have been undeafened in the voice channel.`
        });
    }

    async function handleBitrateModal(interaction, voiceChannel, maxBitrate) {
        const bitrateKbps = parseInt(interaction.fields.getTextInputValue('bitrateInput'));

        if (isNaN(bitrateKbps) || bitrateKbps < 8 || bitrateKbps * 1000 > maxBitrate) {
            return interaction.reply({
                content: `Invalid bitrate value. Please enter a number between 8 and ${maxBitrate / 1000} kbps.`,
                ephemeral: true
            });
        }

        await voiceChannel.setBitrate(bitrateKbps * 1000);
        return interaction.reply({
            content: `Voice channel bitrate has been changed to ${bitrateKbps} kbps.`,
            ephemeral: true
        });
    }

    async function handleChannelNameModal(interaction, voiceChannel) {
        const channelName = interaction.fields.getTextInputValue('channelnameInput');

        if (channelName.length < 1 || channelName.length > 24) {
            return interaction.reply({
                content: `Channel Name must be between 1 and 24 characters.`,
                ephemeral: true
            });
        }

        await voiceChannel.setName(channelName);
        return interaction.reply({
            content: `Successfully changed voice channel name to ${channelName}.`,
            ephemeral: true
        });
    }

    async function handleUserLimitModal(interaction, voiceChannel) {
        const userLimit = parseInt(interaction.fields.getTextInputValue('userlimitInput'));

        if (isNaN(userLimit) || userLimit < 0 || userLimit > 99) {
            return interaction.reply({
                content: `Invalid user limit value. Please enter a number between 0 and 99.`,
                ephemeral: true
            });
        }

        await voiceChannel.setUserLimit(userLimit);
        return interaction.reply({
            content: `Voice channel user limit has been changed to ${userLimit}.`,
            ephemeral: true
        });
    }
};
