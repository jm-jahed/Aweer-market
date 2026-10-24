import type { Metadata } from 'next';
import { CategoryView } from '@/components/catalog/CategoryView';

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const formatted = slug.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    title: `${formatted} Wholesale — Dubai Al Aweer Market`,
    description: `Buy wholesale ${formatted} directly from verified vendors at Dubai Fruits & Vegetables Market Al Aweer.`,
    alternates: {
      canonical: `/categories/${slug}`
    }
  };
}

export default async function DynamicCategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  return <CategoryView categorySlug={slug} />;
}
