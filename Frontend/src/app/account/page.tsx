'use client';

/**
 * AweerMarket — Buyer Account Executive Portal
 * Executive Dark Botanical Design System (Matching Super Admin & Shop Admin #030d0a / #10b981)
 * Displays verified buyer profile data, wholesale orders, invoices, and Al Aweer stall relationships.
 * Client-side route guard: redirects unauthenticated visitors to /login.
 */

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getBuyerOrders, OrderSummary, OrderItemSummary } from '@/lib/api-client';
import styles from './Account.module.css';

export default function BuyerAccountPage() {
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Active Tab: 7 distinct navigation views
  type BuyerTab = 'dashboard' | 'orders' | 'invoices' | 'stalls' | 'profile' | 'notifications' | 'settings';
  const [activeTab, setActiveTab] = useState<BuyerTab>('dashboard');

  // Search query & filters
  const [searchQuery, setSearchQuery] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');

  // Selected Order for Detail Modal
  const [selectedOrder, setSelectedOrder] = useState<OrderSummary | null>(null);

  // Selected Order for Printable Tax Invoice Modal
  const [invoiceOrder, setInvoiceOrder] = useState<OrderSummary | null>(null);

  // Notifications State (Derived from real orders + system alerts)
  interface BuyerNotification {
    id: string;
    title: string;
    message: string;
    time: string;
    type: 'order' | 'delivery' | 'market';
    read: boolean;
  }

  // Load orders when user is authenticated
  useEffect(() => {
    if (user) {
      setLoadingOrders(true);
      getBuyerOrders()
        .then((res) => setOrders(res.orders || []))
        .catch(() => setOrders([]))
        .finally(() => setLoadingOrders(false));
    }
  }, [user]);

  // Client-side route protection: redirect to /login when not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [isLoading, user, router]);

  // Derived KPI Metrics
  const totalOrdersCount = orders?.length || 0;
  const pendingOrdersCount = (orders || []).filter((o) =>
    ['pending', 'confirmed', 'preparing', 'dispatched'].includes(o?.status?.toLowerCase() || '')
  ).length;
  const completedOrders = (orders || []).filter((o) => (o?.status?.toLowerCase() || '') === 'delivered');
  const totalSpentAed = (orders || []).reduce((sum, o) => sum + (o?.totalAmountAed || 0), 0);

  // Derived Unique Wholesale Stalls (Hook called unconditionally)
  const uniqueStalls = useMemo(() => {
    if (!orders || orders.length === 0) return [];
    const map = new Map<string, { id: string; name: string; stallNumber?: string; ordersCount: number; totalSpent: number }>();
    for (const o of orders) {
      if (!o) continue;
      const sid = o.shopId || 'unknown';
      const existing = map.get(sid) || {
        id: sid,
        name: o.shopName || 'Wholesale Stall',
        stallNumber: o.stallNumber,
        ordersCount: 0,
        totalSpent: 0
      };
      existing.ordersCount += 1;
      existing.totalSpent += (o.totalAmountAed || 0);
      map.set(sid, existing);
    }
    return Array.from(map.values());
  }, [orders]);

  // Filtered Orders for the Orders Tab (Hook called unconditionally)
  const filteredOrders = useMemo(() => {
    if (!orders || orders.length === 0) return [];
    let list = orders;
    if (orderStatusFilter !== 'all') {
      list = list.filter((o) => (o?.status?.toLowerCase() || '') === orderStatusFilter.toLowerCase());
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (o) =>
          (o?.orderNumber?.toLowerCase() || '').includes(q) ||
          (o?.shopName?.toLowerCase() || '').includes(q) ||
          (o?.stallNumber && o.stallNumber.toLowerCase().includes(q)) ||
          (o?.items && o.items.some((i) => (i?.name?.toLowerCase() || '').includes(q)))
      );
    }
    return list;
  }, [orders, orderStatusFilter, searchQuery]);

  // Derived Notifications (Hook called unconditionally)
  const notifications: BuyerNotification[] = useMemo(() => {
    if (!orders || orders.length === 0) return [];
    const list: BuyerNotification[] = [];
    for (const o of orders.slice(0, 5)) {
      if (!o) continue;
      const itemCount = o.items?.length || 0;
      if (o.status === 'delivered') {
        list.push({
          id: `notif_del_${o.id}`,
          title: `Order Delivered: ${o.orderNumber || ''}`,
          message: `Your wholesale order from ${o.shopName || 'Stall'} has been successfully delivered and completed.`,
          time: new Date(o.updatedAt || o.createdAt || Date.now()).toLocaleDateString([], { month: 'short', day: 'numeric' }),
          type: 'delivery',
          read: true
        });
      } else if (o.status === 'dispatched') {
        list.push({
          id: `notif_disp_${o.id}`,
          title: `Produce Dispatched: ${o.orderNumber || ''}`,
          message: `Al Aweer refrigerated delivery van is on route with your order from ${o.shopName || 'Stall'}.`,
          time: new Date(o.updatedAt || o.createdAt || Date.now()).toLocaleDateString([], { month: 'short', day: 'numeric' }),
          type: 'delivery',
          read: false
        });
      } else {
        list.push({
          id: `notif_ord_${o.id}`,
          title: `Order Received: ${o.orderNumber || ''}`,
          message: `${o.shopName || 'Stall'} is preparing ${itemCount} wholesale produce lines for your stall delivery.`,
          time: new Date(o.createdAt || Date.now()).toLocaleDateString([], { month: 'short', day: 'numeric' }),
          type: 'order',
          read: false
        });
      }
    }
    return list;
  }, [orders]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      router.replace('/login');
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Loading state during initial session probe
  if (isLoading) {
    return (
      <main className={styles.container}>
        <div className={styles.loadingContainer} role="status" aria-live="polite">
          <div className={styles.spinner} />
          <h2 className={styles.loadingTitle}>Loading Account Details</h2>
          <p className={styles.loadingText}>Verifying authenticated session...</p>
        </div>
      </main>
    );
  }

  // Guard against render before redirect completes
  if (!user) {
    return (
      <main className={styles.container}>
        <div className={styles.loadingContainer} role="status">
          <h2 className={styles.loadingTitle}>Redirecting to Login</h2>
          <p className={styles.loadingText}>You must be logged in to view your account.</p>
        </div>
      </main>
    );
  }

  // Safe formatting for registration date
  let formattedDate = 'Recently';
  try {
    if (user.createdAt) {
      const d = new Date(user.createdAt);
      if (!Number.isNaN(d.getTime())) {
        formattedDate = d.toLocaleDateString('en-AE', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      }
    }
  } catch {
    formattedDate = user.createdAt || 'Recently';
  }

  const isProvisional = !user.isEmailVerified;

  // Buyer User Initials for Avatar
  const userInitials = (user.fullName || 'Buyer')
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  // Helper for Order Status Pills
  const renderStatusPill = (status: string) => {
    const s = status.toLowerCase();
    switch (s) {
      case 'pending':
        return <span className={`${styles.statusPill} ${styles.statusPending}`}>⏳ Pending</span>;
      case 'confirmed':
        return <span className={`${styles.statusPill} ${styles.statusConfirmed}`}>✓ Confirmed</span>;
      case 'preparing':
        return <span className={`${styles.statusPill} ${styles.statusPreparing}`}>📦 Preparing</span>;
      case 'dispatched':
        return <span className={`${styles.statusPill} ${styles.statusDispatched}`}>🚚 Dispatched</span>;
      case 'delivered':
        return <span className={`${styles.statusPill} ${styles.statusDelivered}`}>✓ Delivered</span>;
      case 'cancelled':
        return <span className={`${styles.statusPill} ${styles.statusCancelled}`}>✕ Cancelled</span>;
      default:
        return <span className={styles.statusPill}>{status}</span>;
    }
  };

  return (
    <div className={styles.container}>
      {/* =====================================================================
          MAIN PORTAL LAYOUT (Sidebar + Main Content Area)
         ===================================================================== */}
      <div className={styles.portalLayout}>
        {/* LEFT EXECUTIVE SIDEBAR */}
        <aside className={styles.sidebar}>
          <div>
            {/* Buyer Profile Card */}
            <div className={styles.sidebarCard}>
              <div className={styles.sidebarAvatar}>{userInitials}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className={styles.sidebarCardName} title={user.fullName}>
                  {user.fullName}
                </div>
                <div className={styles.sidebarCardSub} title={user.email}>
                  {user.businessName || user.email}
                </div>
                <div className={styles.sidebarCardBadge}>
                  {isProvisional ? 'Provisional' : 'Verified Buyer'}
                </div>
              </div>
            </div>

            {/* Navigation Tabs (7 Executive Modules) */}
            <nav className={styles.navGroup} aria-label="Buyer account navigation">
              {/* 1. Dashboard */}
              <button
                type="button"
                onClick={() => setActiveTab('dashboard')}
                className={`${styles.navItem} ${activeTab === 'dashboard' ? styles.navItemActive : ''}`}
                id="tab-buyer-dashboard"
              >
                <div className={styles.navItemLeft}>
                  <span>📊</span>
                  <span>1. Dashboard</span>
                </div>
              </button>

              {/* 2. Orders & Deliveries */}
              <button
                type="button"
                onClick={() => setActiveTab('orders')}
                className={`${styles.navItem} ${activeTab === 'orders' ? styles.navItemActive : ''}`}
                id="tab-buyer-orders"
              >
                <div className={styles.navItemLeft}>
                  <span>🛒</span>
                  <span>2. Orders &amp; Deliveries</span>
                </div>
                {pendingOrdersCount > 0 ? (
                  <span className={styles.navBadgeAmber}>{pendingOrdersCount} active</span>
                ) : (
                  <span className={styles.navBadge}>{orders.length}</span>
                )}
              </button>

              {/* 3. Invoices */}
              <button
                type="button"
                onClick={() => setActiveTab('invoices')}
                className={`${styles.navItem} ${activeTab === 'invoices' ? styles.navItemActive : ''}`}
                id="tab-buyer-invoices"
              >
                <div className={styles.navItemLeft}>
                  <span>🧾</span>
                  <span>3. Commercial Invoices</span>
                </div>
                <span className={styles.navBadge}>{orders.length}</span>
              </button>

              {/* 4. Saved Stalls */}
              <button
                type="button"
                onClick={() => setActiveTab('stalls')}
                className={`${styles.navItem} ${activeTab === 'stalls' ? styles.navItemActive : ''}`}
                id="tab-buyer-stalls"
              >
                <div className={styles.navItemLeft}>
                  <span>🏪</span>
                  <span>4. Saved Stalls &amp; Vendors</span>
                </div>
                <span className={styles.navBadge}>{uniqueStalls.length}</span>
              </button>

              {/* 5. Buyer Profile & Business */}
              <button
                type="button"
                onClick={() => setActiveTab('profile')}
                className={`${styles.navItem} ${activeTab === 'profile' ? styles.navItemActive : ''}`}
                id="tab-buyer-profile"
              >
                <div className={styles.navItemLeft}>
                  <span>🏢</span>
                  <span>5. Profile &amp; Business</span>
                </div>
              </button>

              {/* 6. Notifications */}
              <button
                type="button"
                onClick={() => setActiveTab('notifications')}
                className={`${styles.navItem} ${activeTab === 'notifications' ? styles.navItemActive : ''}`}
                id="tab-buyer-notifications"
              >
                <div className={styles.navItemLeft}>
                  <span>🔔</span>
                  <span>6. Notifications</span>
                </div>
                {notifications.filter((n) => !n.read).length > 0 && (
                  <span className={styles.navBadgeAmber}>
                    {notifications.filter((n) => !n.read).length}
                  </span>
                )}
              </button>

              {/* 7. Settings & Security */}
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className={`${styles.navItem} ${activeTab === 'settings' ? styles.navItemActive : ''}`}
                id="tab-buyer-settings"
              >
                <div className={styles.navItemLeft}>
                  <span>⚙️</span>
                  <span>7. Settings &amp; Security</span>
                </div>
              </button>
            </nav>
          </div>

          {/* Sidebar Footer */}
          <div className={styles.sidebarFooter}>
            <span>🌿</span>
            <span>Aweermarket v2.0 • Buyer Portal</span>
          </div>
        </aside>

        {/* RIGHT MAIN CONTENT AREA */}
        <main className={styles.mainContent}>
          {/* =================================================================
              TAB 1: DASHBOARD OVERVIEW
             ================================================================= */}
          {activeTab === 'dashboard' && (
            <div>
              {/* Welcome Banner */}
              <div className={styles.welcomeBanner}>
                <div>
                  <h1 className={styles.welcomeTitle}>
                    Welcome back, {user.fullName.split(' ')[0]} 👋
                  </h1>
                  <p className={styles.welcomeSub}>
                    {user.businessName
                      ? `Wholesale Account: ${user.businessName} • Al Aweer Central Market Dubai`
                      : 'Wholesale Buyer Account • Al Aweer Central Fruits & Vegetables Market'}
                  </p>
                  <div className={styles.welcomeBadges}>
                    <span className={styles.roleBadge}>{user.role || 'BUYER'}</span>
                    {isProvisional ? (
                      <span className={styles.provisionalBadge}>Provisional Account</span>
                    ) : (
                      <span className={styles.verifiedBadge}>Verified Wholesale Buyer</span>
                    )}
                  </div>
                </div>

                <Link href="/" className={styles.primaryActionBtn} style={{ maxWidth: 220 }}>
                  🍎 Browse Fresh Produce
                </Link>
              </div>

              {/* Provisional Notice (if unverified) */}
              {isProvisional && (
                <section className={styles.provisionalAlert} aria-label="Account status notice">
                  <span className={styles.alertIcon} aria-hidden="true">
                    ⚠️
                  </span>
                  <div className={styles.alertContent}>
                    <h3>Provisional Account Active</h3>
                    <p>
                      Your account has provisional access enabled. You can browse the Al Aweer wholesale marketplace
                      and place orders. Full email verification will be available in an upcoming release.
                    </p>
                  </div>
                </section>
              )}

              {/* 4 Executive KPI Metric Cards */}
              <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                  <div className={styles.statHeader}>
                    <span className={styles.statTitle}>Total Orders Placed</span>
                    <span className={styles.statIcon}>🛒</span>
                  </div>
                  <div className={styles.statValue}>{totalOrdersCount}</div>
                  <div className={styles.statMeta}>
                    <span>📦 All-time wholesale requests</span>
                  </div>
                </div>

                <div className={styles.statCard}>
                  <div className={styles.statHeader}>
                    <span className={styles.statTitle}>Active Deliveries</span>
                    <span className={styles.statIcon}>🚚</span>
                  </div>
                  <div className={styles.statValue} style={{ color: pendingOrdersCount > 0 ? '#fbbf24' : '#10b981' }}>
                    {pendingOrdersCount}
                  </div>
                  <div className={styles.statMeta}>
                    <span>{pendingOrdersCount > 0 ? 'Fulfillment in progress' : 'All orders fulfilled'}</span>
                  </div>
                </div>

                <div className={styles.statCard}>
                  <div className={styles.statHeader}>
                    <span className={styles.statTitle}>Total Wholesale Spend</span>
                    <span className={styles.statIcon}>💰</span>
                  </div>
                  <div className={`${styles.statValue} ${styles.statValueGreen}`}>
                    Dhs {totalSpentAed.toFixed(2)}
                  </div>
                  <div className={styles.statMeta}>
                    <span>VAT-inclusive commercial total</span>
                  </div>
                </div>

                <div className={styles.statCard}>
                  <div className={styles.statHeader}>
                    <span className={styles.statTitle}>Al Aweer Stalls</span>
                    <span className={styles.statIcon}>🏪</span>
                  </div>
                  <div className={styles.statValue}>{uniqueStalls.length}</div>
                  <div className={styles.statMeta}>
                    <span>Direct wholesale relationships</span>
                  </div>
                </div>
              </div>

              {/* Quick Action Cards */}
              <div className={styles.quickActionsGrid}>
                <Link href="/" className={styles.quickActionCard}>
                  <div className={styles.quickActionIcon}>🍎</div>
                  <div>
                    <div className={styles.quickActionTitle}>Browse Wholesale Produce</div>
                    <div className={styles.quickActionText}>
                      Direct stall prices on apples, bananas, potatoes, onions, and citrus.
                    </div>
                  </div>
                </Link>

                <div
                  className={styles.quickActionCard}
                  onClick={() => setActiveTab('orders')}
                >
                  <div className={styles.quickActionIcon}>📦</div>
                  <div>
                    <div className={styles.quickActionTitle}>Track Orders &amp; Deliveries</div>
                    <div className={styles.quickActionText}>
                      View live status updates from Al Aweer stall dispatchers.
                    </div>
                  </div>
                </div>

                <div
                  className={styles.quickActionCard}
                  onClick={() => setActiveTab('invoices')}
                >
                  <div className={styles.quickActionIcon}>🧾</div>
                  <div>
                    <div className={styles.quickActionTitle}>Tax Invoices &amp; VAT Receipts</div>
                    <div className={styles.quickActionText}>
                      Download official UAE VAT receipts for accounting and records.
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Orders Section */}
              <section className={styles.tableSection}>
                <div className={styles.tableHeaderBar}>
                  <div>
                    <h3 className={styles.tableTitle}>Recent Wholesale Orders</h3>
                    <p className={styles.tableSubtitle}>
                      Your latest procurement orders across Al Aweer Central Market stalls.
                    </p>
                  </div>
                  {orders.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('orders')}
                      className={styles.actionBtnGhost}
                    >
                      View All Orders ({orders.length}) →
                    </button>
                  )}
                </div>

                {loadingOrders ? (
                  <div className={styles.emptyState}>
                    <div className={styles.spinner} style={{ width: 32, height: 32 }} />
                    <p>Loading your orders...</p>
                  </div>
                ) : orders.length === 0 ? (
                  <div className={styles.emptyState}>
                    <span className={styles.emptyStateIcon}>🛒</span>
                    <h4 className={styles.emptyStateTitle}>No Orders Placed Yet</h4>
                    <p className={styles.emptyStateText}>
                      Browse Al Aweer Central Market to place your first wholesale produce order.
                    </p>
                    <Link href="/" className={styles.actionBtn}>
                      Browse Marketplace Catalog
                    </Link>
                  </div>
                ) : (
                  <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Order #</th>
                          <th>Date</th>
                          <th>Wholesale Stall</th>
                          <th>Items Count</th>
                          <th>Total (Dhs)</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orders.slice(0, 5).map((order) => (
                          <tr key={order.id}>
                            <td>
                              <strong style={{ color: '#ffffff' }}>{order.orderNumber}</strong>
                              <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                                {order.deliveryType === 'delivery' ? '🚚 Stall Delivery' : '🏪 Pickup'}
                              </div>
                            </td>
                            <td>
                              {new Date(order.createdAt).toLocaleDateString([], {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </td>
                            <td>
                              <span style={{ color: '#34d399', fontWeight: 600 }}>{order.shopName}</span>
                              {order.stallNumber && (
                                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                                  Stall #{order.stallNumber}
                                </div>
                              )}
                            </td>
                            <td>{order.items.length} lines</td>
                            <td>
                              <strong style={{ color: '#ffffff' }}>
                                Dhs {order.totalAmountAed.toFixed(2)}
                              </strong>
                            </td>
                            <td>{renderStatusPill(order.status)}</td>
                            <td>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button
                                  type="button"
                                  className={styles.actionBtn}
                                  onClick={() => setSelectedOrder(order)}
                                >
                                  Details
                                </button>
                                <button
                                  type="button"
                                  className={styles.actionBtnGhost}
                                  onClick={() => setInvoiceOrder(order)}
                                  title="View Tax Invoice"
                                >
                                  Invoice
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          )}

          {/* =================================================================
              TAB 2: ORDERS & DELIVERIES
             ================================================================= */}
          {activeTab === 'orders' && (
            <div>
              <div className={styles.tableHeaderBar} style={{ borderRadius: 12, marginBottom: 20 }}>
                <div>
                  <h2 className={styles.tableTitle}>Orders &amp; Deliveries Ledger</h2>
                  <p className={styles.tableSubtitle}>
                    Complete history of wholesale orders placed with Al Aweer vendors.
                  </p>
                </div>
                {/* Status Filter Tabs */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {['all', 'pending', 'confirmed', 'preparing', 'dispatched', 'delivered'].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setOrderStatusFilter(s)}
                      className={orderStatusFilter === s ? styles.actionBtn : styles.actionBtnGhost}
                      style={{ textTransform: 'capitalize', fontSize: '0.76rem' }}
                    >
                      {s === 'all' ? 'All Orders' : s}
                    </button>
                  ))}
                </div>
              </div>

              {loadingOrders ? (
                <div className={styles.emptyState}>
                  <div className={styles.spinner} />
                  <p>Loading your orders ledger...</p>
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className={styles.emptyState}>
                  <span className={styles.emptyStateIcon}>🔍</span>
                  <h4 className={styles.emptyStateTitle}>No Orders Matching Filter</h4>
                  <p className={styles.emptyStateText}>
                    Try clearing your search query or switching status filters.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setOrderStatusFilter('all');
                      setSearchQuery('');
                    }}
                    className={styles.actionBtn}
                  >
                    Reset Filters
                  </button>
                </div>
              ) : (
                <div className={styles.tableSection}>
                  <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Order #</th>
                          <th>Placed Date</th>
                          <th>Vendor / Stall</th>
                          <th>Delivery Details</th>
                          <th>Items</th>
                          <th>Total Amount</th>
                          <th>Status</th>
                          <th>Quick Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredOrders.map((order) => (
                          <tr key={order.id}>
                            <td>
                              <strong style={{ color: '#ffffff' }}>{order.orderNumber}</strong>
                            </td>
                            <td>
                              {new Date(order.createdAt).toLocaleDateString([], {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </td>
                            <td>
                              <strong style={{ color: '#34d399' }}>{order.shopName}</strong>
                              {order.stallNumber && (
                                <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                                  Stall #{order.stallNumber}
                                </div>
                              )}
                            </td>
                            <td>
                              <div style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
                                {order.deliveryType === 'delivery' ? '🚚 Van Delivery' : '🏪 Direct Pickup'}
                              </div>
                              {order.deliveryAddress && (
                                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                                  {order.deliveryAddress}
                                </div>
                              )}
                            </td>
                            <td>
                              <span style={{ color: '#94a3b8' }}>{order.items.length} lines</span>
                              <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                                {order.items[0]?.name}
                                {order.items.length > 1 ? ` +${order.items.length - 1} more` : ''}
                              </div>
                            </td>
                            <td>
                              <strong style={{ color: '#ffffff', fontSize: '0.92rem' }}>
                                Dhs {order.totalAmountAed.toFixed(2)}
                              </strong>
                            </td>
                            <td>{renderStatusPill(order.status)}</td>
                            <td>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button
                                  type="button"
                                  className={styles.actionBtn}
                                  onClick={() => setSelectedOrder(order)}
                                >
                                  View Details
                                </button>
                                <button
                                  type="button"
                                  className={styles.actionBtnGhost}
                                  onClick={() => setInvoiceOrder(order)}
                                >
                                  Invoice
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =================================================================
              TAB 3: COMMERCIAL INVOICES
             ================================================================= */}
          {activeTab === 'invoices' && (
            <div>
              <div className={styles.tableHeaderBar} style={{ borderRadius: 12, marginBottom: 20 }}>
                <div>
                  <h2 className={styles.tableTitle}>Commercial Tax Invoices</h2>
                  <p className={styles.tableSubtitle}>
                    Official UAE VAT compliant invoices for wholesale accounting and records.
                  </p>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 600 }}>
                  Standard UAE VAT 5% Included
                </div>
              </div>

              {orders.length === 0 ? (
                <div className={styles.emptyState}>
                  <span className={styles.emptyStateIcon}>🧾</span>
                  <h4 className={styles.emptyStateTitle}>No Invoices Available</h4>
                  <p className={styles.emptyStateText}>
                    Invoices are generated automatically as wholesale orders are placed and confirmed.
                  </p>
                </div>
              ) : (
                <div className={styles.tableSection}>
                  <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Invoice #</th>
                          <th>Order Ref</th>
                          <th>Date</th>
                          <th>Wholesale Vendor</th>
                          <th>Subtotal</th>
                          <th>VAT (5%)</th>
                          <th>Total Amount (Dhs)</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orders.map((order) => {
                          const total = order.totalAmountAed;
                          const subtotal = total / 1.05;
                          const vat = total - subtotal;
                          return (
                            <tr key={order.id}>
                              <td>
                                <strong style={{ color: '#ffffff' }}>
                                  INV-{order.orderNumber.replace(/[^0-9]/g, '').slice(-6) || '2026-01'}
                                </strong>
                              </td>
                              <td>{order.orderNumber}</td>
                              <td>
                                {new Date(order.createdAt).toLocaleDateString([], {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric'
                                })}
                              </td>
                              <td>
                                <span style={{ color: '#34d399' }}>{order.shopName}</span>
                              </td>
                              <td>Dhs {subtotal.toFixed(2)}</td>
                              <td>Dhs {vat.toFixed(2)}</td>
                              <td>
                                <strong style={{ color: '#10b981' }}>Dhs {total.toFixed(2)}</strong>
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className={styles.actionBtn}
                                  onClick={() => setInvoiceOrder(order)}
                                >
                                  View / Print Tax Invoice
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =================================================================
              TAB 4: SAVED STALLS & VENDORS
             ================================================================= */}
          {activeTab === 'stalls' && (
            <div>
              <div className={styles.tableHeaderBar} style={{ borderRadius: 12, marginBottom: 20 }}>
                <div>
                  <h2 className={styles.tableTitle}>Saved Al Aweer Stalls &amp; Vendors</h2>
                  <p className={styles.tableSubtitle}>
                    Verified wholesale fruit and vegetable suppliers you have direct trade history with.
                  </p>
                </div>
                <Link href="/" className={styles.actionBtn}>
                  + Browse More Stalls
                </Link>
              </div>

              {uniqueStalls.length === 0 ? (
                <div className={styles.emptyState}>
                  <span className={styles.emptyStateIcon}>🏪</span>
                  <h4 className={styles.emptyStateTitle}>No Stalls Saved Yet</h4>
                  <p className={styles.emptyStateText}>
                    When you order from vendors in Al Aweer Central Market, they will automatically appear here.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                  {uniqueStalls.map((stall) => (
                    <div key={stall.id} className={styles.statCard} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 10,
                            background: 'rgba(16, 185, 129, 0.15)',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.25rem'
                          }}
                        >
                          🏪
                        </div>
                        <div>
                          <h4 style={{ margin: '0 0 2px', fontSize: '0.98rem', color: '#ffffff' }}>{stall.name}</h4>
                          <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>
                            {stall.stallNumber ? `Stall #${stall.stallNumber}` : 'Al Aweer Central Stall'}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#94a3b8', borderTop: '1px solid rgba(16, 185, 129, 0.1)', paddingTop: 10 }}>
                        <span>Total Orders: <strong style={{ color: '#ffffff' }}>{stall.ordersCount}</strong></span>
                        <span>Total Spend: <strong style={{ color: '#34d399' }}>Dhs {stall.totalSpent.toFixed(2)}</strong></span>
                      </div>

                      <Link
                        href={`/shops/${stall.id}`}
                        className={styles.actionBtn}
                        style={{ textAlign: 'center', justifyContent: 'center' }}
                      >
                        Visit Stall Storefront →
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* =================================================================
              TAB 5: BUYER PROFILE & BUSINESS SETTINGS
             ================================================================= */}
          {activeTab === 'profile' && (
            <div>
              {/* Profile Details Grid */}
              <div className={styles.grid}>
                {/* Profile Card */}
                <section className={styles.card} aria-labelledby="profile-heading">
                  <h2 id="profile-heading" className={styles.cardTitle}>
                    Buyer Profile Details
                  </h2>
                  <dl className={styles.dataList}>
                    <div className={styles.dataRow}>
                      <dt className={styles.dataLabel}>Full Name</dt>
                      <dd className={styles.dataValue}>{user.fullName}</dd>
                    </div>

                    <div className={styles.dataRow}>
                      <dt className={styles.dataLabel}>Email Address</dt>
                      <dd className={styles.dataValue}>{user.email}</dd>
                    </div>

                    <div className={styles.dataRow}>
                      <dt className={styles.dataLabel}>Business Name</dt>
                      <dd className={styles.dataValue}>
                        {user.businessName && user.businessName.trim() ? (
                          user.businessName
                        ) : (
                          <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>
                            Individual Buyer / Not Specified
                          </span>
                        )}
                      </dd>
                    </div>

                    <div className={styles.dataRow}>
                      <dt className={styles.dataLabel}>Account Status</dt>
                      <dd className={styles.dataValue}>
                        {user.isActive ? (
                          <span className={styles.activeStatus}>
                            <span className={styles.statusDot} aria-hidden="true" />
                            Active
                          </span>
                        ) : (
                          <span style={{ color: '#dc2626', fontWeight: 600 }}>Suspended</span>
                        )}
                      </dd>
                    </div>

                    <div className={styles.dataRow}>
                      <dt className={styles.dataLabel}>Email Status</dt>
                      <dd className={styles.dataValue}>
                        {user.isEmailVerified ? 'Verified' : 'Provisional (Unverified)'}
                      </dd>
                    </div>

                    <div className={styles.dataRow}>
                      <dt className={styles.dataLabel}>Member Since</dt>
                      <dd className={styles.dataValue}>{formattedDate}</dd>
                    </div>

                    <div className={styles.dataRow}>
                      <dt className={styles.dataLabel}>Account ID</dt>
                      <dd className={styles.dataValue}>
                        <code className={styles.monoValue}>{user.id}</code>
                      </dd>
                    </div>
                  </dl>
                </section>

                {/* Side Actions Column */}
                <aside>
                  {/* Marketplace Discovery */}
                  <section className={styles.sideCard} aria-labelledby="marketplace-heading">
                    <h3 id="marketplace-heading" className={styles.sideCardTitle}>
                      Wholesale Produce
                    </h3>
                    <p className={styles.sideCardText}>
                      Discover fresh fruits and vegetables with real-time price comparison across Al Aweer Central Market stalls.
                    </p>
                    <Link href="/" className={styles.primaryActionBtn}>
                      Browse Marketplace
                    </Link>
                  </section>

                  {/* Summary Card */}
                  <section className={styles.sideCard}>
                    <h3 className={styles.sideCardTitle}>Trade Account Tier</h3>
                    <p className={styles.sideCardText}>
                      Registered Wholesale Procurement account. Eligible for commercial VAT invoices and scheduled stall deliveries.
                    </p>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <span className={styles.statusDelivered}>Verified Wholesale</span>
                      <span className={styles.statusConfirmed}>Dhs Currency</span>
                    </div>
                  </section>
                </aside>
              </div>

              {/* Security & Session Management Section */}
              <section className={styles.logoutSection} aria-label="Session management">
                <div className={styles.logoutInfo}>
                  <h4>Active Session</h4>
                  <p>Logged in via secure HTTP-only session cookie. End your session securely anytime.</p>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className={styles.accountLogoutBtn}
                  aria-label="Log out of buyer account"
                >
                  {isLoggingOut ? 'Logging out...' : 'Log Out of Account'}
                </button>
              </section>
            </div>
          )}

          {/* =================================================================
              TAB 6: NOTIFICATIONS
             ================================================================= */}
          {activeTab === 'notifications' && (
            <div>
              <div className={styles.tableHeaderBar} style={{ borderRadius: 12, marginBottom: 20 }}>
                <div>
                  <h2 className={styles.tableTitle}>Notifications &amp; Activity Log</h2>
                  <p className={styles.tableSubtitle}>
                    Real-time alerts for order confirmation, dispatch progress, and market arrivals.
                  </p>
                </div>
              </div>

              {notifications.length === 0 ? (
                <div className={styles.emptyState}>
                  <span className={styles.emptyStateIcon}>🔔</span>
                  <h4 className={styles.emptyStateTitle}>No New Notifications</h4>
                  <p className={styles.emptyStateText}>
                    You will receive instant alerts here as vendors process your orders.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      style={{
                        background: '#04130e',
                        border: '1px solid rgba(16, 185, 129, 0.2)',
                        borderRadius: 10,
                        padding: '16px 20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 16
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 8,
                            background: n.type === 'delivery' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.1rem'
                          }}
                        >
                          {n.type === 'delivery' ? '🚚' : '📦'}
                        </div>
                        <div>
                          <strong style={{ color: '#ffffff', fontSize: '0.9rem' }}>{n.title}</strong>
                          <p style={{ margin: '3px 0 0', color: '#94a3b8', fontSize: '0.8rem' }}>{n.message}</p>
                        </div>
                      </div>
                      <span style={{ fontSize: '0.74rem', color: '#64748b', whiteSpace: 'nowrap' }}>{n.time}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* =================================================================
              TAB 7: SETTINGS & SECURITY
             ================================================================= */}
          {activeTab === 'settings' && (
            <div>
              <div className={styles.tableHeaderBar} style={{ borderRadius: 12, marginBottom: 20 }}>
                <div>
                  <h2 className={styles.tableTitle}>Account Settings &amp; Security</h2>
                  <p className={styles.tableSubtitle}>
                    Manage procurement preferences, session credentials, and security controls.
                  </p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div className={styles.card}>
                  <h3 className={styles.cardTitle}>Session &amp; Security Controls</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: '0.84rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(16, 185, 129, 0.1)', paddingBottom: 8 }}>
                      <span style={{ color: '#94a3b8' }}>Session Token Storage</span>
                      <strong style={{ color: '#34d399' }}>HTTP-Only Secure Cookie (No localStorage)</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(16, 185, 129, 0.1)', paddingBottom: 8 }}>
                      <span style={{ color: '#94a3b8' }}>Currency Standards</span>
                      <strong style={{ color: '#ffffff' }}>United Arab Emirates Dirham (Dhs)</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(16, 185, 129, 0.1)', paddingBottom: 8 }}>
                      <span style={{ color: '#94a3b8' }}>Marketplace Zone</span>
                      <strong style={{ color: '#ffffff' }}>Ras Al Khor / Al Aweer Central Market</strong>
                    </div>
                  </div>
                </div>

                <div className={styles.card}>
                  <h3 className={styles.cardTitle}>Termination &amp; Sign Out</h3>
                  <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: '0 0 16px', lineHeight: 1.4 }}>
                    End your authenticated session. This immediately revokes session cookies across the browser.
                  </p>
                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className={styles.accountLogoutBtn}
                    style={{ width: '100%', textAlign: 'center' }}
                  >
                    {isLoggingOut ? 'Logging out...' : 'Sign Out of Buyer Account'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* =====================================================================
          MODAL: ORDER DETAILS
         ===================================================================== */}
      {selectedOrder && (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true">
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Order Details: {selectedOrder.orderNumber}</h3>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setSelectedOrder(null)}
              >
                ✕
              </button>
            </div>

            <div className={styles.modalBody}>
              {/* Order Status Progress Tracker */}
              <div className={styles.progressTimeline}>
                {[
                  { key: 'pending', label: '1. Pending' },
                  { key: 'confirmed', label: '2. Confirmed' },
                  { key: 'preparing', label: '3. Preparing' },
                  { key: 'dispatched', label: '4. Dispatched' },
                  { key: 'delivered', label: '5. Delivered' }
                ].map((step, idx) => {
                  const statusOrder = ['pending', 'confirmed', 'preparing', 'dispatched', 'delivered'];
                  const currentIdx = statusOrder.indexOf(selectedOrder.status.toLowerCase());
                  const isDone = currentIdx >= idx;
                  const isActive = currentIdx === idx;
                  return (
                    <div key={step.key} className={styles.timelineStep}>
                      <div
                        className={`${styles.stepCircle} ${isDone ? styles.stepCircleDone : ''} ${
                          isActive ? styles.stepCircleActive : ''
                        }`}
                      >
                        {isDone ? '✓' : idx + 1}
                      </div>
                      <span className={`${styles.stepLabel} ${isActive ? styles.stepLabelActive : ''}`}>
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Order Summary Metadata */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, background: '#020d09', padding: 14, borderRadius: 8, fontSize: '0.82rem' }}>
                <div>
                  <div style={{ color: '#64748b' }}>Wholesale Vendor:</div>
                  <strong style={{ color: '#34d399' }}>{selectedOrder.shopName}</strong>
                  {selectedOrder.stallNumber && (
                    <div style={{ color: '#94a3b8', fontSize: '0.74rem' }}>
                      Stall #{selectedOrder.stallNumber} • Al Aweer Market
                    </div>
                  )}
                </div>
                <div>
                  <div style={{ color: '#64748b' }}>Fulfillment Method:</div>
                  <strong style={{ color: '#ffffff' }}>
                    {selectedOrder.deliveryType === 'delivery' ? '🚚 Van Delivery' : '🏪 Stall Pickup'}
                  </strong>
                  {selectedOrder.deliveryAddress && (
                    <div style={{ color: '#94a3b8', fontSize: '0.74rem' }}>
                      {selectedOrder.deliveryAddress}
                    </div>
                  )}
                </div>
              </div>

              {/* Items Table */}
              <div>
                <h4 style={{ margin: '0 0 10px', fontSize: '0.9rem', color: '#ffffff' }}>
                  Ordered Wholesale Lines ({selectedOrder.items.length})
                </h4>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Packaging</th>
                      <th>Qty</th>
                      <th>Unit Price</th>
                      <th>Line Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrder.items.map((item, i) => (
                      <tr key={i}>
                        <td>
                          <strong style={{ color: '#ffffff' }}>{item.name}</strong>
                        </td>
                        <td>{item.unitWeightKg} kg / {item.unit}</td>
                        <td>{item.quantity} units</td>
                        <td>Dhs {item.unitPriceAed.toFixed(2)}</td>
                        <td>
                          <strong style={{ color: '#34d399' }}>Dhs {item.lineTotalAed.toFixed(2)}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, borderTop: '1px solid rgba(16, 185, 129, 0.2)', paddingTop: 10 }}>
                <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                  Subtotal: Dhs {(selectedOrder.totalAmountAed / 1.05).toFixed(2)}
                </div>
                <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                  VAT (5%): Dhs {(selectedOrder.totalAmountAed - selectedOrder.totalAmountAed / 1.05).toFixed(2)}
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#10b981' }}>
                  Total Order Amount: Dhs {selectedOrder.totalAmountAed.toFixed(2)}
                </div>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.actionBtnGhost}
                onClick={() => setSelectedOrder(null)}
              >
                Close
              </button>
              <button
                type="button"
                className={styles.actionBtn}
                onClick={() => {
                  setInvoiceOrder(selectedOrder);
                  setSelectedOrder(null);
                }}
              >
                View Commercial Tax Invoice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: PRINTABLE COMMERCIAL TAX INVOICE
         ===================================================================== */}
      {invoiceOrder && (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true">
          <div className={styles.modalCard} style={{ maxWidth: 720 }}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Tax Invoice: {invoiceOrder.orderNumber}</h3>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setInvoiceOrder(null)}
              >
                ✕
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.printableInvoice} id="printable-tax-invoice">
                {/* Invoice Header */}
                <div className={styles.invoiceHeaderWrap}>
                  <div>
                    <div className={styles.invoiceBrand}>🌿 AweerMarket</div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                      Al Aweer Central Fruits &amp; Vegetables Wholesale Market
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                      Dubai, United Arab Emirates
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className={styles.invoiceBadge}>TAX INVOICE</div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, marginTop: 4 }}>
                      INV-{invoiceOrder.orderNumber.replace(/[^0-9]/g, '').slice(-6) || '2026-01'}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                      Date: {new Date(invoiceOrder.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                {/* Seller & Buyer Info */}
                <div className={styles.invoiceGrid}>
                  <div>
                    <strong style={{ color: '#064e3b' }}>SUPPLIER / STALL:</strong>
                    <div>{invoiceOrder.shopName}</div>
                    <div style={{ color: '#64748b' }}>
                      {invoiceOrder.stallNumber ? `Stall #${invoiceOrder.stallNumber}` : 'Central Market Operations'}
                    </div>
                    <div style={{ color: '#64748b' }}>Al Aweer Market, Dubai, UAE</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <strong style={{ color: '#064e3b' }}>BILL TO (BUYER):</strong>
                    <div>{user.fullName}</div>
                    {user.businessName && <div>{user.businessName}</div>}
                    <div style={{ color: '#64748b' }}>{user.email}</div>
                  </div>
                </div>

                {/* Items Table */}
                <table className={styles.invoiceTable}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Description</th>
                      <th>Packaging</th>
                      <th>Qty</th>
                      <th>Rate (Dhs)</th>
                      <th>Amount (Dhs)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoiceOrder.items.map((it, idx) => (
                      <tr key={idx}>
                        <td>{idx + 1}</td>
                        <td><strong>{it.name}</strong></td>
                        <td>{it.unitWeightKg}kg / {it.unit}</td>
                        <td>{it.quantity}</td>
                        <td>{it.unitPriceAed.toFixed(2)}</td>
                        <td><strong>{it.lineTotalAed.toFixed(2)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Totals */}
                <div className={styles.invoiceTotals}>
                  <div>Subtotal: <strong>Dhs {(invoiceOrder.totalAmountAed / 1.05).toFixed(2)}</strong></div>
                  <div>UAE VAT (5%): <strong>Dhs {(invoiceOrder.totalAmountAed - invoiceOrder.totalAmountAed / 1.05).toFixed(2)}</strong></div>
                  <div className={styles.invoiceGrandTotal}>
                    Total Payable: Dhs {invoiceOrder.totalAmountAed.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.actionBtnGhost}
                onClick={() => setInvoiceOrder(null)}
              >
                Close
              </button>
              <button
                type="button"
                className={styles.actionBtn}
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.print();
                  }
                }}
              >
                🖨️ Print / Save PDF Invoice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
