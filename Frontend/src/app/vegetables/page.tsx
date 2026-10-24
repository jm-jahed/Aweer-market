import type { Metadata } from 'next';
import { CategoryView } from '@/components/catalog/CategoryView';

export const metadata: Metadata = {
  title: 'Fresh Vegetables Wholesale — Dubai Al Aweer Market',
  description: 'Bulk wholesale potatoes, onions, tomatoes, and greenhouse produce harvested daily for commercial kitchens and grocers in Dubai, UAE.',
  alternates: {
    canonical: '/vegetables'
  }
};

export default function VegetablesPage() {
  return <CategoryView categorySlug="vegetables" defaultTitle="Fresh Wholesale Vegetables" />;
}
