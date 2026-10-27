'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCart } from '@/lib/cart-context';
import { getShopById, ShopPublicSummary, ShopStorefrontProduct } from '@/lib/api-client';
import { resolveProduceImage } from '@/lib/catalog-utils';
import styles from './Storefront.module.css';

type StorefrontTab = 'products' | 'info' | 'reviews' | 'location';

export default function ShopStorefrontPage() {
  const params = useParams();
  const shopId = (params?.id as string) || '';
  const { addToCart } = useCart();

  const [shop, setShop] = useState<ShopPublicSummary | null>(null);
  const [products, setProducts] = useState<ShopStorefrontProduct[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Storefront interactive state
  const [activeTab, setActiveTab] = useState<StorefrontTab>('products');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isFollowing, setIsFollowing] = useState<boolean>(false);
  const [favoriteProductIds, setFavoriteProductIds] = useState<Set<string>>(new Set());
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!shopId || shopId.trim().length === 0) {
      setError('Invalid shop ID provided');
      setLoading(false);
      return;
    }

    async function loadStorefront() {
      setLoading(true);
      setError(null);
      try {
        const res = await getShopById(shopId.trim());
        setShop(res.shop);
        // Ensure every product strictly has offers belonging to this shop
        const sanitizedProducts = (res.products || []).filter(
          (p) => p.offers && p.offers.some((o) => o.vendorId === res.shop.id)
        );
        setProducts(sanitizedProducts);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load shop storefront');
      } finally {
        setLoading(false);
      }
    }

    loadStorefront();
  }, [shopId]);

  // Client-side filtering by category & search query
  const filteredProducts = useMemo(() => {
    return products.filter((prod) => {
      // Category filter
      if (selectedCategory !== 'all') {
        const cat = (prod.category || '').toLowerCase();
        if (selectedCategory === 'vegetables' && !cat.includes('vegetable')) return false;
        if (selectedCategory === 'fruits' && !cat.includes('fruit')) return false;
        if (selectedCategory === 'herbs' && !cat.includes('green') && !cat.includes('herb')) return false;
        if (selectedCategory === 'spices' && !cat.includes('exotic') && !cat.includes('spice')) return false;
        if (selectedCategory === 'organic' && !prod.name.toLowerCase().includes('organic')) return false;
        if (selectedCategory === 'fresh_cuts' && !prod.name.toLowerCase().includes('cut')) return false;
      }

      // Search query filter
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = prod.name.toLowerCase().includes(q);
        const matchesDesc = (prod.description || '').toLowerCase().includes(q);
        const matchesOrigin = (prod.originCountry || '').toLowerCase().includes(q);
        if (!matchesName && !matchesDesc && !matchesOrigin) {
          return false;
        }
      }

      return true;
    });
  }, [products, selectedCategory, searchQuery]);

  const toggleFavorite = (productId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setFavoriteProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  if (loading) {
    return (
      <main className={styles.container}>
        <div style={{ textAlign: 'center', padding: '100px 20px', color: '#86efac' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>🏬</div>
          <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>Loading verified stall storefront...</p>
        </div>
      </main>
    );
  }

  if (error || !shop) {
    return (
      <main className={styles.container}>
        <div className={styles.errorBox}>
          <h2>Stall Not Available</h2>
          <p>{error || 'This shop is either not verified or currently unavailable at Al Aweer Market.'}</p>
          <Link href="/shops" className={styles.backBtn}>
            &larr; View Verified Stalls Directory
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.container}>
      {/* Toast feedback */}
      {toastMessage && (
        <div className={styles.toastNotification} role="status">
          ✓ {toastMessage}
        </div>
      )}

      {/* Top Breadcrumb Navigation */}
      <div className={styles.topNavRow}>
        <Link href="/shops" className={styles.backLink}>
          &larr; Back to Stalls Directory
        </Link>
        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
          Al Aweer Central Market • Stall {shop.stallNumber || 'Directory'}
        </span>
      </div>

      {/* ===================================================================
          HERO BANNER (Matches Screenshot 1 Design)
         =================================================================== */}
      <section className={styles.heroBanner} aria-label="Vendor Stall Header">
        <div className={styles.heroLeft}>
          {/* Circular Brand Avatar */}
          <div className={styles.avatarLogo}>
            <span className={styles.avatarIcon}>🍃</span>
            <span className={styles.avatarBrand}>
              {shop.name.split(' ').slice(0, 2).join(' ')}
            </span>
          </div>

          {/* Vendor Information */}
          <div className={styles.vendorMeta}>
            <div className={styles.vendorTitleRow}>
              <h1 className={styles.shopTitle}>{shop.name}</h1>
              {shop.isApproved && (
                <span className={styles.verifiedBadge}>
                  <span className={styles.verifiedCheck}>✓</span>
                  Verified Vendor
                </span>
              )}
            </div>

            <p className={styles.tagline}>
              Licensed wholesale produce merchant at Dubai Al Aweer Central Fruits &amp; Vegetables Market.
            </p>

            {/* Feature Badges Row */}
            <div className={styles.featureBadgesRow}>
              <span className={styles.featureBadge}>
                <span className={styles.featureBadgeIcon}>📍</span>
                Al Aweer, {shop.stallNumber || 'Dubai, UAE'}
              </span>
              <span className={styles.featureBadge}>
                <span className={styles.featureBadgeIcon}>🛡</span>
                100% Fresh Products
              </span>
              <span className={styles.featureBadge}>
                <span className={styles.featureBadgeIcon}>🏷</span>
                Wholesale Prices
              </span>
              <span className={styles.featureBadge}>
                <span className={styles.featureBadgeIcon}>🚚</span>
                Stall Pickup &amp; Pallet Delivery
              </span>
            </div>

            {/* Rating and Actions Row */}
            <div className={styles.actionRow}>
              <div className={styles.ratingBox}>
                <span className={styles.ratingStar}>★</span>
                <span className={styles.ratingScore}>4.8</span>
                <span className={styles.ratingCount}>(320+ wholesale buyers)</span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsFollowing((prev) => !prev);
                  showToast(!isFollowing ? `You are now following ${shop.name}` : `Unfollowed ${shop.name}`);
                }}
                className={`${styles.followBtn} ${isFollowing ? styles.followBtnActive : ''}`}
                aria-label="Follow this vendor"
              >
                <span>{isFollowing ? '✓' : '👤'}</span>
                <span>{isFollowing ? 'Following' : 'Follow'}</span>
              </button>


            </div>
          </div>
        </div>

        {/* Right Calligraphy & Basket Graphic */}
        <div className={styles.heroRight}>
          <img
            src="/images/hero-basket.jpg"
            alt="Wholesale Produce Basket"
            className={styles.heroBasketImg}
          />
          <div className={styles.calligraphyTag}>
            <span>Good Food</span>
            <span>Good Life<span className={styles.leafAccent}>🍃</span></span>
          </div>
        </div>
      </section>

      {/* ===================================================================
          TAB NAVIGATION (Matches Screenshot 1 Tabs)
         =================================================================== */}
      <nav className={styles.tabsBar} aria-label="Storefront Tabs">
        <button
          type="button"
          onClick={() => setActiveTab('info')}
          className={`${styles.tabBtn} ${activeTab === 'info' ? styles.tabBtnActive : ''}`}
        >
          Shop Info
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('products')}
          className={`${styles.tabBtn} ${activeTab === 'products' ? styles.tabBtnActive : ''}`}
        >
          Products ({products.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('reviews')}
          className={`${styles.tabBtn} ${activeTab === 'reviews' ? styles.tabBtnActive : ''}`}
        >
          Reviews (4.8)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('location')}
          className={`${styles.tabBtn} ${activeTab === 'location' ? styles.tabBtnActive : ''}`}
        >
          Location
        </button>

      </nav>

      {/* ===================================================================
          TAB 1: PRODUCTS (Matches Screenshot 2 Toolbar & Cards Grid)
         =================================================================== */}
      {activeTab === 'products' && (
        <section aria-label="Stall Products">
          {/* Products Toolbar */}
          <div className={styles.productsToolbar}>
            <div className={styles.toolbarLeft}>
              <h2 className={styles.productsHeading}>
                Products <span className={styles.productsCountPill}>({filteredProducts.length})</span>
              </h2>

              {/* Category Pills */}
              <div className={styles.categoryPills}>
                <button
                  type="button"
                  onClick={() => setSelectedCategory('all')}
                  className={`${styles.pillBtn} ${selectedCategory === 'all' ? styles.pillBtnActive : ''}`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCategory('vegetables')}
                  className={`${styles.pillBtn} ${selectedCategory === 'vegetables' ? styles.pillBtnActive : ''}`}
                >
                  Vegetables
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCategory('fruits')}
                  className={`${styles.pillBtn} ${selectedCategory === 'fruits' ? styles.pillBtnActive : ''}`}
                >
                  Fruits
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCategory('herbs')}
                  className={`${styles.pillBtn} ${selectedCategory === 'herbs' ? styles.pillBtnActive : ''}`}
                >
                  Herbs &amp; Greens
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCategory('spices')}
                  className={`${styles.pillBtn} ${selectedCategory === 'spices' ? styles.pillBtnActive : ''}`}
                >
                  Spices
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCategory('fresh_cuts')}
                  className={`${styles.pillBtn} ${selectedCategory === 'fresh_cuts' ? styles.pillBtnActive : ''}`}
                >
                  Fresh Cuts
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCategory('organic')}
                  className={`${styles.pillBtn} ${selectedCategory === 'organic' ? styles.pillBtnActive : ''}`}
                >
                  Organic
                </button>
              </div>
            </div>

            {/* Search Input */}
            <div className={styles.searchBox}>
              <span className={styles.searchIcon}>🔍</span>
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.searchInput}
                aria-label="Search produce within this stall"
              />
            </div>
          </div>

          {/* Product Cards Grid */}
          {filteredProducts.length === 0 ? (
            <div className={styles.emptyBox}>
              <p>
                {searchQuery || selectedCategory !== 'all'
                  ? `No produce offers match your current filter at this stall.`
                  : 'This stall currently has no active wholesale produce offers listed.'}
              </p>
              {(searchQuery || selectedCategory !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory('all');
                    setSearchQuery('');
                  }}
                  className={styles.backBtn}
                  style={{ cursor: 'pointer', border: 'none' }}
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <div className={styles.grid}>
              {filteredProducts.map((item) => {
                const produceImg = resolveProduceImage(item.name, item.category, item.imageUrl);
                const isFav = favoriteProductIds.has(item.id);

                return (
                  <article key={item.id} className={styles.card} data-product-id={item.id}>
                    {/* Produce Photography & Favorite Heart */}
                    <div className={styles.imageWrapper}>
                      <Link href={`/products/${item.id}`}>
                        <img
                          src={produceImg}
                          alt={item.name}
                          className={styles.productImg}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/images/hero-basket.jpg';
                          }}
                        />
                      </Link>
                      <button
                        type="button"
                        onClick={(e) => toggleFavorite(item.id, e)}
                        className={`${styles.favoriteBtn} ${isFav ? styles.favoriteBtnActive : ''}`}
                        title={isFav ? 'Remove from favorites' : 'Save to favorites'}
                        aria-label="Favorite toggle"
                      >
                        {isFav ? '♥' : '♡'}
                      </button>
                    </div>

                    {/* Card Body */}
                    <div className={styles.cardBody}>
                      <div className={styles.cardMeta}>
                        <span className={styles.catBadge}>
                          {(item.category || 'produce').replace(/_/g, ' ')}
                        </span>
                        <span className={styles.originTag}>
                          Origin: {item.originCountry || 'UAE'}
                        </span>
                      </div>

                      <Link href={`/products/${item.id}`} className={styles.prodLink}>
                        <h3 className={styles.prodName}>{item.name}</h3>
                      </Link>

                      <p className={styles.prodDesc}>
                        {item.description || 'Wholesale produce sourced directly from Al Aweer Central Market.'}
                      </p>

                      {/* Offers for this shop */}
                      {item.offers.map((offer, idx) => (
                        <div key={idx} className={styles.offerCard}>
                          <div className={styles.offerHeader}>
                            <div>
                              <div className={styles.moqText}>
                                Min Order: {offer.minOrderQuantity} {offer.unit}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div className={styles.offerPriceAed}>
                                Dhs {offer.priceAed.toFixed(2)}
                                <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 500 }}>
                                  {' '}
                                  / {offer.unit}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className={styles.stockFooter}>
                            <span className={offer.availableStock > 0 ? styles.inStock : styles.outOfStock}>
                              {offer.availableStock > 0
                                ? `${offer.availableStock} ${offer.unit}s in stock`
                                : 'Out of Stock'}
                            </span>

                            {offer.availableStock > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const added = addToCart(
                                    {
                                      productId: item.id,
                                      name: item.name,
                                      unit: offer.unit,
                                      unitWeightKg: offer.unitWeightKg,
                                      unitPriceAed: offer.priceAed,
                                      quantity: offer.minOrderQuantity || 1,
                                      minOrderQuantity: offer.minOrderQuantity || 1,
                                      availableStock: offer.availableStock,
                                      imageUrl: item.imageUrl,
                                      category: item.category
                                    },
                                    { id: shop.id, name: shop.name }
                                  );
                                  if (added) {
                                    showToast(`Added ${item.name} from ${shop.name} to cart!`);
                                  }
                                }}
                                className={styles.addToCartBtn}
                                id={`shop-add-cart-${item.id}`}
                              >
                                <span>+ Add to Cart</span>
                                <span>🛒</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ===================================================================
          TAB 2: SHOP INFO
         =================================================================== */}
      {activeTab === 'info' && (
        <section className={styles.tabPanelCard} aria-label="Shop Information">
          <h2 className={styles.panelTitle}>🏬 Merchant Profile &amp; Verification</h2>
          <div className={styles.infoGrid}>
            <div className={styles.infoItem}>
              <div className={styles.infoLabel}>Business Name</div>
              <div className={styles.infoValue}>{shop.name}</div>
            </div>
            <div className={styles.infoItem}>
              <div className={styles.infoLabel}>Market Stall Number</div>
              <div className={styles.infoValue}>{shop.stallNumber || 'Assigned by Market Management'}</div>
            </div>
            <div className={styles.infoItem}>
              <div className={styles.infoLabel}>Trade License</div>
              <div className={styles.infoValue}>{shop.tradeLicenseNumber || 'Verified by Super Admin'}</div>
            </div>

            <div className={styles.infoItem}>
              <div className={styles.infoLabel}>Operational Hours</div>
              <div className={styles.infoValue}>05:00 AM – 03:00 PM (GST) Daily</div>
            </div>
            <div className={styles.infoItem}>
              <div className={styles.infoLabel}>Wholesale Produce Lines</div>
              <div className={styles.infoValue}>{products.length} Active SKUs Listed</div>
            </div>
          </div>
        </section>
      )}

      {/* ===================================================================
          TAB 3: REVIEWS
         =================================================================== */}
      {activeTab === 'reviews' && (
        <section className={styles.tabPanelCard} aria-label="Shop Reviews">
          <h2 className={styles.panelTitle}>★ Wholesale Buyer Ratings &amp; Feedback</h2>
          <div className={styles.ratingBox} style={{ marginBottom: '20px' }}>
            <span className={styles.ratingStar} style={{ fontSize: '1.8rem' }}>★</span>
            <span className={styles.ratingScore} style={{ fontSize: '1.6rem' }}>4.8 / 5.0</span>
            <span className={styles.ratingCount} style={{ fontSize: '1rem' }}>
              Based on 320+ commercial wholesale orders
            </span>
          </div>

          <div className={styles.reviewList}>
            <div className={styles.reviewCard}>
              <div className={styles.reviewHeader}>
                <span className={styles.reviewerName}>Emirates Catering Services LLC</span>
                <span style={{ color: '#facc15', fontSize: '0.9rem' }}>★★★★★</span>
              </div>
              <p className={styles.reviewText}>
                Always delivers farm-fresh bulk crates on time for our central kitchen. The tomatoes and onions were crisp and clean.
              </p>
            </div>
            <div className={styles.reviewCard}>
              <div className={styles.reviewHeader}>
                <span className={styles.reviewerName}>Al Madina Supermarket Chain</span>
                <span style={{ color: '#facc15', fontSize: '0.9rem' }}>★★★★★</span>
              </div>
              <p className={styles.reviewText}>
                Best Dhs/kg rates in Block A. We picked up 40 cartons directly from the stall; pallet loading was swift and efficient.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ===================================================================
          TAB 4: LOCATION
         =================================================================== */}
      {activeTab === 'location' && (
        <section className={styles.tabPanelCard} aria-label="Shop Location">
          <h2 className={styles.panelTitle}>📍 Market Location &amp; Stall Pickup</h2>
          <div className={styles.infoGrid} style={{ marginBottom: '24px' }}>
            <div className={styles.infoItem}>
              <div className={styles.infoLabel}>Central Wholesale Market</div>
              <div className={styles.infoValue}>Dubai Fruits &amp; Vegetables Central Market</div>
            </div>
            <div className={styles.infoItem}>
              <div className={styles.infoLabel}>District</div>
              <div className={styles.infoValue}>Al Aweer, Ras Al Khor Industrial 3, Dubai, UAE</div>
            </div>
            <div className={styles.infoItem}>
              <div className={styles.infoLabel}>Stall Allocation</div>
              <div className={styles.infoValue}>{shop.stallNumber || 'Central Fruit & Veg Section'}</div>
            </div>
          </div>
          <div
            style={{
              background: 'rgba(2, 22, 14, 0.7)',
              border: '1px solid rgba(34, 197, 94, 0.2)',
              borderRadius: '12px',
              padding: '24px',
              textAlign: 'center',
              color: '#86efac'
            }}
          >
            <p style={{ margin: 0, fontWeight: 600 }}>
              Truck and commercial vehicle loading bays are accessible directly behind the stall.
              Buyers can inspect crates before clearance.
            </p>
          </div>
        </section>
      )}


    </main>
  );
}
