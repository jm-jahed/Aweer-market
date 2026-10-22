import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AweerMarket — Dubai Al Aweer Wholesale Fruits & Vegetables Marketplace',
  description: 'Public Marketplace and Buyer Portal for wholesale produce in Dubai Al Aweer market.'
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#f8fafc', color: '#0f172a' }}>
        {children}
      </body>
    </html>
  );
}
