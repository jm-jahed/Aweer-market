'use client';

/**
 * AweerMarket — Dedicated Search Route (/search)
 * Wholesale produce search across all Al Aweer Central Market stalls.
 * Strictly guarantees Lowest Price 1st sorting with multi-stall comparison.
 */

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CategoryView } from '@/components/catalog/CategoryView';

function SearchPageContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || searchParams.get('search') || '';

  return (
    <CategoryView
      categorySlug="search"
      defaultTitle={query ? `Search: “${query}”` : 'Wholesale Produce Search'}
      defaultDescription={
        query
          ? `Wholesale produce matching “${query}” across verified Al Aweer Central Market stalls. Cheapest price first.`
          : 'Search fruits, vegetables, herbs, and greens across verified Al Aweer Central Market stalls.'
      }
      initialSearch={query}
    />
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: '80px 20px', textAlign: 'center', color: '#86efac' }}>
          <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🔍</div>
          <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>Loading Wholesale Search...</p>
        </div>
      }
    >
      <SearchPageContent />
    </Suspense>
  );
}
