'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useCart } from '@/lib/cart-context';
import { createOrder, OrderSummary, ApiClientError } from '@/lib/api-client';
import { DeliveryType } from '@aweermarket/types';
import styles from './Checkout.module.css';

export default function CheckoutPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { shopId, shopName, items, updateQuantity, removeFromCart, clearCart, cartTotalAed } = useCart();

  const [deliveryType, setDeliveryType] = useState<DeliveryType>(DeliveryType.SCHEDULED_DELIVERY);
  const [deliveryAddress, setDeliveryAddress] = useState<string>('');
  const [pickupTime, setPickupTime] = useState<string>('Morning (06:00 - 10:00 AM)');
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

    if (deliveryType === DeliveryType.SCHEDULED_DELIVERY && !deliveryAddress.trim()) {
      setError('Please provide a delivery address for scheduled wholesale delivery.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createOrder({
        shopId,
        deliveryType,
        deliveryAddress: deliveryType === DeliveryType.SCHEDULED_DELIVERY ? deliveryAddress.trim() : undefined,
        pickupTime: deliveryType === DeliveryType.SHOP_PICKUP ? pickupTime.trim() : undefined,
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

  // Order Success Screen
  if (placedOrder) {
    return (
      <main className={styles.container}>
        <div className={styles.successCard}>
          <div className={styles.successIcon}>✓</div>
          <h1 style={{ margin: '0 0 8px 0', fontSize: '1.8rem', color: '#0f172a' }}>
            Wholesale Order Confirmed!
          </h1>
          <p style={{ margin: 0, color: '#64748b', fontSize: '1rem' }}>
            Your order has been submitted to <strong>{placedOrder.shopName}</strong> at Al Aweer Market.
          </p>

          <div>
            <span className={styles.orderNumBadge}>{placedOrder.orderNumber}</span>
          </div>

          <div
            style={{
              backgroundColor: '#f8fafc',
              borderRadius: '10px',
              padding: '16px',
              textAlign: 'left',
              marginBottom: '24px',
              border: '1px solid #e2e8f0'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: '#64748b' }}>Fulfillment Method:</span>
              <strong style={{ color: '#0f172a' }}>
                {placedOrder.deliveryType === DeliveryType.SHOP_PICKUP
                  ? 'Stall Pickup at Al Aweer'
                  : 'Scheduled Wholesale Delivery'}
              </strong>
            </div>
            {placedOrder.deliveryAddress && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#64748b' }}>Delivery Address:</span>
                <strong style={{ color: '#0f172a' }}>{placedOrder.deliveryAddress}</strong>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: '#64748b' }}>Produce Items:</span>
              <strong style={{ color: '#0f172a' }}>{placedOrder.items.length} wholesale lines</strong>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                paddingTop: '8px',
                borderTop: '1px solid #e2e8f0',
                fontSize: '1.1rem'
              }}
            >
              <span style={{ fontWeight: 700, color: '#0f172a' }}>Total Amount:</span>
              <strong style={{ color: '#16a34a' }}>Dhs {placedOrder.totalAmountAed.toFixed(2)}</strong>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <Link
              href="/account"
              style={{
                background: '#16a34a',
                color: '#ffffff',
                padding: '12px 24px',
                borderRadius: '8px',
                fontWeight: 700,
                textDecoration: 'none'
              }}
            >
              View Order in Account
            </Link>
            <Link
              href="/"
              style={{
                background: '#f1f5f9',
                color: '#334155',
                padding: '12px 24px',
                borderRadius: '8px',
                fontWeight: 600,
                textDecoration: 'none',
                border: '1px solid #cbd5e1'
              }}
            >
              Continue Sourcing
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Empty Cart Screen
  if (items.length === 0) {
    return (
      <main className={styles.container}>
        <h1 className={styles.pageTitle}>Wholesale Cart</h1>
        <p className={styles.pageSub}>Review your bulk produce order and select fulfillment options.</p>

        <div style={{ textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
          <h2 style={{ fontSize: '1.3rem', color: '#334155', marginBottom: '8px' }}>Your Cart is Empty</h2>
          <p style={{ color: '#64748b', marginBottom: '24px' }}>
            Browse Al Aweer wholesale catalog to source fresh produce by the carton, crate, or sack.
          </p>
          <Link
            href="/"
            style={{
              background: '#16a34a',
              color: '#ffffff',
              padding: '12px 24px',
              borderRadius: '8px',
              fontWeight: 700,
              textDecoration: 'none',
              display: 'inline-block'
            }}
          >
            Explore Wholesale Produce &rarr;
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.container}>
      <h1 className={styles.pageTitle}>Wholesale Checkout</h1>
      <p className={styles.pageSub}>
        Review produce quantities and fulfill your order directly from Al Aweer market.
      </p>

      {/* Auth Guard Banner if not logged in */}
      {!user && (
        <div className={styles.authBanner}>
          <div className={styles.authBannerText}>
            You must be logged in as a Buyer to place wholesale orders.
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

      {/* Single-Vendor Stall Notice */}
      <div className={styles.shopBanner}>
        <div className={styles.shopBannerTitle}>
          Wholesale Order Fulfilled by: <strong>{shopName}</strong> (Al Aweer Stall)
        </div>
        <button type="button" onClick={clearCart} className={styles.clearCartBtn}>
          Clear Cart
        </button>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      <form onSubmit={handlePlaceOrder} className={styles.cartGrid}>
        {/* Left Column: Cart Items & Delivery Options */}
        <div>
          <div className={styles.itemsCard}>
            <h2 className={styles.cardTitle}>Produce Line Items ({items.length})</h2>

            {items.map((item) => (
              <div key={item.productId} className={styles.itemRow}>
                <div className={styles.itemInfo}>
                  <h3 className={styles.itemName}>{item.name}</h3>
                  <div className={styles.itemPackaging}>
                    Packaging: {item.unitWeightKg}kg {item.unit} | Min Order: {item.minOrderQuantity}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFromCart(item.productId)}
                    className={styles.removeBtn}
                  >
                    Remove item
                  </button>
                </div>

                <div className={styles.qtyGroup}>
                  <button
                    type="button"
                    className={styles.qtyBtn}
                    onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                    disabled={item.quantity <= item.minOrderQuantity}
                  >
                    -
                  </button>
                  <span className={styles.qtyValue}>{item.quantity}</span>
                  <button
                    type="button"
                    className={styles.qtyBtn}
                    onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                    disabled={item.quantity >= item.availableStock}
                  >
                    +
                  </button>
                </div>

                <div className={styles.priceCol}>
                  <div className={styles.lineTotal}>
                    Dhs {(item.quantity * item.unitPriceAed).toFixed(2)}
                  </div>
                  <div className={styles.unitRate}>
                    Dhs {item.unitPriceAed} / {item.unit}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Delivery & Fulfillment Details */}
          <div className={styles.deliverySection}>
            <h2 className={styles.cardTitle}>Fulfillment Method</h2>

            <div className={styles.radioGroup}>
              <label
                className={`${styles.radioLabel} ${deliveryType === DeliveryType.SCHEDULED_DELIVERY ? styles.radioLabelActive : ''}`}
              >
                <input
                  type="radio"
                  name="deliveryType"
                  className={styles.radioInput}
                  checked={deliveryType === DeliveryType.SCHEDULED_DELIVERY}
                  onChange={() => setDeliveryType(DeliveryType.SCHEDULED_DELIVERY)}
                />
                <div>
                  <span className={styles.radioTitle}>Scheduled Wholesale Delivery</span>
                  <span className={styles.radioDesc}>
                    Temperature-controlled wholesale truck dispatch directly to your commercial address in Dubai/UAE.
                  </span>
                </div>
              </label>

              <label
                className={`${styles.radioLabel} ${deliveryType === DeliveryType.SHOP_PICKUP ? styles.radioLabelActive : ''}`}
              >
                <input
                  type="radio"
                  name="deliveryType"
                  className={styles.radioInput}
                  checked={deliveryType === DeliveryType.SHOP_PICKUP}
                  onChange={() => setDeliveryType(DeliveryType.SHOP_PICKUP)}
                />
                <div>
                  <span className={styles.radioTitle}>Stall Pickup (Al Aweer Central Market)</span>
                  <span className={styles.radioDesc}>
                    Collect pallets or crates directly from {shopName}&apos;s stall at Al Aweer Central Wholesale Market.
                  </span>
                </div>
              </label>
            </div>

            {deliveryType === DeliveryType.SCHEDULED_DELIVERY ? (
              <div className={styles.formGroup}>
                <label htmlFor="delivery-address" className={styles.formLabel}>
                  Delivery Address in UAE *
                </label>
                <input
                  id="delivery-address"
                  type="text"
                  className={styles.formInput}
                  placeholder="e.g. Warehouse 14, Al Quoz Industrial Area 3, Dubai"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  required
                />
              </div>
            ) : (
              <div className={styles.formGroup}>
                <label htmlFor="pickup-time" className={styles.formLabel}>
                  Preferred Pickup Window *
                </label>
                <select
                  id="pickup-time"
                  className={styles.formInput}
                  value={pickupTime}
                  onChange={(e) => setPickupTime(e.target.value)}
                >
                  <option value="Early Morning (04:00 - 08:00 AM)">Early Morning (04:00 - 08:00 AM)</option>
                  <option value="Morning (08:00 - 12:00 PM)">Morning (08:00 - 12:00 PM)</option>
                  <option value="Afternoon (12:00 - 04:00 PM)">Afternoon (12:00 - 04:00 PM)</option>
                  <option value="Evening (04:00 - 08:00 PM)">Evening (04:00 - 08:00 PM)</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Order Summary Card */}
        <div>
          <div className={styles.summaryCard}>
            <h2 className={styles.cardTitle}>Order Summary</h2>

            <div className={styles.summaryRow}>
              <span>Fulfilling Stall:</span>
              <strong style={{ color: '#0f172a' }}>{shopName}</strong>
            </div>

            <div className={styles.summaryRow}>
              <span>Total Produce Items:</span>
              <span>{items.reduce((acc, i) => acc + i.quantity, 0)} units</span>
            </div>

            <div className={styles.summaryRow}>
              <span>Fulfillment Fee:</span>
              <span style={{ color: '#16a34a', fontWeight: 600 }}>Calculated on Dispatch</span>
            </div>

            <div className={styles.summaryTotalRow}>
              <span>Subtotal:</span>
              <span className={styles.summaryTotalAed}>Dhs {cartTotalAed.toFixed(2)}</span>
            </div>

            <button
              id="place-order-button"
              type="submit"
              className={`${styles.checkoutBtn} ${isSubmitting || !user ? styles.checkoutBtnDisabled : ''}`}
              disabled={isSubmitting || !user}
            >
              {isSubmitting
                ? 'Reserving Stock & Placing Order...'
                : user
                ? 'Confirm & Place Wholesale Order'
                : 'Log In to Place Order'}
            </button>
          </div>
        </div>
      </form>
    </main>
  );
}
