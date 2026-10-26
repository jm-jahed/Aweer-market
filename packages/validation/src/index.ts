import { z } from 'zod';
import { UserRole, WholesaleUnit, ProductCategory, OrderStatus, DeliveryType } from '@aweermarket/types';

// ============================================================================
// Normalized Base Primitives
// ============================================================================

/**
 * Normalized Email Schema: trims whitespace and lowercases input.
 * Generic error messages to prevent credential/account enumeration.
 */
export const EmailSchema = z
  .string({ required_error: 'Valid email address is required' })
  .trim()
  .toLowerCase()
  .email('Invalid email address format');

/**
 * Standard Password Policy Constants
 */
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;
export const MAX_PASSWORD_BYTES = 512;

/**
 * Standard Password Schema: minimum 8 characters, maximum 128 characters, max 512 UTF-8 bytes.
 * Prevents CPU-exhaustion DoS from oversized inputs while preserving complexity.
 */
export const PasswordSchema = z
  .string({ required_error: 'Password is required' })
  .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
  .max(MAX_PASSWORD_LENGTH, `Password cannot exceed ${MAX_PASSWORD_LENGTH} characters`)
  .refine((val) => new TextEncoder().encode(val).length <= MAX_PASSWORD_BYTES, {
    message: `Password cannot exceed ${MAX_PASSWORD_BYTES} bytes`
  });

/**
 * MFA 6-digit token format schema.
 * Note: Validates format only; cryptographic verification is performed on the server.
 */
export const MfaTokenSchema = z
  .string({ required_error: 'MFA verification token is required' })
  .trim()
  .regex(/^\d{6}$/, 'MFA token must be exactly 6 numeric digits');

// ============================================================================
// Authentication & Registration Schemas
// ============================================================================

/**
 * Standard Login Schema (used for Buyer authentication).
 * Strictly forbids client-submitted roles or privileges.
 */
export const LoginSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema
}).strict();

/**
 * Shop Admin Login Schema.
 * Separate schema to isolate shop administration login contracts.
 */
export const ShopAdminLoginSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema
}).strict();

/**
 * Super Admin Login Schema (includes optional MFA token for one-step or challenge login).
 */
export const SuperAdminLoginSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  mfaToken: MfaTokenSchema.optional()
}).strict();

/**
 * Super Admin MFA Challenge Verification Schema (two-step login flow).
 */
export const SuperAdminMfaVerifySchema = z.object({
  challengeToken: z.string({ required_error: 'Challenge token is required' }).min(1),
  mfaToken: MfaTokenSchema
}).strict();

/**
 * Public Buyer Registration Schema.
 * CRITICAL SECURITY: Uses .strict() to reject any client-submitted 'role', 'shopId',
 * or permission override fields. Role is strictly assigned as UserRole.BUYER on the server.
 */
export const RegisterBuyerSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  fullName: z.string({ required_error: 'Full name is required' }).trim().min(2, 'Full name must be at least 2 characters'),
  businessName: z.string().trim().min(2).optional(),
  phone: z.string({ required_error: 'Phone number is required' }).trim().min(7, 'Phone number must be at least 7 digits'),
  tradeLicenseNumber: z.string().trim().optional()
}).strict();

/**
 * Al Aweer Wholesale Vendor Registration Schema.
 * Registers both the Shop Admin user and their initial market stall.
 * Strictly forbids client-submitted role, isApproved, or permissions.
 */
export const RegisterVendorSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  fullName: z.string({ required_error: 'Full name is required' }).trim().min(2, 'Full name must be at least 2 characters'),
  stallName: z.string({ required_error: 'Stall name is required' }).trim().min(2, 'Stall name must be at least 2 characters'),
  stallNumber: z.string({ required_error: 'Al Aweer stall number is required' }).trim().min(1, 'Stall number is required'),
  tradeLicenseNumber: z.string({ required_error: 'Trade license number is required' }).trim().min(2, 'Trade license must be at least 2 characters'),
  phone: z.string({ required_error: 'Contact phone is required' }).trim().min(7, 'Phone number must be at least 7 digits')
}).strict();

/**
 * Admin / Reseller Vendor Stall Registration Schema.
 * Allows Super Admin or Reseller to provision a wholesale stall and vendor login credentials.
 */
