export default function SuperAdminHomePage() {
  return (
    <main style={{ maxWidth: '1000px', margin: '40px auto', padding: '0 20px' }}>
      <header style={{ borderBottom: '2px solid #dc2626', paddingBottom: '20px', marginBottom: '30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ margin: '0 0 8px 0', color: '#ef4444', fontSize: '1.8rem' }}>AweerMarket — Super Admin</h1>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '1rem' }}>
              Platform Owner Governance &amp; Security Controls
            </p>
          </div>
          <span style={{ backgroundColor: '#450a0a', color: '#fca5a5', border: '1px solid #7f1d1d', padding: '6px 14px', borderRadius: '9999px', fontSize: '0.875rem', fontWeight: 600 }}>
            Port 3002 (MFA Required)
          </span>
        </div>
      </header>

      <section style={{ backgroundColor: '#131b2e', borderRadius: '12px', padding: '24px', border: '1px solid #1e293b', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.25rem', marginTop: 0, color: '#f8fafc' }}>Governance &amp; Privileged Access Boundary</h2>
        <ul style={{ color: '#cbd5e1', lineHeight: 1.7 }}>
          <li><strong>Role Level:</strong> Platform Super Admin (Highest Authorization).</li>
          <li><strong>Zero Self-Service:</strong> No public registration endpoint exists or will ever be permitted for this portal.</li>
          <li><strong>Strong Authentication:</strong> Requires secondary factor (MFA/TOTP) and isolated cryptographic signing secret.</li>
          <li><strong>Platform Governance:</strong> Provisioning Authorized Admin accounts, setting wholesale commission fees, viewing platform-wide immutable audit logs.</li>
        </ul>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '10px', padding: '18px' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '1.05rem', color: '#f1f5f9' }}>Admin Account Provisioning</h3>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#94a3b8' }}>
            Only explicit Super Admin sessions can create, suspend, or revoke Market Operations Admin credentials.
          </p>
        </div>
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '10px', padding: '18px' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '1.05rem', color: '#f1f5f9' }}>Commission &amp; Settlements</h3>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#94a3b8' }}>
            Set global commission rates for Al Aweer wholesale categories and monitor vendor settlements.
          </p>
        </div>
      </section>
    </main>
  );
}
