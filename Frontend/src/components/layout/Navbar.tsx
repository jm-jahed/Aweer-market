'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useCart, CartItem } from '@/lib/cart-context';
import { getProducts } from '@/lib/api-client';
import { resolveProduceImage } from '@/lib/catalog-utils';
import type { ProductItem } from '@aweermarket/types';
import styles from './Navbar.module.css';

export function Navbar() {
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();
  const { totalItemsCount, addToCart } = useCart();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [searchVal, setSearchVal] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<ProductItem[]>([]);
  const [addedToast, setAddedToast] = useState<string | null>(null);
  const searchContainerRef = useRef<HTMLFormElement>(null);

  // Query live backend products when search input changes with debounce — GUARANTEED LOWEST PRICE 1ST
  useEffect(() => {
    const trimmed = searchVal.trim();
    if (trimmed.length > 0) {
      const timer = setTimeout(() => {
        getProducts({ search: trimmed, limit: 8 })
          .then((res) => {
            const prods = (res.products || []).sort(
              (a, b) => (a.lowestPriceAedPerKg || 0) - (b.lowestPriceAedPerKg || 0)
            );
            setSearchResults(prods);
            setIsDropdownOpen(true);
          })
          .catch(() => {
            setSearchResults([]);
          });
      }, 200);
      return () => clearTimeout(timer);
    } else {
      setSearchResults([]);
      setIsDropdownOpen(false);
    }
  }, [searchVal]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      router.push('/');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setIsDropdownOpen(false);
    if (searchVal.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchVal.trim())}`);
    } else {
      router.push('/search');
    }
  };

  const handleSelectProduct = (prod: ProductItem) => {
    setIsDropdownOpen(false);
    router.push(`/products/${prod.id}`);
  };

  const handleQuickAdd = (e: React.MouseEvent, prod: ProductItem) => {
    e.stopPropagation();
    const activeOffers = (prod.offers || []).filter((o) => o.availableStock > 0);
    const bestOffer = activeOffers[0] || prod.offers?.[0];
    if (!bestOffer || bestOffer.availableStock <= 0) return;

    const item: CartItem = {
      productId: prod.id,
      name: prod.name,
      unit: bestOffer.unit,
      unitWeightKg: bestOffer.unitWeightKg,
      quantity: bestOffer.minOrderQuantity || 1,
      unitPriceAed: bestOffer.priceAed,
      minOrderQuantity: bestOffer.minOrderQuantity || 1,
      availableStock: bestOffer.availableStock
    };
    const shop = {
      id: bestOffer.vendorId,
      name: bestOffer.shopName
    };
    const success = addToCart(item, shop);
    if (success) {
      setAddedToast(
        `Added ${prod.name} from ${bestOffer.shopName} (Dhs ${bestOffer.priceAed.toFixed(2)} / ${bestOffer.unit}) to cart!`
      );
      setTimeout(() => setAddedToast(null), 2500);
    }
  };

  return (
    <header className={styles.header}>
      <div className={styles.navContainer}>
        {/* Mobile Header Row (Visible <= 768px) */}
        <div className={styles.mobileOnly}>
          <div className={styles.mobileHeaderRow}>
            <Link href="/" className={styles.mobileBrandLink}>
              <svg
                className={styles.leafIcon}
                width="34"
                height="34"
                viewBox="0 0 40 40"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M8 28C6 20 12 10 24 6C24 18 16 26 8 28Z" fill="url(#mobileLeaf1)" />
                <path d="M16 34C14 26 22 16 34 10C34 24 24 32 16 34Z" fill="url(#mobileLeaf2)" />
                <path d="M6 34C14 28 20 22 30 14" stroke="#bbf7d0" strokeWidth="2" strokeLinecap="round" />
                <defs>
                  <linearGradient id="mobileLeaf1" x1="6" y1="6" x2="24" y2="28" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#4ade80" />
                    <stop offset="1" stopColor="#15803d" />
                  </linearGradient>
                  <linearGradient id="mobileLeaf2" x1="14" y1="10" x2="34" y2="34" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#86efac" />
                    <stop offset="1" stopColor="#22c55e" />
                  </linearGradient>
                </defs>
              </svg>
              <div className={styles.brandTitles}>
                <span className={styles.brandLogoText}>
                  Aweer<span className={styles.brandAccent}>market</span>
                </span>
                <span className={styles.brandTagline}>FRESH • LOCAL • TOGETHER</span>
              </div>
            </Link>

            <div className={styles.mobileHeaderActions}>
              <div className={styles.mobileLocationPill}>
                <span style={{ color: '#ef4444', fontSize: '0.9rem' }}>📍</span>
                <span>Dubai, UAE</span>
                <span style={{ fontSize: '0.7rem', color: '#86efac' }}>▾</span>
              </div>

              <Link href="/cart" className={styles.mobileCartCircle} aria-label={`Wholesale Cart (${totalItemsCount} items)`}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="21" r="1"></circle>
                  <circle cx="20" cy="21" r="1"></circle>
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                </svg>
                <span className={styles.mobileCartBadgeCount}>{totalItemsCount}</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Brand / Logo (Desktop) */}
        <Link href="/" className={`${styles.brandLink} ${styles.desktopOnly}`}>
          {/* Custom SVG Leaf Logo */}
          <svg
            className={styles.leafIcon}
            width="38"
            height="38"
            viewBox="0 0 40 40"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M8 28C6 20 12 10 24 6C24 18 16 26 8 28Z"
              fill="url(#leafGrad1)"
            />
            <path
              d="M16 34C14 26 22 16 34 10C34 24 24 32 16 34Z"
              fill="url(#leafGrad2)"
            />
            <path
              d="M6 34C14 28 20 22 30 14"
              stroke="#bbf7d0"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <defs>
              <linearGradient id="leafGrad1" x1="6" y1="6" x2="24" y2="28" gradientUnits="userSpaceOnUse">
                <stop stopColor="#4ade80" />
                <stop offset="1" stopColor="#15803d" />
              </linearGradient>
              <linearGradient id="leafGrad2" x1="14" y1="10" x2="34" y2="34" gradientUnits="userSpaceOnUse">
                <stop stopColor="#86efac" />
                <stop offset="1" stopColor="#22c55e" />
              </linearGradient>
            </defs>
          </svg>

          <div className={styles.brandTitles}>
            <span className={styles.brandLogoText}>
              Aweer<span className={styles.brandAccent}>market</span>
            </span>
            <span className={styles.brandTagline}>Fresh • Local • Together</span>
          </div>
        </Link>

        {/* Location Dropdown Pill (Desktop) */}
        <div className={`${styles.locationPill} ${styles.desktopOnly}`}>
          <span className={styles.locationIcon}>📍</span>
          <div className={styles.locationTextGroup}>
            <span className={styles.locationMain}>Dubai Fruits & Vegetables Market</span>
            <span className={styles.locationSub}>Dubai, UAE</span>
          </div>
          <span className={styles.chevron}>▾</span>
        </div>

        {/* Center Search Bar */}
        <form
          ref={searchContainerRef}
          onSubmit={handleSearch}
          className={styles.searchForm}
        >
          <div className={styles.searchInputWrapper}>
            <span className={styles.searchIcon}>🔍</span>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search for fruits, vegetables, herbs..."
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
              onFocus={() => {
                if (searchVal.trim().length > 0) setIsDropdownOpen(true);
              }}
              id="catalog-search-input"
              autoComplete="off"
            />
            {searchVal && (
              <button
                type="button"
                onClick={() => {
                  setSearchVal('');
                  setIsDropdownOpen(false);
                }}
                className={styles.clearSearchBtn}
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Instant Search Dropdown — CHEAP PRICE 1ST */}
          {isDropdownOpen && (
            <div className={styles.searchDropdown}>
              <div className={styles.dropdownHeader}>
                <span className={styles.dropdownHeaderTitle}>
                  <span>🔍</span> Results for &ldquo;{searchVal}&rdquo;
                </span>
                <span className={styles.lowestPricePill}>
                  ⚡ Lowest Price 1st
                </span>
              </div>

              {searchResults.length > 0 ? (
                <div className={styles.dropdownList}>
                  {searchResults.map((prod, idx) => {
                    const activeOffers = (prod.offers || []).filter((o) => o.availableStock > 0);
                    const bestOffer = activeOffers[0] || prod.offers?.[0];
                    const hasStock = Boolean(bestOffer && bestOffer.availableStock > 0);
                    const img = resolveProduceImage(prod.name, prod.category, prod.imageUrl);
                    const displayPrice = bestOffer ? bestOffer.priceAed.toFixed(2) : '—';
                    const displayUnit = bestOffer ? bestOffer.unit : 'unit';

                    return (
                      <div
                        key={prod.id}
                        onClick={() => handleSelectProduct(prod)}
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
                              onClick={(e) => handleQuickAdd(e, prod)}
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
                  No produce found matching &ldquo;{searchVal}&rdquo;. Try &ldquo;Onion&rdquo;, &ldquo;Tomato&rdquo;, or &ldquo;Potato&rdquo;.
                </div>
              )}

              {searchResults.length > 0 && (
                <div
                  className={styles.dropdownFooter}
                  onClick={handleSearch}
                >
                  View all {searchResults.length} results sorted by lowest price →
                </div>
              )}
            </div>
          )}
        </form>

        {/* Quick Add Notification Toast */}
        {addedToast && (
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
              zIndex: 3000,
              fontWeight: 700,
              fontSize: '0.88rem',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              animation: 'fadeIn 0.2s ease'
            }}
          >
            <span>✓</span>
            <span>{addedToast}</span>
          </div>
        )}

        {/* Right Navigation Elements */}
        <div className={`${styles.navRight} ${styles.desktopOnly}`}>
          {/* Language Selector */}
          <button type="button" className={styles.languageBtn}>
            <span>🌐</span>
            <span>English</span>
            <span style={{ fontSize: '0.7rem' }}>▾</span>
          </button>

          {/* User Auth */}
          {isLoading ? (
            <div style={{ width: 100, height: 32, background: 'rgba(34,197,94,0.1)', borderRadius: 6 }} />
          ) : user ? (
            <div className={styles.userMenu}>
              <Link href="/account" className={styles.userLink} title="Buyer Account">
                <span className={styles.userBadge}>Buyer</span>
                <span>{user.fullName}</span>
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className={styles.logoutBtn}
                disabled={isLoggingOut}
              >
                {isLoggingOut ? '...' : 'Log Out'}
              </button>
            </div>
          ) : (
            <Link href="/login" className={styles.authBtn}>
              <span>👤</span>
              <span>Login / Sign Up</span>
            </Link>
          )}

          {/* Wishlist Icon */}
          <button type="button" className={styles.wishlistBtn} title="Saved items">
            ♡
          </button>

          {/* Cart Button Pill */}
          <Link href="/cart" className={styles.cartBtn} id="nav-cart-link">
            <span>🛒</span>
            <span>Cart</span>
            <span className={styles.cartBadge}>{totalItemsCount}</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
