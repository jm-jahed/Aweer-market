export default function WebHomePage() {
  return (
    <main style={{ maxWidth: '1100px', margin: '40px auto', padding: '0 20px' }}>
      <header style={{ borderBottom: '2px solid #22c55e', paddingBottom: '20px', marginBottom: '30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ margin: '0 0 8px 0', color: '#15803d', fontSize: '2rem' }}>AweerMarket</h1>
            <p style={{ margin: 0, color: '#475569', fontSize: '1.05rem' }}>
              Dubai Al Aweer Wholesale Fruits &amp; Vegetables Marketplace
            </p>
          </div>
          <span style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '6px 14px', borderRadius: '9999px', fontSize: '0.875rem', fontWeight: 600 }}>
            Public Marketplace &amp; Buyer Portal
          </span>
        </div>
      </header>

      <section style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.25rem', marginTop: 0, color: '#0f172a' }}>Application Scope &amp; Architecture (Phase 1)</h2>
        <ul style={{ color: '#334155', lineHeight: 1.7 }}>
          <li><strong>Application Path:</strong> <code>Frontend</code> (Port 3100)</li>
          <li><strong>Backend Connection:</strong> Fastify Central API at <code>http://localhost:4000/api/v1</code></li>
          <li><strong>Database Access:</strong> Strictly isolated through backend API (No direct MongoDB access).</li>
          <li><strong>Core Purpose:</strong> Public catalog discovery, lowest wholesale price first, single-vendor checkout, buyer order tracking.</li>
        </ul>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        <div style={{ backgroundColor: '#f1f5f9', borderRadius: '10px', padding: '18px' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '1.05rem', color: '#0f172a' }}>Wholesale Price Comparison</h3>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>
            Products are indexed with unit equivalent pricing (AED per Kg) to surface the best wholesale rates across Al Aweer stalls.
          </p>
        </div>
        <div style={{ backgroundColor: '#f1f5f9', borderRadius: '10px', padding: '18px' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '1.05rem', color: '#0f172a' }}>Buyer Account &amp; Orders</h3>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>
            Dedicated buyer authentication and single-vendor cart checkout with delivery or stall pickup.
          </p>
        </div>
      </section>
    </main>
  );
}
