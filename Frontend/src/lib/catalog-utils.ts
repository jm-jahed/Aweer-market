import { ProductCategory } from '@aweermarket/types';

/**
 * Normalizes frontend URL slugs to backend ProductCategory enum.
 * Supports legacy slugs like /fruits -> fresh_fruits, /vegetables -> fresh_vegetables.
 */
export function mapSlugToBackendCategory(slug?: string): ProductCategory | undefined {
  if (!slug) return undefined;
  const s = slug.toLowerCase().trim();
  if (s === 'all' || s === 'search' || s === '') return undefined;

  switch (s) {
    case 'fruits':
    case 'fresh_fruits':
      return ProductCategory.FRESH_FRUITS;
    case 'vegetables':
    case 'fresh_vegetables':
      return ProductCategory.FRESH_VEGETABLES;
    case 'citrus':
      return ProductCategory.CITRUS;
    case 'leafy_greens':
    case 'herbs_greens':
    case 'herbs':
      return ProductCategory.LEAFY_GREENS;
    case 'exotic_produce':
    case 'spices':
      return ProductCategory.EXOTIC_PRODUCE;
    case 'berries':
      return ProductCategory.BERRIES;
    case 'root_vegetables':
      return ProductCategory.ROOT_VEGETABLES;
    default: {
      // Check if matches enum directly
      const valid = Object.values(ProductCategory) as string[];
      if (valid.includes(s)) {
        return s as ProductCategory;
      }
      return undefined;
    }
  }
}

/**
 * Metadata configuration for category banners and display cards.
 */
export const CATEGORY_DISPLAY_CONFIG: Record<
  string,
  { title: string; description: string; badge: string; icon: string }
> = {
  search: {
    title: 'Wholesale Produce Search',
    description: 'Live inventory across verified Al Aweer Central Market stalls. Guaranteed lowest price first.',
    badge: 'Search Results',
    icon: '🔍'
  },
  all: {
    title: 'All Wholesale Produce',
    description: 'Explore verified wholesale produce crates and cartons available today directly from Al Aweer market stalls.',
    badge: 'Directory • All Categories',
    icon: '📦'
  },
  fruits: {
    title: 'Fresh Wholesale Fruits',
    description: 'Direct wholesale crates of premium imported and regional fruits from verified Al Aweer stalls.',
    badge: 'Category • Fresh Fruits',
    icon: '🍎'
  },
  fresh_fruits: {
    title: 'Fresh Wholesale Fruits',
    description: 'Direct wholesale crates of premium imported and regional fruits from verified Al Aweer stalls.',
    badge: 'Category • Fresh Fruits',
    icon: '🍎'
  },
  vegetables: {
    title: 'Fresh Wholesale Vegetables',
    description: 'Bulk potatoes, onions, tomatoes, and greenhouse produce harvested daily for commercial kitchens and grocers.',
    badge: 'Category • Fresh Vegetables',
    icon: '🥦'
  },
  fresh_vegetables: {
    title: 'Fresh Wholesale Vegetables',
    description: 'Bulk potatoes, onions, tomatoes, and greenhouse produce harvested daily for commercial kitchens and grocers.',
    badge: 'Category • Fresh Vegetables',
    icon: '🥦'
  },
  citrus: {
    title: 'Wholesale Citrus Produce',
    description: 'Valencia oranges, lemons, limes, and grapefruits sorted for high commercial yield and freshness.',
    badge: 'Category • Citrus',
    icon: '🍊'
  },
  leafy_greens: {
    title: 'Leafy Greens & Fresh Herbs',
    description: 'Farm-fresh coriander, mint, parsley, and seasonal herbs bundled in commercial wholesale lots.',
    badge: 'Category • Herbs & Greens',
    icon: '🌿'
  },
  herbs_greens: {
    title: 'Leafy Greens & Fresh Herbs',
    description: 'Farm-fresh coriander, mint, parsley, and seasonal herbs bundled in commercial wholesale lots.',
    badge: 'Category • Herbs & Greens',
    icon: '🌿'
  },
  exotic_produce: {
    title: 'Exotic Produce & Spices',
    description: 'Wholesale ginger, garlic, green chilies, and imported authentic regional culinary spices.',
    badge: 'Category • Exotic & Spices',
    icon: '🌶️'
  },
  spices: {
    title: 'Exotic Produce & Spices',
    description: 'Wholesale ginger, garlic, green chilies, and imported authentic regional culinary spices.',
    badge: 'Category • Exotic & Spices',
    icon: '🌶️'
  },
  berries: {
    title: 'Wholesale Fresh Berries',
    description: 'Strawberries, blueberries, blackberries, and raspberries packed in temperature-controlled wholesale flats.',
    badge: 'Category • Berries',
    icon: '🍓'
  },
  root_vegetables: {
    title: 'Wholesale Root Vegetables',
    description: 'Commercial sacks of carrots, beets, turnips, and radishes sourced fresh from Al Aweer stalls.',
    badge: 'Category • Root Vegetables',
    icon: '🥕'
  }
};

