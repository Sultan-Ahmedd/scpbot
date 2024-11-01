const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');

// In-memory storage for roles allowed to use the backup commands
let allowedRoles = [];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('serverbackup')
    .setDescription('Displays a list of available server backups.')
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('Lists all available backups')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('initbackup')
        .setDescription('Restore a server backup')
        .addStringOption(option =>
          option.setName('filename').setDescription('The name of the backup file').setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('backup')
        .setDescription('Create a backup of the current server state')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('backupperm')
        .setDescription('Grant a role permission to use backup commands')
        .addStringOption(option =>
          option.setName('roleid').setDescription('The ID of the role to grant permissions').setRequired(true)
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const backupsPath = path.join(__dirname, '../discord-backups');

    // Check if the user has administrator permissions or has a role that has been granted backup permissions
    if (
      !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator) &&
      !interaction.member.roles.cache.some(role => allowedRoles.includes(role.id))
    ) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('Permission Denied')
            .setColor(0xFF0000) // Red color
            .setDescription('You do not have permission to use this command.')
        ],
        ephemeral: true
      });
      return;
    }

    if (subcommand === 'list') {
      try {
        const backupFiles = fs.readdirSync(backupsPath).filter(file => file.endsWith('.json'));

        if (backupFiles.length === 0) {
          await interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setTitle('No Backups Available')
                .setColor(0xFF0000) // Red color
                .setDescription('There are no available backup files.')
            ],
            ephemeral: true
          });
        } else {
          const embed = new EmbedBuilder()
            .setTitle('Available Backups')
            .setColor(0x0000FF); // Blue color

          backupFiles.forEach(file => {
            const timestamp = parseInt(file.split('_')[2].split('.')[0]);
            if (!isNaN(timestamp)) {
              const backupDate = new Date(timestamp);
              const formattedDate = `${String(backupDate.getDate()).padStart(2, '0')}/${String(backupDate.getMonth() + 1).padStart(2, '0')}/${backupDate.getFullYear()}`;
              embed.addFields({ name: file, value: `Created on: ${formattedDate}`, inline: false });
            }
          });

          await interaction.reply({ embeds: [embed] });
        }
      } catch (error) {
        console.error('Error reading backup files:', error);
        await interaction.reply('An error occurred while reading the backup files.');
      }
    } else if (subcommand === 'initbackup') {
      await interaction.deferReply({ ephemeral: true });

      const fileName = interaction.options.getString('filename');
      const filePath = path.join(backupsPath, fileName);

      if (!fs.existsSync(filePath)) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle('Backup Not Found')
              .setColor(0xFF0000) // Red color
              .setDescription(`Backup file **${fileName}** does not exist. Please choose a valid backup.`)
          ]
        });
        return;
      }

      try {
        const backupData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        const guild = interaction.guild;

        // Restore roles
        for (const roleData of backupData.roles) {
          // Check if the role already exists
          if (guild.roles.cache.some(role => role.name === roleData.name)) {
            console.log(`Role ${roleData.name} already exists. Skipping creation.`);
            continue;
          }

          try {
            await guild.roles.create({
              name: roleData.name,
              permissions: BigInt(roleData.permissions),
              color: roleData.color,
            });
            console.log(`Role ${roleData.name} created successfully.`);
          } catch (error) {
            console.error(`Error creating role: ${roleData.name}`, error);
          }
        }

        // Restore channels and categories
        for (const channelData of backupData.channels) {
          // Check if the channel already exists
          let existingChannel = guild.channels.cache.find(channel => channel.name === channelData.name);
          if (existingChannel) {
            console.log(`Channel ${channelData.name} already exists. Skipping creation.`);
            continue;
          }

          let channel;
          try {
            if (channelData.type === 4) { // 4 corresponds to GUILD_CATEGORY in Discord API
              channel = await guild.channels.create({
                name: channelData.name,
                type: 4, // GUILD_CATEGORY
                position: channelData.position
              });
              console.log(`Category channel ${channelData.name} created successfully.`);
            } else if (channelData.type === 0) { // 0 corresponds to GUILD_TEXT in Discord API
              channel = await guild.channels.create({
                name: channelData.name,
                type: 0, // GUILD_TEXT
                position: channelData.position,
                parent: channelData.parent ? guild.channels.cache.find(c => c.name === channelData.parent && c.type === 4)?.id : null
              });
              console.log(`Text channel ${channelData.name} created successfully.`);
            } else if (channelData.type === 2) { // 2 corresponds to GUILD_VOICE in Discord API
              channel = await guild.channels.create({
                name: channelData.name,
                type: 2, // GUILD_VOICE
                position: channelData.position,
                parent: channelData.parent ? guild.channels.cache.find(c => c.name === channelData.parent && c.type === 4)?.id : null
              });
              console.log(`Voice channel ${channelData.name} created successfully.`);
            }

            // Set channel permissions
            const permissionOverwrites = [];
            for (const [targetId, perms] of Object.entries(channelData.permissions)) {
              const target = guild.roles.cache.get(targetId) || guild.members.cache.get(targetId);
              if (target) {
                permissionOverwrites.push({
                  id: target.id,
                  allow: BigInt(perms.allow),
                  deny: BigInt(perms.deny)
                });
              }
            }
            if (channel) {
              await channel.permissionOverwrites.set(permissionOverwrites);
              console.log(`Permissions set for channel ${channelData.name}.`);
            }
          } catch (error) {
            console.error(`Error creating channel: ${channelData.name}`, error);
          }
        }

        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle('Server Backup Restored')
              .setColor(0x00FF00) // Green color
              .setDescription(`The server has been successfully restored from **${fileName}**.`)
          ]
        });
      } catch (error) {
        console.error('Error restoring backup:', error);
        await interaction.editReply('An error occurred while restoring the backup.');
      }
    } else if (subcommand === 'backup') {
      await interaction.deferReply({ ephemeral: true });

      try {
        const guild = interaction.guild;
        const backupData = {
          roles: [],
          channels: []
        };

        // Backup roles
        guild.roles.cache.filter(role => !role.managed).forEach(role => {
          backupData.roles.push({
            name: role.name,
            permissions: role.permissions.bitfield.toString(),
            color: role.color,
            position: role.position
          });
        });

        // Backup channels
        guild.channels.cache.forEach(channel => {
          const channelData = {
            name: channel.name,
            type: channel.type,
            position: channel.position,
            parent: channel.parent ? channel.parent.name : null,
            permissions: {}
          };

          channel.permissionOverwrites.cache.forEach(overwrite => {
            channelData.permissions[overwrite.id] = {
              allow: overwrite.allow.bitfield.toString(),
              deny: overwrite.deny.bitfield.toString()
            };
          });

          backupData.channels.push(channelData);
        });

        // Save backup to file
        const timestamp = Date.now();
        const backupFileName = `backup_${guild.id}_${timestamp}.json`;
        const backupFilePath = path.join(backupsPath, backupFileName);
        fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2));

        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle('Backup Created')
              .setColor(0x00FF00) // Green color
              .setDescription(`A new backup has been created: **${backupFileName}**.`)
          ]
        });
      } catch (error) {
        console.error('Error creating backup:', error);
        await interaction.editReply('An error occurred while creating the backup.');
      }
    } else if (subcommand === 'backupperm') {
      const roleId = interaction.options.getString('roleid');
      const role = interaction.guild.roles.cache.get(roleId);

      if (!role) {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle('Role Not Found')
              .setColor(0xFF0000) // Red color
              .setDescription(`Role with ID **${roleId}** not found. Please provide a valid role ID.`)
          ],
          ephemeral: true
        });
        return;
      }

      // Add role to allowed roles
      if (!allowedRoles.includes(roleId)) {
        allowedRoles.push(roleId);
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle('Permission Granted')
              .setColor(0x00FF00) // Green color
              .setDescription(`Role **${role.name}** has been granted permission to use backup commands.`)
          ],
          ephemeral: true
        });
      } else {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle('Permission Already Granted')
              .setColor(0xFFFF00) // Yellow color
              .setDescription(`Role **${role.name}** already has permission to use backup commands.`)
          ],
          ephemeral: true
        });
      }
    }
  }
};