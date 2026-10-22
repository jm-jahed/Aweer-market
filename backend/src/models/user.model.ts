import mongoose, { Schema, Document, Model } from 'mongoose';
import { UserRole, UserSummary } from '@aweermarket/types';
import { isDatabaseConnected } from '../plugins/db.js';

export interface IUserDocument extends Document {
  email: string;
  passwordHash: string;
  fullName: string;
  role: UserRole;
  shopId?: string;
  businessName?: string;
  phone?: string;
  tradeLicenseNumber?: string;
  isActive: boolean;
  isEmailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  toUserSummary(): UserSummary;
}

const UserSchema = new Schema<IUserDocument>(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      index: true
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
      select: false // Never exposed in default queries
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.BUYER,
      required: true,
      index: true
    },
    shopId: {
      type: String,
      trim: true,
      sparse: true,
      index: true
    },
    businessName: {
      type: String,
      trim: true
    },
    phone: {
      type: String,
      trim: true
    },
    tradeLicenseNumber: {
      type: String,
      trim: true
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    isEmailVerified: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

// Method to safely export user data without sensitive credentials
UserSchema.methods.toUserSummary = function (): UserSummary {
  return {
    id: this._id.toString(),
    email: this.email,
    fullName: this.fullName,
    role: this.role,
    shopId: this.shopId,
    vendorId: this.shopId,
    businessName: this.businessName,
    isActive: this.isActive,
    isEmailVerified: this.isEmailVerified,
    createdAt: this.createdAt ? this.createdAt.toISOString() : new Date().toISOString()
  };
};

export const UserModel: Model<IUserDocument> =
  mongoose.models.User || mongoose.model<IUserDocument>('User', UserSchema);

// ============================================================================
// Isolated In-Memory Data Store for Disconnected / Test Environments
// ============================================================================

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  role: UserRole;
  shopId?: string;
  businessName?: string;
  phone?: string;
  tradeLicenseNumber?: string;
  isActive: boolean;
  isEmailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  toUserSummary(): UserSummary;
}

const inMemoryUsersById = new Map<string, UserRecord>();
const inMemoryUsersByEmail = new Map<string, string>(); // email -> id
let idCounter = 1;

function createInMemoryRecord(data: Omit<UserRecord, 'toUserSummary'>): UserRecord {
  return {
    ...data,
    toUserSummary(): UserSummary {
      return {
        id: this.id,
        email: this.email,
        fullName: this.fullName,
        role: this.role,
        shopId: this.shopId,
        vendorId: this.shopId,
        businessName: this.businessName,
        isActive: this.isActive,
        isEmailVerified: this.isEmailVerified,
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

/**
 * Resets the in-memory test store between unit test runs.
 * Gated strictly to test environment.
 */
export function resetInMemoryUsers(): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new DatabaseUnavailableError('In-memory user store is only permitted in test environment');
  }
  inMemoryUsersById.clear();
  inMemoryUsersByEmail.clear();
  idCounter = 1;
}

export interface CreateBuyerData {
  email: string;
  passwordHash: string;
  fullName: string;
  phone?: string;
  businessName?: string;
  tradeLicenseNumber?: string;
}

/**
 * Looks up user by email with optional passwordHash inclusion.
 * Strictly requires active database connection in non-test runtime.
 * Falls back to isolated in-memory store ONLY in test runtime (NODE_ENV === 'test').
 */
export async function findUserByEmail(
  email: string,
  includePassword = false
): Promise<IUserDocument | UserRecord | null> {
  const normalizedEmail = email.toLowerCase().trim();

  if (isDatabaseConnected()) {
    const query = UserModel.findOne({ email: normalizedEmail });
    if (includePassword) {
      query.select('+passwordHash');
    }
    return await query.exec();
  }

  // Fail closed in production and development: never silently use volatile in-memory storage
  if (process.env.NODE_ENV !== 'test') {
    throw new DatabaseUnavailableError('Database is disconnected. Operation rejected in fail-closed mode.');
  }

  const userId = inMemoryUsersByEmail.get(normalizedEmail);
  if (!userId) {
    return null;
  }
  const user = inMemoryUsersById.get(userId);
  if (!user) {
    return null;
  }
  return user;
}

/**
 * Looks up user by unique ID.
 * Strictly requires active database connection in non-test runtime.
 */
export async function findUserById(id: string): Promise<IUserDocument | UserRecord | null> {
  if (isDatabaseConnected()) {
    return await UserModel.findById(id).exec();
  }

  // Fail closed in production and development
  if (process.env.NODE_ENV !== 'test') {
    throw new DatabaseUnavailableError('Database is disconnected. Operation rejected in fail-closed mode.');
  }

  return inMemoryUsersById.get(id) || null;
}

/**
 * Creates a new Buyer user. Enforces server-side UserRole.BUYER assignment.
 * Strictly requires active database connection in non-test runtime.
 * Throws duplicate key error (code 11000) if email already exists.
 */
export async function createBuyerUser(data: CreateBuyerData): Promise<IUserDocument | UserRecord> {
  const normalizedEmail = data.email.toLowerCase().trim();

  if (isDatabaseConnected()) {
    return await UserModel.create({
      email: normalizedEmail,
      passwordHash: data.passwordHash,
      fullName: data.fullName.trim(),
      phone: data.phone?.trim(),
      businessName: data.businessName?.trim(),
      tradeLicenseNumber: data.tradeLicenseNumber?.trim(),
      role: UserRole.BUYER,
      isActive: true,
      isEmailVerified: false
    });
  }

  // Fail closed in production and development
  if (process.env.NODE_ENV !== 'test') {
    throw new DatabaseUnavailableError('Database is disconnected. User creation rejected in fail-closed mode.');
  }

  // In-memory test store (strictly gated to NODE_ENV === 'test')
  if (inMemoryUsersByEmail.has(normalizedEmail)) {
    const duplicateError = new Error(`E11000 duplicate key error collection: users index: email_1 dup key: { email: "${normalizedEmail}" }`);
    (duplicateError as unknown as { code: number }).code = 11000;
    throw duplicateError;
  }

  const newId = `buyer_usr_${idCounter++}_${Date.now()}`;
  const now = new Date();
  const record = createInMemoryRecord({
    id: newId,
    email: normalizedEmail,
    passwordHash: data.passwordHash,
    fullName: data.fullName.trim(),
    phone: data.phone?.trim(),
    businessName: data.businessName?.trim(),
    tradeLicenseNumber: data.tradeLicenseNumber?.trim(),
    role: UserRole.BUYER,
    isActive: true,
    isEmailVerified: false,
    createdAt: now,
    updatedAt: now
  });

  inMemoryUsersById.set(newId, record);
  inMemoryUsersByEmail.set(normalizedEmail, newId);
  return record;
}

/**
 * Sets user active status (used for deactivation tests and administration).
 * Strictly requires active database connection in non-test runtime.
 */
export async function setUserActiveStatus(userId: string, isActive: boolean): Promise<boolean> {
  if (isDatabaseConnected()) {
    const res = await UserModel.updateOne({ _id: userId }, { $set: { isActive } });
    return res.modifiedCount > 0;
  }

  // Fail closed in production and development
  if (process.env.NODE_ENV !== 'test') {
    throw new DatabaseUnavailableError('Database is disconnected. Operation rejected in fail-closed mode.');
  }

  const user = inMemoryUsersById.get(userId);
  if (user) {
    user.isActive = isActive;
    return true;
  }
  return false;
}
