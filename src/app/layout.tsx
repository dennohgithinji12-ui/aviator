import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';

export const metadata: Metadata = {
  title: 'ShiftStack Aviator - Official Spribe Crash Simulator',
  description: 'ShiftStack Aviator: Real-time crash flight engine, phone number login with Firebase Spark Plan, 49 Bob minimum deposit with PayHero API',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
