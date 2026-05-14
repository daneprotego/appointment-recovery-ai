export interface AppEnvironment {
  appUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioMessagingServiceSid: string;
  twilioPhoneNumber: string;
}

export function getAppEnvironment(): AppEnvironment {
  return {
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID ?? '',
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN ?? '',
    twilioMessagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID ?? '',
    twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER ?? '',
  };
}
