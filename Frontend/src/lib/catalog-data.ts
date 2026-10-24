export interface CatalogProduceItem {
  id: string;
  name: string;
  priceAedPerKg: number;
  badge: string;
  vendorName: string;
  stallId: string;
  rating: string;
  image: string;
  category: string;
  origin: string;
  unit: string;
  unitWeightKg: number;
}

export const ALL_MARKET_PRODUCTS: CatalogProduceItem[] = [
  // ONIONS - Sorted by cheapest first
  {
    id: 'prod_onion_red_local',
    name: 'Red Onion (Local Fresh)',
    priceAedPerKg: 2.40,
    badge: 'Best Price',
    vendorName: 'Al Noor Fresh Fruits',
    stallId: 'shop_alnoor_1',
    rating: '4.9 (340)',
    image: '/images/onion.jpg',
    category: 'vegetables',
    origin: 'Dubai Market',
    unit: 'bag',
    unitWeightKg: 10
  },
  {
    id: 'feat_onion_1',
    name: 'Onion (Fresh Yellow)',
    priceAedPerKg: 3.50,
    badge: 'Fresh',
    vendorName: 'Green Valley Herbs',
    stallId: 'shop_greenvalley_2',
    rating: '4.7 (180)',
    image: '/images/onion.jpg',
    category: 'vegetables',
    origin: 'Dubai Market',
    unit: 'crate',
    unitWeightKg: 10
  },
  {
    id: 'prod_onion_white_sweet',
    name: 'White Onion (Sweet Egyptian)',
    priceAedPerKg: 4.20,
    badge: 'Sweet',
    vendorName: 'Royal Fruits & Vegetables',
    stallId: 'shop_royalfruits_3',
    rating: '4.6 (190)',
    image: '/images/onion.jpg',
    category: 'vegetables',
    origin: 'Egypt',
    unit: 'sack',
    unitWeightKg: 12
  },
  {
    id: 'prod_onion_spring_green',
    name: 'Spring Onion (Green Bunches)',
    priceAedPerKg: 4.80,
    badge: 'Fresh Cut',
    vendorName: 'Fresh Zone Market',
    stallId: 'shop_freshzone_4',
    rating: '4.5 (110)',
    image: '/images/onion.jpg',
    category: 'herbs_greens',
    origin: 'Dubai Market',
    unit: 'box',
    unitWeightKg: 5
  },

  // TOMATOES - Sorted by cheapest first
  {
    id: 'feat_tomato_1',
    name: 'Tomato (Local Greenhouse)',
    priceAedPerKg: 2.75,
    badge: 'Best Price',
    vendorName: 'Al Noor Fresh Fruits',
    stallId: 'shop_alnoor_1',
    rating: '4.8 (320)',
    image: '/images/tomato.jpg',
    category: 'vegetables',
    origin: 'Dubai Market',
    unit: 'crate',
    unitWeightKg: 10
  },
  {
    id: 'prod_tomato_roma_jordan',
    name: 'Roma Plum Tomatoes',
    priceAedPerKg: 3.00,
    badge: 'Wholesale',
    vendorName: 'Emirates Fresh Fruits',
    stallId: 'shop_emirates_2',
    rating: '4.7 (240)',
    image: '/images/tomato.jpg',
    category: 'vegetables',
    origin: 'Jordan',
    unit: 'crate',
    unitWeightKg: 10
  },
  {
    id: 'prod_tomato_beef_dutch',
    name: 'Beef Tomatoes (Grade A)',
    priceAedPerKg: 3.80,
    badge: 'Quality',
    vendorName: 'Green Valley Herbs',
    stallId: 'shop_greenvalley_2',
    rating: '4.6 (140)',
    image: '/images/tomato.jpg',
    category: 'vegetables',
    origin: 'Netherlands',
    unit: 'box',
    unitWeightKg: 7
  },
  {
    id: 'prod_tomato_cherry_vine',
    name: 'Cherry Tomatoes (Sweet Vine)',
    priceAedPerKg: 5.50,
    badge: 'Premium',
    vendorName: 'Fresh Kingdom',
    stallId: 'shop_freshkingdom_5',
    rating: '4.9 (290)',
    image: '/images/tomato.jpg',
    category: 'vegetables',
    origin: 'UAE Hydroponic',
    unit: 'tray',
    unitWeightKg: 4
  },

  // POTATOES - Sorted by cheapest first
  {
    id: 'prod_potato_spunta_local',
    name: 'Potato (Spunta Local)',
    priceAedPerKg: 2.20,
    badge: 'Best Price',
    vendorName: 'Al Noor Fresh Fruits',
    stallId: 'shop_alnoor_1',
    rating: '4.8 (270)',
    image: '/images/potato.jpg',
    category: 'vegetables',
    origin: 'Dubai Market',
    unit: 'sack',
    unitWeightKg: 15
  },
  {
    id: 'feat_potato_1',
    name: 'Potato (New Crop Golden)',
    priceAedPerKg: 2.90,
    badge: 'Fresh',
    vendorName: 'Royal Fruits & Vegetables',
    stallId: 'shop_royalfruits_3',
    rating: '4.6 (210)',
    image: '/images/potato.jpg',
    category: 'vegetables',
    origin: 'Dubai Market',
    unit: 'crate',
    unitWeightKg: 10
  },
  {
    id: 'prod_potato_baby_salad',
    name: 'Baby Potatoes (Gourmet Salad)',
    priceAedPerKg: 4.50,
    badge: 'Gourmet',
    vendorName: 'Green Valley Herbs',
    stallId: 'shop_greenvalley_2',
    rating: '4.7 (120)',
    image: '/images/potato.jpg',
    category: 'vegetables',
    origin: 'Lebanon',
    unit: 'box',
    unitWeightKg: 6
  },

  // BANANAS - Sorted by cheapest first
  {
    id: 'prod_banana_cavendish_wholesale',
    name: 'Cavendish Bananas (Wholesale)',
    priceAedPerKg: 3.78,
    badge: 'Best Price',
    vendorName: 'Emirates Fresh Fruits',
    stallId: 'shop_emirates_2',
    rating: '4.7 (310)',
    image: '/images/banana.jpg',
    category: 'fresh_fruits',
    origin: 'Ecuador',
    unit: 'box',
    unitWeightKg: 18
  },
  {
    id: 'feat_banana_1',
    name: 'Banana (Premium Cluster)',
    priceAedPerKg: 4.50,
    badge: 'Quality',
    vendorName: 'Fresh Zone Market',
    stallId: 'shop_freshzone_4',
    rating: '4.5 (160)',
    image: '/images/banana.jpg',
    category: 'fresh_fruits',
    origin: 'Dubai Market',
    unit: 'box',
    unitWeightKg: 15
  },
  {
    id: 'prod_banana_organic_chiquita',
    name: 'Chiquita Organic Bananas',
    priceAedPerKg: 5.90,
    badge: 'Organic',
    vendorName: 'Fresh Kingdom',
    stallId: 'shop_freshkingdom_5',
    rating: '4.9 (180)',
    image: '/images/banana.jpg',
    category: 'fresh_fruits',
    origin: 'Costa Rica',
    unit: 'box',
    unitWeightKg: 12
  },

  // APPLES - Sorted by cheapest first
  {
    id: 'feat_apple_1',
    name: 'Apple (Royal Gala)',
    priceAedPerKg: 5.25,
    badge: 'Best Price',
    vendorName: 'Fresh Kingdom',
    stallId: 'shop_freshkingdom_5',
    rating: '4.8 (280)',
    image: '/images/apple.jpg',
    category: 'fresh_fruits',
    origin: 'South Africa',
    unit: 'carton',
    unitWeightKg: 18
  },
  {
    id: 'prod_apple_granny_smith',
    name: 'Green Apple (Granny Smith)',
    priceAedPerKg: 5.80,
    badge: 'Crisp',
    vendorName: 'Royal Fruits & Vegetables',
    stallId: 'shop_royalfruits_3',
    rating: '4.6 (160)',
    image: '/images/apple.jpg',
    category: 'fresh_fruits',
    origin: 'Poland',
    unit: 'carton',
    unitWeightKg: 18
  },
  {
    id: 'prod_apple_red_delicious',
    name: 'Red Delicious Apple (USA Washington)',
    priceAedPerKg: 6.20,
    badge: 'Premium',
    vendorName: 'Al Noor Fresh Fruits',
    stallId: 'shop_alnoor_1',
    rating: '4.7 (210)',
    image: '/images/apple.jpg',
    category: 'fresh_fruits',
    origin: 'USA',
    unit: 'carton',
    unitWeightKg: 19
  },

  // CARROTS & CITRUS
  {
    id: 'prod_citrus_valencia_oranges',
    name: 'Valencia Oranges (Juicing)',
    priceAedPerKg: 2.83,
    badge: 'Best Price',
    vendorName: 'Emirates Fresh Fruits',
    stallId: 'shop_emirates_2',
    rating: '4.8 (350)',
    image: '/images/tomato.jpg',
    category: 'citrus',
    origin: 'Egypt',
    unit: 'carton',
    unitWeightKg: 15
  },
  {
    id: 'prod_carrots_fresh_hydro',
    name: 'Fresh Carrots (Hydroponic Sweet)',
    priceAedPerKg: 3.20,
    badge: 'Best Price',
    vendorName: 'Green Valley Herbs',
    stallId: 'shop_greenvalley_2',
    rating: '4.8 (260)',
    image: '/images/carrots.jpg',
    category: 'vegetables',
    origin: 'Dubai Market',
    unit: 'bag',
    unitWeightKg: 10
  }
];

/**
 * Search marketplace produce with "CHEAP PRICE 1ST" guarantee:
 * Matches keyword against name, category, vendorName, or origin,
 * and sorts strictly ascending by equivalent AED per KG (lowest price first).
 */
export function searchProduce(query: string): CatalogProduceItem[] {
  if (!query || !query.trim()) {
    // Return all sorted by cheapest first
    return [...ALL_MARKET_PRODUCTS].sort((a, b) => a.priceAedPerKg - b.priceAedPerKg);
  }

  const q = query.toLowerCase().trim();
  const filtered = ALL_MARKET_PRODUCTS.filter((item) => {
    return (
      item.name.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.vendorName.toLowerCase().includes(q) ||
      item.origin.toLowerCase().includes(q)
    );
  });

  // CRITICAL: CHEAPEST PRICE 1ST
  return filtered.sort((a, b) => a.priceAedPerKg - b.priceAedPerKg);
}
