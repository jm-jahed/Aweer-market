import React from 'react';
import type { Metadata } from 'next';
import { CategoryView } from '@/components/catalog/CategoryView';

export const metadata: Metadata = {
  title: 'All Wholesale Produce Catalog — Dubai Al Aweer Market',
  description: 'Complete wholesale catalog of fruits, vegetables, and greens available from verified Al Aweer market stalls.',
  alternates: {
    canonical: '/products'
  }
};

export default function ProductsCatalogPage() {
  return (
    <CategoryView
      categorySlug="all"
      defaultTitle="All Wholesale Produce"
      defaultDescription="Browse the complete directory of fresh wholesale produce from verified stalls across Dubai Al Aweer market."
    />
  );
}
