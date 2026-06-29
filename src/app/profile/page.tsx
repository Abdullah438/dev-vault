import { redirect } from 'next/navigation';
import { createServer } from '@/lib/supabase/server';
import ProfileClient from './profile-client';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const supabase = await createServer();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/login');
  }

  return <ProfileClient user={user} />;
}
