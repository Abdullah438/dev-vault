import { redirect } from 'next/navigation';
import { createServer, createAdminClient } from '@/lib/supabase/server';
import DashboardClient from './dashboard-client';

export const dynamic = 'force-dynamic';

const SECRETS_PAGE_SIZE = 10;
const SYSTEM_SECRET_NAME = '__devvault_verification__';

export default async function HomePage() {
  const supabase = await createServer();

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/login');
  }

  let initialSecrets: Awaited<ReturnType<typeof fetchInitialSecrets>> = {
    data: [],
    total: 0,
    page: 1,
    limit: SECRETS_PAGE_SIZE,
    totalPages: 1,
    vaultTotal: 0,
  };

  try {
    initialSecrets = await fetchInitialSecrets(user.id);
  } catch (err) {
    console.error('Could not fetch initial secrets on SSR:', err);
  }

  return (
    <DashboardClient
      user={user}
      initialSecrets={initialSecrets.data}
      initialTotal={initialSecrets.total}
      initialVaultTotal={initialSecrets.vaultTotal}
      pageSize={SECRETS_PAGE_SIZE}
    />
  );
}

async function fetchInitialSecrets(userId: string) {
  const adminClient = createAdminClient();

  const [{ data, count, error }, { count: vaultTotal }] = await Promise.all([
    adminClient
      .from('secrets')
      .select('id, name, prefix, category, created_at, last_used_at', { count: 'exact' })
      .eq('user_id', userId)
      .neq('name', SYSTEM_SECRET_NAME)
      .order('created_at', { ascending: false })
      .range(0, SECRETS_PAGE_SIZE - 1),
    adminClient
      .from('secrets')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .neq('name', SYSTEM_SECRET_NAME),
  ]);

  if (error) throw error;

  const total = count ?? 0;

  return {
    data: data ?? [],
    total,
    page: 1,
    limit: SECRETS_PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / SECRETS_PAGE_SIZE)),
    vaultTotal: vaultTotal ?? 0,
  };
}
