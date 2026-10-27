'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { getCategories, CategoryItem } from '@/lib/api-client';
import styles from './Categories.module.css';

const DEFAULT_CATEGORIES: CategoryItem[] = [
  { id: 'fresh_fruits', key: 'fresh_fruits', name: 'Fruits', label: 'Fruits', slug: 'fresh_fruits', icon: '🍎' },
  { id: 'fresh_vegetables', key: 'fresh_vegetables', name: 'Vegetables', label: 'Vegetables', slug: 'fresh_vegetables', icon: '🥦' },
  { id: 'leafy_greens', key: 'leafy_greens', name: 'Leaf', label: 'Leaf', slug: 'leafy_greens', icon: '🌿' }
];

export function CategoriesList() {
  const [categories, setCategories] = useState<CategoryItem[]>(DEFAULT_CATEGORIES);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = async () => {
    try {
      setError(null);
      const res = await getCategories();
      if (res.categories && res.categories.length > 0) {
        setCategories(res.categories);
      }
    } catch (err: unknown) {
      console.error('Failed to load categories:', err);
      // Keep DEFAULT_CATEGORIES on error so UI never breaks
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

  return (
    <div className={styles.categoryGrid}>
      {categories.map((cat) => {
        const slug = cat.slug || cat.key;
        const name = cat.name || cat.label;
        const icon = cat.icon || (
          slug.toLowerCase().includes('fruit') ? '🍎' :
          slug.toLowerCase().includes('veg') ? '🥦' :
          slug.toLowerCase().includes('leaf') ? '🌿' : '📦'
        );
        const desc = cat.description || 'Verified wholesale produce direct from Al Aweer Central Market stalls.';
        const href = getCategoryHref(slug);

        return (
          <Link key={slug} href={href} className={styles.categoryCard}>
            {/* Card Header */}
            <div className={styles.cardTop}>
              <div className={styles.iconCircle}>{icon}</div>
              <span className={styles.cardOriginBadge}>Al Aweer Direct</span>
            </div>

            {/* Card Body */}
            <div className={styles.cardBody}>
              <h2 className={styles.cardTitle}>{name}</h2>
              <p className={styles.cardDesc}>{desc}</p>
            </div>

            {/* Card Footer */}
            <div className={styles.cardFooter}>
              <span className={styles.featureNote}>✓ Stalls Direct</span>
              <div className={styles.ctaBtn}>
                <span>Explore</span>
                <span>→</span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
