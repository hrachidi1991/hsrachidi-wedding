import { redirect } from 'next/navigation';
import { isAdminAuthenticated } from '@/lib/auth';
import AdminShell from '@/components/admin/AdminShell';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const authenticated = await isAdminAuthenticated();
  if (!authenticated) {
    redirect('/admin/login');
  }
  return <AdminShell>{children}</AdminShell>;
}
