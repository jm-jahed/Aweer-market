import { hashPassword } from './utils/crypto.js';
import { createSuperAdminUser, createShopAdminUser, createBuyerUser, findUserByEmail } from './models/user.model.js';
import { createShop } from './models/shop.model.js';
import { createProduct } from './models/product.model.js';
import { ProductCategory, WholesaleUnit } from '@aweermarket/types';

export async function ensureDefaultSuperAdmin(): Promise<void> {
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    // In production, seeding is strictly opt-in and requires explicit, secure configuration
    if (process.env.ENABLE_SUPER_ADMIN_SEED !== 'true') {
      console.log('[Seed] Production super admin initialization is disabled (ENABLE_SUPER_ADMIN_SEED is not "true"). Skipping.');
      return;
    }

    const email = process.env.SUPER_ADMIN_EMAIL?.toLowerCase().trim();
    const password = process.env.SUPER_ADMIN_PASSWORD;
    const name = process.env.SUPER_ADMIN_NAME?.trim();

    if (!email || !email.includes('@')) {
      console.warn('[Seed] Production super admin initialization skipped: SUPER_ADMIN_EMAIL is missing or invalid.');
      return;
    }

    if (!password || password.length < 12) {
      console.warn('[Seed] Production super admin initialization skipped: SUPER_ADMIN_PASSWORD must be at least 12 characters.');
      return;
    }

    if (!name) {
      console.warn('[Seed] Production super admin initialization skipped: SUPER_ADMIN_NAME is required.');
      return;
    }

    // Check if account already exists (never overwrite existing admin)
    const existing = await findUserByEmail(email);
    if (existing) {
      return;
    }

    const passwordHash = await hashPassword(password);
    try {
      await createSuperAdminUser({
        email,
        passwordHash,
        fullName: name
      });
      console.log('[Seed] Production Super Admin initial account created successfully.');
    } catch (err: unknown) {
      // Handle only verified MongoDB duplicate-key races (code 11000)
      if ((err as { code?: number })?.code === 11000) {
        const recheck = await findUserByEmail(email);
        if (recheck) {
          return; // Race resolved: another worker created the expected account
        }
      }
      throw err;
    }
    return;
  }

  // Development / Test workflow
  const adminEmail = (process.env.SUPER_ADMIN_EMAIL || 'superadmin@aweermarket.ae').toLowerCase().trim();
  const existingAdmin = await findUserByEmail(adminEmail);
  if (existingAdmin) {
    return; // Already initialized; never overwrite existing account data
  }

  const adminPass = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin123!';
  const adminName = process.env.SUPER_ADMIN_NAME || 'Aweer Market Super Admin';
  const passwordHash = await hashPassword(adminPass);

  try {
    await createSuperAdminUser({
      email: adminEmail,
      passwordHash,
      fullName: adminName
    });
  } catch (err: unknown) {
    if ((err as { code?: number })?.code === 11000) {
      const recheck = await findUserByEmail(adminEmail);
      if (recheck) {
        return;
      }
    }
    throw err;
  }
}

export async function seedDemoData(): Promise<void> {
  await ensureDefaultSuperAdmin();

  const existingStallA = await findUserByEmail('vendor@alaweer.ae');
  if (existingStallA) {
    return; // Already seeded
  }

  console.log('[Seed] Seeding initial AweerMarket wholesale marketplace data...');

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
