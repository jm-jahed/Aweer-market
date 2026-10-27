import mongoose, { Schema, Document, Model } from 'mongoose';
import { ProductCategory, WholesaleUnit, ProductItem, ProductOfferSummary } from '@aweermarket/types';
import { isDatabaseConnected } from '../plugins/db.js';

export interface IProductOffer {
  shopId: string;
  shopName: string;
  stallNumber?: string;
  unit: WholesaleUnit | string;
  unitWeightKg: number;
  priceAed: number;
  equivalentPricePerKg: number;
  minOrderQuantity: number;
  availableStock: number;
  isActive: boolean;
}

export interface IProductDocument extends Document {
  name: string;
  category: ProductCategory | string;
  originCountry: string;
  description: string;
  imageUrl?: string;
  lowestPriceAedPerKg: number;
  isActive: boolean;
  offers: IProductOffer[];
  createdAt: Date;
  updatedAt: Date;
  toPublicProductItem(): ProductItem;
}

const ProductOfferSubSchema = new Schema<IProductOffer>(
  {
    shopId: { type: String, required: true, index: true },
    shopName: { type: String, required: true },
    stallNumber: { type: String },
    unit: { type: String, enum: Object.values(WholesaleUnit), required: true },
    unitWeightKg: { type: Number, required: true, min: [0.01, 'Weight must be positive'] },
    priceAed: { type: Number, required: true, min: [0.01, 'Price must be positive'] },
    equivalentPricePerKg: { type: Number, required: true },
    minOrderQuantity: { type: Number, default: 1, min: 1 },
    availableStock: { type: Number, required: true, min: 0 },
    isActive: { type: Boolean, default: true }
  },
  { _id: false }
);

const ProductSchema = new Schema<IProductDocument>(
  {
    name: { type: String, required: [true, 'Product name is required'], trim: true, index: true },
    category: {
      type: String,
      required: [true, 'Product category is required'],
      trim: true,
      index: true
    },
    originCountry: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    imageUrl: { type: String, default: '', trim: true },
    lowestPriceAedPerKg: { type: Number, required: true, index: true },
    isActive: { type: Boolean, default: true, index: true },
    offers: [ProductOfferSubSchema]
  },
  {
    timestamps: true
  }
);

export function calculateEquivalentPricePerKg(priceAed: number, unitWeightKg: number): number {
  if (unitWeightKg <= 0) {
    throw new Error('unitWeightKg must be strictly positive to calculate equivalent price per kg');
  }
  return Math.round((priceAed / unitWeightKg) * 100) / 100;
}

export function computeLowestPricePerKg(offers: IProductOffer[]): number {
  const activeOffers = offers.filter((o) => o.isActive && o.availableStock > 0);
  if (activeOffers.length === 0) {
    return 0;
  }
  return Math.min(...activeOffers.map((o) => o.equivalentPricePerKg));
}

ProductSchema.methods.toPublicProductItem = function (): ProductItem {
  const activeOffers = (this.offers || []).filter((o: IProductOffer) => o.isActive);
  const lowest = computeLowestPricePerKg(activeOffers);

  return {
    id: this._id.toString(),
    name: this.name,
    category: this.category,
    originCountry: this.originCountry,
    description: this.description || '',
    imageUrl: this.imageUrl || '',
    lowestPriceAedPerKg: lowest,
    offers: activeOffers.map((o: IProductOffer): ProductOfferSummary => ({
      vendorId: o.shopId,
      shopName: o.shopName,
      stallNumber: o.stallNumber,
      unit: o.unit,
      unitWeightKg: o.unitWeightKg,
      priceAed: o.priceAed,
      equivalentPricePerKg: o.equivalentPricePerKg,
      minOrderQuantity: o.minOrderQuantity,
      availableStock: o.availableStock
    }))
  };
};

export const ProductModel: Model<IProductDocument> =
  mongoose.models.Product || mongoose.model<IProductDocument>('Product', ProductSchema);

// ============================================================================
// Dual-Mode In-Memory Repository for Test Environments
// ============================================================================

