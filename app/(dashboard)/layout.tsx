'use client';

import Sidebar from '@/components/Sidebar';
import { useRequireAdmin } from '@/components/AuthProvider';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { loading, user, isAdminUser } = useRequireAdmin();

  // Show a full-screen loader while checking auth
  if (loading || !user || !isAdminUser) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F8F8FA' }}>
        <div className="flex items-center gap-3 text-gray-400">
          <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm font-medium">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen" style={{ background: '#F8F8FA' }}>
      <Sidebar />
      <main
        className="flex-1 min-h-screen overflow-auto"
        style={{ marginLeft: 240 }}
      >
        <div className="max-w-7xl mx-auto px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
