'use client';

/**
 * AweerMarket — Buyer Order History (/account/orders)
 * Lists all past and active wholesale orders placed by the authenticated buyer.
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getBuyerOrders, OrderSummary } from '@/lib/api-client';
import styles from './Orders.module.css';

export default function BuyerOrdersPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loadingOrders, setLoadingOrders] = useState<boolean>(true);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    if (user) {
      setLoadingOrders(true);
      getBuyerOrders()
        .then((res) => setOrders(res.orders || []))
        .catch(() => setOrders([]))
        .finally(() => setLoadingOrders(false));
    }
  }, [user]);

  if (isLoading || loadingOrders) {
    return (
      <main className={styles.container}>
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#15803d' }}>
          <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>Loading wholesale orders...</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <main className={styles.container}>
      {/* Breadcrumb Navigation */}
      <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
        <Link href="/" className={styles.breadcrumbLink}>Home</Link>
        <span>/</span>
        <Link href="/account" className={styles.breadcrumbLink}>Account</Link>
        <span>/</span>
        <span className={styles.breadcrumbCurrent}>Orders</span>
      </nav>

      {/* Header Banner */}
      <div className={styles.headerCard}>
        <div className={styles.titleArea}>
          <h1 className={styles.pageTitle}>My Wholesale Orders</h1>
          <p className={styles.pageSubtitle}>
            Track your bulk produce orders, delivery schedules, and stall pickup status.
          </p>
        </div>
        <Link href="/account" className={styles.accountLinkBtn}>
          ← Back to Account
        </Link>
      </div>

      {orders.length === 0 ? (
        <div className={styles.emptyCard}>
          <div className={styles.emptyIcon}>📦</div>
          <h2 className={styles.emptyTitle}>No Wholesale Orders Yet</h2>
          <p className={styles.emptyText}>
            You haven&apos;t placed any wholesale produce orders yet. Explore verified Al Aweer market stalls to place your first bulk order.
          </p>
          <Link href="/" className={styles.browseBtn}>
            Browse Marketplace
          </Link>
        </div>
      ) : (
        <div className={styles.orderList}>
          {orders.map((order) => {
            let orderDate = 'Recently';
            try {
              orderDate = new Date(order.createdAt).toLocaleDateString('en-AE', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              });
            } catch {
              orderDate = order.createdAt;
            }

            return (
              <article key={order.id} className={styles.orderCard}>
                <div className={styles.orderTop}>
                  <span className={styles.orderNumber}>{order.orderNumber}</span>
                  <span
                    className={`${styles.statusBadge} ${
                      order.status.toLowerCase().includes('process')
                        ? styles.statusProcessing
                        : styles.statusPlaced
                    }`}
                  >
                    {order.status}
                  </span>
                </div>

                <div className={styles.orderDetailsGrid}>
                  <div>
                    <div className={styles.detailLabel}>Wholesale Stall</div>
                    <div className={styles.detailValue}>{order.shopName}</div>
                  </div>
                  <div>
                    <div className={styles.detailLabel}>Date Placed</div>
                    <div className={styles.detailValue}>{orderDate}</div>
                  </div>
                  <div>
                    <div className={styles.detailLabel}>Fulfillment</div>
                    <div className={styles.detailValue}>{order.deliveryType}</div>
                  </div>
                  <div>
                    <div className={styles.detailLabel}>Produce Lines</div>
                    <div className={styles.detailValue}>{order.items.length} items</div>
                  </div>
                </div>

                <div className={styles.orderBottom}>
                  <div>
                    <span style={{ fontSize: '0.85rem', color: '#64748b', marginRight: '6px' }}>Total Amount:</span>
                    <span className={styles.totalAmount}>Dhs {order.totalAmountAed.toFixed(2)}</span>
                  </div>
                  <Link href={`/account/orders/${order.id}`} className={styles.viewDetailsLink}>
                    View Order Details →
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
