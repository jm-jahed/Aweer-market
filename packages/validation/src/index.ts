import { z } from 'zod';
import { UserRole, WholesaleUnit, ProductCategory, OrderStatus, DeliveryType } from '@aweermarket/types';

// Auth Schemas
export const LoginSchema = z.object({
  email: z.string().email('Valid business email is required'),
  password: z.string().min(8, 'Password must be at least 8 characters')
});

export const SuperAdminLoginSchema = LoginSchema.extend({
  mfaToken: z.string().length(6, '6-digit MFA verification code is required').optional()
});

export const RegisterBuyerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(2),
  businessName: z.string().min(2).optional(),
  phone: z.string().min(7),
  tradeLicenseNumber: z.string().optional()
});

// Product Schemas
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

// Order Schemas
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

export type LoginInput = z.infer<typeof LoginSchema>;
export type SuperAdminLoginInput = z.infer<typeof SuperAdminLoginSchema>;
export type RegisterBuyerInput = z.infer<typeof RegisterBuyerSchema>;
export type CreateProductInput = z.infer<typeof CreateProductSchema>;
export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;
