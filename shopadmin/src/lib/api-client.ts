/**
 * AweerMarket Shop Admin API Client
 * Cookie-aware fetch wrapper communicating with Fastify backend on port 4000.
 */

import type { UserSummary, ProductItem } from '@aweermarket/types';
import type {
  RegisterVendorInput,
  UpdateShopProfileInput,
  CreateProductInput,
  UpdateProductOfferInput
} from '@aweermarket/validation';

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

export interface VendorShopSummary {
  id: string;
  name: string;
  slug: string;
  stallNumber: string;
  phone: string;
  tradeLicenseNumber?: string;
  logoUrl?: string;
  coverImageUrl?: string;
  address?: string;
  openingHours?: string;
  weeklySchedule?: string;
  marketLocation?: string;
  isApproved: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface AuthVendorResponse {
  statusCode: number;
  message?: string;
  token?: string;
  user: UserSummary;
  shop: VendorShopSummary | null;
}

export async function vendorRegister(data: RegisterVendorInput): Promise<AuthVendorResponse> {
  return await request<AuthVendorResponse>('/auth/vendor/register', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export async function vendorLogin(email: string, password: string): Promise<AuthVendorResponse> {
  return await request<AuthVendorResponse>('/auth/vendor/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
}

export async function getVendorMe(): Promise<{ statusCode: number; user: UserSummary; shop: VendorShopSummary | null }> {
  return await request<{ statusCode: number; user: UserSummary; shop: VendorShopSummary | null }>('/auth/vendor/me', {
    method: 'GET'
  });
}

export async function vendorLogout(): Promise<{ statusCode: number; message: string }> {
  return await request<{ statusCode: number; message: string }>('/auth/logout', {
    method: 'POST'
  });
}

export async function getVendorShop(): Promise<{ statusCode: number; shop: VendorShopSummary }> {
  return await request<{ statusCode: number; shop: VendorShopSummary }>('/vendor/shop', {
    method: 'GET'
  });
}

export async function updateVendorShop(data: UpdateShopProfileInput): Promise<{ statusCode: number; message: string; shop: VendorShopSummary }> {
  return await request<{ statusCode: number; message: string; shop: VendorShopSummary }>('/vendor/shop', {
    method: 'PATCH',
    body: JSON.stringify(data)
  });
}

export interface VendorProductOffer {
  shopId: string;
  shopName: string;
  stallNumber?: string;
  unit: string;
  unitWeightKg: number;
  priceAed: number;
  equivalentPricePerKg: number;
  minOrderQuantity: number;
  availableStock: number;
  isActive: boolean;
}

export interface VendorProductItem {
  id: string;
  name: string;
  category: string;
  originCountry: string;
  description: string;
  imageUrl?: string;
  lowestPriceAedPerKg: number;
  offer: VendorProductOffer | null;
}

export async function getVendorProducts(): Promise<{ statusCode: number; products: VendorProductItem[] }> {
  return await request<{ statusCode: number; products: VendorProductItem[] }>('/vendor/products', {
    method: 'GET'
  });
}

export async function createVendorProduct(data: CreateProductInput): Promise<{ statusCode: number; message: string; product: ProductItem }> {
  return await request<{ statusCode: number; message: string; product: ProductItem }>('/vendor/products', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export async function updateVendorOffer(
  productId: string,
  data: UpdateProductOfferInput
): Promise<{ statusCode: number; message: string; product: ProductItem }> {
  return await request<{ statusCode: number; message: string; product: ProductItem }>(`/vendor/products/${productId}/offer`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  });
}

export async function toggleVendorProductPublish(
  productId: string,
  isActive: boolean
): Promise<{ statusCode: number; message: string; product: ProductItem }> {
  return await updateVendorOffer(productId, { isActive });
}

export async function adjustVendorProductStock(
  productId: string,
  newStock: number
): Promise<{ statusCode: number; message: string; product: ProductItem }> {
  return await updateVendorOffer(productId, { availableStock: newStock });
}

export async function deleteVendorProduct(
  productId: string
): Promise<{ statusCode: number; message: string; deleted: boolean; remainingOffers: number }> {
  return await request<{ statusCode: number; message: string; deleted: boolean; remainingOffers: number }>(`/vendor/products/${productId}`, {
    method: 'DELETE'
  });
}

export interface VendorOrderItem {
  productId: string;
  name: string;
  unit: string;
  unitWeightKg: number;
  quantity: number;
  unitPriceAed: number;
  lineTotalAed: number;
}

export interface VendorOrderSummary {
  id: string;
  orderNumber: string;
  buyerId: string;
  shopId: string;
  shopName: string;
  stallNumber?: string;
  deliveryType: string;
  deliveryAddress?: string;
  pickupTime?: string;
  status: string;
  totalAmountAed: number;
  items: VendorOrderItem[];
  createdAt: string;
  updatedAt: string;
}

export async function getVendorOrders(): Promise<{ statusCode: number; orders: VendorOrderSummary[] }> {
  return await request<{ statusCode: number; orders: VendorOrderSummary[] }>('/vendor/orders', {
    method: 'GET'
  });
}

export async function updateVendorOrderStatus(
  orderId: string,
  status: string
): Promise<{ statusCode: number; message: string; order: VendorOrderSummary }> {
  return await request<{ statusCode: number; message: string; order: VendorOrderSummary }>(`/vendor/orders/${orderId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  });
}

export interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  bannerUrl?: string;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
}

export async function getCategories(): Promise<{ statusCode: number; categories: CategoryItem[] }> {
  return await request<{ statusCode: number; categories: CategoryItem[] }>('/categories', {
    method: 'GET'
  });
}

export interface UploadImageResponse {
  statusCode: number;
  message: string;
  url: string;
  key: string;
  size: number;
  mimeType: string;
}

export async function uploadProductImage(file: File): Promise<UploadImageResponse> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/vendor/upload`;
  const formData = new FormData();
  formData.append('image', file);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Network connection failure';
    throw new ApiClientError(`Unable to connect to image upload endpoint (${errorMsg})`, 0, 'NETWORK_ERROR');
  }

  const text = await response.text();
  let data: Record<string, unknown> = {};
  if (text && text.trim().length > 0) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!response.ok) {
    const message = (data.message as string) || 'Image upload failed. Please verify file type (JPEG, PNG, WebP) and size (< 5MB).';
    throw new ApiClientError(message, response.status, data.code as string | undefined);
  }
  return data as unknown as UploadImageResponse;
}

export async function deleteProductImage(key: string): Promise<{ statusCode: number; message: string; key: string }> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/vendor/upload`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ key }),
      credentials: 'include'
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Network connection failure';
    throw new ApiClientError(`Unable to connect to image deletion endpoint (${errorMsg})`, 0, 'NETWORK_ERROR');
  }

  const text = await response.text();
  let data: Record<string, unknown> = {};
  if (text && text.trim().length > 0) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!response.ok) {
    const message = (data.message as string) || 'Image deletion failed.';
    throw new ApiClientError(message, response.status, data.code as string | undefined);
  }

  return data as unknown as { statusCode: number; message: string; key: string };
}



