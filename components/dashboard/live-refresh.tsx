'use client';

import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { getPublicSupabaseConfig } from '@/lib/supabase/config';

const watchedTables = ['appointments', 'customers', 'waitlists', 'recovery_opportunities'];

export function LiveDashboardRefresh({ businessId }: Readonly<{ businessId: string }>) {
  const router = useRouter();

  useEffect(() => {
    const { supabaseUrl, supabaseAnonKey } = getPublicSupabaseConfig();
    if (!supabaseUrl || !supabaseAnonKey) return;

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const channel = supabase.channel(`dashboard-live-${businessId}`);
    watchedTables.forEach((table) => {
      channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `business_id=eq.${businessId}` }, () => router.refresh());
    });
    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [businessId, router]);

  return null;
}
