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
- A health check endpoint is available at `/api/health` for Vercel uptime checks and deployment verification.

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Environment variables

Do not commit real secrets. Use `.env.local` for local development and Vercel Project Settings for production secrets.

Required placeholders are documented in `.env.example`. Replace every `replace-me-*` value before deploying to production.

### Production environment variable checklist

Configure these in Vercel under **Project Settings > Environment Variables** for **Production** and, if needed, **Preview**:

| Variable | Required | Safe placeholder | Notes |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | Yes | `https://appointment-recovery-ai.vercel.app` | Public base URL of the deployed app. Use your production domain after it is assigned. |
| `PUBLIC_APP_URL` | Recommended | `https://appointment-recovery-ai.vercel.app` | Server-side equivalent used by integrations that need the app URL. |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | `https://example.supabase.co` | Supabase Project URL from **Settings > API**. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | `replace-me-supabase-anon-key` | Supabase anon publishable key. This is safe to expose to the browser but should still be project-specific. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | `replace-me-supabase-service-role-key` | Server-only Supabase service role key. Never expose with `NEXT_PUBLIC_`. |
| `REMINDER_JOB_SECRET` | Yes | `replace-me-long-random-job-secret` | Long random string required by the reminder job endpoint. |
| `TWILIO_ACCOUNT_SID` | Optional | `replace-me-twilio-account-sid` | Required only when SMS sending is enabled. |
| `TWILIO_AUTH_TOKEN` | Optional | `replace-me-twilio-auth-token` | Required only when SMS sending is enabled. |
| `TWILIO_MESSAGING_SERVICE_SID` | Optional | `replace-me-twilio-messaging-service-sid` | Use either a Messaging Service SID or phone number for Twilio sending. |
| `TWILIO_PHONE_NUMBER` | Optional | `+15555550100` | E.164 sender number if not using a Messaging Service. |
| `TWILIO_SMS_ENABLED` | Optional | `false` | Set to `true` only after Twilio credentials and compliance are ready. |
| `TWILIO_VALIDATE_WEBHOOK_SIGNATURES` | Optional | `false` | Set to `true` in production when Twilio webhooks are configured. |
| `OPENAI_API_KEY` | Optional | `replace-me-openai-api-key` | Required only for AI-powered message classification or generation. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Optional | `replace-me-stripe-publishable-key` | Required only when Stripe checkout is connected. |
| `STRIPE_SECRET_KEY` | Optional | `replace-me-stripe-secret-key` | Server-only Stripe API key. |
| `STRIPE_WEBHOOK_SECRET` | Optional | `replace-me-stripe-webhook-secret` | Stripe webhook signing secret. |
| `STRIPE_STARTER_PRICE_ID` | Optional | `replace-me-starter-price-id` | Stripe Price ID for the Starter plan. |
| `STRIPE_GROWTH_PRICE_ID` | Optional | `replace-me-growth-price-id` | Stripe Price ID for the Growth plan. |
| `STRIPE_PRO_PRICE_ID` | Optional | `replace-me-pro-price-id` | Stripe Price ID for the Pro plan. |
| `GOOGLE_CALENDAR_CLIENT_ID` | Optional | `replace-me-google-calendar-client-id` | Required only when Google Calendar integration is enabled. |
| `GOOGLE_CALENDAR_CLIENT_SECRET` | Optional | `replace-me-google-calendar-client-secret` | Server-only Google OAuth secret. |
| `MICROSOFT_CALENDAR_CLIENT_ID` | Optional | `replace-me-microsoft-calendar-client-id` | Required only when Microsoft Calendar integration is enabled. |
| `MICROSOFT_CALENDAR_CLIENT_SECRET` | Optional | `replace-me-microsoft-calendar-client-secret` | Server-only Microsoft OAuth secret. |

Production startup validation checks these required values: `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `REMINDER_JOB_SECRET`. Missing values or known placeholders fail startup and return a failing `/api/health` response.

## Supabase setup

1. Create a Supabase project for the production environment.
2. In **Project Settings > API**, copy the Project URL, anon key, and service role key into the Vercel environment variables listed above.
3. In **Authentication > URL Configuration**, set the Site URL to your production `NEXT_PUBLIC_APP_URL`.
4. Add any required redirect URLs for local and deployed auth flows, for example:
   - `http://localhost:3000/**`
   - `https://appointment-recovery-ai.vercel.app/**`
   - `https://your-production-domain.com/**`
5. Apply the database migrations from `supabase/migrations/` before routing production traffic to the app.
6. Keep Row Level Security and service role usage under review before enabling customer traffic. The service role key must remain server-only.

## Migration instructions

The migration files are ordered by timestamp and should be applied in order:

1. `supabase/migrations/20260514000000_initial_schema.sql`
2. `supabase/migrations/20260514010000_recovery_workflow.sql`

Recommended Supabase CLI flow:

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

Manual SQL Editor flow:

1. Open the Supabase dashboard for the target project.
2. Open **SQL Editor**.
3. Paste and run each migration file in timestamp order.
4. Confirm the expected tables exist before deploying the app.

For a fresh local review of the full schema, compare `supabase/schema.sql` with the timestamped files before applying changes.

## Vercel deployment instructions

1. Push the repository to GitHub, GitLab, or Bitbucket.
2. In Vercel, choose **Add New > Project** and import the repository.
3. Keep the default framework preset as **Next.js**.
4. Set the install command to `npm install` unless your team standardizes on `npm ci`.
5. Set the build command to `npm run build`.
6. Set the output directory to the default Next.js output; do not override it.
7. Add all required production environment variables from the checklist above.
8. Deploy the project.
9. After the deployment completes, open `https://<your-vercel-domain>/api/health` and confirm it returns `status: "ok"`.
10. Update Supabase Auth redirect URLs with the final Vercel or custom domain.
11. If using scheduled reminder processing, configure a scheduler to call `POST /api/jobs/reminders` with the `x-job-secret` header set to `REMINDER_JOB_SECRET`.

## Deployment checklist

Before promoting a deployment to production:

- [ ] Supabase project is created for the target environment.
- [ ] Migrations have been applied successfully.
- [ ] Required Vercel environment variables are set with real values, not placeholders.
- [ ] `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, webhook secrets, OAuth secrets, and Twilio auth token are server-only.
- [ ] Supabase Auth Site URL and redirect URLs match the deployed domain.
- [ ] `TWILIO_SMS_ENABLED` remains `false` until Twilio credentials, sender registration, and webhook validation are ready.
- [ ] `TWILIO_VALIDATE_WEBHOOK_SIGNATURES` is enabled before accepting production Twilio webhooks.
- [ ] `REMINDER_JOB_SECRET` is a long random value and shared only with the scheduler.
- [ ] `npm run typecheck` passes.
- [ ] `npm run build` passes.
- [ ] `/api/health` returns `status: "ok"` on the deployed URL.
- [ ] No real secrets are committed to the repository.

## Production build

```bash
npm run build
npm start
```
