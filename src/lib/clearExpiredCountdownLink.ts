import { supabase } from './supabase';

/** Nulls `countdown_link` after the card timer expires (SECURITY DEFINER RPC). */
export async function clearExpiredCountdownLink(eventId: string): Promise<void> {
  const id = (eventId || '').trim();
  if (!id) return;
  const { error } = await supabase.rpc('clear_expired_countdown_link', {
    p_event_id: id,
  });
  if (error) {
    console.warn('clear_expired_countdown_link failed', error.message);
  }
}
