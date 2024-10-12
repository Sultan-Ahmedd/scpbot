const { PermissionsBitField } = require('discord.js');

module.exports = {
    name: 'nuke', // Command name
    description: 'Nuke command with four options for deleting channels',

    async execute(message, args) {
        // Check if the user has "Administrator" permission
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply('You do not have permission to use this command. Only users with "Administrator" permission can execute this command.');
        }

        // Ask the user to select one of the four options
        message.channel.send(`Select one of the four options:
        \n1. Delete a specific channel (Channel ID)
        \n2. Delete multiple channels (Channel ID separated by comma)
        \n3. Delete all items except channels provided (Channel ID separated by comma)
        \n4. Delete all channels (Critical)
        \n\nRespond with one of the numbers to begin the process.`);

        // Set up a message collector to collect the user's choice
        const filter = (response) => response.author.id === message.author.id; // Only collect messages from the command initiator
        const collector = message.channel.createMessageCollector({ filter, max: 1, time: 15000 }); // Collect a single message

        collector.on('collect', async (response) => {
            const choice = response.content.trim(); // Get the user's choice

            switch (choice) {
                case '1': // Delete a specific channel
                    message.channel.send('Please provide the Channel ID you want to delete:');
                    await handleSingleChannelDeletion(message, filter);
                    break;

                case '2': // Delete multiple channels
                    message.channel.send('Please provide the Channel IDs (separated by commas) you want to delete:');
                    await handleMultipleChannelDeletion(message, filter);
                    break;

                case '3': // Delete all channels except those provided
                    message.channel.send('Please provide the Channel IDs (separated by commas) that you want to keep:');
                    await handleAllExceptChannelsDeletion(message, filter);
                    break;

                case '4': // Delete all channels (Critical)
                    message.channel.send('WARNING: You are about to delete all channels. Type `CONFIRM` to proceed.');
                    await handleDeleteAllChannels(message, filter);
                    break;

                default:
                    message.channel.send('Invalid option. Please respond with a number between 1 and 4.');
                    break;
            }
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time') {
                message.channel.send('You took too long to respond. Nuke command cancelled.');
            }
        });
    },
};

// Function to handle single channel deletion
async function handleSingleChannelDeletion(message, filter) {
    const collector = message.channel.createMessageCollector({ filter, max: 1, time: 15000 });
    collector.on('collect', async (response) => {
        const channelId = response.content.trim();
        const channel = message.guild.channels.cache.get(channelId);

        if (channel) {
            try {
                await channel.delete();
                message.channel.send(`Channel <#${channelId}> has been nuked!`);
            } catch (error) {
                message.channel.send('I do not have permission to delete this channel or something went wrong.');
                console.error(error);
            }
        } else {
            message.channel.send('Invalid Channel ID. Please make sure the channel exists.');
        }
    });
}

// Function to handle multiple channel deletion
async function handleMultipleChannelDeletion(message, filter) {
    const collector = message.channel.createMessageCollector({ filter, max: 1, time: 15000 });
    collector.on('collect', async (response) => {
        const channelIds = response.content.trim().split(',').map(id => id.trim());
        for (const channelId of channelIds) {
            const channel = message.guild.channels.cache.get(channelId);
            if (channel) {
                try {
                    await channel.delete();
                    message.channel.send(`Channel <#${channelId}> has been nuked!`);
                } catch (error) {
                    message.channel.send(`Failed to delete channel <#${channelId}>.`);
                    console.error(error);
                }
            } else {
                message.channel.send(`Invalid Channel ID: ${channelId}.`);
            }
        }
    });
}

// Function to delete all channels except those provided
async function handleAllExceptChannelsDeletion(message, filter) {
    const collector = message.channel.createMessageCollector({ filter, max: 1, time: 15000 });
    collector.on('collect', async (response) => {
        const keepChannelIds = response.content.trim().split(',').map(id => id.trim());
        const channelsToDelete = message.guild.channels.cache.filter(channel => !keepChannelIds.includes(channel.id));

        for (const [channelId, channel] of channelsToDelete) {
            try {
                await channel.delete();
                message.channel.send(`Channel <#${channelId}> has been nuked!`);
            } catch (error) {
                message.channel.send(`Failed to delete channel <#${channelId}>.`);
                console.error(error);
            }
        }
    });
}

// Function to delete all channels
async function handleDeleteAllChannels(message, filter) {
    const collector = message.channel.createMessageCollector({ filter, max: 1, time: 15000 });
    collector.on('collect', async (response) => {
        if (response.content.trim().toLowerCase() === 'confirm') {
            const channels = message.guild.channels.cache;
            for (const [channelId, channel] of channels) {
                try {
                    await channel.delete();
                    message.channel.send(`Channel <#${channelId}> has been nuked!`);
                } catch (error) {
                    message.channel.send(`Failed to delete channel <#${channelId}>.`);
                    console.error(error);
                }
            }
        } else {
            message.channel.send('Nuke command cancelled. You did not type `CONFIRM`.');
        }
    });
}