export const CreateShopByAdminSchema = z.object({
  name: z.string({ required_error: 'Stall name is required' }).trim().min(2, 'Stall name must be at least 2 characters').max(100),
  stallNumber: z.string({ required_error: 'Al Aweer stall number is required' }).trim().min(1, 'Stall number is required'),
  ownerName: z.string({ required_error: 'Vendor contact person name is required' }).trim().min(2, 'Contact person name must be at least 2 characters'),
  email: EmailSchema,
  password: PasswordSchema,
  phone: z.string({ required_error: 'Contact phone is required' }).trim().min(7, 'Phone number must be at least 7 digits'),
  tradeLicenseNumber: z.string().trim().min(2).optional().default('TL-PENDING'),
  marketLocation: z.string().trim().optional().default('Al Aweer Central Wholesale Market'),
  description: z.string().trim().max(500).optional().default(''),
  openingHours: z.string().trim().optional()
}).strict();

export const UpdateShopByAdminSchema = z.object({
  name: z.string().trim().min(2, 'Stall name must be at least 2 characters').max(100).optional(),
  stallNumber: z.string().trim().min(1, 'Stall number cannot be empty').optional(),
  phone: z.string().trim().min(7, 'Phone number must be at least 7 digits').optional(),
  tradeLicenseNumber: z.string().trim().min(2).optional(),
  marketLocation: z.string().trim().optional(),
  description: z.string().trim().max(500).optional(),
  openingHours: z.string().trim().optional(),
  address: z.string().trim().optional(),
  logoUrl: z.string().trim().optional(),
  coverImageUrl: z.string().trim().optional(),
  weeklySchedule: z.string().trim().optional()
}).strict();

/**
 * Shop Admin Stall Profile Update Schema.
 * Vendors can update their shop contact details, but CANNOT self-approve (isApproved forbidden).
 */
export const UpdateShopProfileSchema = z.object({
  name: z.string().trim().min(2, 'Stall name must be at least 2 characters').optional(),
  stallNumber: z.string().trim().min(1, 'Stall number cannot be empty').optional(),
  phone: z.string().trim().min(7, 'Phone number must be at least 7 digits').optional(),
  logoUrl: z.string().trim().optional(),
  coverImageUrl: z.string().trim().optional(),
  address: z.string().trim().optional(),
  openingHours: z.string().trim().optional(),
  weeklySchedule: z.string().trim().optional(),
  marketLocation: z.string().trim().optional()
}).strict();

// ============================================================================
// Product & Inventory Schemas
// ============================================================================

export const ProductOfferSchema = z.object({
  unit: z.nativeEnum(WholesaleUnit),
  unitWeightKg: z.number().positive().default(1),
  priceAed: z.number().positive(),
  minOrderQuantity: z.number().int().positive().default(1),
  availableStock: z.number().int().nonnegative()
});

export const CreateProductSchema = z.object({
  name: z.string().min(2),
  category: z.nativeEnum(ProductCategory),
  originCountry: z.string().min(2),
  description: z.string().default(''),
  imageUrl: z.string().optional(),
  offer: ProductOfferSchema
});

export const VendorAddOfferSchema = z.object({
  productId: z.string({ required_error: 'Product ID is required' }).min(1),
  offer: ProductOfferSchema
}).strict();

export const UpdateProductOfferSchema = z.object({
  priceAed: z.number().positive('Price must be positive').optional(),
  unitWeightKg: z.number().positive('Unit weight must be positive').optional(),
  minOrderQuantity: z.number().int().positive('MOQ must be at least 1').optional(),
  availableStock: z.number().int().nonnegative('Stock cannot be negative').optional(),
  isActive: z.boolean().optional()
}).strict();

export const UpdateVendorProductSchema = z.object({
  name: z.string().min(2).optional(),
  category: z.nativeEnum(ProductCategory).optional(),
  originCountry: z.string().min(2).optional(),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  offer: UpdateProductOfferSchema.optional()
}).strict();

// ============================================================================
// Order Schemas
// ============================================================================

export const CreateOrderItemSchema = z.object({
  productId: z.string({ required_error: 'Product ID is required' }).min(1),
  quantity: z.number({ required_error: 'Quantity is required' }).int().positive('Quantity must be at least 1')
}).strict();

export const CreateOrderSchema = z.object({
  shopId: z.string().min(1).optional(),
  /** @deprecated Backward compatibility alias for shopId */
  vendorId: z.string().min(1).optional(),
  deliveryType: z.nativeEnum(DeliveryType),
  deliveryAddress: z.string().trim().optional(),
  pickupTime: z.string().trim().optional(),
  items: z.array(CreateOrderItemSchema).min(1, 'Order must contain at least one item')
}).strict().refine((data) => Boolean(data.shopId || data.vendorId), {
  message: 'Either shopId or vendorId is required',
  path: ['shopId']
});

export const UpdateOrderStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus)
}).strict();

