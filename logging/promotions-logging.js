const axios = require('axios');
const fs = require('fs');
const { EmbedBuilder } = require('discord.js');

// Roblox Group ID for SCP Evolutionary
const groupId = 5212614;
// Path to JSON file to store processed logs
const logDataFilePath = './processedLogs.json';
// Roblox security cookie for API authentication (ensure it's in the .env file)
const ROBLOX_COOKIE = process.env.ROBLOX_COOKIE;

// To track processed logs during the current session (in-memory set)
let processedLogs = new Set();

// Load processed logs from JSON file or initialize if it doesn't exist
if (fs.existsSync(logDataFilePath)) {
    const savedLogs = JSON.parse(fs.readFileSync(logDataFilePath, 'utf8'));
    processedLogs = new Set(savedLogs);
} else {
    fs.writeFileSync(logDataFilePath, JSON.stringify([]));
}

// Function to fetch the Roblox avatar URL for a user
async function getUserAvatar(userId) {
    try {
        const response = await axios.get(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${userId}&size=150x150&format=Png`);
        return response.data.data[0].imageUrl; // Return avatar image URL
    } catch (error) {
        console.error(`Error fetching avatar for user ${userId}:`, error.message);
        return null; // Return null if the avatar can't be fetched
    }
}

// Function to send rank change message to Discord with embed
async function sendRankChangeMessage(client, channelId, userId, username, oldRankName, newRankName, actionBy, actionById, timestamp, type) {
    try {
        const channel = client.channels.cache.get(channelId);
        if (!channel) {
            console.error(`Channel ID ${channelId} not found in Discord. Ensure the bot has access to this channel.`);
            return;
        }

        // Fetch user avatar
        const avatarUrl = await getUserAvatar(userId);

        // Create the embed message
        const embed = new EmbedBuilder()
            .setColor(type === 'promotion' ? 0x00ff00 : 0xff0000) // Green for promotion, red for demotion
            .setTitle(type === 'promotion' ? 'Promotion' : 'Demotion')
            .setDescription(`${username} has been ${type === 'promotion' ? 'promoted' : 'demoted'}.`)
            .addFields(
                { name: 'Previous Rank', value: oldRankName || 'Unknown', inline: true },
                { name: 'New Rank', value: newRankName || 'Unknown', inline: true },
                { name: 'Action Performed By', value: `${actionBy} (Roblox ID: ${actionById})`, inline: true }, // Add performer's ID here
                { name: 'Timestamp', value: new Date(timestamp).toLocaleString(), inline: true }
            )
            .setThumbnail(avatarUrl || 'https://www.roblox.com/images/default_avatar.png') // Use default avatar if not found
            .setFooter({ text: `Roblox ID: ${userId}` });

        await channel.send({ embeds: [embed] });
        console.log(`Sent ${type} message for ${username} to channel ${channelId}.`);
    } catch (error) {
        console.error(`Error sending message to Discord channel ${channelId}:`, error.message);
    }
}

// Function to fetch the audit logs for rank changes (promotions/demotions)
async function getAuditLogs(cursor = '', retryCount = 0) {
    const url = `https://groups.roblox.com/v1/groups/${groupId}/audit-log?actionType=ChangeRank&limit=100${cursor ? `&cursor=${cursor}` : ''}`;
    const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff: 1s, 2s, 4s, 8s...

    try {
        const response = await axios.get(url, {
            headers: {
                Cookie: `.ROBLOSECURITY=${ROBLOX_COOKIE}`, // Authenticate with the Roblox cookie
            },
        });

        return response.data;
    } catch (error) {
        console.error('Error fetching audit logs:', error.response?.data || error.message);

        if (retryCount >= 5) {
            console.log('Max retries reached. Stopping retries.');
            return null; // Stop after 5 retries
        }

        if (error.response?.status === 500 || error.response?.status === 503) {
            console.log(`Retrying after ${delay / 1000} seconds...`);
            await new Promise(resolve => setTimeout(resolve, delay)); // Wait before retrying
            return getAuditLogs(cursor, retryCount + 1); // Retry with increased retry count
        } else {
            console.error('Non-recoverable error. Stopping retries.');
            return null;
        }
    }
}

// Function to create a unique identifier for each log entry
function createLogEntryId(logEntry) {
    const { description, created } = logEntry;
    if (!description || !description.TargetId) {
        console.error(`Log entry missing necessary information: ${JSON.stringify(logEntry)}`);
        return null; // Return null if necessary data is missing
    }
    return `${description.TargetId}-${new Date(created).getTime()}`;
}

// Function to track promotions and demotions using the audit logs (with pagination)
async function trackPromotionsAndDemotions(client, channelId, cursor = '') {
    console.log('Checking audit logs for promotions and demotions...');
    const auditLogs = await getAuditLogs(cursor);
    if (!auditLogs) return;

    for (const logEntry of auditLogs.data) {
        const { actor, description, created, actionType } = logEntry;
        const target = description ? description.TargetName : 'Unknown';

        // Safeguard against missing data
        if (!actor || !description) {
            console.error(`Log entry missing actor or description: ${JSON.stringify(logEntry)}`);
            continue;
        }

        const actionBy = actor.user.username;
        const actionById = actor.user.userId; // Performer's Roblox ID

        // Get log timestamp
        const logTimestamp = new Date(created).getTime();

        // Create a unique identifier for the log entry
        const logEntryId = createLogEntryId(logEntry);
        if (!logEntryId) continue; // Skip if ID creation failed

        // Ensure we don't process the same log entry more than once
        if (processedLogs.has(logEntryId)) {
            console.log(`Skipping already processed log entry: ${logEntryId}`);
            continue;
        }

        // Determine if it was a promotion or demotion
        const oldRankName = description.OldRoleSetName || 'Unknown';
        const newRankName = description.NewRoleSetName || 'Unknown';
        const type = description.NewRoleSetId > description.OldRoleSetId ? 'promotion' : 'demotion';

        // Log the promotion/demotion to Discord
        await sendRankChangeMessage(client, channelId, description.TargetId, target, oldRankName, newRankName, actionBy, actionById, created, type);

        // Mark the log entry as processed and store it in the JSON file
        processedLogs.add(logEntryId);
        fs.writeFileSync(logDataFilePath, JSON.stringify(Array.from(processedLogs)));
    }

    // Continue with pagination if there is a next page (cursor)
    if (auditLogs.nextPageCursor) {
        await trackPromotionsAndDemotions(client, channelId, auditLogs.nextPageCursor); // Recursive call for next page
    } else {
        console.log('All audit logs have been processed.');
    }
}

// Function to repeatedly track promotions and demotions (polling)
async function pollPromotionsAndDemotions(client, channelId) {
    try {
        await trackPromotionsAndDemotions(client, channelId);
    } catch (error) {
        console.error(`Failed to track promotions/demotions: ${error.message}`);
    }
    setTimeout(() => pollPromotionsAndDemotions(client, channelId), 30000); // Poll every 30 seconds
}

// Start the bot to track promotions and demotions continuously
async function startPromotionTracking(client, channelId) {
    console.log('Starting audit log tracking for promotions and demotions...');
    await pollPromotionsAndDemotions(client, channelId);
}

module.exports = { startPromotionTracking };
