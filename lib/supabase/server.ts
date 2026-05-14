import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { requirePublicSupabaseConfig } from '@/lib/supabase/config';

export async function createSupabaseServerClient() {
  const { supabaseUrl, supabaseAnonKey } = requirePublicSupabaseConfig();
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      },
    },
  });
}

export async function createReadOnlySupabaseServerClient() {
  const { supabaseUrl, supabaseAnonKey } = requirePublicSupabaseConfig();
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
    },
  });
}
