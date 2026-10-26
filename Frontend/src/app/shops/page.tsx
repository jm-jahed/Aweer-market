'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { getShops, ShopPublicSummary } from '@/lib/api-client';

export default function ShopsDirectoryPage() {
  const [shops, setShops] = useState<ShopPublicSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchShops = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getShops();
      setShops(res?.shops || []);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to connect to marketplace server to load verified stalls.'
      );
      setShops([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchShops();
  }, [fetchShops]);

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 20px', minHeight: 'calc(100vh - 80px)' }}>
      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" style={{ display: 'flex', gap: 8, fontSize: '0.82rem', color: '#94a3b8', marginBottom: 20 }}>
        <Link href="/" style={{ color: '#86efac', textDecoration: 'none' }}>
          Home
        </Link>
        <span>/</span>
        <span style={{ color: '#ffffff', fontWeight: 600 }}>Wholesale Stalls</span>
      </nav>

      {/* Header Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0a2414 0%, #07170c 100%)',
          border: '1px solid rgba(34, 197, 94, 0.22)',
          borderRadius: 20,
          padding: 32,
          marginBottom: 28,
          boxShadow: '0 12px 36px rgba(0,0,0,0.4)'
        }}
      >
        <span
          style={{
            display: 'inline-block',
            background: 'rgba(34, 197, 94, 0.15)',
            border: '1px solid rgba(34, 197, 94, 0.35)',
            color: '#4ade80',
            fontSize: '0.72rem',
            fontWeight: 800,
            padding: '4px 12px',
            borderRadius: 9999,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: 10
          }}
        >
          Dubai Al Aweer Central Market
        </span>
        <h1 style={{ fontSize: '2.2rem', fontWeight: 800, color: '#ffffff', margin: '0 0 8px 0' }}>
          Verified Wholesale Stalls &amp; Vendors
        </h1>
        <p style={{ fontSize: '0.95rem', color: '#94a3b8', margin: 0, maxWidth: 720, lineHeight: 1.5 }}>
          Browse verified merchant stalls operating at the Dubai Fruits &amp; Vegetables Market in Al Aweer. Order directly with single-vendor wholesale isolation.
        </p>
      </div>

      {/* Content Area */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: '#86efac' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '14px' }}>🏬</div>
          <p style={{ fontSize: '1.05rem', fontWeight: 600 }}>Loading wholesale stalls directory...</p>
        </div>
      ) : error ? (
        <div
          style={{
            background: '#0e2415',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            borderRadius: 16,
            padding: '40px 24px',
            textAlign: 'center',
            color: '#f87171'
          }}
        >
          <div style={{ fontSize: '2rem', marginBottom: '12px' }}>⚠️</div>
          <h2 style={{ fontSize: '1.3rem', color: '#ffffff', margin: '0 0 8px 0' }}>
            Unable to Load Stalls
          </h2>
          <p style={{ color: '#94a3b8', maxWidth: '500px', margin: '0 auto 20px auto' }}>
            {error}
          </p>
          <button
            type="button"
            onClick={fetchShops}
            style={{
              background: '#16a34a',
              color: '#ffffff',
              border: 'none',
              padding: '10px 20px',
              borderRadius: 8,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Retry Connection
          </button>
        </div>
      ) : shops.length === 0 ? (
        <div
          style={{
            background: '#0e2415',
            border: '1px solid rgba(34, 197, 94, 0.2)',
            borderRadius: 16,
            padding: '60px 24px',
            textAlign: 'center',
            color: '#94a3b8'
          }}
        >
          <div style={{ fontSize: '2.5rem', marginBottom: '14px' }}>📦</div>
          <h2 style={{ fontSize: '1.3rem', color: '#ffffff', margin: '0 0 8px 0' }}>
            No Wholesale Stalls Currently Listed
          </h2>
          <p style={{ maxWidth: 500, margin: '0 auto 20px auto' }}>
            There are currently no approved wholesale stalls active in the directory. Please check back later or browse produce directly.
          </p>
          <Link
            href="/"
            style={{
              background: '#22c55e',
              color: '#052e16',
              padding: '10px 20px',
              borderRadius: 8,
              textDecoration: 'none',
              fontWeight: 700,
              display: 'inline-block'
            }}
          >
            Return to Marketplace
          </Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: 20 }}>
          {shops.map((s) => (
            <div
              key={s.id}
              style={{
                background: '#0e2415',
                border: '1px solid rgba(34, 197, 94, 0.18)',
                borderRadius: 20,
                padding: 24,
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ffffff', margin: '0 0 4px 0' }}>
                    {s.name}
                  </h2>
                  <div style={{ fontSize: '0.8rem', color: '#86efac', fontWeight: 600 }}>
                    📍 {s.stallNumber || 'Al Aweer Central Market'}
                  </div>
                </div>
                {s.isApproved && (
                  <span
                    style={{
                      background: 'rgba(34, 197, 94, 0.15)',
                      color: '#4ade80',
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      padding: '3px 8px',
                      borderRadius: 9999,
                      border: '1px solid rgba(34, 197, 94, 0.3)'
                    }}
                  >
                    ✓ VERIFIED
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.8rem', color: '#94a3b8' }}>
                <div>License: <strong style={{ color: '#cbd5e1' }}>{s.tradeLicenseNumber || 'TL-AWEER'}</strong></div>
                <div>Phone: <strong style={{ color: '#cbd5e1' }}>{s.phone || 'Available on request'}</strong></div>
              </div>

              <Link
                href={`/shops/${s.id}`}
                style={{
                  marginTop: 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  background: '#22c55e',
                  color: '#052e16',
                  textDecoration: 'none',
                  padding: '10px 16px',
                  borderRadius: 12,
                  fontWeight: 800,
                  fontSize: '0.85rem'
                }}
              >
                <span>Visit Stall Storefront</span>
                <span>→</span>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
