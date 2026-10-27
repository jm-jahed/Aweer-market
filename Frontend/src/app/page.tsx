'use client';

import React, { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCart, CartItem } from '@/lib/cart-context';
import { useAuth } from '@/lib/auth-context';
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
  const [isMobileDropdownOpen, setIsMobileDropdownOpen] = useState(false);
  const [mobileSearchResults, setMobileSearchResults] = useState<ProductItem[]>([]);
  const mobileSearchContainerRef = useRef<HTMLDivElement>(null);

  const { addToCart, conflict, resolveConflict, totalItemsCount } = useCart();
  const { user } = useAuth();
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

  // Live suggestions query for mobile search input with debounce (Guaranteed Lowest Price 1st)
  useEffect(() => {
    const trimmed = mobileSearch.trim();
    if (trimmed.length > 0) {
      const timer = setTimeout(() => {
        getProducts({ search: trimmed, limit: 12 })
          .then((res) => {
            const availableProds = (res.products || [])
              .filter((p) => (p.offers || []).some((o) => typeof o.availableStock === 'number' && o.availableStock > 0 && o.priceAed > 0))
              .sort((a, b) => (a.lowestPriceAedPerKg || 0) - (b.lowestPriceAedPerKg || 0));

            if (availableProds.length > 0) {
              setMobileSearchResults(availableProds);
            } else {
              // Fallback to loaded apiProducts in client memory
              const q = trimmed.toLowerCase();
              const clientMatches = apiProducts
                .filter((p) => (p.offers || []).some((o) => typeof o.availableStock === 'number' && o.availableStock > 0 && o.priceAed > 0))
                .filter((p) =>
                  p.name.toLowerCase().includes(q) ||
                  p.originCountry.toLowerCase().includes(q) ||
                  (p.category && p.category.toLowerCase().includes(q)) ||
                  (p.description && p.description.toLowerCase().includes(q)) ||
                  p.offers.some((o) => o.shopName.toLowerCase().includes(q))
                );
              setMobileSearchResults(clientMatches);
            }
            setIsMobileDropdownOpen(true);
          })
          .catch(() => {
            const q = trimmed.toLowerCase();
            const clientMatches = apiProducts
              .filter((p) => (p.offers || []).some((o) => typeof o.availableStock === 'number' && o.availableStock > 0 && o.priceAed > 0))
              .filter((p) =>
                p.name.toLowerCase().includes(q) ||
                p.originCountry.toLowerCase().includes(q) ||
                (p.category && p.category.toLowerCase().includes(q))
              );
            setMobileSearchResults(clientMatches);
            setIsMobileDropdownOpen(true);
          });
      }, 180);
      return () => clearTimeout(timer);
    } else {
      setMobileSearchResults([]);
      setIsMobileDropdownOpen(false);
    }
  }, [mobileSearch, apiProducts]);

  // Close mobile suggestions on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        mobileSearchContainerRef.current &&
        !mobileSearchContainerRef.current.contains(event.target as Node)
      ) {
        setIsMobileDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
    // Only display products that have active offers in stock (filter out unavailable products)
    let list: ProductItem[] = apiProducts.filter((p) =>
      (p.offers || []).some((o) => typeof o.availableStock === 'number' && o.availableStock > 0 && o.priceAed > 0)
    );
    // When searching actively, do not constrain by stale category so users find produce anywhere
    if (backendCategory && !activeSearch) {
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
          (p.category && p.category.toLowerCase().includes(q)) ||
          (p.description && p.description.toLowerCase().includes(q)) ||
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
        `Added ${prod.name} from ${offer.shopName} (Dhs ${offer.priceAed.toFixed(2)} / ${offer.unit}) to cart!`
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
          {/* Mobile Search Bar Component (Positioned at top of mobile screen - FIXED/STICKY) */}
          <div ref={mobileSearchContainerRef} className={styles.mobileSearchBarWrap}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setIsMobileDropdownOpen(false);
                const trimmed = mobileSearch.trim();
                if (trimmed) {
                  setSelectedCategory('all');
                  router.push(`/?search=${encodeURIComponent(trimmed)}#todays-prices`);
                  const el = document.getElementById('todays-prices');
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth' });
                  }
                } else {
                  router.push('/');
                }
              }}
              className={styles.mobileSearchBox}
            >
              <span className={styles.mobileSearchIcon}>🔍</span>
              <input
                type="text"
                className={styles.mobileSearchInput}
                placeholder="Search fruits, vegetables, herbs..."
                value={mobileSearch}
                onChange={(e) => {
                  setMobileSearch(e.target.value);
                  if (e.target.value.trim().length > 0) {
                    setIsMobileDropdownOpen(true);
                  }
                }}
                onFocus={() => {
                  if (mobileSearch.trim().length > 0) {
                    setIsMobileDropdownOpen(true);
                  }
                }}
                autoComplete="off"
                id="mobile-search-input"
              />
              {mobileSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileSearch('');
                    setIsMobileDropdownOpen(false);
                    if (searchQuery) router.push('/');
                  }}
                  className={styles.clearSearchBtn}
                  title="Clear search"
                >
                  ✕
                </button>
              )}
              <button
                type="submit"
                className={styles.mobileSearchFilterBtn}
                aria-label="Submit search"
                title="Search wholesale market"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="4" y1="21" x2="4" y2="14"></line>
                  <line x1="4" y1="10" x2="4" y2="3"></line>
                  <line x1="12" y1="21" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12" y2="3"></line>
                  <line x1="20" y1="21" x2="20" y2="16"></line>
                  <line x1="20" y1="12" x2="20" y2="3"></line>
                  <line x1="1" y1="14" x2="7" y2="14"></line>
                  <line x1="9" y1="8" x2="15" y2="8"></line>
                  <line x1="17" y1="16" x2="23" y2="16"></line>
                </svg>
              </button>
            </form>

            {/* Live Instant Search Suggestions Dropdown (Mobile) */}
            {isMobileDropdownOpen && (
              <div className={styles.mobileSearchDropdown}>
                <div className={styles.dropdownHeader}>
                  <span className={styles.dropdownHeaderTitle}>
                    <span>🔍</span> Results for &ldquo;{mobileSearch}&rdquo;
                  </span>
                  <span className={styles.lowestPricePill}>
                    ⚡ Lowest Price 1st
                  </span>
                </div>

                {mobileSearchResults.length > 0 ? (
                  <div className={styles.dropdownList}>
                    {mobileSearchResults.map((prod, idx) => {
                      const activeOffers = (prod.offers || []).filter((o) => o.availableStock > 0);
                      const bestOffer = activeOffers[0] || prod.offers?.[0];
                      const hasStock = Boolean(bestOffer && bestOffer.availableStock > 0);
                      const img = resolveProduceImage(prod.name, prod.category, prod.imageUrl);
                      const displayPrice = bestOffer ? bestOffer.priceAed.toFixed(2) : '—';
                      const displayUnit = bestOffer ? bestOffer.unit : 'unit';

                      return (
                        <div
                          key={prod.id}
                          onClick={() => {
                            setIsMobileDropdownOpen(false);
                            router.push(`/products/${prod.id}`);
                          }}
                          className={styles.dropdownItem}
                        >
                          <div className={styles.dropdownItemLeft}>
                            <img
                              src={img}
                              alt={prod.name}
                              className={styles.dropdownItemImg}
                            />
                            <div className={styles.dropdownItemMeta}>
                              <div className={styles.dropdownItemName}>
                                <span>{prod.name}</span>
                                {idx === 0 && (
                                  <span className={styles.cheapestBadge}>
                                    🏆 Cheapest
                                  </span>
                                )}
                              </div>
                              <span className={styles.dropdownItemVendor}>
                                {bestOffer?.shopName || 'Al Aweer Stall'} • {prod.originCountry}
                              </span>
                            </div>
                          </div>

                          <div className={styles.dropdownItemRight}>
                            <div className={styles.dropdownItemPrice}>
                              <span className={styles.priceAed}>
                                Dhs {displayPrice}
                              </span>
                              <span className={styles.pricePerKg}> / {displayUnit}</span>
                            </div>
                            {hasStock ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddApiProduct(prod);
                                }}
                                className={styles.dropdownAddBtn}
                                title="Add to wholesale cart"
                              >
                                + Add
                              </button>
                            ) : (
                              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Out of stock</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className={styles.dropdownEmpty}>
                    No wholesale produce found matching &ldquo;{mobileSearch}&rdquo;. Try &ldquo;Orange&rdquo;, &ldquo;Tomato&rdquo;, or &ldquo;Banana&rdquo;.
                  </div>
                )}

                {mobileSearchResults.length > 0 && (
                  <div
                    className={styles.dropdownFooter}
                    onClick={() => {
                      setIsMobileDropdownOpen(false);
                      setSelectedCategory('all');
                      router.push(`/?search=${encodeURIComponent(mobileSearch.trim())}#todays-prices`);
                      const el = document.getElementById('todays-prices');
                      if (el) {
                        el.scrollIntoView({ behavior: 'smooth' });
                      }
                    }}
                  >
                    View all {mobileSearchResults.length} results sorted by lowest price →
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Hero Banner */}
          <section className={styles.heroBanner}>
            <div className={styles.heroTextGroup}>
              <div className={styles.heroFreshBadge}>
                <span className={styles.heroFreshLeaf}>🍃</span>
                <span>FRESH &amp; NATURAL</span>
              </div>
              <h1 className={styles.heroTitle}>
                Fresh Produce<br />
                Directly from{' '}
                <span className={styles.heroTitleHighlight}>Trusted Vendors</span>
              </h1>
              <div className={styles.heroSubPoints}>
                Better Prices • Fresher Products •<br />Local Market
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
              <div className={styles.goldFreshBadge}>
                <span className={styles.goldLeafIcon}>🍃</span>
                <span className={styles.goldBadgeNumber}>100%</span>
                <span className={styles.goldBadgeText}>FRESH</span>
              </div>
            </div>

            {/* In-Hero Trust Card (Desktop) */}
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

            {/* Carousel Indicator Dots (Mobile) */}
            <div className={styles.carouselDots}>
              <span className={styles.dotPillActive} />
              <span className={styles.dotCircle} />
              <span className={styles.dotCircle} />
              <span className={styles.dotCircle} />
            </div>
          </section>

          {/* 4 Feature Badges Row (Trust Badges) */}
          <div className={styles.guaranteesBar}>
            <div className={styles.guaranteeItem}>
              <span className={styles.guaranteeIcon}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                  <polyline points="9 12 11 14 15 10"></polyline>
                </svg>
              </span>
              <div className={styles.guaranteeTextGroup}>
                <span className={styles.guaranteeTitle}>Fresh &amp; Quality</span>
                <span className={styles.guaranteeSub}>Guaranteed</span>
              </div>
            </div>
            <div className={styles.guaranteeItem}>
              <span className={styles.guaranteeIcon}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="7"></circle>
                  <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline>
                </svg>
              </span>
              <div className={styles.guaranteeTextGroup}>
                <span className={styles.guaranteeTitle}>Verified Vendors</span>
                <span className={styles.guaranteeSub}>You Can Trust</span>
              </div>
            </div>
            <div className={styles.guaranteeItem}>
              <span className={styles.guaranteeIcon}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>
              </span>
              <div className={styles.guaranteeTextGroup}>
                <span className={styles.guaranteeTitle}>Local Market</span>
                <span className={styles.guaranteeSub}>Dubai, UAE</span>
              </div>
            </div>
            <div className={styles.guaranteeItem}>
              <span className={styles.guaranteeIcon}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="3" width="15" height="13"></rect>
                  <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
                  <circle cx="5.5" cy="18.5" r="2.5"></circle>
                  <circle cx="18.5" cy="18.5" r="2.5"></circle>
                </svg>
              </span>
              <div className={styles.guaranteeTextGroup}>
                <span className={styles.guaranteeTitle}>Flexible Delivery</span>
                <span className={styles.guaranteeSub}>&amp; Pickup</span>
              </div>
            </div>
          </div>

          {/* Shop by Category Section Header */}
          <div className={styles.categorySectionHeader}>
            <h2 className={styles.categorySectionTitle}>Shop by Category</h2>
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={styles.viewAllLink}
            >
              <span>View All</span>
              <span>→</span>
            </button>
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
                  <div className={styles.categoryCircleAvatar}>🧺</div>
                  <span className={styles.categoryCircleTitle}>All Items</span>
                </button>
                {categories.map((cat) => {
                  const catSlug = cat.slug || cat.key;
                  const isActive = selectedCategory === catSlug;
                  const icon =
                    catSlug === 'fresh_fruits' || catSlug === 'fruits'
                      ? '🍊'
                      : catSlug === 'fresh_vegetables' || catSlug === 'vegetables'
                      ? '🥦'
                      : catSlug === 'citrus'
                      ? '🍋'
                      : catSlug === 'leafy_greens' || catSlug === 'herbs_greens'
                      ? '🥬'
                      : catSlug === 'exotic_produce'
                      ? '🥑'
                      : catSlug === 'berries'
                      ? '🫐'
                      : catSlug === 'root_vegetables'
                      ? '🥕'
                      : cat.icon || '🥬';

                  return (
                    <button
                      key={catSlug}
                      type="button"
                      onClick={() => setSelectedCategory(catSlug)}
                      className={`${styles.categoryCircleBtn} ${isActive ? styles.categoryCircleBtnActive : ''}`}
                      title={cat.description || cat.label || cat.name}
                    >
                      <div className={styles.categoryCircleAvatar}>{icon}</div>
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
                  {activeSearch ? (
                    `Search Results for "${activeSearch}"`
                  ) : (
                    <span className={styles.sectionTitleWithIcon}>
                      <span className={styles.lightningIcon}>⚡</span> Today&apos;s Best Prices
                    </span>
                  )}
                </h2>
                <span className={styles.lowestPriceBadge}>
                  <span style={{ fontSize: '0.85rem' }}>🌱</span> Lowest Price First
                </span>
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
                      minHeight: 120,
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
                  const img = resolveProduceImage(prod.name, prod.category, prod.imageUrl);
                  const displayPrice = bestOffer ? bestOffer.priceAed.toFixed(2) : '—';
                  const displayUnit = bestOffer ? bestOffer.unit : 'unit';

                  return (
                    <div key={prod.id} className={styles.productCard}>
                      <div className={styles.cardImageContainer}>
                        <button type="button" className={`${styles.heartBtn} ${styles.desktopOnlyHeart}`} title="Save to favorites">
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
                        {/* Mobile-only header row inside card */}
                        <div className={styles.mobileCardTopRow}>
                          <span className={styles.freshLocalPill}>Fresh &amp; Local</span>
                          <button type="button" className={styles.mobileHeartBtn} title="Save to favorites">
                            ♡
                          </button>
                        </div>

                        <h3 className={styles.productName}>
                          <Link href={`/products/${prod.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                            {prod.name}
                          </Link>
                        </h3>

                        <div className={styles.mobileProductSubtitle}>
                          Premium quality • {prod.originCountry || 'Farm fresh'}
                        </div>

                        {/* Mobile-only price & cart action row */}
                        <div className={styles.mobilePriceActionRow}>
                          <div className={styles.productPrice}>
                            Dhs {displayPrice}
                            <span className={styles.priceUnit}> / {displayUnit}</span>
                          </div>
                          {hasStock && bestOffer ? (
                            <button
                              type="button"
                              onClick={() => handleAddApiProduct(prod)}
                              className={styles.addToCartBtn}
                              id={`add-cart-${prod.id}`}
                            >
                              <span>🛒</span>
                              <span>Add to Cart</span>
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

                        {/* Desktop price, badge & vendor */}
                        <div className={`${styles.productPrice} ${styles.desktopOnlyPrice}`}>
                          Dhs {displayPrice}
                          <span className={styles.priceUnit}> / {displayUnit}</span>
                        </div>
                        <span className={`${styles.cardBadge} ${styles.desktopOnlyBadge}`}>
                          {idx === 0 && hasStock
                            ? '🏆 Lowest Price'
                            : hasStock
                            ? `${bestOffer?.unitWeightKg}kg ${bestOffer?.unit}`
                            : 'Out of Stock'}
                        </span>
                        <div className={`${styles.vendorInfo} ${styles.desktopOnlyVendor}`}>
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
                        <div className={styles.desktopOnlyAddToCart}>
                          {hasStock && bestOffer ? (
                            <button
                              type="button"
                              onClick={() => handleAddApiProduct(prod)}
                              className={styles.addToCartBtn}
                              id={`add-cart-desktop-${prod.id}`}
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
          MOBILE BOTTOM NAVIGATION (5 items matching screenshot)
         ===================================================================== */}
      <nav className={styles.mobileBottomNav}>
        <Link href="/" className={`${styles.mobileNavItem} ${styles.mobileNavItemActive}`}>
          <svg className={styles.mobileNavSvg} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
          <span>Home</span>
        </Link>
        <Link href="/categories" className={styles.mobileNavItem}>
          <svg className={styles.mobileNavSvg} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7"></rect>
            <rect x="14" y="3" width="7" height="7"></rect>
            <rect x="14" y="14" width="7" height="7"></rect>
            <rect x="3" y="14" width="7" height="7"></rect>
          </svg>
          <span>Categories</span>
        </Link>
        <Link href="/account/orders" className={styles.mobileNavItem}>
          <svg className={styles.mobileNavSvg} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <path d="M16 10a4 4 0 0 1-8 0"></path>
          </svg>
          <span>Orders</span>
        </Link>
        <Link href={user ? '/account' : '/login'} className={styles.mobileNavItem} id="home-bottom-profile-link">
          <svg className={styles.mobileNavSvg} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
          <span>Account</span>
        </Link>
        <button
          type="button"
          onClick={() => router.push('/shops')}
          className={styles.mobileNavItem}
          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <svg className={styles.mobileNavSvg} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="1.5"></circle>
            <circle cx="19" cy="12" r="1.5"></circle>
            <circle cx="5" cy="12" r="1.5"></circle>
          </svg>
          <span>More</span>
        </button>
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
