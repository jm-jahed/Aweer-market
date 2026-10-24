'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  useSuperAdminAuth
} from '../lib/auth-context';
import {
  getAdminOverview,
  getAdminShops,
  setAdminShopApproval,
  getAdminUsers,
  setAdminUserStatus,
  getAdminProducts,
  setAdminProductModeration,
  PlatformMetrics,
  AdminShopItem,
  AdminProductItem
} from '../lib/api-client';
import type { UserSummary } from '@aweermarket/types';
import styles from './Dashboard.module.css';

export default function SuperAdminDashboard() {
  const router = useRouter();
  const { user, isLoading: authLoading, logout } = useSuperAdminAuth();

  const [activeTab, setActiveTab] = useState<'stalls' | 'users' | 'products'>('stalls');
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [shops, setShops] = useState<AdminShopItem[]>([]);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [products, setProducts] = useState<AdminProductItem[]>([]);

  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Auth Guard
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  const loadAllData = useCallback(async () => {
    setIsLoadingData(true);
    setDataError(null);
    try {
      const [overviewRes, shopsRes, usersRes, productsRes] = await Promise.all([
        getAdminOverview(),
        getAdminShops(),
        getAdminUsers(),
        getAdminProducts()
      ]);
      setMetrics(overviewRes.metrics);
      setShops(shopsRes.shops);
      setUsers(usersRes.users);
      setProducts(productsRes.products);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch platform governance data';
      setDataError(msg);
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      loadAllData();
    }
  }, [user, loadAllData]);

  const handleToggleShopApproval = async (shop: AdminShopItem) => {
    setProcessingId(shop.id);
    try {
      const res = await setAdminShopApproval(shop.id, !shop.isApproved);
      setShops((prev) =>
        prev.map((s) => (s.id === shop.id ? { ...s, isApproved: res.shop.isApproved } : s))
      );
      if (metrics) {
        setMetrics({
          ...metrics,
          approvedShops: res.shop.isApproved ? metrics.approvedShops + 1 : metrics.approvedShops - 1,
          pendingShops: res.shop.isApproved ? metrics.pendingShops - 1 : metrics.pendingShops + 1
        });
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update shop approval');
    } finally {
      setProcessingId(null);
    }
  };

  const handleToggleUserStatus = async (targetUser: UserSummary) => {
    if (user && targetUser.id === user.id) {
      alert('Security Protection: Super Admin cannot deactivate own account.');
      return;
    }

    setProcessingId(targetUser.id);
    try {
      const res = await setAdminUserStatus(targetUser.id, !targetUser.isActive);
      setUsers((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, isActive: res.user.isActive } : u))
      );
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update user status');
    } finally {
      setProcessingId(null);
    }
  };

  const handleToggleProductModeration = async (product: AdminProductItem) => {
    setProcessingId(product.id);
    try {
      // Toggle logic: If product exists in active list, deactivate it
      await setAdminProductModeration(product.id, false);
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
      if (metrics) {
        setMetrics({
          ...metrics,
          activeProducts: Math.max(0, metrics.activeProducts - 1),
          inactiveProducts: metrics.inactiveProducts + 1
        });
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delist produce');
    } finally {
      setProcessingId(null);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  if (authLoading || (!user && !dataError)) {
    return (
      <div className={styles.loadingBanner}>
        Authenticating Super Admin privileged session...
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Top Navbar */}
      <nav className={styles.navbar}>
        <div className={styles.brand}>
          <h1 className={styles.brandTitle}>AweerMarket Central</h1>
          <span className={styles.brandBadge}>Super Admin (Port 3002)</span>
        </div>
        <div className={styles.userNav}>
          <div className={styles.userInfo}>
            <p className={styles.userName}>{user?.fullName || 'Super Admin'}</p>
            <p className={styles.userEmail}>{user?.email}</p>
          </div>
          <button onClick={handleLogout} className={styles.logoutBtn} id="super-admin-logout-btn">
            Sign Out
          </button>
        </div>
      </nav>

      {/* Main Container */}
      <main className={styles.mainContent}>
        <header className={styles.pageHeader}>
          <h2 className={styles.pageTitle}>Platform Governance Dashboard</h2>
          <p className={styles.pageDescription}>
            Authoritative control over Al Aweer wholesale stalls, participant accounts, and produce moderation.
          </p>
        </header>

        {dataError && (
          <div className={styles.errorBanner} role="alert">
            <span>{dataError}</span>
            <button onClick={loadAllData} className={styles.retryBtn}>
              Retry
            </button>
          </div>
        )}

        {/* Live Metrics Grid */}
        <section className={styles.metricsGrid} aria-label="Platform Metrics">
          <div className={styles.metricCard}>
            <div className={styles.metricLabel}>Total Users</div>
            <div className={styles.metricValue}>{metrics ? metrics.totalUsers : '—'}</div>
            <div className={styles.metricSubtext}>
              {metrics ? `${metrics.buyers} Buyers • ${metrics.shopAdmins} Vendors • ${metrics.superAdmins} Admins` : 'Loading...'}
            </div>
          </div>

          <div className={styles.metricCard}>
            <div className={styles.metricLabel}>Al Aweer Stalls</div>
            <div className={styles.metricValue}>{metrics ? metrics.totalShops : '—'}</div>
            <div className={styles.metricSubtext}>
              {metrics ? `${metrics.approvedShops} Approved • ${metrics.pendingShops} Pending Approval` : 'Loading...'}
            </div>
          </div>

          <div className={styles.metricCard}>
            <div className={styles.metricLabel}>Produce Catalog</div>
            <div className={styles.metricValue}>{metrics ? metrics.totalProducts : '—'}</div>
            <div className={styles.metricSubtext}>
              {metrics ? `${metrics.activeProducts} Live • ${metrics.inactiveProducts} Moderated` : 'Loading...'}
            </div>
          </div>

          <div className={styles.metricCard}>
            <div className={styles.metricLabel}>Wholesale Orders</div>
            <div className={styles.metricValue}>{metrics ? metrics.totalOrders : '—'}</div>
            <div className={styles.metricSubtext}>Total platform transactions</div>
          </div>
        </section>

        {/* Tab Navigation */}
        <div className={styles.tabsNav} role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === 'stalls'}
            className={`${styles.tabBtn} ${activeTab === 'stalls' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('stalls')}
          >
            Stalls Governance ({shops.length})
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'users'}
            className={`${styles.tabBtn} ${activeTab === 'users' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('users')}
          >
            User Accounts ({users.length})
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'products'}
            className={`${styles.tabBtn} ${activeTab === 'products' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('products')}
          >
            Produce Moderation ({products.length})
          </button>
        </div>

        {/* Tab 1: Al Aweer Stalls */}
        {activeTab === 'stalls' && (
          <section className={styles.tableSection}>
            <div className={styles.tableHeaderBar}>
              <div>
                <h3 className={styles.tableTitle}>Al Aweer Market Stalls</h3>
                <p className={styles.tableSubtitle}>
                  Approve or revoke wholesale vendor stalls to control visibility in the marketplace.
                </p>
              </div>
            </div>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Stall Name</th>
                    <th>Stall Number</th>
                    <th>Contact Phone</th>
                    <th>Approval Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {shops.length === 0 ? (
                    <tr>
                      <td colSpan={5} className={styles.emptyState}>
                        {isLoadingData ? 'Loading stalls...' : 'No stalls registered yet.'}
                      </td>
                    </tr>
                  ) : (
                    shops.map((shop) => (
                      <tr key={shop.id}>
                        <td>
                          <strong>{shop.name}</strong>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>/{shop.slug}</div>
                        </td>
                        <td>{shop.stallNumber || '—'}</td>
                        <td>{shop.phone || '—'}</td>
                        <td>
                          <span
                            className={`${styles.statusPill} ${
                              shop.isApproved ? styles.statusActive : styles.statusPending
                            }`}
                          >
                            {shop.isApproved ? 'Approved' : 'Pending Approval'}
                          </span>
                        </td>
                        <td>
                          <button
                            className={`${styles.actionBtn} ${
                              shop.isApproved ? styles.actionBtnRevoke : styles.actionBtnApprove
                            }`}
                            disabled={processingId === shop.id}
                            onClick={() => handleToggleShopApproval(shop)}
                          >
                            {processingId === shop.id
                              ? 'Updating...'
                              : shop.isApproved
                              ? 'Revoke Approval'
                              : 'Approve Stall'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Tab 2: User Governance */}
        {activeTab === 'users' && (
          <section className={styles.tableSection}>
            <div className={styles.tableHeaderBar}>
              <div>
                <h3 className={styles.tableTitle}>Platform Users</h3>
                <p className={styles.tableSubtitle}>
                  Manage user accounts across buyer, vendor admin, and super admin roles.
                </p>
              </div>
            </div>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={5} className={styles.emptyState}>
                        {isLoadingData ? 'Loading users...' : 'No users found.'}
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => {
                      const isSelf = user?.id === u.id;
                      return (
                        <tr key={u.id}>
                          <td>
                            <strong>{u.fullName}</strong>
                            {isSelf && (
                              <span style={{ marginLeft: 8, fontSize: '0.7rem', color: '#f87171' }}>
                                (You)
                              </span>
                            )}
                          </td>
                          <td>{u.email}</td>
                          <td>
                            <span style={{ textTransform: 'capitalize' }}>
                              {u.role.replace('_', ' ')}
                            </span>
                          </td>
                          <td>
                            <span
                              className={`${styles.statusPill} ${
                                u.isActive ? styles.statusActive : styles.statusInactive
                              }`}
                            >
                              {u.isActive ? 'Active' : 'Suspended'}
                            </span>
                          </td>
                          <td>
                            {isSelf ? (
                              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                Protected
                              </span>
                            ) : (
                              <button
                                className={`${styles.actionBtn} ${
                                  u.isActive ? styles.actionBtnRevoke : styles.actionBtnApprove
                                }`}
                                disabled={processingId === u.id}
                                onClick={() => handleToggleUserStatus(u)}
                              >
                                {processingId === u.id
                                  ? 'Updating...'
                                  : u.isActive
                                  ? 'Suspend Account'
                                  : 'Reactivate Account'}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Tab 3: Produce Moderation */}
        {activeTab === 'products' && (
          <section className={styles.tableSection}>
            <div className={styles.tableHeaderBar}>
              <div>
                <h3 className={styles.tableTitle}>Market Produce Catalog Moderation</h3>
                <p className={styles.tableSubtitle}>
                  Delist produce items violating quality, wholesale pricing standards, or safety compliance.
                </p>
              </div>
            </div>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Produce Name</th>
                    <th>Category</th>
                    <th>Origin Country</th>
                    <th>Lowest AED/kg</th>
                    <th>Active Offers</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {products.length === 0 ? (
                    <tr>
                      <td colSpan={6} className={styles.emptyState}>
                        {isLoadingData ? 'Loading produce catalog...' : 'No produce items found.'}
                      </td>
                    </tr>
                  ) : (
                    products.map((prod) => (
                      <tr key={prod.id}>
                        <td><strong>{prod.name}</strong></td>
                        <td>{prod.category}</td>
                        <td>{prod.originCountry}</td>
                        <td>
                          {prod.lowestPriceAedPerKg > 0
                            ? `AED ${prod.lowestPriceAedPerKg.toFixed(2)}/kg`
                            : '—'}
                        </td>
                        <td>{prod.offers?.length || 0} stall offers</td>
                        <td>
                          <button
                            className={`${styles.actionBtn} ${styles.actionBtnRevoke}`}
                            disabled={processingId === prod.id}
                            onClick={() => handleToggleProductModeration(prod)}
                          >
                            {processingId === prod.id ? 'Moderating...' : 'Delist Produce'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
