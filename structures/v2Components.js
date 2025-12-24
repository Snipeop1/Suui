const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    UserSelectMenuBuilder,
    RoleSelectMenuBuilder,
    ChannelSelectMenuBuilder,
    MentionableSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    EmbedBuilder,
    AttachmentBuilder,
    ComponentType,
    ChannelType,
    PermissionFlagsBits,
    MessageFlags
} = require('discord.js');

class V2ComponentBuilder {
    constructor(client) {
        this.client = client;
    }

    createButton(options = {}) {
        const {
            customId,
            label,
            style = ButtonStyle.Primary,
            emoji,
            url,
            disabled = false
        } = options;

        const button = new ButtonBuilder();

        if (url) {
            button.setStyle(ButtonStyle.Link).setURL(url);
        } else {
            button.setCustomId(customId).setStyle(style);
        }

        if (label) button.setLabel(label);
        if (emoji) button.setEmoji(emoji);
        button.setDisabled(disabled);

        return button;
    }

    createPrimaryButton(customId, label, emoji = null, disabled = false) {
        return this.createButton({
            customId,
            label,
            style: ButtonStyle.Primary,
            emoji,
            disabled
        });
    }

    createSecondaryButton(customId, label, emoji = null, disabled = false) {
        return this.createButton({
            customId,
            label,
            style: ButtonStyle.Secondary,
            emoji,
            disabled
        });
    }

    createSuccessButton(customId, label, emoji = null, disabled = false) {
        return this.createButton({
            customId,
            label,
            style: ButtonStyle.Success,
            emoji,
            disabled
        });
    }

    createDangerButton(customId, label, emoji = null, disabled = false) {
        return this.createButton({
            customId,
            label,
            style: ButtonStyle.Danger,
            emoji,
            disabled
        });
    }

    createLinkButton(url, label, emoji = null) {
        return this.createButton({
            url,
            label,
            emoji
        });
    }

    createActionRow(...components) {
        return new ActionRowBuilder().addComponents(components);
    }

    createStringSelectMenu(options = {}) {
        const {
            customId,
            placeholder = 'Select an option',
            options: menuOptions = [],
            minValues = 1,
            maxValues = 1,
            disabled = false
        } = options;

        const menu = new StringSelectMenuBuilder()
            .setCustomId(customId)
            .setPlaceholder(placeholder)
            .setMinValues(minValues)
            .setMaxValues(maxValues)
            .setDisabled(disabled);

        if (menuOptions.length > 0) {
            menu.addOptions(menuOptions.slice(0, 25));
        }

        return menu;
    }

    createUserSelectMenu(options = {}) {
        const {
            customId,
            placeholder = 'Select a user',
            minValues = 1,
            maxValues = 1,
            disabled = false
        } = options;

        return new UserSelectMenuBuilder()
            .setCustomId(customId)
            .setPlaceholder(placeholder)
            .setMinValues(minValues)
            .setMaxValues(maxValues)
            .setDisabled(disabled);
    }

    createRoleSelectMenu(options = {}) {
        const {
            customId,
            placeholder = 'Select a role',
            minValues = 1,
            maxValues = 1,
            disabled = false
        } = options;

        return new RoleSelectMenuBuilder()
            .setCustomId(customId)
            .setPlaceholder(placeholder)
            .setMinValues(minValues)
            .setMaxValues(maxValues)
            .setDisabled(disabled);
    }

    createChannelSelectMenu(options = {}) {
        const {
            customId,
            placeholder = 'Select a channel',
            channelTypes = [],
            minValues = 1,
            maxValues = 1,
            disabled = false
        } = options;

        const menu = new ChannelSelectMenuBuilder()
            .setCustomId(customId)
            .setPlaceholder(placeholder)
            .setMinValues(minValues)
            .setMaxValues(maxValues)
            .setDisabled(disabled);

        if (channelTypes.length > 0) {
            menu.setChannelTypes(channelTypes);
        }

        return menu;
    }

    createMentionableSelectMenu(options = {}) {
        const {
            customId,
            placeholder = 'Select a user or role',
            minValues = 1,
            maxValues = 1,
            disabled = false
        } = options;

        return new MentionableSelectMenuBuilder()
            .setCustomId(customId)
            .setPlaceholder(placeholder)
            .setMinValues(minValues)
            .setMaxValues(maxValues)
            .setDisabled(disabled);
    }

