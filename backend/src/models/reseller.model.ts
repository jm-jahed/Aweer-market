import mongoose, { Schema, Document, Model } from 'mongoose';
import { ResellerItem, ResellerStatus, ResellerTier, ResellerPaymentTerms } from '@aweermarket/types';
import type { CreateResellerInput, UpdateResellerInput } from '@aweermarket/validation';
import { isDatabaseConnected } from '../plugins/db.js';

export interface IResellerDocument extends Document {
  businessName: string;
  contactPerson: string;
  email: string;
  phone: string;
  tradeLicenseNumber: string;
  tier: string;
  discountPercent: number;
  creditLimitAed: number;
  outstandingBalanceAed: number;
  paymentTerms: string;
  status: string;
  totalOrders: number;
  totalSpentAed: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  toItem(): ResellerItem;
}

const ResellerSchema = new Schema<IResellerDocument>(
  {
    businessName: {
      type: String,
      required: [true, 'Business name is required'],
      trim: true
    },
    contactPerson: {
      type: String,
      required: [true, 'Contact person is required'],
      trim: true
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },
    phone: {
      type: String,
      required: [true, 'Phone is required'],
      trim: true
    },
    tradeLicenseNumber: {
      type: String,
      required: [true, 'Trade license number is required'],
      trim: true
    },
    tier: {
      type: String,
      enum: ['bronze', 'silver', 'gold', 'platinum'],
      default: 'bronze',
      index: true
    },
    discountPercent: {
      type: Number,
      default: 5
    },
    creditLimitAed: {
      type: Number,
      default: 10000
    },
    outstandingBalanceAed: {
      type: Number,
      default: 0
    },
    paymentTerms: {
      type: String,
      enum: ['cash_on_delivery', 'net_15', 'net_30', 'net_60'],
      default: 'net_15'
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'suspended', 'rejected'],
      default: 'pending',
      index: true
    },
    totalOrders: {
      type: Number,
      default: 0
    },
    totalSpentAed: {
      type: Number,
      default: 0
    },
    notes: {
      type: String,
      default: '',
      trim: true
    }
  },
  {
    timestamps: true
  }
);

ResellerSchema.methods.toItem = function (): ResellerItem {
  return {
    id: this._id.toString(),
    businessName: this.businessName,
    contactPerson: this.contactPerson,
    email: this.email,
    phone: this.phone,
    tradeLicenseNumber: this.tradeLicenseNumber,
    tier: this.tier,
    discountPercent: this.discountPercent,
    creditLimitAed: this.creditLimitAed,
    outstandingBalanceAed: this.outstandingBalanceAed ?? 0,
    paymentTerms: this.paymentTerms,
    status: this.status,
    totalOrders: this.totalOrders ?? 0,
    totalSpentAed: this.totalSpentAed ?? 0,
    notes: this.notes || '',
    createdAt: this.createdAt.toISOString(),
    updatedAt: this.updatedAt.toISOString()
  };
};

export const ResellerModel: Model<IResellerDocument> =
  mongoose.models.Reseller || mongoose.model<IResellerDocument>('Reseller', ResellerSchema);

// ============================================================================
// Default Seed Resellers
// ============================================================================

export const DEFAULT_RESELLERS: Array<CreateResellerInput & { outstandingBalanceAed: number; totalOrders: number; totalSpentAed: number }> = [
  {
    businessName: 'Dubai Gulf Fresh Distribution LLC',
    contactPerson: 'Sultan Al Qasimi',
    email: 'sultan@gulffresh.ae',
    phone: '+971501112233',
    tradeLicenseNumber: 'TL-DXB-88221',
    tier: 'gold',
    discountPercent: 8,
    creditLimitAed: 50000,
    outstandingBalanceAed: 14200,
    paymentTerms: 'net_30',
    status: 'approved',
    totalOrders: 34,
    totalSpentAed: 245000,
    notes: 'Primary B2B sub-distributor delivering produce to Deira & Bur Dubai supermarkets.'
  },
  {
    businessName: 'Emirates Horeca Produce Supply',
    contactPerson: 'Kareem Mansoor',
    email: 'orders@emirateshoreca.ae',
    phone: '+971504445566',
    tradeLicenseNumber: 'TL-DXB-99334',
    tier: 'silver',
    discountPercent: 5,
    creditLimitAed: 25000,
    outstandingBalanceAed: 6800,
    paymentTerms: 'net_15',
    status: 'approved',
    totalOrders: 18,
    totalSpentAed: 112500,
    notes: 'Commercial hotel and fine dining restaurant supply partner in Downtown Dubai.'
  },
  {
    businessName: 'Al Barakah Wholesale Grocers Network',
    contactPerson: 'Farhan Zaidi',
    email: 'farhan@albarakahgrocers.ae',
    phone: '+971507778899',
    tradeLicenseNumber: 'TL-SHJ-44552',
    tier: 'bronze',
    discountPercent: 3,
    creditLimitAed: 10000,
    outstandingBalanceAed: 0,
    paymentTerms: 'cash_on_delivery',
    status: 'pending',
    totalOrders: 2,
    totalSpentAed: 8400,
    notes: 'New wholesale grocery applicant requesting tier upgrade after initial deliveries.'
  }
];

