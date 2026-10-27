'use client';

/**
 * AweerMarket — Dedicated Shopping Cart Route (/cart)
 * Real-time wholesale cart review with single-vendor isolation,
 * produce line thumbnails, live quantity controls, and luxury dark emerald aesthetics.
 */

import React from 'react';
import Link from 'next/link';
import { useCart } from '@/lib/cart-context';
import { resolveProduceImage } from '@/lib/catalog-utils';
import styles from './Cart.module.css';

export default function CartPage() {
  const {
    items,
    shopId,
    shopName,
    cartTotalAed,
    totalItemsCount,
    updateQuantity,
    removeFromCart,
    clearCart
  } = useCart();

  if (items.length === 0) {
    return (
      <main className={styles.container}>
        <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
          <Link href="/" className={styles.breadcrumbLink}>Home</Link>
          <span className={styles.breadcrumbSep}>/</span>
          <span className={styles.breadcrumbCurrent}>Wholesale Cart</span>
        </nav>

        <div className={styles.emptyCard}>
          <div className={styles.emptyIconWrap}>🛒</div>
          <h1 className={styles.emptyTitle}>Your Wholesale Cart is Empty</h1>
          <p className={styles.emptyText}>
            You haven&apos;t added any bulk produce to your cart yet. Explore fresh fruits, vegetables, and greens directly from verified Al Aweer Central Market stalls with guaranteed wholesale rates.
          </p>
          <div className={styles.browseActions}>
            <Link href="/fruits" className={styles.browseBtnPrimary}>
              Browse Fruits
            </Link>
            <Link href="/vegetables" className={styles.browseBtnPrimary}>
              Browse Vegetables
            </Link>
            <Link href="/products" className={styles.browseBtnSecondary}>
              Full Marketplace Directory
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.container}>
      {/* Breadcrumb Navigation */}
      <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
        <Link href="/" className={styles.breadcrumbLink}>Home</Link>
        <span className={styles.breadcrumbSep}>/</span>
        <span className={styles.breadcrumbCurrent}>Wholesale Cart</span>
      </nav>

      {/* Page Header */}
      <header className={styles.pageHeader}>
        <div className={styles.titleArea}>
          <h1 className={styles.pageTitle}>
            Wholesale Cart
            <span className={styles.itemCountBadge}>
              {totalItemsCount} {totalItemsCount === 1 ? 'item' : 'items'}
            </span>
          </h1>
          <p className={styles.pageSubtitle}>
            Review bulk produce lines before proceeding to scheduled delivery or stall pickup.
          </p>
        </div>
        <button
          type="button"
          onClick={clearCart}
          className={styles.clearCartBtn}
          title="Clear all items in cart"
        >
          🗑️ Clear Cart
        </button>
      </header>

      {/* Single-Vendor Wholesale Stall Banner */}
      <section className={styles.vendorBanner} aria-label="Active vendor stall">
        <div className={styles.vendorInfo}>
          <div className={styles.vendorIconWrap}>🏬</div>
          <div>
            {shopId ? (
              <Link
                href={`/shops/${shopId}`}
                style={{ textDecoration: 'none', color: 'inherit' }}
                title={`View ${shopName || 'stall'}'s full profile`}
              >
                <h2 className={styles.vendorName}>
                  <span>{shopName || 'Wholesale Stall'}</span>
                  <span style={{ fontSize: '0.85rem', color: '#86efac' }}>↗</span>
                </h2>
              </Link>
            ) : (
              <h2 className={styles.vendorName}>{shopName || 'Wholesale Stall'}</h2>
            )}
            <p className={styles.vendorPolicy}>
              Single-vendor bulk order isolation enforced • All items dispatched directly from this verified stall.
            </p>
          </div>
        </div>
        <span className={styles.vendorBadge}>Verified Stall</span>
      </section>

      {/* Two-Column Cart Layout */}
      <div className={styles.cartLayout}>
        {/* Left Column: Produce Items */}
        <section className={styles.itemList} aria-label="Cart Produce Lines">
          {items.map((item) => {
            const produceImg = resolveProduceImage(item.name);
            const lineTotal = item.unitPriceAed * item.quantity;
            const minQty = item.minOrderQuantity || 1;

            return (
              <article key={item.productId} className={styles.itemCard}>
                {/* Produce Thumbnail */}
                <div className={styles.itemThumbWrap}>
                  <img
                    src={produceImg}
                    alt={item.name}
                    className={styles.itemThumb}
                    loading="lazy"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = '/logo.svg';
                    }}
                  />
                </div>

                {/* Produce Info */}
                <div className={styles.itemInfo}>
                  <h3 className={styles.itemName}>
                    <Link href={`/products/${item.productId}`} className={styles.itemNameLink}>
                      {item.name}
                    </Link>
                  </h3>
                  <div className={styles.itemMeta}>
                    <span className={styles.specPill}>📦 {item.unit}</span>
                    {item.unitWeightKg > 0 && (
                      <span className={styles.specPill}>⚖️ {item.unitWeightKg} kg/{item.unit}</span>
                    )}
                    <span className={styles.moqBadge}>Min Order: {minQty} {item.unit}s</span>
                  </div>
                </div>

                {/* Quantity Controls */}
                <div className={styles.quantityControls}>
                  <button
                    type="button"
                    className={styles.qtyBtn}
                    onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                    disabled={item.quantity <= minQty}
                    aria-label={`Decrease ${item.name} quantity`}
                  >
                    −
                  </button>
                  <span className={styles.qtyDisplay}>{item.quantity}</span>
                  <button
                    type="button"
                    className={styles.qtyBtn}
                    onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                    disabled={item.availableStock > 0 && item.quantity >= item.availableStock}
                    aria-label={`Increase ${item.name} quantity`}
                  >
                    +
                  </button>
                </div>

                {/* Price Calculation */}
                <div className={styles.itemPricing}>
                  <div className={styles.itemTotal}>
                    Dhs {lineTotal.toFixed(2)}
                  </div>
                  <div className={styles.itemUnitPrice}>
                    Dhs {item.unitPriceAed.toFixed(2)} / {item.unit}
                  </div>
                </div>

                {/* Remove Button */}
                <button
                  type="button"
                  className={styles.removeBtn}
                  onClick={() => removeFromCart(item.productId)}
                  title={`Remove ${item.name}`}
                  aria-label={`Remove ${item.name} from cart`}
                >
                  ✕
                </button>
              </article>
            );
          })}
        </section>

        {/* Right Column: Order Summary Card */}
        <aside className={styles.summaryCard} aria-label="Order Summary">
          <h2 className={styles.summaryTitle}>Order Summary</h2>
          
          <div className={styles.summaryRow}>
            <span>Subtotal ({totalItemsCount} units)</span>
            <span className={styles.summaryRowVal}>Dhs {cartTotalAed.toFixed(2)}</span>
          </div>

          <div className={styles.summaryRow}>
            <span>Market VAT (Wholesale 0%)</span>
            <span className={styles.summaryRowVal}>Dhs 0.00</span>
          </div>

          <div className={styles.summaryRow}>
            <span>Stall Dispatch</span>
            <span style={{ color: '#4ade80', fontWeight: 700 }}>Direct from Al Aweer</span>
          </div>

          <div className={styles.summaryRowTotal}>
            <span>Total Estimated</span>
            <span className={styles.totalHighlight}>Dhs {cartTotalAed.toFixed(2)}</span>
          </div>

          <Link href="/checkout" className={styles.checkoutBtn} id="cart-proceed-checkout-btn">
            <span>Proceed to Checkout</span>
            <span>→</span>
          </Link>

          <Link href="/" className={styles.continueShoppingLink}>
            ← Continue Browsing Market
          </Link>

          {/* Trust Signals */}
          <div className={styles.summaryTrustList}>
            <div className={styles.summaryTrustItem}>
              <span>🛡️</span>
              <span>Direct Al Aweer Central Market Stalls</span>
            </div>
            <div className={styles.summaryTrustItem}>
              <span>🚚</span>
              <span>Same-Day & Next-Day Wholesale Dispatch</span>
            </div>
            <div className={styles.summaryTrustItem}>
              <span>💵</span>
              <span>Cash on Delivery / Bank Transfer</span>
            </div>
          </div>
        </aside>
      </div>

      {/* Mobile Sticky Quick-Checkout Bar */}
      <aside className={styles.mobileCartBar} aria-label="Mobile Quick Checkout">
        <div className={styles.mobileCartBarTotal}>
          <span className={styles.mobileCartBarLabel}>Total Estimated</span>
          <span className={styles.mobileCartBarAmount}>Dhs {cartTotalAed.toFixed(2)}</span>
        </div>
        <Link href="/checkout" className={styles.mobileCartBarBtn} id="mobile-cart-proceed-checkout-btn">
          <span>Checkout</span>
          <span>→</span>
        </Link>
      </aside>
    </main>
  );
}
