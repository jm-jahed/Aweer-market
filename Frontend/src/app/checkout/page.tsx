'use client';

/**
 * AweerMarket — Dedicated Wholesale Checkout Route (/checkout)
 * Luxury dark-emerald UI with single-vendor isolation, real-time totals,
 * produce line thumbnails, and mobile quick-confirmation bar.
 */

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useCart } from '@/lib/cart-context';
import { createOrder, OrderSummary, ApiClientError } from '@/lib/api-client';
import { resolveProduceImage } from '@/lib/catalog-utils';
import { DeliveryType } from '@aweermarket/types';
import styles from './Checkout.module.css';

export default function CheckoutPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { shopId, shopName, items, updateQuantity, removeFromCart, clearCart, cartTotalAed } = useCart();

  const [deliveryType] = useState<DeliveryType>(DeliveryType.SHOP_PICKUP);
  const [pickupTime, setPickupTime] = useState<string>('Morning (08:00 - 12:00 PM)');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [placedOrder, setPlacedOrder] = useState<OrderSummary | null>(null);

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!user) {
      router.push('/login');
      return;
    }

    if (!shopId || items.length === 0) {
      setError('Your cart is empty. Please add wholesale produce to continue.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createOrder({
        shopId,
        deliveryType: DeliveryType.SHOP_PICKUP,
        pickupTime: pickupTime.trim(),
        items: items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity
        }))
      });

      setPlacedOrder(res.order);
      clearCart();
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to place wholesale order. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // -------------------------------------------------------------------------
  // 1. Order Success Screen
  // -------------------------------------------------------------------------
  if (placedOrder) {
    return (
      <main className={styles.container}>
        <div className={styles.successCard}>
          <div className={styles.successIconWrap}>✓</div>
          <h1 className={styles.successTitle}>Wholesale Order Confirmed!</h1>
          <p className={styles.successSub}>
            Your wholesale booking has been submitted to <strong>{placedOrder.shopName}</strong> at Al Aweer Central Market.
          </p>

          <div>
            <span className={styles.orderNumBadge}>Order #{placedOrder.orderNumber}</span>
          </div>

          <div className={styles.successDetailsCard}>
            <div className={styles.successRow}>
              <span>Fulfillment Method:</span>
              <strong className={styles.successRowVal}>
                {placedOrder.deliveryType === DeliveryType.SHOP_PICKUP
                  ? 'Stall Pickup at Al Aweer'
                  : 'Scheduled Wholesale Delivery'}
              </strong>
            </div>

            {placedOrder.deliveryAddress && (
              <div className={styles.successRow}>
                <span>Delivery Address:</span>
                <strong className={styles.successRowVal}>{placedOrder.deliveryAddress}</strong>
              </div>
            )}

            <div className={styles.successRow}>
              <span>Produce Lines:</span>
              <strong className={styles.successRowVal}>{placedOrder.items.length} bulk produce lines</strong>
            </div>

            <div className={styles.successTotalRow}>
              <span>Total Estimated:</span>
              <span className={styles.totalHighlight}>Dhs {placedOrder.totalAmountAed.toFixed(2)}</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link
              href="/account"
              className={styles.checkoutBtn}
              style={{ width: 'auto', padding: '12px 28px' }}
            >
              View Order in Account →
            </Link>
            <Link
              href="/"
              className={styles.registerBtn}
              style={{ padding: '12px 24px', display: 'inline-flex', alignItems: 'center' }}
            >
              ← Continue Sourcing Market
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // -------------------------------------------------------------------------
  // 2. Empty Cart Screen
  // -------------------------------------------------------------------------
  if (items.length === 0) {
    return (
      <main className={styles.container}>
        <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
          <Link href="/" className={styles.breadcrumbLink}>Home</Link>
          <span className={styles.breadcrumbSep}>/</span>
          <span className={styles.breadcrumbCurrent}>Checkout</span>
        </nav>

        <div className={styles.emptyCard}>
          <div className={styles.emptyIconWrap}>🛒</div>
          <h1 className={styles.emptyTitle}>Your Wholesale Cart is Empty</h1>
          <p className={styles.emptyText}>
            Review bulk produce crates, cartons, or sacks from verified Al Aweer stalls before proceeding to checkout.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/" className={styles.checkoutBtn} style={{ width: 'auto', padding: '12px 24px' }}>
              Explore Wholesale Market →
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // -------------------------------------------------------------------------
  // 3. Active Checkout Form Screen
  // -------------------------------------------------------------------------
  const totalUnits = items.reduce((acc, i) => acc + i.quantity, 0);

  return (
    <main className={styles.container}>
      {/* Breadcrumb Navigation */}
      <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
        <Link href="/" className={styles.breadcrumbLink}>Home</Link>
        <span className={styles.breadcrumbSep}>/</span>
        <Link href="/cart" className={styles.breadcrumbLink}>Wholesale Cart</Link>
        <span className={styles.breadcrumbSep}>/</span>
        <span className={styles.breadcrumbCurrent}>Checkout</span>
      </nav>

      {/* Page Header */}
      <header className={styles.pageHeader}>
        <div className={styles.headerRow}>
          <h1 className={styles.pageTitle}>
            Wholesale Checkout
          </h1>
          <span className={styles.stepBadge}>Step 2 of 2: Fulfillment & Terms</span>
        </div>
        <p className={styles.pageSub}>
          Confirm dispatch terms, delivery address, or stall pickup window for your bulk produce lines.
        </p>
      </header>

      {/* Auth Guard Banner if not logged in */}
      {!user && (
        <div className={styles.authBanner}>
          <div className={styles.authBannerText}>
            <span>⚠️</span>
            <span>You must be logged in as a registered Buyer to place wholesale orders.</span>
          </div>
          <div className={styles.authBtns}>
            <Link href="/login" className={styles.loginBtn}>
              Log In
            </Link>
            <Link href="/register" className={styles.registerBtn}>
              Register as Buyer
            </Link>
          </div>
        </div>
      )}

      {/* Fulfilling Stall Banner */}
      <section className={styles.shopBanner} aria-label="Fulfilling Stall">
        <div className={styles.shopBannerLeft}>
          <div className={styles.stallIconWrap}>🏬</div>
          <div>
            <div className={styles.shopBannerTitle}>
              {shopId ? (
                <Link
                  href={`/shops/${shopId}`}
                  style={{ textDecoration: 'none', color: 'inherit', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <span>{shopName || 'Wholesale Stall'}</span>
                  <span style={{ fontSize: '0.82rem', color: '#86efac' }}>↗</span>
                </Link>
              ) : (
                <span>{shopName || 'Wholesale Stall'}</span>
              )}
            </div>
            <p className={styles.shopBannerSubtitle}>
              Single-vendor bulk isolation enforced • Dispatched directly from Al Aweer Central Market
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={clearCart}
          className={styles.clearCartBtn}
          title="Clear all lines in cart"
        >
          🗑️ Clear Cart
        </button>
      </section>

      {/* Error Message */}
      {error && <div className={styles.errorBanner}>{error}</div>}

      <form onSubmit={handlePlaceOrder} className={styles.cartGrid}>
        {/* Left Column: Cart Items & Fulfillment Options */}
        <div>
          {/* Produce Lines Card */}
          <div className={styles.card}>
            <div className={styles.cardTitle}>
              <span>Produce Line Items</span>
              <span className={styles.itemCountBadge}>{items.length} Lines</span>
            </div>

            <div className={styles.itemList}>
              {items.map((item) => {
                const produceImg = resolveProduceImage(item.name, item.category, item.imageUrl);
                const lineTotal = item.quantity * item.unitPriceAed;
                const minQty = item.minOrderQuantity || 1;

                return (
                  <div key={item.productId} className={styles.itemRow}>
                    {/* Thumbnail */}
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
                      <h2 className={styles.itemName} style={{ margin: 0 }}>
                        <Link
                          href={`/products/${item.productId}`}
                          style={{ color: '#ffffff', textDecoration: 'none' }}
                        >
                          {item.name}
                        </Link>
                      </h2>
                      <div className={styles.itemPackaging}>
                        <span className={styles.specPill}>📦 {item.unit}</span>
                        {item.unitWeightKg > 0 && (
                          <span className={styles.specPill}>⚖️ {item.unitWeightKg} kg/{item.unit}</span>
                        )}
                        <span>MOQ: {minQty}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.productId)}
                        className={styles.removeBtn}
                      >
                        ✕ Remove line
                      </button>
                    </div>

                    {/* Quantity Controls */}
                    <div className={styles.qtyGroup}>
                      <button
                        type="button"
                        className={styles.qtyBtn}
                        onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                        disabled={item.quantity <= minQty}
                        aria-label={`Decrease ${item.name} quantity`}
                      >
                        −
                      </button>
                      <span className={styles.qtyValue}>{item.quantity}</span>
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

                    {/* Line Total */}
                    <div className={styles.priceCol}>
                      <div className={styles.lineTotal}>
                        Dhs {lineTotal.toFixed(2)}
                      </div>
                      <div className={styles.unitRate}>
                        Dhs {item.unitPriceAed.toFixed(2)} / {item.unit}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Fulfillment Method Card */}
          <div className={styles.card}>
            <div className={styles.cardTitle} style={{ margin: '0 0 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Fulfillment Method</span>
              <span className={styles.specPill} style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80' }}>
                🏪 Stall Pickup Only
              </span>
            </div>

            <div
              className={`${styles.radioCard} ${styles.radioCardActive}`}
              style={{ cursor: 'default', borderColor: 'rgba(34, 197, 94, 0.4)' }}
            >
              <div className={styles.radioContent}>
                <span className={styles.radioTitle}>
                  <span>🏬</span>
                  <span>Stall Pickup at Al Aweer</span>
                </span>
                <span className={styles.radioDesc}>
                  Collect pallets or crates directly from <strong>{shopName || 'the stall'}</strong>&apos;s loading dock at Al Aweer Central Wholesale Market.
                </span>
              </div>
            </div>

            {/* Preferred stall pickup time selector */}
            <div className={styles.formGroup} style={{ marginTop: 16 }}>
              <label htmlFor="pickup-time" className={styles.formLabel}>
                <span>⏱️</span>
                <span>Preferred Stall Pickup Window *</span>
              </label>
              <select
                id="pickup-time"
                className={styles.formSelect}
                value={pickupTime}
                onChange={(e) => setPickupTime(e.target.value)}
              >
                <option value="Early Morning (04:00 - 08:00 AM)">Early Morning (04:00 - 08:00 AM) — Peak Market</option>
                <option value="Morning (08:00 - 12:00 PM)">Morning (08:00 - 12:00 PM)</option>
                <option value="Afternoon (12:00 - 04:00 PM)">Afternoon (12:00 - 04:00 PM)</option>
                <option value="Evening (04:00 - 08:00 PM)">Evening (04:00 - 08:00 PM)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Right Column: Order Summary Card */}
        <div>
          <aside className={styles.summaryCard} aria-label="Order Summary">
            <h2 className={styles.cardTitle} style={{ borderBottomColor: 'rgba(34, 197, 94, 0.2)' }}>
              Order Summary
            </h2>

            <div className={styles.summaryRow}>
              <span>Fulfilling Stall</span>
              <strong className={styles.summaryRowVal}>{shopName || 'Al Aweer Stall'}</strong>
            </div>

            <div className={styles.summaryRow}>
              <span>Total Produce Lines</span>
              <span className={styles.summaryRowVal}>{items.length} lines ({totalUnits} units)</span>
            </div>

            <div className={styles.summaryRow}>
              <span>Market VAT (Wholesale 0%)</span>
              <span className={styles.summaryRowVal}>Dhs 0.00</span>
            </div>

            <div className={styles.summaryRow}>
              <span>Stall Dispatch Fee</span>
              <span style={{ color: '#4ade80', fontWeight: 700 }}>Direct from Al Aweer</span>
            </div>

            <div className={styles.summaryTotalRow}>
              <span>Total Estimated</span>
              <span className={styles.totalHighlight}>Dhs {cartTotalAed.toFixed(2)}</span>
            </div>

            <button
              id="place-order-button"
              type="submit"
              className={`${styles.checkoutBtn} ${isSubmitting || !user ? styles.checkoutBtnDisabled : ''}`}
              disabled={isSubmitting || !user}
            >
              {isSubmitting
                ? 'Submitting Wholesale Order...'
                : user
                ? 'Confirm & Place Wholesale Order →'
                : 'Log In to Place Order'}
            </button>

            {/* Payment Terms Notice */}
            <div className={styles.paymentNotice}>
              💵 Payment on Delivery / Stall Handover (COD) & Bank Transfer
            </div>

            {/* Trust Signals */}
            <div className={styles.summaryTrustList}>
              <div className={styles.summaryTrustItem}>
                <span>🛡️</span>
                <span>Guaranteed Al Aweer Central Market Rates</span>
              </div>
              <div className={styles.summaryTrustItem}>
                <span>❄️</span>
                <span>Cold-Chain Maintained Produce Quality</span>
              </div>
              <div className={styles.summaryTrustItem}>
                <span>📑</span>
                <span>Commercial Invoice with VAT Breakdown</span>
              </div>
            </div>
          </aside>
        </div>

        {/* Mobile Sticky Action Bar */}
        <aside className={styles.mobileCheckoutBar} aria-label="Mobile Checkout Bar">
          <div className={styles.mobileTotalWrap}>
            <span className={styles.mobileTotalLabel}>Total Estimated</span>
            <span className={styles.mobileTotalAmount}>Dhs {cartTotalAed.toFixed(2)}</span>
          </div>
          <button
            type="submit"
            className={`${styles.mobileSubmitBtn} ${isSubmitting || !user ? styles.checkoutBtnDisabled : ''}`}
            disabled={isSubmitting || !user}
          >
            {isSubmitting ? 'Submitting...' : user ? 'Confirm Order →' : 'Log In'}
          </button>
        </aside>
      </form>
    </main>
  );
}
