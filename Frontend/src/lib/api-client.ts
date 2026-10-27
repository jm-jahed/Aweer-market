/**
 * AweerMarket Frontend API Client
 * Centralized, typed, cookie-aware HTTP client using native fetch.
 * Strictly communicates session state via HTTP-only cookies without storing tokens in browser storage.
 */

import type { UserSummary, ProductItem, ProductOfferSummary } from '@aweermarket/types';
import type { RegisterBuyerInput, LoginInput, CreateOrderInput } from '@aweermarket/validation';


export class ApiClientError extends Error {
  readonly statusCode: number;
  readonly errorTitle?: string;

  constructor(message: string, statusCode: number, errorTitle?: string) {
    super(message);
    this.name = 'ApiClientError';
    this.statusCode = statusCode;
    this.errorTitle = errorTitle;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Resolves the full URL for a given API endpoint path.
 * Normalizes NEXT_PUBLIC_API_URL and prevents duplicate '/api/v1' path segments.
 */
export function resolveApiUrl(path: string): string {
  const envUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1').trim();
  const cleanBase = envUrl.replace(/\/+$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  // If base already ends with /api/v1 (e.g. http://localhost:4000/api/v1)
  if (cleanBase.endsWith('/api/v1')) {
    // If path also starts with /api/v1, strip it to prevent duplicate (/api/v1/api/v1)
    const normalizedPath = cleanPath.startsWith('/api/v1')
      ? cleanPath.substring('/api/v1'.length)
      : cleanPath;
    return `${cleanBase}${normalizedPath}`;
  }

  // Base does not end with /api/v1 (e.g. http://localhost:4000)
  if (cleanPath.startsWith('/api/v1')) {
    return `${cleanBase}${cleanPath}`;
  }
  return `${cleanBase}/api/v1${cleanPath}`;
}

export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

export interface RegisterResponse {
  statusCode: number;
  message: string;
  user: UserSummary;
}

export interface LoginResponse {
  statusCode: number;
  message: string;
  user: UserSummary;
}

export interface AuthMeResponse {
  statusCode: number;
  user: UserSummary;
}

export interface LogoutResponse {
  statusCode: number;
  message: string;
}

export interface CategoryItem {
  id?: string;
  name?: string;
  slug?: string;
  key: string;
  label: string;
  description?: string;
  icon?: string;
  bannerUrl?: string;
  sortOrder?: number;
}

export interface CategoriesResponse {
  statusCode: number;
  categories: CategoryItem[];
}

export interface ProductsResponse {
  statusCode: number;
  products: ProductItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ProductDetailResponse {
  statusCode: number;
  product: ProductItem;
}

export interface ShopPublicSummary {
  id: string;
  name: string;
  slug: string;
  stallNumber: string;
  phone: string;
  tradeLicenseNumber?: string;
  isApproved: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface ShopsResponse {
  statusCode: number;
  shops: ShopPublicSummary[];
}

export interface ShopStorefrontProduct {
  id: string;
  name: string;
  category: string;
  originCountry: string;
  description: string;
  imageUrl?: string;
  offers: ProductOfferSummary[];
}

export interface ShopStorefrontResponse {
  statusCode: number;
  shop: ShopPublicSummary;
  products: ShopStorefrontProduct[];
}

/**
 * Generic API request executor.
 * - Always sends credentials: 'include' for secure HTTP-only session cookie transmission.
 * - Safely handles JSON and empty/non-JSON responses without throwing unexpected parse errors.
 * - Sanitizes errors for 400, 401, 403, 409, 503, and network failures.
 * - Never logs or persists authentication tokens in browser storage or application state.
 */
export async function apiRequest<T>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
  const url = resolveApiUrl(endpoint);
  const headers = new Headers(options.headers || {});

  let body: BodyInit | undefined;
  if (options.body !== undefined) {
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    body = JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      method: options.method || 'GET',
      headers,
      body,
      credentials: 'include' // Enforce HTTP-only session cookie transmission
    });
  } catch (_err: unknown) {
    throw new ApiClientError(
      'Unable to connect to the marketplace server. Please check your connection.',
      0,
      'NetworkError'
    );
  }

  // Safely parse JSON or empty response
  let data: any = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    try {
      const text = await response.text();
      data = text ? { message: text } : null;
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const statusCode = response.status;
    let errorTitle = data?.error || (statusCode === 503 ? 'Service Unavailable' : 'Error');
    let message: string;

    if (statusCode === 503) {
      errorTitle = 'Service Unavailable';
      message = data?.message || 'Service temporarily unavailable. Please try again later.';
    } else if (statusCode === 401) {
      message = data?.message || 'Invalid email or password';
    } else if (statusCode === 403) {
      message = data?.message || 'Access denied';
    } else if (statusCode === 409) {
      message = data?.message || 'An account with this email already exists';
    } else if (statusCode === 400) {
      message = data?.message || 'Invalid request parameters';
    } else if (statusCode >= 500) {
      errorTitle = 'Internal Server Error';
      message = 'An unexpected server error occurred. Please try again later.';
    } else {
      message = data?.message || `Request failed with status ${statusCode}`;
    }

    throw new ApiClientError(message, statusCode, errorTitle);
  }

  return (data || {}) as T;
}

/**
 * Registers a new Buyer account.
 * Endpoint: POST /api/v1/auth/register
 */
export async function registerBuyer(input: RegisterBuyerInput): Promise<RegisterResponse> {
  return await apiRequest<RegisterResponse>('/auth/register', {
    method: 'POST',
    body: input
  });
}

/**
 * Authenticates buyer credentials.
 * Endpoint: POST /api/v1/auth/login
 */
export async function loginBuyer(input: LoginInput): Promise<LoginResponse> {
  return await apiRequest<LoginResponse>('/auth/login', {
    method: 'POST',
    body: input
  });
}

/**
 * Retrieves the currently authenticated buyer profile.
 * Endpoint: GET /api/v1/auth/me
 */
export async function getAuthMe(): Promise<AuthMeResponse> {
  return await apiRequest<AuthMeResponse>('/auth/me', {
    method: 'GET'
  });
}

/**
 * Logs out the buyer and clears the session cookie.
 * Endpoint: POST /api/v1/auth/logout
 */
export async function logoutUser(): Promise<LogoutResponse> {
  return await apiRequest<LogoutResponse>('/auth/logout', {
    method: 'POST'
  });
}

/**
 * Retrieves all wholesale categories.
 * Endpoint: GET /api/v1/categories
 */
export async function getCategories(): Promise<CategoriesResponse> {
  return await apiRequest<CategoriesResponse>('/categories', {
    method: 'GET'
  });
}

/**
 * Queries the public wholesale produce catalog.
 * Endpoint: GET /api/v1/products
 */
export async function getProducts(params: {
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
} = {}): Promise<ProductsResponse> {
  const searchParams = new URLSearchParams();
  if (params.category) searchParams.set('category', params.category);
  if (params.search) searchParams.set('search', params.search);
  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));

