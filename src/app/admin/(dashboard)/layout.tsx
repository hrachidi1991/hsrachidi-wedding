import { redirect } from 'next/navigation';
import { getSessionRole } from '@/lib/auth';
import AdminShell from '@/components/admin/AdminShell';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const role = await getSessionRole();
  if (!role) {
    redirect('/admin/login');
  }
  return <AdminShell role={role}>{children}</AdminShell>;
}
