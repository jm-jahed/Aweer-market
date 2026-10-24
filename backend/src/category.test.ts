/**
 * AweerMarket Category Initialization & Public Catalog Retrieval Unit Tests
 * Uses native Node.js test runner (node --test) with Fastify inject.
 * Covers:
 * 1. Safe, explicit initialization of default categories when empty
 * 2. Idempotent repeat initialization (no duplicate records)
 * 3. Concurrent initialization safety without race conditions
 * 4. Public active-category retrieval via listAllCategories({ isActive: true })
 * 5. Public HTTP endpoint integration (GET /api/v1/categories)
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { FastifyInstance } from 'fastify';
import { ProductCategory } from '@aweermarket/types';
import { buildServer } from './server.js';
import {
  DEFAULT_CATEGORIES,
  ensureDefaultCategories,
  clearInMemoryCategories,
  resetInMemoryCategories,
  listAllCategories,
  findCategoryById,
  setCategoryStatus
} from './models/category.model.js';

describe('AweerMarket Step 1 — Category Initialization & Public Catalog Tests', () => {
  let server: FastifyInstance;

  beforeEach(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'a'.repeat(32);
    resetInMemoryCategories();
    server = await buildServer();
    await server.ready();
  });

  afterEach(async () => {
    await server.close();
    resetInMemoryCategories();
  });

  describe('1. Explicit ensureDefaultCategories() Initialization', () => {
    it('initializes all 7 default categories when repository is empty', async () => {
      // 1. Clear in-memory categories to simulate empty database state
      clearInMemoryCategories();
      const emptyCheck = await listAllCategories();
      assert.strictEqual(emptyCheck.length, 0, 'Repository should be empty before initialization');

      // 2. Run explicit initialization
      await ensureDefaultCategories();

      // 3. Verify all default categories exist
      const initialized = await listAllCategories();
      assert.strictEqual(initialized.length, DEFAULT_CATEGORIES.length);
      assert.strictEqual(initialized.length, 7);

      for (const def of DEFAULT_CATEGORIES) {
        const found = initialized.find((c) => c.key === def.slug);
        assert.ok(found, `Category ${def.slug} should exist`);
        assert.strictEqual(found.label, def.name);
        assert.strictEqual(found.isActive, true);
        assert.strictEqual(found.sortOrder, def.sortOrder);
      }
    });

    it('is completely idempotent upon repeat execution (no duplicate records created)', async () => {
      clearInMemoryCategories();

      // First run
      await ensureDefaultCategories();
      const firstRun = await listAllCategories();
      assert.strictEqual(firstRun.length, 7);

      // Repeat second run
      await ensureDefaultCategories();
      const secondRun = await listAllCategories();
      assert.strictEqual(secondRun.length, 7, 'Category count must remain strictly 7 after repeated execution');

      // Repeat third run
      await ensureDefaultCategories();
      const thirdRun = await listAllCategories();
      assert.strictEqual(thirdRun.length, 7, 'Category count must remain strictly 7 after third execution');
    });

    it('safely handles concurrent initialization without race conditions or duplicates', async () => {
      clearInMemoryCategories();

      // Simulate 5 simultaneous workers/requests initializing categories concurrently
      await Promise.all([
        ensureDefaultCategories(),
        ensureDefaultCategories(),
        ensureDefaultCategories(),
        ensureDefaultCategories(),
        ensureDefaultCategories()
      ]);

      const categories = await listAllCategories();
      assert.strictEqual(categories.length, 7, 'Concurrent execution must result in exactly 7 categories with no duplicates');

      // Verify each slug is unique
      const slugs = categories.map((c) => c.key);
      const uniqueSlugs = new Set(slugs);
      assert.strictEqual(uniqueSlugs.size, 7, 'All category slugs must be unique');
    });
  });

  describe('2. Public Active-Category Retrieval & Filtering', () => {
    it('listAllCategories({ isActive: true }) returns active categories correctly', async () => {
      await ensureDefaultCategories();

      const activeCategories = await listAllCategories({ isActive: true });
      assert.strictEqual(activeCategories.length, 7);

      const keys = activeCategories.map((c) => c.key);
      assert.ok(keys.includes(ProductCategory.FRESH_FRUITS));
      assert.ok(keys.includes(ProductCategory.FRESH_VEGETABLES));
      assert.ok(keys.includes(ProductCategory.CITRUS));
      assert.ok(keys.includes(ProductCategory.LEAFY_GREENS));
      assert.ok(keys.includes(ProductCategory.EXOTIC_PRODUCE));
      assert.ok(keys.includes(ProductCategory.BERRIES));
      assert.ok(keys.includes(ProductCategory.ROOT_VEGETABLES));
    });

    it('excludes inactive categories from active filter while keeping them in unfiltered query', async () => {
      await ensureDefaultCategories();

      const all = await listAllCategories();
      const citrusCat = all.find((c) => c.key === ProductCategory.CITRUS);
      assert.ok(citrusCat);

      // Deactivate Citrus category
      await setCategoryStatus(citrusCat.id, false);

      // Active query excludes it
      const activeList = await listAllCategories({ isActive: true });
      assert.strictEqual(activeList.length, 6);
      assert.strictEqual(activeList.some((c) => c.key === ProductCategory.CITRUS), false);

      // Unfiltered query still includes it
      const fullList = await listAllCategories();
      assert.strictEqual(fullList.length, 7);
      const foundInactive = fullList.find((c) => c.key === ProductCategory.CITRUS);
      assert.ok(foundInactive);
      assert.strictEqual(foundInactive.isActive, false);
    });
  });

  describe('3. Public HTTP Endpoint Integration (GET /api/v1/categories)', () => {
    it('returns HTTP 200 with all 7 active default categories for marketplace buyers', async () => {
      await ensureDefaultCategories();

      const res = await server.inject({
        method: 'GET',
        url: '/api/v1/categories'
      });

      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.strictEqual(body.statusCode, 200);
      assert.ok(Array.isArray(body.categories));
      assert.strictEqual(body.categories.length, 7);

      // Verify all expected category keys exist in the response
      const keys = body.categories.map((c: { key: string }) => c.key);
      assert.ok(keys.includes('fresh_fruits'));
      assert.ok(keys.includes('fresh_vegetables'));
      assert.ok(keys.includes('citrus'));
      assert.ok(keys.includes('leafy_greens'));
      assert.ok(keys.includes('exotic_produce'));
      assert.ok(keys.includes('berries'));
      assert.ok(keys.includes('root_vegetables'));
    });
  });
});
