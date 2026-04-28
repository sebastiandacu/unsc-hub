# MILSIM Hub

A modular operations hub for Roblox MILSIM units. Currently themed as the FBI **Unusual Incidents Unit** — change `config/unit.ts` to rebrand.

## Stack
- Next.js 15 (App Router) + React 19 + TypeScript
- Tailwind v4 + custom CSS-variable theme
- Prisma + Postgres (Neon)
- Auth.js (NextAuth) — Discord OAuth with guild role gate
- UploadThing for file uploads
- Tiptap rich text + FullCalendar (added in next iteration)

## Setup

1. `cp .env.example .env` and fill in the values (see comments in that file).
2. `npm install`
3. `npx prisma db push` to create tables in your Neon DB.
4. `npm run db:seed` to seed default Wall categories.
5. `npm run dev` and visit http://localhost:3000.

## Discord setup

1. Create an app at https://discord.com/developers/applications
2. **OAuth2** → add redirect `http://localhost:3000/api/auth/callback/discord`
3. **Bot** → reset token, copy into `DISCORD_BOT_TOKEN`. Invite bot to your guild.
4. With Discord developer mode on, right-click your server → **Copy Server ID** → `DISCORD_GUILD_ID`.
5. Right-click the **Authorized** role → **Copy Role ID** → `AUTHORIZED_ROLE_ID`.

## Hosting (free tier)
- **Vercel Hobby** for the app
- **Neon** for Postgres (free 0.5 GB)
- **UploadThing** for uploads (free 2 GB)

## Project layout
- `app/` — routes. `(app)/` group requires auth + renders inside the sidebar shell.
- `components/` — shared React components.
- `config/unit.ts` — single source of truth for branding.
- `lib/auth.ts` — Auth.js config + Discord guild role check.
- `lib/auth/guards.ts` — `requireUser`, `requirePermission`, `requireAdmin`.
- `lib/discord.ts` — Discord REST helpers.
- `lib/rank.ts` — rank resolution from Discord roles + admin priority list + override.
- `prisma/schema.prisma` — full data model.
