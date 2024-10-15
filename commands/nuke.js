const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder } = require('discord.js');
const { loadNukeState } = require('../utils/stateManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nuke')
        .setDescription('Nuke command with four options for deleting channels'),

    async execute(interaction) {
        // Load the current nuking state
        let nukeState = loadNukeState();

        // Check if nuking is enabled
        if (!nukeState.nukingEnabled) {
            const errorEmbed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle('Nuking Disabled')
                .setDescription('Nuking is currently disabled on this server.');
            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        // Check if user has an allowed role or is an admin
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            const errorEmbed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle('Permission Denied')
                .setDescription('You do not have permission to use the nuke command.');
            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        // Create the embed message and buttons (the rest of the code remains unchanged)
        const embed = new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle('Nuke Command')
            .setDescription('Select an option to begin deleting channels.')
            .addFields(
                { name: 'Option 1', value: 'Delete a specific channel (Channel ID)', inline: true },
                { name: 'Option 2', value: 'Delete multiple channels (Channel IDs separated by commas)', inline: true },
                { name: 'Option 3', value: 'Delete all channels except specific ones', inline: true },
                { name: 'Option 4', value: 'Delete all channels (Critical!)', inline: true }
            )
            .setFooter({ text: 'Choose wisely, some options are irreversible.' });

        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder().setCustomId('delete_single').setLabel('Delete Single Channel').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('delete_multiple').setLabel('Delete Multiple Channels').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('delete_except').setLabel('Delete All Except Specific Channels').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('delete_all').setLabel('Delete All Channels (Critical)').setStyle(ButtonStyle.Danger)
            );

        await interaction.reply({ embeds: [embed], components: [buttons], ephemeral: true });

        // Handle button interactions
        const filter = i => i.user.id === interaction.user.id;
        const collector = interaction.channel.createMessageComponentCollector({ filter, time: 15000 });

        collector.on('collect', async i => {
            if (i.customId === 'delete_single') {
                await showModalForChannelId(i, 'singleChannelModal', 'Enter the Channel ID to delete');
            } else if (i.customId === 'delete_multiple') {
                await showModalForChannelId(i, 'multipleChannelsModal', 'Enter the Channel IDs (comma-separated)');
            } else if (i.customId === 'delete_except') {
                await showModalForChannelId(i, 'exceptChannelsModal', 'Enter the Channel IDs to keep (comma-separated)');
            } else if (i.customId === 'delete_all') {
                await i.reply({ content: 'WARNING: You are about to delete all channels. Type `CONFIRM` in the input field to proceed.', ephemeral: true });
                const modal = new ModalBuilder()
                    .setCustomId('confirmDeleteAll')
                    .setTitle('Confirm Deletion')
                    .addComponents(
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder().setCustomId('confirmInput').setLabel('Type CONFIRM to proceed').setStyle(TextInputStyle.Short)
                        )
                    );
                await i.showModal(modal);
            }
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time') {
                const errorEmbed = new EmbedBuilder()
                    .setColor(0xff0000)
                    .setTitle('Timeout')
                    .setDescription('You took too long to respond. Nuke command cancelled.');
                interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
            }
        });

        // Handle modal input
        interaction.client.on('interactionCreate', async modalInteraction => {
            if (!modalInteraction.isModalSubmit()) return;

            const modalId = modalInteraction.customId;
            if (modalId === 'singleChannelModal') {
                const channelId = modalInteraction.fields.getTextInputValue('channelInput');
                await handleSingleChannelDeletion(modalInteraction, channelId);
            } else if (modalId === 'multipleChannelsModal') {
                const channelIds = modalInteraction.fields.getTextInputValue('channelInput').split(',').map(id => id.trim());
                await handleMultipleChannelDeletion(modalInteraction, channelIds);
            } else if (modalId === 'exceptChannelsModal') {
                const keepChannelIds = modalInteraction.fields.getTextInputValue('channelInput').split(',').map(id => id.trim());
                await handleAllExceptChannelsDeletion(modalInteraction, keepChannelIds);
            } else if (modalId === 'confirmDeleteAll') {
                const confirmInput = modalInteraction.fields.getTextInputValue('confirmInput');
                if (confirmInput.toLowerCase() === 'confirm') {
                    await handleDeleteAllChannels(modalInteraction);
                } else {
                    const errorEmbed = new EmbedBuilder()
                        .setColor(0xff0000)
                        .setTitle('Nuke Cancelled')
                        .setDescription('You did not type `CONFIRM`. The nuke command has been cancelled.');
                    await modalInteraction.reply({ embeds: [errorEmbed], ephemeral: true });
                }
            }
        });
    }
};

// Function to create and show the modal
async function showModalForChannelId(interaction, modalId, label) {
    const modal = new ModalBuilder()
        .setCustomId(modalId)
        .setTitle('Nuke Command Input')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('channelInput')
                    .setLabel(label)
                    .setStyle(TextInputStyle.Short)
            )
        );

    await interaction.showModal(modal);
}

// Handle single channel deletion
async function handleSingleChannelDeletion(interaction, channelId) {
    const channel = interaction.guild.channels.cache.get(channelId);
    if (channel) {
        try {
            await channel.delete();
            await interaction.reply({ content: `Channel <#${channelId}> has been nuked!`, ephemeral: true });
        } catch (error) {
            const errorEmbed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle('Error')
                .setDescription('I do not have permission to delete this channel or something went wrong.');
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            console.error(error);
        }
    } else {
        const errorEmbed = new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle('Invalid Channel ID')
            .setDescription('The Channel ID you provided is invalid. Please make sure the channel exists.');
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
}

// Add similar handler functions for `handleMultipleChannelDeletion`, `handleAllExceptChannelsDeletion`, and `handleDeleteAllChannels`.