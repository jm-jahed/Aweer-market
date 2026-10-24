import { hashPassword } from './utils/crypto.js';
import { createSuperAdminUser, createShopAdminUser, createBuyerUser, findUserByEmail } from './models/user.model.js';
import { createShop } from './models/shop.model.js';
import { createProduct } from './models/product.model.js';
import { ProductCategory, WholesaleUnit } from '@aweermarket/types';

export async function seedDemoData(): Promise<void> {
  const existingAdmin = await findUserByEmail('superadmin@aweermarket.ae');
  if (existingAdmin) {
    return; // Already seeded
  }

  console.log('[Seed] Seeding initial AweerMarket wholesale marketplace data...');

  // 1. Super Admin
  const adminPass = await hashPassword('SuperAdmin123!');
  await createSuperAdminUser({
    email: 'superadmin@aweermarket.ae',
    passwordHash: adminPass,
    fullName: 'Aweer Market Super Admin'
  });

  // 2. Verified Wholesale Stalls & Shop Admins
  const vendorPass = await hashPassword('Vendor123!');

  // Stall A: Al Aweer Premium Produce LLC
  const shopA = await createShop({
    name: 'Al Aweer Premium Produce LLC',
    stallNumber: 'Block A, Stall 15',
    ownerId: 'owner_stall_a15',
    tradeLicenseNumber: 'TL-554433',
    phone: '+971505556677',
    isApproved: true,
    isActive: true
  });

  await createShopAdminUser({
    email: 'vendor@alaweer.ae',
    passwordHash: vendorPass,
    fullName: 'Ahmed Al Marzooqi',
    shopId: shopA.id,
    businessName: 'Al Aweer Premium Produce LLC',
    phone: '+971505556677',
    tradeLicenseNumber: 'TL-554433'
  });

  // Stall B: Emirates Fresh Fruits & Veg Trading
  const shopB = await createShop({
    name: 'Emirates Fresh Fruits & Veg Trading',
    stallNumber: 'Block B, Stall 08',
    ownerId: 'owner_stall_b08',
    tradeLicenseNumber: 'TL-998877',
    phone: '+971508889900',
    isApproved: true,
    isActive: true
  });

  await createShopAdminUser({
    email: 'emiratesfresh@alaweer.ae',
    passwordHash: vendorPass,
    fullName: 'Tariq Al Mansoori',
    shopId: shopB.id,
    businessName: 'Emirates Fresh Fruits & Veg Trading',
    phone: '+971508889900',
    tradeLicenseNumber: 'TL-998877'
  });

  // 3. Registered Buyer
  const buyerPass = await hashPassword('Buyer123!');
  await createBuyerUser({
    email: 'buyer@alrashid.ae',
    passwordHash: buyerPass,
    fullName: 'Rashid Al Nuaimi',
    phone: '+971509998877',
    businessName: 'Al Rashid Catering Services LLC',
    tradeLicenseNumber: 'TL-112233'
  });

  // 4. Multi-Vendor Wholesale Produce Listings
  await createProduct({
    name: 'Valencia Oranges',
    category: ProductCategory.CITRUS,
    originCountry: 'Egypt',
    description: 'Fresh Grade A Valencia juicing oranges. Sweet, juicy and rich in vitamin C.',
    offers: [
      {
        shopId: shopA.id,
        shopName: shopA.name,
        stallNumber: shopA.stallNumber,
        unit: WholesaleUnit.CARTON,
        unitWeightKg: 15,
        priceAed: 45,
        minOrderQuantity: 5,
        availableStock: 120,
        isActive: true
      },
      {
        shopId: shopB.id,
        shopName: shopB.name,
        stallNumber: shopB.stallNumber,
        unit: WholesaleUnit.CARTON,
        unitWeightKg: 15,
        priceAed: 42.5,
        minOrderQuantity: 10,
        availableStock: 80,
        isActive: true
      }
    ]
  });

  await createProduct({
    name: 'Cavendish Bananas',
    category: ProductCategory.FRESH_FRUITS,
    originCountry: 'Ecuador',
    description: 'Premium green-to-yellow Ecuadorian Cavendish bananas in heavy duty wholesale cartons.',
    offers: [
      {
        shopId: shopA.id,
        shopName: shopA.name,
        stallNumber: shopA.stallNumber,
        unit: WholesaleUnit.BOX,
        unitWeightKg: 18,
        priceAed: 68,
        minOrderQuantity: 3,
        availableStock: 95,
        isActive: true
      }
    ]
  });

  await createProduct({
    name: 'Roma Tomatoes',
    category: ProductCategory.FRESH_VEGETABLES,
    originCountry: 'Jordan',
    description: 'Firm, ripe red Roma plum tomatoes ideal for restaurants, caterers and supermarkets.',
    offers: [
      {
        shopId: shopA.id,
        shopName: shopA.name,
        stallNumber: shopA.stallNumber,
        unit: WholesaleUnit.CRATE,
        unitWeightKg: 10,
        priceAed: 32,
        minOrderQuantity: 4,
        availableStock: 150,
        isActive: true
      },
      {
        shopId: shopB.id,
        shopName: shopB.name,
        stallNumber: shopB.stallNumber,
        unit: WholesaleUnit.CRATE,
        unitWeightKg: 10,
        priceAed: 30,
        minOrderQuantity: 8,
        availableStock: 110,
        isActive: true
      }
    ]
  });

  console.log('[Seed] Demo data seeding completed successfully.');
}
