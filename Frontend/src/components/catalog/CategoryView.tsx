'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useCart, CartItem } from '@/lib/cart-context';
import { getProducts, getCategories, CategoryItem } from '@/lib/api-client';
import type { ProductItem, ProductOfferSummary } from '@aweermarket/types';
import {
  mapSlugToBackendCategory,
  CATEGORY_DISPLAY_CONFIG,
  resolveProduceImage
} from '@/lib/catalog-utils';
import { formatCountryWithFlag } from '@/lib/country-flags';
import styles from './CategoryView.module.css';

interface CategoryViewProps {
  categorySlug: string;
  defaultTitle?: string;
  defaultDescription?: string;
  initialSearch?: string;
}

export function CategoryView({
  categorySlug,
  defaultTitle,
  defaultDescription,
  initialSearch
}: CategoryViewProps) {
  const normSlug = (categorySlug || '').toLowerCase().trim();
  const [categoryInfo, setCategoryInfo] = useState<CategoryItem | null>(null);

  useEffect(() => {
    let active = true;
    getCategories()
      .then((res) => {
        if (!active) return;
        const found = (res.categories || []).find(
          (c) =>
            (c.slug && c.slug.toLowerCase() === normSlug) ||
            (c.key && c.key.toLowerCase() === normSlug) ||
            (c.name && c.name.toLowerCase() === normSlug)
        );
        if (found) setCategoryInfo(found);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [normSlug]);

  const fallbackMeta = CATEGORY_DISPLAY_CONFIG[normSlug] || {
    title: defaultTitle || `${categorySlug.charAt(0).toUpperCase() + categorySlug.slice(1)} Wholesale`,
    description: defaultDescription || 'Browse verified wholesale produce from Dubai Al Aweer Central Market.',
    badge: `Category • ${categorySlug}`,
    icon: '📦'
  };

  const meta = {
    title: categoryInfo?.name || categoryInfo?.label || fallbackMeta.title,
    description: categoryInfo?.description || fallbackMeta.description,
    badge: fallbackMeta.badge,
    icon: categoryInfo?.icon || fallbackMeta.icon
  };

  const { addToCart, conflict, resolveConflict } = useCart();
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState(initialSearch || '');
  const [sortBy, setSortBy] = useState<'lowest_price' | 'highest_price' | 'name'>('lowest_price');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const backendCategory = useMemo(() => {
    const mapped = mapSlugToBackendCategory(normSlug);
    if (mapped) return mapped;
    if (normSlug && normSlug !== 'all' && normSlug !== 'search') return normSlug;
    return undefined;
  }, [normSlug]);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getProducts({
        category: backendCategory,
        search: searchTerm.trim() || undefined,
        limit: 50
      });
      setProducts(res.products || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to connect to marketplace server. Please check your connection.';
      setError(msg);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [backendCategory, searchTerm]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Client-side sort on fetched products (filter out unavailable products)
  const sortedProducts = useMemo(() => {
    return products
      .filter((p) =>
        (p.offers || []).some((o) => typeof o.availableStock === 'number' && o.availableStock > 0 && o.priceAed > 0)
      )
      .sort((a, b) => {
        const priceA = a.lowestPriceAedPerKg || 0;
        const priceB = b.lowestPriceAedPerKg || 0;
        if (sortBy === 'lowest_price') return priceA - priceB;
        if (sortBy === 'highest_price') return priceB - priceA;
        return a.name.localeCompare(b.name);
      });
  }, [products, sortBy]);

  const handleAddToCart = (product: ProductItem, offer: ProductOfferSummary) => {
    if (!offer || offer.availableStock <= 0) return;

    const item: CartItem = {
      productId: product.id,
      name: product.name,
      unit: offer.unit,
      unitWeightKg: offer.unitWeightKg,
      unitPriceAed: offer.priceAed,
      quantity: offer.minOrderQuantity || 1,
      minOrderQuantity: offer.minOrderQuantity || 1,
      availableStock: offer.availableStock,
      imageUrl: product.imageUrl,
      category: product.category
    };

    const shop = {
      id: offer.vendorId,
      name: offer.shopName
    };

    const added = addToCart(item, shop);
    if (added) {
      setToastMessage(
        `Added ${product.name} from ${offer.shopName} (Dhs ${offer.priceAed.toFixed(2)} / ${offer.unit}) to cart!`
      );
      setTimeout(() => setToastMessage(null), 2500);
    }
  };

  return (
    <div className={styles.container}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: 80,
            right: 24,
            backgroundColor: '#15803d',
            color: '#ffffff',
            padding: '12px 20px',
            borderRadius: 12,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            zIndex: 2000,
            fontWeight: 700,
            fontSize: '0.88rem',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            animation: 'fadeIn 0.2s ease'
          }}
        >
          <span>✓</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className={styles.breadcrumbs}>
        <Link href="/" className={styles.breadcrumbLink}>
          Home
        </Link>
        <span className={styles.breadcrumbSep}>/</span>
        <Link href="/categories" className={styles.breadcrumbLink}>
          Categories
        </Link>
        <span className={styles.breadcrumbSep}>/</span>
        <span className={styles.breadcrumbCurrent}>{meta.title}</span>
      </nav>

      {/* Category Hero Banner */}
      <header className={styles.categoryHero}>
        <div className={styles.categoryHeroText}>
          <span className={styles.categoryBadge}>{meta.badge}</span>
          <h1 className={styles.categoryTitle}>{meta.title}</h1>
          <p className={styles.categorySubtitle}>{meta.description}</p>
        </div>
        <div className={styles.categoryMetaPill}>
          <span className={styles.categoryMetaCount}>
            {loading ? '...' : sortedProducts.length}
          </span>
          <span className={styles.categoryMetaLabel}>Available Items</span>
        </div>
      </header>

      {/* Filter and Sort Controls */}
      <div className={styles.controlsBar}>
        <div className={styles.controlsLeft}>
          <input
            type="text"
            placeholder={`Filter ${meta.title}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
        </div>
        <div className={styles.controlsRight}>
          <label htmlFor="category-sort" style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
            Sort:
          </label>
          <select
            id="category-sort"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className={styles.sortSelect}
          >
            <option value="lowest_price">⚡ Lowest Price First</option>
            <option value="highest_price">Highest Price</option>
            <option value="name">Name (A-Z)</option>
          </select>
        </div>
      </div>

      {/* Main Content: Loading, Error, Empty, or Product Grid */}
      {loading ? (
        <div className={styles.productsGrid}>
          {[1, 2, 3, 4, 5, 6].map((k) => (
            <div key={k} className={styles.skeletonCard}>
              <div className={styles.skeletonImg} />
              <div className={styles.skeletonLine} />
              <div className={styles.skeletonLineShort} />
              <div className={styles.skeletonLine} />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className={styles.errorState}>
          <div className={styles.errorTitle}>Unable to Load Marketplace Produce</div>
          <p className={styles.errorSub}>{error}</p>
          <button type="button" onClick={loadProducts} className={styles.retryBtn}>
            Try Again ↻
          </button>
        </div>
      ) : sortedProducts.length > 0 ? (
        <div className={styles.productsGrid}>
          {sortedProducts.map((prod, idx) => {
            // Find lowest priced active offer
            const activeOffers = (prod.offers || []).filter(
              (o) => o.availableStock > 0
            );
            const bestOffer: ProductOfferSummary | undefined =
              activeOffers.length > 0 ? activeOffers[0] : prod.offers?.[0];

            const img = resolveProduceImage(prod.name, prod.category, prod.imageUrl);
            const hasStock = Boolean(bestOffer && bestOffer.availableStock > 0);
            const displayPrice = bestOffer ? bestOffer.priceAed.toFixed(2) : '—';
            const displayUnit = bestOffer ? bestOffer.unit : 'unit';

            return (
              <div key={prod.id} className={styles.productCard}>
                <div className={styles.cardImageContainer}>
                  <button type="button" className={styles.heartBtn} title="Save to favorites">
                    ♡
                  </button>
                  <img
                    src={img}
                    alt={prod.name}
                    className={styles.productImg}
                    loading="lazy"
                  />
                </div>
                <div className={styles.cardBody}>
                  <h3 className={styles.productName}>
                    <Link
                      href={`/products/${prod.id}`}
                      style={{ color: 'inherit', textDecoration: 'none' }}
                    >
                      {prod.name}
                    </Link>
                  </h3>
                  <div className={styles.productPrice}>
                    Dhs {displayPrice}
                    <span className={styles.priceUnit}> / {displayUnit}</span>
                  </div>
                  {(!hasStock || (idx === 0 && sortBy === 'lowest_price' && hasStock)) && (
                    <span className={styles.cardBadge}>
                      {idx === 0 && sortBy === 'lowest_price' && hasStock
                        ? '🏆 Lowest Price'
                        : 'Out of Stock'}
                    </span>
                  )}
                  <div className={styles.vendorInfo}>
                    {bestOffer?.vendorId ? (
                      <Link
                        href={`/shops/${bestOffer.vendorId}`}
                        className={styles.vendorLink}
                        title={`View ${bestOffer.shopName}'s full wholesale profile`}
                      >
                        {bestOffer.shopName}
                      </Link>
                    ) : (
                      <span className={styles.vendorName}>
                        {bestOffer?.shopName || 'Al Aweer Stall'}
                      </span>
                    )}
                    <div className={styles.vendorRatingLocation}>
                      <span>📍</span>
                      <span>{bestOffer?.stallNumber || 'Dubai Market'}</span>
                      <span>•</span>
                      <span>{formatCountryWithFlag(prod.originCountry)}</span>
                    </div>
                  </div>
                  {hasStock && bestOffer ? (
                    <button
                      type="button"
                      onClick={() => handleAddToCart(prod, bestOffer)}
                      className={styles.addToCartBtn}
                      id={`add-cart-${prod.id}`}
                    >
                      <span>Add to Cart</span>
                      <span>🛒</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className={`${styles.addToCartBtn} ${styles.disabledBtn}`}
                    >
                      <span>Unavailable</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <div className={styles.emptyTitle}>No wholesale produce currently available</div>
          <p className={styles.emptySub}>
            {searchTerm
              ? `No produce found matching "${searchTerm}". Try checking your spelling or clearing filters.`
              : 'Stalls at Dubai Al Aweer Central Market have not listed wholesale offers in this category yet today.'}
          </p>
          {searchTerm ? (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className={styles.exploreBtn}
              style={{ marginRight: 12 }}
            >
              Clear Filter
            </button>
          ) : null}
          <Link href="/products" className={styles.exploreBtn}>
            Browse All Categories
          </Link>
        </div>
      )}

      {/* Single-Vendor Cart Conflict Modal */}
      {conflict && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3000,
            padding: 16
          }}
        >
          <div
            style={{
              background: '#0c1f14',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              borderRadius: 20,
              padding: 24,
              maxWidth: 440,
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)'
            }}
          >
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
              Switch Wholesale Stall?
            </h3>
            <p style={{ fontSize: '0.88rem', color: '#cbd5e1', lineHeight: 1.5, margin: 0 }}>
              Your cart currently contains produce from <strong>{conflict.existingShopName}</strong>.
              Wholesale orders in Dubai Al Aweer market must be fulfilled by a single stall.
              <br /><br />
              Would you like to replace your cart with items from <strong>{conflict.newShopName}</strong>?
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
              <button
                type="button"
                onClick={() => resolveConflict(false)}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#cbd5e1',
                  borderRadius: 10,
                  padding: '8px 16px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Keep Current Cart
              </button>
              <button
                type="button"
                onClick={() => {
                  resolveConflict(true);
                  setToastMessage(`Cart updated with items from ${conflict.newShopName}`);
                  setTimeout(() => setToastMessage(null), 2500);
                }}
                style={{
                  background: '#22c55e',
                  border: 'none',
                  color: '#052e16',
                  borderRadius: 10,
                  padding: '8px 16px',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                Replace Cart & Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
