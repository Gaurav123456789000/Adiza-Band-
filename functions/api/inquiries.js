export async function onRequestPost({ request, env }) {
  const json = (status, body) => new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });

  if (!env.DISCORD_WEBHOOK_URL) return json(503, { error: 'Inquiry service is not configured on Cloudflare.' });
  if (request.headers.get('content-length') > 16_384) return json(413, { error: 'Inquiry is too large.' });

  let data;
  try {
    data = await request.json();
  } catch {
    return json(400, { error: 'Invalid inquiry request.' });
  }

  if (String(data.website || '').trim()) return json(200, { ok: true });

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (env.INQUIRY_RATE_LIMIT) {
    const bucket = Math.floor(Date.now() / 900_000);
    const key = `inquiry:${ip}:${bucket}`;
    const count = Number(await env.INQUIRY_RATE_LIMIT.get(key) || 0);
    if (count >= 5) return json(429, { error: 'Too many inquiries. Please try again later.' });
    await env.INQUIRY_RATE_LIMIT.put(key, String(count + 1), { expirationTtl: 900 });
  }

  if (env.TURNSTILE_SECRET_KEY) {
    const form = new URLSearchParams({
      secret: env.TURNSTILE_SECRET_KEY,
      response: String(data.turnstileToken || ''),
      remoteip: ip,
    });
    try {
      const verification = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form,
      });
      if (!(await verification.json()).success) return json(400, { error: 'Please complete the bot check and try again.' });
    } catch {
      return json(502, { error: 'Could not verify the bot check. Please try again.' });
    }
  }

  const name = String(data.name || '').trim().slice(0, 120);
  const email = String(data.email || '').trim().slice(0, 254);
  const eventType = String(data.eventType || '').trim().slice(0, 120);
  const eventDate = String(data.eventDate || '').trim();
  const message = String(data.message || '').trim().slice(0, 1500);
  if (!name || !/^\S+@\S+\.\S+$/.test(email) || !eventType) {
    return json(400, { error: 'Please provide a name, valid email, and event type.' });
  }

  const parsedDate = eventDate && /^\d{4}-\d{2}-\d{2}$/.test(eventDate)
    ? new Date(`${eventDate}T00:00:00.000Z`)
    : null;
  if (eventDate && (!parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== eventDate)) {
    return json(400, { error: 'Enter a valid event date.' });
  }
  if (eventDate && eventDate < new Date().toISOString().slice(0, 10)) {
    return json(400, { error: 'Event date must be today or later.' });
  }

  try {
    const delivered = await fetch(env.DISCORD_WEBHOOK_URL, {
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
    if (!delivered.ok) return json(502, { error: 'Discord could not receive the inquiry.' });
    return json(200, { ok: true });
  } catch {
    return json(502, { error: 'Could not reach Discord. Please try again later.' });
  }
}