    createModal(options = {}) {
        const {
            customId,
            title,
            components = []
        } = options;

        const modal = new ModalBuilder()
            .setCustomId(customId)
            .setTitle(title);

        if (components.length > 0) {
            modal.addComponents(components);
        }

        return modal;
    }

    createTextInput(options = {}) {
        const {
            customId,
            label,
            style = TextInputStyle.Short,
            placeholder,
            value,
            minLength,
            maxLength,
            required = true
        } = options;

        const input = new TextInputBuilder()
            .setCustomId(customId)
            .setLabel(label)
            .setStyle(style)
            .setRequired(required);

        if (placeholder) input.setPlaceholder(placeholder);
        if (value) input.setValue(value);
        if (minLength !== undefined) input.setMinLength(minLength);
        if (maxLength !== undefined) input.setMaxLength(maxLength);

        return input;
    }

    createShortTextInput(customId, label, options = {}) {
        return this.createTextInput({
            customId,
            label,
            style: TextInputStyle.Short,
            ...options
        });
    }

    createParagraphTextInput(customId, label, options = {}) {
        return this.createTextInput({
            customId,
            label,
            style: TextInputStyle.Paragraph,
            ...options
        });
    }

    createEmbed(options = {}) {
        const {
            title,
            description,
            color,
            author,
            thumbnail,
            image,
            footer,
            fields = [],
            timestamp = false
        } = options;

        const embed = new EmbedBuilder();

        if (color) embed.setColor(color);
        if (title) embed.setTitle(title);
        if (description) embed.setDescription(description);
        if (author) embed.setAuthor(author);
        if (thumbnail) embed.setThumbnail(thumbnail);
        if (image) embed.setImage(image);
        if (footer) embed.setFooter(footer);
        if (fields.length > 0) embed.addFields(fields);
        if (timestamp) embed.setTimestamp();

        return embed;
    }

    createSuccessEmbed(description, title = null) {
        const embed = new EmbedBuilder()
            .setColor(0x57F287)
            .setDescription(description);

        if (title) embed.setTitle(title);

        return embed;
    }

    createErrorEmbed(description, title = null) {
        const embed = new EmbedBuilder()
            .setColor(0xED4245)
            .setDescription(description);

        if (title) embed.setTitle(title);

        return embed;
    }

    createWarningEmbed(description, title = null) {
        const embed = new EmbedBuilder()
            .setColor(0xFEE75C)
            .setDescription(description);

        if (title) embed.setTitle(title);

        return embed;
    }

    createInfoEmbed(description, title = null) {
        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setDescription(description);

        if (title) embed.setTitle(title);

        return embed;
    }

    createPaginationButtons(options = {}) {
        const {
            currentPage = 0,
            totalPages = 1,
            prefix = 'page'
        } = options;

        const isFirstPage = currentPage === 0;
        const isLastPage = currentPage >= totalPages - 1;

        return this.createActionRow(
            this.createSecondaryButton(`${prefix}_first`, null, '⏮', isFirstPage),
            this.createSecondaryButton(`${prefix}_prev`, null, '◀', isFirstPage),
            this.createSecondaryButton(`${prefix}_stop`, null, '⏹', false),
            this.createSecondaryButton(`${prefix}_next`, null, '▶️', isLastPage),
            this.createSecondaryButton(`${prefix}_last`, null, '⏭', isLastPage)
        );
    }

    createConfirmationButtons(options = {}) {
        const {
            confirmId = 'confirm',
            cancelId = 'cancel',
            confirmLabel = 'Confirm',
            cancelLabel = 'Cancel',
            confirmEmoji = null,
            cancelEmoji = null
        } = options;

        return this.createActionRow(
            this.createSuccessButton(confirmId, confirmLabel, confirmEmoji),
            this.createDangerButton(cancelId, cancelLabel, cancelEmoji)
        );
    }

    createYesNoButtons(options = {}) {
        const {
            yesId = 'yes',
            noId = 'no',
            yesLabel = 'Yes',
            noLabel = 'No'
        } = options;

        return this.createActionRow(
            this.createSuccessButton(yesId, yesLabel, '✅'),
            this.createDangerButton(noId, noLabel, '❌')
        );
    }

