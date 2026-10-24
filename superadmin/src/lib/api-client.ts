/**
 * AweerMarket Super Admin API Client
 * Cookie-aware fetch wrapper communicating with Fastify backend on port 4000.
 */

import type { UserSummary, UserRole } from '@aweermarket/types';

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
  const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

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
