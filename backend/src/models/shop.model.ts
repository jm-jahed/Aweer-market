import mongoose, { Schema, Document, Model } from 'mongoose';
import { isDatabaseConnected } from '../plugins/db.js';

export interface IShopDocument extends Document {
  name: string;
  slug: string;
  stallNumber: string;
  ownerId: string;
  resellerId?: string;
  tradeLicenseNumber: string;
  phone: string;
  description?: string;
  logoUrl?: string;
  coverImageUrl?: string;
  address?: string;
  openingHours?: string;
  weeklySchedule?: string;
  marketLocation?: string;
  isApproved: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  toPublicSummary(): ShopPublicSummary;
}

export interface ShopPublicSummary {
  id: string;
  name: string;
  slug: string;
  stallNumber: string;
  ownerId?: string;
  resellerId?: string;
  phone: string;
  description?: string;
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

const ShopSchema = new Schema<IShopDocument>(
  {
    name: {
      type: String,
      required: [true, 'Shop name is required'],
      trim: true
    },
    slug: {
      type: String,
      required: [true, 'Shop slug is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },
    stallNumber: {
      type: String,
      required: [true, 'Al Aweer stall number is required'],
      trim: true
    },
    ownerId: {
      type: String,
      required: [true, 'Owner ID is required'],
      index: true
    },
    resellerId: {
      type: String,
      trim: true,
      sparse: true,
      index: true
    },
    tradeLicenseNumber: {
      type: String,
      required: [true, 'Trade license number is required'],
      trim: true
    },
    phone: {
      type: String,
      required: [true, 'Contact phone is required'],
      trim: true
    },
    description: { type: String, trim: true, default: '' },
    logoUrl: { type: String, trim: true, default: '' },
    coverImageUrl: { type: String, trim: true, default: '' },
    address: { type: String, trim: true, default: '' },
    openingHours: { type: String, trim: true, default: '' },
    weeklySchedule: { type: String, trim: true, default: '' },
    marketLocation: { type: String, trim: true, default: '' },
    isApproved: {
      type: Boolean,
      default: false,
      index: true
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  {
    timestamps: true
  }
);

ShopSchema.methods.toPublicSummary = function (): ShopPublicSummary {
  return {
    id: this._id.toString(),
    name: this.name,
    slug: this.slug,
    stallNumber: this.stallNumber,
    ownerId: this.ownerId,
    resellerId: this.resellerId || undefined,
    phone: this.phone,
    description: this.description || '',
    logoUrl: this.logoUrl || '',
    coverImageUrl: this.coverImageUrl || '',
    address: this.address || '',
    openingHours: this.openingHours || '',
    weeklySchedule: this.weeklySchedule || '',
    marketLocation: this.marketLocation || '',
    isApproved: this.isApproved,
    isActive: this.isActive,
    createdAt: this.createdAt ? this.createdAt.toISOString() : new Date().toISOString()
  };
};

export const ShopModel: Model<IShopDocument> =
  mongoose.models.Shop || mongoose.model<IShopDocument>('Shop', ShopSchema);

// ============================================================================
// Dual-Mode In-Memory Repository for Test Environments
// ============================================================================

export interface ShopRecord {
  id: string;
  name: string;
  slug: string;
  stallNumber: string;
  ownerId: string;
  resellerId?: string;
  tradeLicenseNumber: string;
  phone: string;
  description?: string;
  logoUrl?: string;
  coverImageUrl?: string;
  address?: string;
  openingHours?: string;
  weeklySchedule?: string;
  marketLocation?: string;
  isApproved: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  toPublicSummary(): ShopPublicSummary;
}

const inMemoryShopsById = new Map<string, ShopRecord>();
const inMemoryShopsBySlug = new Map<string, string>(); // slug -> id
let shopIdCounter = 1;

function createInMemoryShopRecord(data: Omit<ShopRecord, 'toPublicSummary'>): ShopRecord {
  return {
    ...data,
    toPublicSummary(): ShopPublicSummary {
      return {
        id: this.id,
        name: this.name,
        slug: this.slug,
        stallNumber: this.stallNumber,
        ownerId: this.ownerId,
        resellerId: this.resellerId || undefined,
        phone: this.phone,
        description: this.description || '',
        logoUrl: this.logoUrl || '',
        coverImageUrl: this.coverImageUrl || '',
        address: this.address || '',
        openingHours: this.openingHours || '',
        weeklySchedule: this.weeklySchedule || '',
        marketLocation: this.marketLocation || '',
        isApproved: this.isApproved,
        isActive: this.isActive,
        createdAt: this.createdAt.toISOString()
      };
    }
  };
}

export class DatabaseUnavailableError extends Error {
  readonly statusCode: number = 503;
  readonly code: string = 'DATABASE_UNAVAILABLE';

  constructor(message = 'Database service is unavailable') {
    super(message);
    this.name = 'DatabaseUnavailableError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function isInMemoryShopStoreAllowed(): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  return process.env.NODE_ENV === 'test' || process.env.ALLOW_IN_MEMORY_DB === 'true';
}

export function resetInMemoryShops(): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new DatabaseUnavailableError('In-memory shop store is only permitted in test environment');
  }
  inMemoryShopsById.clear();
  inMemoryShopsBySlug.clear();
  shopIdCounter = 1;
}

export interface CreateShopData {
  name: string;
  slug?: string;
  stallNumber: string;
  ownerId: string;
  resellerId?: string;
  tradeLicenseNumber: string;
  phone: string;
  isApproved?: boolean;
  isActive?: boolean;
}

export async function createShop(data: CreateShopData): Promise<IShopDocument | ShopRecord> {
  const slug = (data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')).trim();

  if (isDatabaseConnected()) {
    return await ShopModel.create({
      name: data.name.trim(),
      slug,
      stallNumber: data.stallNumber.trim(),
      ownerId: data.ownerId,
      resellerId: data.resellerId?.trim() || undefined,
      tradeLicenseNumber: data.tradeLicenseNumber.trim(),
      phone: data.phone.trim(),
      isApproved: data.isApproved ?? false,
      isActive: data.isActive ?? true
    });
  }

  if (!isInMemoryShopStoreAllowed()) {
    throw new DatabaseUnavailableError('Database is disconnected. Shop creation rejected in fail-closed mode.');
  }

  if (inMemoryShopsBySlug.has(slug)) {
    const duplicateError = new Error(`E11000 duplicate key error collection: shops index: slug_1 dup key: { slug: "${slug}" }`);
    (duplicateError as unknown as { code: number }).code = 11000;
    throw duplicateError;
  }

  const id = `shop_${shopIdCounter++}_${Date.now()}`;
  const now = new Date();
  const record = createInMemoryShopRecord({
    id,
    name: data.name.trim(),
    slug,
    stallNumber: data.stallNumber.trim(),
    ownerId: data.ownerId,
    resellerId: data.resellerId?.trim() || undefined,
    tradeLicenseNumber: data.tradeLicenseNumber.trim(),
    phone: data.phone.trim(),
    isApproved: data.isApproved ?? false,
    isActive: data.isActive ?? true,
    createdAt: now,
    updatedAt: now
  });

  inMemoryShopsById.set(id, record);
  inMemoryShopsBySlug.set(slug, id);
  return record;
}

export async function findShopById(id: string): Promise<IShopDocument | ShopRecord | null> {
  if (isDatabaseConnected()) {
    return await ShopModel.findById(id).exec();
  }

  if (!isInMemoryShopStoreAllowed()) {
    throw new DatabaseUnavailableError('Database is disconnected. Operation rejected in fail-closed mode.');
  }

  return inMemoryShopsById.get(id) || null;
}

export async function findShopBySlug(slug: string): Promise<IShopDocument | ShopRecord | null> {
  const normalizedSlug = slug.toLowerCase().trim();
  if (isDatabaseConnected()) {
    return await ShopModel.findOne({ slug: normalizedSlug }).exec();
  }

  if (!isInMemoryShopStoreAllowed()) {
    throw new DatabaseUnavailableError('Database is disconnected. Operation rejected in fail-closed mode.');
  }

  const id = inMemoryShopsBySlug.get(normalizedSlug);
  return id ? inMemoryShopsById.get(id) || null : null;
}

export async function setShopApproval(id: string, isApproved: boolean): Promise<boolean> {
  if (isDatabaseConnected()) {
    const res = await ShopModel.updateOne({ _id: id }, { $set: { isApproved } });
    return res.modifiedCount > 0;
  }

  if (!isInMemoryShopStoreAllowed()) {
    throw new DatabaseUnavailableError('Database is disconnected. Operation rejected in fail-closed mode.');
  }

  const shop = inMemoryShopsById.get(id);
  if (shop) {
    shop.isApproved = isApproved;
    return true;
  }
  return false;
}

export async function setShopActiveStatus(id: string, isActive: boolean): Promise<boolean> {
  if (isDatabaseConnected()) {
    const res = await ShopModel.updateOne({ _id: id }, { $set: { isActive } });
    return res.modifiedCount > 0;
  }

  if (!isInMemoryShopStoreAllowed()) {
    throw new DatabaseUnavailableError('Database is disconnected. Operation rejected in fail-closed mode.');
  }

  const shop = inMemoryShopsById.get(id);
  if (shop) {
    shop.isActive = isActive;
    return true;
  }
  return false;
}

export async function findShopByOwnerId(ownerId: string): Promise<IShopDocument | ShopRecord | null> {
  if (isDatabaseConnected()) {
    return await ShopModel.findOne({ ownerId }).exec();
  }

  if (!isInMemoryShopStoreAllowed()) {
    throw new DatabaseUnavailableError('Database is disconnected. Operation rejected in fail-closed mode.');
  }

  const all = Array.from(inMemoryShopsById.values());
  return all.find((s) => s.ownerId === ownerId) || null;
}

export interface UpdateShopData {
  name?: string;
  phone?: string;
  stallNumber?: string;
  tradeLicenseNumber?: string;
  description?: string;
  logoUrl?: string;
  coverImageUrl?: string;
  address?: string;
  openingHours?: string;
  weeklySchedule?: string;
  marketLocation?: string;
}

export async function updateShop(id: string, updates: UpdateShopData): Promise<IShopDocument | ShopRecord | null> {
  if (isDatabaseConnected()) {
    const safeUpdates: Record<string, unknown> = {};
    if (updates.name !== undefined) safeUpdates.name = updates.name.trim();
    if (updates.phone !== undefined) safeUpdates.phone = updates.phone.trim();
    if (updates.stallNumber !== undefined) safeUpdates.stallNumber = updates.stallNumber.trim();
    if (updates.tradeLicenseNumber !== undefined) safeUpdates.tradeLicenseNumber = updates.tradeLicenseNumber.trim();
    if (updates.description !== undefined) safeUpdates.description = updates.description.trim();
    if (updates.logoUrl !== undefined) safeUpdates.logoUrl = updates.logoUrl.trim();
    if (updates.coverImageUrl !== undefined) safeUpdates.coverImageUrl = updates.coverImageUrl.trim();
    if (updates.address !== undefined) safeUpdates.address = updates.address.trim();
    if (updates.openingHours !== undefined) safeUpdates.openingHours = updates.openingHours.trim();
    if (updates.weeklySchedule !== undefined) safeUpdates.weeklySchedule = updates.weeklySchedule.trim();
    if (updates.marketLocation !== undefined) safeUpdates.marketLocation = updates.marketLocation.trim();

    return await ShopModel.findByIdAndUpdate(id, { $set: safeUpdates }, { new: true }).exec();
  }

  if (!isInMemoryShopStoreAllowed()) {
    throw new DatabaseUnavailableError('Database is disconnected. Operation rejected in fail-closed mode.');
  }

  const shop = inMemoryShopsById.get(id);
  if (!shop) return null;

  if (updates.name !== undefined) shop.name = updates.name.trim();
  if (updates.phone !== undefined) shop.phone = updates.phone.trim();
  if (updates.stallNumber !== undefined) shop.stallNumber = updates.stallNumber.trim();
  if (updates.tradeLicenseNumber !== undefined) shop.tradeLicenseNumber = updates.tradeLicenseNumber.trim();
  if (updates.description !== undefined) shop.description = updates.description.trim();
  if (updates.logoUrl !== undefined) shop.logoUrl = updates.logoUrl.trim();
  if (updates.coverImageUrl !== undefined) shop.coverImageUrl = updates.coverImageUrl.trim();
  if (updates.address !== undefined) shop.address = updates.address.trim();
  if (updates.openingHours !== undefined) shop.openingHours = updates.openingHours.trim();
  if (updates.weeklySchedule !== undefined) shop.weeklySchedule = updates.weeklySchedule.trim();
  if (updates.marketLocation !== undefined) shop.marketLocation = updates.marketLocation.trim();
  shop.updatedAt = new Date();

  return shop;
}

/**
 * Deletes a shop record and frees its unique slug.
 * Used for compensating rollbacks when vendor creation fails.
 */
export async function deleteShop(id: string): Promise<boolean> {
  if (isDatabaseConnected()) {
    const res = await ShopModel.deleteOne({ _id: id }).exec();
    return (res.deletedCount ?? 0) > 0;
  }

  if (!isInMemoryShopStoreAllowed()) {
    throw new DatabaseUnavailableError('Database is disconnected. Operation rejected in fail-closed mode.');
  }

  const shop = inMemoryShopsById.get(id);
  if (!shop) return false;
  inMemoryShopsById.delete(id);
  inMemoryShopsBySlug.delete(shop.slug);
  return true;
}

export async function listAllShops(filter?: { isApproved?: boolean; resellerId?: string }): Promise<Array<IShopDocument | ShopRecord>> {
  if (isDatabaseConnected()) {
    const q: Record<string, unknown> = {};
    if (filter?.isApproved !== undefined) q.isApproved = filter.isApproved;
    if (filter?.resellerId !== undefined) q.resellerId = filter.resellerId;
    return await ShopModel.find(q).sort({ createdAt: -1 }).exec();
  }

  if (!isInMemoryShopStoreAllowed()) {
    throw new DatabaseUnavailableError('Database is disconnected. Operation rejected in fail-closed mode.');
  }

  let list = Array.from(inMemoryShopsById.values());
  if (filter?.isApproved !== undefined) {
    list = list.filter((s) => s.isApproved === filter.isApproved);
  }
  if (filter?.resellerId !== undefined) {
    list = list.filter((s) => s.resellerId === filter.resellerId);
  }
  return list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function countShops(filter?: { resellerId?: string }): Promise<{ total: number; approved: number; pending: number }> {
  if (isDatabaseConnected()) {
    const qTotal: Record<string, unknown> = {};
    const qApproved: Record<string, unknown> = { isApproved: true };
    const qPending: Record<string, unknown> = { isApproved: false };

    if (filter?.resellerId !== undefined) {
      qTotal.resellerId = filter.resellerId;
      qApproved.resellerId = filter.resellerId;
      qPending.resellerId = filter.resellerId;
    }

    const [total, approved, pending] = await Promise.all([
      ShopModel.countDocuments(qTotal),
      ShopModel.countDocuments(qApproved),
      ShopModel.countDocuments(qPending)
    ]);
    return { total, approved, pending };
  }

  if (!isInMemoryShopStoreAllowed()) {
    throw new DatabaseUnavailableError('Database is disconnected. Operation rejected in fail-closed mode.');
  }

  let all = Array.from(inMemoryShopsById.values());
  if (filter?.resellerId !== undefined) {
    all = all.filter((s) => s.resellerId === filter.resellerId);
  }
  return {
    total: all.length,
    approved: all.filter((s) => s.isApproved).length,
    pending: all.filter((s) => !s.isApproved).length
  };
}
