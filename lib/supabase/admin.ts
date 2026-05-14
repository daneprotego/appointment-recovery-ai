import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { getAppEnvironment } from '@/lib/types/env';

let cachedClient: SupabaseClient | null = null;

export function getSupabaseAdminClient(): SupabaseClient {
  if (cachedClient) {
    return cachedClient;
  }

  const env = getAppEnvironment();

  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable.');
  }

  cachedClient = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return cachedClient;
}
