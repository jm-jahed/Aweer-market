'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  getProducts,
  getCategories,
  getShops,
  CategoryItem,
  ShopPublicSummary
} from '@/lib/api-client';
import type { ProductItem, ProductOfferSummary } from '@aweermarket/types';
import styles from './Catalog.module.css';

export default function MarketplaceHomePage() {
  const [activeTab, setActiveTab] = useState<'catalog' | 'stalls'>('catalog');
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchInput, setSearchInput] = useState<string>('');
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [shops, setShops] = useState<ShopPublicSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modal for multi-stall offer comparison
  const [comparisonProduct, setComparisonProduct] = useState<ProductItem | null>(null);

  useEffect(() => {
    async function loadInitialData() {
      try {
        const [catsRes, shopsRes] = await Promise.all([
          getCategories().catch(() => ({ categories: [] })),
          getShops().catch(() => ({ shops: [] }))
        ]);
        setCategories(catsRes.categories || []);
        setShops(shopsRes.shops || []);
      } catch (err: unknown) {
        console.error('Failed to load initial metadata', err);
      }
    }
    loadInitialData();
  }, []);

  useEffect(() => {
    async function fetchCatalog() {
      setLoading(true);
      setError(null);
      try {
        const res = await getProducts({
          category: selectedCategory || undefined,
          search: searchQuery || undefined
        });
        setProducts(res.products || []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to fetch produce catalog');
      } finally {
        setLoading(false);
      }
    }

    if (activeTab === 'catalog') {
      fetchCatalog();
    }
  }, [selectedCategory, searchQuery, activeTab]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(searchInput.trim());
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setSearchQuery('');
  };

  return (
    <main className={styles.container}>
      {/* Hero Section */}
      <section className={styles.hero}>
        <h1 className={styles.heroTitle}>Dubai Al Aweer Wholesale Market</h1>
        <p className={styles.heroSubtitle}>
          Compare live wholesale prices in AED per kg directly across licensed Al Aweer stalls.
          Source fresh fruits, vegetables, citrus, and greens in bulk cartons, crates, and sacks.
        </p>

        <form onSubmit={handleSearchSubmit} className={styles.searchBox}>
          <input
            id="catalog-search-input"
            type="text"
            className={styles.searchInput}
            placeholder="Search produce (e.g. Valencia Oranges, Cavendish Bananas, Tomatoes)..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <button id="catalog-search-submit" type="submit" className={styles.searchBtn}>
            Search
          </button>
          {searchQuery && (
            <button
              type="button"
              onClick={handleClearSearch}
              style={{
                background: 'rgba(255,255,255,0.2)',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                padding: '0 16px',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              Clear
            </button>
          )}
        </form>
      </section>

      {/* Navigation Tabs */}
      <div className={styles.navTabs}>
        <button
          id="tab-catalog"
          className={`${styles.tabBtn} ${activeTab === 'catalog' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('catalog')}
        >
          Produce Catalog ({products.length})
        </button>
        <button
          id="tab-stalls"
          className={`${styles.tabBtn} ${activeTab === 'stalls' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('stalls')}
        >
          Al Aweer Stalls ({shops.length})
        </button>
      </div>

      {activeTab === 'catalog' && (
        <>
          {/* Categories Pill Bar */}
          <div className={styles.categoriesBar}>
            <button
              className={`${styles.categoryPill} ${selectedCategory === '' ? styles.categoryPillActive : ''}`}
              onClick={() => setSelectedCategory('')}
            >
              All Categories
            </button>
            {categories.map((cat) => (
              <button
                key={cat.key}
                className={`${styles.categoryPill} ${selectedCategory === cat.key ? styles.categoryPillActive : ''}`}
                onClick={() => setSelectedCategory(cat.key)}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              {selectedCategory
                ? categories.find((c) => c.key === selectedCategory)?.label || selectedCategory
                : 'All Wholesale Produce'}
            </h2>
            <span className={styles.countBadge}>
              Showing {products.length} {products.length === 1 ? 'produce item' : 'produce items'}
            </span>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
              <p>Loading fresh produce offers...</p>
            </div>
          ) : error ? (
            <div style={{ padding: '20px', background: '#fee2e2', color: '#991b1b', borderRadius: '10px' }}>
              {error}
            </div>
          ) : products.length === 0 ? (
            <div className={styles.emptyState}>
              <h3 className={styles.emptyTitle}>No wholesale produce found</h3>
              <p className={styles.emptyText}>
                Try adjusting your search query or selecting another produce category.
              </p>
            </div>
          ) : (
            <div className={styles.grid}>
              {products.map((product) => (
                <div key={product.id} className={styles.card} data-product-id={product.id}>
                  <div className={styles.cardMeta}>
                    <span className={styles.catBadge}>{product.category.replace('_', ' ')}</span>
                    <span className={styles.originTag}>Origin: {product.originCountry}</span>
                  </div>

                  <h3 className={styles.prodTitle}>{product.name}</h3>
                  <p className={styles.prodDesc}>
                    {product.description || 'Premium wholesale produce available from licensed Al Aweer merchants.'}
                  </p>

                  <div className={styles.priceBanner}>
                    <div>
                      <div className={styles.priceLabel}>Best Rate</div>
                      <div className={styles.priceAedKg}>
                        {product.lowestPriceAedPerKg > 0 ? (
                          <>
                            {product.lowestPriceAedPerKg.toFixed(2)}{' '}
                            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>AED/kg</span>
                          </>
                        ) : (
                          <span style={{ fontSize: '1rem', color: '#94a3b8' }}>Offers pending</span>
                        )}
                      </div>
                    </div>
                    <div className={styles.offersCount}>
                      {product.offers.length} {product.offers.length === 1 ? 'Stall Offer' : 'Stall Offers'}
                    </div>
                  </div>

                  <div className={styles.offersList}>
                    {product.offers.slice(0, 2).map((offer, idx) => (
                      <div key={idx} className={styles.offerRow}>
                        <Link href={`/shops/${offer.vendorId}`} className={styles.stallLink}>
                          {offer.shopName} {offer.stallNumber ? `(${offer.stallNumber})` : ''}
                        </Link>
                        <span className={styles.offerDetails}>
                          AED {offer.priceAed} / {offer.unitWeightKg}kg {offer.unit}
                        </span>
                      </div>
                    ))}
                  </div>

                  <button
                    id={`compare-offers-${product.id}`}
                    type="button"
                    className={styles.compareBtn}
                    onClick={() => setComparisonProduct(product)}
                  >
                    Compare All {product.offers.length} Stall Offers
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'stalls' && (
        <div style={{ marginTop: '16px' }}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Approved Al Aweer Merchants</h2>
            <span className={styles.countBadge}>{shops.length} verified stalls</span>
          </div>

          {shops.length === 0 ? (
            <div className={styles.emptyState}>
              <h3 className={styles.emptyTitle}>No verified stalls found</h3>
              <p className={styles.emptyText}>Approved merchant stalls will appear here.</p>
            </div>
          ) : (
            <div className={styles.stallsGrid}>
              {shops.map((shop) => (
                <div key={shop.id} className={styles.stallCard} data-shop-id={shop.id}>
                  <span className={styles.stallNumberBadge}>{shop.stallNumber || 'Stall TBA'}</span>
                  <h3 className={styles.stallName}>{shop.name}</h3>
                  <div className={styles.stallPhone}>Contact: {shop.phone}</div>
                  <Link href={`/shops/${shop.id}`} className={styles.viewStorefrontBtn}>
                    View Stall Storefront &rarr;
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Multi-Stall Offer Comparison Modal */}
      {comparisonProduct && (
        <div className={styles.modalBackdrop} onClick={() => setComparisonProduct(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h2 className={styles.modalTitle}>{comparisonProduct.name}</h2>
                <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>
                  Category: {comparisonProduct.category.replace('_', ' ')} | Origin: {comparisonProduct.originCountry}
                </p>
              </div>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={() => setComparisonProduct(null)}
              >
                &times;
              </button>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <table className={styles.offersTable}>
                <thead>
                  <tr>
                    <th>Stall</th>
                    <th>Packaging Unit</th>
                    <th>Price (AED)</th>
                    <th>Normalized Rate</th>
                    <th>MOQ</th>
                    <th>In Stock</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonProduct.offers.map((offer: ProductOfferSummary, idx: number) => {
                    const isLowest = offer.equivalentPricePerKg === comparisonProduct.lowestPriceAedPerKg;
                    return (
                      <tr key={idx}>
                        <td>
                          <strong>{offer.shopName}</strong>
                          {offer.stallNumber && (
                            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{offer.stallNumber}</div>
                          )}
                        </td>
                        <td>
                          {offer.unitWeightKg}kg {offer.unit}
                        </td>
                        <td>
                          <strong>AED {offer.priceAed}</strong>
                        </td>
                        <td>
                          <span style={{ fontWeight: 700, color: isLowest ? '#166534' : '#334155' }}>
                            {offer.equivalentPricePerKg.toFixed(2)} AED/kg
                          </span>
                          {isLowest && <span className={styles.lowestTag}>Lowest</span>}
                        </td>
                        <td>{offer.minOrderQuantity}</td>
                        <td>
                          <span style={{ color: offer.availableStock > 0 ? '#166534' : '#dc2626', fontWeight: 600 }}>
                            {offer.availableStock} {offer.unit}s
                          </span>
                        </td>
                        <td>
                          <Link
                            href={`/shops/${offer.vendorId}`}
                            style={{
                              display: 'inline-block',
                              padding: '6px 12px',
                              background: '#047857',
                              color: '#ffffff',
                              borderRadius: '6px',
                              textDecoration: 'none',
                              fontSize: '0.8rem',
                              fontWeight: 600
                            }}
                          >
                            Visit Stall
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ textAlign: 'right' }}>
              <button
                type="button"
                onClick={() => setComparisonProduct(null)}
                style={{
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
