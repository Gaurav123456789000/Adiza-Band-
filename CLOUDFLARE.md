# Cloudflare Pages deployment

The contact form needs a Pages Function as well as the static files. Deploy this repository through Cloudflare Pages with:

- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: repository root

Set `DISCORD_WEBHOOK_URL` as an encrypted Pages environment variable for Production (and Preview if needed). The webhook is not part of the built files. To enable Turnstile, set `TURNSTILE_SITE_KEY` as a build variable and `TURNSTILE_SECRET_KEY` as an encrypted Pages runtime variable. Without Turnstile keys, the honeypot remains active and the form can still submit.

To enable the five requests per 15 minutes limit on Pages, create a KV namespace and bind it to the Pages project with the binding name `INQUIRY_RATE_LIMIT`. The Node development server has its own in-memory rate limit.

After changing environment variables or code, redeploy the Pages project. The deployed site must include the `/api/inquiries` Pages Function; uploading only the `dist` folder as static files will not handle form submissions.