    createTicketButtons(options = {}) {
        const {
            closeId = 'close',
            deleteId = 'delete',
            transcriptId = 'transcript',
            openId = 'open'
        } = options;

        return {
            closeRow: this.createActionRow(
                this.createSecondaryButton(closeId, 'Close', '🔒')
            ),
            manageRow: this.createActionRow(
                this.createSecondaryButton(deleteId, 'Delete', '💣'),
                this.createSecondaryButton(transcriptId, 'Generate Transcripts', '📃'),
                this.createSecondaryButton(openId, 'Open', '🔓')
            )
        };
    }

    createVoiceControlButtons() {
        return {
            row1: this.createActionRow(
                this.createSecondaryButton('lock', 'Lock', '🔒'),
                this.createSecondaryButton('unlock', 'Unlock', '🔓'),
                this.createSecondaryButton('hide', 'Hide', '👁️'),
                this.createSecondaryButton('unhide', 'Unhide', '👁️‍🗨️')
            ),
            row2: this.createActionRow(
                this.createSecondaryButton('vckick', 'Kick', '👢'),
                this.createSecondaryButton('vcmute', 'Mute', '🔇'),
                this.createSecondaryButton('vcunmute', 'Unmute', '🔊'),
                this.createSecondaryButton('vcdeaf', 'Deafen', '🔕'),
                this.createSecondaryButton('vcundeaf', 'Undeafen', '🔔')
            ),
            row3: this.createActionRow(
                this.createSecondaryButton('channelname', 'Rename', '✏️'),
                this.createSecondaryButton('userlimit', 'User Limit', '👥'),
                this.createSecondaryButton('changebitrate', 'Bitrate', '📶'),
                this.createSecondaryButton('changeregion', 'Region', '🌍'),
                this.createSecondaryButton('transferownership', 'Transfer', '👑')
            )
        };
    }

    createVerificationButton(options = {}) {
        const {
            customId = 'start_verification',
            label = 'Start Verification',
            emoji = '✅'
        } = options;

        return this.createActionRow(
            this.createSuccessButton(customId, label, emoji)
        );
    }

    createHelpSelectMenu(categories) {
        const options = categories.map(cat => ({
            label: cat.label,
            value: cat.value,
            description: cat.description,
            emoji: cat.emoji
        }));

        return this.createActionRow(
            this.createStringSelectMenu({
                customId: 'help_category',
                placeholder: 'Select a category',
                options
            })
        );
    }

    disableComponents(components) {
        return components.map(row => {
            const newRow = new ActionRowBuilder();
            row.components.forEach(component => {
                if (component.data.type === ComponentType.Button) {
                    const button = ButtonBuilder.from(component);
                    button.setDisabled(true);
                    newRow.addComponents(button);
                } else if (component.data.type === ComponentType.StringSelect) {
                    const select = StringSelectMenuBuilder.from(component);
                    select.setDisabled(true);
                    newRow.addComponents(select);
                } else if (component.data.type === ComponentType.UserSelect) {
                    const select = UserSelectMenuBuilder.from(component);
                    select.setDisabled(true);
                    newRow.addComponents(select);
                } else if (component.data.type === ComponentType.RoleSelect) {
                    const select = RoleSelectMenuBuilder.from(component);
                    select.setDisabled(true);
                    newRow.addComponents(select);
                } else if (component.data.type === ComponentType.ChannelSelect) {
                    const select = ChannelSelectMenuBuilder.from(component);
                    select.setDisabled(true);
                    newRow.addComponents(select);
                } else if (component.data.type === ComponentType.MentionableSelect) {
                    const select = MentionableSelectMenuBuilder.from(component);
                    select.setDisabled(true);
                    newRow.addComponents(select);
                }
            });
            return newRow;
        });
    }

    static isButton(interaction) {
        return interaction.isButton();
    }

    static isStringSelectMenu(interaction) {
        return interaction.isStringSelectMenu();
    }

    static isUserSelectMenu(interaction) {
        return interaction.isUserSelectMenu();
    }

    static isRoleSelectMenu(interaction) {
        return interaction.isRoleSelectMenu();
    }

    static isChannelSelectMenu(interaction) {
        return interaction.isChannelSelectMenu();
    }

    static isMentionableSelectMenu(interaction) {
        return interaction.isMentionableSelectMenu();
    }

