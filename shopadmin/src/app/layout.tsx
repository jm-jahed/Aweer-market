import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AweerMarket — Operations Admin Portal',
  description: 'Market Operations Portal for Al Aweer wholesale vendor and listing management.'
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#f1f5f9', color: '#0f172a' }}>
        {children}
      </body>
    </html>
  );
}
