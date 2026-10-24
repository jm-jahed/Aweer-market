'use client';

import React, { useState, useEffect, useCallback, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useShopAdminAuth } from '../lib/auth-context';
import {
  updateVendorShop,
  getVendorProducts,
  createVendorProduct,
  updateVendorOffer,
  VendorProductItem
} from '../lib/api-client';
import { ProductCategory, WholesaleUnit } from '@aweermarket/types';
import styles from './Dashboard.module.css';

export default function ShopAdminDashboard() {
  const router = useRouter();
  const { user, shop, isLoading: authLoading, logout, refreshShop } = useShopAdminAuth();

  const [activeTab, setActiveTab] = useState<'profile' | 'inventory'>('inventory');

  // Stall Profile Edit Form
  const [stallName, setStallName] = useState('');
  const [stallNumber, setStallNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Vendor Produce Inventory State
  const [products, setProducts] = useState<VendorProductItem[]>([]);
  const [isLoadingInventory, setIsLoadingInventory] = useState(false);
  const [inventoryError, setInventoryError] = useState<string | null>(null);

  // Add Produce Modal Form
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [prodName, setProdName] = useState('');
  const [prodCategory, setProdCategory] = useState<ProductCategory>(ProductCategory.FRESH_FRUITS);
  const [prodOrigin, setProdOrigin] = useState('UAE');
  const [prodDescription, setProdDescription] = useState('');
  const [prodUnit, setProdUnit] = useState<WholesaleUnit>(WholesaleUnit.BOX);
  const [prodWeight, setProdWeight] = useState<number>(10);
  const [prodPrice, setProdPrice] = useState<number>(30);
  const [prodMoq, setProdMoq] = useState<number>(1);
  const [prodStock, setProdStock] = useState<number>(50);
  const [isSubmittingProd, setIsSubmittingProd] = useState(false);
  const [addModalError, setAddModalError] = useState<string | null>(null);

  // Edit Offer Modal
  const [editingItem, setEditingItem] = useState<VendorProductItem | null>(null);
  const [editPrice, setEditPrice] = useState<number>(0);
  const [editStock, setEditStock] = useState<number>(0);
  const [editMoq, setEditMoq] = useState<number>(1);
  const [isSavingOffer, setIsSavingOffer] = useState(false);
  const [editOfferError, setEditOfferError] = useState<string | null>(null);

  // Auth Guard
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  // Sync shop data into profile form
  useEffect(() => {
    if (shop) {
      setStallName(shop.name);
      setStallNumber(shop.stallNumber);
      setPhone(shop.phone);
    }
  }, [shop]);

  const loadInventory = useCallback(async () => {
    setIsLoadingInventory(true);
    setInventoryError(null);
    try {
      const res = await getVendorProducts();
      setProducts(res.products);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch inventory';
      setInventoryError(msg);
    } finally {
      setIsLoadingInventory(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      loadInventory();
    }
  }, [user, loadInventory]);

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setProfileSuccess(null);
    setProfileError(null);

    if (!stallName.trim() || !stallNumber.trim() || !phone.trim()) {
      setProfileError('Stall name, stall number, and phone number cannot be empty.');
      return;
    }

    setIsSavingProfile(true);
    try {
      const res = await updateVendorShop({
        name: stallName.trim(),
        stallNumber: stallNumber.trim(),
        phone: phone.trim()
      });
      await refreshShop();
      setProfileSuccess(res.message || 'Stall profile updated successfully.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update stall profile.';
      setProfileError(msg);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleAddProduce = async (e: FormEvent) => {
    e.preventDefault();
    setAddModalError(null);

    if (!prodName.trim() || prodWeight <= 0 || prodPrice <= 0 || prodStock < 0) {
      setAddModalError('Please ensure produce name, positive weight/price, and non-negative stock are set.');
      return;
    }

    setIsSubmittingProd(true);
    try {
      await createVendorProduct({
        name: prodName.trim(),
        category: prodCategory,
        originCountry: prodOrigin.trim(),
        description: prodDescription.trim(),
        offer: {
          unit: prodUnit,
          unitWeightKg: Number(prodWeight),
          priceAed: Number(prodPrice),
          minOrderQuantity: Number(prodMoq),
          availableStock: Number(prodStock)
        }
      });
      setIsAddModalOpen(false);
      setProdName('');
      await loadInventory();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create produce listing';
      setAddModalError(msg);
    } finally {
      setIsSubmittingProd(false);
    }
  };

  const openEditOfferModal = (item: VendorProductItem) => {
    setEditingItem(item);
    setEditPrice(item.offer?.priceAed || 0);
    setEditStock(item.offer?.availableStock || 0);
    setEditMoq(item.offer?.minOrderQuantity || 1);
    setEditOfferError(null);
  };

  const handleUpdateOffer = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setEditOfferError(null);

    if (editPrice <= 0 || editStock < 0) {
      setEditOfferError('Price must be positive and stock cannot be negative.');
      return;
    }

    setIsSavingOffer(true);
    try {
      await updateVendorOffer(editingItem.id, {
        priceAed: Number(editPrice),
        availableStock: Number(editStock),
        minOrderQuantity: Number(editMoq)
      });
      setEditingItem(null);
      await loadInventory();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update offer';
      setEditOfferError(msg);
    } finally {
      setIsSavingOffer(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  if (authLoading || (!user && !profileError)) {
    return (
      <div className={styles.loadingBanner}>
        Authenticating Al Aweer Stall Operations session...
      </div>
    );
  }

  const isApproved = shop?.isApproved ?? false;

  return (
    <div className={styles.container}>
      {/* Top Navigation */}
      <nav className={styles.navbar}>
        <div className={styles.brand}>
          <h1 className={styles.brandTitle}>AweerMarket — Stall Operations</h1>
          <span className={styles.brandBadge}>Port 3001</span>
        </div>
        <div className={styles.userNav}>
          <div className={styles.userInfo}>
            <p className={styles.userName}>{user?.fullName || 'Vendor Admin'}</p>
            <p className={styles.userEmail}>{user?.email}</p>
          </div>
          <button onClick={handleLogout} className={styles.logoutBtn} id="vendor-logout-btn">
            Sign Out
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className={styles.mainContent}>
        <header className={styles.pageHeader}>
          <h2 className={styles.pageTitle}>Stall Management Dashboard</h2>
          <p className={styles.pageDescription}>
            Manage your Al Aweer wholesale stall profile, contact credentials, and produce inventory.
          </p>
        </header>

        {/* Live Stall Status Card */}
        <section className={styles.statusCard}>
          <div className={styles.statusCardHeader}>
            <div>
              <h3 className={styles.stallHeading}>{shop?.name || user?.businessName || 'Your Wholesale Stall'}</h3>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                Marketplace Slug: /{shop?.slug || 'stall'}
              </span>
            </div>
            <div>
              {isApproved ? (
                <span className={`${styles.approvalBadge} ${styles.approvalApproved}`}>
                  ✓ Approved — Live on Marketplace
                </span>
              ) : (
                <span className={`${styles.approvalBadge} ${styles.approvalPending}`}>
                  ⏳ Pending Super Admin Approval
                </span>
              )}
            </div>
          </div>

          <div className={styles.detailsGrid}>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Al Aweer Stall Number</span>
              <span className={styles.detailValue}>{shop?.stallNumber || '—'}</span>
            </div>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Contact Phone</span>
              <span className={styles.detailValue}>{shop?.phone || '—'}</span>
            </div>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Active Produce Items</span>
              <span className={styles.detailValue}>{products.length} listed</span>
            </div>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Registered On</span>
              <span className={styles.detailValue}>
                {shop?.createdAt ? new Date(shop.createdAt).toLocaleDateString() : '—'}
              </span>
            </div>
          </div>
        </section>

        {/* Tab Navigation */}
        <div className={styles.tabsNav} role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === 'inventory'}
            className={`${styles.tabBtn} ${activeTab === 'inventory' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('inventory')}
          >
            Produce Catalog &amp; Inventory ({products.length})
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'profile'}
            className={`${styles.tabBtn} ${activeTab === 'profile' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            Stall Contact Profile
          </button>
        </div>

        {/* Tab 1: Produce Catalog & Inventory */}
        {activeTab === 'inventory' && (
          <section className={styles.tableSection}>
            <div className={styles.tableHeaderBar}>
              <div>
                <h3 className={styles.tableTitle}>Stall Produce Listings</h3>
                <p className={styles.tableSubtitle}>
                  View and manage your wholesale stock quantities, unit packagings, and AED pricing.
                </p>
              </div>
              <button
                className={styles.addBtn}
                onClick={() => setIsAddModalOpen(true)}
                id="add-produce-btn"
              >
                + List New Produce
              </button>
            </div>

            {inventoryError && (
              <div className={styles.errorBanner} role="alert" style={{ margin: '16px' }}>
                {inventoryError}
              </div>
            )}

            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Produce Item</th>
                    <th>Category</th>
                    <th>Unit &amp; Weight</th>
                    <th>Stall Price (AED)</th>
                    <th>Rate (AED/kg)</th>
                    <th>Available Stock</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {products.length === 0 ? (
                    <tr>
                      <td colSpan={7} className={styles.emptyState}>
                        {isLoadingInventory
                          ? 'Loading stall produce listings...'
                          : 'No produce listed yet. Click "+ List New Produce" to add your wholesale offers.'}
                      </td>
                    </tr>
                  ) : (
                    products.map((p) => {
                      const o = p.offer;
                      return (
                        <tr key={p.id}>
                          <td>
                            <strong>{p.name}</strong>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              Origin: {p.originCountry}
                            </div>
                          </td>
                          <td style={{ textTransform: 'capitalize' }}>
                            {p.category.replace('_', ' ')}
                          </td>
                          <td>
                            {o ? `${o.unitWeightKg} kg / ${o.unit}` : '—'}
                          </td>
                          <td>
                            <strong>AED {o ? o.priceAed.toFixed(2) : '—'}</strong>
                          </td>
                          <td>
                            {o ? `AED ${o.equivalentPricePerKg.toFixed(2)}/kg` : '—'}
                          </td>
                          <td>
                            <span
                              style={{
                                color: (o?.availableStock || 0) > 0 ? '#16a34a' : '#dc2626',
                                fontWeight: 600
                              }}
                            >
                              {o?.availableStock || 0} units
                            </span>
                          </td>
                          <td>
                            <button
                              className={styles.actionBtn}
                              onClick={() => openEditOfferModal(p)}
                            >
                              Update Price &amp; Stock
                            </button>
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

        {/* Tab 2: Stall Profile Editing Form */}
        {activeTab === 'profile' && (
          <section className={styles.sectionCard}>
            <h3 className={styles.sectionTitle}>Stall Profile Information</h3>
            <p className={styles.sectionSubtitle}>
              Update your public stall trade name, stall unit, and direct sales contact phone.
            </p>

            {profileSuccess && (
              <div className={styles.successBanner} role="status">
                {profileSuccess}
              </div>
            )}

            {profileError && (
              <div className={styles.errorBanner} role="alert">
                {profileError}
              </div>
            )}

            <form className={styles.editForm} onSubmit={handleSaveProfile}>
              <div className={styles.formGrid}>
                <div className={styles.fieldGroup}>
                  <label htmlFor="edit-stallname" className={styles.label}>
                    Stall / Shop Name
                  </label>
                  <input
                    id="edit-stallname"
                    type="text"
                    className={styles.input}
                    value={stallName}
                    onChange={(e) => setStallName(e.target.value)}
                    disabled={isSavingProfile}
                    required
                  />
                </div>

                <div className={styles.fieldGroup}>
                  <label htmlFor="edit-stallnumber" className={styles.label}>
                    Al Aweer Stall Number
                  </label>
                  <input
                    id="edit-stallnumber"
                    type="text"
                    className={styles.input}
                    value={stallNumber}
                    onChange={(e) => setStallNumber(e.target.value)}
                    disabled={isSavingProfile}
                    required
                  />
                </div>

                <div className={styles.fieldGroup}>
                  <label htmlFor="edit-phone" className={styles.label}>
                    Contact Phone Number
                  </label>
                  <input
                    id="edit-phone"
                    type="tel"
                    className={styles.input}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={isSavingProfile}
                    required
                  />
                </div>
              </div>

              <button type="submit" className={styles.saveBtn} disabled={isSavingProfile}>
                {isSavingProfile ? 'Saving Changes...' : 'Save Stall Details'}
              </button>
            </form>
          </section>
        )}

        {/* Multi-Tenant Notice */}
        <section style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px' }}>
          <h4 style={{ margin: '0 0 6px 0', fontSize: '0.95rem', color: '#334155' }}>
            Multi-Tenant Boundary &amp; Governance
          </h4>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', lineHeight: 1.5 }}>
            Each Al Aweer wholesale stall is strictly isolated. You have administrative access only to your own stall's
            products, pricing, and orders. Approval status is authoritatively verified by the Super Admin team.
          </p>
        </section>
      </main>

      {/* Modal: List New Produce Offer */}
      {isAddModalOpen && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>List New Produce Offer</h3>
              <button className={styles.closeBtn} onClick={() => setIsAddModalOpen(false)}>
                &times;
              </button>
            </div>

            {addModalError && (
              <div className={styles.errorBanner} role="alert">
                {addModalError}
              </div>
            )}

            <form className={styles.editForm} onSubmit={handleAddProduce}>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Produce Name *</label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="e.g. Valencia Oranges, Cavendish Bananas"
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                  required
                />
              </div>

              <div className={styles.formGrid}>
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Category *</label>
                  <select
                    className={styles.input}
                    value={prodCategory}
                    onChange={(e) => setProdCategory(e.target.value as ProductCategory)}
                  >
                    <option value={ProductCategory.FRESH_FRUITS}>Fresh Fruits</option>
                    <option value={ProductCategory.FRESH_VEGETABLES}>Fresh Vegetables</option>
                    <option value={ProductCategory.CITRUS}>Citrus Fruits</option>
                    <option value={ProductCategory.EXOTIC_PRODUCE}>Exotic / Tropical</option>
                    <option value={ProductCategory.LEAFY_GREENS}>Leafy Greens</option>
                    <option value={ProductCategory.ROOT_VEGETABLES}>Root Vegetables</option>
                    <option value={ProductCategory.BERRIES}>Berries &amp; Melons</option>
                  </select>
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Origin Country *</label>
                  <input
                    type="text"
                    className={styles.input}
                    placeholder="e.g. Egypt, UAE, India"
                    value={prodOrigin}
                    onChange={(e) => setProdOrigin(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className={styles.formGrid}>
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Packaging Unit *</label>
                  <select
                    className={styles.input}
                    value={prodUnit}
                    onChange={(e) => setProdUnit(e.target.value as WholesaleUnit)}
                  >
                    <option value={WholesaleUnit.BOX}>Box</option>
                    <option value={WholesaleUnit.CRATE}>Crate</option>
                    <option value={WholesaleUnit.CARTON}>Carton</option>
                    <option value={WholesaleUnit.SACK}>Sack</option>
                    <option value={WholesaleUnit.PALLET}>Pallet</option>
                    <option value={WholesaleUnit.KG}>Kilogram (kg)</option>
                  </select>
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Unit Weight (kg) *</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    className={styles.input}
                    value={prodWeight}
                    onChange={(e) => setProdWeight(Number(e.target.value))}
                    required
                  />
                </div>
              </div>

              <div className={styles.formGrid}>
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Wholesale Price (AED) *</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.1"
                    className={styles.input}
                    value={prodPrice}
                    onChange={(e) => setProdPrice(Number(e.target.value))}
                    required
                  />
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Available Stock *</label>
                  <input
                    type="number"
                    min="0"
                    className={styles.input}
                    value={prodStock}
                    onChange={(e) => setProdStock(Number(e.target.value))}
                    required
                  />
                </div>
              </div>

              {/* Normalized AED/kg preview */}
              <div style={{ backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', padding: '10px 14px', borderRadius: '8px', fontSize: '0.85rem', color: '#0369a1' }}>
                Normalized Market Price:{' '}
                <strong>
                  AED {(prodWeight > 0 ? (prodPrice / prodWeight).toFixed(2) : '0.00')} / kg
                </strong>
              </div>

              <button type="submit" className={styles.saveBtn} disabled={isSubmittingProd}>
                {isSubmittingProd ? 'Publishing Offer...' : 'Publish Produce Offer'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Quick Update Offer (Price & Stock) */}
      {editingItem && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Update Produce Offer</h3>
              <button className={styles.closeBtn} onClick={() => setEditingItem(null)}>
                &times;
              </button>
            </div>

            <p style={{ margin: '0 0 16px 0', fontSize: '0.9rem', color: '#64748b' }}>
              Updating wholesale pricing and active stock for <strong>{editingItem.name}</strong> (
              {editingItem.offer?.unitWeightKg} kg / {editingItem.offer?.unit})
            </p>

            {editOfferError && (
              <div className={styles.errorBanner} role="alert">
                {editOfferError}
              </div>
            )}

            <form className={styles.editForm} onSubmit={handleUpdateOffer}>
              <div className={styles.formGrid}>
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Price (AED) *</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.1"
                    className={styles.input}
                    value={editPrice}
                    onChange={(e) => setEditPrice(Number(e.target.value))}
                    required
                  />
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Available Stock *</label>
                  <input
                    type="number"
                    min="0"
                    className={styles.input}
                    value={editStock}
                    onChange={(e) => setEditStock(Number(e.target.value))}
                    required
                  />
                </div>
              </div>

              <div style={{ backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', padding: '10px 14px', borderRadius: '8px', fontSize: '0.85rem', color: '#0369a1' }}>
                Updated Rate:{' '}
                <strong>
                  AED{' '}
                  {editingItem.offer && editingItem.offer.unitWeightKg > 0
                    ? (editPrice / editingItem.offer.unitWeightKg).toFixed(2)
                    : '0.00'}{' '}
                  / kg
                </strong>
              </div>

              <button type="submit" className={styles.saveBtn} disabled={isSavingOffer}>
                {isSavingOffer ? 'Saving...' : 'Save Updated Offer'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
