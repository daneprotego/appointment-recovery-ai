# Backend API structure

This project uses Next.js App Router API handlers backed by Supabase. All handlers currently use placeholder header-based auth so the API shape can be built before full Supabase Auth integration.

## Environment variables

Use placeholders in `.env.example` and real values only in local or hosted secret stores:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_MESSAGING_SERVICE_SID`
- `TWILIO_PHONE_NUMBER`

## Placeholder auth

Every API request must include these temporary headers:

- `x-business-id`: UUID for the active business tenant
- `x-user-id`: UUID for the acting user
- `x-user-role`: optional role; defaults to `staff`

Replace `lib/auth/placeholder-auth.ts` with Supabase JWT/session validation before production use.

## CRUD route pattern

Each resource exposes the same basic REST shape:

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/api/{resource}` | List records for the active business |
| `POST` | `/api/{resource}` | Create a record and stamp `business_id` from auth context |
| `GET` | `/api/{resource}/{id}` | Read one record scoped to the active business |
| `PATCH` | `/api/{resource}/{id}` | Update one record scoped to the active business |
| `DELETE` | `/api/{resource}/{id}` | Delete one record scoped to the active business |

Configured resources:

- `/api/businesses`
- `/api/users`
- `/api/customers`
- `/api/appointments`
- `/api/reminders`
- `/api/waitlists`
- `/api/subscriptions`

`businesses` is not automatically filtered by `business_id` because it is the tenant root table. Other resources are tenant-scoped.

## Example requests

Create a customer:

```bash
curl -X POST http://localhost:3000/api/customers \
  -H 'content-type: application/json' \
  -H 'x-business-id: 00000000-0000-0000-0000-000000000000' \
  -H 'x-user-id: 11111111-1111-1111-1111-111111111111' \
  -d '{"first_name":"Avery","last_name":"Chen","phone":"+15555550100","sms_opt_in":true}'
```

Create an appointment:

```bash
curl -X POST http://localhost:3000/api/appointments \
  -H 'content-type: application/json' \
  -H 'x-business-id: 00000000-0000-0000-0000-000000000000' \
  -H 'x-user-id: 11111111-1111-1111-1111-111111111111' \
  -d '{"customer_id":"22222222-2222-2222-2222-222222222222","service_name":"Dental cleaning","starts_at":"2026-06-01T14:00:00Z","value_cents":18000}'
```

Queue an SMS reminder record:

```bash
curl -X POST http://localhost:3000/api/reminders \
  -H 'content-type: application/json' \
  -H 'x-business-id: 00000000-0000-0000-0000-000000000000' \
  -H 'x-user-id: 11111111-1111-1111-1111-111111111111' \
  -d '{"appointment_id":"33333333-3333-3333-3333-333333333333","customer_id":"22222222-2222-2222-2222-222222222222","channel":"sms","scheduled_for":"2026-06-01T12:00:00Z","message_body":"Reminder: your appointment is today."}'
```
