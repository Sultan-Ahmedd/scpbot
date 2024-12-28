const fs = require('fs');
const { Events, AuditLogEvent, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = (client) => {
    // Comprehensive helper function for logging with extensive error handling
    const sendLogMessage = async (client, embed) => {
        let actionLogsChannelId = null;
        try {
            const data = fs.readFileSync('actionlogs.json', 'utf8');
            const jsonData = JSON.parse(data);
            actionLogsChannelId = jsonData.actionLogsChannel;

            if (!actionLogsChannelId) {
                console.error('❌ No action logs channel ID found in configuration');
                return;
            }
        } catch (error) {
            console.error('❌ Could not read action logs data:', error);
            return;
        }

        try {
            console.log('Attempting to send log message...');
            const channel = await client.channels.fetch(actionLogsChannelId);
            
            if (!channel) {
                console.error(`❌ Channel with ID ${actionLogsChannelId} not found.`);
                return;
            }

            // Check channel permissions
            const botMember = channel.guild.members.me;
            const requiredPermissions = [
                PermissionFlagsBits.SendMessages, 
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.EmbedLinks
            ];

            const missingPermissions = requiredPermissions.filter(
                permission => !botMember.permissionsIn(channel).has(permission)
            );

            if (missingPermissions.length > 0) {
                console.error('❌ Missing Permissions:', missingPermissions);
                return;
            }

            console.log('Sending message to channel:', actionLogsChannelId);
            await channel.send({ embeds: [embed] });
            console.log('✅ Log message sent successfully');
        } catch (error) {
            console.error('❌ Error in sendLogMessage:', error);
            
            // Additional diagnostic information
            console.error('Error Details:', {
                channelId: actionLogsChannelId,
                errorName: error.name,
                errorMessage: error.message,
                stackTrace: error.stack
            });
        }
    };

    // Ban Event Listener
    client.on(Events.GuildBanAdd, async (ban) => {
        try {
            const auditLogs = await ban.guild.fetchAuditLogs({ 
                type: AuditLogEvent.MemberBanAdd, 
                limit: 1 
            });
            const banLog = auditLogs.entries.first();
            
            const banReason = banLog ? banLog.reason || 'No reason provided' : 'No reason provided';
            const moderator = banLog ? banLog.executor.tag : 'Unknown';

            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('🔨 User Banned')
                .addFields(
                    { name: 'User', value: `${ban.user.tag} (${ban.user.id})`, inline: false },
                    { name: 'Banned By', value: moderator, inline: false },
                    { name: 'Reason', value: banReason, inline: false }
                )
                .setTimestamp();

            await sendLogMessage(client, embed);
        } catch (error) {
            console.error('Error logging ban:', error);
        }
    });

    // Kick Event Listener
    client.on(Events.GuildMemberRemove, async (member) => {
        try {
            // Wait a bit to allow audit log to populate
            await new Promise(resolve => setTimeout(resolve, 1000));

            const auditLogs = await member.guild.fetchAuditLogs({ 
                type: AuditLogEvent.MemberKick, 
                limit: 1 
            });
            
            const kickLog = auditLogs.entries.first();
            
            // Only log if it's a recent kick (within last 5 seconds)
            if (kickLog && kickLog.target.id === member.id && 
                Date.now() - kickLog.createdTimestamp < 5000) {
                
                const kickReason = kickLog.reason || 'No reason provided';
                
                const embed = new EmbedBuilder()
                    .setColor('#FFA500')
                    .setTitle('👢 User Kicked')
                    .addFields(
                        { name: 'User', value: `${member.user.tag} (${member.user.id})`, inline: false },
                        { name: 'Kicked By', value: kickLog.executor.tag, inline: false },
                        { name: 'Reason', value: kickReason, inline: false }
                    )
                    .setTimestamp();

                await sendLogMessage(client, embed);
            }
        } catch (error) {
            console.error('Error logging kick:', error);
        }
    });

    // Timeout Event Listener
    client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
        // Check if communication disabled status changed
        if (oldMember.communicationDisabledUntil !== newMember.communicationDisabledUntil) {
            try {
                // Wait a bit to allow audit log to populate
                await new Promise(resolve => setTimeout(resolve, 1000));

                const auditLogs = await newMember.guild.fetchAuditLogs({ 
                    type: AuditLogEvent.MemberUpdate, 
                    limit: 1 
                });
                
                const timeoutLog = auditLogs.entries.first();

                if (newMember.communicationDisabledUntil) {
                    // Timeout applied
                    const timeoutDuration = Math.round(
                        (newMember.communicationDisabledUntil - Date.now()) / 1000 / 60
                    );
                    
                    const embed = new EmbedBuilder()
                        .setColor('#808080')
                        .setTitle('🔇 User Muted')
                        .addFields(
                            { name: 'User', value: `${newMember.user.tag} (${newMember.user.id})`, inline: false },
                            { name: 'Muted By', value: timeoutLog?.executor?.tag || 'Unknown', inline: false },
                            { name: 'Duration', value: `${timeoutDuration} minutes`, inline: false },
                            { name: 'Reason', value: timeoutLog?.reason || 'No reason provided', inline: false }
                        )
                        .setTimestamp();

                    await sendLogMessage(client, embed);
                } else {
                    // Timeout removed
                    const embed = new EmbedBuilder()
                        .setColor('#00FF00')
                        .setTitle('🔊 User Timeout Removed')
                        .addFields(
                            { name: 'User', value: `${newMember.user.tag} (${newMember.user.id})`, inline: false },
                            { name: 'Unmuted By', value: timeoutLog?.executor?.tag || 'Unknown', inline: false }
                        )
                        .setTimestamp();

                    await sendLogMessage(client, embed);
                }
            } catch (error) {
                console.error('Error logging timeout:', error);
            }
        }
    });

    console.log('Action Logs Module: Initialization Complete');
};
