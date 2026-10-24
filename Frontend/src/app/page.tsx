'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCart, CartItem } from '@/lib/cart-context';
import {
  getProducts,
  getCategories,
  getShops,
  CategoryItem,
  ShopPublicSummary
} from '@/lib/api-client';
import {
  resolveProduceImage,
  mapSlugToBackendCategory
} from '@/lib/catalog-utils';
import type { ProductItem } from '@aweermarket/types';
import styles from './Catalog.module.css';

function MarketplaceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchQuery = searchParams?.get('search') || '';
  const [mobileSearch, setMobileSearch] = useState(searchQuery);

  const { addToCart, conflict, resolveConflict, totalItemsCount } = useCart();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState<boolean>(true);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [apiProducts, setApiProducts] = useState<ProductItem[]>([]);
  const [shops, setShops] = useState<ShopPublicSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeSidebarNav, setActiveSidebarNav] = useState<string>('home');
  const [addedMessage, setAddedMessage] = useState<string | null>(null);

  useEffect(() => {
    setMobileSearch(searchQuery);
  }, [searchQuery]);

  const activeSearch = mobileSearch.trim() || searchQuery.trim();
  const backendCategory = useMemo(() => {
    const mapped = mapSlugToBackendCategory(selectedCategory);
    if (mapped) return mapped;
    if (selectedCategory && selectedCategory !== 'all') {
      return selectedCategory;
    }
    return undefined;
  }, [selectedCategory]);

  // Compute products list with CHEAP PRICE 1ST guarantee using real backend apiProducts
  const displayedProducts = useMemo(() => {
    let list: ProductItem[] = apiProducts;
    if (backendCategory) {
      list = list.filter(
        (p) =>
          p.category === backendCategory ||
          p.category.toLowerCase() === backendCategory.toLowerCase()
      );
    }
    if (activeSearch) {
      const q = activeSearch.toLowerCase();
      list = list.filter((p) => {
        return (
          p.name.toLowerCase().includes(q) ||
          p.originCountry.toLowerCase().includes(q) ||
          p.offers.some((o) => o.shopName.toLowerCase().includes(q))
        );
      });
    }
    // CRITICAL: CHEAPEST PRICE 1ST (Ascending)
    return [...list].sort(
      (a, b) => (a.lowestPriceAedPerKg || 0) - (b.lowestPriceAedPerKg || 0)
    );
  }, [apiProducts, backendCategory, activeSearch]);

  const loadData = async () => {
    try {
      setLoading(true);
      setCategoriesLoading(true);
      setCategoriesError(null);
      const [catsRes, shopsRes, prodsRes] = await Promise.all([
        getCategories().catch((err) => {
          console.error('Failed to load categories:', err);
          setCategoriesError('Unable to load categories. Please check connection.');
          return { statusCode: 500, categories: [] as CategoryItem[] };
        }),
        getShops().catch(() => ({ shops: [] })),
        getProducts({ limit: 100 }).catch(() => ({ products: [] }))
      ]);
      setCategories(catsRes.categories || []);
      setShops(shopsRes.shops || []);
      setApiProducts(prodsRes.products || []);
    } catch (err) {
      console.error('Failed to load initial marketplace data:', err);
    } finally {
      setLoading(false);
      setCategoriesLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const retryCategories = async () => {
    setCategoriesLoading(true);
    setCategoriesError(null);
    try {
      const res = await getCategories();
      setCategories(res.categories || []);
    } catch {
      setCategoriesError('Unable to load categories. Please check connection.');
    } finally {
      setCategoriesLoading(false);
    }
  };

  const handleAddApiProduct = (prod: ProductItem) => {
    // Pick lowest priced active offer with stock > 0
    const activeOffers = (prod.offers || []).filter((o) => o.availableStock > 0);
    const offer = activeOffers[0] || prod.offers?.[0];
    if (!offer || offer.availableStock <= 0) return;

    const item: CartItem = {
      productId: prod.id,
      name: prod.name,
      unit: offer.unit,
      unitWeightKg: offer.unitWeightKg,
      quantity: offer.minOrderQuantity || 1,
      unitPriceAed: offer.priceAed,
      minOrderQuantity: offer.minOrderQuantity || 1,
      availableStock: offer.availableStock
    };
    const shop = {
      id: offer.vendorId,
      name: offer.shopName
    };

    const added = addToCart(item, shop);
    if (added) {
      setAddedMessage(
        `Added ${prod.name} from ${offer.shopName} (${offer.equivalentPricePerKg.toFixed(2)} Dhs/kg) to cart!`
      );
      setTimeout(() => setAddedMessage(null), 2500);
    }
  };

  return (
    <div className={styles.pageWrapper}>
      {/* Toast Notification */}
      {addedMessage && (
        <div
          style={{
            position: 'fixed',
            top: 80,
            right: 24,
            backgroundColor: '#15803d',
            color: '#ffffff',
            padding: '12px 20px',
            borderRadius: 12,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            zIndex: 1500,
            fontWeight: 700,
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            animation: 'fadeIn 0.2s ease'
          }}
        >
          <span>✓</span>
          <span>{addedMessage}</span>
        </div>
      )}

      <div className={styles.mainGrid}>
        {/* =================================================================
            LEFT SIDEBAR (Desktop)
           ================================================================= */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarCard}>
            <Link
              href="/"
              onClick={() => { setActiveSidebarNav('home'); setSelectedCategory('all'); }}
              className={`${styles.menuItem} ${activeSidebarNav === 'home' ? styles.menuItemActive : ''}`}
            >
              <span className={styles.menuIcon}>🏠</span>
              <span>Home</span>
            </Link>
            <Link
              href="/fruits"
              className={`${styles.menuItem} ${activeSidebarNav === 'fruits' ? styles.menuItemActive : ''}`}
            >
              <span className={styles.menuIcon}>🍎</span>
              <span>Fruits</span>
            </Link>
            <Link
              href="/vegetables"
              className={`${styles.menuItem} ${activeSidebarNav === 'vegetables' ? styles.menuItemActive : ''}`}
            >
              <span className={styles.menuIcon}>🥬</span>
              <span>Vegetables</span>
            </Link>
            <Link
              href="/categories/leafy_greens"
              className={`${styles.menuItem} ${activeSidebarNav === 'herbs' ? styles.menuItemActive : ''}`}
            >
              <span className={styles.menuIcon}>🌿</span>
              <span>Herbs & Greens</span>
            </Link>
            <Link
              href="/categories/exotic_produce"
              className={`${styles.menuItem} ${activeSidebarNav === 'spices' ? styles.menuItemActive : ''}`}
            >
              <span className={styles.menuIcon}>🌶️</span>
              <span>Spices</span>
            </Link>
            <Link
              href="/categories/fresh_cuts"
              className={`${styles.menuItem} ${activeSidebarNav === 'freshcuts' ? styles.menuItemActive : ''}`}
            >
              <span className={styles.menuIcon}>🥗</span>
              <span>Fresh Cuts</span>
            </Link>
            <Link
              href="/categories/organic"
              className={`${styles.menuItem} ${activeSidebarNav === 'organic' ? styles.menuItemActive : ''}`}
            >
              <span className={styles.menuIcon}>🌱</span>
              <span>Organic</span>
            </Link>
            <Link
              href="/shops"
              className={`${styles.menuItem} ${activeSidebarNav === 'nearby' ? styles.menuItemActive : ''}`}
            >
              <span className={styles.menuIcon}>📍</span>
              <span>Wholesale Stalls</span>
            </Link>
            <Link
              href="/products"
              className={`${styles.menuItem} ${activeSidebarNav === 'wholesale' ? styles.menuItemActive : ''}`}
            >
              <span className={styles.menuIcon}>📦</span>
              <span>Wholesale Catalog</span>
            </Link>
            <Link
              href="/categories"
              className={styles.menuItem}
            >
              <span className={styles.menuIcon}>📑</span>
              <span>All Categories</span>
            </Link>
          </div>

          {/* Sidebar Promo Box */}
          <div className={styles.sidebarPromoCard}>
            <div className={styles.promoImageWrap}>
              <img
                src="/images/hero-basket.jpg"
                alt="Fresh Local Produce"
                className={styles.promoImage}
              />
            </div>
            <div className={styles.promoTitle}>Fresh Products Better Life</div>
            <p className={styles.promoText}>
              Support local vendors and get the freshest produce every day.
            </p>
            <a href="#todays-prices" className={styles.promoBtn}>
              <span>Explore Market</span>
              <span>→</span>
            </a>
          </div>
        </aside>

        {/* =================================================================
            CENTER MAIN AREA
           ================================================================= */}
        <main className={styles.centerContent}>
          {/* Hero Banner */}
          <section className={styles.heroBanner}>
            <div className={styles.heroTextGroup}>
              <span className={styles.heroTag}>Dubai Fruits & Vegetables Market</span>
              <h1 className={styles.heroTitle}>
                Fresh Produce Directly from{' '}
                <span className={styles.heroTitleHighlight}>Trusted Vendors</span>
              </h1>
              <div className={styles.heroSubPoints}>
                Better Prices • Fresher Products • Local Market
              </div>
              <a href="#todays-prices" className={styles.heroCtaBtn}>
                <span>Shop Now</span>
                <span>→</span>
              </a>
            </div>

            <div className={styles.heroBasketImageWrap}>
              <img
                src="/images/hero-basket.jpg"
                alt="Wicker basket with fresh vegetables"
                className={styles.heroBasketImg}
              />
            </div>

            {/* In-Hero Trust Card */}
            <div className={styles.heroTrustCard}>
              <div className={styles.trustCardTitle}>Freshness You Can Trust</div>
              <div className={styles.trustCardSub}>From local farms to your table</div>
              <div className={styles.trustCardControls}>
                <button type="button" className={styles.trustArrowBtn} aria-label="Previous">
                  ‹
                </button>
                <div className={styles.trustDots}>
                  <span className={styles.dotActive} />
                  <span className={styles.dotInactive} />
                  <span className={styles.dotInactive} />
                </div>
                <button type="button" className={styles.trustArrowBtn} aria-label="Next">
                  ›
                </button>
              </div>
            </div>
          </section>

          {/* Mobile Search Bar Component (Image 2 Match) */}
          <div className={styles.mobileSearchBarWrap}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (mobileSearch.trim()) {
                  router.push(`/?search=${encodeURIComponent(mobileSearch.trim())}`);
                }
              }}
              className={styles.mobileSearchBox}
            >
              <span className={styles.mobileSearchIcon}>🔍</span>
              <input
                type="text"
                className={styles.mobileSearchInput}
                placeholder="Search for fruits, vegetables, herbs..."
                value={mobileSearch}
                onChange={(e) => setMobileSearch(e.target.value)}
                autoComplete="off"
              />
              {mobileSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileSearch('');
                    if (searchQuery) router.push('/');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    padding: '0 6px'
                  }}
                  title="Clear search"
                >
                  ✕
                </button>
              )}
              <div className={styles.mobileSearchDivider} />
              <Link href="/checkout" className={styles.mobileSearchCartBtn} aria-label="Cart">
                🛒
              </Link>
            </form>
          </div>

          {/* 4 Feature Badges Row (Desktop Only) */}
          <div className={styles.guaranteesBar}>
            <div className={styles.guaranteeItem}>
              <span className={styles.guaranteeIcon}>🛡️</span>
              <div className={styles.guaranteeTextGroup}>
                <span className={styles.guaranteeTitle}>Fresh & Quality</span>
                <span className={styles.guaranteeSub}>Guaranteed</span>
              </div>
            </div>
            <div className={styles.guaranteeItem}>
              <span className={styles.guaranteeIcon}>🛡️</span>
              <div className={styles.guaranteeTextGroup}>
                <span className={styles.guaranteeTitle}>Verified Vendors</span>
                <span className={styles.guaranteeSub}>You Can Trust</span>
              </div>
            </div>
            <div className={styles.guaranteeItem}>
              <span className={styles.guaranteeIcon}>📍</span>
              <div className={styles.guaranteeTextGroup}>
                <span className={styles.guaranteeTitle}>Local Market</span>
                <span className={styles.guaranteeSub}>Dubai, UAE</span>
              </div>
            </div>
            <div className={styles.guaranteeItem}>
              <span className={styles.guaranteeIcon}>🚚</span>
              <div className={styles.guaranteeTextGroup}>
                <span className={styles.guaranteeTitle}>Flexible Delivery</span>
                <span className={styles.guaranteeSub}>& Pickup</span>
              </div>
            </div>
          </div>

          {/* Circular Category Navigation Chips (Dynamic from Real API) */}
          <div className={styles.categoriesBar}>
            {categoriesLoading ? (
              <div style={{ display: 'flex', gap: 12, padding: '4px 0', overflowX: 'auto' }}>
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    style={{
                      minWidth: 90,
                      height: 84,
                      borderRadius: 16,
                      background: '#0a1810',
                      border: '1px solid rgba(34, 197, 94, 0.12)',
                      opacity: 0.6
                    }}
                  />
                ))}
              </div>
            ) : categoriesError ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 16px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: 14,
                  color: '#fca5a5',
                  fontSize: '0.85rem'
                }}
              >
                <span>⚠️ {categoriesError}</span>
                <button
                  type="button"
                  onClick={retryCategories}
                  style={{
                    background: '#22c55e',
                    border: 'none',
                    color: '#052010',
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: '0.75rem'
                  }}
                >
                  Retry
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setSelectedCategory('all')}
                  className={`${styles.categoryCircleBtn} ${selectedCategory === 'all' ? styles.categoryCircleBtnActive : ''}`}
                >
                  <div className={styles.categoryCircleAvatar}>📦</div>
                  <span className={styles.categoryCircleTitle}>All Items</span>
                </button>
                {categories.map((cat) => {
                  const catSlug = cat.slug || cat.key;
                  const isActive = selectedCategory === catSlug;
                  return (
                    <button
                      key={catSlug}
                      type="button"
                      onClick={() => setSelectedCategory(catSlug)}
                      className={`${styles.categoryCircleBtn} ${isActive ? styles.categoryCircleBtnActive : ''}`}
                      title={cat.description || cat.label || cat.name}
                    >
                      <div className={styles.categoryCircleAvatar}>{cat.icon || '🥬'}</div>
                      <span className={styles.categoryCircleTitle}>{cat.label || cat.name}</span>
                    </button>
                  );
                })}
              </>
            )}
          </div>

          {/* Today's Best Prices Section */}
          <section id="todays-prices">
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitleGroup}>
                <h2 className={styles.sectionTitle}>
                  {activeSearch ? `Search Results for "${activeSearch}"` : "Today's Best Prices"}
                </h2>
                <span className={styles.lowestPriceBadge}>⚡ Lowest Price First</span>
                {activeSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileSearch('');
                      if (searchQuery) router.push('/');
                    }}
                    style={{
                      background: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      color: '#fca5a5',
                      borderRadius: 9999,
                      padding: '4px 12px',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                    title="Clear search filter"
                  >
                    <span>Clear Search</span>
                    <span>✕</span>
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('all');
                  if (searchQuery) router.push('/');
                }}
                className={styles.viewAllLink}
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <span>View All</span>
                <span>→</span>
              </button>
            </div>

            {/* Product Cards Grid — CHEAP PRICE 1ST (Real API Products) */}
            {loading ? (
              <div className={styles.productsGrid} style={{ marginTop: 14 }}>
                {[1, 2, 3, 4, 5, 6].map((k) => (
                  <div
                    key={k}
                    style={{
                      minHeight: 280,
                      background: '#0e2415',
                      borderRadius: 16,
                      border: '1px solid rgba(34, 197, 94, 0.12)',
                      padding: 14,
                      opacity: 0.5
                    }}
                  />
                ))}
              </div>
            ) : displayedProducts.length > 0 ? (
              <div className={styles.productsGrid} style={{ marginTop: 14 }}>
                {displayedProducts.map((prod, idx) => {
                  const activeOffers = (prod.offers || []).filter((o) => o.availableStock > 0);
                  const bestOffer = activeOffers[0] || prod.offers?.[0];
                  const hasStock = Boolean(bestOffer && bestOffer.availableStock > 0);
                  const img = resolveProduceImage(prod.name, prod.category);

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
                          <Link href={`/products/${prod.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                            {prod.name}
                          </Link>
                        </h3>
                        <div className={styles.productPrice}>
                          Dhs {prod.lowestPriceAedPerKg > 0 ? prod.lowestPriceAedPerKg.toFixed(2) : (bestOffer?.equivalentPricePerKg ? bestOffer.equivalentPricePerKg.toFixed(2) : '—')}
                          <span className={styles.priceUnit}>/kg</span>
                        </div>
                        <span className={styles.cardBadge}>
                          {idx === 0 && hasStock
                            ? '🏆 Lowest Price'
                            : hasStock
                            ? `${bestOffer?.unitWeightKg}kg ${bestOffer?.unit}`
                            : 'Out of Stock'}
                        </span>
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
                            <span className={styles.vendorName}>{bestOffer?.shopName || 'Al Aweer Stall'}</span>
                          )}
                          <div className={styles.vendorRatingLocation}>
                            <span>📍</span>
                            <span>{bestOffer?.stallNumber || 'Dubai Market'}</span>
                            <span>•</span>
                            <span>{prod.originCountry}</span>
                          </div>
                        </div>
                        {hasStock && bestOffer ? (
                          <button
                            type="button"
                            onClick={() => handleAddApiProduct(prod)}
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
                            className={styles.addToCartBtn}
                            style={{
                              background: '#1e293b',
                              color: '#64748b',
                              cursor: 'not-allowed',
                              border: '1px solid #334155'
                            }}
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
              <div
                style={{
                  padding: '40px 20px',
                  textAlign: 'center',
                  backgroundColor: '#0c2214',
                  borderRadius: 16,
                  border: '1px solid rgba(34, 197, 94, 0.2)',
                  marginTop: 14
                }}
              >
                <p style={{ color: '#94a3b8', fontSize: '1rem', margin: '0 0 16px 0' }}>
                  {activeSearch
                    ? `No wholesale produce found matching "${activeSearch}".`
                    : 'No wholesale produce offers currently listed in this category.'}
                </p>
                {activeSearch ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileSearch('');
                      if (searchQuery) router.push('/');
                    }}
                    style={{
                      backgroundColor: '#16a34a',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 8,
                      padding: '8px 18px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      marginRight: 10
                    }}
                  >
                    Clear Search
                  </button>
                ) : null}
                <Link
                  href="/products"
                  style={{
                    display: 'inline-block',
                    backgroundColor: '#0e2415',
                    border: '1px solid rgba(34, 197, 94, 0.4)',
                    color: '#86efac',
                    borderRadius: 8,
                    padding: '8px 18px',
                    fontWeight: 700,
                    textDecoration: 'none'
                  }}
                >
                  Browse Full Directory →
                </Link>
              </div>
            )}
          </section>
        </main>


      </div>

      {/* =====================================================================
          BOTTOM FULL-WIDTH BANNER
         ===================================================================== */}
      <section className={styles.bottomBannerSection}>
        <div className={styles.marketAisleSide}>
          <img
            src="/images/market-aisle.jpg"
            alt="Dubai Wholesale Produce Market Aisle"
            className={styles.marketAisleImg}
          />
          <div className={styles.marketAisleText}>
            <div className={styles.marketAisleHeading}>
              Dubai Market <br />
              <span style={{ color: '#4ade80' }}>Fresh. Local. Together.</span>
            </div>
            <div className={styles.marketAisleSub}>
              Multiple shops • Best prices • One marketplace
            </div>
            <a href="#todays-prices" className={styles.exploreVendorsBtn}>
              Explore All Vendors →
            </a>
          </div>
        </div>

        <div className={styles.bottomFeaturesCenter}>
          <div className={styles.bottomFeaturePill}>
            <span className={styles.bottomFeatureIcon}>🌱</span>
            <span>Fresh Produce Everyday</span>
          </div>
          <div className={styles.bottomFeaturePill}>
            <span className={styles.bottomFeatureIcon}>🛡️</span>
            <span>Verified Vendors You Can Trust</span>
          </div>
          <div className={styles.bottomFeaturePill}>
            <span className={styles.bottomFeatureIcon}>🔒</span>
            <span>Secure Payments Safe & Reliable</span>
          </div>
          <div className={styles.bottomFeaturePill}>
            <span className={styles.bottomFeatureIcon}>⚡</span>
            <span>Fast Delivery To Your Door</span>
          </div>
        </div>

        <div className={styles.bottomDealsRight}>
          <div className={styles.bottomDealsText}>
            <div className={styles.dealsTitle}>Fresh Deals Just For You!</div>
            <div className={styles.dealsSub}>Seasonal offers, special prices and more.</div>
            <a href="#todays-prices" className={styles.viewDealsPill}>
              View Deals →
            </a>
          </div>
          <img
            src="/images/hero-basket.jpg"
            alt="Basket"
            style={{ width: 70, height: 60, objectFit: 'cover', borderRadius: 10 }}
          />
        </div>
      </section>

      {/* =====================================================================
          MOBILE BOTTOM NAVIGATION (Image 2)
         ===================================================================== */}
      <nav className={styles.mobileBottomNav}>
        <Link href="/" className={`${styles.mobileNavItem} ${styles.mobileNavItemActive}`}>
          <span className={styles.mobileNavIcon}>🏠</span>
          <span>Home</span>
        </Link>
        <Link href="#todays-prices" className={styles.mobileNavItem}>
          <span className={styles.mobileNavIcon}>🔍</span>
          <span>Explore</span>
        </Link>
        <Link href="/account" className={styles.mobileNavItem}>
          <span className={styles.mobileNavIcon}>📋</span>
          <span>Orders</span>
        </Link>
        <Link href="/checkout" className={styles.mobileNavItem}>
          <span className={styles.mobileNavIcon}>🛒</span>
          <span className={styles.mobileNavBadge}>{totalItemsCount || 3}</span>
          <span>Cart</span>
        </Link>
        <Link href="/login" className={styles.mobileNavItem}>
          <span className={styles.mobileNavIcon}>👤</span>
          <span>Profile</span>
        </Link>
      </nav>

      {/* Single-Vendor Cart Conflict Modal */}
      {conflict && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBox}>
            <h3 className={styles.modalTitle}>Switch Wholesale Stall?</h3>
            <p className={styles.modalBody}>
              Your cart currently contains produce from <strong>{conflict.existingShopName}</strong>.
              Wholesale orders in Dubai Al Aweer market must be fulfilled by a single stall.
              <br /><br />
              Would you like to replace your cart with items from <strong>{conflict.newShopName}</strong>?
            </p>
            <div className={styles.modalActions}>
              <button
                type="button"
                onClick={() => resolveConflict(false)}
                className={styles.modalCancelBtn}
              >
                Keep Current Cart
              </button>
              <button
                type="button"
                onClick={() => {
                  resolveConflict(true);
                  setAddedMessage(`Cart updated with items from ${conflict.newShopName}`);
                  setTimeout(() => setAddedMessage(null), 2500);
                }}
                className={styles.modalConfirmBtn}
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

export default function MarketplaceHomePage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', backgroundColor: '#07130b' }} />}>
      <MarketplaceContent />
    </Suspense>
  );
}
