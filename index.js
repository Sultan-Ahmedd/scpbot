require('dotenv').config(); 
const { Client, GatewayIntentBits, Collection } = require('discord.js'); 
const fs = require('fs'); 
const path = require('path'); 
const { startPromotionTracking } = require('./logging/promotions-logging'); 

// Create a new Discord client instance 
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildBans,
        GatewayIntentBits.GuildPresences
    ] 
}); 

// Create a collection to store commands 
client.commands = new Collection(); 

// Read all command files from the "commands" folder 
const commandsPath = path.join(__dirname, 'commands'); 
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js')); 

for (const file of commandFiles) { 
    const filePath = path.join(commandsPath, file); 
    
    try { 
        const command = require(filePath); 

        if (!command.data || !command.data.name) { 
            console.error(`Error: Command file ${file} is missing 'data' or 'name' property.`); 
            continue; // Skip this file as it's not correctly configured 
        } 

        client.commands.set(command.data.name, command); 
        console.log(`Loaded command: ${file}`); 
    } catch (error) { 
        console.error(`Error loading command file: ${file}`, error); 
    } 
} 

// Load Action Logs Module
const loadActionLogs = require('./logging/actionlogs');
loadActionLogs(client);

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
