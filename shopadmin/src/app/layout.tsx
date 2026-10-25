import type { Metadata } from 'next';
import { ShopAdminAuthProvider } from '../lib/auth-context';

export const metadata: Metadata = {
  title: 'AweerMarket — Shop Admin Portal (Al Aweer Vendors)',
  description: 'Wholesale Stall Management for Al Aweer Central Fruit & Vegetable Market vendors.',
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
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#f8fafc', color: '#0f172a' }}>
        <ShopAdminAuthProvider>
          {children}
        </ShopAdminAuthProvider>
      </body>
    </html>
  );
}