  const queryStr = searchParams.toString();
  const endpoint = queryStr ? `/products?${queryStr}` : '/products';

  return await apiRequest<ProductsResponse>(endpoint, {
    method: 'GET'
  });
}

/**
 * Retrieves full details and multi-stall offers for a single produce item.
 * Endpoint: GET /api/v1/products/:id
 */
export async function getProductById(id: string): Promise<ProductDetailResponse> {
  return await apiRequest<ProductDetailResponse>(`/products/${id}`, {
    method: 'GET'
  });
}

/**
 * Retrieves all approved public wholesale stalls.
 * Endpoint: GET /api/v1/shops
 */
export async function getShops(): Promise<ShopsResponse> {
  return await apiRequest<ShopsResponse>('/shops', {
    method: 'GET'
  });
}

/**
 * Retrieves an approved stall's public storefront with its active offers.
 * Endpoint: GET /api/v1/shops/:id
 */
export async function getShopById(id: string): Promise<ShopStorefrontResponse> {
  return await apiRequest<ShopStorefrontResponse>(`/shops/${id}`, {
    method: 'GET'
  });
}

export interface OrderItemSummary {
  productId: string;
  name: string;
  unit: string;
  unitWeightKg: number;
  quantity: number;
  unitPriceAed: number;
  lineTotalAed: number;
}

export interface OrderSummary {
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
  items: OrderItemSummary[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrderResponse {
  statusCode: number;
  message: string;
  order: OrderSummary;
}

export interface OrdersListResponse {
  statusCode: number;
  orders: OrderSummary[];
}

export interface OrderDetailResponse {
  statusCode: number;
  order: OrderSummary;
}

/**
 * Creates a wholesale order with server-authoritative pricing and stock reservation.
 * Endpoint: POST /api/v1/orders
 */
export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResponse> {
  return await apiRequest<CreateOrderResponse>('/orders', {
    method: 'POST',
    body: input
  });
}

/**
 * Retrieves all past orders placed by the authenticated buyer.
 * Endpoint: GET /api/v1/orders
 */
export async function getBuyerOrders(): Promise<OrdersListResponse> {
  return await apiRequest<OrdersListResponse>('/orders', {
    method: 'GET'
  });
}

/**
 * Retrieves full details for a single buyer order.
 * Endpoint: GET /api/v1/orders/:id
 */
export async function getBuyerOrderById(id: string): Promise<OrderDetailResponse> {
  return await apiRequest<OrderDetailResponse>(`/orders/${id}`, {
    method: 'GET'
  });
}