export interface ProductRecord {
  id: string;
  name: string;
  category: ProductCategory | string;
  originCountry: string;
  description: string;
  imageUrl?: string;
  lowestPriceAedPerKg: number;
  isActive: boolean;
  offers: IProductOffer[];
  createdAt: Date;
  updatedAt: Date;
  toPublicProductItem(): ProductItem;
}

const inMemoryProducts = new Map<string, ProductRecord>();
let prodIdCounter = 1;

export function getInMemoryProducts(): ProductRecord[] {
  return Array.from(inMemoryProducts.values());
}

function createInMemoryProductRecord(data: Omit<ProductRecord, 'toPublicProductItem'>): ProductRecord {
  return {
    ...data,
    toPublicProductItem(): ProductItem {
      const activeOffers = this.offers.filter((o) => o.isActive);
      const lowest = computeLowestPricePerKg(activeOffers);

      return {
        id: this.id,
        name: this.name,
        category: this.category,
        originCountry: this.originCountry,
        description: this.description || '',
        imageUrl: this.imageUrl || '',
        lowestPriceAedPerKg: lowest,
        offers: activeOffers.map((o): ProductOfferSummary => ({
          vendorId: o.shopId,
          shopName: o.shopName,
          stallNumber: o.stallNumber,
          unit: o.unit,
          unitWeightKg: o.unitWeightKg,
          priceAed: o.priceAed,
          equivalentPricePerKg: o.equivalentPricePerKg,
          minOrderQuantity: o.minOrderQuantity,
          availableStock: o.availableStock
        }))
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

export function isInMemoryProductStoreAllowed(): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  return process.env.NODE_ENV === 'test' || process.env.ALLOW_IN_MEMORY_DB === 'true';
}

export function resetInMemoryProducts(): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new DatabaseUnavailableError('In-memory product store is only permitted in test environment');
  }
  inMemoryProducts.clear();
  prodIdCounter = 1;
}

export interface CreateProductData {
  name: string;
  category: ProductCategory | string;
  originCountry: string;
  description?: string;
  imageUrl?: string;
  isActive?: boolean;
  offers?: Array<{
    shopId: string;
    shopName: string;
    stallNumber?: string;
    unit: WholesaleUnit | string;
    unitWeightKg: number;
    priceAed: number;
    minOrderQuantity?: number;
    availableStock: number;
    isActive?: boolean;
  }>;
}

export async function createProduct(data: CreateProductData): Promise<IProductDocument | ProductRecord> {
  const preparedOffers: IProductOffer[] = (data.offers || []).map((o) => ({
    shopId: o.shopId,
    shopName: o.shopName,
    stallNumber: o.stallNumber,
    unit: o.unit,
    unitWeightKg: o.unitWeightKg,
    priceAed: o.priceAed,
    equivalentPricePerKg: calculateEquivalentPricePerKg(o.priceAed, o.unitWeightKg),
    minOrderQuantity: o.minOrderQuantity ?? 1,
    availableStock: o.availableStock,
    isActive: o.isActive ?? true
  }));

  const lowest = computeLowestPricePerKg(preparedOffers);

  if (isDatabaseConnected()) {
    return await ProductModel.create({
      name: data.name.trim(),
      category: data.category,
      originCountry: data.originCountry.trim(),
      description: data.description?.trim() || '',
      imageUrl: data.imageUrl?.trim() || '',
      lowestPriceAedPerKg: lowest,
      isActive: data.isActive ?? true,
      offers: preparedOffers
    });
  }

  if (!isInMemoryProductStoreAllowed()) {
    throw new DatabaseUnavailableError('Database is disconnected. Product creation rejected in fail-closed mode.');
  }

  const id = `prod_${prodIdCounter++}_${Date.now()}`;
  const now = new Date();
  const record = createInMemoryProductRecord({
    id,
    name: data.name.trim(),
    category: data.category,
    originCountry: data.originCountry.trim(),
    description: data.description?.trim() || '',
    imageUrl: data.imageUrl?.trim() || '',
    lowestPriceAedPerKg: lowest,
    isActive: data.isActive ?? true,
    offers: preparedOffers,
    createdAt: now,
    updatedAt: now
  });

  inMemoryProducts.set(id, record);
  return record;
}

export interface QueryProductsFilter {
  category?: ProductCategory | string;
  search?: string;
  originCountry?: string;
  page?: number;
  limit?: number;
}

export async function findProducts(
  filter: QueryProductsFilter = {}
): Promise<{ products: Array<IProductDocument | ProductRecord>; total: number }> {
  const page = Math.max(1, filter.page || 1);
  const limit = Math.min(100, Math.max(1, filter.limit || 20));

  if (isDatabaseConnected()) {
    const mongoQuery: Record<string, unknown> = { isActive: true };

    if (filter.category) {
      mongoQuery.category = filter.category;
    }
    if (filter.originCountry) {
      mongoQuery.originCountry = new RegExp(`^${filter.originCountry.trim()}$`, 'i');
    }
    if (filter.search) {
      mongoQuery.name = new RegExp(filter.search.trim(), 'i');
    }

    const [products, total] = await Promise.all([
      ProductModel.find(mongoQuery)
        .sort({ lowestPriceAedPerKg: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      ProductModel.countDocuments(mongoQuery)
    ]);

    return { products, total };
  }

  if (!isInMemoryProductStoreAllowed()) {
    throw new DatabaseUnavailableError('Database is disconnected. Operation rejected in fail-closed mode.');
  }

  let list = Array.from(inMemoryProducts.values()).filter((p) => p.isActive);

  if (filter.category) {
    list = list.filter((p) => p.category === filter.category);
  }
  if (filter.originCountry) {
    list = list.filter((p) => p.originCountry.toLowerCase() === filter.originCountry!.toLowerCase().trim());
  }
  if (filter.search) {
    const s = filter.search.toLowerCase().trim();
    list = list.filter((p) => p.name.toLowerCase().includes(s) || p.description.toLowerCase().includes(s));
  }

  // Sort lowest price first
  list.sort((a, b) => a.lowestPriceAedPerKg - b.lowestPriceAedPerKg);

  const total = list.length;
  const paginated = list.slice((page - 1) * limit, page * limit);
  return { products: paginated, total };
}

export async function findProductById(id: string): Promise<IProductDocument | ProductRecord | null> {
  if (isDatabaseConnected()) {
    return await ProductModel.findById(id).exec();
  }

  if (!isInMemoryProductStoreAllowed()) {
    throw new DatabaseUnavailableError('Database is disconnected. Operation rejected in fail-closed mode.');
  }

  return inMemoryProducts.get(id) || null;
}

export async function setProductActiveStatus(id: string, isActive: boolean): Promise<boolean> {
  if (isDatabaseConnected()) {
    const res = await ProductModel.updateOne({ _id: id }, { $set: { isActive } });
    return res.modifiedCount > 0;
  }

  if (!isInMemoryProductStoreAllowed()) {
    throw new DatabaseUnavailableError('Database is disconnected. Operation rejected in fail-closed mode.');
  }

  const prod = inMemoryProducts.get(id);
  if (prod) {
    prod.isActive = isActive;
    return true;
  }
  return false;
}

export async function listAllProductsAdmin(): Promise<Array<IProductDocument | ProductRecord>> {
  if (isDatabaseConnected()) {
    return await ProductModel.find().sort({ createdAt: -1 }).exec();
  }

  if (!isInMemoryProductStoreAllowed()) {
    throw new DatabaseUnavailableError('Database is disconnected. Operation rejected in fail-closed mode.');
  }

  return Array.from(inMemoryProducts.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function countProducts(filter?: { shopIds?: string[] }): Promise<{ total: number; active: number; inactive: number }> {
  if (isDatabaseConnected()) {
    const scopeQuery: Record<string, unknown> = {};
    if (filter?.shopIds?.length) {
      scopeQuery['offers.shopId'] = { $in: filter.shopIds };
    }
    const [total, active, inactive] = await Promise.all([
      ProductModel.countDocuments(scopeQuery),
      ProductModel.countDocuments({ ...scopeQuery, isActive: true }),
      ProductModel.countDocuments({ ...scopeQuery, isActive: false })
    ]);
    return { total, active, inactive };
  }

  if (!isInMemoryProductStoreAllowed()) {
    throw new DatabaseUnavailableError('Database is disconnected. Operation rejected in fail-closed mode.');
  }

  let all = Array.from(inMemoryProducts.values());
  if (filter?.shopIds?.length) {
    all = all.filter((p) => p.offers.some((o) => filter.shopIds!.includes(o.shopId)));
  }
  return {
    total: all.length,
    active: all.filter((p) => p.isActive).length,
    inactive: all.filter((p) => !p.isActive).length
  };
}

export async function findProductByName(name: string): Promise<IProductDocument | ProductRecord | null> {
  const normalized = name.toLowerCase().trim();
  if (isDatabaseConnected()) {
    return await ProductModel.findOne({ name: new RegExp(`^${normalized}$`, 'i') }).exec();
  }

  if (!isInMemoryProductStoreAllowed()) {
    throw new DatabaseUnavailableError('Database is disconnected. Operation rejected in fail-closed mode.');
  }

  const all = Array.from(inMemoryProducts.values());
  return all.find((p) => p.name.toLowerCase().trim() === normalized) || null;
}

export async function addOrUpdateProductOffer(
  productId: string,
  offerData: {
    shopId: string;
    shopName: string;
    stallNumber?: string;
    unit: WholesaleUnit | string;
    unitWeightKg: number;
    priceAed: number;
    minOrderQuantity?: number;
    availableStock: number;
    isActive?: boolean;
  }
): Promise<IProductDocument | ProductRecord | null> {
  const eqPrice = calculateEquivalentPricePerKg(offerData.priceAed, offerData.unitWeightKg);
  const newOffer: IProductOffer = {
    shopId: offerData.shopId,
    shopName: offerData.shopName,
    stallNumber: offerData.stallNumber,
    unit: offerData.unit,
    unitWeightKg: offerData.unitWeightKg,
    priceAed: offerData.priceAed,
    equivalentPricePerKg: eqPrice,
    minOrderQuantity: offerData.minOrderQuantity ?? 1,
    availableStock: offerData.availableStock,
    isActive: offerData.isActive ?? true
  };

  if (isDatabaseConnected()) {
    const product = await ProductModel.findById(productId);
    if (!product) return null;

    const existingIdx = product.offers.findIndex((o) => o.shopId === offerData.shopId);
    if (existingIdx >= 0) {
      product.offers[existingIdx] = newOffer;
    } else {
      product.offers.push(newOffer);
    }

    product.lowestPriceAedPerKg = computeLowestPricePerKg(product.offers);
    await product.save();
    return product;
  }

  if (!isInMemoryProductStoreAllowed()) {
    throw new DatabaseUnavailableError('Database is disconnected. Operation rejected in fail-closed mode.');
  }

  const prod = inMemoryProducts.get(productId);
  if (!prod) return null;

  const existingIdx = prod.offers.findIndex((o) => o.shopId === offerData.shopId);
  if (existingIdx >= 0) {
    prod.offers[existingIdx] = newOffer;
  } else {
    prod.offers.push(newOffer);
  }

  prod.lowestPriceAedPerKg = computeLowestPricePerKg(prod.offers);
  prod.updatedAt = new Date();
  return prod;
}

export interface UpdateOfferData {
  priceAed?: number;
  unitWeightKg?: number;
  minOrderQuantity?: number;
  availableStock?: number;
  isActive?: boolean;
}

export async function updateProductOffer(
  productId: string,
  shopId: string,
  updates: UpdateOfferData
): Promise<IProductDocument | ProductRecord | null> {
  if (isDatabaseConnected()) {
    const product = await ProductModel.findById(productId);
    if (!product) return null;

    const offer = product.offers.find((o) => o.shopId === shopId);
    if (!offer) return null;

    if (updates.priceAed !== undefined) offer.priceAed = updates.priceAed;
    if (updates.unitWeightKg !== undefined) offer.unitWeightKg = updates.unitWeightKg;
    if (updates.minOrderQuantity !== undefined) offer.minOrderQuantity = updates.minOrderQuantity;
    if (updates.availableStock !== undefined) offer.availableStock = updates.availableStock;
    if (updates.isActive !== undefined) offer.isActive = updates.isActive;

    if (updates.priceAed !== undefined || updates.unitWeightKg !== undefined) {
      offer.equivalentPricePerKg = calculateEquivalentPricePerKg(offer.priceAed, offer.unitWeightKg);
    }

    product.lowestPriceAedPerKg = computeLowestPricePerKg(product.offers);
    product.markModified('offers');
    await product.save();
    return product;
  }

  if (!isInMemoryProductStoreAllowed()) {
    throw new DatabaseUnavailableError('Database is disconnected. Operation rejected in fail-closed mode.');
  }

  const prod = inMemoryProducts.get(productId);
  if (!prod) return null;

  const offer = prod.offers.find((o) => o.shopId === shopId);
  if (!offer) return null;

  if (updates.priceAed !== undefined) offer.priceAed = updates.priceAed;
  if (updates.unitWeightKg !== undefined) offer.unitWeightKg = updates.unitWeightKg;
  if (updates.minOrderQuantity !== undefined) offer.minOrderQuantity = updates.minOrderQuantity;
  if (updates.availableStock !== undefined) offer.availableStock = updates.availableStock;
  if (updates.isActive !== undefined) offer.isActive = updates.isActive;

  if (updates.priceAed !== undefined || updates.unitWeightKg !== undefined) {
    offer.equivalentPricePerKg = calculateEquivalentPricePerKg(offer.priceAed, offer.unitWeightKg);
  }

  prod.lowestPriceAedPerKg = computeLowestPricePerKg(prod.offers);
  prod.updatedAt = new Date();
  return prod;
}

export async function listProductsByVendor(shopId: string): Promise<Array<IProductDocument | ProductRecord>> {
  if (isDatabaseConnected()) {
    const conditions: Array<Record<string, unknown>> = [{ 'offers.shopId': String(shopId) }];
    if (mongoose.Types.ObjectId.isValid(shopId)) {
      conditions.push({ 'offers.shopId': new mongoose.Types.ObjectId(shopId) });
    }
    return await ProductModel.find({ $or: conditions }).sort({ updatedAt: -1 }).exec();
  }

  if (!isInMemoryProductStoreAllowed()) {
    throw new DatabaseUnavailableError('Database is disconnected. Operation rejected in fail-closed mode.');
  }

  return Array.from(inMemoryProducts.values())
    .filter((p) => p.offers.some((o) => String(o.shopId) === String(shopId)))
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

export async function reserveOfferStock(
  productId: string,
  shopId: string,
  quantity: number
): Promise<{ success: boolean; error?: string }> {
  if (quantity <= 0) return { success: false, error: 'Quantity must be positive' };

  if (isDatabaseConnected()) {
    const updated = await ProductModel.findOneAndUpdate(
      {
        _id: productId,
        isActive: true,
        offers: {
          $elemMatch: {
            shopId: shopId,
            isActive: true,
            availableStock: { $gte: quantity }
          }
        }
      },
      {
        $inc: { 'offers.$.availableStock': -quantity }
      },
      { new: true }
    );

    if (!updated) {
      return { success: false, error: 'Insufficient stock or produce offer unavailable' };
    }

    updated.lowestPriceAedPerKg = computeLowestPricePerKg(updated.offers);
    await updated.save();
    return { success: true };
  }

  if (!isInMemoryProductStoreAllowed()) {
    throw new DatabaseUnavailableError('Database is disconnected. Operation rejected in fail-closed mode.');
  }

  const prod = inMemoryProducts.get(productId);
  if (!prod || !prod.isActive) {
    return { success: false, error: 'Produce not found or currently inactive' };
  }

  const offer = prod.offers.find((o) => o.shopId === shopId && o.isActive);
  if (!offer) {
    return { success: false, error: 'Stall offer not found or currently inactive' };
  }

  if (offer.availableStock < quantity) {
    return {
      success: false,
      error: `Insufficient stock for ${prod.name}: requested ${quantity}, but only ${offer.availableStock} in stock`
    };
  }

  offer.availableStock -= quantity;
  prod.lowestPriceAedPerKg = computeLowestPricePerKg(prod.offers);
  prod.updatedAt = new Date();
  return { success: true };
}

export async function rollbackOfferStock(
  productId: string,
  shopId: string,
  quantity: number
): Promise<void> {
  if (quantity <= 0) return;

  if (isDatabaseConnected()) {
    const updated = await ProductModel.findOneAndUpdate(
      {
        _id: productId,
        'offers.shopId': shopId
      },
      {
        $inc: { 'offers.$.availableStock': quantity }
      },
      { new: true }
    );
    if (updated) {
      updated.lowestPriceAedPerKg = computeLowestPricePerKg(updated.offers);
      await updated.save();
    }
    return;
  }

  if (!isInMemoryProductStoreAllowed()) {
    throw new DatabaseUnavailableError('Database is disconnected. Operation rejected in fail-closed mode.');
  }

  const prod = inMemoryProducts.get(productId);
  if (prod) {
    const offer = prod.offers.find((o) => o.shopId === shopId);
    if (offer) {
      offer.availableStock += quantity;
      prod.lowestPriceAedPerKg = computeLowestPricePerKg(prod.offers);
      prod.updatedAt = new Date();
    }
  }
}

export async function setOffersActiveForShop(
  shopId: string,
  isActive: boolean
): Promise<number> {
  if (isDatabaseConnected()) {
    const products = await ProductModel.find({ 'offers.shopId': shopId }).exec();
    let updatedCount = 0;
    for (const prod of products) {
      let changed = false;
      for (const offer of prod.offers) {
        if (offer.shopId === shopId && offer.isActive !== isActive) {
          offer.isActive = isActive;
          changed = true;
        }
      }
      if (changed) {
        prod.lowestPriceAedPerKg = computeLowestPricePerKg(prod.offers);
        await prod.save();
        updatedCount++;
      }
    }
    return updatedCount;
  }

  if (!isInMemoryProductStoreAllowed()) {
    throw new DatabaseUnavailableError('Database is disconnected. Operation rejected in fail-closed mode.');
  }

  let updatedCount = 0;
  for (const prod of inMemoryProducts.values()) {
    let changed = false;
    for (const offer of prod.offers) {
      if (offer.shopId === shopId && offer.isActive !== isActive) {
        offer.isActive = isActive;
        changed = true;
      }
    }
    if (changed) {
      prod.lowestPriceAedPerKg = computeLowestPricePerKg(prod.offers);
      prod.updatedAt = new Date();
      updatedCount++;
    }
  }
  return updatedCount;
}

export async function removeDemoProducts(): Promise<number> {
  const demoNames = ['Valencia Oranges', 'Cavendish Bananas', 'Roma Tomatoes'];
  if (isDatabaseConnected()) {
    const res = await ProductModel.deleteMany({
      name: { $in: demoNames }
    });
    return res.deletedCount || 0;
  }

  let deleted = 0;
  for (const [id, prod] of inMemoryProducts.entries()) {
    if (demoNames.includes(prod.name)) {
      inMemoryProducts.delete(id);
      deleted++;
    }
  }
  return deleted;
}

export async function removeProductOffer(
  productId: string,
  shopId: string
): Promise<{ deleted: boolean; remainingOffers: number }> {
  if (isDatabaseConnected()) {
    const product = await ProductModel.findById(productId);
    if (!product) return { deleted: false, remainingOffers: 0 };

    product.offers = product.offers.filter((o) => String(o.shopId) !== String(shopId));

    if (product.offers.length === 0) {
      await ProductModel.findByIdAndDelete(productId);
      return { deleted: true, remainingOffers: 0 };
    } else {
      product.lowestPriceAedPerKg = computeLowestPricePerKg(product.offers);
      product.markModified('offers');
      await product.save();
      return { deleted: true, remainingOffers: product.offers.length };
    }
  }

  if (!isInMemoryProductStoreAllowed()) {
    throw new DatabaseUnavailableError('Database is disconnected. Operation rejected in fail-closed mode.');
  }

  const prod = inMemoryProducts.get(productId);
  if (!prod) return { deleted: false, remainingOffers: 0 };

  prod.offers = prod.offers.filter((o) => o.shopId !== shopId);
  if (prod.offers.length === 0) {
    inMemoryProducts.delete(productId);
    return { deleted: true, remainingOffers: 0 };
  } else {
    prod.lowestPriceAedPerKg = computeLowestPricePerKg(prod.offers);
    prod.updatedAt = new Date();
    return { deleted: true, remainingOffers: prod.offers.length };
  }
}


