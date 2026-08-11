import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/components/AuthProvider';

export const metadata: Metadata = {
  title: 'Flock In — Admin Dashboard',
  description: 'School ASB Events Admin Dashboard',
  icons: {
    // 64px copy of the crest; the full-size one is 864px and would be a heavy
    // download for a favicon.
    icon: '/icon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
