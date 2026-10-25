import mongoose, { Schema, Document, Model } from 'mongoose';
import { CategoryPublicItem } from '@aweermarket/types';
import { isDatabaseConnected } from '../plugins/db.js';
import { ProductModel, getInMemoryProducts } from './product.model.js';

export interface ICategoryDocument extends Document {
  name: string;
  slug: string;
  description: string;
  icon: string;
  bannerUrl?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  toPublicItem(productCount?: number): CategoryPublicItem;
}

const CategorySchema = new Schema<ICategoryDocument>(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true
    },
    slug: {
      type: String,
      required: [true, 'Category slug is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },
    description: {
      type: String,
      default: '',
      trim: true
    },
    icon: {
      type: String,
      default: '📦',
      trim: true
    },
    bannerUrl: {
      type: String,
      default: '',
      trim: true
    },
    sortOrder: {
      type: Number,
      default: 0,
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

CategorySchema.methods.toPublicItem = function (productCount: number = 0): CategoryPublicItem {
  return {
    id: this._id.toString(),
    key: this.slug,
    label: this.name,
    description: this.description || '',
    icon: this.icon || '📦',
    bannerUrl: this.bannerUrl || '',
    sortOrder: this.sortOrder ?? 0,
    isActive: this.isActive ?? true,
    productCount
  };
};

export const CategoryModel: Model<ICategoryDocument> =
  mongoose.models.Category || mongoose.model<ICategoryDocument>('Category', CategorySchema);

// ============================================================================
// Standard Default Categories (Al Aweer Central Market Catalog)
// ============================================================================

export interface DefaultCategorySeed {
  name: string;
  slug: string;
  description: string;
  icon: string;
  sortOrder: number;
  isActive: boolean;
}

export const DEFAULT_CATEGORIES: DefaultCategorySeed[] = [
  {
    name: 'Fresh Fruits',
    slug: 'fresh_fruits',
    description: 'Direct wholesale crates of premium imported and regional fruits from verified Al Aweer stalls.',
    icon: '🍎',
    sortOrder: 1,
    isActive: true
  },
  {
    name: 'Fresh Vegetables',
    slug: 'fresh_vegetables',
    description: 'Bulk potatoes, onions, tomatoes, and greenhouse produce harvested daily for commercial buyers.',
    icon: '🥦',
    sortOrder: 2,
    isActive: true
  },
  {
    name: 'Citrus',
    slug: 'citrus',
    description: 'Valencia oranges, lemons, limes, and grapefruits sorted for high commercial yield.',
    icon: '🍊',
    sortOrder: 3,
    isActive: true
  },
  {
    name: 'Leafy Greens',
    slug: 'leafy_greens',
    description: 'Farm-fresh coriander, mint, parsley, and seasonal herbs bundled in commercial wholesale lots.',
    icon: '🌿',
    sortOrder: 4,
    isActive: true
  },
  {
    name: 'Exotic Produce',
    slug: 'exotic_produce',
    description: 'Wholesale ginger, garlic, green chilies, and imported authentic regional culinary spices.',
    icon: '🌶️',
    sortOrder: 5,
    isActive: true
  },
  {
    name: 'Berries',
    slug: 'berries',
    description: 'Strawberries, blueberries, blackberries, and raspberries packed in temperature-controlled flats.',
    icon: '🍓',
    sortOrder: 6,
    isActive: true
  },
  {
    name: 'Root Vegetables',
    slug: 'root_vegetables',
    description: 'Commercial sacks of carrots, beets, turnips, and radishes sourced fresh from Al Aweer stalls.',
    icon: '🥕',
    sortOrder: 7,
    isActive: true
  }
];

// ============================================================================
// Dual-Mode In-Memory Repository for Test Environments
// ============================================================================

export interface CategoryRecord {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  bannerUrl?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  toPublicItem(productCount?: number): CategoryPublicItem;
}

const inMemoryCategoriesById = new Map<string, CategoryRecord>();
const inMemoryCategoriesBySlug = new Map<string, string>(); // slug -> id
let catIdCounter = 1;

function createInMemoryCategoryRecord(data: Omit<CategoryRecord, 'toPublicItem'>): CategoryRecord {
  return {
    ...data,
    toPublicItem(productCount: number = 0): CategoryPublicItem {
      return {
        id: this.id,
        key: this.slug,
        label: this.name,
        description: this.description || '',
        icon: this.icon || '📦',
        bannerUrl: this.bannerUrl || '',
        sortOrder: this.sortOrder ?? 0,
        isActive: this.isActive ?? true,
        productCount
      };
    }
  };
}

export function initDefaultInMemoryCategories(): void {
  for (const def of DEFAULT_CATEGORIES) {
    if (!inMemoryCategoriesBySlug.has(def.slug)) {
      const id = `cat_${catIdCounter++}`;
      const rec = createInMemoryCategoryRecord({
        id,
        name: def.name,
        slug: def.slug,
        description: def.description,
        icon: def.icon,
        bannerUrl: '',
        sortOrder: def.sortOrder,
        isActive: def.isActive,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      inMemoryCategoriesById.set(id, rec);
      inMemoryCategoriesBySlug.set(def.slug, id);
    }
  }
}

// Auto-seed in-memory storage for test isolation
initDefaultInMemoryCategories();

export function clearInMemoryCategories(): void {
  inMemoryCategoriesById.clear();
  inMemoryCategoriesBySlug.clear();
  catIdCounter = 1;
}

export function resetInMemoryCategories(): void {
  clearInMemoryCategories();
  initDefaultInMemoryCategories();
}

/**
 * Explicit, idempotent initialization of default Al Aweer wholesale categories.
 * Safe against race conditions and concurrent initialization:
 * - In database mode: uses atomic updateOne with $setOnInsert and upsert per slug,
 *   catching duplicate key (11000) errors gracefully.
 * - In in-memory mode: initializes default in-memory categories if the repository is empty.
 */
export async function ensureDefaultCategories(): Promise<void> {
  if (isDatabaseConnected()) {
    for (const def of DEFAULT_CATEGORIES) {
      try {
        await CategoryModel.updateOne(
          { slug: def.slug },
          { $setOnInsert: def },
          { upsert: true }
        );
      } catch (err: unknown) {
        // Idempotent race-condition safety: ignore E11000 duplicate key errors
        if ((err as { code?: number })?.code !== 11000) {
          throw err;
        }
      }
    }
    return;
  }

  // In-memory flow
  initDefaultInMemoryCategories();
}

// ============================================================================
// Data Access Methods
// ============================================================================

export async function countProductsForCategory(slug: string): Promise<number> {
  if (isDatabaseConnected()) {
    try {
      return await ProductModel.countDocuments({ category: slug, isActive: true });
    } catch {
      return 0;
    }
  }

  // In-memory product check
  const prods = getInMemoryProducts();
  return prods.filter((p) => p.category === slug && p.isActive).length;
}

export async function listAllCategories(filter?: { isActive?: boolean }): Promise<CategoryPublicItem[]> {
  if (isDatabaseConnected()) {
    const query: Record<string, unknown> = {};
    if (typeof filter?.isActive === 'boolean') {
      query.isActive = filter.isActive;
    }

    const categories = await CategoryModel.find(query).sort({ sortOrder: 1, name: 1 });

    const items: CategoryPublicItem[] = [];
    for (const c of categories) {
      const count = await countProductsForCategory(c.slug);
      items.push(c.toPublicItem(count));
    }
    return items;
  }

  // In-memory flow
  const list = Array.from(inMemoryCategoriesById.values());
  const filtered = filter && typeof filter.isActive === 'boolean'
    ? list.filter((c) => c.isActive === filter.isActive)
    : list;

  filtered.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

  const results: CategoryPublicItem[] = [];
  for (const c of filtered) {
    const count = await countProductsForCategory(c.slug);
    results.push(c.toPublicItem(count));
  }
  return results;
}

export async function findCategoryById(id: string): Promise<CategoryPublicItem | null> {
  if (isDatabaseConnected()) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return null;
    }
    const doc = await CategoryModel.findById(id);
    if (!doc) return null;
    const count = await countProductsForCategory(doc.slug);
    return doc.toPublicItem(count);
  }

  const rec = inMemoryCategoriesById.get(id);
  if (!rec) return null;
  const count = await countProductsForCategory(rec.slug);
  return rec.toPublicItem(count);
}

export async function findCategoryBySlug(slug: string): Promise<CategoryPublicItem | null> {
  const normSlug = (slug || '').toLowerCase().trim();
  if (isDatabaseConnected()) {
    const doc = await CategoryModel.findOne({ slug: normSlug });
    if (!doc) return null;
    const count = await countProductsForCategory(doc.slug);
    return doc.toPublicItem(count);
  }

  const id = inMemoryCategoriesBySlug.get(normSlug);
  if (!id) return null;
  const rec = inMemoryCategoriesById.get(id);
  if (!rec) return null;
  const count = await countProductsForCategory(rec.slug);
  return rec.toPublicItem(count);
}

export interface CreateCategoryData {
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  bannerUrl?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export async function createCategory(data: CreateCategoryData): Promise<CategoryPublicItem> {
  const normSlug = data.slug.toLowerCase().trim();

  // Collision check
  const existing = await findCategoryBySlug(normSlug);
  if (existing) {
    const err = new Error(`Category with slug '${normSlug}' already exists`);
    (err as any).statusCode = 409;
    throw err;
  }

  if (isDatabaseConnected()) {
    const doc = await CategoryModel.create({
      name: data.name.trim(),
      slug: normSlug,
      description: (data.description || '').trim(),
      icon: (data.icon || '📦').trim(),
      bannerUrl: (data.bannerUrl || '').trim(),
      sortOrder: data.sortOrder ?? 0,
      isActive: data.isActive ?? true
    });
    return doc.toPublicItem(0);
  }

  const id = `cat_${catIdCounter++}`;
  const now = new Date();
  const rec = createInMemoryCategoryRecord({
    id,
    name: data.name.trim(),
    slug: normSlug,
    description: (data.description || '').trim(),
    icon: (data.icon || '📦').trim(),
    bannerUrl: (data.bannerUrl || '').trim(),
    sortOrder: data.sortOrder ?? 0,
    isActive: data.isActive ?? true,
    createdAt: now,
    updatedAt: now
  });
  inMemoryCategoriesById.set(id, rec);
  inMemoryCategoriesBySlug.set(normSlug, id);
  return rec.toPublicItem(0);
}

export interface UpdateCategoryData {
  name?: string;
  slug?: string;
  description?: string;
  icon?: string;
  bannerUrl?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export async function updateCategory(id: string, data: UpdateCategoryData): Promise<CategoryPublicItem | null> {
  if (isDatabaseConnected()) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return null;
    }

    if (data.slug) {
      const normSlug = data.slug.toLowerCase().trim();
      const existing = await CategoryModel.findOne({ slug: normSlug, _id: { $ne: id } });
      if (existing) {
        const err = new Error(`Category with slug '${normSlug}' already exists`);
        (err as any).statusCode = 409;
        throw err;
      }
    }

    const doc = await CategoryModel.findByIdAndUpdate(
      id,
      { $set: data },
      { new: true, runValidators: true }
    );
    if (!doc) return null;
    const count = await countProductsForCategory(doc.slug);
    return doc.toPublicItem(count);
  }

  const rec = inMemoryCategoriesById.get(id);
  if (!rec) return null;

  if (data.slug && data.slug.toLowerCase().trim() !== rec.slug) {
    const normSlug = data.slug.toLowerCase().trim();
    const existingId = inMemoryCategoriesBySlug.get(normSlug);
    if (existingId && existingId !== id) {
      const err = new Error(`Category with slug '${normSlug}' already exists`);
      (err as any).statusCode = 409;
      throw err;
    }
    inMemoryCategoriesBySlug.delete(rec.slug);
    inMemoryCategoriesBySlug.set(normSlug, id);
    rec.slug = normSlug;
  }

  if (data.name !== undefined) rec.name = data.name.trim();
  if (data.description !== undefined) rec.description = data.description.trim();
  if (data.icon !== undefined) rec.icon = data.icon.trim();
  if (data.bannerUrl !== undefined) rec.bannerUrl = data.bannerUrl.trim();
  if (data.sortOrder !== undefined) rec.sortOrder = data.sortOrder;
  if (data.isActive !== undefined) rec.isActive = data.isActive;
  rec.updatedAt = new Date();

  const count = await countProductsForCategory(rec.slug);
  return rec.toPublicItem(count);
}

export async function setCategoryStatus(id: string, isActive: boolean): Promise<CategoryPublicItem | null> {
  return await updateCategory(id, { isActive });
}

export async function deleteCategory(id: string): Promise<{ success: boolean; deactivated?: boolean; message?: string }> {
  const cat = await findCategoryById(id);
  if (!cat) {
    return { success: false, message: 'Category not found' };
  }

  // Safety safeguard: If existing products reference this category, deactivate instead of deleting
  const productCount = await countProductsForCategory(cat.key);
  if (productCount > 0) {
    await setCategoryStatus(id, false);
    return {
      success: true,
      deactivated: true,
      message: `Category has ${productCount} active products and was safely deactivated instead of deleted.`
    };
  }

  if (isDatabaseConnected()) {
    await CategoryModel.findByIdAndDelete(id);
    return { success: true };
  }

  inMemoryCategoriesBySlug.delete(cat.key);
  inMemoryCategoriesById.delete(id);
  return { success: true };
}