// ============================================================================
// Category Schemas
// ============================================================================

export const CreateCategorySchema = z.object({
  name: z.string({ required_error: 'Category name is required' }).trim().min(2, 'Name must be at least 2 characters').max(60),
  slug: z.string({ required_error: 'Category slug is required' }).trim().min(2).max(60).regex(/^[a-z0-9_-]+$/, 'Slug must only contain lowercase letters, numbers, hyphens, and underscores'),
  description: z.string().trim().max(300).optional().default(''),
  icon: z.string().trim().max(30).optional().default('📦'),
  bannerUrl: z.string().trim().optional().default(''),
  sortOrder: z.number().int().optional().default(0),
  isActive: z.boolean().optional().default(true)
}).strict();

export const UpdateCategorySchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  slug: z.string().trim().min(2).max(60).regex(/^[a-z0-9_-]+$/, 'Slug must only contain lowercase letters, numbers, hyphens, and underscores').optional(),
  description: z.string().trim().max(300).optional(),
  icon: z.string().trim().max(30).optional(),
  bannerUrl: z.string().trim().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional()
}).strict();

// ============================================================================
// Reseller Schemas
// ============================================================================

export const CreateResellerSchema = z.object({
  businessName: z.string({ required_error: 'Business name is required' }).trim().min(2, 'Business name must be at least 2 characters').max(100),
  contactPerson: z.string({ required_error: 'Contact person is required' }).trim().min(2, 'Contact person must be at least 2 characters').max(60),
  email: EmailSchema,
  password: PasswordSchema.optional(),
  phone: z.string({ required_error: 'Phone number is required' }).trim().min(7, 'Phone number must be at least 7 digits'),
  tradeLicenseNumber: z.string().trim().min(2).optional().default('TL-PENDING'),
  tier: z.enum(['bronze', 'silver', 'gold', 'platinum']).default('bronze'),
  discountPercent: z.number().min(0).max(50).default(5),
  creditLimitAed: z.number().min(0).default(10000),
  paymentTerms: z.enum(['cash_on_delivery', 'net_15', 'net_30', 'net_60']).default('net_15'),
  status: z.enum(['pending', 'approved', 'suspended', 'rejected']).default('pending'),
  notes: z.string().trim().max(500).optional().default('')
}).strict();

export const UpdateResellerSchema = z.object({
  businessName: z.string().trim().min(2).max(100).optional(),
  contactPerson: z.string().trim().min(2).max(60).optional(),
  email: EmailSchema.optional(),
  password: PasswordSchema.optional(),
  phone: z.string().trim().min(7).optional(),
  tradeLicenseNumber: z.string().trim().min(2).optional(),
  tier: z.enum(['bronze', 'silver', 'gold', 'platinum']).optional(),
  discountPercent: z.number().min(0).max(50).optional(),
  creditLimitAed: z.number().min(0).optional(),
  paymentTerms: z.enum(['cash_on_delivery', 'net_15', 'net_30', 'net_60']).optional(),
  status: z.enum(['pending', 'approved', 'suspended', 'rejected']).optional(),
  notes: z.string().trim().max(500).optional()
}).strict();

// ============================================================================
// Inferred TypeScript Types
// ============================================================================

export type LoginInput = z.infer<typeof LoginSchema>;
export type ShopAdminLoginInput = z.infer<typeof ShopAdminLoginSchema>;
export type SuperAdminLoginInput = z.infer<typeof SuperAdminLoginSchema>;
export type SuperAdminMfaVerifyInput = z.infer<typeof SuperAdminMfaVerifySchema>;
export type RegisterBuyerInput = z.infer<typeof RegisterBuyerSchema>;
export type RegisterVendorInput = z.infer<typeof RegisterVendorSchema>;
export type UpdateShopProfileInput = z.infer<typeof UpdateShopProfileSchema>;
export type CreateProductInput = z.infer<typeof CreateProductSchema>;
export type VendorAddOfferInput = z.infer<typeof VendorAddOfferSchema>;
export type UpdateProductOfferInput = z.infer<typeof UpdateProductOfferSchema>;
export type UpdateVendorProductInput = z.infer<typeof UpdateVendorProductSchema>;
export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof UpdateOrderStatusSchema>;
export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>;
export type CreateResellerInput = z.infer<typeof CreateResellerSchema>;
export type UpdateResellerInput = z.infer<typeof UpdateResellerSchema>;
export type CreateShopByAdminInput = z.infer<typeof CreateShopByAdminSchema>;
export type UpdateShopByAdminInput = z.infer<typeof UpdateShopByAdminSchema>;
