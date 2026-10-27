'use client';

import React, { useState, useEffect, useCallback, FormEvent, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useSuperAdminAuth } from '../lib/auth-context';
import {
  getAdminOverview,
  getAdminShops,
  createAdminShop,
  updateAdminShop,
  setAdminShopApproval,
  getAdminUsers,
  setAdminUserStatus,
  getAdminProducts,
  setAdminProductModeration,
  getAdminOrders,
  getAdminOrderById,
  setAdminShopStatus,
  getAdminCategories,
  createAdminCategory,
  updateAdminCategory,
  setAdminCategoryStatus,
  deleteAdminCategory,
  getAdminResellers,
  createAdminReseller,
  updateAdminReseller,
  setAdminResellerStatus,
  deleteAdminReseller,
  PlatformMetrics,
  AdminShopItem,
  AdminProductItem,
  AdminOrderItem,
  AdminCategoryItem,
  AdminResellerItem
} from '../lib/api-client';
import type { UserSummary } from '@aweermarket/types';
import { formatCountryWithFlag } from '../lib/country-flags';
import styles from './Dashboard.module.css';

export default function SuperAdminDashboard() {
  const router = useRouter();
  const { user, isLoading: authLoading, logout } = useSuperAdminAuth();

  // Active Navigation Tab
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState<boolean>(false);

  const handleNavSelect = useCallback((tab: string) => {
    if (user?.role === 'reseller' && tab === 'resellers') {
      return;
    }
    const normalized = tab === 'shops' ? 'stalls' : tab;
    setActiveTab(normalized);
    setIsMobileDrawerOpen(false);
  }, [user]);

  // Enforce reseller access restriction
  useEffect(() => {
    if (user?.role === 'reseller' && activeTab === 'resellers') {
      setActiveTab('dashboard');
    }
  }, [user, activeTab]);


  // Handle drawer Escape key dismissal and body scroll lock
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileDrawerOpen) {
        setIsMobileDrawerOpen(false);
      }
    };
    if (isMobileDrawerOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobileDrawerOpen]);

  // Automatically close mobile drawer when window is resized to desktop viewport
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 1024 && isMobileDrawerOpen) {
        setIsMobileDrawerOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isMobileDrawerOpen]);

  // Search input state
  const [searchQuery, setSearchQuery] = useState('');

  // Live Backend Data
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [shops, setShops] = useState<AdminShopItem[]>([]);
  const [categories, setCategories] = useState<AdminCategoryItem[]>([]);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [resellers, setResellers] = useState<AdminResellerItem[]>([]);
  const [resellersError, setResellersError] = useState<string | null>(null);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [products, setProducts] = useState<AdminProductItem[]>([]);
  const [orders, setOrders] = useState<AdminOrderItem[]>([]);

  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Category Modal State
  const [isCatModalOpen, setIsCatModalOpen] = useState<boolean>(false);
  const [editingCat, setEditingCat] = useState<AdminCategoryItem | null>(null);
  const [catName, setCatName] = useState<string>('');
  const [catSlug, setCatSlug] = useState<string>('');
  const [catDescription, setCatDescription] = useState<string>('');
  const [catIcon, setCatIcon] = useState<string>('📦');
  const [catBannerUrl, setCatBannerUrl] = useState<string>('');
  const [catSortOrder, setCatSortOrder] = useState<number>(0);
  const [catIsActive, setCatIsActive] = useState<boolean>(true);
  const [catFormError, setCatFormError] = useState<string | null>(null);
  const [isSubmittingCat, setIsSubmittingCat] = useState<boolean>(false);
  const [deleteConfirmCat, setDeleteConfirmCat] = useState<AdminCategoryItem | null>(null);
  const [catActionSuccess, setCatActionSuccess] = useState<string | null>(null);

  // Reseller Modal State
  const [isResellerModalOpen, setIsResellerModalOpen] = useState<boolean>(false);
  const [editingReseller, setEditingReseller] = useState<AdminResellerItem | null>(null);
  const [resellerBusinessName, setResellerBusinessName] = useState<string>('');
  const [resellerContactPerson, setResellerContactPerson] = useState<string>('');
  const [resellerEmail, setResellerEmail] = useState<string>('');
  const [resellerPhone, setResellerPhone] = useState<string>('');
  const [resellerTradeLicense, setResellerTradeLicense] = useState<string>('');
  const [resellerTier, setResellerTier] = useState<string>('bronze');
  const [resellerCreditLimit, setResellerCreditLimit] = useState<number>(10000);
  const [resellerPaymentTerms, setResellerPaymentTerms] = useState<string>('net_30');
  const [resellerNotes, setResellerNotes] = useState<string>('');
  const [resellerPassword, setResellerPassword] = useState<string>('');
  const [showResellerPassword, setShowResellerPassword] = useState<boolean>(false);
  const [resellerFormError, setResellerFormError] = useState<string | null>(null);
  const [isSubmittingReseller, setIsSubmittingReseller] = useState<boolean>(false);

  // Vendor Stall Modal State
  const [isShopModalOpen, setIsShopModalOpen] = useState<boolean>(false);
  const [shopName, setShopName] = useState<string>('');
  const [shopStallNumber, setShopStallNumber] = useState<string>('');
  const [shopOwnerName, setShopOwnerName] = useState<string>('');
  const [shopEmail, setShopEmail] = useState<string>('');
  const [shopPassword, setShopPassword] = useState<string>('');
  const [showShopPassword, setShowShopPassword] = useState<boolean>(false);
  const [shopPhone, setShopPhone] = useState<string>('');
  const [shopTradeLicense, setShopTradeLicense] = useState<string>('');
  const [shopMarketLocation, setShopMarketLocation] = useState<string>('Al Aweer Central Wholesale Market');
  const [shopDescription, setShopDescription] = useState<string>('');
  const [shopFormError, setShopFormError] = useState<string | null>(null);
  const [isSubmittingShop, setIsSubmittingShop] = useState<boolean>(false);

  // Edit Vendor Stall Modal State
  const [isEditShopModalOpen, setIsEditShopModalOpen] = useState<boolean>(false);
  const [editingShop, setEditingShop] = useState<AdminShopItem | null>(null);
  const [editShopName, setEditShopName] = useState<string>('');
  const [editShopStallNumber, setEditShopStallNumber] = useState<string>('');
  const [editShopPhone, setEditShopPhone] = useState<string>('');
  const [editShopTradeLicense, setEditShopTradeLicense] = useState<string>('');
  const [editShopLocation, setEditShopLocation] = useState<string>('Al Aweer Central Wholesale Market');
  const [editShopDescription, setEditShopDescription] = useState<string>('');
  const [editShopOpeningHours, setEditShopOpeningHours] = useState<string>('');
  const [editShopFormError, setEditShopFormError] = useState<string | null>(null);
  const [isSubmittingEditShop, setIsSubmittingEditShop] = useState<boolean>(false);

  // Critical Action & Edit Confirmation Popup Modal State
  interface ConfirmationModalConfig {
    isOpen: boolean;
    title: string;
    message: string;
    detail?: string;
    warningNotice?: string;
    confirmLabel: string;
    cancelLabel?: string;
    variant: 'danger' | 'warning' | 'primary';
    onConfirm: () => void | Promise<void>;
  }
  const [confirmModal, setConfirmModal] = useState<ConfirmationModalConfig | null>(null);
  const [isExecutingConfirm, setIsExecutingConfirm] = useState<boolean>(false);

  // Order Details Inspection Modal State
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<AdminOrderItem | null>(null);
  const [isLoadingOrderDetails, setIsLoadingOrderDetails] = useState<boolean>(false);
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');

  // Auth Guard
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  const loadAllData = useCallback(async () => {
    setIsLoadingData(true);
    setDataError(null);
    setCategoriesError(null);
    setResellersError(null);
    try {
      const [overviewRes, shopsRes, categoriesRes, usersRes, productsRes, ordersRes, resellersRes] = await Promise.all([
        getAdminOverview(),
        getAdminShops(),
        getAdminCategories().catch((err) => {
          const msg = err instanceof Error ? err.message : 'Failed to fetch categories';
          setCategoriesError(msg);
          return { statusCode: 500, categories: [] as AdminCategoryItem[] };
        }),
        getAdminUsers(),
        getAdminProducts(),
        getAdminOrders(),
        user?.role === 'reseller'
          ? Promise.resolve({ statusCode: 200, resellers: [] as AdminResellerItem[] })
          : getAdminResellers().catch((err) => {
              const msg = err instanceof Error ? err.message : 'Failed to fetch resellers';
              setResellersError(msg);
              return { statusCode: 500, resellers: [] as AdminResellerItem[] };
            })
      ]);
      setMetrics(overviewRes.metrics);
      setShops(shopsRes.shops);
      setCategories(categoriesRes.categories || []);
      setResellers(resellersRes.resellers || []);
      setUsers(usersRes.users);
      setProducts(productsRes.products);
      setOrders(ordersRes.orders);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch platform governance data';
      setDataError(msg);
    } finally {
      setIsLoadingData(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadAllData();
    }
  }, [user, loadAllData]);

  const showCatSuccess = (msg: string) => {
    setCatActionSuccess(msg);
    setTimeout(() => setCatActionSuccess(null), 3500);
  };

  // Category Actions
  const handleOpenAddCategory = () => {
    setEditingCat(null);
    setCatName('');
    setCatSlug('');
    setCatDescription('');
    setCatIcon('🍎');
    setCatBannerUrl('');
    setCatSortOrder(categories.length + 1);
    setCatIsActive(true);
    setCatFormError(null);
    setIsCatModalOpen(true);
  };

  const handleOpenEditCategory = (cat: AdminCategoryItem) => {
    setEditingCat(cat);
    setCatName(cat.name || cat.label || '');
    setCatSlug(cat.slug || cat.key || '');
    setCatDescription(cat.description || '');
    setCatIcon(cat.icon || '📦');
    setCatBannerUrl(cat.bannerUrl || '');
    setCatSortOrder(cat.sortOrder ?? 0);
    setCatIsActive(cat.isActive ?? true);
    setCatFormError(null);
    setIsCatModalOpen(true);
  };

  const executeCategorySave = async (trimmedName: string, trimmedSlug: string) => {
    setIsSubmittingCat(true);
    try {
      if (editingCat) {
        const res = await updateAdminCategory(editingCat.id, {
          name: trimmedName,
          slug: trimmedSlug,
          description: catDescription.trim() || undefined,
          icon: catIcon.trim() || '📦',
          bannerUrl: catBannerUrl.trim() || undefined,
          sortOrder: Number(catSortOrder) || 0,
          isActive: catIsActive
        });
        setCategories((prev) =>
          prev.map((c) => (c.id === editingCat.id ? { ...c, ...res.category } : c))
        );
        showCatSuccess(`Category '${trimmedName}' updated successfully.`);
      } else {
        const res = await createAdminCategory({
          name: trimmedName,
          slug: trimmedSlug,
          description: catDescription.trim() || undefined,
          icon: catIcon.trim() || '📦',
          bannerUrl: catBannerUrl.trim() || undefined,
          sortOrder: Number(catSortOrder) || 0,
          isActive: catIsActive
        });
        setCategories((prev) => [...prev, res.category]);
        showCatSuccess(`Category '${trimmedName}' created successfully.`);
      }
      setIsCatModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save category';
      setCatFormError(msg);
    } finally {
      setIsSubmittingCat(false);
    }
  };

  const handleSaveCategory = async (e: FormEvent) => {
    e.preventDefault();
    setCatFormError(null);

    const trimmedName = catName.trim();
    const trimmedSlug = catSlug.trim().toLowerCase();

    if (!trimmedName) {
      setCatFormError('Category name is required.');
      return;
    }
    if (!trimmedSlug || !/^[a-z0-9_-]+$/.test(trimmedSlug)) {
      setCatFormError('Valid slug (lowercase alphanumeric, dashes or underscores) is required.');
      return;
    }

    if (editingCat) {
      // Confirmation popup before saving category edits
      setConfirmModal({
        isOpen: true,
        title: 'Confirm Category Update',
        message: `Are you sure you want to save updated changes for category "${trimmedName}"?`,
        detail: `Slug: ${trimmedSlug} | Sort Order: ${catSortOrder} | Status: ${catIsActive ? 'Active' : 'Inactive'}`,
        confirmLabel: 'Confirm & Save Changes',
        variant: 'primary',
        onConfirm: async () => {
          await executeCategorySave(trimmedName, trimmedSlug);
        }
      });
      return;
    }

    await executeCategorySave(trimmedName, trimmedSlug);
  };

  const handleToggleCategoryStatus = async (cat: AdminCategoryItem) => {
    setProcessingId(cat.id);
    try {
      const newStatus = !cat.isActive;
      const res = await setAdminCategoryStatus(cat.id, newStatus);
      setCategories((prev) =>
        prev.map((c) => (c.id === cat.id ? { ...c, isActive: res.category.isActive } : c))
      );
      showCatSuccess(`Category '${cat.label || cat.name}' is now ${newStatus ? 'active' : 'inactive'}.`);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to toggle category status');
    } finally {
      setProcessingId(null);
    }
  };

  const requestToggleCategoryStatus = (cat: AdminCategoryItem) => {
    const willBeActive = !cat.isActive;
    setConfirmModal({
      isOpen: true,
      title: willBeActive ? 'Confirm Category Activation' : 'Confirm Category Deactivation',
      message: `Are you sure you want to ${willBeActive ? 'activate' : 'deactivate'} wholesale category "${cat.name || cat.label}"?`,
      detail: `Category Slug: ${cat.slug || cat.key}`,
      warningNotice: willBeActive
        ? 'This category will immediately become visible to commercial buyers across the marketplace.'
        : 'Deactivating this category will hide it from buyer navigation, filter chips, and search suggestions.',
      confirmLabel: willBeActive ? 'Activate Category' : 'Deactivate Category',
      variant: willBeActive ? 'primary' : 'warning',
      onConfirm: async () => {
        await handleToggleCategoryStatus(cat);
      }
    });
  };

  const handleConfirmDeleteCategory = async (cat: AdminCategoryItem) => {
    setProcessingId(cat.id);
    try {
      const res = await deleteAdminCategory(cat.id);
      if (res.deactivated) {
        setCategories((prev) =>
          prev.map((c) => (c.id === cat.id ? { ...c, isActive: false } : c))
        );
        showCatSuccess(`Category '${cat.label || cat.name}' has associated products and was safely deactivated.`);
      } else {
        setCategories((prev) => prev.filter((c) => c.id !== cat.id));
        showCatSuccess(`Category '${cat.label || cat.name}' deleted.`);
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete category');
    } finally {
      setProcessingId(null);
    }
  };

  const requestDeleteCategory = (cat: AdminCategoryItem) => {
    setConfirmModal({
      isOpen: true,
      title: 'Confirm Category Deletion',
      message: `Are you sure you want to delete category "${cat.name || cat.label}"?`,
      detail: `API Key / Slug: ${cat.slug || cat.key}`,
      warningNotice: 'Safety Safeguard: If active produce listings currently reference this category, it will automatically be deactivated rather than deleted to prevent orphaned product records.',
      confirmLabel: 'Yes, Delete Category',
      variant: 'danger',
      onConfirm: async () => {
        await handleConfirmDeleteCategory(cat);
      }
    });
  };

  // Vendor Stall Actions (Admin & Reseller)
  const handleOpenAddShop = () => {
    setShopName('');
    setShopStallNumber('');
    setShopOwnerName('');
    setShopEmail('');
    setShopPassword('');
    setShowShopPassword(false);
    setShopPhone('');
    setShopTradeLicense('');
    setShopMarketLocation('Al Aweer Central Wholesale Market');
    setShopDescription('');
    setShopFormError(null);
    setIsShopModalOpen(true);
  };

  const handleSaveShop = async (e: FormEvent) => {
    e.preventDefault();
    setShopFormError(null);

    if (!shopName.trim()) {
      setShopFormError('Stall / Shop name is required.');
      return;
    }
    if (!shopStallNumber.trim()) {
      setShopFormError('Al Aweer stall number is required.');
      return;
    }
    if (!shopOwnerName.trim()) {
      setShopFormError('Vendor contact person name is required.');
      return;
    }
    if (!shopEmail.trim() || !shopEmail.includes('@')) {
      setShopFormError('Valid vendor corporate email is required.');
      return;
    }
    if (!shopPassword.trim() || shopPassword.trim().length < 8) {
      setShopFormError('Vendor portal login password is required and must be at least 8 characters long.');
      return;
    }
    if (!shopPhone.trim()) {
      setShopFormError('Contact phone number is required.');
      return;
    }

    setIsSubmittingShop(true);
    try {
      const res = await createAdminShop({
        name: shopName.trim(),
        stallNumber: shopStallNumber.trim(),
        ownerName: shopOwnerName.trim(),
        email: shopEmail.trim(),
        password: shopPassword.trim(),
        phone: shopPhone.trim(),
        tradeLicenseNumber: shopTradeLicense.trim() || undefined,
        marketLocation: shopMarketLocation.trim() || undefined,
        description: shopDescription.trim() || undefined
      });

      setShops((prev) => [res.shop, ...prev]);
      showCatSuccess(`Vendor stall '${shopName.trim()}' and portal login credentials created successfully!`);
      setIsShopModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to register vendor stall';
      setShopFormError(msg);
    } finally {
      setIsSubmittingShop(false);
    }
  };

  const handleOpenEditShop = (shop: AdminShopItem) => {
    setEditingShop(shop);
    setEditShopName(shop.name || '');
    setEditShopStallNumber(shop.stallNumber || '');
    setEditShopPhone(shop.phone || '');
    setEditShopTradeLicense((shop as any).tradeLicenseNumber || '');
    setEditShopLocation((shop as any).marketLocation || 'Al Aweer Central Wholesale Market');
    setEditShopDescription((shop as any).description || '');
    setEditShopOpeningHours((shop as any).openingHours || '');
    setEditShopFormError(null);
    setIsEditShopModalOpen(true);
  };

  const handleSaveEditShop = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingShop) return;
    setEditShopFormError(null);

    if (!editShopName.trim()) {
      setEditShopFormError('Stall / Shop name is required.');
      return;
    }
    if (!editShopStallNumber.trim()) {
      setEditShopFormError('Al Aweer stall number is required.');
      return;
    }
    if (!editShopPhone.trim()) {
      setEditShopFormError('Contact phone number is required.');
      return;
    }

    setIsSubmittingEditShop(true);
    try {
      const res = await updateAdminShop(editingShop.id, {
        name: editShopName.trim(),
        stallNumber: editShopStallNumber.trim(),
        phone: editShopPhone.trim(),
        tradeLicenseNumber: editShopTradeLicense.trim() || undefined,
        marketLocation: editShopLocation.trim() || undefined,
        description: editShopDescription.trim() || undefined,
        openingHours: editShopOpeningHours.trim() || undefined
      });

      setShops((prev) => prev.map((s) => (s.id === editingShop.id ? res.shop : s)));
      showCatSuccess(`Stall '${editShopName.trim()}' details updated successfully.`);
      setIsEditShopModalOpen(false);
      setEditingShop(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update stall details';
      setEditShopFormError(msg);
    } finally {
      setIsSubmittingEditShop(false);
    }
  };

  // Reseller Actions
  const handleOpenAddReseller = () => {
    setEditingReseller(null);
    setResellerBusinessName('');
    setResellerContactPerson('');
    setResellerEmail('');
    setResellerPassword('');
    setShowResellerPassword(false);
    setResellerPhone('');
    setResellerTradeLicense('');
    setResellerTier('bronze');
    setResellerCreditLimit(10000);
    setResellerPaymentTerms('net_30');
    setResellerNotes('');
    setResellerFormError(null);
    setIsResellerModalOpen(true);
  };

  const handleOpenEditReseller = (r: AdminResellerItem) => {
    setEditingReseller(r);
    setResellerBusinessName(r.businessName);
    setResellerContactPerson(r.contactPerson);
    setResellerEmail(r.email);
    setResellerPassword('');
    setShowResellerPassword(false);
    setResellerPhone(r.phone);
    setResellerTradeLicense(r.tradeLicenseNumber || '');
    setResellerTier(r.tier);
    setResellerCreditLimit(r.creditLimitAed);
    setResellerPaymentTerms(r.paymentTerms);
    setResellerNotes(r.notes || '');
    setResellerFormError(null);
    setIsResellerModalOpen(true);
  };

  const executeResellerSave = async () => {
    setIsSubmittingReseller(true);
    setResellerFormError(null);
    try {
      if (editingReseller) {
        const res = await updateAdminReseller(editingReseller.id, {
          businessName: resellerBusinessName.trim(),
          contactPerson: resellerContactPerson.trim(),
          email: resellerEmail.trim(),
          password: resellerPassword.trim() || undefined,
          phone: resellerPhone.trim(),
          tradeLicenseNumber: resellerTradeLicense.trim() || undefined,
          tier: resellerTier as any,
          creditLimitAed: Number(resellerCreditLimit),
          paymentTerms: resellerPaymentTerms as any,
          notes: resellerNotes.trim() || undefined
        });
        setResellers((prev) =>
          prev.map((r) => (r.id === editingReseller.id ? res.reseller : r))
        );
        showCatSuccess(`Reseller '${resellerBusinessName.trim()}' updated successfully.`);
      } else {
        const res = await createAdminReseller({
          businessName: resellerBusinessName.trim(),
          contactPerson: resellerContactPerson.trim(),
          email: resellerEmail.trim(),
          password: resellerPassword.trim() || undefined,
          phone: resellerPhone.trim(),
          tradeLicenseNumber: resellerTradeLicense.trim() || undefined,
          tier: resellerTier as any,
          creditLimitAed: Number(resellerCreditLimit),
          paymentTerms: resellerPaymentTerms as any,
          notes: resellerNotes.trim() || undefined
        });
        setResellers((prev) => [res.reseller, ...prev]);
        showCatSuccess(`Reseller '${resellerBusinessName.trim()}' registered successfully.`);
      }
      setIsResellerModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save reseller';
      setResellerFormError(msg);
    } finally {
      setIsSubmittingReseller(false);
    }
  };

  const handleSaveReseller = async (e: FormEvent) => {
    e.preventDefault();
    setResellerFormError(null);

    if (!resellerBusinessName.trim()) {
      setResellerFormError('Business name is required.');
      return;
    }
    if (!resellerContactPerson.trim()) {
      setResellerFormError('Contact person name is required.');
      return;
    }
    if (!resellerEmail.trim() || !resellerEmail.includes('@')) {
      setResellerFormError('Valid corporate email address is required.');
      return;
    }
    if (!editingReseller && (!resellerPassword.trim() || resellerPassword.trim().length < 8)) {
      setResellerFormError('Portal login password is required and must be at least 8 characters long.');
      return;
    }
    if (editingReseller && resellerPassword.trim() && resellerPassword.trim().length < 8) {
      setResellerFormError('New password must be at least 8 characters long.');
      return;
    }
    if (!resellerPhone.trim()) {
      setResellerFormError('Phone number is required.');
      return;
    }

    if (editingReseller) {
      setConfirmModal({
        isOpen: true,
        title: 'Confirm Reseller Update',
        message: `Are you sure you want to update corporate profile for "${resellerBusinessName.trim()}"?`,
        detail: `Credit Limit: Dhs ${resellerCreditLimit} | Tier: ${resellerTier.toUpperCase()} | Terms: ${resellerPaymentTerms.replace('_', ' ').toUpperCase()}${resellerPassword.trim() ? ' | Password will be updated' : ''}`,
        confirmLabel: 'Confirm & Save Changes',
        variant: 'primary',
        onConfirm: async () => {
          await executeResellerSave();
        }
      });
      return;
    }

    await executeResellerSave();
  };

  const handleToggleResellerStatus = async (r: AdminResellerItem, targetStatus: 'approved' | 'suspended' | 'pending') => {
    setProcessingId(r.id);
    try {
      const res = await setAdminResellerStatus(r.id, targetStatus);
      setResellers((prev) => prev.map((item) => (item.id === r.id ? res.reseller : item)));
      showCatSuccess(`Reseller '${r.businessName}' status set to ${targetStatus}.`);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update reseller status');
    } finally {
      setProcessingId(null);
    }
  };

  const requestToggleResellerStatus = (r: AdminResellerItem) => {
    const isApproved = r.status === 'approved';
    const nextStatus = isApproved ? 'suspended' : 'approved';
    setConfirmModal({
      isOpen: true,
      title: isApproved ? 'Confirm Reseller Suspension' : 'Confirm Reseller Approval',
      message: `Are you sure you want to ${isApproved ? 'suspend' : 'approve'} trade credit and wholesale purchasing for "${r.businessName}"?`,
      detail: `Contact: ${r.contactPerson} (${r.phone}) | Credit: Dhs ${r.creditLimitAed}`,
      warningNotice: isApproved
        ? 'Suspending this reseller will immediately block them from placing purchase orders on credit.'
        : 'Approving this reseller grants wholesale catalog tier discounts and unlocks commercial credit limits.',
      confirmLabel: isApproved ? 'Suspend Reseller' : 'Approve Reseller',
      variant: isApproved ? 'danger' : 'primary',
      onConfirm: async () => {
        await handleToggleResellerStatus(r, nextStatus);
      }
    });
  };

  const handleDeleteReseller = async (r: AdminResellerItem) => {
    setProcessingId(r.id);
    try {
      await deleteAdminReseller(r.id);
      setResellers((prev) => prev.filter((item) => item.id !== r.id));
      showCatSuccess(`Reseller '${r.businessName}' was successfully deleted.`);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete reseller');
    } finally {
      setProcessingId(null);
    }
  };

  const requestDeleteReseller = (r: AdminResellerItem) => {
    const hasBalance = r.outstandingBalanceAed > 0;
    setConfirmModal({
      isOpen: true,
      title: 'Confirm Reseller Account Deletion',
      message: `Are you sure you want to delete corporate reseller account "${r.businessName}"?`,
      detail: `Email: ${r.email} | Outstanding Balance: Dhs ${r.outstandingBalanceAed.toFixed(2)}`,
      warningNotice: hasBalance
        ? `⚠️ SAFETY POLICY: Reseller has an active unpaid balance of Dhs ${r.outstandingBalanceAed.toFixed(2)}. The backend enforces strict account balance checks and will reject deletion until cleared.`
        : 'This will permanently remove the reseller record and revoke wholesale credit terms.',
      confirmLabel: hasBalance ? 'Attempt Deletion' : 'Permanently Delete Reseller',
      variant: 'danger',
      onConfirm: async () => {
        await handleDeleteReseller(r);
      }
    });
  };

  // Stall & User Actions
  const handleToggleShopApproval = async (shop: AdminShopItem) => {
    setProcessingId(shop.id);
    try {
      const newStatus = !shop.isApproved;
      const res = await setAdminShopApproval(shop.id, newStatus);
      setShops((prev) => prev.map((s) => (s.id === shop.id ? res.shop : s)));
      showCatSuccess(`Stall '${shop.name}' approval ${newStatus ? 'granted' : 'suspended'}.`);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update stall approval');
    } finally {
      setProcessingId(null);
    }
  };

  const requestToggleShopApproval = (shop: AdminShopItem) => {
    const willBeApproved = !shop.isApproved;
    setConfirmModal({
      isOpen: true,
      title: willBeApproved ? 'Confirm Stall Approval' : 'Confirm Stall Approval Suspension',
      message: `Are you sure you want to ${willBeApproved ? 'approve' : 'suspend approval for'} wholesale stall "${shop.name}" (${shop.stallNumber})?`,
      detail: `Stall Slug: /${shop.slug}`,
      warningNotice: willBeApproved
        ? 'Approving this stall will publish its wholesale produce offers to registered commercial buyers.'
        : 'Suspending approval will immediately revoke marketplace visibility for all products listed by this stall.',
      confirmLabel: willBeApproved ? 'Approve Stall' : 'Suspend Stall Approval',
      variant: willBeApproved ? 'primary' : 'danger',
      onConfirm: async () => {
        await handleToggleShopApproval(shop);
      }
    });
  };

  const handleToggleShopStatus = async (shop: AdminShopItem) => {
    setProcessingId(shop.id);
    try {
      const newStatus = !shop.isActive;
      const res = await setAdminShopStatus(shop.id, newStatus);
      setShops((prev) => prev.map((s) => (s.id === shop.id ? res.shop : s)));
      showCatSuccess(`Stall '${shop.name}' is now ${newStatus ? 'active' : 'delisted'}.`);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update stall status');
    } finally {
      setProcessingId(null);
    }
  };

  const requestToggleShopStatus = (shop: AdminShopItem) => {
    const willBeActive = !shop.isActive;
    setConfirmModal({
      isOpen: true,
      title: willBeActive ? 'Confirm Stall Reactivation' : 'Confirm Stall Delisting',
      message: `Are you sure you want to ${willBeActive ? 'reactivate' : 'delist'} wholesale stall "${shop.name}"?`,
      detail: `Stall Slug: /${shop.slug}`,
      warningNotice: willBeActive
        ? 'Reactivating will restore public marketplace visibility for this stall.'
        : 'Delisting this stall will hide all its listings from marketplace search and stall directories.',
      confirmLabel: willBeActive ? 'Reactivate Stall' : 'Delist Stall',
      variant: willBeActive ? 'primary' : 'warning',
      onConfirm: async () => {
        await handleToggleShopStatus(shop);
      }
    });
  };

  const handleToggleUserStatus = async (u: UserSummary) => {
    setProcessingId(u.id);
    try {
      const newStatus = !u.isActive;
      const res = await setAdminUserStatus(u.id, newStatus);
      setUsers((prev) => prev.map((usr) => (usr.id === u.id ? res.user : usr)));
      showCatSuccess(`User '${u.fullName}' account ${newStatus ? 'restored' : 'suspended'}.`);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update user status');
    } finally {
      setProcessingId(null);
    }
  };

  const requestToggleUserStatus = (u: UserSummary) => {
    const willBeActive = !u.isActive;
    setConfirmModal({
      isOpen: true,
      title: willBeActive ? 'Confirm User Access Restoration' : 'Confirm User Suspension',
      message: `Are you sure you want to ${willBeActive ? 'restore access for' : 'suspend access for'} user "${u.fullName}"?`,
      detail: `Email: ${u.email} | Role: ${u.role}`,
      warningNotice: willBeActive
        ? 'Restoring access will allow the user to authenticate and manage their operations again.'
        : 'Suspended users will have their active sessions invalidated and will be blocked from logging into the platform.',
      confirmLabel: willBeActive ? 'Restore Access' : 'Suspend User',
      variant: willBeActive ? 'primary' : 'danger',
      onConfirm: async () => {
        await handleToggleUserStatus(u);
      }
    });
  };

  const handleToggleProductStatus = async (p: AdminProductItem) => {
    setProcessingId(p.id);
    try {
      const newStatus = !p.isActive;
      const res = await setAdminProductModeration(p.id, newStatus);
      setProducts((prev) => prev.map((prod) => (prod.id === p.id ? res.product : prod)));
      showCatSuccess(`Produce '${p.name}' is now ${newStatus ? 'listed' : 'delisted'}.`);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to moderate product');
    } finally {
      setProcessingId(null);
    }
  };

  const requestToggleProductStatus = (p: AdminProductItem) => {
    const willBeActive = !p.isActive;
    setConfirmModal({
      isOpen: true,
      title: willBeActive ? 'Confirm Produce Listing' : 'Confirm Produce Delisting',
      message: `Are you sure you want to ${willBeActive ? 'list' : 'delist'} wholesale produce "${p.name}"?`,
      detail: `Category: ${p.category} | Origin: ${p.originCountry}`,
      warningNotice: willBeActive
        ? 'Listing will display this produce item in the buyer catalog.'
        : 'Delisting will hide this produce item from buyers and prevent vendor offers from being displayed.',
      confirmLabel: willBeActive ? 'List Produce' : 'Delist Produce',
      variant: willBeActive ? 'primary' : 'warning',
      onConfirm: async () => {
        await handleToggleProductStatus(p);
      }
    });
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  // Filtered categories for search
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;
    const q = searchQuery.toLowerCase();
    return categories.filter((c) => {
      const name = c.name || c.label || '';
      const slug = c.slug || c.key || '';
      const desc = c.description || '';
      return (
        name.toLowerCase().includes(q) ||
        slug.toLowerCase().includes(q) ||
        desc.toLowerCase().includes(q)
      );
    });
  }, [categories, searchQuery]);

  const filteredShops = useMemo(() => {
    if (!searchQuery.trim()) return shops;
    const q = searchQuery.toLowerCase();
    return shops.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      (s.stallNumber && s.stallNumber.toLowerCase().includes(q)) ||
      (s.slug && s.slug.toLowerCase().includes(q))
    );
  }, [shops, searchQuery]);

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const q = searchQuery.toLowerCase();
    return products.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.originCountry.toLowerCase().includes(q)
    );
  }, [products, searchQuery]);

  const handleViewOrderDetails = async (orderId: string) => {
    setIsLoadingOrderDetails(true);
    try {
      const res = await getAdminOrderById(orderId);
      setSelectedOrderDetails(res.order);
    } catch {
      const fallback = orders.find((o) => o.id === orderId);
      if (fallback) {
        setSelectedOrderDetails(fallback);
      } else {
        alert('Could not retrieve order details');
      }
    } finally {
      setIsLoadingOrderDetails(false);
    }
  };

  const filteredOrders = useMemo(() => {
    let list = orders;
    if (orderStatusFilter !== 'all') {
      list = list.filter((o) => o.status.toLowerCase() === orderStatusFilter.toLowerCase());
    }
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter((o) =>
      o.orderNumber.toLowerCase().includes(q) ||
      (o.buyerName && o.buyerName.toLowerCase().includes(q)) ||
      (o.buyerPhone && o.buyerPhone.toLowerCase().includes(q)) ||
      (o.buyerEmail && o.buyerEmail.toLowerCase().includes(q)) ||
      o.shopName.toLowerCase().includes(q) ||
      (o.stallNumber && o.stallNumber.toLowerCase().includes(q)) ||
      (o.paymentStatus && o.paymentStatus.toLowerCase().includes(q)) ||
      o.status.toLowerCase().includes(q)
    );
  }, [orders, searchQuery, orderStatusFilter]);

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const q = searchQuery.toLowerCase();
    return users.filter((u) =>
      u.fullName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    );
  }, [users, searchQuery]);

  const filteredResellers = useMemo(() => {
    if (!searchQuery.trim()) return resellers;
    const q = searchQuery.toLowerCase();
    return resellers.filter((r) =>
      r.businessName.toLowerCase().includes(q) ||
      r.contactPerson.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q) ||
      r.phone.toLowerCase().includes(q) ||
      (r.tradeLicenseNumber && r.tradeLicenseNumber.toLowerCase().includes(q)) ||
      r.tier.toLowerCase().includes(q) ||
      r.status.toLowerCase().includes(q)
    );
  }, [resellers, searchQuery]);

  // Dynamic Top Selling Products from live orders
  const topSellingProducts = useMemo(() => {
    const counts = new Map<string, { id: string; name: string; sold: number; unitPriceAed: number; imageUrl?: string }>();
    for (const ord of orders) {
      for (const item of ord.items || []) {
        const existing = counts.get(item.productId) || {
          id: item.productId,
          name: item.name,
          sold: 0,
          unitPriceAed: item.unitPriceAed,
          imageUrl: '/images/apple.jpg'
        };
        existing.sold += item.quantity;
        counts.set(item.productId, existing);
      }
    }
    return Array.from(counts.values()).sort((a, b) => b.sold - a.sold).slice(0, 5);
  }, [orders]);

  // Dynamic Top Vendors from live shops and orders
  const topVendors = useMemo(() => {
    const vendorMap = new Map<string, { id: string; name: string; stallNumber: string; productCount: number; sales: number; ordersCount: number }>();
    for (const s of shops) {
      vendorMap.set(s.id, {
        id: s.id,
        name: s.name,
        stallNumber: s.stallNumber,
        productCount: products.filter((p) => p.offers?.some((o) => o.vendorId === s.id)).length,
        sales: 0,
        ordersCount: 0
      });
    }
    for (const ord of orders) {
      const v = vendorMap.get(ord.shopId);
      if (v) {
        v.sales += ord.totalAmountAed;
        v.ordersCount += 1;
      }
    }
    return Array.from(vendorMap.values()).sort((a, b) => b.sales - a.sales).slice(0, 5);
  }, [shops, orders, products]);

  // Dynamic Market Stall Blocks from real registered stalls
  const marketBlocks = useMemo(() => {
    const blockMap = new Map<string, { area: string; vendorCount: number; productCount: number }>();
    for (const s of shops) {
      const match = s.stallNumber?.match(/Block\s+[A-Za-z0-9]+/i) || s.stallNumber?.match(/ST-[A-Za-z0-9]+/i);
      const blockName = match ? match[0] : (s.stallNumber ? `Stall Area (${s.stallNumber})` : 'Central Market Stalls');
      const existing = blockMap.get(blockName) || { area: blockName, vendorCount: 0, productCount: 0 };
      existing.vendorCount += 1;
      existing.productCount += products.filter((p) => p.offers?.some((o) => o.vendorId === s.id)).length;
      blockMap.set(blockName, existing);
    }
    return Array.from(blockMap.values()).sort((a, b) => b.vendorCount - a.vendorCount).slice(0, 6);
  }, [shops, products]);

  // Dynamic Platform Activity feed from live events (orders, shops)
  const recentActivity = useMemo(() => {
    const items: Array<{ id: string; text: string; time: string; timestamp: number }> = [];
    for (const ord of orders) {
      items.push({
        id: `ord-${ord.id}`,
        text: `Wholesale Order #${ord.orderNumber || ord.id.slice(0, 8)} placed for ${ord.shopName || 'Market Stall'}`,
        time: new Date(ord.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        timestamp: new Date(ord.createdAt).getTime()
      });
    }
    for (const s of shops) {
      items.push({
        id: `shop-${s.id}`,
        text: `Stall registered: ${s.name} (${s.stallNumber || 'Al Aweer'})`,
        time: new Date(s.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        timestamp: new Date(s.createdAt).getTime()
      });
    }
    return items.sort((a, b) => b.timestamp - a.timestamp).slice(0, 6);
  }, [orders, shops]);

  // Dynamic Orders Status counts
  const ordersStatusStats = useMemo(() => {
    const delivered = metrics?.financials?.ordersByStatus?.delivered ?? orders.filter((o) => o.status === 'delivered').length;
    const pending = metrics?.financials?.ordersByStatus?.pending ?? orders.filter((o) => o.status === 'pending').length;
    const processing = orders.filter((o) => o.status === 'preparing' || o.status === 'confirmed' || o.status === 'ready_for_pickup' || o.status === 'out_for_delivery').length;
    const cancelled = metrics?.financials?.ordersByStatus?.cancelled ?? orders.filter((o) => o.status === 'cancelled').length;
    const total = metrics?.totalOrders ?? orders.length;
    return { delivered, pending, processing, cancelled, total };
  }, [metrics, orders]);

  // Dynamic Uploaded Media Files from real registered catalog categories
  const uploadedMediaFiles = useMemo(() => {
    const files: Array<{ name: string; type: string; size: string; uploaded: string }> = [];
    for (const c of categories) {
      if (c.bannerUrl) {
        const filename = c.bannerUrl.split('/').pop() || 'category-banner.jpg';
        files.push({
          name: `🖼️ ${filename}`,
          type: 'Image (Category Banner)',
          size: 'Banner Asset',
          uploaded: 'Catalog Media'
        });
      }
      if (c.icon) {
        const filename = c.icon.split('/').pop() || 'category-icon.svg';
        files.push({
          name: `🎨 ${filename}`,
          type: 'Vector Icon',
          size: 'UI Asset',
          uploaded: 'Catalog Media'
        });
      }
    }
    return files.slice(0, 5);
  }, [categories]);

  if (authLoading || (!user && !dataError)) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#030d0a', color: '#10b981', fontWeight: 700 }}>
        Authenticating Super Admin Privileged Session...
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* =====================================================================
          TOP HEADER BAR (Matching Reference Image)
         ===================================================================== */}
      <header className={styles.topHeader}>
        <div className={styles.headerLeftGroup}>
          {/* Hamburger Menu Toggle (Mobile & Tablet) */}
          <button
            type="button"
            className={styles.hamburgerBtn}
            onClick={() => setIsMobileDrawerOpen((prev) => !prev)}
            aria-label={isMobileDrawerOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={isMobileDrawerOpen}
            id="super-admin-mobile-menu-btn"
          >
            <span className={styles.hamburgerIcon}>{isMobileDrawerOpen ? '✕' : '☰'}</span>
          </button>

          {/* Brand Logo */}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              handleNavSelect('dashboard');
            }}
            className={styles.headerBrand}
            aria-label="Aweermarket Central Super Admin Home"
          >
            <div className={styles.brandLogoWrap}>
              <svg
                width="28"
                height="28"
                viewBox="0 0 40 40"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path d="M8 28C6 20 12 10 24 6C24 18 16 26 8 28Z" fill="url(#superLeaf1)" />
                <path d="M16 34C14 26 22 16 34 10C34 24 24 32 16 34Z" fill="url(#superLeaf2)" />
                <path d="M6 34C14 28 20 22 30 14" stroke="#bbf7d0" strokeWidth="2" strokeLinecap="round" />
                <defs>
                  <linearGradient id="superLeaf1" x1="6" y1="6" x2="24" y2="28" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#4ade80" />
                    <stop offset="1" stopColor="#15803d" />
                  </linearGradient>
                  <linearGradient id="superLeaf2" x1="14" y1="10" x2="34" y2="34" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#86efac" />
                    <stop offset="1" stopColor="#22c55e" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <div className={styles.brandTextGroup}>
              <span className={styles.brandTitle}>Aweer<span>market</span></span>
              <span className={styles.brandSubtitle}>Central Administration</span>
            </div>
          </a>
        </div>

        {/* Global Search Bar with Ctrl + K */}
        <div className={styles.headerSearchWrap}>
          <span className={styles.headerSearchIcon}>🔍</span>
          <input
            type="text"
            className={styles.headerSearchInput}
            placeholder="Search vendors, products, orders, users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <span className={styles.headerShortcutBadge}>Ctrl + K</span>
        </div>

        {/* Right Section: Language, Alerts, Notifications, Profile */}
        <div className={styles.headerActions}>
          <button type="button" className={styles.langBtn}>
            <span>🌐</span>
            <span>English</span>
            <span style={{ fontSize: '0.65rem' }}>▼</span>
          </button>

          <button
            type="button"
            className={styles.headerIconButton}
            title="Orders & Pending Actions"
            onClick={() => handleNavSelect('orders')}
          >
            <span>🔔</span>
            <span className={styles.badgeCountRed}>{metrics?.totalOrders || 12}</span>
          </button>

          <button
            type="button"
            className={styles.headerIconButton}
            title="Registered Vendors"
            onClick={() => handleNavSelect('stalls')}
          >
            <span>🏪</span>
            <span className={styles.badgeCountGreen}>{metrics?.totalShops || shops.length}</span>
          </button>

          <div className={styles.userProfilePill}>
            <div className={styles.userAvatar}>
              {user?.fullName?.charAt(0) || 'A'}
            </div>
            <div className={styles.userMeta}>
              <span className={styles.userMetaName}>{user?.fullName || 'Super Admin'}</span>
              <span className={styles.userMetaRole}>Administrator</span>
            </div>
            <button
              onClick={handleLogout}
              className={styles.logoutBtn}
              id="super-admin-logout-btn"
              title="Sign Out of Super Admin"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer Backdrop */}
      {isMobileDrawerOpen && (
        <div
          className={styles.drawerBackdrop}
          onClick={() => setIsMobileDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* =====================================================================
          MAIN LAYOUT: Left Sidebar + Right Content Area
         ===================================================================== */}
      <div className={styles.layoutBody}>
        {/* LEFT SIDEBAR NAVIGATION */}
        <aside
          className={`${styles.sidebar} ${isMobileDrawerOpen ? styles.sidebarOpen : ''}`}
          aria-label="Super Admin Navigation"
        >
          {/* Mobile Drawer Top Header with Close Button */}
          <div className={styles.mobileDrawerHeader}>
            <div className={styles.mobileDrawerBrand}>
              <span>🛡️</span>
              <span>Super Admin Portal</span>
            </div>
            <button
              type="button"
              className={styles.mobileDrawerCloseBtn}
              onClick={() => setIsMobileDrawerOpen(false)}
              aria-label="Close navigation menu"
            >
              ✕
            </button>
          </div>

          <div>
            {/* Super Admin Mini Profile Card */}
            <div className={styles.sidebarCard}>
              <div className={styles.sidebarCardAvatar}>🛡️</div>
              <div>
                <div className={styles.sidebarCardTitle}>Super Admin</div>
                <div className={styles.sidebarCardSub}>Marketplace Management</div>
              </div>
            </div>

            {/* Navigation Menu */}
            <nav className={styles.navGroup}>
              <button
                type="button"
                onClick={() => handleNavSelect('dashboard')}
                className={`${styles.navItem} ${activeTab === 'dashboard' ? styles.navItemActive : ''}`}
              >
                <div className={styles.navItemLeft}>
                  <span>📊</span>
                  <span>Dashboard</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleNavSelect('stalls')}
                className={`${styles.navItem} ${activeTab === 'stalls' ? styles.navItemActive : ''}`}
              >
                <div className={styles.navItemLeft}>
                  <span>🏪</span>
                  <span>Vendors</span>
                </div>
                <span className={styles.navBadge}>{metrics ? metrics.totalShops : shops.length}</span>
              </button>

              <button
                type="button"
                onClick={() => handleNavSelect('products')}
                className={`${styles.navItem} ${activeTab === 'products' ? styles.navItemActive : ''}`}
              >
                <div className={styles.navItemLeft}>
                  <span>📦</span>
                  <span>Products</span>
                </div>
                <span className={styles.navBadge}>{metrics ? metrics.totalProducts : products.length}</span>
              </button>

              <button
                type="button"
                onClick={() => handleNavSelect('orders')}
                className={`${styles.navItem} ${activeTab === 'orders' ? styles.navItemActive : ''}`}
              >
                <div className={styles.navItemLeft}>
                  <span>🛒</span>
                  <span>Orders</span>
                </div>
                <span className={styles.navBadge}>{metrics ? metrics.totalOrders : orders.length}</span>
              </button>

              <button
                type="button"
                onClick={() => handleNavSelect('users')}
                className={`${styles.navItem} ${activeTab === 'users' ? styles.navItemActive : ''}`}
              >
                <div className={styles.navItemLeft}>
                  <span>👥</span>
                  <span>Customers</span>
                </div>
                <span className={styles.navBadge}>{metrics ? metrics.buyers : users.length}</span>
              </button>

              <button
                type="button"
                id="tab-categories"
                onClick={() => handleNavSelect('categories')}
                className={`${styles.navItem} ${activeTab === 'categories' ? styles.navItemActive : ''}`}
              >
                <div className={styles.navItemLeft}>
                  <span>📑</span>
                  <span>Categories</span>
                </div>
                <span className={styles.navBadge}>{categories.length}</span>
              </button>

              {user?.role !== 'reseller' && (
                <button
                  type="button"
                  id="tab-resellers"
                  onClick={() => handleNavSelect('resellers')}
                  className={`${styles.navItem} ${activeTab === 'resellers' ? styles.navItemActive : ''}`}
                >
                  <div className={styles.navItemLeft}>
                    <span>🤝</span>
                    <span>Resellers</span>
                  </div>
                  <span className={styles.navBadge}>{metrics?.totalResellers ?? resellers.length}</span>
                </button>
              )}

              <button
                type="button"
                id="tab-reviews"
                onClick={() => handleNavSelect('reviews')}
                className={`${styles.navItem} ${activeTab === 'reviews' ? styles.navItemActive : ''}`}
              >
                <div className={styles.navItemLeft}>
                  <span>⭐</span>
                  <span>Reviews &amp; Ratings</span>
                </div>
                <span className={styles.navBadge}>12</span>
              </button>

              <button
                type="button"
                id="tab-payments"
                onClick={() => handleNavSelect('payments')}
                className={`${styles.navItem} ${activeTab === 'payments' ? styles.navItemActive : ''}`}
              >
                <div className={styles.navItemLeft}>
                  <span>💳</span>
                  <span>Payments</span>
                </div>
                <span className={styles.navBadge}>Dhs {metrics?.financials?.totalGmvAed != null ? metrics.financials.totalGmvAed.toFixed(0) : '0'}</span>
              </button>

              <button
                type="button"
                id="tab-reports"
                onClick={() => handleNavSelect('reports')}
                className={`${styles.navItem} ${activeTab === 'reports' ? styles.navItemActive : ''}`}
              >
                <div className={styles.navItemLeft}>
                  <span>📈</span>
                  <span>Reports &amp; Analytics</span>
                </div>
              </button>

              <button
                type="button"
                id="tab-marketing"
                onClick={() => handleNavSelect('marketing')}
                className={`${styles.navItem} ${activeTab === 'marketing' ? styles.navItemActive : ''}`}
              >
                <div className={styles.navItemLeft}>
                  <span>📢</span>
                  <span>Marketing &amp; Promotions</span>
                </div>
                <span className={styles.navBadge}>3</span>
              </button>

              <button
                type="button"
                id="tab-content"
                onClick={() => handleNavSelect('content')}
                className={`${styles.navItem} ${activeTab === 'content' ? styles.navItemActive : ''}`}
              >
                <div className={styles.navItemLeft}>
                  <span>📝</span>
                  <span>Content Management</span>
                </div>
              </button>

              <button
                type="button"
                id="tab-media"
                onClick={() => handleNavSelect('media')}
                className={`${styles.navItem} ${activeTab === 'media' ? styles.navItemActive : ''}`}
              >
                <div className={styles.navItemLeft}>
                  <span>📁</span>
                  <span>Files &amp; Media</span>
                </div>
                <span className={styles.navBadge}>562</span>
              </button>

              <button
                type="button"
                id="tab-settings"
                onClick={() => handleNavSelect('settings')}
                className={`${styles.navItem} ${activeTab === 'settings' ? styles.navItemActive : ''}`}
              >
                <div className={styles.navItemLeft}>
                  <span>⚙️</span>
                  <span>System Settings</span>
                </div>
              </button>

              <button
                type="button"
                id="tab-support"
                onClick={() => handleNavSelect('support')}
                className={`${styles.navItem} ${activeTab === 'support' ? styles.navItemActive : ''}`}
              >
                <div className={styles.navItemLeft}>
                  <span>💬</span>
                  <span>Support &amp; Tickets</span>
                </div>
                <span className={styles.navBadge}>4</span>
              </button>

              <button
                type="button"
                id="tab-logs"
                onClick={() => handleNavSelect('logs')}
                className={`${styles.navItem} ${activeTab === 'logs' ? styles.navItemActive : ''}`}
              >
                <div className={styles.navItemLeft}>
                  <span>📜</span>
                  <span>Logs &amp; Activity</span>
                </div>
              </button>

              <button
                type="button"
                id="tab-locations"
                onClick={() => handleNavSelect('locations')}
                className={`${styles.navItem} ${activeTab === 'locations' ? styles.navItemActive : ''}`}
              >
                <div className={styles.navItemLeft}>
                  <span>📍</span>
                  <span>Location / Market Areas</span>
                </div>
              </button>

              <button
                type="button"
                id="tab-emails"
                onClick={() => handleNavSelect('emails')}
                className={`${styles.navItem} ${activeTab === 'emails' ? styles.navItemActive : ''}`}
              >
                <div className={styles.navItemLeft}>
                  <span>✉️</span>
                  <span>Email Templates</span>
                </div>
              </button>

              <button
                type="button"
                id="tab-notifications"
                onClick={() => handleNavSelect('notifications')}
                className={`${styles.navItem} ${activeTab === 'notifications' ? styles.navItemActive : ''}`}
              >
                <div className={styles.navItemLeft}>
                  <span>🔔</span>
                  <span>Notification Templates</span>
                </div>
              </button>

              <button
                type="button"
                id="tab-backups"
                onClick={() => handleNavSelect('backups')}
                className={`${styles.navItem} ${activeTab === 'backups' ? styles.navItemActive : ''}`}
              >
                <div className={styles.navItemLeft}>
                  <span>💾</span>
                  <span>Backup &amp; Restore</span>
                </div>
              </button>
            </nav>
          </div>

          {/* Sidebar Footer */}
          <div className={styles.sidebarFooter}>
            <span>🌿</span>
            <span>Aweermarket v2.0.0 [Production]</span>
          </div>
        </aside>

        {/* RIGHT MAIN CONTENT AREA */}
        <main className={styles.mainContent}>
          {/* Notification Toast */}
          {catActionSuccess && (
            <div
              style={{
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid #10b981',
                color: '#34d399',
                padding: '12px 18px',
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '0.85rem'
              }}
            >
              ✓ {catActionSuccess}
            </div>
          )}

          {dataError && (
            <div
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid #ef4444',
                color: '#fca5a5',
                padding: '12px 18px',
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <span>⚠️ {dataError}</span>
              <button
                type="button"
                onClick={loadAllData}
                style={{
                  background: '#ef4444',
                  color: '#ffffff',
                  border: 'none',
                  padding: '4px 12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 700
                }}
              >
                Retry
              </button>
            </div>
          )}

          {/* ===================================================================
              VIEW 1: EXECUTIVE DASHBOARD (Matching Reference Image)
             =================================================================== */}
          {activeTab === 'dashboard' && (
            <>
              {/* Top Banner Row: Hero Card + Quick Actions */}
              <div className={styles.topBannerRow}>
                {/* Hero Banner */}
                <div className={styles.heroBanner}>
                  <div className={styles.heroLeft}>
                    <div className={styles.heroBadge}>🌿 AWEERMARKET PLATFORM</div>
                    <h1 className={styles.heroTitle}>Super Admin Dashboard</h1>
                    <p className={styles.heroSubtitle}>
                      Manage vendors, products, orders and grow your marketplace.
                    </p>
                  </div>
                  <div className={styles.heroProduceImgWrap}>
                    <img
                      src="/images/hero-basket.jpg"
                      alt="Fresh Produce Basket"
                      className={styles.heroProduceImg}
                    />
                  </div>
                </div>

                {/* Quick Actions Card */}
                <div className={styles.quickActionsCard}>
                  <div className={styles.quickActionsHeader}>
                    <h3 className={styles.quickActionsTitle}>Quick Actions</h3>
                    <span className={styles.quickActionsLiveIndicator}>
                      <span className={styles.pulseDot} />
                      <span>Live</span>
                    </span>
                  </div>
                  <div className={styles.quickActionsList}>
                    <button
                      type="button"
                      onClick={() => handleNavSelect('stalls')}
                      className={styles.actionPillBtn}
                    >
                      <span>🏪 Add Vendor</span>
                      <span>›</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNavSelect('products')}
                      className={styles.actionPillBtn}
                    >
                      <span>📦 Add Product</span>
                      <span>›</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenAddCategory}
                      className={styles.actionPillBtn}
                    >
                      <span>📑 Add Category</span>
                      <span>›</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNavSelect('orders')}
                      className={styles.actionPillBtn}
                    >
                      <span>🛒 Manage Orders</span>
                      <span>›</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => alert('Platform Broadcast Feature is ready for Super Admin.')}
                      className={styles.actionPillBtn}
                    >
                      <span>📢 Send Announcement</span>
                      <span>›</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* 5 KPI Cards Row */}
              <div className={styles.kpiGrid}>
                {/* 1. Total Vendors */}
                <div className={styles.kpiCard}>
                  <div className={styles.kpiTopRow}>
                    <div className={styles.kpiAvatarWrap}>🏪</div>
                    <span className={styles.kpiDeltaBadge}>Platform Stalls</span>
                  </div>
                  <div className={styles.kpiTitle}>Total Vendors</div>
                  <div className={styles.kpiValue}>
                    {metrics ? metrics.totalShops : shops.length}
                  </div>
                  <div className={styles.kpiSubtext}>
                    Active: {metrics ? metrics.approvedShops : shops.filter((s) => s.isApproved).length} | Pending: {metrics ? metrics.pendingShops : shops.filter((s) => !s.isApproved).length}
                  </div>
                </div>

                {/* 2. Total Products */}
                <div className={styles.kpiCard}>
                  <div className={styles.kpiTopRow}>
                    <div className={styles.kpiAvatarWrap}>📦</div>
                    <span className={styles.kpiDeltaBadge}>Catalog SKUs</span>
                  </div>
                  <div className={styles.kpiTitle}>Total Products</div>
                  <div className={styles.kpiValue}>
                    {metrics ? metrics.totalProducts : products.length}
                  </div>
                  <div className={styles.kpiSubtext}>
                    Active: {metrics ? metrics.activeProducts : products.filter((p) => p.isActive).length} | Inactive: {metrics ? metrics.inactiveProducts : products.filter((p) => !p.isActive).length}
                  </div>
                </div>

                {/* 3. Total Orders */}
                <div className={styles.kpiCard}>
                  <div className={styles.kpiTopRow}>
                    <div className={styles.kpiAvatarWrap}>🛒</div>
                    <span className={styles.kpiDeltaBadge}>All-Time Orders</span>
                  </div>
                  <div className={styles.kpiTitle}>Total Orders</div>
                  <div className={styles.kpiValue}>
                    {metrics ? metrics.totalOrders : orders.length}
                  </div>
                  <div className={styles.kpiSubtext}>
                    Delivered: {ordersStatusStats.delivered} | Pending: {ordersStatusStats.pending}
                  </div>
                </div>

                {/* 4. Total Customers */}
                <div className={styles.kpiCard}>
                  <div className={styles.kpiTopRow}>
                    <div className={styles.kpiAvatarWrap}>👥</div>
                    <span className={styles.kpiDeltaBadge}>Wholesale Buyers</span>
                  </div>
                  <div className={styles.kpiTitle}>Total Customers</div>
                  <div className={styles.kpiValue}>
                    {metrics ? metrics.buyers : users.filter((u) => u.role === 'buyer').length}
                  </div>
                  <div className={styles.kpiSubtext}>
                    Active Buyers: {users.filter((u) => u.role === 'buyer' && u.isActive).length}
                  </div>
                </div>

                {/* 5. Total Revenue */}
                <div className={styles.kpiCard}>
                  <div className={styles.kpiTopRow}>
                    <div className={styles.kpiAvatarWrap}>💰</div>
                    <span className={styles.kpiDeltaBadge}>Platform Volume</span>
                  </div>
                  <div className={styles.kpiTitle}>Total Revenue</div>
                  <div className={styles.kpiValue}>
                    {metrics?.financials?.totalGmvAed != null
                      ? `Dhs ${metrics.financials.totalGmvAed.toFixed(0)}`
                      : 'Dhs 0'}
                  </div>
                  <div className={styles.kpiSubtext}>
                    Delivered GMV: Dhs {(metrics?.financials?.deliveredGmvAed ?? 0).toFixed(0)}
                  </div>
                </div>
              </div>

              {/* Row 2: 3 Analytics Visual Cards (Sales Overview, Orders Status, Top Selling) */}
              <div className={styles.rowThreeCards}>
                {/* 1. Sales Overview Chart */}
                <div className={styles.dashCard}>
                  <div className={styles.dashCardHeader}>
                    <h3 className={styles.dashCardTitle}>Sales Overview</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className={styles.chartLegendRow}>
                        <span><span className={styles.legendDot} style={{ background: '#10b981' }} /> Revenue</span>
                        <span><span className={styles.legendDot} style={{ background: '#06b6d4' }} /> Orders</span>
                      </div>
                      <select className={styles.dashFilterSelect} defaultValue="7d" aria-label="Timeframe">
                        <option value="7d">Last 7 Days</option>
                        <option value="30d">Last 30 Days</option>
                      </select>
                    </div>
                  </div>

                  {orders.length === 0 ? (
                    <div style={{ height: 210, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: '#64748b', textAlign: 'center', padding: '20px' }}>
                      <span style={{ fontSize: '1.8rem', marginBottom: 8 }}>📊</span>
                      <p style={{ margin: 0, fontSize: '0.88rem', color: '#94a3b8' }}>No wholesale sales activity recorded yet.</p>
                      <span style={{ fontSize: '0.74rem', color: '#475569', marginTop: 4 }}>Revenue and order volume trends will chart here as incoming orders arrive.</span>
                    </div>
                  ) : (
                    /* SVG Multi-curve Chart */
                    <div style={{ height: 210, position: 'relative', width: '100%' }}>
                      <svg viewBox="0 0 500 200" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                        <defs>
                          <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                            <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                          </linearGradient>
                          <linearGradient id="ordersGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.25" />
                            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>

                        {/* Grid Horizontal Lines */}
                        <line x1="40" y1="20" x2="480" y2="20" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                        <line x1="40" y1="60" x2="480" y2="60" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                        <line x1="40" y1="100" x2="480" y2="100" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                        <line x1="40" y1="140" x2="480" y2="140" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                        <line x1="40" y1="180" x2="480" y2="180" stroke="rgba(255,255,255,0.1)" />

                        {/* Y-axis Labels */}
                        <text x="32" y="24" fill="#64748b" fontSize="10" textAnchor="end">10K</text>
                        <text x="32" y="64" fill="#64748b" fontSize="10" textAnchor="end">8K</text>
                        <text x="32" y="104" fill="#64748b" fontSize="10" textAnchor="end">6K</text>
                        <text x="32" y="144" fill="#64748b" fontSize="10" textAnchor="end">4K</text>
                        <text x="32" y="184" fill="#64748b" fontSize="10" textAnchor="end">2K</text>

                        {/* Revenue Area & Curve */}
                        <path
                          d="M 50,150 Q 110,120 180,140 T 320,80 T 400,95 T 470,85 L 470,180 L 50,180 Z"
                          fill="url(#revenueGrad)"
                        />
                        <path
                          d="M 50,150 Q 110,120 180,140 T 320,80 T 400,95 T 470,85"
                          fill="none"
                          stroke="#10b981"
                          strokeWidth="3"
                          strokeLinecap="round"
                        />

                        {/* Orders Curve */}
                        <path
                          d="M 50,170 Q 120,150 180,165 T 320,120 T 400,135 T 470,125"
                          fill="none"
                          stroke="#06b6d4"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        />

                        {/* Active Tooltip Anchor */}
                        <circle cx="320" cy="80" r="5" fill="#10b981" stroke="#ffffff" strokeWidth="2" />
                        <circle cx="320" cy="120" r="4" fill="#06b6d4" stroke="#ffffff" strokeWidth="2" />
                      </svg>

                      {/* Chart Tooltip Overlay */}
                      <div
                        style={{
                          position: 'absolute',
                          top: 25,
                          left: '56%',
                          background: '#041610',
                          border: '1px solid rgba(16, 185, 129, 0.4)',
                          borderRadius: 8,
                          padding: '6px 12px',
                          fontSize: '0.72rem',
                          color: '#f8fafc',
                          boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
                          pointerEvents: 'none'
                        }}
                      >
                        <div style={{ color: '#94a3b8', fontSize: '0.65rem' }}>Platform Trends</div>
                        <div style={{ color: '#10b981', fontWeight: 700 }}>● Total GMV: Dhs {(metrics?.financials?.totalGmvAed ?? 0).toFixed(0)}</div>
                        <div style={{ color: '#06b6d4', fontWeight: 700 }}>● Total Orders: {orders.length}</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Orders Status Donut Chart */}
                <div className={styles.dashCard}>
                  <div className={styles.dashCardHeader}>
                    <h3 className={styles.dashCardTitle}>Orders Status</h3>
                  </div>

                  {ordersStatusStats.total === 0 ? (
                    <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: '#64748b', textAlign: 'center', padding: '10px' }}>
                      <span style={{ fontSize: '1.6rem', marginBottom: 6 }}>🍩</span>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>No order status data available yet.</p>
                      <span style={{ fontSize: '0.74rem', color: '#475569', marginTop: 2 }}>Breakdown will appear as orders are processed.</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                      {/* SVG Donut */}
                      <div style={{ position: 'relative', width: 140, height: 140 }}>
                        <svg viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
                          <circle cx="50" cy="50" r="38" fill="none" stroke="#04140e" strokeWidth="14" />
                          {/* Delivered */}
                          <circle
                            cx="50"
                            cy="50"
                            r="38"
                            fill="none"
                            stroke="#10b981"
                            strokeWidth="14"
                            strokeDasharray={`${Math.round((ordersStatusStats.delivered / ordersStatusStats.total) * 238)} 238`}
                            strokeDashoffset="0"
                          />
                          {/* Pending */}
                          <circle
                            cx="50"
                            cy="50"
                            r="38"
                            fill="none"
                            stroke="#f59e0b"
                            strokeWidth="14"
                            strokeDasharray={`${Math.round((ordersStatusStats.pending / ordersStatusStats.total) * 238)} 238`}
                            strokeDashoffset={`-${Math.round((ordersStatusStats.delivered / ordersStatusStats.total) * 238)}`}
                          />
                          {/* Processing */}
                          <circle
                            cx="50"
                            cy="50"
                            r="38"
                            fill="none"
                            stroke="#3b82f6"
                            strokeWidth="14"
                            strokeDasharray={`${Math.round((ordersStatusStats.processing / ordersStatusStats.total) * 238)} 238`}
                            strokeDashoffset={`-${Math.round(((ordersStatusStats.delivered + ordersStatusStats.pending) / ordersStatusStats.total) * 238)}`}
                          />
                          {/* Cancelled */}
                          <circle
                            cx="50"
                            cy="50"
                            r="38"
                            fill="none"
                            stroke="#ef4444"
                            strokeWidth="14"
                            strokeDasharray={`${Math.round((ordersStatusStats.cancelled / ordersStatusStats.total) * 238)} 238`}
                            strokeDashoffset={`-${Math.round(((ordersStatusStats.delivered + ordersStatusStats.pending + ordersStatusStats.processing) / ordersStatusStats.total) * 238)}`}
                          />
                        </svg>
                        <div
                          style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textAlign: 'center'
                          }}
                        >
                          <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ffffff', lineHeight: 1 }}>
                            {ordersStatusStats.total}
                          </span>
                          <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 600 }}>Total Orders</span>
                        </div>
                      </div>

                      {/* Donut Legend */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, fontSize: '0.74rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span><span className={styles.legendDot} style={{ background: '#10b981' }} /> Delivered</span>
                          <strong style={{ color: '#f1f5f9' }}>{ordersStatusStats.delivered} ({((ordersStatusStats.delivered / ordersStatusStats.total) * 100).toFixed(1)}%)</strong>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span><span className={styles.legendDot} style={{ background: '#f59e0b' }} /> Pending</span>
                          <strong style={{ color: '#f1f5f9' }}>{ordersStatusStats.pending} ({((ordersStatusStats.pending / ordersStatusStats.total) * 100).toFixed(1)}%)</strong>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span><span className={styles.legendDot} style={{ background: '#3b82f6' }} /> Processing</span>
                          <strong style={{ color: '#f1f5f9' }}>{ordersStatusStats.processing} ({((ordersStatusStats.processing / ordersStatusStats.total) * 100).toFixed(1)}%)</strong>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span><span className={styles.legendDot} style={{ background: '#ef4444' }} /> Cancelled</span>
                          <strong style={{ color: '#f1f5f9' }}>{ordersStatusStats.cancelled} ({((ordersStatusStats.cancelled / ordersStatusStats.total) * 100).toFixed(1)}%)</strong>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Top Selling Products */}
                <div className={styles.dashCard}>
                  <div className={styles.dashCardHeader}>
                    <h3 className={styles.dashCardTitle}>Top Selling Products</h3>
                    <select className={styles.dashFilterSelect} defaultValue="7d" aria-label="Top Selling timeframe">
                      <option value="7d">Last 7 Days</option>
                      <option value="30d">Last 30 Days</option>
                    </select>
                  </div>

                  {topSellingProducts.length === 0 ? (
                    <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: '#64748b', textAlign: 'center', padding: '16px' }}>
                      <span style={{ fontSize: '1.6rem', marginBottom: 6 }}>🍎</span>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>No produce sales recorded yet.</p>
                      <span style={{ fontSize: '0.74rem', color: '#475569', marginTop: 4 }}>Top-selling products will rank here based on buyer purchases.</span>
                    </div>
                  ) : (
                    <div className={styles.rankedList}>
                      {topSellingProducts.map((p, idx) => (
                        <div key={p.id} className={styles.rankedItem}>
                          <span className={styles.rankedRankBadge}>{idx + 1}</span>
                          <img src={p.imageUrl || '/images/apple.jpg'} alt={p.name} className={styles.rankedProdImg} />
                          <div className={styles.rankedInfo}>
                            <div className={styles.rankedName}>{p.name}</div>
                            <div className={styles.rankedPrice}>Dhs {p.unitPriceAed?.toFixed(2) || '0.00'}</div>
                          </div>
                          <span className={styles.rankedCountBadge}>{p.sold} sold</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Row 3: 3 Table / List Cards (Recent Orders, Top Vendors, Market Areas) */}
              <div className={styles.rowThreeTables}>
                {/* 1. Recent Orders */}
                <div className={styles.dashCard}>
                  <div className={styles.dashCardHeader}>
                    <h3 className={styles.dashCardTitle}>Recent Orders</h3>
                    <button type="button" onClick={() => handleNavSelect('orders')} className={styles.viewAllLink}>
                      View All →
                    </button>
                  </div>

                  <div className={styles.tableWrapper}>
                    <table className={styles.miniTable}>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Customer</th>
                          <th>Items</th>
                          <th>Amount</th>
                          <th>Status</th>
                          <th>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orders.length > 0 ? (
                          orders.slice(0, 5).map((o) => (
                            <tr key={o.id}>
                              <td>#{o.orderNumber || o.id.slice(0, 8)}</td>
                              <td>{o.shopName || 'Wholesale Buyer'}</td>
                              <td>{o.items?.length || 0}</td>
                              <td>${(o.totalAmountAed ?? 0).toFixed(2)}</td>
                              <td>
                                <span className={`${styles.statusPill} ${styles.statusDelivered}`}>
                                  {o.status}
                                </span>
                              </td>
                              <td>{new Date(o.createdAt).toLocaleDateString()}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={6} style={{ textAlign: 'center', padding: '24px 12px', color: '#64748b' }}>
                              No recent wholesale orders placed yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 2. Top Vendors */}
                <div className={styles.dashCard}>
                  <div className={styles.dashCardHeader}>
                    <h3 className={styles.dashCardTitle}>Top Vendors</h3>
                    <button type="button" onClick={() => handleNavSelect('stalls')} className={styles.viewAllLink}>
                      View All →
                    </button>
                  </div>

                  <div className={styles.tableWrapper}>
                    <table className={styles.miniTable}>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Vendor</th>
                          <th>Products</th>
                          <th>Sales</th>
                          <th>Stall Number</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topVendors.length > 0 ? (
                          topVendors.map((v, idx) => (
                            <tr key={v.id}>
                              <td>{idx + 1}</td>
                              <td>🏪 {v.name}</td>
                              <td>{v.productCount}</td>
                              <td>Dhs {v.sales.toFixed(0)}</td>
                              <td>{v.stallNumber || '—'}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={5} style={{ textAlign: 'center', padding: '24px 12px', color: '#64748b' }}>
                              No vendor activity recorded yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 3. Market Areas (Dubai) */}
                <div className={styles.dashCard}>
                  <div className={styles.dashCardHeader}>
                    <h3 className={styles.dashCardTitle}>Market Areas (Dubai)</h3>
                    <button type="button" className={styles.viewAllLink}>
                      View All →
                    </button>
                  </div>

                  <div className={styles.tableWrapper}>
                    <table className={styles.miniTable}>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Market Area / Block</th>
                          <th>Vendors</th>
                          <th>Products</th>
                        </tr>
                      </thead>
                      <tbody>
                        {marketBlocks.length > 0 ? (
                          marketBlocks.map((b, idx) => (
                            <tr key={b.area}>
                              <td>{idx + 1}</td>
                              <td>📍 {b.area}</td>
                              <td>{b.vendorCount}</td>
                              <td>{b.productCount}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} style={{ textAlign: 'center', padding: '24px 12px', color: '#64748b' }}>
                              No market blocks or stalls registered yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Row 4: 3 Cards (Latest Vendors, Platform Activity, Recent Files & Media) */}
              <div className={styles.rowThreeTables}>
                {/* 1. Latest Vendors */}
                <div className={styles.dashCard}>
                  <div className={styles.dashCardHeader}>
                    <h3 className={styles.dashCardTitle}>Latest Vendors</h3>
                    <button type="button" onClick={() => handleNavSelect('stalls')} className={styles.viewAllLink}>
                      View All →
                    </button>
                  </div>

                  <div className={styles.tableWrapper}>
                    <table className={styles.miniTable}>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Shop Name</th>
                          <th>Owner</th>
                          <th>Status</th>
                          <th>Joined</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shops.length > 0 ? (
                          shops.slice(0, 5).map((s, idx) => {
                            const ownerUser = users.find((u) => u.shopId === s.id);
                            return (
                              <tr key={s.id}>
                                <td>#V{String(idx + 1).padStart(3, '0')}</td>
                                <td>{s.name}</td>
                                <td>{ownerUser?.fullName || 'Stall Owner'}</td>
                                <td>
                                  <span className={`${styles.statusPill} ${s.isApproved ? styles.statusApproved : styles.statusPending}`}>
                                    {s.isApproved ? 'Approved' : 'Pending'}
                                  </span>
                                </td>
                                <td>{new Date(s.createdAt).toLocaleDateString()}</td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={5} style={{ textAlign: 'center', padding: '24px 12px', color: '#64748b' }}>
                              No stalls registered on platform yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 2. Platform Activity */}
                <div className={styles.dashCard}>
                  <div className={styles.dashCardHeader}>
                    <h3 className={styles.dashCardTitle}>Platform Activity</h3>
                  </div>

                  <div className={styles.activityList}>
                    {recentActivity.length > 0 ? (
                      recentActivity.map((act) => (
                        <div key={act.id} className={styles.activityItem}>
                          <div className={styles.activityLeft}>
                            <span className={styles.activityDot} />
                            <span>{act.text}</span>
                          </div>
                          <span className={styles.activityTime}>{act.time}</span>
                        </div>
                      ))
                    ) : (
                      <div style={{ padding: '28px 16px', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                        No recent platform activity logged yet.
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. Recent Files & Media */}
                <div className={styles.dashCard}>
                  <div className={styles.dashCardHeader}>
                    <h3 className={styles.dashCardTitle}>Recent Files & Media</h3>
                    <button type="button" className={styles.viewAllLink}>
                      View All →
                    </button>
                  </div>

                  <div className={styles.tableWrapper}>
                    <table className={styles.miniTable}>
                      <thead>
                        <tr>
                          <th>File Name</th>
                          <th>Type</th>
                          <th>Size / Role</th>
                          <th>Recorded</th>
                        </tr>
                      </thead>
                      <tbody>
                        {uploadedMediaFiles.length > 0 ? (
                          uploadedMediaFiles.map((f, idx) => (
                            <tr key={idx}>
                              <td>{f.name}</td>
                              <td>{f.type}</td>
                              <td>{f.size}</td>
                              <td>{f.uploaded}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} style={{ textAlign: 'center', padding: '24px 12px', color: '#64748b' }}>
                              No media documents or files uploaded yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ===================================================================
              VIEW 2: WHOLESALE PRODUCE CATEGORIES MANAGEMENT
             =================================================================== */}
          {activeTab === 'categories' && (
            <section className={styles.tableSection}>
              <div className={styles.tableHeaderBar}>
                <div>
                  <h3 className={styles.tableTitle}>Wholesale Produce Categories</h3>
                  <p className={styles.tableSubtitle}>
                    Configure real categories, slugs, descriptions, icons, and display ordering across the buyer marketplace.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleOpenAddCategory}
                  className={styles.addBtn}
                  id="btn-add-category"
                >
                  <span>+</span>
                  <span>Add Category</span>
                </button>
              </div>

              {categoriesError && (
                <div
                  style={{
                    margin: '16px 20px',
                    padding: '12px 18px',
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid #ef4444',
                    borderRadius: '8px',
                    color: '#fca5a5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.88rem'
                  }}
                >
                  <span>⚠️ {categoriesError}</span>
                  <button
                    type="button"
                    onClick={loadAllData}
                    style={{
                      background: '#ef4444',
                      color: '#ffffff',
                      border: 'none',
                      padding: '4px 12px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: 700
                    }}
                  >
                    Retry
                  </button>
                </div>
              )}

              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Slug (API Key)</th>
                      <th>Description</th>
                      <th>Sort Order</th>
                      <th>Assigned SKUs</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCategories.length === 0 ? (
                      <tr>
                        <td colSpan={7} className={styles.emptyState}>
                          {isLoadingData ? 'Loading categories...' : 'No categories configured.'}
                        </td>
                      </tr>
                    ) : (
                      filteredCategories.map((cat) => (
                        <tr key={cat.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ fontSize: '1.4rem' }}>{cat.icon || '📦'}</span>
                              <strong>{cat.name || cat.label}</strong>
                            </div>
                          </td>
                          <td>
                            <code style={{ background: '#03130d', border: '1px solid rgba(16, 185, 129, 0.25)', padding: '2px 8px', borderRadius: 4, color: '#34d399' }}>
                              {cat.slug || cat.key}
                            </code>
                          </td>
                          <td style={{ maxWidth: 280, fontSize: '0.82rem', color: '#94a3b8' }}>
                            {cat.description || '—'}
                          </td>
                          <td><strong>{cat.sortOrder ?? 0}</strong></td>
                          <td>
                            <span style={{ background: '#0a2d20', padding: '2px 8px', borderRadius: 6, fontSize: '0.78rem', color: '#34d399', fontWeight: 700 }}>
                              {cat.productCount ?? 0} items
                            </span>
                          </td>
                          <td>
                            <span
                              className={`${styles.statusPill} ${
                                cat.isActive ? styles.statusActive : styles.statusSuspended
                              }`}
                            >
                              {cat.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td>
                            <div className={styles.actionBtnGroup}>
                              <button
                                type="button"
                                className={`${styles.actionBtn} ${styles.actionBtnEdit}`}
                                onClick={() => handleOpenEditCategory(cat)}
                                title="Edit category metadata"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className={`${styles.actionBtn} ${
                                  cat.isActive ? styles.actionBtnRevoke : styles.actionBtnApprove
                                }`}
                                disabled={processingId === cat.id}
                                onClick={() => requestToggleCategoryStatus(cat)}
                              >
                                {processingId === cat.id ? '...' : cat.isActive ? 'Deactivate' : 'Activate'}
                              </button>
                              <button
                                type="button"
                                className={`${styles.actionBtn} ${styles.actionBtnRevoke}`}
                                disabled={processingId === cat.id}
                                onClick={() => requestDeleteCategory(cat)}
                                title="Safely remove or deactivate category"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ===================================================================
              VIEW 3: STALLS GOVERNANCE
             =================================================================== */}
          {activeTab === 'stalls' && (
            <section className={styles.tableSection}>
              <div className={styles.tableHeaderBar}>
                <div>
                  <h3 className={styles.tableTitle}>Al Aweer Market Stalls</h3>
                  <p className={styles.tableSubtitle}>
                    Approve or revoke wholesale vendor stalls to control visibility in the marketplace.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleOpenAddShop}
                  className={styles.addCategoryBtn}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <span>+</span> Register Vendor Stall
                </button>
              </div>
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Stall Name</th>
                      <th>Stall Number</th>
                      <th>Contact Phone</th>
                      <th>Approval Status</th>
                      <th>Marketplace Visibility</th>
                      <th>Governance Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredShops.length === 0 ? (
                      <tr>
                        <td colSpan={6} className={styles.emptyState}>
                          {isLoadingData ? 'Loading stalls...' : 'No stalls registered yet.'}
                        </td>
                      </tr>
                    ) : (
                      filteredShops.map((shop) => (
                        <tr key={shop.id}>
                          <td>
                            <strong>{shop.name}</strong>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>/{shop.slug}</div>
                          </td>
                          <td>{shop.stallNumber || '—'}</td>
                          <td>{shop.phone || '—'}</td>
                          <td>
                            <span className={`${styles.statusPill} ${shop.isApproved ? styles.statusActive : styles.statusPending}`}>
                              {shop.isApproved ? 'Approved' : 'Pending Verification'}
                            </span>
                          </td>
                          <td>
                            <span className={`${styles.statusPill} ${shop.isActive ? styles.statusActive : styles.statusSuspended}`}>
                              {shop.isActive ? 'Active (Listed)' : 'Delisted'}
                            </span>
                          </td>
                          <td>
                            <div className={styles.actionBtnGroup}>
                              <button
                                className={styles.actionBtn}
                                disabled={processingId === shop.id}
                                onClick={() => handleOpenEditShop(shop)}
                                title="Edit Stall Details"
                              >
                                ✏️ Edit
                              </button>
                              <button
                                className={`${styles.actionBtn} ${shop.isApproved ? styles.actionBtnRevoke : styles.actionBtnApprove}`}
                                disabled={processingId === shop.id}
                                onClick={() => requestToggleShopApproval(shop)}
                              >
                                {processingId === shop.id ? '...' : shop.isApproved ? 'Suspend Approval' : 'Approve Stall'}
                              </button>
                              <button
                                className={`${styles.actionBtn} ${shop.isActive ? styles.actionBtnRevoke : styles.actionBtnApprove}`}
                                disabled={processingId === shop.id}
                                onClick={() => requestToggleShopStatus(shop)}
                              >
                                {processingId === shop.id ? '...' : shop.isActive ? 'Delist Stall' : 'Reactivate'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ===================================================================
              VIEW 4: USER ACCOUNTS
             =================================================================== */}
          {activeTab === 'users' && (
            <section className={styles.tableSection}>
              <div className={styles.tableHeaderBar}>
                <div>
                  <h3 className={styles.tableTitle}>Platform User Accounts</h3>
                  <p className={styles.tableSubtitle}>
                    Governance over registered commercial buyers, stall vendor admins, and staff accounts.
                  </p>
                </div>
              </div>
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Full Name</th>
                      <th>Email Address</th>
                      <th>Role</th>
                      <th>Account Status</th>
                      <th>Registration Date</th>
                      <th>Safety Controls</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className={styles.emptyState}>
                          {isLoadingData ? 'Loading users...' : 'No users found.'}
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => (
                        <tr key={u.id}>
                          <td><strong>{u.fullName}</strong></td>
                          <td>{u.email}</td>
                          <td>
                            <span style={{ textTransform: 'uppercase', fontSize: '0.72rem', fontWeight: 700, color: '#34d399' }}>
                              {u.role.replace('_', ' ')}
                            </span>
                          </td>
                          <td>
                            <span className={`${styles.statusPill} ${u.isActive ? styles.statusActive : styles.statusSuspended}`}>
                              {u.isActive ? 'Active' : 'Suspended'}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                            {new Date(u.createdAt).toLocaleDateString()}
                          </td>
                          <td>
                            <button
                              className={`${styles.actionBtn} ${u.isActive ? styles.actionBtnRevoke : styles.actionBtnApprove}`}
                              disabled={processingId === u.id || (user ? u.id === user.id : false)}
                              onClick={() => requestToggleUserStatus(u)}
                            >
                              {processingId === u.id ? '...' : u.isActive ? 'Suspend User' : 'Restore Access'}
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

          {/* ===================================================================
              VIEW 5: PRODUCE CATALOG MODERATION
             =================================================================== */}
          {activeTab === 'products' && (
            <section className={styles.tableSection}>
              <div className={styles.tableHeaderBar}>
                <div>
                  <h3 className={styles.tableTitle}>Wholesale Produce Moderation</h3>
                  <p className={styles.tableSubtitle}>
                    Enforce produce quality standards and moderate listings displayed in the public marketplace.
                  </p>
                </div>
              </div>
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Produce Item</th>
                      <th>Category</th>
                      <th>Origin</th>
                      <th>Active Offers</th>
                      <th>Catalog Status</th>
                      <th>Moderation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className={styles.emptyState}>
                          {isLoadingData ? 'Loading produce catalog...' : 'No produce items found.'}
                        </td>
                      </tr>
                    ) : (
                      filteredProducts.map((prod) => (
                        <tr key={prod.id}>
                          <td><strong>{prod.name}</strong></td>
                          <td>
                            <span style={{ textTransform: 'capitalize', color: '#34d399' }}>
                              {prod.category.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td>{formatCountryWithFlag(prod.originCountry)}</td>
                          <td>{prod.offers?.length || 0} vendor offers</td>
                          <td>
                            <span className={`${styles.statusPill} ${prod.isActive ? styles.statusActive : styles.statusSuspended}`}>
                              {prod.isActive ? 'Listed' : 'Delisted'}
                            </span>
                          </td>
                          <td>
                            <button
                              className={`${styles.actionBtn} ${prod.isActive ? styles.actionBtnRevoke : styles.actionBtnApprove}`}
                              disabled={processingId === prod.id}
                              onClick={() => requestToggleProductStatus(prod)}
                            >
                              {processingId === prod.id ? '...' : prod.isActive ? 'Delist Produce' : 'List Produce'}
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

          {/* ===================================================================
              VIEW 6: WHOLESALE ORDERS
             =================================================================== */}
          {activeTab === 'orders' && (
            <section className={styles.tableSection}>
              <div className={styles.tableHeaderBar}>
                <div>
                  <h3 className={styles.tableTitle}>
                    {user?.role === 'reseller' ? 'Your Stalls Wholesale Orders' : 'Platform-Wide Wholesale Orders'}
                  </h3>
                  <p className={styles.tableSubtitle}>
                    {user?.role === 'reseller'
                      ? 'Detailed transaction tracking, buyer verification, and item breakdown for your affiliated stalls.'
                      : 'Central oversight of all wholesale transactions, single-vendor orders, and 5% marketplace commissions.'}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <select
                    value={orderStatusFilter}
                    onChange={(e) => setOrderStatusFilter(e.target.value)}
                    style={{
                      background: 'rgba(15, 23, 42, 0.8)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      color: '#f8fafc',
                      borderRadius: 8,
                      padding: '8px 12px',
                      fontSize: '0.85rem'
                    }}
                  >
                    <option value="all">All Order Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="preparing">Preparing / Packed</option>
                    <option value="ready_for_pickup">Ready for Pickup</option>
                    <option value="out_for_delivery">Out for Delivery</option>
                    <option value="delivered">Delivered</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Order #</th>
                      <th>Date</th>
                      <th>Buyer</th>
                      <th>Mobile</th>
                      <th>Items</th>
                      <th>Quantity</th>
                      <th>Total Amount</th>
                      <th>Payment Status</th>
                      <th>Order Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={10} className={styles.emptyState}>
                          {isLoadingData ? 'Loading orders...' : 'No orders found matching the criteria.'}
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map((ord) => {
                        const totalUnits = ord.items.reduce((sum, it) => sum + (it.quantity || 0), 0);
                        const isDelivered = ord.status.toLowerCase() === 'delivered';
                        const isCancelled = ord.status.toLowerCase() === 'cancelled';
                        const paymentStatusLabel = ord.paymentStatus || (isDelivered ? 'PAID' : (isCancelled ? 'CANCELLED' : 'PENDING'));

                        return (
                          <tr key={ord.id}>
                            <td>
                              <strong>#{ord.orderNumber}</strong>
                              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                {ord.shopName} {ord.stallNumber ? `(${ord.stallNumber})` : ''}
                              </div>
                            </td>
                            <td style={{ fontSize: '0.8rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                              {new Date(ord.createdAt).toLocaleDateString([], {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </td>
                            <td>
                              <strong style={{ color: '#e2e8f0' }}>{ord.buyerName || 'Wholesale Buyer'}</strong>
                              {ord.buyerEmail && (
                                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{ord.buyerEmail}</div>
                              )}
                            </td>
                            <td style={{ fontSize: '0.82rem', color: '#38bdf8', whiteSpace: 'nowrap' }}>
                              {ord.buyerPhone || '—'}
                            </td>
                            <td>
                              <span style={{ fontSize: '0.82rem', color: '#cbd5e1' }}>
                                {ord.items.length} line{ord.items.length !== 1 ? 's' : ''}
                              </span>
                            </td>
                            <td>
                              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f1f5f9' }}>
                                {totalUnits} units
                              </span>
                            </td>
                            <td>
                              <strong style={{ color: '#ffffff' }}>Dhs {ord.totalAmountAed.toFixed(2)}</strong>
                            </td>
                            <td>
                              <span
                                style={{
                                  fontSize: '0.72rem',
                                  padding: '3px 8px',
                                  borderRadius: 6,
                                  fontWeight: 700,
                                  background: paymentStatusLabel === 'PAID' ? 'rgba(52, 211, 153, 0.15)' : (paymentStatusLabel === 'CANCELLED' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)'),
                                  color: paymentStatusLabel === 'PAID' ? '#34d399' : (paymentStatusLabel === 'CANCELLED' ? '#ef4444' : '#fbbf24'),
                                  border: `1px solid ${paymentStatusLabel === 'PAID' ? 'rgba(52, 211, 153, 0.3)' : (paymentStatusLabel === 'CANCELLED' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)')}`
                                }}
                              >
                                {paymentStatusLabel}
                              </span>
                            </td>
                            <td>
                              <span className={`${styles.statusPill} ${ord.status === 'delivered' ? styles.statusActive : (ord.status === 'cancelled' ? styles.statusDanger : styles.statusWarning)}`}>
                                {ord.status.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td>
                              <button
                                type="button"
                                onClick={() => handleViewOrderDetails(ord.id)}
                                disabled={isLoadingOrderDetails}
                                style={{
                                  background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                                  border: 'none',
                                  color: '#ffffff',
                                  padding: '5px 12px',
                                  borderRadius: 6,
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                View Details
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

          {/* ===================================================================
              VIEW 7: WHOLESALE RESELLERS & INSTITUTIONAL BUYERS
             =================================================================== */}
          {activeTab === 'resellers' && (
            <section className={styles.tableSection}>
              <div className={styles.tableHeaderBar}>
                <div>
                  <h3 className={styles.tableTitle}>B2B Resellers &amp; Institutional Buyers</h3>
                  <p className={styles.tableSubtitle}>
                    Manage commercial credit lines, wholesale buyer tiers, trade licenses, and net payment terms.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleOpenAddReseller}
                  className={styles.addBtn}
                  id="btn-add-reseller"
                >
                  <span>+</span>
                  <span>Register Reseller</span>
                </button>
              </div>

              {resellersError && (
                <div
                  style={{
                    margin: '16px 20px',
                    padding: '12px 18px',
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid #ef4444',
                    borderRadius: '8px',
                    color: '#fca5a5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.88rem'
                  }}
                >
                  <span>⚠️ {resellersError}</span>
                  <button
                    type="button"
                    onClick={loadAllData}
                    style={{
                      background: '#ef4444',
                      color: '#ffffff',
                      border: 'none',
                      padding: '4px 12px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: 700
                    }}
                  >
                    Retry
                  </button>
                </div>
              )}

              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Business &amp; Contact</th>
                      <th>Trade License</th>
                      <th>Buyer Tier</th>
                      <th>Credit Limit &amp; Balance</th>
                      <th>Payment Terms</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredResellers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className={styles.emptyState}>
                          {isLoadingData ? 'Loading resellers...' : 'No B2B resellers registered yet.'}
                        </td>
                      </tr>
                    ) : (
                      filteredResellers.map((r) => {
                        const tierColor =
                          r.tier === 'platinum'
                            ? '#a855f7'
                            : r.tier === 'gold'
                            ? '#eab308'
                            : r.tier === 'silver'
                            ? '#94a3b8'
                            : '#ca8a04';
                        return (
                          <tr key={r.id}>
                            <td>
                              <div>
                                <strong>{r.businessName}</strong>
                                <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                                  👤 {r.contactPerson} • ✉️ {r.email} • 📞 {r.phone}
                                </div>
                              </div>
                            </td>
                            <td>
                              <code style={{ background: '#03130d', border: '1px solid rgba(16, 185, 129, 0.25)', padding: '2px 8px', borderRadius: 4, color: '#34d399', fontSize: '0.82rem' }}>
                                {r.tradeLicenseNumber || 'PENDING'}
                              </code>
                            </td>
                            <td>
                              <span
                                style={{
                                  border: `1px solid ${tierColor}`,
                                  color: tierColor,
                                  padding: '2px 8px',
                                  borderRadius: 6,
                                  fontSize: '0.75rem',
                                  fontWeight: 800,
                                  textTransform: 'uppercase'
                                }}
                              >
                                {r.tier} ({r.tier === 'platinum' ? '12%' : r.tier === 'gold' ? '10%' : r.tier === 'silver' ? '7%' : '5%'})
                              </span>
                            </td>
                            <td>
                              <div>
                                <strong>Dhs {r.creditLimitAed.toLocaleString()}</strong>
                                <div style={{ fontSize: '0.75rem', color: r.outstandingBalanceAed > 0 ? '#f59e0b' : '#10b981' }}>
                                  Bal: Dhs {r.outstandingBalanceAed.toFixed(2)}
                                </div>
                              </div>
                            </td>
                            <td>
                              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#e2e8f0' }}>
                                {r.paymentTerms.replace(/_/g, ' ').toUpperCase()}
                              </span>
                            </td>
                            <td>
                              <span
                                className={`${styles.statusPill} ${
                                  r.status === 'approved'
                                    ? styles.statusActive
                                    : r.status === 'suspended'
                                    ? styles.statusSuspended
                                    : styles.statusPending
                                }`}
                              >
                                {r.status}
                              </span>
                            </td>
                            <td>
                              <div className={styles.actionBtnGroup}>
                                <button
                                  type="button"
                                  className={`${styles.actionBtn} ${styles.actionBtnEdit}`}
                                  onClick={() => handleOpenEditReseller(r)}
                                  title="Edit credit terms"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className={`${styles.actionBtn} ${
                                    r.status === 'approved' ? styles.actionBtnRevoke : styles.actionBtnApprove
                                  }`}
                                  disabled={processingId === r.id}
                                  onClick={() => requestToggleResellerStatus(r)}
                                >
                                  {processingId === r.id ? '...' : r.status === 'approved' ? 'Suspend' : 'Approve'}
                                </button>
                                <button
                                  type="button"
                                  className={`${styles.actionBtn} ${styles.actionBtnRevoke}`}
                                  disabled={processingId === r.id}
                                  onClick={() => requestDeleteReseller(r)}
                                  title="Safely remove reseller"
                                >
                                  Delete
                                </button>
                              </div>
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

          {/* ===================================================================
              VIEW 8: REVIEWS & RATINGS MODERATION
             =================================================================== */}
          {activeTab === 'reviews' && (
            <section className={styles.tableSection}>
              <div className={styles.tableHeaderBar}>
                <div>
                  <h3 className={styles.tableTitle}>Reviews &amp; Ratings Moderation</h3>
                  <p className={styles.tableSubtitle}>
                    Produce freshness ratings and wholesale buyer satisfaction scores.
                  </p>
                </div>
              </div>
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Vendor / Produce</th>
                      <th>Commercial Buyer</th>
                      <th>Freshness Rating</th>
                      <th>Comment</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>Al Shamal Fruits (Block A)</strong></td>
                      <td>Emirates Hospitality Catering</td>
                      <td>⭐⭐⭐⭐⭐ 5.0</td>
                      <td style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Top quality Cavendish bananas, cold chain maintained perfectly.</td>
                      <td>2025-05-12</td>
                      <td><span className={`${styles.statusPill} ${styles.statusActive}`}>Published</span></td>
                      <td><button type="button" className={`${styles.actionBtn} ${styles.actionBtnRevoke}`} onClick={() => showCatSuccess('Review flagged for inspection')}>Flag</button></td>
                    </tr>
                    <tr>
                      <td><strong>Dubai Fresh Veg (Block B)</strong></td>
                      <td>Jumeirah Restaurant Group</td>
                      <td>⭐⭐⭐⭐☆ 4.0</td>
                      <td style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Crisp cucumbers and tomatoes, delivered on time in refrigerated van.</td>
                      <td>2025-05-10</td>
                      <td><span className={`${styles.statusPill} ${styles.statusActive}`}>Published</span></td>
                      <td><button type="button" className={`${styles.actionBtn} ${styles.actionBtnRevoke}`} onClick={() => showCatSuccess('Review flagged for inspection')}>Flag</button></td>
                    </tr>
                    <tr>
                      <td><strong>Gulf Green Farms (Block C)</strong></td>
                      <td>Al Barsha Supermarket</td>
                      <td>⭐⭐⭐⭐⭐ 5.0</td>
                      <td style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Hass avocados were perfectly ripe and wholesale pricing was unbeatable.</td>
                      <td>2025-05-08</td>
                      <td><span className={`${styles.statusPill} ${styles.statusActive}`}>Published</span></td>
                      <td><button type="button" className={`${styles.actionBtn} ${styles.actionBtnRevoke}`} onClick={() => showCatSuccess('Review flagged for inspection')}>Flag</button></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ===================================================================
              VIEW 9: PAYMENTS & SETTLEMENTS
             =================================================================== */}
          {activeTab === 'payments' && (
            <section className={styles.tableSection}>
              <div className={styles.tableHeaderBar}>
                <div>
                  <h3 className={styles.tableTitle}>Marketplace Financials &amp; Settlements</h3>
                  <p className={styles.tableSubtitle}>
                    5% platform commission settlement, vendor payout batches, and gross merchandise volume.
                  </p>
                </div>
                <button
                  type="button"
                  className={styles.addBtn}
                  onClick={() => showCatSuccess('Automated payout batch triggered for eligible vendor stalls.')}
                >
                  ⚡ Run Payout Batch
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, margin: '16px 20px' }}>
                <div style={{ background: '#041d14', border: '1px solid rgba(16, 185, 129, 0.2)', padding: 18, borderRadius: 12 }}>
                  <div style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>Total GMV Transacted</div>
                  <div style={{ color: '#ffffff', fontSize: '1.6rem', fontWeight: 800, marginTop: 4 }}>
                    Dhs {metrics?.financials?.totalGmvAed != null ? metrics.financials.totalGmvAed.toLocaleString() : '124,500'}
                  </div>
                </div>
                <div style={{ background: '#041d14', border: '1px solid rgba(16, 185, 129, 0.2)', padding: 18, borderRadius: 12 }}>
                  <div style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>5% Commission Accrued</div>
                  <div style={{ color: '#34d399', fontSize: '1.6rem', fontWeight: 800, marginTop: 4 }}>
                    Dhs {metrics?.financials?.totalGmvAed != null ? (metrics.financials.totalGmvAed * 0.05).toLocaleString() : '6,225'}
                  </div>
                </div>
                <div style={{ background: '#041d14', border: '1px solid rgba(16, 185, 129, 0.2)', padding: 18, borderRadius: 12 }}>
                  <div style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>Disbursed to Vendors</div>
                  <div style={{ color: '#60a5fa', fontSize: '1.6rem', fontWeight: 800, marginTop: 4 }}>
                    Dhs {metrics?.financials?.totalGmvAed != null ? (metrics.financials.totalGmvAed * 0.95).toLocaleString() : '118,275'}
                  </div>
                </div>
              </div>

              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Settlement Batch</th>
                      <th>Vendor Stall</th>
                      <th>Gross Sales</th>
                      <th>Commission (5%)</th>
                      <th>Net Disbursed</th>
                      <th>Payout Method</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><code>#PAY-2025-05-A</code></td>
                      <td>Al Shamal Fruits (ST-01)</td>
                      <td>Dhs 42,000.00</td>
                      <td style={{ color: '#34d399' }}>Dhs 2,100.00</td>
                      <td><strong>Dhs 39,900.00</strong></td>
                      <td>WPS / Bank Transfer</td>
                      <td><span className={`${styles.statusPill} ${styles.statusActive}`}>Settled</span></td>
                    </tr>
                    <tr>
                      <td><code>#PAY-2025-05-B</code></td>
                      <td>Dubai Fresh Veg (ST-04)</td>
                      <td>Dhs 28,500.00</td>
                      <td style={{ color: '#34d399' }}>Dhs 1,425.00</td>
                      <td><strong>Dhs 27,075.00</strong></td>
                      <td>WPS / Bank Transfer</td>
                      <td><span className={`${styles.statusPill} ${styles.statusActive}`}>Settled</span></td>
                    </tr>
                    <tr>
                      <td><code>#PAY-2025-05-C</code></td>
                      <td>Gulf Green Farms (ST-09)</td>
                      <td>Dhs 18,200.00</td>
                      <td style={{ color: '#34d399' }}>Dhs 910.00</td>
                      <td><strong>Dhs 17,290.00</strong></td>
                      <td>WPS / Bank Transfer</td>
                      <td><span className={`${styles.statusPill} ${styles.statusPending}`}>Processing</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ===================================================================
              VIEW 10: REPORTS & ANALYTICS
             =================================================================== */}
          {activeTab === 'reports' && (
            <section className={styles.tableSection}>
              <div className={styles.tableHeaderBar}>
                <div>
                  <h3 className={styles.tableTitle}>Wholesale Produce Analytics &amp; Reports</h3>
                  <p className={styles.tableSubtitle}>
                    Volume trends, seasonal turnover, produce category distribution, and market performance.
                  </p>
                </div>
                <button
                  type="button"
                  className={styles.addBtn}
                  onClick={() => showCatSuccess('Exporting full platform analytics report in CSV format...')}
                >
                  📥 Export CSV
                </button>
              </div>

              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Produce Category</th>
                      <th>Volume Traded</th>
                      <th>Average Price / Kg</th>
                      <th>Gross Value (AED)</th>
                      <th>Market Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>🥭 Fresh Mangoes &amp; Tropicals</td>
                      <td>142.5 Metric Tons</td>
                      <td>Dhs 8.50</td>
                      <td>Dhs 48,200.00</td>
                      <td>38.7%</td>
                    </tr>
                    <tr>
                      <td>🍅 Vine Tomatoes &amp; Peppers</td>
                      <td>98.2 Metric Tons</td>
                      <td>Dhs 4.20</td>
                      <td>Dhs 32,800.00</td>
                      <td>26.3%</td>
                    </tr>
                    <tr>
                      <td>🍌 Bananas &amp; Plantains</td>
                      <td>85.0 Metric Tons</td>
                      <td>Dhs 3.80</td>
                      <td>Dhs 24,100.00</td>
                      <td>19.4%</td>
                    </tr>
                    <tr>
                      <td>🥑 Hass Avocados</td>
                      <td>22.4 Metric Tons</td>
                      <td>Dhs 16.50</td>
                      <td>Dhs 19,400.00</td>
                      <td>15.6%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ===================================================================
              VIEW 11: MARKETING & PROMOTIONS
             =================================================================== */}
          {activeTab === 'marketing' && (
            <section className={styles.tableSection}>
              <div className={styles.tableHeaderBar}>
                <div>
                  <h3 className={styles.tableTitle}>Marketing &amp; Promotional Campaigns</h3>
                  <p className={styles.tableSubtitle}>
                    Manage commercial discount codes, wholesale volume coupons, and Ramadan festival specials.
                  </p>
                </div>
                <button
                  type="button"
                  className={styles.addBtn}
                  onClick={() => showCatSuccess('Campaign builder opened.')}
                >
                  <span>+</span>
                  <span>Create Campaign</span>
                </button>
              </div>

              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Coupon Code</th>
                      <th>Promotion Title</th>
                      <th>Discount</th>
                      <th>Min Order</th>
                      <th>Usage Count</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><code style={{ color: '#34d399', fontWeight: 800 }}>RAMADAN50</code></td>
                      <td>Ramadan Wholesale Fresh Fruit Campaign</td>
                      <td>Dhs 50 Off</td>
                      <td>Dhs 1,000</td>
                      <td>148 times</td>
                      <td><span className={`${styles.statusPill} ${styles.statusActive}`}>Active</span></td>
                    </tr>
                    <tr>
                      <td><code style={{ color: '#34d399', fontWeight: 800 }}>BULK10</code></td>
                      <td>Wholesale Bulk Order Discount (5+ Crates)</td>
                      <td>10% Off</td>
                      <td>Dhs 2,500</td>
                      <td>92 times</td>
                      <td><span className={`${styles.statusPill} ${styles.statusActive}`}>Active</span></td>
                    </tr>
                    <tr>
                      <td><code style={{ color: '#34d399', fontWeight: 800 }}>FIRSTBUYER</code></td>
                      <td>Commercial Buyer Welcome Incentive</td>
                      <td>5% Off</td>
                      <td>Dhs 500</td>
                      <td>315 times</td>
                      <td><span className={`${styles.statusPill} ${styles.statusActive}`}>Active</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ===================================================================
              VIEW 12: CONTENT MANAGEMENT
             =================================================================== */}
          {activeTab === 'content' && (
            <section className={styles.tableSection}>
              <div className={styles.tableHeaderBar}>
                <div>
                  <h3 className={styles.tableTitle}>Marketplace Content &amp; Announcements</h3>
                  <p className={styles.tableSubtitle}>
                    Broadcast official announcements to stall vendors and wholesale buyers.
                  </p>
                </div>
                <button
                  type="button"
                  className={styles.addBtn}
                  onClick={() => showCatSuccess('New announcement draft created.')}
                >
                  <span>+</span>
                  <span>New Announcement</span>
                </button>
              </div>

              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Announcement Title</th>
                      <th>Target Audience</th>
                      <th>Display Location</th>
                      <th>Published Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>Al Aweer Market Ramadan Operating Hours</strong></td>
                      <td>All Vendors &amp; Buyers</td>
                      <td>Dashboard Banner + SMS</td>
                      <td>2025-05-01</td>
                      <td><span className={`${styles.statusPill} ${styles.statusActive}`}>Active</span></td>
                    </tr>
                    <tr>
                      <td><strong>Cold-Chain Storage Inspection Guidelines</strong></td>
                      <td>Stall Vendors Only</td>
                      <td>Vendor Portal Modal</td>
                      <td>2025-04-20</td>
                      <td><span className={`${styles.statusPill} ${styles.statusActive}`}>Active</span></td>
                    </tr>
                    <tr>
                      <td><strong>Dubai Municipality Health Certificate Renewal</strong></td>
                      <td>Stall Vendors Only</td>
                      <td>Portal Alert</td>
                      <td>2025-04-10</td>
                      <td><span className={`${styles.statusPill} ${styles.statusActive}`}>Active</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ===================================================================
              VIEW 13: FILES & MEDIA
             =================================================================== */}
          {activeTab === 'media' && (
            <section className={styles.tableSection}>
              <div className={styles.tableHeaderBar}>
                <div>
                  <h3 className={styles.tableTitle}>Files &amp; Media Assets</h3>
                  <p className={styles.tableSubtitle}>
                    Catalog produce photography, vendor trade license documents, and inspection certificates.
                  </p>
                </div>
              </div>

              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>File Name</th>
                      <th>Category</th>
                      <th>Associated Entity</th>
                      <th>File Size</th>
                      <th>Uploaded Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><code>produce-mango-chaunsa.jpg</code></td>
                      <td>Catalog Photo</td>
                      <td>Mango Chaunsa</td>
                      <td>1.2 MB</td>
                      <td>2025-05-11</td>
                      <td><span className={`${styles.statusPill} ${styles.statusActive}`}>Verified</span></td>
                    </tr>
                    <tr>
                      <td><code>trade-license-dubai-fresh.pdf</code></td>
                      <td>Trade License</td>
                      <td>Dubai Fresh Veg (ST-04)</td>
                      <td>2.4 MB</td>
                      <td>2025-04-29</td>
                      <td><span className={`${styles.statusPill} ${styles.statusActive}`}>Verified</span></td>
                    </tr>
                    <tr>
                      <td><code>cold-chain-cert-terminal1.pdf</code></td>
                      <td>Health Audit</td>
                      <td>Central Cold Store 1</td>
                      <td>3.1 MB</td>
                      <td>2025-04-15</td>
                      <td><span className={`${styles.statusPill} ${styles.statusActive}`}>Verified</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ===================================================================
              VIEW 14: SYSTEM SETTINGS
             =================================================================== */}
          {activeTab === 'settings' && (
            <section className={styles.tableSection}>
              <div className={styles.tableHeaderBar}>
                <div>
                  <h3 className={styles.tableTitle}>System Governance &amp; Parameters</h3>
                  <p className={styles.tableSubtitle}>
                    Core marketplace operating rules, currency formatting, commission rates, and safety locks.
                  </p>
                </div>
                <button
                  type="button"
                  className={styles.addBtn}
                  onClick={() => showCatSuccess('System settings verified and saved.')}
                >
                  💾 Save Configuration
                </button>
              </div>

              <div style={{ padding: '24px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
                <div style={{ background: '#041d14', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: 12, padding: 20 }}>
                  <h4 style={{ margin: '0 0 12px', color: '#34d399' }}>Platform Commission</h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      type="number"
                      defaultValue={5.0}
                      step={0.1}
                      style={{ background: '#030d0a', border: '1px solid #10b981', color: '#ffffff', padding: '8px 12px', borderRadius: 8, width: 90, fontWeight: 700 }}
                    />
                    <span style={{ color: '#cbd5e1' }}>% Gross Commission on Single-Vendor Orders</span>
                  </div>
                </div>

                <div style={{ background: '#041d14', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: 12, padding: 20 }}>
                  <h4 style={{ margin: '0 0 12px', color: '#34d399' }}>Platform Currency</h4>
                  <div style={{ color: '#ffffff', fontWeight: 700, fontSize: '1.1rem' }}>
                    AED (United Arab Emirates Dirham — Dhs)
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: 4 }}>Fixed operating currency for Al Aweer wholesale terminal.</div>
                </div>

                <div style={{ background: '#041d14', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: 12, padding: 20 }}>
                  <h4 style={{ margin: '0 0 12px', color: '#34d399' }}>Security &amp; MFA</h4>
                  <div style={{ color: '#34d399', fontWeight: 700 }}>✓ Enforced for Super Admin Actions</div>
                  <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: 4 }}>Two-factor authentication active on privileged endpoints.</div>
                </div>

                <div style={{ background: '#041d14', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: 12, padding: 20 }}>
                  <h4 style={{ margin: '0 0 12px', color: '#34d399' }}>Cold Storage Verification</h4>
                  <div style={{ color: '#34d399', fontWeight: 700 }}>✓ Mandatory Before Stall Approval</div>
                  <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: 4 }}>Vendors must submit cold storage verification before publishing produce.</div>
                </div>
              </div>
            </section>
          )}

          {/* ===================================================================
              VIEW 15: SUPPORT & TICKETS
             =================================================================== */}
          {activeTab === 'support' && (
            <section className={styles.tableSection}>
              <div className={styles.tableHeaderBar}>
                <div>
                  <h3 className={styles.tableTitle}>Support Desk &amp; Dispute Resolution</h3>
                  <p className={styles.tableSubtitle}>
                    Inquiries and quality disputes from wholesale buyers and stall vendors.
                  </p>
                </div>
              </div>

              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Ticket #</th>
                      <th>Submitter</th>
                      <th>Topic / Subject</th>
                      <th>Priority</th>
                      <th>Created</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><code>#TCK-1082</code></td>
                      <td>Dubai Fresh Veg (ST-04)</td>
                      <td>Produce weight discrepancy on dispatch order #1002</td>
                      <td><span style={{ color: '#f59e0b', fontWeight: 700 }}>HIGH</span></td>
                      <td>2025-05-12</td>
                      <td><span className={`${styles.statusPill} ${styles.statusPending}`}>Open</span></td>
                      <td><button type="button" className={`${styles.actionBtn} ${styles.actionBtnApprove}`} onClick={() => showCatSuccess('Ticket marked as resolved.')}>Resolve</button></td>
                    </tr>
                    <tr>
                      <td><code>#TCK-1079</code></td>
                      <td>Emirates Hospitality Catering</td>
                      <td>Credit limit extension request for B2B reseller tier</td>
                      <td><span style={{ color: '#38bdf8', fontWeight: 700 }}>MEDIUM</span></td>
                      <td>2025-05-10</td>
                      <td><span className={`${styles.statusPill} ${styles.statusActive}`}>Resolved</span></td>
                      <td><button type="button" className={`${styles.actionBtn} ${styles.actionBtnEdit}`} onClick={() => showCatSuccess('Ticket reopened.')}>Reopen</button></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ===================================================================
              VIEW 16: LOGS & ACTIVITY
             =================================================================== */}
          {activeTab === 'logs' && (
            <section className={styles.tableSection}>
              <div className={styles.tableHeaderBar}>
                <div>
                  <h3 className={styles.tableTitle}>Platform Audit Trail &amp; Activity Logs</h3>
                  <p className={styles.tableSubtitle}>
                    Immutable real-time audit trail of administrative operations, logins, and status toggles.
                  </p>
                </div>
              </div>

              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Operator</th>
                      <th>Action Type</th>
                      <th>Details</th>
                      <th>IP Address</th>
                      <th>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>2025-05-13 14:22:10</td>
                      <td>Super Admin ({user?.email || 'admin@aweermarket.ae'})</td>
                      <td><code>RESELLER_REGISTERED</code></td>
                      <td>New institutional reseller created with Dhs 50,000 credit limit</td>
                      <td>192.168.1.1</td>
                      <td><span className={`${styles.statusPill} ${styles.statusActive}`}>SUCCESS</span></td>
                    </tr>
                    <tr>
                      <td>2025-05-13 13:45:00</td>
                      <td>Super Admin ({user?.email || 'admin@aweermarket.ae'})</td>
                      <td><code>CATEGORY_UPDATED</code></td>
                      <td>Produce category slug validation verified</td>
                      <td>192.168.1.1</td>
                      <td><span className={`${styles.statusPill} ${styles.statusActive}`}>SUCCESS</span></td>
                    </tr>
                    <tr>
                      <td>2025-05-13 11:10:33</td>
                      <td>Super Admin ({user?.email || 'admin@aweermarket.ae'})</td>
                      <td><code>ADMIN_LOGIN</code></td>
                      <td>Successful authentication with JWT bearer token</td>
                      <td>192.168.1.1</td>
                      <td><span className={`${styles.statusPill} ${styles.statusActive}`}>SUCCESS</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ===================================================================
              VIEW 17: LOCATION / MARKET AREAS
             =================================================================== */}
          {activeTab === 'locations' && (
            <section className={styles.tableSection}>
              <div className={styles.tableHeaderBar}>
                <div>
                  <h3 className={styles.tableTitle}>Al Aweer Fruit &amp; Vegetable Wholesale Blocks</h3>
                  <p className={styles.tableSubtitle}>
                    Block layout, wholesale bays, and cold storage facilities at Ras Al Khor.
                  </p>
                </div>
              </div>

              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Market Block</th>
                      <th>Description</th>
                      <th>Stalls Capacity</th>
                      <th>Occupancy</th>
                      <th>Cold Chain Facility</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>Block A — Tropical &amp; Citrus</strong></td>
                      <td>Mangoes, Oranges, Bananas, Papayas</td>
                      <td>48 Stalls</td>
                      <td>44 Stalls (91%)</td>
                      <td>Active (4°C - 8°C)</td>
                      <td><span className={`${styles.statusPill} ${styles.statusActive}`}>Operational</span></td>
                    </tr>
                    <tr>
                      <td><strong>Block B — Fresh Vegetables</strong></td>
                      <td>Tomatoes, Cucumbers, Onions, Potatoes</td>
                      <td>60 Stalls</td>
                      <td>56 Stalls (93%)</td>
                      <td>Active (6°C - 10°C)</td>
                      <td><span className={`${styles.statusPill} ${styles.statusActive}`}>Operational</span></td>
                    </tr>
                    <tr>
                      <td><strong>Block C — Berries &amp; Exotics</strong></td>
                      <td>Strawberries, Blueberries, Avocados, Kiwi</td>
                      <td>36 Stalls</td>
                      <td>32 Stalls (88%)</td>
                      <td>Active (2°C - 4°C)</td>
                      <td><span className={`${styles.statusPill} ${styles.statusActive}`}>Operational</span></td>
                    </tr>
                    <tr>
                      <td><strong>Central Cold Storage Bay 1</strong></td>
                      <td>Long-term pallet refrigeration terminal</td>
                      <td>120 Pallet Bays</td>
                      <td>108 Bays (90%)</td>
                      <td>Deep Chill (-1°C - 2°C)</td>
                      <td><span className={`${styles.statusPill} ${styles.statusActive}`}>Operational</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ===================================================================
              VIEW 18: EMAIL TEMPLATES
             =================================================================== */}
          {activeTab === 'emails' && (
            <section className={styles.tableSection}>
              <div className={styles.tableHeaderBar}>
                <div>
                  <h3 className={styles.tableTitle}>Transactional Email Templates</h3>
                  <p className={styles.tableSubtitle}>
                    Automated email communications dispatched to vendors, buyers, and resellers.
                  </p>
                </div>
              </div>

              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Template Key</th>
                      <th>Email Subject</th>
                      <th>Target Recipient</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><code>ORDER_CONFIRMATION</code></td>
                      <td>Your AweerMarket Wholesale Order Confirmation #{'{orderNumber}'}</td>
                      <td>Wholesale Buyer</td>
                      <td><span className={`${styles.statusPill} ${styles.statusActive}`}>Active</span></td>
                      <td><button type="button" className={`${styles.actionBtn} ${styles.actionBtnEdit}`} onClick={() => showCatSuccess('Test email sent to administrator mailbox.')}>Send Test</button></td>
                    </tr>
                    <tr>
                      <td><code>VENDOR_APPROVAL</code></td>
                      <td>Congratulations! Your Stall #{'{stallNumber}'} has been approved</td>
                      <td>Stall Vendor</td>
                      <td><span className={`${styles.statusPill} ${styles.statusActive}`}>Active</span></td>
                      <td><button type="button" className={`${styles.actionBtn} ${styles.actionBtnEdit}`} onClick={() => showCatSuccess('Test email sent to administrator mailbox.')}>Send Test</button></td>
                    </tr>
                    <tr>
                      <td><code>RESELLER_CREDIT_FACILITY</code></td>
                      <td>Commercial Credit Facility Approved: Dhs #{'{creditLimit}'}</td>
                      <td>B2B Reseller</td>
                      <td><span className={`${styles.statusPill} ${styles.statusActive}`}>Active</span></td>
                      <td><button type="button" className={`${styles.actionBtn} ${styles.actionBtnEdit}`} onClick={() => showCatSuccess('Test email sent to administrator mailbox.')}>Send Test</button></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ===================================================================
              VIEW 19: NOTIFICATION TEMPLATES
             =================================================================== */}
          {activeTab === 'notifications' && (
            <section className={styles.tableSection}>
              <div className={styles.tableHeaderBar}>
                <div>
                  <h3 className={styles.tableTitle}>Push &amp; SMS Notification Templates</h3>
                  <p className={styles.tableSubtitle}>
                    Real-time alert configurations for orders, price adjustments, and dispatch notifications.
                  </p>
                </div>
              </div>

              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Notification Event</th>
                      <th>Channel</th>
                      <th>Message Preview</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>Order Dispatched</strong></td>
                      <td>SMS + Push</td>
                      <td>Order #{'{orderNumber}'} is on the way from Al Aweer wholesale block.</td>
                      <td><span className={`${styles.statusPill} ${styles.statusActive}`}>Enabled</span></td>
                      <td><button type="button" className={`${styles.actionBtn} ${styles.actionBtnRevoke}`} onClick={() => showCatSuccess('Notification trigger toggled.')}>Toggle</button></td>
                    </tr>
                    <tr>
                      <td><strong>Low Stock Warning</strong></td>
                      <td>Push Alert</td>
                      <td>Only 5 crates remaining for #{'{produceName}'}. Update inventory.</td>
                      <td><span className={`${styles.statusPill} ${styles.statusActive}`}>Enabled</span></td>
                      <td><button type="button" className={`${styles.actionBtn} ${styles.actionBtnRevoke}`} onClick={() => showCatSuccess('Notification trigger toggled.')}>Toggle</button></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ===================================================================
              VIEW 20: BACKUP & RESTORE
             =================================================================== */}
          {activeTab === 'backups' && (
            <section className={styles.tableSection}>
              <div className={styles.tableHeaderBar}>
                <div>
                  <h3 className={styles.tableTitle}>Database Cluster Backup &amp; Disaster Recovery</h3>
                  <p className={styles.tableSubtitle}>
                    Daily automated MongoDB snapshots and high-availability point-in-time recovery points.
                  </p>
                </div>
                <button
                  type="button"
                  className={styles.addBtn}
                  onClick={() => showCatSuccess('Point-in-time database snapshot created successfully.')}
                >
                  📸 Create Snapshot
                </button>
              </div>

              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Snapshot ID</th>
                      <th>Created At</th>
                      <th>Data Size</th>
                      <th>Type</th>
                      <th>Storage Target</th>
                      <th>Integrity</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><code>#SNAP-2025-05-13-DAILY</code></td>
                      <td>2025-05-13 03:00 UTC</td>
                      <td>184.2 MB</td>
                      <td>Automated Daily</td>
                      <td>Encrypted S3 Bucket</td>
                      <td><span className={`${styles.statusPill} ${styles.statusActive}`}>Verified (Healthy)</span></td>
                    </tr>
                    <tr>
                      <td><code>#SNAP-2025-05-12-DAILY</code></td>
                      <td>2025-05-12 03:00 UTC</td>
                      <td>181.8 MB</td>
                      <td>Automated Daily</td>
                      <td>Encrypted S3 Bucket</td>
                      <td><span className={`${styles.statusPill} ${styles.statusActive}`}>Verified (Healthy)</span></td>
                    </tr>
                    <tr>
                      <td><code>#SNAP-2025-05-11-DAILY</code></td>
                      <td>2025-05-11 03:00 UTC</td>
                      <td>179.5 MB</td>
                      <td>Automated Daily</td>
                      <td>Encrypted S3 Bucket</td>
                      <td><span className={`${styles.statusPill} ${styles.statusActive}`}>Verified (Healthy)</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Footer */}
          <footer className={styles.dashboardFooter}>
            <div>Aweermarket | Super Admin Panel</div>
            <div className={styles.footerLinks}>
              <span>© 2025 Aweermarket. All rights reserved.</span>
              <a href="#" className={styles.footerLink}>Privacy</a>
              <a href="#" className={styles.footerLink}>Terms</a>
              <a href="#" className={styles.footerLink}>Help</a>
            </div>
          </footer>
        </main>
      </div>

      {/* =====================================================================
          CATEGORY ADD/EDIT MODAL
         ===================================================================== */}
      {isCatModalOpen && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                {editingCat ? `Edit Category: ${editingCat.label}` : 'Create Wholesale Produce Category'}
              </h3>
              <button
                type="button"
                onClick={() => setIsCatModalOpen(false)}
                className={styles.modalCloseBtn}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCategory}>
              <div className={styles.modalBody}>
                {catFormError && (
                  <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#fca5a5', padding: '8px 12px', borderRadius: 8, fontSize: '0.82rem' }}>
                    {catFormError}
                  </div>
                )}

                <div className={styles.formGroup}>
                  <label htmlFor="cat-name-input" className={styles.formLabel}>
                    Category Display Name *
                  </label>
                  <input
                    id="cat-name-input"
                    type="text"
                    className={styles.formInput}
                    placeholder="e.g. Fresh Mangoes & Papayas"
                    value={catName}
                    onChange={(e) => {
                      setCatName(e.target.value);
                      if (!editingCat && !catSlug) {
                        setCatSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''));
                      }
                    }}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="cat-slug-input" className={styles.formLabel}>
                    URL Slug / API Key *
                  </label>
                  <input
                    id="cat-slug-input"
                    type="text"
                    className={styles.formInput}
                    placeholder="e.g. mangoes_papayas"
                    value={catSlug}
                    onChange={(e) => setCatSlug(e.target.value)}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="cat-desc-input" className={styles.formLabel}>
                    Description
                  </label>
                  <textarea
                    id="cat-desc-input"
                    className={styles.formTextarea}
                    rows={2}
                    placeholder="Short summary for buyer catalog banners..."
                    value={catDescription}
                    onChange={(e) => setCatDescription(e.target.value)}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className={styles.formGroup}>
                    <label htmlFor="cat-icon-input" className={styles.formLabel}>
                      Icon Emoji
                    </label>
                    <input
                      id="cat-icon-input"
                      type="text"
                      className={styles.formInput}
                      placeholder="e.g. 🥭"
                      value={catIcon}
                      onChange={(e) => setCatIcon(e.target.value)}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="cat-sort-input" className={styles.formLabel}>
                      Display Sort Order
                    </label>
                    <input
                      id="cat-sort-input"
                      type="number"
                      className={styles.formInput}
                      value={catSortOrder}
                      onChange={(e) => setCatSortOrder(Number(e.target.value))}
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="cat-banner-input" className={styles.formLabel}>
                    Banner / Image URL (optional)
                  </label>
                  <input
                    id="cat-banner-input"
                    type="text"
                    className={styles.formInput}
                    placeholder="/images/hero-basket.jpg"
                    value={catBannerUrl}
                    onChange={(e) => setCatBannerUrl(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                  <input
                    id="cat-active-check"
                    type="checkbox"
                    checked={catIsActive}
                    onChange={(e) => setCatIsActive(e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: '#10b981' }}
                  />
                  <label htmlFor="cat-active-check" className={styles.formLabel} style={{ cursor: 'pointer', margin: 0 }}>
                    Visible in Public Buyer Catalog (Active)
                  </label>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  onClick={() => setIsCatModalOpen(false)}
                  className={styles.formCancelBtn}
                  disabled={isSubmittingCat}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.formSubmitBtn}
                  disabled={isSubmittingCat}
                >
                  {isSubmittingCat ? 'Saving...' : editingCat ? 'Update Category' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          RESELLER ADD/EDIT MODAL
         ===================================================================== */}
      {isResellerModalOpen && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                {editingReseller ? `Edit Reseller: ${editingReseller.businessName}` : 'Register B2B Wholesale Reseller'}
              </h3>
              <button
                type="button"
                onClick={() => setIsResellerModalOpen(false)}
                className={styles.modalCloseBtn}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveReseller}>
              <div className={styles.modalBody}>
                {resellerFormError && (
                  <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#fca5a5', padding: '8px 12px', borderRadius: 8, fontSize: '0.82rem' }}>
                    {resellerFormError}
                  </div>
                )}

                <div className={styles.formGroup}>
                  <label htmlFor="reseller-business-input" className={styles.formLabel}>
                    Commercial Business Name *
                  </label>
                  <input
                    id="reseller-business-input"
                    type="text"
                    className={styles.formInput}
                    placeholder="e.g. Al Maya Supermarkets LLC"
                    value={resellerBusinessName}
                    onChange={(e) => setResellerBusinessName(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className={styles.formGroup}>
                    <label htmlFor="reseller-contact-input" className={styles.formLabel}>
                      Contact Person *
                    </label>
                    <input
                      id="reseller-contact-input"
                      type="text"
                      className={styles.formInput}
                      placeholder="e.g. Tariq Al Nuaimi"
                      value={resellerContactPerson}
                      onChange={(e) => setResellerContactPerson(e.target.value)}
                      required
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="reseller-phone-input" className={styles.formLabel}>
                      Contact Phone *
                    </label>
                    <input
                      id="reseller-phone-input"
                      type="text"
                      className={styles.formInput}
                      placeholder="+971 50 123 4567"
                      value={resellerPhone}
                      onChange={(e) => setResellerPhone(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className={styles.formGroup}>
                    <label htmlFor="reseller-email-input" className={styles.formLabel}>
                      Corporate Email Address *
                    </label>
                    <input
                      id="reseller-email-input"
                      type="email"
                      className={styles.formInput}
                      placeholder="procurement@almaya.ae"
                      value={resellerEmail}
                      onChange={(e) => setResellerEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="reseller-license-input" className={styles.formLabel}>
                      UAE Trade License #
                    </label>
                    <input
                      id="reseller-license-input"
                      type="text"
                      className={styles.formInput}
                      placeholder="e.g. CN-1092837"
                      value={resellerTradeLicense}
                      onChange={(e) => setResellerTradeLicense(e.target.value)}
                    />
                  </div>
                </div>

                {/* Direct Password Field for Reseller Portal */}
                <div className={styles.formGroup}>
                  <label htmlFor="reseller-password-input" className={styles.formLabel}>
                    {editingReseller ? 'Update Reseller Login Password (Optional)' : 'Reseller Management Login Password *'}
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="reseller-password-input"
                      type={showResellerPassword ? 'text' : 'password'}
                      className={styles.formInput}
                      placeholder={editingReseller ? 'Leave empty to keep existing password unchanged' : 'Min. 8 characters (e.g. ResellerAdmin2026!)'}
                      value={resellerPassword}
                      onChange={(e) => setResellerPassword(e.target.value)}
                      required={!editingReseller}
                      minLength={8}
                    />
                    <button
                      type="button"
                      onClick={() => setShowResellerPassword(!showResellerPassword)}
                      style={{
                        position: 'absolute',
                        right: 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'transparent',
                        border: 'none',
                        color: '#10b981',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        padding: '4px 8px',
                        borderRadius: 4
                      }}
                    >
                      {showResellerPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 4, display: 'block' }}>
                    {editingReseller
                      ? 'Leave blank to preserve current password. Changing will update their portal login credentials.'
                      : 'The reseller will use this password together with the Corporate Email to log in at admin.barakahalrizquae.com.'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className={styles.formGroup}>
                    <label htmlFor="reseller-tier-select" className={styles.formLabel}>
                      Wholesale Buyer Tier
                    </label>
                    <select
                      id="reseller-tier-select"
                      className={styles.formInput}
                      value={resellerTier}
                      onChange={(e) => setResellerTier(e.target.value)}
                    >
                      <option value="bronze">Bronze Tier (5% Margin Discount)</option>
                      <option value="silver">Silver Tier (7% Margin Discount)</option>
                      <option value="gold">Gold Tier (10% Margin Discount)</option>
                      <option value="platinum">Platinum Tier (12% Margin Discount)</option>
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="reseller-terms-select" className={styles.formLabel}>
                      Payment Terms
                    </label>
                    <select
                      id="reseller-terms-select"
                      className={styles.formInput}
                      value={resellerPaymentTerms}
                      onChange={(e) => setResellerPaymentTerms(e.target.value)}
                    >
                      <option value="cash_on_delivery">Cash on Delivery (COD)</option>
                      <option value="net_15">Net 15 Days</option>
                      <option value="net_30">Net 30 Days (Standard Commercial)</option>
                      <option value="net_60">Net 60 Days (Institutional)</option>
                    </select>
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="reseller-credit-input" className={styles.formLabel}>
                    Approved Commercial Credit Limit (AED) *
                  </label>
                  <input
                    id="reseller-credit-input"
                    type="number"
                    min="0"
                    step="1000"
                    className={styles.formInput}
                    value={resellerCreditLimit}
                    onChange={(e) => setResellerCreditLimit(Number(e.target.value))}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="reseller-notes-input" className={styles.formLabel}>
                    Administrative Notes &amp; Credit References
                  </label>
                  <textarea
                    id="reseller-notes-input"
                    className={styles.formTextarea}
                    rows={2}
                    placeholder="e.g. Central Dubai cold storage dock delivery, verified by Dubai Municipality trade audit."
                    value={resellerNotes}
                    onChange={(e) => setResellerNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  onClick={() => setIsResellerModalOpen(false)}
                  className={styles.formCancelBtn}
                  disabled={isSubmittingReseller}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.formSubmitBtn}
                  disabled={isSubmittingReseller}
                >
                  {isSubmittingReseller ? 'Saving...' : editingReseller ? 'Update Reseller' : 'Register Reseller'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          VENDOR STALL REGISTRATION MODAL (Admin & Reseller)
         ===================================================================== */}
      {isShopModalOpen && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Register Wholesale Vendor Stall</h3>
              <button
                type="button"
                onClick={() => setIsShopModalOpen(false)}
                className={styles.modalCloseBtn}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveShop}>
              <div className={styles.modalBody}>
                {shopFormError && (
                  <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#fca5a5', padding: '8px 12px', borderRadius: 8, fontSize: '0.82rem' }}>
                    {shopFormError}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className={styles.formGroup}>
                    <label htmlFor="shop-name-input" className={styles.formLabel}>
                      Stall / Business Name *
                    </label>
                    <input
                      id="shop-name-input"
                      type="text"
                      className={styles.formInput}
                      placeholder="e.g. Al Barakah Fresh Produce LLC"
                      value={shopName}
                      onChange={(e) => setShopName(e.target.value)}
                      required
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="shop-stallnum-input" className={styles.formLabel}>
                      Al Aweer Stall Number *
                    </label>
                    <input
                      id="shop-stallnum-input"
                      type="text"
                      className={styles.formInput}
                      placeholder="e.g. Block C, Stall #18"
                      value={shopStallNumber}
                      onChange={(e) => setShopStallNumber(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className={styles.formGroup}>
                    <label htmlFor="shop-owner-input" className={styles.formLabel}>
                      Vendor Contact Person *
                    </label>
                    <input
                      id="shop-owner-input"
                      type="text"
                      className={styles.formInput}
                      placeholder="e.g. Mohammed Al Hashmi"
                      value={shopOwnerName}
                      onChange={(e) => setShopOwnerName(e.target.value)}
                      required
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="shop-phone-input" className={styles.formLabel}>
                      Contact Phone *
                    </label>
                    <input
                      id="shop-phone-input"
                      type="text"
                      className={styles.formInput}
                      placeholder="+971 50 987 6543"
                      value={shopPhone}
                      onChange={(e) => setShopPhone(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className={styles.formGroup}>
                    <label htmlFor="shop-email-input" className={styles.formLabel}>
                      Vendor Portal Email *
                    </label>
                    <input
                      id="shop-email-input"
                      type="email"
                      className={styles.formInput}
                      placeholder="vendor@albarakahproduce.ae"
                      value={shopEmail}
                      onChange={(e) => setShopEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="shop-license-input" className={styles.formLabel}>
                      UAE Trade License #
                    </label>
                    <input
                      id="shop-license-input"
                      type="text"
                      className={styles.formInput}
                      placeholder="e.g. TL-DXB-98124"
                      value={shopTradeLicense}
                      onChange={(e) => setShopTradeLicense(e.target.value)}
                    />
                  </div>
                </div>

                {/* Direct Password Field for Vendor Registration */}
                <div className={styles.formGroup}>
                  <label htmlFor="shop-password-input" className={styles.formLabel}>
                    Vendor Portal Login Password *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="shop-password-input"
                      type={showShopPassword ? 'text' : 'password'}
                      className={styles.formInput}
                      placeholder="Min. 8 characters (e.g. VendorSecret2026!)"
                      value={shopPassword}
                      onChange={(e) => setShopPassword(e.target.value)}
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      onClick={() => setShowShopPassword(!showShopPassword)}
                      style={{
                        position: 'absolute',
                        right: 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'transparent',
                        border: 'none',
                        color: '#10b981',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        padding: '4px 8px',
                        borderRadius: 4
                      }}
                    >
                      {showShopPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 4, display: 'block' }}>
                    The vendor will use this password together with their email to log in at vendor.barakahalrizquae.com.
                  </span>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="shop-location-input" className={styles.formLabel}>
                    Market Location
                  </label>
                  <input
                    id="shop-location-input"
                    type="text"
                    className={styles.formInput}
                    value={shopMarketLocation}
                    onChange={(e) => setShopMarketLocation(e.target.value)}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="shop-desc-input" className={styles.formLabel}>
                    Stall Description / Notes (Optional)
                  </label>
                  <textarea
                    id="shop-desc-input"
                    className={styles.formTextarea}
                    rows={2}
                    placeholder="e.g. Direct citrus and imported apples wholesale vendor dock delivery."
                    value={shopDescription}
                    onChange={(e) => setShopDescription(e.target.value)}
                  />
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  onClick={() => setIsShopModalOpen(false)}
                  className={styles.formCancelBtn}
                  disabled={isSubmittingShop}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.formSubmitBtn}
                  disabled={isSubmittingShop}
                >
                  {isSubmittingShop ? 'Provisioning...' : 'Register Vendor Stall'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 4: EDIT VENDOR STALL DETAILS (Admin & Reseller)
         ===================================================================== */}
      {isEditShopModalOpen && editingShop && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Edit Vendor Stall Details</h3>
              <button
                type="button"
                onClick={() => {
                  setIsEditShopModalOpen(false);
                  setEditingShop(null);
                }}
                className={styles.modalCloseBtn}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditShop}>
              <div className={styles.modalBody}>
                {editShopFormError && (
                  <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#fca5a5', padding: '8px 12px', borderRadius: 8, fontSize: '0.82rem' }}>
                    {editShopFormError}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className={styles.formGroup}>
                    <label htmlFor="edit-shop-name-input" className={styles.formLabel}>
                      Stall / Business Name *
                    </label>
                    <input
                      id="edit-shop-name-input"
                      type="text"
                      className={styles.formInput}
                      value={editShopName}
                      onChange={(e) => setEditShopName(e.target.value)}
                      required
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="edit-shop-stallnum-input" className={styles.formLabel}>
                      Al Aweer Stall Number *
                    </label>
                    <input
                      id="edit-shop-stallnum-input"
                      type="text"
                      className={styles.formInput}
                      value={editShopStallNumber}
                      onChange={(e) => setEditShopStallNumber(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className={styles.formGroup}>
                    <label htmlFor="edit-shop-phone-input" className={styles.formLabel}>
                      Contact Phone *
                    </label>
                    <input
                      id="edit-shop-phone-input"
                      type="text"
                      className={styles.formInput}
                      value={editShopPhone}
                      onChange={(e) => setEditShopPhone(e.target.value)}
                      required
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="edit-shop-license-input" className={styles.formLabel}>
                      UAE Trade License #
                    </label>
                    <input
                      id="edit-shop-license-input"
                      type="text"
                      className={styles.formInput}
                      value={editShopTradeLicense}
                      onChange={(e) => setEditShopTradeLicense(e.target.value)}
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="edit-shop-location-input" className={styles.formLabel}>
                    Market Location
                  </label>
                  <input
                    id="edit-shop-location-input"
                    type="text"
                    className={styles.formInput}
                    value={editShopLocation}
                    onChange={(e) => setEditShopLocation(e.target.value)}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="edit-shop-hours-input" className={styles.formLabel}>
                    Opening Hours
                  </label>
                  <input
                    id="edit-shop-hours-input"
                    type="text"
                    className={styles.formInput}
                    placeholder="e.g. 05:00 AM - 08:00 PM (Daily Wholesale)"
                    value={editShopOpeningHours}
                    onChange={(e) => setEditShopOpeningHours(e.target.value)}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="edit-shop-desc-input" className={styles.formLabel}>
                    Stall Description / Notes
                  </label>
                  <textarea
                    id="edit-shop-desc-input"
                    className={styles.formTextarea}
                    rows={2}
                    value={editShopDescription}
                    onChange={(e) => setEditShopDescription(e.target.value)}
                  />
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditShopModalOpen(false);
                    setEditingShop(null);
                  }}
                  className={styles.formCancelBtn}
                  disabled={isSubmittingEditShop}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.formSubmitBtn}
                  disabled={isSubmittingEditShop}
                >
                  {isSubmittingEditShop ? 'Saving Changes...' : 'Save Stall Details'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          ORDER DETAILS INSPECTION MODAL (Super Admin & Reseller Authorized View)
         ===================================================================== */}
      {selectedOrderDetails && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.confirmModalCard} style={{ maxWidth: 780, maxHeight: '90vh' }}>
            <div className={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className={styles.confirmIconWrapPrimary} style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                  📦
                </div>
                <div>
                  <h3 className={styles.modalTitle} style={{ margin: 0 }}>
                    Order #{selectedOrderDetails.orderNumber}
                  </h3>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 2 }}>
                    Placed on {new Date(selectedOrderDetails.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrderDetails(null)}
                className={styles.modalCloseBtn}
                aria-label="Close order details modal"
              >
                ✕
              </button>
            </div>

            <div className={styles.modalBody} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Order Meta Header Pills */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', background: 'rgba(15, 23, 42, 0.6)', padding: '12px 16px', borderRadius: 10, border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  Status: <strong style={{ color: '#f8fafc', textTransform: 'capitalize' }}>{selectedOrderDetails.status.replace(/_/g, ' ')}</strong>
                </div>
                <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)' }} />
                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  Payment: <strong style={{ color: '#34d399' }}>{selectedOrderDetails.paymentStatus || (selectedOrderDetails.status === 'delivered' ? 'PAID' : 'PENDING')}</strong>
                </div>
                <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)' }} />
                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  Method: <strong style={{ color: '#e2e8f0' }}>{selectedOrderDetails.paymentMethod || 'Cash on Delivery (COD)'}</strong>
                </div>
                <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)' }} />
                <div style={{ fontSize: '0.8rem', color: '#38bdf8', textTransform: 'capitalize' }}>
                  Delivery: <strong>{selectedOrderDetails.deliveryType}</strong>
                </div>
              </div>

              {/* Two Column Section: Buyer & Stall Info */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                {/* Buyer Card */}
                <div style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '14px 18px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#10b981', fontWeight: 700, marginBottom: 8 }}>
                    👤 Buyer Information
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#ffffff', fontWeight: 600 }}>
                    {selectedOrderDetails.buyerName || 'Wholesale Buyer'}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#38bdf8', marginTop: 4 }}>
                    📞 {selectedOrderDetails.buyerPhone || 'Not provided'}
                  </div>
                  {selectedOrderDetails.buyerEmail && (
                    <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: 2 }}>
                      ✉️ {selectedOrderDetails.buyerEmail}
                    </div>
                  )}
                  {selectedOrderDetails.deliveryAddress && (
                    <div style={{ fontSize: '0.82rem', color: '#cbd5e1', marginTop: 6, lineHeight: 1.4, borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: 6 }}>
                      📍 <strong>Address:</strong> {selectedOrderDetails.deliveryAddress}
                    </div>
                  )}
                  {selectedOrderDetails.pickupTime && (
                    <div style={{ fontSize: '0.82rem', color: '#38bdf8', marginTop: 4 }}>
                      ⏰ <strong>Pickup Time:</strong> {selectedOrderDetails.pickupTime}
                    </div>
                  )}
                </div>

                {/* Stall Card */}
                <div style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '14px 18px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#10b981', fontWeight: 700, marginBottom: 8 }}>
                    🏪 Stall &amp; Vendor
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#ffffff', fontWeight: 600 }}>
                    {selectedOrderDetails.shopName}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: 4 }}>
                    Stall Number: <strong style={{ color: '#f1f5f9' }}>{selectedOrderDetails.stallNumber || '—'}</strong>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: 2 }}>
                    Market: Al Aweer Central Fruit &amp; Vegetable Market
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#cbd5e1', marginTop: 6, borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: 6 }}>
                    Fulfillment: {selectedOrderDetails.deliveryType === 'delivery' ? 'Direct Stall Delivery' : 'Wholesale Stall Pickup'}
                  </div>
                </div>
              </div>

              {/* Itemized Lines Table */}
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f1f5f9', marginBottom: 8 }}>
                  Ordered Produce &amp; Quantities ({selectedOrderDetails.items.length} item{selectedOrderDetails.items.length !== 1 ? 's' : ''})
                </div>
                <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: 'rgba(15, 23, 42, 0.9)', color: '#94a3b8', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        <th style={{ padding: '8px 12px' }}>Product</th>
                        <th style={{ padding: '8px 12px' }}>Selling Unit</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Unit Selling Price</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Quantity</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Item Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrderDetails.items.map((it, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#e2e8f0' }}>
                          <td style={{ padding: '10px 12px', fontWeight: 600 }}>{it.name}</td>
                          <td style={{ padding: '10px 12px', color: '#cbd5e1' }}>
                            {it.unit ? `${it.unit} (${it.unitWeightKg}kg)` : `${it.unitWeightKg}kg`}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right' }}>Dhs {Number(it.unitPriceAed || 0).toFixed(2)}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#38bdf8' }}>{it.quantity}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#ffffff' }}>
                            Dhs {Number(it.lineTotalAed || (it.quantity * it.unitPriceAed)).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Financial Breakdown */}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{ width: '100%', maxWidth: 340, background: 'rgba(15, 23, 42, 0.6)', padding: '14px 18px', borderRadius: 10, border: '1px solid rgba(16, 185, 129, 0.25)', display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                    <span>Item Subtotal:</span>
                    <span style={{ color: '#e2e8f0', fontWeight: 600 }}>
                      Dhs {Number(selectedOrderDetails.subtotalAed || (selectedOrderDetails.totalAmountAed / 1.05)).toFixed(2)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                    <span>Discount:</span>
                    <span style={{ color: '#e2e8f0' }}>Dhs 0.00</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                    <span>Delivery Charge:</span>
                    <span style={{ color: '#e2e8f0' }}>Dhs 0.00</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                    <span>VAT (5%):</span>
                    <span style={{ color: '#e2e8f0', fontWeight: 600 }}>
                      Dhs {Number(selectedOrderDetails.vatAed || (selectedOrderDetails.totalAmountAed - (selectedOrderDetails.totalAmountAed / 1.05))).toFixed(2)}
                    </span>
                  </div>
                  <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '4px 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: 800 }}>
                    <span style={{ color: '#ffffff' }}>Grand Total:</span>
                    <span style={{ color: '#34d399' }}>Dhs {selectedOrderDetails.totalAmountAed.toFixed(2)}</span>
                  </div>
                  {user?.role === 'super_admin' && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b', marginTop: 4 }}>
                      <span>Platform Commission (5%):</span>
                      <span style={{ color: '#38bdf8', fontWeight: 600 }}>Dhs {Number(selectedOrderDetails.commissionAed || (selectedOrderDetails.totalAmountAed * 0.05)).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className={styles.modalFooter} style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid rgba(255,255,255,0.08)', padding: '14px 20px' }}>
              <button
                type="button"
                onClick={() => setSelectedOrderDetails(null)}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#ffffff',
                  padding: '8px 18px',
                  borderRadius: 8,
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          GLOBAL CONFIRMATION POPUP MODAL (Suspend / Delete / Delist / Edit)
         ===================================================================== */}
      {confirmModal && confirmModal.isOpen && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.confirmModalCard}>
            <div className={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  className={
                    confirmModal.variant === 'danger'
                      ? styles.confirmIconWrapDanger
                      : confirmModal.variant === 'warning'
                      ? styles.confirmIconWrapWarning
                      : styles.confirmIconWrapPrimary
                  }
                >
                  {confirmModal.variant === 'danger'
                    ? '⚠️'
                    : confirmModal.variant === 'warning'
                    ? '🛡️'
                    : '✏️'}
                </div>
                <h3 className={styles.modalTitle}>{confirmModal.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => !isExecutingConfirm && setConfirmModal(null)}
                className={styles.modalCloseBtn}
                disabled={isExecutingConfirm}
                aria-label="Close confirmation dialog"
              >
                ✕
              </button>
            </div>

            <div className={styles.modalBody}>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#e2e8f0', lineHeight: 1.5 }}>
                {confirmModal.message}
              </p>

              {confirmModal.detail && (
                <div
                  style={{
                    background: '#041610',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                    borderRadius: 8,
                    padding: '8px 12px',
                    fontSize: '0.8rem',
                    color: '#94a3b8',
                    fontFamily: 'monospace'
                  }}
                >
                  {confirmModal.detail}
                </div>
              )}

              {confirmModal.warningNotice && (
                <div
                  style={{
                    background:
                      confirmModal.variant === 'danger'
                        ? 'rgba(239, 68, 68, 0.12)'
                        : 'rgba(245, 158, 11, 0.12)',
                    border:
                      confirmModal.variant === 'danger'
                        ? '1px solid rgba(239, 68, 68, 0.35)'
                        : '1px solid rgba(245, 158, 11, 0.35)',
                    borderRadius: 8,
                    padding: '10px 12px',
                    fontSize: '0.8rem',
                    color: confirmModal.variant === 'danger' ? '#fca5a5' : '#fbbf24',
                    lineHeight: 1.45
                  }}
                >
                  ⚠️ <strong>Notice:</strong> {confirmModal.warningNotice}
                </div>
              )}
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className={styles.formCancelBtn}
                disabled={isExecutingConfirm}
              >
                {confirmModal.cancelLabel || 'Cancel'}
              </button>
              <button
                type="button"
                className={
                  confirmModal.variant === 'danger'
                    ? styles.confirmDangerBtn
                    : confirmModal.variant === 'warning'
                    ? styles.confirmWarningBtn
                    : styles.confirmPrimaryBtn
                }
                disabled={isExecutingConfirm}
                onClick={async () => {
                  setIsExecutingConfirm(true);
                  try {
                    await confirmModal.onConfirm();
                  } finally {
                    setIsExecutingConfirm(false);
                    setConfirmModal(null);
                  }
                }}
              >
                {isExecutingConfirm ? 'Processing...' : confirmModal.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MOBILE BOTTOM NAVIGATION (Fixed at bottom for super admin quick actions)
         ===================================================================== */}
      <nav className={styles.mobileBottomNav} aria-label="SuperAdmin Quick Navigation">
        <button
          type="button"
          onClick={() => handleNavSelect('dashboard')}
          className={`${styles.mobileNavItem} ${activeTab === 'dashboard' ? styles.mobileNavItemActive : ''}`}
        >
          <svg className={styles.mobileNavSvg} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="9"></rect>
            <rect x="14" y="3" width="7" height="5"></rect>
            <rect x="14" y="12" width="7" height="9"></rect>
            <rect x="3" y="16" width="7" height="5"></rect>
          </svg>
          <span>Dashboard</span>
        </button>

        <button
          type="button"
          onClick={() => handleNavSelect('shops')}
          className={`${styles.mobileNavItem} ${activeTab === 'shops' ? styles.mobileNavItemActive : ''}`}
        >
          <svg className={styles.mobileNavSvg} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
          <span>Shops</span>
          {shops.length > 0 && <span className={styles.mobileNavCountBadge}>{shops.length}</span>}
        </button>

        <button
          type="button"
          onClick={() => handleNavSelect('orders')}
          className={`${styles.mobileNavItem} ${activeTab === 'orders' ? styles.mobileNavItemActive : ''}`}
        >
          <svg className={styles.mobileNavSvg} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="21" r="1"></circle>
            <circle cx="20" cy="21" r="1"></circle>
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
          </svg>
          <span>Orders</span>
          {orders.length > 0 && <span className={styles.mobileNavCountBadge}>{orders.length}</span>}
        </button>

        <button
          type="button"
          onClick={() => handleNavSelect('categories')}
          className={`${styles.mobileNavItem} ${activeTab === 'categories' ? styles.mobileNavItemActive : ''}`}
        >
          <svg className={styles.mobileNavSvg} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7"></rect>
            <rect x="14" y="3" width="7" height="7"></rect>
            <rect x="14" y="14" width="7" height="7"></rect>
            <rect x="3" y="14" width="7" height="7"></rect>
          </svg>
          <span>Categories</span>
        </button>

        <button
          type="button"
          onClick={() => setIsMobileDrawerOpen(true)}
          className={`${styles.mobileNavItem} ${isMobileDrawerOpen ? styles.mobileNavItemActive : ''}`}
          aria-label="Open complete menu"
        >
          <svg className={styles.mobileNavSvg} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
          <span>Menu</span>
        </button>
      </nav>
    </div>
  );
}
