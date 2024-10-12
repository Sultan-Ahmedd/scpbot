require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Create a new Discord client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

// Create a collection to store commands
client.commands = new Collection();

// Read all command files from the "commands" folder
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    client.commands.set(command.name, command);
}

// Event that runs when the bot connects to the server
client.once('ready', () => {
    console.log('Bot is online and ready to watch over SCP Discord Server!!');
});

// Listen for new messages and respond to specific commands
client.on('messageCreate', async (message) => {
    if (message.author.bot) return; // Ignore bot messages

    const prefix = '!'; // Change this to your preferred prefix
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    // Check if the command exists
    const command = client.commands.get(commandName);
    if (!command) return;

    try {
        // Execute the command
        await command.execute(message, args);
    } catch (error) {
        console.error(error);
        message.reply('There was an error executing that command.');
    }
});

// Log in to Discord with your bot token
client.login(process.env.DISCORD_TOKEN);