// ============================================================================
// Dual-Mode In-Memory Repository (Test and Offline Environments)
// ============================================================================

export class InMemoryReseller {
  id: string;
  businessName: string;
  contactPerson: string;
  email: string;
  phone: string;
  tradeLicenseNumber: string;
  tier: string;
  discountPercent: number;
  creditLimitAed: number;
  outstandingBalanceAed: number;
  paymentTerms: string;
  status: string;
  totalOrders: number;
  totalSpentAed: number;
  notes: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(data: any) {
    this.id = data.id || `reseller_${Math.random().toString(36).substring(2, 11)}`;
    this.businessName = data.businessName;
    this.contactPerson = data.contactPerson;
    this.email = data.email.toLowerCase().trim();
    this.phone = data.phone;
    this.tradeLicenseNumber = data.tradeLicenseNumber;
    this.tier = data.tier || 'bronze';
    this.discountPercent = data.discountPercent ?? 5;
    this.creditLimitAed = data.creditLimitAed ?? 10000;
    this.outstandingBalanceAed = data.outstandingBalanceAed ?? 0;
    this.paymentTerms = data.paymentTerms || 'net_15';
    this.status = data.status || 'pending';
    this.totalOrders = data.totalOrders ?? 0;
    this.totalSpentAed = data.totalSpentAed ?? 0;
    this.notes = data.notes || '';
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
    this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
  }

  toItem(): ResellerItem {
    return {
      id: this.id,
      businessName: this.businessName,
      contactPerson: this.contactPerson,
      email: this.email,
      phone: this.phone,
      tradeLicenseNumber: this.tradeLicenseNumber,
      tier: this.tier,
      discountPercent: this.discountPercent,
      creditLimitAed: this.creditLimitAed,
      outstandingBalanceAed: this.outstandingBalanceAed,
      paymentTerms: this.paymentTerms,
      status: this.status,
      totalOrders: this.totalOrders,
      totalSpentAed: this.totalSpentAed,
      notes: this.notes,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString()
    };
  }
}

// ============================================================================
// Database Availability Error & In-Memory Gating
// ============================================================================

export class DatabaseUnavailableError extends Error {
  readonly statusCode: number = 503;
  readonly code: string = 'DATABASE_UNAVAILABLE';

  constructor(message = 'Database service is unavailable. Reseller data cannot be persisted.') {
    super(message);
    this.name = 'DatabaseUnavailableError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

let inMemoryStoreAllowedInTest = false;

/**
 * Explicit test-only mechanism to enable isolated in-memory storage.
 * In production (NODE_ENV === 'production'), this ALWAYS fails closed.
 */
export function setInMemoryResellerStoreAllowed(allowed: boolean): void {
  if (process.env.NODE_ENV === 'production' && allowed) {
    throw new DatabaseUnavailableError('In-memory reseller store is strictly prohibited in production');
  }
  inMemoryStoreAllowedInTest = allowed;
}

export function isInMemoryResellerStoreAllowed(): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  return inMemoryStoreAllowedInTest && (process.env.NODE_ENV === 'test' || process.env.ALLOW_IN_MEMORY_DB === 'true');
}

const inMemoryResellersById = new Map<string, InMemoryReseller>();
const inMemoryResellersByEmail = new Map<string, string>();

export function resetInMemoryResellers(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new DatabaseUnavailableError('Resetting in-memory store is strictly prohibited in production');
  }
  inMemoryResellersById.clear();
  inMemoryResellersByEmail.clear();
  for (const seed of DEFAULT_RESELLERS) {
    const r = new InMemoryReseller(seed);
    inMemoryResellersById.set(r.id, r);
    inMemoryResellersByEmail.set(r.email, r.id);
  }
}

// Pre-populate memory store for test environment only
if (process.env.NODE_ENV === 'test') {
  resetInMemoryResellers();
}

// ============================================================================
// Service / Repository Methods
// ============================================================================

