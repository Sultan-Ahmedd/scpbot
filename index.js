require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { startPromotionTracking } = require('./logging/promotions-logging'); // Updated path to promotions-logging.js

// Create a new Discord client instance
const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

// Create a collection to store commands
client.commands = new Collection();

// Read all command files from the "commands" folder
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    client.commands.set(command.data.name, command);
}

// Event that runs when the bot connects to the server
client.once('ready', () => {
    console.log('Bot is online and ready to watch over SCP Discord Server!!');

    // Start tracking Roblox promotions
    const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID; // Use channel ID from environment variables
    startPromotionTracking(client, CHANNEL_ID); // Start the promotion tracking functionality
});

// Listen for interactions (slash commands)
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'There was an error executing that command!', ephemeral: true });
    }
});

// Log in to Discord with your bot token
client.login(process.env.DISCORD_TOKEN);
