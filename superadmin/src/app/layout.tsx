import type { Metadata } from 'next';
import { SuperAdminAuthProvider } from '../lib/auth-context';

export const metadata: Metadata = {
  title: 'AweerMarket — Super Admin Portal (Platform Owner)',
  description: 'Platform Owner Portal with strict MFA and governance controls.',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' }
    ],
    shortcut: '/favicon.svg',
    apple: '/favicon.svg'
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
      </head>
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#090d16', color: '#f8fafc' }}>
        <SuperAdminAuthProvider>
          {children}
        </SuperAdminAuthProvider>
      </body>
    </html>
  );
}
