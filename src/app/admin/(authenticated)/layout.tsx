import AdminLayout from '@/components/layout/AdminLayout/AdminLayout';
import { AdminProvider } from '@/contexts/AdminContext';

export default function Layout({ children }: { children: React.ReactNode }) {
    return (
        <AdminProvider>
            <AdminLayout>{children}</AdminLayout>
        </AdminProvider>
    );
}
