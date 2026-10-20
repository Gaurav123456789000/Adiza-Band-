const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });
for (const page of ['index.html', 'about.html', 'contact.html']) {
  let html = fs.readFileSync(path.join(root, 'pages', page), 'utf8');
  if (page === 'contact.html') {
    const siteKey = process.env.TURNSTILE_SITE_KEY || '';
    html = html.replace('__TURNSTILE_WIDGET__', siteKey ? `<div class="cf-turnstile" data-sitekey="${siteKey}"></div>` : '');
    html = html.replace('__TURNSTILE_SCRIPT__', siteKey ? '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>' : '');
  }
  fs.writeFileSync(path.join(output, page), html);
}
fs.cpSync(path.join(root, 'assets'), path.join(output, 'assets'), { recursive: true });
