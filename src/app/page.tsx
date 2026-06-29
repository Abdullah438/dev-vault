import { redirect } from 'next/navigation';
import { createServer, createAdminClient } from '@/lib/supabase/server';
import DashboardClient from './dashboard-client';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const supabase = await createServer();
  
  // Safely check if the user is authenticated
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/login');
  }

  let initialSecrets: any[] = [];
  
  try {
    const adminClient = createAdminClient();
    const { data } = await adminClient
      .from('secrets')
      .select('id, name, prefix, created_at, last_used_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
      
    initialSecrets = data || [];
  } catch (err) {
    console.error('Could not fetch initial secrets on SSR:', err);
    // Continue with empty list, client will handle fallback/error display
  }

  return <DashboardClient user={user} initialSecrets={initialSecrets} />;
}