export async function ensureDefaultResellers(): Promise<void> {
  if (isDatabaseConnected()) {
    const count = await ResellerModel.countDocuments();
    if (count === 0) {
      for (const item of DEFAULT_RESELLERS) {
        await ResellerModel.create(item);
      }
    }
  }
}

export async function listAllResellers(filter?: { status?: string; tier?: string }): Promise<ResellerItem[]> {
  if (isDatabaseConnected()) {
    try {
      await ensureDefaultResellers();
      const query: any = {};
      if (filter?.status) query.status = filter.status;
      if (filter?.tier) query.tier = filter.tier;
      const docs = await ResellerModel.find(query).sort({ createdAt: -1 });
      return docs.map((d) => d.toItem());
    } catch (err: any) {
      throw new DatabaseUnavailableError(`Database read failure: ${err.message || 'Unable to retrieve reseller records'}`);
    }
  }

  if (!isInMemoryResellerStoreAllowed()) {
    throw new DatabaseUnavailableError('Database is disconnected. Cannot retrieve persistent reseller data.');
  }

  let list = Array.from(inMemoryResellersById.values());
  if (filter?.status) {
    list = list.filter((r) => r.status === filter.status);
  }
  if (filter?.tier) {
    list = list.filter((r) => r.tier === filter.tier);
  }
  return list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).map((r) => r.toItem());
}

export async function findResellerById(id: string): Promise<ResellerItem | null> {
  if (isDatabaseConnected()) {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) return null;
      const doc = await ResellerModel.findById(id);
      return doc ? doc.toItem() : null;
    } catch (err: any) {
      throw new DatabaseUnavailableError(`Database query failure: ${err.message || 'Unable to retrieve reseller'}`);
    }
  }

  if (!isInMemoryResellerStoreAllowed()) {
    throw new DatabaseUnavailableError('Database is disconnected. Cannot retrieve persistent reseller data.');
  }

  const r = inMemoryResellersById.get(id);
  return r ? r.toItem() : null;
}

export async function findResellerByEmail(email: string): Promise<ResellerItem | null> {
  const normEmail = email.toLowerCase().trim();
  if (isDatabaseConnected()) {
    try {
      const doc = await ResellerModel.findOne({ email: normEmail });
      return doc ? doc.toItem() : null;
    } catch (err: any) {
      throw new DatabaseUnavailableError(`Database query failure: ${err.message || 'Unable to check reseller email'}`);
    }
  }

  if (!isInMemoryResellerStoreAllowed()) {
    throw new DatabaseUnavailableError('Database is disconnected. Cannot verify persistent reseller uniqueness.');
  }

  const id = inMemoryResellersByEmail.get(normEmail);
  if (!id) return null;
  const r = inMemoryResellersById.get(id);
  return r ? r.toItem() : null;
}

export async function createReseller(data: CreateResellerInput): Promise<ResellerItem> {
  const normEmail = data.email.toLowerCase().trim();
  const existing = await findResellerByEmail(normEmail);
  if (existing) {
    const err = new Error(`Reseller with email '${normEmail}' already exists`);
    (err as any).statusCode = 409;
    throw err;
  }

  if (isDatabaseConnected()) {
    try {
      const doc = await ResellerModel.create({
        ...data,
        email: normEmail
      });
      return doc.toItem();
    } catch (err: any) {
      if (err.code === 11000) {
        const conflictErr = new Error(`Reseller with email '${normEmail}' already exists`);
        (conflictErr as any).statusCode = 409;
        throw conflictErr;
      }
      throw new DatabaseUnavailableError(`Database write failure: ${err.message || 'Unable to persist reseller record'}`);
    }
  }

  if (!isInMemoryResellerStoreAllowed()) {
    throw new DatabaseUnavailableError('Database is disconnected. Reseller creation rejected in fail-closed mode.');
  }

  const rec = new InMemoryReseller({
    ...data,
    email: normEmail
  });
  inMemoryResellersById.set(rec.id, rec);
  inMemoryResellersByEmail.set(normEmail, rec.id);
  return rec.toItem();
}

