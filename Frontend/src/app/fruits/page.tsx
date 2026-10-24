import type { Metadata } from 'next';
import { CategoryView } from '@/components/catalog/CategoryView';

export const metadata: Metadata = {
  title: 'Fresh Fruits Wholesale — Dubai Al Aweer Market',
  description: 'Bulk wholesale bananas, apples, oranges, and seasonal fruits directly from verified Al Aweer market stalls in Dubai, UAE.',
  alternates: {
    canonical: '/fruits'
  }
};

export default function FruitsPage() {
  return <CategoryView categorySlug="fruits" defaultTitle="Fresh Wholesale Fruits" />;
}
