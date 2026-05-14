# Appointment Recovery AI

A clean MVP for a low-cost SaaS that helps appointment-based businesses reduce missed appointments and recover revenue.

## MVP screens

- Landing page with value proposition and feature summary
- Pricing page with Free, Starter, Growth, and Pro plans
- Dashboard shell with recovery metrics and activity
- Appointment recovery queue table
- Customer recovery profile table
- Settings page with environment variable placeholders for Supabase, Twilio, OpenAI, Stripe, and calendar integrations

## Backend foundation

- Supabase SQL schema and migration files live in `supabase/schema.sql` and `supabase/migrations/`.
- TypeScript database interfaces live in `lib/types/database.ts`.
- API route structure and example CRUD requests are documented in `docs/backend-api.md`.
- Twilio integration is prepared with environment placeholders and a no-op SMS queue adapter in `lib/sms/twilio.ts`; no real API keys are committed.

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Environment variables

Do not commit real secrets. Use `.env.local` for local development and your deployment provider for production secrets.

Required placeholders are documented in `.env.example`.

## Production build

```bash
npm run build
npm start
```
