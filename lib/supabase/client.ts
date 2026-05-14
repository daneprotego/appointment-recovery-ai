'use client';

import { createBrowserClient } from '@supabase/ssr';

import { requirePublicSupabaseConfig } from '@/lib/supabase/config';

export function createSupabaseBrowserClient() {
  const { supabaseUrl, supabaseAnonKey } = requirePublicSupabaseConfig();

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
