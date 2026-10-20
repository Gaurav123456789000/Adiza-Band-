require('./load-env');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || 3000);
const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
const turnstileSiteKey = process.env.TURNSTILE_SITE_KEY;
const rateLimits = new Map();
const pages = {
  '/': 'index.html', '/index.html': 'index.html',
  '/about': 'about.html', '/about.html': 'about.html',
  '/contact': 'contact.html', '/contact.html': 'contact.html',
};
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg' };

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'POST' && url.pathname === '/api/inquiries') {
    if (!webhookUrl || (process.env.NODE_ENV === 'production' && (!turnstileSecret || !turnstileSiteKey))) return send(res, 503, { error: 'Inquiry service is not configured.' });
    const ip = req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const recent = (rateLimits.get(ip) || []).filter(time => now - time < 15 * 60 * 1000);
    if (recent.length >= 5) return send(res, 429, { error: 'Too many inquiries. Please try again later.' });
    recent.push(now);
    rateLimits.set(ip, recent);
    if (rateLimits.size > 10000) {
      for (const [key, times] of rateLimits) if (!times.some(time => now - time < 15 * 60 * 1000)) rateLimits.delete(key);
    }
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 16_384) req.destroy();
    });
    req.on('end', async () => {
      try {
        const data = JSON.parse(raw);
        if (String(data.website || '').trim()) return send(res, 200, { ok: true });
        if (turnstileSecret) {
          const form = new URLSearchParams({ secret: turnstileSecret, response: String(data.turnstileToken || ''), remoteip: ip });
          const verification = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form });
          const result = await verification.json();
          if (!result.success) return send(res, 400, { error: 'Please complete the bot check and try again.' });
        }
        const name = String(data.name || '').trim().slice(0, 120);
        const email = String(data.email || '').trim().slice(0, 254);
        const eventType = String(data.eventType || '').trim().slice(0, 120);
        const eventDate = String(data.eventDate || '').trim();
        const message = String(data.message || '').trim().slice(0, 1500);
        if (!name || !/^\S+@\S+\.\S+$/.test(email) || !eventType) return send(res, 400, { error: 'Please provide a name, valid email, and event type.' });
        const parsedEventDate = eventDate && /^\d{4}-\d{2}-\d{2}$/.test(eventDate) ? new Date(`${eventDate}T00:00:00.000Z`) : null;
        if (eventDate && (!parsedEventDate || Number.isNaN(parsedEventDate.getTime()) || parsedEventDate.toISOString().slice(0, 10) !== eventDate)) {
          return send(res, 400, { error: 'Enter a valid event date in YYYY-MM-DD format.' });
        }
        if (eventDate && eventDate < new Date().toISOString().slice(0, 10)) {
          return send(res, 400, { error: 'Event date must be today or later.' });
        }
        const discordResponse = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            allowed_mentions: { parse: [] },
            embeds: [{
              title: 'New Adiza booking inquiry',
              color: 14267147,
              fields: [
                { name: 'Name', value: name },
                { name: 'Email', value: email },
                { name: 'Event type', value: eventType },
                { name: 'Event date', value: eventDate || 'Not provided' },
                { name: 'Message', value: message || 'Not provided' },
              ],
              timestamp: new Date().toISOString(),
            }],
          }),
        });
        if (!discordResponse.ok) return send(res, 502, { error: 'Could not deliver inquiry.' });
        send(res, 200, { ok: true });
      } catch {
        send(res, 400, { error: 'Invalid inquiry request.' });
      }
    });
    return;
  }

  const page = pages[url.pathname];
  let file;
  if (page) {
    file = path.join(root, 'pages', page);
  } else if (url.pathname.startsWith('/assets/')) {
    const relative = decodeURIComponent(url.pathname.slice(1));
    file = path.resolve(root, relative);
    if (!file.startsWith(path.join(root, 'assets') + path.sep)) return send(res, 404, { error: 'Not found.' });
  } else {
    return send(res, 404, { error: 'Not found.' });
  }
  fs.readFile(file, (error, contents) => {
    if (error) return send(res, 404, { error: 'Not found.' });
    if (page === 'contact.html') {
      const html = contents.toString().replace(/__TURNSTILE_WIDGET__/g, turnstileSiteKey ? `<div class="cf-turnstile" data-sitekey="${turnstileSiteKey}"></div>` : '').replace(/__TURNSTILE_SCRIPT__/g, turnstileSiteKey ? '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>' : '');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(html);
    }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(contents);
  });
});

server.listen(port, () => console.log(`Adiza site running at http://localhost:${port}`));

