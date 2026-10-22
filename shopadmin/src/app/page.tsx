export default function AdminHomePage() {
  return (
    <main style={{ maxWidth: '1000px', margin: '40px auto', padding: '0 20px' }}>
      <header style={{ borderBottom: '2px solid #0284c7', paddingBottom: '20px', marginBottom: '30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ margin: '0 0 8px 0', color: '#0369a1', fontSize: '1.8rem' }}>AweerMarket — Operations Admin</h1>
            <p style={{ margin: 0, color: '#475569', fontSize: '1rem' }}>
              Al Aweer Market Operations &amp; Vendor Management
            </p>
          </div>
          <span style={{ backgroundColor: '#e0f2fe', color: '#0369a1', padding: '6px 14px', borderRadius: '9999px', fontSize: '0.875rem', fontWeight: 600 }}>
            Port 3001
          </span>
        </div>
      </header>

      <section style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.25rem', marginTop: 0, color: '#0f172a' }}>Admin Portal Boundary &amp; Security Controls</h2>
        <ul style={{ color: '#334155', lineHeight: 1.7 }}>
          <li><strong>Role Level:</strong> Market Operations Admin (Scoped privileges only).</li>
          <li><strong>Isolation Rule:</strong> Admins <em>cannot</em> grant themselves Super Admin privileges or access platform-wide root settings.</li>
          <li><strong>Backend API:</strong> Authenticates against Fastify Central API at <code>http://localhost:4000/api/v1/auth/admin</code>.</li>
          <li><strong>Permitted Operations:</strong> Vendor application review, stall/shop listings, product moderation, order dispute review.</li>
        </ul>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '18px' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '1.05rem', color: '#0f172a' }}>Vendor Applications</h3>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>
            Review new Al Aweer wholesale stall trade licenses and vendor documents.
          </p>
        </div>
        <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '18px' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '1.05rem', color: '#0f172a' }}>Listing Moderation</h3>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>
            Audit wholesale fruit/vegetable listings to ensure fair pricing and accurate unit weights.
          </p>
        </div>
      </section>
    </main>
  );
}
