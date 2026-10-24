'use client';

/**
 * AweerMarket — Buyer Order Details Route (/account/orders/[id])
 * Detailed breakdown of wholesale produce lines, fulfillment schedule,
 * and stall origin for a specific order.
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getBuyerOrderById, OrderSummary, ApiClientError } from '@/lib/api-client';
import styles from './OrderDetail.module.css';

export default function BuyerOrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params?.id as string;
  const { user, isLoading } = useAuth();

  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [loadingOrder, setLoadingOrder] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    if (user && orderId) {
      setLoadingOrder(true);
      getBuyerOrderById(orderId)
        .then((res) => {
          setOrder(res.order);
        })
        .catch((err: unknown) => {
          if (err instanceof ApiClientError) {
            setError(err.message);
          } else {
            setError('Could not retrieve order details.');
          }
        })
        .finally(() => setLoadingOrder(false));
    }
  }, [user, orderId]);

  if (isLoading || loadingOrder) {
    return (
      <main className={styles.container}>
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#15803d' }}>
          <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>Loading order details...</p>
        </div>
      </main>
    );
  }

  if (error || !order) {
    return (
      <main className={styles.container}>
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <h2 style={{ color: '#0f172a', marginBottom: '8px' }}>Order Not Found</h2>
          <p style={{ color: '#64748b', marginBottom: '20px' }}>
            {error || 'The requested order could not be loaded.'}
          </p>
          <Link href="/account/orders" className={styles.backBtn}>
            ← Back to Orders
          </Link>
        </div>
      </main>
    );
  }

  let formattedDate = 'Recently';
  try {
    formattedDate = new Date(order.createdAt).toLocaleDateString('en-AE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    formattedDate = order.createdAt;
  }

  return (
    <main className={styles.container}>
      {/* Breadcrumb Navigation */}
      <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
        <Link href="/" className={styles.breadcrumbLink}>Home</Link>
        <span>/</span>
        <Link href="/account" className={styles.breadcrumbLink}>Account</Link>
        <span>/</span>
        <Link href="/account/orders" className={styles.breadcrumbLink}>Orders</Link>
        <span>/</span>
        <span className={styles.breadcrumbCurrent}>{order.orderNumber}</span>
      </nav>

      {/* Header Card */}
      <div className={styles.orderHeaderCard}>
        <div className={styles.topRow}>
          <h1 className={styles.orderNumber}>{order.orderNumber}</h1>
          <span className={styles.statusBadge}>{order.status}</span>
        </div>
        <p className={styles.orderSub}>
          Placed on {formattedDate} • Reference ID: <code style={{ color: '#15803d' }}>{order.id}</code>
        </p>
      </div>

      {/* Key Info Grid */}
      <div className={styles.infoGrid}>
        <div className={styles.infoBox}>
          <div className={styles.boxTitle}>Wholesale Stall</div>
          <div className={styles.boxContent}>{order.shopName}</div>
          <p className={styles.boxSub}>Stall No: {order.stallNumber || 'Central Market Block'}</p>
        </div>

        <div className={styles.infoBox}>
          <div className={styles.boxTitle}>Fulfillment Method</div>
          <div className={styles.boxContent}>{order.deliveryType}</div>
          <p className={styles.boxSub}>
            {order.deliveryAddress
              ? `Delivery: ${order.deliveryAddress}`
              : order.pickupTime
              ? `Pickup: ${order.pickupTime}`
              : 'Market Stall Dispatch'}
          </p>
        </div>

        <div className={styles.infoBox}>
          <div className={styles.boxTitle}>Payment & Terms</div>
          <div className={styles.boxContent}>Wholesale Invoicing</div>
          <p className={styles.boxSub}>Direct B2B Market Settlement</p>
        </div>
      </div>

      {/* Line Items Table */}
      <section className={styles.itemsSection}>
        <h2 className={styles.sectionTitle}>Order Line Items ({order.items.length})</h2>
        <div style={{ overflowX: 'auto' }}>
          <table className={styles.itemsTable}>
            <thead>
              <tr>
                <th>Produce Name</th>
                <th>Unit / Packaging</th>
                <th>Weight (kg)</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th style={{ textAlign: 'right' }}>Line Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, idx) => (
                <tr key={`${item.productId}-${idx}`}>
                  <td style={{ fontWeight: 600 }}>{item.name}</td>
                  <td>{item.unit}</td>
                  <td>{item.unitWeightKg} kg</td>
                  <td>{item.quantity}</td>
                  <td>Dhs {item.unitPriceAed.toFixed(2)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#15803d' }}>
                    Dhs {item.lineTotalAed.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Total Summary */}
        <div className={styles.totalSummary}>
          <div className={styles.summaryRow}>
            <span>Subtotal</span>
            <span>Dhs {order.totalAmountAed.toFixed(2)}</span>
          </div>
          <div className={styles.summaryRow}>
            <span>Market VAT (Wholesale 0%)</span>
            <span>Dhs 0.00</span>
          </div>
          <div className={styles.finalTotal}>
            <span>Total Amount</span>
            <span>Dhs {order.totalAmountAed.toFixed(2)}</span>
          </div>
        </div>
      </section>

      <div>
        <Link href="/account/orders" className={styles.backBtn}>
          ← Back to Orders List
        </Link>
      </div>
    </main>
  );
}
