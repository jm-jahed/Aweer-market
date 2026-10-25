/**
 * AweerMarket Super Admin API Client
 * Cookie-aware fetch wrapper communicating with Fastify backend on port 4000.
 */

import type { UserSummary, UserRole, CategoryPublicItem, ResellerItem } from '@aweermarket/types';

const DEFAULT_API_BASE_URL = 'http://localhost:4000/api/v1';

export function getApiBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!envUrl || envUrl.trim().length === 0) {
    return DEFAULT_API_BASE_URL;
  }
  const cleanUrl = envUrl.trim().replace(/\/+$/, '');
  return cleanUrl.endsWith('/api/v1') ? cleanUrl : `${cleanUrl}/api/v1`;
}

export class ApiClientError extends Error {
  readonly statusCode: number;
  readonly code?: string;

  constructor(message: string, statusCode: number, code?: string) {
    super(message);
    this.name = 'ApiClientError';
    this.statusCode = statusCode;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const normalizedPath = cleanPath.startsWith('/api/v1')
    ? cleanPath.substring('/api/v1'.length)
    : cleanPath;
  const url = `${baseUrl}${normalizedPath}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {})
  };

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include'
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Network connection failure';
    throw new ApiClientError(`Unable to connect to central API (${errorMsg})`, 0, 'NETWORK_ERROR');
  }

  let data: Record<string, unknown> = {};
  const text = await response.text();
  if (text && text.trim().length > 0) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { rawResponse: text };
    }
  }

  if (!response.ok) {
    const message = (data.message as string) || (data.error as string) || `Request failed with status ${response.status}`;
    throw new ApiClientError(message, response.status, data.code as string | undefined);
  }

  return data as unknown as T;
}

export async function superAdminLogin(email: string, password: string):Promise<{ statusCode: number; user: UserSummary; token?: string }> {
  return await request<{ statusCode: number; user: UserSummary; token?: string }>('/auth/super-admin/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
}

export async function getSuperAdminMe(): Promise<{ statusCode: number; user: UserSummary }> {
  return await request<{ statusCode: number; user: UserSummary }>('/auth/super-admin/me', {
    method: 'GET'
  });
}

export async function superAdminLogout(): Promise<{ statusCode: number; message: string }> {
  return await request<{ statusCode: number; message: string }>('/auth/logout', {
    method: 'POST'
  });
}

export interface OrderFinancialMetrics {
  totalGmvAed: number;
  totalCommissionAed: number;
  commissionRatePercent: number;
  deliveredGmvAed: number;
  deliveredCommissionAed: number;
  ordersByStatus: Record<string, number>;
}

export interface PlatformMetrics {
  totalUsers: number;
  buyers: number;
  shopAdmins: number;
  superAdmins: number;
  totalShops: number;
  approvedShops: number;
  pendingShops: number;
  totalProducts: number;
  activeProducts: number;
  inactiveProducts: number;
  totalOrders: number;
  totalResellers?: number;
  approvedResellers?: number;
  pendingResellers?: number;
  financials?: OrderFinancialMetrics;
}


export async function getAdminOverview(): Promise<{ statusCode: number; metrics: PlatformMetrics }> {
  return await request<{ statusCode: number; metrics: PlatformMetrics }>('/admin/overview', {
    method: 'GET'
  });
}

export interface AdminShopItem {
  id: string;
  name: string;
  slug: string;
  stallNumber: string;
  phone: string;
  isApproved: boolean;
  isActive: boolean;
  createdAt: string;
}

export async function getAdminShops(status?: 'approved' | 'pending'): Promise<{ statusCode: number; shops: AdminShopItem[] }> {
  const query = status ? `?status=${status}` : '';
  return await request<{ statusCode: number; shops: AdminShopItem[] }>(`/admin/shops${query}`, {
    method: 'GET'
  });
}

export async function setAdminShopApproval(shopId: string, isApproved: boolean): Promise<{ statusCode: number; message: string; shop: AdminShopItem }> {
  return await request<{ statusCode: number; message: string; shop: AdminShopItem }>(`/admin/shops/${shopId}/approval`, {
    method: 'PATCH',
    body: JSON.stringify({ isApproved })
  });
}

export async function setAdminShopStatus(shopId: string, isActive: boolean): Promise<{ statusCode: number; message: string; shop: AdminShopItem }> {
  return await request<{ statusCode: number; message: string; shop: AdminShopItem }>(`/admin/shops/${shopId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive })
  });
}

export async function getAdminUsers(role?: UserRole): Promise<{ statusCode: number; users: UserSummary[] }> {
  const query = role ? `?role=${role}` : '';
  return await request<{ statusCode: number; users: UserSummary[] }>(`/admin/users${query}`, {
    method: 'GET'
  });
}

