export interface AppEnvironment {
  appUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioSmsFromNumber: string;
  twilioSmsEnabled: string;
  twilioValidateWebhookSignatures: string;
  openaiApiKey: string;
  stripeSecretKey: string;
  stripeWebhookSecret: string;
  reminderJobSecret: string;
}

export function getAppEnvironment(): AppEnvironment {
  return {
    appUrl: process.env.PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID ?? '',
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN ?? '',
    twilioSmsFromNumber: process.env.TWILIO_SMS_FROM_NUMBER ?? '',
    twilioSmsEnabled: process.env.TWILIO_SMS_ENABLED ?? 'false',
    twilioValidateWebhookSignatures: process.env.TWILIO_VALIDATE_WEBHOOK_SIGNATURES ?? 'false',
    openaiApiKey: process.env.OPENAI_API_KEY ?? '',
    stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? '',
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
    reminderJobSecret: process.env.REMINDER_JOB_SECRET ?? '',
  };
}
