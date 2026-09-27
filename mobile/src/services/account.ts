import type { SupabaseClient } from '@supabase/supabase-js';

export async function requestAccountDeletion(client: SupabaseClient): Promise<string> {
  const result = await client.rpc('request_account_deletion');
  if (result.error) throw result.error;
  if (typeof result.data !== 'string' || Number.isNaN(Date.parse(result.data))) {
    throw new Error('INVALID_DELETION_RESPONSE');
  }
  return result.data;
}