export async function updateReseller(id: string, data: UpdateResellerInput): Promise<ResellerItem | null> {
  if (isDatabaseConnected()) {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) return null;
      if (data.email) {
        const normEmail = data.email.toLowerCase().trim();
        const existing = await ResellerModel.findOne({ email: normEmail, _id: { $ne: id } });
        if (existing) {
          const err = new Error(`Reseller with email '${normEmail}' already exists`);
          (err as any).statusCode = 409;
          throw err;
        }
      }
      const doc = await ResellerModel.findByIdAndUpdate(
        id,
        { $set: data },
        { new: true, runValidators: true }
      );
      return doc ? doc.toItem() : null;
    } catch (err: any) {
      if ((err as any).statusCode === 409) throw err;
      if (err.code === 11000) {
        const conflictErr = new Error(`Reseller with email '${data.email}' already exists`);
        (conflictErr as any).statusCode = 409;
        throw conflictErr;
      }
      throw new DatabaseUnavailableError(`Database write failure: ${err.message || 'Unable to update reseller record'}`);
    }
  }

  if (!isInMemoryResellerStoreAllowed()) {
    throw new DatabaseUnavailableError('Database is disconnected. Reseller update rejected in fail-closed mode.');
  }

  const rec = inMemoryResellersById.get(id);
  if (!rec) return null;

  if (data.email) {
    const normEmail = data.email.toLowerCase().trim();
    if (normEmail !== rec.email) {
      const existingId = inMemoryResellersByEmail.get(normEmail);
      if (existingId && existingId !== id) {
        const err = new Error(`Reseller with email '${normEmail}' already exists`);
        (err as any).statusCode = 409;
        throw err;
      }
      inMemoryResellersByEmail.delete(rec.email);
      inMemoryResellersByEmail.set(normEmail, id);
      rec.email = normEmail;
    }
  }

  if (data.businessName !== undefined) rec.businessName = data.businessName.trim();
  if (data.contactPerson !== undefined) rec.contactPerson = data.contactPerson.trim();
  if (data.phone !== undefined) rec.phone = data.phone.trim();
  if (data.tradeLicenseNumber !== undefined) rec.tradeLicenseNumber = data.tradeLicenseNumber.trim();
  if (data.tier !== undefined) rec.tier = data.tier;
  if (data.discountPercent !== undefined) rec.discountPercent = data.discountPercent;
  if (data.creditLimitAed !== undefined) rec.creditLimitAed = data.creditLimitAed;
  if (data.paymentTerms !== undefined) rec.paymentTerms = data.paymentTerms;
  if (data.status !== undefined) rec.status = data.status;
  if (data.notes !== undefined) rec.notes = data.notes.trim();
  rec.updatedAt = new Date();

  return rec.toItem();
}

export async function setResellerStatus(id: string, status: string): Promise<ResellerItem | null> {
  return await updateReseller(id, { status: status as any });
}

export async function deleteReseller(id: string): Promise<{ success: boolean; message?: string }> {
  const r = await findResellerById(id);
  if (!r) {
    return { success: false, message: 'Reseller not found' };
  }

  if (r.outstandingBalanceAed > 0) {
    return {
      success: false,
      message: `Cannot delete reseller with outstanding credit balance of Dhs ${r.outstandingBalanceAed.toFixed(2)}. Suspend account instead.`
    };
  }

  if (isDatabaseConnected()) {
    try {
      await ResellerModel.findByIdAndDelete(id);
      return { success: true };
    } catch (err: any) {
      throw new DatabaseUnavailableError(`Database delete failure: ${err.message || 'Unable to delete reseller record'}`);
    }
  }

  if (!isInMemoryResellerStoreAllowed()) {
    throw new DatabaseUnavailableError('Database is disconnected. Reseller deletion rejected in fail-closed mode.');
  }

  inMemoryResellersByEmail.delete(r.email);
  inMemoryResellersById.delete(id);
  return { success: true };
}

export async function countResellers(): Promise<{ total: number; approved: number; pending: number; suspended: number }> {
  if (isDatabaseConnected()) {
    try {
      await ensureDefaultResellers();
      const [total, approved, pending, suspended] = await Promise.all([
        ResellerModel.countDocuments(),
        ResellerModel.countDocuments({ status: 'approved' }),
        ResellerModel.countDocuments({ status: 'pending' }),
        ResellerModel.countDocuments({ status: 'suspended' })
      ]);
      return { total, approved, pending, suspended };
    } catch (err: any) {
      throw new DatabaseUnavailableError(`Database query failure: ${err.message || 'Unable to count resellers'}`);
    }
  }

  if (!isInMemoryResellerStoreAllowed()) {
    throw new DatabaseUnavailableError('Database is disconnected. Cannot count persistent resellers.');
  }

  const list = Array.from(inMemoryResellersById.values());
  return {
    total: list.length,
    approved: list.filter((r) => r.status === 'approved').length,
    pending: list.filter((r) => r.status === 'pending').length,
    suspended: list.filter((r) => r.status === 'suspended').length
  };
}
