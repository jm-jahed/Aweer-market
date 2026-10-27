'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { getCategories, CategoryItem } from '@/lib/api-client';
import { resolveCategoryImage } from '@/lib/catalog-utils';
import styles from './Categories.module.css';

export function CategoriesList() {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getCategories();
      setCategories(res.categories || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load wholesale categories.';
      setError(msg);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const getCategoryHref = (slug: string) => {
    const s = slug.toLowerCase();
    if (s === 'fruits' || s === 'fresh_fruits') return '/fruits';
    if (s === 'vegetables' || s === 'fresh_vegetables') return '/vegetables';
    return `/categories/${encodeURIComponent(slug)}`;
  };

  if (loading) {
    return (
      <div className={styles.categoryGrid}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className={styles.categoryCard}
            style={{
              minHeight: 380,
              opacity: 0.6,
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <div style={{ height: 210, background: '#071b0e' }} />
            <div style={{ padding: 22, flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ width: '50%', height: 24, background: '#10331b', borderRadius: 8 }} />
              <div style={{ width: '85%', height: 16, background: '#0e2b17', borderRadius: 6 }} />
              <div style={{ width: '70%', height: 16, background: '#0e2b17', borderRadius: 6 }} />
              <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', paddingTop: 14 }}>
                <div style={{ width: '30%', height: 18, background: '#10331b', borderRadius: 6 }} />
                <div style={{ width: '35%', height: 32, background: '#133a1e', borderRadius: 10 }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 20,
          padding: '32px 36px',
          textAlign: 'center',
          color: '#fca5a5'
        }}
      >
        <div style={{ fontSize: '2rem', marginBottom: 10 }}>⚠️</div>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 8px 0', color: '#ffffff' }}>
          Unable to Load Categories
        </h3>
        <p style={{ fontSize: '0.9rem', margin: '0 0 18px 0', color: '#94a3b8' }}>
          {error}
        </p>
        <button
          type="button"
          onClick={fetchCategories}
          style={{
            background: '#22c55e',
            color: '#052010',
            fontWeight: 800,
            padding: '10px 24px',
            borderRadius: 10,
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.88rem'
          }}
        >
          Try Again
        </button>
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div
        style={{
          background: '#0a1a0f',
          border: '1px solid rgba(34, 197, 94, 0.15)',
          borderRadius: 20,
          padding: '48px 24px',
          textAlign: 'center',
          color: '#94a3b8'
        }}
      >
        <p>No active produce categories found at this time.</p>
      </div>
    );
  }

  return (
    <div className={styles.categoryGrid}>
      {categories.map((cat) => {
        const slug = cat.slug || cat.key;
        const name = cat.name || cat.label;
        const icon = cat.icon || '📦';
        const image = resolveCategoryImage(name, slug, cat.bannerUrl);
        const desc = cat.description || 'Verified wholesale produce direct from Al Aweer Central Market stalls.';
        const href = getCategoryHref(slug);

        return (
          <Link key={slug} href={href} className={styles.categoryCard}>
            <div className={styles.cardImgWrap}>
              <img src={image} alt={name} className={styles.cardImg} loading="lazy" />
              <div className={styles.imageOverlay} />

              {/* Floating Top Badges */}
              <div className={styles.floatingBadges}>
                <div className={styles.categoryTagPill}>
                  <span className={styles.categoryTagIcon}>{icon}</span>
                  <span className={styles.categoryTagName}>{name}</span>
                </div>
                <div className={styles.liveBadge}>
                  <span className={styles.livePulse} />
                  <span>Wholesale Lots</span>
                </div>
              </div>
            </div>

            <div className={styles.cardBody}>
              <div className={styles.cardMain}>
                <div className={styles.cardTitleRow}>
                  <h2 className={styles.cardTitle}>{name}</h2>
                  <span className={styles.marketOriginBadge}>Al Aweer Direct</span>
                </div>
                <p className={styles.cardDesc}>{desc}</p>
              </div>

              {/* Feature Chips */}
              <div className={styles.featurePills}>
                <span className={styles.featurePill}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  Verified Stalls
                </span>
                <span className={styles.featurePill}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                  Daily Fresh
                </span>
                <span className={styles.featurePill}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                  Lowest Price
                </span>
              </div>

              {/* Card Footer / CTA */}
              <div className={styles.cardFooter}>
                <span className={styles.footerMarketNote}>Bulk & Wholesale Supply</span>
                <div className={styles.ctaButton}>
                  <span>Explore Category</span>
                  <span className={styles.ctaArrow}>→</span>
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
