import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import type { CommunicationDirection, CommunicationEvent, CommunicationEventType, Json } from '@/lib/types/database';

export interface RecordCommunicationEventInput {
  businessId: string;
  customerId: string;
  appointmentId?: string | null;
  reminderId?: string | null;
  channel: 'sms' | 'email' | 'voice' | 'system';
  direction: CommunicationDirection;
  eventType: CommunicationEventType;
  body?: string | null;
  providerMessageId?: string | null;
  metadata?: Json;
  occurredAt?: Date;
}

export async function recordCommunicationEvent(input: RecordCommunicationEventInput): Promise<CommunicationEvent> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('communication_events')
    .insert({
      business_id: input.businessId,
      customer_id: input.customerId,
      appointment_id: input.appointmentId ?? null,
      reminder_id: input.reminderId ?? null,
      channel: input.channel,
      direction: input.direction,
      event_type: input.eventType,
      body: input.body ?? null,
      provider_message_id: input.providerMessageId ?? null,
      occurred_at: (input.occurredAt ?? new Date()).toISOString(),
      metadata: input.metadata ?? {},
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(`Unable to record communication event: ${error.message}`);
  }

  return data as CommunicationEvent;
}

export async function getCustomerCommunicationTimeline(customerId: string, businessId: string): Promise<CommunicationEvent[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('communication_events')
    .select('*')
    .eq('customer_id', customerId)
    .eq('business_id', businessId)
    .order('occurred_at', { ascending: false });

  if (error) {
    throw new Error(`Unable to load communication timeline: ${error.message}`);
  }

  return (data ?? []) as CommunicationEvent[];
}