    static isAnySelectMenu(interaction) {
        return interaction.isAnySelectMenu();
    }

    static isModalSubmit(interaction) {
        return interaction.isModalSubmit();
    }

    static isMessageComponent(interaction) {
        return interaction.isMessageComponent();
    }
}

class InteractionHandler {
    constructor(client) {
        this.client = client;
        this.buttonHandlers = new Map();
        this.selectMenuHandlers = new Map();
        this.modalHandlers = new Map();
        this.cooldowns = new Map();
    }

    registerButtonHandler(customId, handler, options = {}) {
        this.buttonHandlers.set(customId, { handler, options });
    }

    registerSelectMenuHandler(customId, handler, options = {}) {
        this.selectMenuHandlers.set(customId, { handler, options });
    }

    registerModalHandler(customId, handler, options = {}) {
        this.modalHandlers.set(customId, { handler, options });
    }

    checkCooldown(userId, commandId, cooldownSeconds = 3) {
        const key = `${userId}-${commandId}`;
        const now = Date.now();
        const cooldownEnd = this.cooldowns.get(key);

        if (cooldownEnd && now < cooldownEnd) {
            return Math.ceil((cooldownEnd - now) / 1000);
        }

        this.cooldowns.set(key, now + (cooldownSeconds * 1000));
        return 0;
    }

    async handleInteraction(interaction) {
        try {
            if (interaction.isButton()) {
                return await this.handleButton(interaction);
            } else if (interaction.isAnySelectMenu()) {
                return await this.handleSelectMenu(interaction);
            } else if (interaction.isModalSubmit()) {
                return await this.handleModal(interaction);
            }
        } catch (error) {
            console.error('Error handling interaction:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: 'An error occurred while processing your request.',
                    ephemeral: true
                }).catch(() => {});
            }
        }
    }

    async handleButton(interaction) {
        const handlerInfo = this.buttonHandlers.get(interaction.customId);
        if (!handlerInfo) return false;

        const { handler, options } = handlerInfo;

        if (options.cooldown) {
            const remaining = this.checkCooldown(
                interaction.user.id,
                interaction.customId,
                options.cooldown
            );
            if (remaining > 0) {
                return interaction.reply({
                    content: `Please wait ${remaining} seconds before using this button again.`,
                    ephemeral: true
                });
            }
        }

        return handler(interaction, this.client);
    }

    async handleSelectMenu(interaction) {
        const handlerInfo = this.selectMenuHandlers.get(interaction.customId);
        if (!handlerInfo) return false;

        const { handler, options } = handlerInfo;

        if (options.cooldown) {
            const remaining = this.checkCooldown(
                interaction.user.id,
                interaction.customId,
                options.cooldown
            );
            if (remaining > 0) {
                return interaction.reply({
                    content: `Please wait ${remaining} seconds before using this menu again.`,
                    ephemeral: true
                });
            }
        }

        return handler(interaction, this.client);
    }

    async handleModal(interaction) {
        const handlerInfo = this.modalHandlers.get(interaction.customId);
        if (!handlerInfo) return false;

        const { handler, options } = handlerInfo;
        return handler(interaction, this.client);
    }
}

class CooldownManager {
    constructor() {
        this.cooldowns = new Map();
    }

    set(key, duration) {
        const now = Date.now();
        this.cooldowns.set(key, now + duration);
    }

    check(key) {
        const now = Date.now();
        const expiration = this.cooldowns.get(key);

        if (!expiration) return { onCooldown: false, remaining: 0 };

        if (now < expiration) {
            return {
                onCooldown: true,
                remaining: Math.ceil((expiration - now) / 1000)
            };
        }

        this.cooldowns.delete(key);
        return { onCooldown: false, remaining: 0 };
    }

    clear(key) {
        this.cooldowns.delete(key);
    }

    clearAll() {
        this.cooldowns.clear();
    }
}

module.exports = {
    V2ComponentBuilder,
    InteractionHandler,
    CooldownManager,
    ButtonStyle,
    TextInputStyle,
    ComponentType,
    ChannelType,
    PermissionFlagsBits,
    MessageFlags,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    StringSelectMenuBuilder,
    UserSelectMenuBuilder,
    RoleSelectMenuBuilder,
    ChannelSelectMenuBuilder,
    MentionableSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    AttachmentBuilder
};