export async function setAdminUserStatus(userId: string, isActive: boolean): Promise<{ statusCode: number; message: string; user: UserSummary }> {
  return await request<{ statusCode: number; message: string; user: UserSummary }>(`/admin/users/${userId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive })
  });
}

export interface AdminProductItem {
  id: string;
  name: string;
  category: string;
  originCountry: string;
  lowestPriceAedPerKg: number;
  isActive?: boolean;
  offers: Array<{
    vendorId: string;
    shopName: string;
    stallNumber?: string;
    priceAed: number;
    unit: string;
    unitWeightKg: number;
    availableStock: number;
  }>;
}

export async function getAdminProducts(): Promise<{ statusCode: number; products: AdminProductItem[] }> {
  return await request<{ statusCode: number; products: AdminProductItem[] }>('/admin/products', {
    method: 'GET'
  });
}

export async function setAdminProductModeration(productId: string, isActive: boolean): Promise<{ statusCode: number; message: string; product: AdminProductItem }> {
  return await request<{ statusCode: number; message: string; product: AdminProductItem }>(`/admin/products/${productId}/moderation`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive })
  });
}

export interface AdminOrderItem {
  id: string;
  orderNumber: string;
  buyerId: string;
  shopId: string;
  shopName: string;
  stallNumber: string;
  deliveryType: string;
  deliveryAddress?: string;
  pickupTime?: string;
  status: string;
  totalAmountAed: number;
  commissionAed: number;
  commissionRatePercent: number;
  items: Array<{
    productId: string;
    name: string;
    unit: string;
    unitWeightKg: number;
    quantity: number;
    unitPriceAed: number;
    lineTotalAed: number;
  }>;
  createdAt: string;
  updatedAt: string;
}

export async function getAdminOrders(status?: string, shopId?: string): Promise<{
  statusCode: number;
  financials: OrderFinancialMetrics;
  orders: AdminOrderItem[];
}> {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (shopId) params.set('shopId', shopId);
  const query = params.toString() ? `?${params.toString()}` : '';
  return await request<{
    statusCode: number;
    financials: OrderFinancialMetrics;
    orders: AdminOrderItem[];
  }>(`/admin/orders${query}`, {
    method: 'GET'
  });
}

export type AdminCategoryItem = CategoryPublicItem;

export interface CreateCategoryPayload {
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  bannerUrl?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface UpdateCategoryPayload {
  name?: string;
  slug?: string;
  description?: string;
  icon?: string;
  bannerUrl?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export async function getAdminCategories(): Promise<{ statusCode: number; categories: AdminCategoryItem[] }> {
  return await request<{ statusCode: number; categories: AdminCategoryItem[] }>('/admin/categories', {
    method: 'GET'
  });
}

export async function createAdminCategory(payload: CreateCategoryPayload): Promise<{
  statusCode: number;
  message: string;
  category: AdminCategoryItem;
}> {
  return await request<{ statusCode: number; message: string; category: AdminCategoryItem }>('/admin/categories', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function updateAdminCategory(id: string, payload: UpdateCategoryPayload): Promise<{
  statusCode: number;
  message: string;
  category: AdminCategoryItem;
}> {
  return await request<{ statusCode: number; message: string; category: AdminCategoryItem }>(`/admin/categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

export async function setAdminCategoryStatus(id: string, isActive: boolean): Promise<{
  statusCode: number;
  message: string;
  category: AdminCategoryItem;
}> {
  return await request<{ statusCode: number; message: string; category: AdminCategoryItem }>(`/admin/categories/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive })
  });
}

export async function deleteAdminCategory(id: string): Promise<{
  statusCode: number;
  message: string;
  deactivated: boolean;
}> {
  return await request<{ statusCode: number; message: string; deactivated: boolean }>(`/admin/categories/${id}`, {
    method: 'DELETE'
  });
}

// ============================================================================
// Reseller & B2B Sub-Distributor API Client
// ============================================================================

export type AdminResellerItem = ResellerItem;

export interface CreateResellerPayload {
  businessName: string;
  contactPerson: string;
  email: string;
  phone: string;
  tradeLicenseNumber?: string;
  tier?: 'bronze' | 'silver' | 'gold' | 'platinum';
  discountPercent?: number;
  creditLimitAed?: number;
  paymentTerms?: 'cash_on_delivery' | 'net_15' | 'net_30' | 'net_60';
  status?: 'pending' | 'approved' | 'suspended' | 'rejected';
  notes?: string;
}

export interface UpdateResellerPayload {
  businessName?: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  tradeLicenseNumber?: string;
  tier?: 'bronze' | 'silver' | 'gold' | 'platinum';
  discountPercent?: number;
  creditLimitAed?: number;
  paymentTerms?: 'cash_on_delivery' | 'net_15' | 'net_30' | 'net_60';
  status?: 'pending' | 'approved' | 'suspended' | 'rejected';
  notes?: string;
}

export async function getAdminResellers(status?: string, tier?: string): Promise<{
  statusCode: number;
  resellers: AdminResellerItem[];
}> {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (tier) params.set('tier', tier);
  const query = params.toString() ? `?${params.toString()}` : '';
  return await request<{ statusCode: number; resellers: AdminResellerItem[] }>(`/admin/resellers${query}`, {
    method: 'GET'
  });
}

export async function createAdminReseller(payload: CreateResellerPayload): Promise<{
  statusCode: number;
  message: string;
  reseller: AdminResellerItem;
}> {
  return await request<{ statusCode: number; message: string; reseller: AdminResellerItem }>('/admin/resellers', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function updateAdminReseller(id: string, payload: UpdateResellerPayload): Promise<{
  statusCode: number;
  message: string;
  reseller: AdminResellerItem;
}> {
  return await request<{ statusCode: number; message: string; reseller: AdminResellerItem }>(`/admin/resellers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

export async function setAdminResellerStatus(id: string, status: string): Promise<{
  statusCode: number;
  message: string;
  reseller: AdminResellerItem;
}> {
  return await request<{ statusCode: number; message: string; reseller: AdminResellerItem }>(`/admin/resellers/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  });
}

export async function deleteAdminReseller(id: string): Promise<{
  statusCode: number;
  message: string;
}> {
  return await request<{ statusCode: number; message: string }>(`/admin/resellers/${id}`, {
    method: 'DELETE'
  });
}
