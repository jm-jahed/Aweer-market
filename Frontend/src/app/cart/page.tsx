'use client';

/**
 * AweerMarket — Dedicated Shopping Cart Route (/cart)
 * Real-time wholesale cart review with single-vendor isolation,
 * quantity updates, and direct transition to checkout.
 */

import React from 'react';
import Link from 'next/link';
import { useCart } from '@/lib/cart-context';
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
          <span>/</span>
          <span className={styles.breadcrumbCurrent}>Wholesale Cart</span>
        </nav>

        <div className={styles.emptyCard}>
          <div className={styles.emptyIcon}>🛒</div>
          <h1 className={styles.emptyTitle}>Your Wholesale Cart is Empty</h1>
          <p className={styles.emptyText}>
            You haven&apos;t added any bulk produce to your cart yet. Explore fresh fruits, vegetables, and greens directly from verified Al Aweer Central Market stalls.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/fruits" className={styles.browseBtn}>
              Browse Fruits
            </Link>
            <Link href="/vegetables" className={styles.browseBtn}>
              Browse Vegetables
            </Link>
            <Link href="/products" className={styles.browseBtn} style={{ background: '#0e2415' }}>
              Full Directory
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
        <span>/</span>
        <span className={styles.breadcrumbCurrent}>Wholesale Cart</span>
      </nav>

      {/* Page Header */}
      <div className={styles.pageHeader}>
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
          Clear Cart
        </button>
      </div>

      {/* Single-Vendor Wholesale Stall Banner */}
      <section className={styles.vendorBanner} aria-label="Active vendor stall">
        <div className={styles.vendorInfo}>
          <span className={styles.vendorIcon}>🏬</span>
          <div>
            {shopId ? (
              <Link
                href={`/shops/${shopId}`}
                style={{ textDecoration: 'none', color: 'inherit' }}
                title={`View ${shopName || 'stall'}'s full profile`}
              >
                <h2 className={styles.vendorName} style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <span>{shopName || 'Wholesale Stall'}</span>
                  <span style={{ fontSize: '0.85rem', color: '#86efac' }}>↗</span>
                </h2>
              </Link>
            ) : (
              <h2 className={styles.vendorName}>{shopName || 'Wholesale Stall'}</h2>
            )}
            <p className={styles.vendorPolicy}>
              Single-vendor bulk order isolation enforced. All produce lines originate from this verified stall.
            </p>
          </div>
        </div>
        <span className={styles.vendorBadge}>Active Stall</span>
      </section>

      {/* Two-Column Cart Layout */}
      <div className={styles.cartLayout}>
        {/* Left Column: Produce Items */}
        <div className={styles.itemList}>
          {items.map((item) => (
            <article key={item.productId} className={styles.itemCard}>
              <div className={styles.itemInfo}>
                <h3 className={styles.itemName}>{item.name}</h3>
                <p className={styles.itemMeta}>
                  Packaging: {item.unit} ({item.unitWeightKg} kg/unit) • MOQ: {item.minOrderQuantity || 1}
                </p>
              </div>

              {/* Quantity Controls */}
              <div className={styles.quantityControls}>
                <button
                  type="button"
                  className={styles.qtyBtn}
                  onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                  disabled={item.quantity <= (item.minOrderQuantity || 1)}
                  aria-label={`Decrease ${item.name} quantity`}
                >
                  −
                </button>
                <span className={styles.qtyDisplay}>{item.quantity}</span>
                <button
                  type="button"
                  className={styles.qtyBtn}
                  onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                  disabled={item.quantity >= item.availableStock}
                  aria-label={`Increase ${item.name} quantity`}
                >
                  +
                </button>
              </div>

              {/* Price Calculation */}
              <div className={styles.itemPricing}>
                <div className={styles.itemTotal}>
                  Dhs {(item.unitPriceAed * item.quantity).toFixed(2)}
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
          ))}
        </div>

        {/* Right Column: Order Summary Card */}
        <aside className={styles.summaryCard}>
          <h2 className={styles.summaryTitle}>Order Summary</h2>
          <div className={styles.summaryRow}>
            <span>Subtotal ({totalItemsCount} units)</span>
            <span>Dhs {cartTotalAed.toFixed(2)}</span>
          </div>
          <div className={styles.summaryRow}>
            <span>Market VAT (Wholesale 0%)</span>
            <span>Dhs 0.00</span>
          </div>
          <div className={styles.summaryRow}>
            <span>Stall Dispatch</span>
            <span style={{ color: '#15803d', fontWeight: 600 }}>Standard</span>
          </div>
          <div className={styles.summaryRowTotal}>
            <span>Total Estimated</span>
            <span className={styles.totalHighlight}>Dhs {cartTotalAed.toFixed(2)}</span>
          </div>

          <Link href="/checkout" className={styles.checkoutBtn} id="cart-proceed-checkout-btn">
            Proceed to Checkout →
          </Link>

          <Link href="/" className={styles.continueShoppingLink}>
            ← Continue Browsing Market
          </Link>
        </aside>
      </div>
    </main>
  );
}
