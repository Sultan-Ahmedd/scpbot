const { SlashCommandBuilder } = require('@discordjs/builders');
const { PermissionsBitField, EmbedBuilder, ChannelType } = require('discord.js');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setactionlogs')
        .setDescription('Set the channel for action logs')
        .addStringOption(option =>
            option.setName('channelid')
                .setDescription('The ID of the channel to log actions in')
                .setRequired(true)),
    async execute(interaction) {
        // Check if the user has administrator permissions
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setDescription('You do not have permission to set the action logs channel.');

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const channelId = interaction.options.getString('channelid');

        // Fetch the channel by ID
        const channel = await interaction.guild.channels.fetch(channelId).catch(err => {
            console.error('Error fetching channel:', err); // Log any fetching error
            return null;
        });

        // Validate that the channel exists and is a text channel
        if (!channel) {
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setDescription('Channel not found. Please ensure the ID is correct.');

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // Ensure the channel is a text channel
        if (channel.type !== ChannelType.GuildText) {
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setDescription('The provided ID does not belong to a text channel. Please provide a valid text channel ID.');

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // Save the channel ID in a JSON file
        const data = {
            actionLogsChannel: channelId
        };
        
        try {
            fs.writeFileSync('actionlogs.json', JSON.stringify(data, null, 2));
            console.log(`Action logs channel set to ${channelId} by ${interaction.user.tag}`);
        } catch (err) {
            console.error('Error writing to file:', err);
            const errorEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setDescription('There was an error saving the channel ID. Please try again later.');

            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        const successEmbed = new EmbedBuilder()
            .setColor('#00FF00')
            .setDescription(`Action logs channel has been set to <#${channelId}>!`);

        return interaction.reply({ embeds: [successEmbed], ephemeral: true });
    },
};
