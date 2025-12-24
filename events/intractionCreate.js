const { Events } = require('discord.js');
const { InteractionHandler } = require('../structures/v2Components');

module.exports = async (client) => {
    const interactionHandler = new InteractionHandler(client);

    client.on(Events.InteractionCreate, async (interaction) => {
        try {
            if (interaction.isStringSelectMenu()) {
                await handleSelectMenu(client, interaction);
            } else if (interaction.isButton()) {
                await handleButton(client, interaction, interactionHandler);
            } else if (interaction.isModalSubmit()) {
                await handleModalSubmit(client, interaction, interactionHandler);
            } else if (interaction.isChatInputCommand()) {
                await handleChatInputCommand(client, interaction);
            } else if (interaction.isContextMenuCommand()) {
                await handleContextMenuCommand(client, interaction);
            }
        } catch (error) {
            console.error('Interaction handling error:', error);
            await sendErrorResponse(interaction);
        }
    });
};

async function handleSelectMenu(client, interaction) {
    await client.util.selectMenuHandle(interaction);
}

async function handleButton(client, interaction, interactionHandler) {
    const handler = interactionHandler.getHandler(interaction.customId);
    if (handler) {
        await handler(interaction);
    }
}

async function handleModalSubmit(client, interaction, interactionHandler) {
    const handler = interactionHandler.getHandler(interaction.customId);
    if (handler) {
        await handler(interaction);
    }
}

async function handleChatInputCommand(client, interaction) {
    await interaction.deferReply({ ephemeral: true }).catch(() => {});

    const cmd = client?.slashCommands?.get(interaction.commandName);
    if (!cmd) {
        return interaction.followUp({
            content: 'This command has been removed from our system.'
        });
    }

    const args = parseCommandArguments(interaction);
    interaction.member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);

    if (interaction.member) {
        await cmd.run(client, interaction, args);
    } else {
        return interaction.followUp({
            content: 'Unable to fetch member information. Please try again.'
        });
    }
}

async function handleContextMenuCommand(client, interaction) {
    await interaction.deferReply({ ephemeral: false }).catch(() => {});

    const command = client.slashCommands.get(interaction.commandName);
    if (command) {
        await command.run(client, interaction);
    }
}

function parseCommandArguments(interaction) {
    const args = [];

    for (const option of interaction.options.data) {
        if (option.type === 1) { // SUB_COMMAND
            if (option.name) args.push(option.name);
            option.options?.forEach((x) => {
                if (x.value) args.push(x.value);
            });
        } else if (option.value) {
            args.push(option.value);
        }
    }

    return args;
}

async function sendErrorResponse(interaction) {
    const errorMessage = 'An error occurred while processing your request. Please try again.';

    try {
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: errorMessage,
                ephemeral: true
            });
        } else if (interaction.deferred) {
            await interaction.followUp({
                content: errorMessage,
                ephemeral: true
            });
        }
    } catch (e) {
        // Silently fail if we can't respond
    }
}
