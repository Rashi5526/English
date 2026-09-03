# lowkey (Nova)

A React + Vite chat app that helps you learn natural, Gen-Z-flavored English,
powered by Claude — installable as an app on your phone, with push
notifications.

## How it's structured

- `src/` — the frontend (React + Vite + Tailwind).
- `api/nova.ts` — backend function that holds the Anthropic API key and
  talks to Claude. The frontend calls `/api/nova` (see `src/lib/claude.ts`)
  instead of calling Anthropic directly, so the key is never exposed.
- `public/manifest.json`, `public/icons/`, `public/sw.js` — makes the app
  installable to a phone's home screen (a PWA) with its own icon.
- `src/lib/push.ts` + `api/subscribe.ts` — lets a user turn on notifications;
  their subscription is stored in Vercel KV (a small key-value database).
- `api/send-notification.ts` — an endpoint *you* call to push a notification
  to everyone who turned them on.
- `api/cron/daily-reminder.ts` + `vercel.json` — an optional daily reminder,
  sent automatically.

## Run it locally

```bash
pnpm install
cp .env.example .env      # paste in your real Anthropic API key
pnpm dev
```

Open the printed local URL. Note: plain `pnpm dev` runs the frontend but not
the `api/*` functions — for those to work locally too, use `npx vercel dev`
instead, once the project is linked to Vercel (see step 2 below: `vercel link`).

## Deploy so your friend can install it as an app

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
```
Create a repo on GitHub, then `git remote add origin ...` and `git push -u origin main`.

### 2. Import into Vercel
Go to https://vercel.com → "Add New Project" → import the GitHub repo.
Vercel auto-detects Vite and the `api/` functions.

### 3. Add a Redis database (stores who's subscribed to notifications)
Vercel's old built-in "KV" product is retired; the current path is the
**Upstash Redis** integration from the Vercel Marketplace (it's a free tier
and uses the same env var names, so no code changes are needed here).
In the Vercel project → **Storage** tab → **Marketplace Database Providers**
→ **Upstash** → **Redis** → connect it to this project. Vercel automatically
adds `KV_REST_API_URL` / `KV_REST_API_TOKEN` environment variables for
you — nothing to copy manually.

### 4. Add the rest of the environment variables
Project → **Settings** → **Environment Variables**:

| Name | Value |
|---|---|
| `ANTHROPIC_API_KEY` | your real key from console.anthropic.com |
| `VAPID_PUBLIC_KEY` | `BJAHZ3l-vbmoXz70FO8bIehWOVITsUbijTl20oIrIh12Sj9IY7OkX9U3hu5HVvPNa54I8RHgy1cVHZ5Ohn1LCsU` |
| `VAPID_PRIVATE_KEY` | `SPELjZKlmkGfKCdPh8JQFv_OdMJgfeE_nvF_FIEUQks` |
| `VAPID_SUBJECT` | `mailto:you@example.com` |
| `VITE_VAPID_PUBLIC_KEY` | same value as `VAPID_PUBLIC_KEY` above |
| `NOTIFY_SECRET` | make up any long random string |

The VAPID pair above was freshly generated for you and is ready to use as-is.
If you ever want your own, run `npx web-push generate-vapid-keys` and swap
both values (keep `VAPID_PUBLIC_KEY` and `VITE_VAPID_PUBLIC_KEY` identical).

### 5. Deploy
Vercel gives you a live URL, e.g. `https://lowkey-yourname.vercel.app`.

### 6. Your friend installs it
They open the link in their phone's browser, then:
- **iPhone:** Safari → Share button → **Add to Home Screen**
- **Android:** Chrome → menu → **Add to Home screen** / **Install app**

It now opens full-screen with its own icon, like a real app.

### 7. Turn on notifications
Inside the installed app, open **Profile → Notifications** and tap it to
enable. Important iOS caveat: push notifications only work once the app has
been **added to the home screen** — they won't work in a regular Safari tab.
Android/Chrome supports notifications either way.

### 8. Send a notification
Whenever you want to nudge your friend:
```bash
curl -X POST https://your-app.vercel.app/api/send-notification \
  -H "Content-Type: application/json" \
  -H "x-notify-secret: <your NOTIFY_SECRET>" \
  -d '{"title":"lowkey","body":"Nova misses you 😭 come practice"}'
```

### 9. (Optional) Automatic daily reminder
`vercel.json` already schedules `api/cron/daily-reminder.ts` to run once a
day (6pm UTC) and ping everyone subscribed — no action needed, it's live as
soon as you deploy. Edit the `schedule` cron expression in `vercel.json` to
change the time, or delete the `crons` block to turn it off.

Every future change: just `git push`, Vercel redeploys automatically.
