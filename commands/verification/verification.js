const {
    V2ComponentBuilder,
    EmbedBuilder,
    PermissionFlagsBits
} = require('../../structures/v2Components');
const { PermissionsBitField } = require('discord.js');

module.exports = {
    name: 'verification',
    category: 'verification',
    premium: true,
    subcommand: ['setup', 'view', 'reset'],
    run: async (client, message, args) => {
        const v2 = new V2ComponentBuilder(client);

        const createEmbed = (options) => {
            const embed = new EmbedBuilder()
                .setColor(options.color || client.color)
                .setTimestamp();

            if (options.title) embed.setTitle(options.title);
            if (options.description) embed.setDescription(options.description);
            if (options.image) embed.setImage(options.image);
            if (options.footer) embed.setFooter(options.footer);

            return embed;
        };

        const sendError = (description) => {
            return message.channel.send({
                embeds: [
                    createEmbed({
                        description: `${client.emoji.cross} | ${description}`
                    })
                ]
            });
        };

        const sendSuccess = (title, description) => {
            return message.channel.send({
                embeds: [
                    createEmbed({
                        title,
                        description
                    })
                ]
            });
        };

        if (!message.member.permissions.has('Administrator')) {
            return sendError(`You must have \`Administrator\` permissions to use this command.`);
        }

        if (!message.guild.members.me.permissions.has('Administrator')) {
            return sendError(`I don't have \`Administrator\` permissions to execute this command.`);
        }

        if (!client.util.hasHigher(message.member)) {
            return sendError(`You must have a higher role than me to use this command.`);
        }

        try {
            let data = await client.db.get(`verification_${message.guild.id}`) || { channelId: null, verifiedrole: null };

            if (!args[0]) {
                return message.channel.send({
                    embeds: [
                        createEmbed({
                            color: 0xff0000,
                            title: 'Verification Setup Error',
                            description: 'Please provide a valid option for setting up the verification system.\nValid Options Are: `setup`, `reset`, `view`'
                        })
                    ]
                });
            }

            const option = args[0]?.toLowerCase();

            if (option === 'setup') {
                await handleSetup(client, message, data, v2, createEmbed, sendSuccess);
            } else if (option === 'reset') {
                await handleReset(client, message, data, createEmbed);
            } else if (option === 'view') {
                await handleView(message, data, createEmbed);
            } else {
                return message.channel.send({
                    embeds: [
                        createEmbed({
                            color: 0xff0000,
                            title: 'Invalid Option',
                            description: 'Please provide a valid option: `setup`, `reset`, or `view`'
                        })
                    ]
                });
            }

        } catch (e) {
            console.error('Verification command error:', e);
            return message.channel.send({
                embeds: [
                    createEmbed({
                        title: 'Error Occurred',
                        description: 'An error occurred while processing the verification system command.'
                    })
                ]
            });
        }
    }
};

async function handleSetup(client, message, data, v2, createEmbed, sendSuccess) {
    if (data.channelId || data.verifiedrole) {
        return message.channel.send({
            embeds: [
                createEmbed({
                    color: 0xffcc00,
                    title: 'Verification Setup',
                    description: 'The verification system is already set up. Use the `reset` command to clear the existing setup first.'
                })
            ]
        });
    }

    let verifiedRole = message.guild.roles.cache.find(role => role.name === 'Verified');
    if (!verifiedRole) {
        verifiedRole = await message.guild.roles.create({
            name: 'Verified',
            permissions: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
        });
    }

    let verificationChannel = await message.guild.channels.create({
        name: 'verification',
        type: 0,
        permissionOverwrites: [
            {
                id: message.guild.id,
                allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
            },
            {
                id: verifiedRole.id,
                deny: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
            }
        ]
    });

    data.channelId = verificationChannel.id;
    data.verifiedrole = verifiedRole.id;
    await client.db.set(`verification_${message.guild.id}`, data);

    const row = v2.createActionRow(
        v2.createPrimaryButton('start_verification', 'Start Verification')
    );

    const setupEmbed = createEmbed({
        title: 'Verification Setup',
        description: 'Click the button below to start the verification process.',
        image: client.config.verifybanner
    });

    await verificationChannel.send({ embeds: [setupEmbed], components: [row] });
    await sendSuccess('Setup Complete', 'Verification channel and role have been set up successfully.');
}

async function handleReset(client, message, data, createEmbed) {
    if (!data || (!data.channelId && !data.verifiedrole)) {
        return message.channel.send({
            embeds: [
                createEmbed({
                    color: 0xffcc00,
                    title: 'Verification Not Set Up',
                    description: 'The verification system has not been set up yet.'
                })
            ]
        });
    }

    if (data.channelId) {
        const oldChannel = message.guild.channels.cache.get(data.channelId);
        if (oldChannel) {
            await oldChannel.delete().catch(() => null);
        }
    }

    await client.db.delete(`verification_${message.guild.id}`);

    return message.channel.send({
        embeds: [
            createEmbed({
                title: 'Verification Reset',
                description: 'The verification configuration has been successfully reset.'
            })
        ]
    });
}

async function handleView(message, data, createEmbed) {
    if (!data.channelId || !data.verifiedrole) {
        return message.channel.send({
            embeds: [
                createEmbed({
                    color: 0xffcc00,
                    title: 'Verification Not Set Up',
                    description: 'The verification system has not been set up yet.'
                })
            ]
        });
    }

    return message.channel.send({
        embeds: [
            createEmbed({
                title: 'Verification System Details',
                description: `Verification Channel: <#${data.channelId}>\nVerified Role: <@&${data.verifiedrole}>`
            })
        ]
    });
}
