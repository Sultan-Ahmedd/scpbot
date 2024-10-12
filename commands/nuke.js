const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nuke')
        .setDescription('Nuke command with four options for deleting channels'),

    async execute(interaction) {
        // Check if the user has "Administrator" permission
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({ content: 'You do not have permission to use this command. Only users with "Administrator" permission can execute this command.', ephemeral: true });
        }

        // Create the buttons for selecting options
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('delete_single')
                    .setLabel('Delete Single Channel')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('delete_multiple')
                    .setLabel('Delete Multiple Channels')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('delete_except')
                    .setLabel('Delete All Except Specific Channels')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('delete_all')
                    .setLabel('Delete All Channels (Critical)')
                    .setStyle(ButtonStyle.Danger)
            );

        // Send the buttons to the user
        await interaction.reply({
            content: 'Select an option for channel deletion:',
            components: [buttons],
            ephemeral: true // Only visible to the user
        });

        // Handle button interactions
        const filter = i => i.user.id === interaction.user.id;
        const collector = interaction.channel.createMessageComponentCollector({ filter, time: 15000 });

        collector.on('collect', async (i) => {
            if (i.customId === 'delete_single') {
                // Show modal for single channel deletion
                await showModalForChannelId(i, 'singleChannelModal', 'Enter the Channel ID to delete');
            } else if (i.customId === 'delete_multiple') {
                // Show modal for multiple channel deletion
                await showModalForChannelId(i, 'multipleChannelsModal', 'Enter the Channel IDs (comma-separated)');
            } else if (i.customId === 'delete_except') {
                // Show modal for keeping specific channels
                await showModalForChannelId(i, 'exceptChannelsModal', 'Enter the Channel IDs to keep (comma-separated)');
            } else if (i.customId === 'delete_all') {
                // Ask for confirmation
                await i.reply({ content: 'WARNING: You are about to delete all channels. Type `CONFIRM` in the input field to proceed.', ephemeral: true });
                const modal = new ModalBuilder()
                    .setCustomId('confirmDeleteAll')
                    .setTitle('Confirm Deletion')
                    .addComponents(
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('confirmInput')
                                .setLabel('Type CONFIRM to proceed')
                                .setStyle(TextInputStyle.Short)
                        )
                    );
                await i.showModal(modal);
            }
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time') {
                interaction.followUp({ content: 'You took too long to respond. Nuke command cancelled.', ephemeral: true });
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
                    await modalInteraction.reply({ content: 'Nuke command cancelled. You did not type `CONFIRM`.', ephemeral: true });
                }
            }
        });
    },
};

// Show modal for channel input
async function showModalForChannelId(interaction, modalId, labelText) {
    const modal = new ModalBuilder()
        .setCustomId(modalId)
        .setTitle('Channel Deletion')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('channelInput')
                    .setLabel(labelText)
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
            await interaction.reply({ content: 'I do not have permission to delete this channel or something went wrong.', ephemeral: true });
            console.error(error);
        }
    } else {
        await interaction.reply({ content: 'Invalid Channel ID. Please make sure the channel exists.', ephemeral: true });
    }
}

// Handle multiple channel deletion
async function handleMultipleChannelDeletion(interaction, channelIds) {
    for (const channelId of channelIds) {
        const channel = interaction.guild.channels.cache.get(channelId);
        if (channel) {
            try {
                await channel.delete();
                await interaction.followUp({ content: `Channel <#${channelId}> has been nuked!`, ephemeral: true });
            } catch (error) {
                await interaction.followUp({ content: `Failed to delete channel <#${channelId}>.`, ephemeral: true });
                console.error(error);
            }
        } else {
            await interaction.followUp({ content: `Invalid Channel ID: ${channelId}.`, ephemeral: true });
        }
    }
}

// Handle deleting all channels except the provided ones
async function handleAllExceptChannelsDeletion(interaction, keepChannelIds) {
    const channelsToDelete = interaction.guild.channels.cache.filter(channel => !keepChannelIds.includes(channel.id));
    for (const [channelId, channel] of channelsToDelete) {
        try {
            await channel.delete();
            await interaction.followUp({ content: `Channel <#${channelId}> has been nuked!`, ephemeral: true });
        } catch (error) {
            await interaction.followUp({ content: `Failed to delete channel <#${channelId}>.`, ephemeral: true });
            console.error(error);
        }
    }
}

// Handle deleting all channels
async function handleDeleteAllChannels(interaction) {
    const channels = interaction.guild.channels.cache;
    for (const [channelId, channel] of channels) {
        try {
            await channel.delete();
            await interaction.followUp({ content: `Channel <#${channelId}> has been nuked!`, ephemeral: true });
        } catch (error) {
            await interaction.followUp({ content: `Failed to delete channel <#${channelId}>.`, ephemeral: true });
            console.error(error);
        }
    }
}