/**
 * Resolves category banner photography: prioritizes custom uploaded banner,
 * falling back to dedicated high-definition commercial photography.
 */
export function resolveCategoryImage(name: string, slug?: string, bannerUrl?: string): string {
  if (bannerUrl && typeof bannerUrl === 'string' && bannerUrl.trim().length > 0) {
    return bannerUrl.trim();
  }

  const n = (name || '').toLowerCase();
  const s = (slug || '').toLowerCase();

  if (s.includes('fruit') || n.includes('fruit') || s.includes('berries') || n.includes('berries')) {
    return '/images/category-fruits.jpg';
  }
  if (s.includes('vegetable') || n.includes('vegetable')) {
    return '/images/category-vegetables.jpg';
  }
  if (
    s.includes('leaf') ||
    n.includes('leaf') ||
    s.includes('herb') ||
    n.includes('herb') ||
    n.includes('greens') ||
    s.includes('greens') ||
    n.includes('coriander') ||
    n.includes('mint') ||
    n.includes('spinach')
  ) {
    return '/images/category-leaf.jpg';
  }
  if (s.includes('root') || n.includes('root') || n.includes('carrot')) {
    return '/images/carrots.jpg';
  }
  if (s.includes('citrus') || n.includes('citrus') || n.includes('orange') || n.includes('lemon')) {
    return '/images/category-fruits.jpg';
  }
  return '/images/category-vegetables.jpg';
}

/**
 * Resolves produce food photography: prioritizes vendor uploaded image,
 * falling back to deterministic keyword matching.
 */
export function resolveProduceImage(name: string, category?: string, imageUrl?: string): string {
  if (imageUrl && typeof imageUrl === 'string' && imageUrl.trim().length > 0) {
    return imageUrl.trim();
  }

  const n = (name || '').toLowerCase();
  const c = (category || '').toLowerCase();

  if (n.includes('tomato')) return '/images/tomato.jpg';
  if (n.includes('onion')) return '/images/onion.jpg';
  if (n.includes('potato')) return '/images/potato.jpg';
  if (n.includes('banana')) return '/images/banana.jpg';
  if (n.includes('apple')) return '/images/apple.jpg';
  if (n.includes('carrot') || c.includes('root')) return '/images/carrots.jpg';
  if (c.includes('leafy') || c.includes('herb') || n.includes('herb') || n.includes('coriander') || n.includes('mint')) {
    return '/images/carrots.jpg';
  }
  if (n.includes('orange') || n.includes('citrus') || n.includes('lemon') || n.includes('lime') || c.includes('fruit')) {
    return '/images/category-fruits.jpg';
  }
  if (c.includes('veg')) {
    return '/images/category-vegetables.jpg';
  }
  return '/images/hero-basket.jpg';
}

