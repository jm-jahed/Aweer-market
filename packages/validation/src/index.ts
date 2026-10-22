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

// ============================================================================
// Product & Inventory Schemas
// ============================================================================

export const ProductOfferSchema = z.object({
  unit: z.nativeEnum(WholesaleUnit),
  unitWeightKg: z.number().positive(),
  priceAed: z.number().positive(),
  minOrderQuantity: z.number().int().positive().default(1),
  availableStock: z.number().int().nonnegative()
});

export const CreateProductSchema = z.object({
  name: z.string().min(2),
  category: z.nativeEnum(ProductCategory),
  originCountry: z.string().min(2),
  description: z.string().default(''),
  offer: ProductOfferSchema
});

// ============================================================================
// Order Schemas
// ============================================================================

export const CreateOrderSchema = z.object({
  vendorId: z.string().min(1),
  deliveryType: z.nativeEnum(DeliveryType),
  deliveryAddress: z.string().optional(),
  pickupTime: z.string().optional(),
  items: z.array(
    z.object({
      productId: z.string().min(1),
      quantity: z.number().int().positive(),
      unitPriceAed: z.number().positive()
    })
  ).min(1, 'Order must contain at least one item')
});

// ============================================================================
// Inferred TypeScript Types
// ============================================================================

export type LoginInput = z.infer<typeof LoginSchema>;
export type ShopAdminLoginInput = z.infer<typeof ShopAdminLoginSchema>;
export type SuperAdminLoginInput = z.infer<typeof SuperAdminLoginSchema>;
export type SuperAdminMfaVerifyInput = z.infer<typeof SuperAdminMfaVerifySchema>;
export type RegisterBuyerInput = z.infer<typeof RegisterBuyerSchema>;
export type CreateProductInput = z.infer<typeof CreateProductSchema>;
export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;
