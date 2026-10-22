/**
 * AweerMarket Core Domain Types
 * Dubai Al Aweer Wholesale Fruits & Vegetables Marketplace
 */

export enum UserRole {
  BUYER = 'buyer',
  VENDOR = 'vendor',
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin'
}

export enum WholesaleUnit {
  KG = 'kg',
  CARTON = 'carton',
  CRATE = 'crate',
  PALLET = 'pallet',
  BOX = 'box',
  SACK = 'sack'
}

export enum ProductCategory {
  FRESH_FRUITS = 'fresh_fruits',
  FRESH_VEGETABLES = 'fresh_vegetables',
  EXOTIC_PRODUCE = 'exotic_produce',
  LEAFY_GREENS = 'leafy_greens',
  CITRUS = 'citrus',
  BERRIES = 'berries',
  ROOT_VEGETABLES = 'root_vegetables'
}

export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PREPARING = 'preparing',
  READY_FOR_PICKUP = 'ready_for_pickup',
  OUT_FOR_DELIVERY = 'out_for_delivery',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  DISPUTED = 'disputed'
}

export enum DeliveryType {
  SHOP_PICKUP = 'shop_pickup',
  SCHEDULED_DELIVERY = 'scheduled_delivery'
}

export interface UserSummary {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  businessName?: string;
  isActive: boolean;
  createdAt: string;
}

export interface AuthSessionPayload {
  userId: string;
  role: UserRole;
  email: string;
  vendorId?: string;
  isMfaVerified?: boolean;
}

export interface ProductOfferSummary {
  vendorId: string;
  shopName: string;
  stallNumber?: string;
  unit: WholesaleUnit;
  unitWeightKg: number;
  priceAed: number;
  equivalentPricePerKg: number;
  minOrderQuantity: number;
  availableStock: number;
}

export interface ProductItem {
  id: string;
  name: string;
  category: ProductCategory;
  originCountry: string;
  description: string;
  lowestPriceAedPerKg: number;
  offers: ProductOfferSummary[];
}

export interface HealthCheckResponse {
  status: 'ok' | 'degraded' | 'error';
  service: string;
  timestamp: string;
  version: string;
  database: 'connected' | 'disconnected' | 'mocked';
}

export interface LivenessResponse {
  status: 'ok';
  check: 'liveness';
  service: string;
  timestamp: string;
}

export interface ReadinessResponse {
  status: 'ready' | 'unavailable';
  check: 'readiness';
  database: 'connected' | 'disconnected';
  timestamp: string;
  error?: string;
}
