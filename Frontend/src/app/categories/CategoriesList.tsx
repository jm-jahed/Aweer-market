'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { getCategories, CategoryItem } from '@/lib/api-client';
import { resolveProduceImage } from '@/lib/catalog-utils';
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
              minHeight: 280,
              opacity: 0.5,
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <div style={{ height: 160, background: '#0a1a0f' }} />
            <div style={{ padding: 18, flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ width: '60%', height: 20, background: '#13351d', borderRadius: 4 }} />
              <div style={{ width: '90%', height: 14, background: '#13351d', borderRadius: 4 }} />
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
          borderRadius: 16,
          padding: '24px 32px',
          textAlign: 'center',
          color: '#fca5a5'
        }}
      >
        <div style={{ fontSize: '1.8rem', marginBottom: 8 }}>⚠️</div>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 6px 0', color: '#ffffff' }}>
          Unable to Load Categories
        </h3>
        <p style={{ fontSize: '0.88rem', margin: '0 0 16px 0', color: '#94a3b8' }}>
          {error}
        </p>
        <button
          type="button"
          onClick={fetchCategories}
          style={{
            background: '#22c55e',
            color: '#052010',
            fontWeight: 700,
            padding: '8px 20px',
            borderRadius: 8,
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.85rem'
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
          borderRadius: 16,
          padding: '40px 24px',
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
        const image = cat.bannerUrl || resolveProduceImage(name, slug);
        const desc = cat.description || 'Verified wholesale produce from Dubai Al Aweer Central Market.';
        const href = getCategoryHref(slug);

        return (
          <Link key={slug} href={href} className={styles.categoryCard}>
            <div className={styles.cardImgWrap}>
              <img src={image} alt={name} className={styles.cardImg} />
              <div className={styles.iconAvatar}>{icon}</div>
            </div>
            <div className={styles.cardBody}>
              <div className={styles.cardTopRow}>
                <h2 className={styles.cardTitle}>{name}</h2>
                <span className={styles.unitsTag}>Wholesale Lots</span>
              </div>
              <p className={styles.cardDesc}>{desc}</p>
              <div className={styles.cardFooter}>
                <span className={styles.itemCountText}>Direct Stalls</span>
                <span className={styles.arrowLink}>Browse Category →</span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
