/**
 * AweerMarket Core Domain Types
 * Dubai Al Aweer Wholesale Fruits & Vegetables Marketplace
 */

export enum UserRole {
  BUYER = 'buyer',
  SHOP_ADMIN = 'shop_admin',
  SUPER_ADMIN = 'super_admin',
  RESELLER = 'reseller',
  /**
   * @deprecated Retained for backward-compatibility with earlier Phase 1 drafts.
   * Consumers should migrate to UserRole.SHOP_ADMIN.
   */
  VENDOR = 'vendor',
  /**
   * @deprecated Retained for backward-compatibility with earlier Phase 1 drafts.
   * Consumers should migrate explicitly to UserRole.SHOP_ADMIN or UserRole.SUPER_ADMIN.
   */
  ADMIN = 'admin'
}

/**
 * Type guard for shop administration privileges (including legacy aliases)
 */
export function isShopAdminRole(role: UserRole | string): boolean {
  return role === UserRole.SHOP_ADMIN || role === UserRole.VENDOR || role === UserRole.ADMIN;
}

/**
 * Type guard strictly for super admin privileges
 */
export function isSuperAdminRole(role: UserRole | string): boolean {
  return role === UserRole.SUPER_ADMIN;
}

/**
 * Type guard for administrative portal access (Super Admin & Reseller Sub-Admin)
 */
export function isAdministrativeRole(role: UserRole | string): boolean {
  return role === UserRole.SUPER_ADMIN || role === UserRole.RESELLER;
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

export interface CategoryPublicItem {
  id: string;
  name?: string;
  slug?: string;
  key: string;
  label: string;
  description: string;
  icon: string;
  bannerUrl?: string;
  sortOrder: number;
  isActive: boolean;
  productCount?: number;
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

/**
 * Safe user identity summary: never contains passwords, hashes, MFA secrets, or tokens.
 */
export interface UserSummary {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  shopId?: string;
  /** @deprecated Backward compatibility alias for shopId */
  vendorId?: string;
  resellerId?: string;
  businessName?: string;
  isActive: boolean;
  isEmailVerified?: boolean;
  createdAt: string;
}

/**
 * Trusted server-side authentication session payload.
 */
export interface AuthSessionPayload {
  userId: string;
  role: UserRole;
  email: string;
  shopId?: string;
  /** @deprecated Backward compatibility alias for shopId */
  vendorId?: string;
  resellerId?: string;
  isMfaVerified?: boolean;
  tokenVersion?: number;
  issuedAt?: number;
  expiresAt?: number;
}

/**
 * Tenant authorization context derived securely on the server.
 */
export interface TenantAuthorizationContext {
  userId: string;
  role: UserRole;
  shopId: string;
  isAuthorized: boolean;
}

/**
 * Security audit event classifications for future security logging.
 */
export enum AuditEventType {
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILURE = 'login_failure',
  LOGOUT = 'logout',
  MFA_CHALLENGE = 'mfa_challenge',
  MFA_VERIFIED = 'mfa_verified',
  PASSWORD_CHANGED = 'password_changed',
  PRIVILEGE_ELEVATION_ATTEMPT = 'privilege_elevation_attempt',
  TENANT_ACCESS_DENIED = 'tenant_access_denied',
  ADMIN_PROVISIONED = 'admin_provisioned',
  ACCOUNT_STATUS_CHANGED = 'account_status_changed'
}

/**
 * Audit event metadata contract.
 */
export interface AuditEventMetadata {
  eventId: string;
  eventType: AuditEventType;
  userId?: string;
  actorRole?: UserRole;
  ipAddress?: string;
  userAgent?: string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  timestamp: string;
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
  imageUrl?: string;
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

// ============================================================================
// Reseller & B2B Sub-Distributor Types
// ============================================================================

export enum ResellerStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  SUSPENDED = 'suspended',
  REJECTED = 'rejected'
}

export enum ResellerTier {
  BRONZE = 'bronze',
  SILVER = 'silver',
  GOLD = 'gold',
  PLATINUM = 'platinum'
}

export enum ResellerPaymentTerms {
  COD = 'cash_on_delivery',
  NET_15 = 'net_15',
  NET_30 = 'net_30',
  NET_60 = 'net_60'
}

export interface ResellerItem {
  id: string;
  businessName: string;
  contactPerson: string;
  email: string;
  phone: string;
  tradeLicenseNumber: string;
  tier: ResellerTier | string;
  discountPercent: number;
  creditLimitAed: number;
  outstandingBalanceAed: number;
  paymentTerms: ResellerPaymentTerms | string;
  status: ResellerStatus | string;
  totalOrders: number;
  totalSpentAed: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
