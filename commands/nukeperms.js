const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');

// In-memory storage for allowed roles (can be replaced with persistent storage)
let allowedRoles = [];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nukeperms')
        .setDescription('Manage roles allowed to use the nuke command')
        .addSubcommand(subcommand => 
            subcommand.setName('add')
                .setDescription('Add a role to be allowed to use the nuke command')
                .addStringOption(option => option.setName('role').setDescription('Role ID to add').setRequired(true)))
        .addSubcommand(subcommand => 
            subcommand.setName('remove')
                .setDescription('Remove a role from being allowed to use the nuke command')
                .addStringOption(option => option.setName('role').setDescription('Role ID to remove').setRequired(true))),

    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            const errorEmbed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle('Permission Denied')
                .setDescription('Only Administrators can use this command.');
            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        const roleId = interaction.options.getString('role');
        if (interaction.options.getSubcommand() === 'add') {
            if (allowedRoles.includes(roleId)) {
                const errorEmbed = new EmbedBuilder()
                    .setColor(0xff0000)
                    .setTitle('Role Already Added')
                    .setDescription(`Role <@&${roleId}> is already allowed to use the nuke command.`);
                return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
            allowedRoles.push(roleId);
            const successEmbed = new EmbedBuilder()
                .setColor(0x00ff00)
                .setTitle('Role Added')
                .setDescription(`Role <@&${roleId}> has been added to the list of roles that can use the nuke command.`);
            return interaction.reply({ embeds: [successEmbed], ephemeral: true });
        } else if (interaction.options.getSubcommand() === 'remove') {
            const index = allowedRoles.indexOf(roleId);
            if (index === -1) {
                const errorEmbed = new EmbedBuilder()
                    .setColor(0xff0000)
                    .setTitle('Role Not Found')
                    .setDescription(`Role <@&${roleId}> is not in the list of roles that can use the nuke command.`);
                return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
            allowedRoles.splice(index, 1);
            const successEmbed = new EmbedBuilder()
                .setColor(0x00ff00)
                .setTitle('Role Removed')
                .setDescription(`Role <@&${roleId}> has been removed from the list of roles that can use the nuke command.`);
            return interaction.reply({ embeds: [successEmbed], ephemeral: true });
        }
    }
};
