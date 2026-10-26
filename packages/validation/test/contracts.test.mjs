import { describe, it } from 'node:test';
import assert from 'node:assert';
import { 
  RegisterBuyerSchema, 
  RegisterVendorSchema,
  UpdateShopProfileSchema,
  LoginSchema, 
  ShopAdminLoginSchema, 
  SuperAdminLoginSchema, 
  MfaTokenSchema,
  CreateOrderSchema,
  CreateProductSchema
} from '../dist/index.js';
import { UserRole, WholesaleUnit, ProductCategory, isShopAdminRole, isSuperAdminRole, DeliveryType } from '../../types/dist/index.js';

describe('Validation Contracts — Security & Integrity', () => {
  it('RegisterBuyerSchema accepts valid buyer input and normalizes email', () => {
    const input = {
      email: '  Buyer@AweerMarket.COM  ',
      password: 'StrongPassword123!',
      fullName: 'Ahmed Al Aweer',
      phone: '+971501234567'
    };

    const parsed = RegisterBuyerSchema.parse(input);
    assert.strictEqual(parsed.email, 'buyer@aweermarket.com');
    assert.strictEqual(parsed.fullName, 'Ahmed Al Aweer');
    assert.strictEqual(parsed.phone, '+971501234567');
  });

  it('RegisterBuyerSchema REJECTS client-submitted role attempt (Privilege Escalation Prevention)', () => {
    const maliciousInput = {
      email: 'attacker@example.com',
      password: 'Password1234',
      fullName: 'Attacker Name',
      phone: '+971500000000',
      role: 'super_admin' // Attempted privilege escalation
    };

    assert.throws(() => {
      RegisterBuyerSchema.parse(maliciousInput);
    }, /unrecognized_keys/i);
  });

  it('RegisterBuyerSchema REJECTS client-submitted shopId attempt', () => {
    const maliciousInput = {
      email: 'attacker@example.com',
      password: 'Password1234',
      fullName: 'Attacker Name',
      phone: '+971500000000',
      shopId: 'shop_stall_101' // Attempted tenant spoofing
    };

    assert.throws(() => {
      RegisterBuyerSchema.parse(maliciousInput);
    }, /unrecognized_keys/i);
  });

  it('LoginSchema normalizes email and enforces password minimum length', () => {
    const shortPassword = {
      email: 'user@test.com',
      password: '123'
    };

    assert.throws(() => {
      LoginSchema.parse(shortPassword);
    }, /at least 8 characters/i);

    const valid = LoginSchema.parse({
      email: '  User@TEST.COM ',
      password: 'validPassword123'
    });
    assert.strictEqual(valid.email, 'user@test.com');

    // 128-character boundary test (SEC-03)
    const exactly128 = 'A'.repeat(128);
    const valid128 = LoginSchema.parse({
      email: 'user@test.com',
      password: exactly128
    });
    assert.strictEqual(valid128.password.length, 128);

    // 129-character rejection test (SEC-03)
    const oversized129 = 'A'.repeat(129);
    assert.throws(() => {
      LoginSchema.parse({
        email: 'user@test.com',
        password: oversized129
      });
    }, /cannot exceed 128 characters/i);

    assert.throws(() => {
      RegisterBuyerSchema.parse({
        email: 'buyer@test.com',
        password: oversized129,
        fullName: 'Test Buyer',
        phone: '+971501234567'
      });
    }, /cannot exceed 128 characters/i);

    assert.throws(() => {
      ShopAdminLoginSchema.parse({
        email: 'admin@shop.com',
        password: oversized129
      });
    }, /cannot exceed 128 characters/i);

    assert.throws(() => {
      SuperAdminLoginSchema.parse({
        email: 'owner@aweer.ae',
        password: oversized129
      });
    }, /cannot exceed 128 characters/i);

    // Multibyte Unicode boundary test (SEC-03: max 512 bytes)
    // 4-byte emoji repeated 130 times = 520 bytes
    const multibyteOversized = '🛡️'.repeat(130);
    assert.throws(() => {
      LoginSchema.parse({
        email: 'user@test.com',
        password: multibyteOversized
      });
    }, /exceed 512 bytes|cannot exceed 128 characters/i);
  });

  it('MfaTokenSchema enforces exactly 6 numeric digits', () => {
    assert.strictEqual(MfaTokenSchema.parse('123456'), '123456');

    // Non-numeric
    assert.throws(() => MfaTokenSchema.parse('abcdef'));
    // Too short
    assert.throws(() => MfaTokenSchema.parse('12345'));
    // Too long
    assert.throws(() => MfaTokenSchema.parse('1234567'));
  });

  it('SuperAdminLoginSchema accepts valid credentials with optional MFA token', () => {
    const withoutMfa = SuperAdminLoginSchema.parse({
      email: 'superadmin@aweermarket.ae',
      password: 'SuperAdminSecret123'
    });
    assert.strictEqual(withoutMfa.email, 'superadmin@aweermarket.ae');

    const withMfa = SuperAdminLoginSchema.parse({
      email: 'superadmin@aweermarket.ae',
      password: 'SuperAdminSecret123',
      mfaToken: '654321'
    });
    assert.strictEqual(withMfa.mfaToken, '654321');
  });

  it('UserRole enum preserves backward-compatibility aliases and helper guards', () => {
    assert.strictEqual(UserRole.BUYER, 'buyer');
    assert.strictEqual(UserRole.SHOP_ADMIN, 'shop_admin');
    assert.strictEqual(UserRole.SUPER_ADMIN, 'super_admin');
    assert.strictEqual(UserRole.VENDOR, 'vendor');
    assert.strictEqual(UserRole.ADMIN, 'admin');

    // Type guards
    assert.strictEqual(isShopAdminRole(UserRole.SHOP_ADMIN), true);
    assert.strictEqual(isShopAdminRole(UserRole.VENDOR), true);
    assert.strictEqual(isShopAdminRole(UserRole.ADMIN), true);
    assert.strictEqual(isShopAdminRole(UserRole.BUYER), false);

    assert.strictEqual(isSuperAdminRole(UserRole.SUPER_ADMIN), true);
    assert.strictEqual(isSuperAdminRole(UserRole.ADMIN), false);
    assert.strictEqual(isSuperAdminRole(UserRole.SHOP_ADMIN), false);
  });

  it('CreateOrderSchema enforces server price authority and rejects client unitPriceAed', () => {
    // 1. Valid order without client prices
    const validOrder = {
      shopId: 'shop_aweer_101',
      deliveryType: DeliveryType.SCHEDULED_DELIVERY,
      deliveryAddress: 'Business Bay, Tower 1, Dubai',
      items: [
        { productId: 'prod_orange_123', quantity: 5 },
        { productId: 'prod_banana_456', quantity: 10 }
      ]
    };
    const parsed = CreateOrderSchema.parse(validOrder);
    assert.strictEqual(parsed.shopId, 'shop_aweer_101');
    assert.strictEqual(parsed.items.length, 2);
    assert.strictEqual(parsed.items[0].quantity, 5);

    // 2. CRITICAL: Rejects client-submitted unitPriceAed (Price Tampering Prevention)
    const tamperedPriceOrder = {
      shopId: 'shop_aweer_101',
      deliveryType: DeliveryType.SHOP_PICKUP,
      items: [
        { productId: 'prod_orange_123', quantity: 5, unitPriceAed: 0.01 }
      ]
    };
    assert.throws(() => {
      CreateOrderSchema.parse(tamperedPriceOrder);
    }, /unrecognized_keys/i);

    // 3. Rejects order missing both shopId and vendorId
    assert.throws(() => {
      CreateOrderSchema.parse({
        deliveryType: DeliveryType.SHOP_PICKUP,
        items: [{ productId: 'prod_1', quantity: 1 }]
      });
    }, /Either shopId or vendorId is required/i);

    // 4. Backward-compatible vendorId acceptance
    const legacyOrder = {
      vendorId: 'shop_aweer_101',
      deliveryType: DeliveryType.SHOP_PICKUP,
      items: [{ productId: 'prod_1', quantity: 2 }]
    };
    const parsedLegacy = CreateOrderSchema.parse(legacyOrder);
    assert.strictEqual(parsedLegacy.vendorId, 'shop_aweer_101');
  });

  it('RegisterVendorSchema accepts valid vendor registration and rejects client role overrides', () => {
    const valid = {
      email: 'vendor@al-aweer.ae',
      password: 'StallMasterPass123',
      fullName: 'Tariq Al Hashemi',
      stallName: 'Al Aweer Fresh Dates',
      stallNumber: 'ST-42',
      tradeLicenseNumber: 'TL-DXB-98765',
      phone: '+971509876543'
    };

    const parsed = RegisterVendorSchema.parse(valid);
    assert.strictEqual(parsed.stallName, 'Al Aweer Fresh Dates');
    assert.strictEqual(parsed.stallNumber, 'ST-42');

    // Attempt privilege escalation or self-approval
    assert.throws(() => {
      RegisterVendorSchema.parse({
        ...valid,
        role: 'super_admin'
      });
    }, /unrecognized_keys/i);

    assert.throws(() => {
      RegisterVendorSchema.parse({
        ...valid,
        isApproved: true
      });
    }, /unrecognized_keys/i);
  });

  it('UpdateShopProfileSchema allows contact updates but rejects isApproved tampering', () => {
    const valid = {
      name: 'Updated Stall Name',
      phone: '+971501112233'
    };
    const parsed = UpdateShopProfileSchema.parse(valid);
    assert.strictEqual(parsed.name, 'Updated Stall Name');

    // Attempt self-approval via update
    assert.throws(() => {
      UpdateShopProfileSchema.parse({
        name: 'New Name',
        isApproved: true
      });
    }, /unrecognized_keys/i);
  });

  it('CreateProductSchema validates 8-field form structure and defaults unitWeightKg to 1', () => {
    // 8 fields: Name, Category, Origin, Image, Selling Price, Unit, MOQ, Stock
    const valid8Fields = {
      name: 'Organic Cavendish Bananas',
      category: ProductCategory.EXOTIC_PRODUCE,
      originCountry: 'Ecuador',
      imageUrl: '/images/banana.jpg',
      offer: {
        unit: WholesaleUnit.BOX,
        priceAed: 45.0,
        minOrderQuantity: 2,
        availableStock: 100
      }
    };

    const parsed = CreateProductSchema.parse(valid8Fields);
    assert.strictEqual(parsed.name, 'Organic Cavendish Bananas');
    assert.strictEqual(parsed.offer.unitWeightKg, 1); // safely defaulted
    assert.strictEqual(parsed.offer.priceAed, 45.0);
    assert.strictEqual(parsed.offer.minOrderQuantity, 2);
    assert.strictEqual(parsed.offer.availableStock, 100);

    // Supports new units piece and bunch
    const pieceProduct = CreateProductSchema.parse({
      ...valid8Fields,
      name: 'Watermelon Sugar Baby',
      offer: {
        unit: WholesaleUnit.PIECE,
        priceAed: 15.0,
        availableStock: 50
      }
    });
    assert.strictEqual(pieceProduct.offer.unit, WholesaleUnit.PIECE);
    assert.strictEqual(pieceProduct.offer.minOrderQuantity, 1);

    // Rejects non-positive price
    assert.throws(() => {
      CreateProductSchema.parse({
        ...valid8Fields,
        offer: {
          ...valid8Fields.offer,
          priceAed: 0
        }
      });
    }, /too_small|positive/i);

    // Rejects negative stock
    assert.throws(() => {
      CreateProductSchema.parse({
        ...valid8Fields,
        offer: {
          ...valid8Fields.offer,
          availableStock: -5
        }
      });
    }, /too_small|nonnegative/i);
  });
});
