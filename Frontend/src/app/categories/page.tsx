import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import styles from './Categories.module.css';

export const metadata: Metadata = {
  title: 'Wholesale Produce Categories — Dubai Al Aweer Market',
  description: 'Explore all wholesale fruits, vegetables, citrus, greens, and spices available directly from verified Al Aweer market vendors.',
  alternates: {
    canonical: '/categories'
  }
};

import { CategoriesList } from './CategoriesList';

export default function CategoriesDirectoryPage() {
  return (
    <div className={styles.container}>
      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className={styles.breadcrumbs}>
        <Link href="/" className={styles.breadcrumbLink}>
          Home
        </Link>
        <span className={styles.breadcrumbSep}>/</span>
        <span className={styles.breadcrumbCurrent}>Categories</span>
      </nav>

      {/* Header Banner */}
      <header className={styles.headerBanner}>
        <div className={styles.headerTop}>
          <span className={styles.headerBadge}>
            <span className={styles.headerBadgeDot} />
            Dubai Al Aweer Central Market
          </span>
          <span className={styles.headerLotBadge}>Daily Wholesale Lots</span>
        </div>
        <h1 className={styles.headerTitle}>Wholesale Produce Categories</h1>
        <p className={styles.headerSub}>
          Select a category to browse live inventory, multi-stall price comparisons, and order directly from verified Al Aweer wholesale vendors.
        </p>

        <div className={styles.marketStatsBar}>
          <div className={styles.statItem}>
            <span className={styles.statDot} />
            <span>Multi-Stall Price Comparison</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statDot} />
            <span>Guaranteed Lowest Price First</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statDot} />
            <span>Direct Market Stall Pickups</span>
          </div>
        </div>
      </header>

      {/* Dynamic Category Grid */}
      <CategoriesList />
    </div>
  );
}
