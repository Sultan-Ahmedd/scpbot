const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');

// In-memory state for nuking
let nukingEnabled = true;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nuking')
        .setDescription('Enable or disable the nuke functionality')
        .addSubcommand(subcommand => 
            subcommand.setName('enable')
                .setDescription('Enable nuking on the server'))
        .addSubcommand(subcommand => 
            subcommand.setName('disable')
                .setDescription('Disable nuking on the server')),

    async execute(interaction) {
        // Check if the user is the server owner
        if (interaction.user.id !== interaction.guild.ownerId) {
            const errorEmbed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle('Permission Denied')
                .setDescription('Only the server owner can enable or disable nuking.');
            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        if (interaction.options.getSubcommand() === 'enable') {
            nukingEnabled = true;
            const successEmbed = new EmbedBuilder()
                .setColor(0x00ff00)
                .setTitle('Nuking Enabled')
                .setDescription('Nuking has been enabled on this server.');
            return interaction.reply({ embeds: [successEmbed], ephemeral: true });
        } else if (interaction.options.getSubcommand() === 'disable') {
            nukingEnabled = false;
            const successEmbed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle('Nuking Disabled')
                .setDescription('Nuking has been disabled on this server.');
            return interaction.reply({ embeds: [successEmbed], ephemeral: true });
        }
    }
};
