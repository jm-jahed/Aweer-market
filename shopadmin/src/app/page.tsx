'use client';

import React, { useState, useEffect, useCallback, FormEvent, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';

import { useShopAdminAuth } from '../lib/auth-context';
import {
  updateVendorShop,
  getVendorProducts,
  createVendorProduct,
  updateVendorOffer,
  toggleVendorProductPublish,
  adjustVendorProductStock,
  getVendorOrders,
  updateVendorOrderStatus,
  getCategories,
  uploadProductImage,
  deleteProductImage,
  VendorProductItem,
  VendorOrderSummary,
  CategoryItem
} from '../lib/api-client';
import { ProductCategory, WholesaleUnit, getDefaultUnitWeightKg } from '@aweermarket/types';
import { getCountryFlag, formatCountryWithFlag, COMMON_PRODUCE_ORIGINS } from '../lib/country-flags';
import styles from './Dashboard.module.css';

// Pre-defined produce options with realistic local imagery & automated category mapping
const PRODUCE_IMAGE_PRESETS: Array<{ label: string; src: string; category?: ProductCategory }> = [
  { label: 'Fresh Apples', src: '/images/apple.jpg', category: ProductCategory.FRESH_FRUITS },
  { label: 'Cavendish Bananas', src: '/images/banana.jpg', category: ProductCategory.FRESH_FRUITS },
  { label: 'Vine Tomatoes', src: '/images/tomato.jpg', category: ProductCategory.FRESH_VEGETABLES },
  { label: 'Dutch Potatoes', src: '/images/potato.jpg', category: ProductCategory.ROOT_VEGETABLES },
  { label: 'Red Onions', src: '/images/onion.jpg', category: ProductCategory.ROOT_VEGETABLES },
  { label: 'Sweet Carrots', src: '/images/carrots.jpg', category: ProductCategory.ROOT_VEGETABLES },
  { label: 'Wholesale Basket', src: '/images/hero-basket.jpg', category: ProductCategory.FRESH_FRUITS },
  { label: 'Market Aisle', src: '/images/market-aisle.jpg', category: ProductCategory.FRESH_VEGETABLES }
];

// Configured marketplace platform commission rate (e.g. 5% standard wholesale rate)
const MARKETPLACE_COMMISSION_RATE = 0.05;

/**
 * Intelligently extracts a short stall code (e.g., "M02", "ST-15", "A15")
 * avoiding full addresses or redundant prefixes in badges and KPI cards.
 */
function getStallShortCode(stall?: string): string {
  if (!stall) return '—';
  const trimmed = stall.trim();
  const firstPart = trimmed.split(',')[0].trim();
  const cleaned = firstPart
    .replace(/^(stall|unit|shop|no\.?|stall\s*no\.?)\s*#?\s*/i, '')
    .trim();
  return cleaned || firstPart;
}

/**
 * Cleanly formats a stall badge for headers, sidebars, and invoices without repeating "Stall #Stall"
 */
function formatStallBadge(stall?: string): string {
  if (!stall) return 'Al Aweer Market';
  const trimmed = stall.trim();
  const parts = trimmed.split(',').map((p) => p.trim()).filter(Boolean);
  const first = parts[0] || '';
  const second = parts[1] || '';

  let label = first;
  if (!/^(stall|unit|#)/i.test(first)) {
    label = `Stall #${first}`;
  } else if (!/^stall/i.test(first) && /^no\./i.test(first)) {
    label = `Stall ${first}`;
  }

  if (second && /building|bldg/i.test(second) && parts.length > 2) {
    const bldgShort = second.replace(/building\s*no\.?/i, 'Bldg').trim();
    return `${label} (${bldgShort})`;
  }

  return label;
}

export default function ShopAdminDashboard() {
  const router = useRouter();
  const { user, shop, isLoading: authLoading, logout, refreshShop } = useShopAdminAuth();

  // Active Tab: 12 distinct navigation views matching the Final Sidebar structure
  type NavTab =
    | 'dashboard'
    | 'products'
    | 'orders'
    | 'invoice'
    | 'inventory'
    | 'sales'
    | 'payouts'
    | 'profile'
    | 'customers'
    | 'reviews'
    | 'notifications'
    | 'settings';

  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  const handleNavSelect = useCallback((tab: NavTab) => {
    setActiveTab(tab);
    setIsMobileDrawerOpen(false);
  }, []);

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

  // Search input query
  const [searchQuery, setSearchQuery] = useState('');

  // Orders State
  const [orders, setOrders] = useState<VendorOrderSummary[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [selectedOrderForInvoice, setSelectedOrderForInvoice] = useState<VendorOrderSummary | null>(null);
  const [orderFilterStatus, setOrderFilterStatus] = useState<string>('all');

  // Products & Inventory State
  const [products, setProducts] = useState<VendorProductItem[]>([]);
  const [isLoadingInventory, setIsLoadingInventory] = useState(false);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [inventoryFilterCategory, setInventoryFilterCategory] = useState<string>('all');

  // Categories State (Read-only from Super Admin)
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [showCategoryExplorer, setShowCategoryExplorer] = useState(false);

  // Invoicing: Separate Marketplace vs Personal/Off-Platform Invoices
  type InvoiceSubTab = 'marketplace' | 'personal';
  const [invoiceSubTab, setInvoiceSubTab] = useState<InvoiceSubTab>('marketplace');

  interface PersonalInvoiceItem {
    name: string;
    unit: string;
    unitWeightKg: number;
    quantity: number;
    unitPriceAed: number;
    lineTotalAed: number;
  }

  interface PersonalInvoice {
    id: string;
    invoiceNumber: string;
    buyerName: string;
    buyerPhone: string;
    buyerTrn?: string;
    items: PersonalInvoiceItem[];
    subtotalAed: number;
    vatAed: number;
    totalAmountAed: number;
    createdAt: string;
    paymentMethod: string;
  }

  const [personalInvoices, setPersonalInvoices] = useState<PersonalInvoice[]>([]);
  const [selectedPersonalInvoice, setSelectedPersonalInvoice] = useState<PersonalInvoice | null>(null);
  const [isCreatePersonalInvoiceOpen, setIsCreatePersonalInvoiceOpen] = useState(false);

  // Personal Invoice Form Fields
  const [piBuyerName, setPiBuyerName] = useState('');
  const [piBuyerPhone, setPiBuyerPhone] = useState('');
  const [piBuyerTrn, setPiBuyerTrn] = useState('');
  const [piItemName, setPiItemName] = useState('Valencia Oranges (Grade A)');
  const [piItemUnit, setPiItemUnit] = useState<WholesaleUnit>(WholesaleUnit.BOX);
  const [piItemWeight, setPiItemWeight] = useState(15);
  const [piItemQuantity, setPiItemQuantity] = useState(10);
  const [piItemUnitPrice, setPiItemUnitPrice] = useState(40);
  const [piPaymentMethod, setPiPaymentMethod] = useState('Cash on Delivery at Stall');

  // Stock Movement History (Local Log)
  interface StockMovementLog {
    id: string;
    timestamp: string;
    productName: string;
    change: number;
    newStock: number;
    reason: string;
  }
  const [stockLogs, setStockLogs] = useState<StockMovementLog[]>([
    {
      id: 'log-init-1',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      productName: 'Initial Inventory',
      change: 0,
      newStock: 0,
      reason: 'Stall Inventory Initialized'
    }
  ]);

  // Add Product Modal Form (Strict 8-Field Specification)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [prodName, setProdName] = useState('');
  const [prodCategory, setProdCategory] = useState<string>('fresh_fruits');
  const [prodOrigin, setProdOrigin] = useState('');
  const [prodImageUrl, setProdImageUrl] = useState('');
  const [prodPrice, setProdPrice] = useState<number>(0);
  const [prodUnit, setProdUnit] = useState<string>('box');
  const [prodWeight, setProdWeight] = useState<number>(0);
  const [prodMoq, setProdMoq] = useState<number>(1);
  const [prodStock, setProdStock] = useState<number>(50);
  const [isSubmittingProd, setIsSubmittingProd] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null);
  const [draftUploadedKey, setDraftUploadedKey] = useState<string | null>(null);
  const draftUploadedKeyRef = useRef<string | null>(null);
  const [addModalError, setAddModalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cleanedDraftKeysRef = useRef<Set<string>>(new Set());

  // Non-blocking, safe cleanup helper for newly uploaded, unsaved draft images
  const safeCleanupDraftImage = useCallback(async (keyToClean: string | null) => {
    if (!keyToClean || typeof keyToClean !== 'string') return;
    if (cleanedDraftKeysRef.current.has(keyToClean)) return;
    cleanedDraftKeysRef.current.add(keyToClean);

    try {
      await deleteProductImage(keyToClean);
    } catch (err: unknown) {
      // Non-blocking: operational warning only, never break the UI
      console.warn('Draft image cleanup notice:', err);
    }
  }, []);

  const resetAddProductForm = (skipCleanup = false) => {
    // If a draft image was uploaded but form was canceled without saving, safely clean it up
    const key = draftUploadedKeyRef.current || draftUploadedKey;
    if (!skipCleanup && key) {
      safeCleanupDraftImage(key);
    }
    draftUploadedKeyRef.current = null;
    setDraftUploadedKey(null);
    setProdName('');
    const defaultCat = categories.find((c) => c.isActive !== false)?.slug || 'fresh_fruits';
    setProdCategory(defaultCat);
    setProdOrigin('');
    setProdImageUrl('');
    setUploadPreviewUrl(null);
    setIsUploadingImage(false);
    setProdPrice(0);
    setProdUnit('box');
    setProdWeight(0);
    setProdMoq(1);
    setProdStock(50);
    setAddModalError(null);
  };

  const processImageFile = async (file: File) => {
    if (!file) return;

    if (!file.type.match(/^image\/(jpeg|png|webp)$/i)) {
      setAddModalError('Please select a valid image file (JPEG, PNG, WebP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAddModalError('Image size exceeds 5MB limit. Please choose a smaller file.');
      return;
    }

    // Clean up previous unsubmitted draft image if replacing
    const prevKey = draftUploadedKeyRef.current || draftUploadedKey;
    if (prevKey) {
      safeCleanupDraftImage(prevKey);
      draftUploadedKeyRef.current = null;
      setDraftUploadedKey(null);
    }

    // Immediate local preview while upload progresses
    const objectUrl = URL.createObjectURL(file);
    setUploadPreviewUrl(objectUrl);
    setAddModalError(null);
    setIsUploadingImage(true);

    try {
      const res = await uploadProductImage(file);
      // Persist the stable public HTTPS URL and track draft key for safety
      setProdImageUrl(res.url);
      draftUploadedKeyRef.current = res.key;
      setDraftUploadedKey(res.key);
      setUploadPreviewUrl(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Image upload failed';
      setAddModalError(`Image Upload Failed: ${msg}`);
      setUploadPreviewUrl(null);
      setProdImageUrl('');
      draftUploadedKeyRef.current = null;
      setDraftUploadedKey(null);
    } finally {
      setIsUploadingImage(false);
      URL.revokeObjectURL(objectUrl);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processImageFile(file);
    }
  };

  // Edit Offer / Product Modal
  const [editingItem, setEditingItem] = useState<VendorProductItem | null>(null);
  const [editPrice, setEditPrice] = useState<number>(0);
  const [editStock, setEditStock] = useState<number>(0);
  const [editMoq, setEditMoq] = useState<number>(1);
  const [editWeight, setEditWeight] = useState<number>(0);
  const [isSavingOffer, setIsSavingOffer] = useState(false);
  const [editOfferError, setEditOfferError] = useState<string | null>(null);

  // Stall Profile Edit Form
  const [stallName, setStallName] = useState('');
  const [stallNumber, setStallNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [openingHours, setOpeningHours] = useState('04:00 AM - 02:00 PM');
  const [weeklySchedule, setWeeklySchedule] = useState('Saturday to Thursday (Friday wholesale auctions)');
  const [marketLocation, setMarketLocation] = useState('Block A, Al Aweer Central Fruits & Vegetables Market, Dubai');
  const [logoUrl, setLogoUrl] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('/images/market-aisle.jpg');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Reviews State (Real Customer Reviews Only)
  interface StallReview {
    id: string;
    buyerName: string;
    buyerBusiness: string;
    rating: number;
    comment: string;
    date: string;
    reply?: string;
  }
  const [reviews, setReviews] = useState<StallReview[]>([]);
  const [replyReviewId, setReplyReviewId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  // Confirmation Popup Modal State
  interface ShopConfirmationModalConfig {
    isOpen: boolean;
    title: string;
    message: string;
    detail?: string;
    warningNotice?: string;
    confirmLabel: string;
    cancelLabel?: string;
    variant: 'danger' | 'primary';
    onConfirm: () => void | Promise<void>;
  }
  const [confirmDialog, setConfirmDialog] = useState<ShopConfirmationModalConfig | null>(null);
  const [isExecutingDialog, setIsExecutingDialog] = useState<boolean>(false);

  // Auth Guard
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  // Sync shop data into profile form
  useEffect(() => {
    if (shop) {
      setStallName(shop.name || '');
      setStallNumber(shop.stallNumber || '');
      setPhone(shop.phone || '');
      if (shop.address) setAddress(shop.address);
      if (shop.openingHours) setOpeningHours(shop.openingHours);
      if (shop.weeklySchedule) setWeeklySchedule(shop.weeklySchedule);
      if (shop.marketLocation) setMarketLocation(shop.marketLocation);
      if (shop.logoUrl) setLogoUrl(shop.logoUrl);
      if (shop.coverImageUrl) setCoverImageUrl(shop.coverImageUrl);
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

  const loadOrders = useCallback(async () => {
    setIsLoadingOrders(true);
    setOrdersError(null);
    try {
      const res = await getVendorOrders();
      const loadedOrders = res.orders || [];
      setOrders(loadedOrders);
      if (loadedOrders.length > 0 && !selectedOrderForInvoice) {
        setSelectedOrderForInvoice(loadedOrders[0]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch incoming orders';
      setOrdersError(msg);
    } finally {
      setIsLoadingOrders(false);
    }
  }, [selectedOrderForInvoice]);

  const loadCategories = useCallback(async () => {
    try {
      const res = await getCategories();
      const loaded = res.categories || [];
      setCategories(loaded);
      if (loaded.length > 0) {
        setProdCategory((prev) => {
          if (!prev || prev === 'fresh_fruits') {
            const firstValid = loaded.find((c) => c.isActive !== false);
            return firstValid ? (firstValid.slug || (firstValid as any).key) : (loaded[0].slug || (loaded[0] as any).key);
          }
          return prev;
        });
      }
    } catch {
      // Fallback gracefully
    }
  }, []);

  const openAddProduceModal = useCallback(() => {
    loadCategories();
    setIsAddModalOpen(true);
  }, [loadCategories]);

  useEffect(() => {
    if (user) {
      loadInventory();
      loadOrders();
      loadCategories();
    }
  }, [user, loadInventory, loadOrders, loadCategories]);

  // Status progression with real-time sync with buyer portal
  const handleStatusUpdate = async (orderId: string, newStatus: string) => {
    if (!orderId || orderId === 'undefined') {
      alert('Unable to process order: Invalid order identifier. Please refresh your page.');
      return;
    }
    setUpdatingOrderId(orderId);
    try {
      const res = await updateVendorOrderStatus(orderId, newStatus);
      const updatedOrder = res.order ? { ...res.order, id: res.order.id || (res.order as any)._id } : null;
      if (updatedOrder) {
        setOrders((prev) => prev.map((o) => ((o.id || (o as any)._id) === orderId ? updatedOrder : o)));
        if (selectedOrderForInvoice && ((selectedOrderForInvoice.id || (selectedOrderForInvoice as any)._id) === orderId)) {
          setSelectedOrderForInvoice(updatedOrder);
        }
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update order status');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const requestStatusChangeWithConfirmation = (orderId: string, orderNumber: string, targetStatus: string, label: string) => {
    const isCancel = targetStatus === 'cancelled';
    setConfirmDialog({
      isOpen: true,
      title: isCancel ? 'Confirm Order Rejection / Cancellation' : `Advance Order #${orderNumber}`,
      message: isCancel
        ? `Are you sure you want to cancel wholesale order #${orderNumber}?`
        : `Advance status of wholesale order #${orderNumber} to "${label}"?`,
      detail: isCancel
        ? 'Reserved inventory will be immediately restored and buyer will see order marked as Cancelled.'
        : `Buyer status will synchronize immediately. Make sure goods are ready.`,
      warningNotice: isCancel ? 'This action is irreversible.' : undefined,
      confirmLabel: isCancel ? 'Yes, Cancel Order' : `Yes, Mark ${label}`,
      variant: isCancel ? 'danger' : 'primary',
      onConfirm: async () => {
        await handleStatusUpdate(orderId, targetStatus);
      }
    });
  };

  // Toggle publish / unpublish offer
  const handleTogglePublish = (item: VendorProductItem) => {
    const isCurrentlyActive = item.offer?.isActive ?? true;
    const newActiveState = !isCurrentlyActive;
    setConfirmDialog({
      isOpen: true,
      title: newActiveState ? 'Publish Produce Offer' : 'Unpublish Produce Offer',
      message: newActiveState
        ? `Are you sure you want to publish "${item.name}" back onto the Al Aweer wholesale catalog?`
        : `Are you sure you want to take "${item.name}" offline from the public marketplace?`,
      detail: `Stall: ${shop?.name || 'Your Stall'} | Package: ${item.offer?.unitWeightKg || 10}kg ${item.offer?.unit || 'box'} | Current Price: Dhs ${Number(item.offer?.priceAed || 0).toFixed(2)}`,
      warningNotice: newActiveState
        ? 'Wholesale buyers will immediately see and be able to purchase this offer.'
        : 'Buyers will no longer see this offer in search or checkout.',
      confirmLabel: newActiveState ? 'Yes, Make Live' : 'Yes, Unpublish Offer',
      variant: newActiveState ? 'primary' : 'danger',
      onConfirm: async () => {
        try {
          await toggleVendorProductPublish(item.id, newActiveState);
          await loadInventory();
        } catch (err: unknown) {
          alert(err instanceof Error ? err.message : 'Failed to toggle offer visibility');
        }
      }
    });
  };

  // Quick Stock Adjustment (+10, -10, or custom)
  const handleQuickStockAdjust = (item: VendorProductItem, delta: number) => {
    const currentStock = item.offer?.availableStock || 0;
    const newStock = Math.max(0, currentStock + delta);
    setConfirmDialog({
      isOpen: true,
      title: 'Confirm Stock Adjustment',
      message: `Adjust available stock for "${item.name}"?`,
      detail: `Current Stock: ${currentStock} units → New Stock: ${newStock} units (${delta > 0 ? `+${delta}` : delta} adjustment)`,
      confirmLabel: 'Confirm Stock Update',
      variant: 'primary',
      onConfirm: async () => {
        try {
          await adjustVendorProductStock(item.id, newStock);
          setStockLogs((prev) => [
            {
              id: `log-${Date.now()}`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              productName: item.name,
              change: delta,
              newStock,
              reason: delta > 0 ? 'Fresh Morning Produce Intake' : 'Stall Adjustment / Wastage Write-off'
            },
            ...prev
          ]);
          await loadInventory();
        } catch (err: unknown) {
          alert(err instanceof Error ? err.message : 'Failed to adjust stock');
        }
      }
    });
  };

  // Create Direct Off-Platform Personal Invoice
  const handleCreatePersonalInvoice = (e: FormEvent) => {
    e.preventDefault();
    if (!piBuyerName.trim() || piItemQuantity <= 0 || piItemUnitPrice <= 0) {
      alert('Please fill buyer name, positive quantity, and valid unit price.');
      return;
    }

    const lineTotal = piItemQuantity * piItemUnitPrice;
    const vat = lineTotal * 0.05;
    const grandTotal = lineTotal + vat;
    const cleanStall = getStallShortCode(shop?.stallNumber).replace(/[^a-zA-Z0-9]/g, '') || '15';
    const invNumber = `STALL-${cleanStall}-${Date.now().toString().slice(-6)}`;

    const newInvoice: PersonalInvoice = {
      id: `pi-${Date.now()}`,
      invoiceNumber: invNumber,
      buyerName: piBuyerName.trim(),
      buyerPhone: piBuyerPhone.trim(),
      buyerTrn: piBuyerTrn.trim() || undefined,
      items: [
        {
          name: piItemName.trim(),
          unit: piItemUnit,
          unitWeightKg: Number(piItemWeight),
          quantity: Number(piItemQuantity),
          unitPriceAed: Number(piItemUnitPrice),
          lineTotalAed: lineTotal
        }
      ],
      subtotalAed: lineTotal,
      vatAed: vat,
      totalAmountAed: grandTotal,
      createdAt: new Date().toISOString(),
      paymentMethod: piPaymentMethod
    };

    setPersonalInvoices((prev) => [newInvoice, ...prev]);
    setSelectedPersonalInvoice(newInvoice);
    setIsCreatePersonalInvoiceOpen(false);
    setPiBuyerName('');
    setPiBuyerPhone('');
    setPiBuyerTrn('');
  };

  // Save Stall Profile Form
  const executeSaveProfile = async () => {
    setIsSavingProfile(true);
    try {
      const res = await updateVendorShop({
        name: stallName.trim(),
        stallNumber: stallNumber.trim(),
        phone: phone.trim(),
        address: address.trim(),
        openingHours: openingHours.trim(),
        weeklySchedule: weeklySchedule.trim(),
        marketLocation: marketLocation.trim(),
        logoUrl: logoUrl.trim(),
        coverImageUrl: coverImageUrl.trim()
      });
      await refreshShop();
      setProfileSuccess(res.message || 'Stall business profile updated successfully.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update stall profile.';
      setProfileError(msg);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setProfileSuccess(null);
    setProfileError(null);

    if (!stallName.trim() || !stallNumber.trim() || !phone.trim()) {
      setProfileError('Stall name, stall number, and phone number cannot be empty.');
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: 'Confirm Business Settings Update',
      message: `Are you sure you want to save changes to your wholesale stall profile?`,
      detail: `Stall: ${stallName.trim()} | Unit #: ${stallNumber.trim()} | Contact: ${phone.trim()} | Hours: ${openingHours.trim()}`,
      confirmLabel: 'Confirm & Save Settings',
      variant: 'primary',
      onConfirm: async () => {
        await executeSaveProfile();
      }
    });
  };

  // Add Product (Strict 8-Field Specification)
  const executeAddProduce = async () => {
    setIsSubmittingProd(true);
    try {
      const isPackaged = ['box', 'ctn', 'pkt', 'bag', 'sack'].includes(prodUnit.toLowerCase());
      const derivedUnitWeightKg = isPackaged && Number(prodWeight) > 0
        ? Number(prodWeight)
        : getDefaultUnitWeightKg(prodUnit);
      await createVendorProduct({
        name: prodName.trim(),
        category: prodCategory,
        originCountry: prodOrigin.trim(),
        description: `${prodName.trim()} sourced directly from ${prodOrigin.trim()}. Fresh commercial produce.`,
        imageUrl: prodImageUrl,
        offer: {
          unit: prodUnit,
          unitWeightKg: derivedUnitWeightKg,
          priceAed: Number(prodPrice),
          minOrderQuantity: Number(prodMoq) || 1,
          availableStock: Number(prodStock) || 0
        }
      });
      // Product successfully saved in MongoDB: image is now permanently active, not a draft!
      draftUploadedKeyRef.current = null;
      setDraftUploadedKey(null);
      setIsAddModalOpen(false);
      resetAddProductForm(true);
      await loadInventory();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create produce listing';
      setAddModalError(msg);
    } finally {
      setIsSubmittingProd(false);
    }
  };

  const handleAddProduce = async (e: FormEvent) => {
    e.preventDefault();
    setAddModalError(null);

    if (!prodName.trim() || prodName.trim().length < 2) {
      setAddModalError('Product Name is required (at least 2 characters).');
      return;
    }
    if (!prodCategory) {
      setAddModalError('Please select a valid Category.');
      return;
    }
    if (!prodOrigin.trim() || prodOrigin.trim().length < 2) {
      setAddModalError('Country of Origin is required (at least 2 characters).');
      return;
    }
    if (isUploadingImage) {
      setAddModalError('Please wait for product image upload to complete.');
      return;
    }
    if (!prodImageUrl || prodImageUrl.startsWith('blob:') || prodImageUrl.startsWith('data:')) {
      setAddModalError('Please upload or select a valid Product Image.');
      return;
    }
    if (!prodPrice || Number(prodPrice) <= 0 || isNaN(Number(prodPrice))) {
      setAddModalError('Selling Price must be a positive number greater than 0.');
      return;
    }
    if (!prodUnit) {
      setAddModalError('Please select a produce Unit.');
      return;
    }
    const isPackaged = ['box', 'ctn', 'pkt', 'bag', 'sack'].includes(prodUnit.toLowerCase());
    if (isPackaged && (!prodWeight || Number(prodWeight) <= 0 || isNaN(Number(prodWeight)))) {
      setAddModalError(`Please enter a valid Weight (KG) for ${prodUnit.toUpperCase()}.`);
      return;
    }
    if (!prodMoq || Number(prodMoq) < 1 || isNaN(Number(prodMoq))) {
      setAddModalError('Minimum Order Quantity must be at least 1.');
      return;
    }
    if (prodStock === undefined || prodStock === null || Number(prodStock) < 0 || isNaN(Number(prodStock))) {
      setAddModalError('Available Stock cannot be negative.');
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: 'Confirm Product Listing',
      message: `Are you sure you want to save and publish listing for "${prodName.trim()}"?`,
      detail: `Category: ${prodCategory.replace(/_/g, ' ')} | Price: AED ${Number(prodPrice).toFixed(2)} per ${prodUnit}${isPackaged ? ` (${prodWeight} kg)` : ''} | MOQ: ${prodMoq} | Available Stock: ${prodStock} ${prodUnit}`,
      confirmLabel: 'Confirm & Save Product',
      variant: 'primary',
      onConfirm: async () => {
        await executeAddProduce();
      }
    });
  };

  // Edit Offer
  const openEditOfferModal = (item: VendorProductItem) => {
    setEditingItem(item);
    setEditPrice(item.offer?.priceAed || 0);
    setEditStock(item.offer?.availableStock || 0);
    setEditMoq(item.offer?.minOrderQuantity || 1);
    setEditWeight(item.offer?.unitWeightKg || 0);
    setEditOfferError(null);
  };

  const executeUpdateOffer = async () => {
    if (!editingItem) return;
    setIsSavingOffer(true);
    try {
      const payload: { priceAed: number; availableStock: number; minOrderQuantity: number; unitWeightKg?: number } = {
        priceAed: Number(editPrice),
        availableStock: Number(editStock),
        minOrderQuantity: Number(editMoq)
      };
      if (editWeight && Number(editWeight) > 0) {
        payload.unitWeightKg = Number(editWeight);
      }
      await updateVendorOffer(editingItem.id, payload);
      setEditingItem(null);
      await loadInventory();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update offer';
      setEditOfferError(msg);
    } finally {
      setIsSavingOffer(false);
    }
  };

  const handleUpdateOffer = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setEditOfferError(null);

    if (editPrice <= 0 || editStock < 0) {
      setEditOfferError('Price must be positive and stock cannot be negative.');
      return;
    }
    if (editWeight !== undefined && editWeight !== null && Number(editWeight) <= 0) {
      setEditOfferError('Weight must be greater than 0.');
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: 'Confirm Produce Terms Update',
      message: `Are you sure you want to update wholesale terms for "${editingItem.name}"?`,
      detail: `Price: Dhs ${Number(editPrice).toFixed(2)} | Weight: ${editWeight || editingItem.offer?.unitWeightKg || '—'} kg | Stock: ${editStock} units | MOQ: ${editMoq}`,
      confirmLabel: 'Confirm & Save Terms',
      variant: 'primary',
      onConfirm: async () => {
        await executeUpdateOffer();
      }
    });
  };

  // Reply to review
  const handleReplyReview = (reviewId: string) => {
    if (!replyText.trim()) return;
    setReviews((prev) =>
      prev.map((r) => (r.id === reviewId ? { ...r, reply: replyText.trim() } : r))
    );
    setReplyReviewId(null);
    setReplyText('');
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return styles.statusConfirmed;
      case 'preparing':
        return styles.statusPreparing;
      case 'ready_for_pickup':
      case 'out_for_delivery':
        return styles.statusReady;
      case 'delivered':
        return styles.statusDelivered;
      case 'cancelled':
        return styles.statusCancelled;
      case 'pending':
      default:
        return styles.statusPending;
    }
  };

  // KPI Calculations (Strictly real data only)
  const isApproved = shop?.isApproved ?? false;
  const pendingOrdersCount = orders.filter((o) => o.status === 'pending').length;
  const processingOrdersCount = orders.filter((o) => ['confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery'].includes(o.status)).length;
  const completedOrdersCount = orders.filter((o) => o.status === 'delivered').length;
  const activeStockCount = products.filter((p) => (p.offer?.availableStock || 0) > 0 && (p.offer?.isActive ?? true)).length;
  const lowStockItems = products.filter((p) => {
    const stock = p.offer?.availableStock || 0;
    return stock > 0 && stock <= 10;
  });
  const outOfStockItems = products.filter((p) => (p.offer?.availableStock || 0) === 0);

  // Delivered Gross Marketplace Sales (strictly real)
  const grossMarketplaceSalesAed = orders
    .filter((o) => o.status === 'delivered')
    .reduce((acc, o) => acc + o.totalAmountAed, 0);

  // Commission & Net Payout Calculation using actual configured rate (5%)
  const platformCommissionAed = grossMarketplaceSalesAed * MARKETPLACE_COMMISSION_RATE;
  const netPayableEarningsAed = grossMarketplaceSalesAed - platformCommissionAed;

  // Today's Sales Calculation
  const todayDateStr = new Date().toDateString();
  const todayOrders = orders.filter((o) => new Date(o.createdAt).toDateString() === todayDateStr);
  const todaySalesAed = todayOrders
    .filter((o) => o.status === 'delivered' || o.status === 'confirmed')
    .reduce((acc, o) => acc + o.totalAmountAed, 0);

  // Filtered orders & products for search
  const filteredOrders = useMemo(() => {
    let list = orders;
    if (orderFilterStatus !== 'all') {
      if (orderFilterStatus === 'processing') {
        list = list.filter((o) => ['confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery'].includes(o.status));
      } else {
        list = list.filter((o) => o.status === orderFilterStatus);
      }
    }
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (o) =>
        o.orderNumber.toLowerCase().includes(q) ||
        o.deliveryType.toLowerCase().includes(q) ||
        o.status.toLowerCase().includes(q) ||
        o.items.some((i) => i.name.toLowerCase().includes(q))
    );
  }, [orders, orderFilterStatus, searchQuery]);

  const filteredProducts = useMemo(() => {
    let list = products;
    if (inventoryFilterCategory !== 'all') {
      list = list.filter((p) => p.category === inventoryFilterCategory);
    }
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.originCountry.toLowerCase().includes(q)
    );
  }, [products, inventoryFilterCategory, searchQuery]);

  // Derived Unique Wholesale Buyers from Real Orders
  const uniqueBuyers = useMemo(() => {
    const map = new Map<string, { id: string; ordersCount: number; totalSpendAed: number; lastOrderDate: string; deliveryType: string }>();
    for (const ord of orders) {
      const existing = map.get(ord.buyerId) || {
        id: ord.buyerId,
        ordersCount: 0,
        totalSpendAed: 0,
        lastOrderDate: ord.createdAt,
        deliveryType: ord.deliveryType
      };
      existing.ordersCount += 1;
      existing.totalSpendAed += ord.totalAmountAed;
      if (new Date(ord.createdAt) > new Date(existing.lastOrderDate)) {
        existing.lastOrderDate = ord.createdAt;
      }
      map.set(ord.buyerId, existing);
    }
    return Array.from(map.values());
  }, [orders]);

  // Real Sales Chart Data (strictly real orders by date)
  const salesByDate = useMemo(() => {
    const map = new Map<string, number>();
    const completed = orders.filter((o) => o.status === 'delivered');
    for (const ord of completed) {
      const d = new Date(ord.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' });
      map.set(d, (map.get(d) || 0) + ord.totalAmountAed);
    }
    return Array.from(map.entries()).map(([date, amount]) => ({ date, amount }));
  }, [orders]);

  if (authLoading || (!user && !profileError)) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#030d0a', color: '#10b981', fontWeight: 700 }}>
        Authenticating Al Aweer Stall Operations session...
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* =====================================================================
          TOP HEADER BAR (Matching Super Admin Dark Botanical Executive Theme)
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
            id="vendor-mobile-menu-btn"
          >
            <span className={styles.hamburgerIcon}>{isMobileDrawerOpen ? '✕' : '☰'}</span>
          </button>

          {/* Brand Logo */}
          <div
            onClick={() => handleNavSelect('dashboard')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                handleNavSelect('dashboard');
              }
            }}
            role="button"
            tabIndex={0}
            className={styles.headerBrand}
            aria-label="Aweermarket Stall Operations Home"
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
                <path d="M8 28C6 20 12 10 24 6C24 18 16 26 8 28Z" fill="url(#vendorLeaf1)" />
                <path d="M16 34C14 26 22 16 34 10C34 24 24 32 16 34Z" fill="url(#vendorLeaf2)" />
                <path d="M6 34C14 28 20 22 30 14" stroke="#bbf7d0" strokeWidth="2" strokeLinecap="round" />
                <defs>
                  <linearGradient id="vendorLeaf1" x1="6" y1="6" x2="24" y2="28" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#4ade80" />
                    <stop offset="1" stopColor="#15803d" />
                  </linearGradient>
                  <linearGradient id="vendorLeaf2" x1="14" y1="10" x2="34" y2="34" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#86efac" />
                    <stop offset="1" stopColor="#22c55e" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <div className={styles.brandTextGroup}>
              <span className={styles.brandTitle}>Aweer<span>market</span></span>
              <span className={styles.brandSubtitle}>Stall Operations • Al Aweer</span>
            </div>
          </div>
        </div>

        {/* Global Search Bar with Ctrl + K */}
        <div className={styles.headerSearchWrap}>
          <span className={styles.headerSearchIcon}>🔍</span>
          <input
            type="text"
            className={styles.headerSearchInput}
            placeholder="Search orders, produce, categories, buyers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <span className={styles.headerShortcutBadge}>Ctrl + K</span>
        </div>

        {/* Right Actions: Language, Notifications, Messages, Vendor Profile */}
        <div className={styles.headerActions}>
          <button type="button" className={styles.langBtn}>
            <span>🌐</span>
            <span>English / বাংলা</span>
            <span style={{ fontSize: '0.65rem' }}>▼</span>
          </button>

          <button
            type="button"
            className={styles.headerIconButton}
            title="Pending Orders"
            onClick={() => handleNavSelect('orders')}
          >
            <span>🔔</span>
            {pendingOrdersCount > 0 && (
              <span className={styles.badgeCountRed}>{pendingOrdersCount}</span>
            )}
          </button>

          <button
            type="button"
            className={styles.headerIconButton}
            title="Active Listed Produce"
            onClick={() => handleNavSelect('products')}
          >
            <span>📦</span>
            <span className={styles.badgeCountGreen}>{products.length}</span>
          </button>

          <div className={styles.userProfilePill}>
            <div className={styles.userAvatar}>
              {user?.fullName?.charAt(0) || 'V'}
            </div>
            <div className={styles.userMeta}>
              <span className={styles.userMetaName}>{user?.fullName || 'Vendor Admin'}</span>
              <span className={styles.userMetaRole}>Stall Admin</span>
            </div>
            <button
              onClick={handleLogout}
              className={styles.logoutBtn}
              id="vendor-logout-btn"
              title="Sign Out of Stall Operations"
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
        {/* LEFT SIDEBAR NAVIGATION: Exact 12 Items Matching Specification */}
        <aside
          className={`${styles.sidebar} ${isMobileDrawerOpen ? styles.sidebarOpen : ''}`}
          aria-label="Vendor Portal Navigation"
        >
          {/* Mobile Drawer Top Header with Close Button */}
          <div className={styles.mobileDrawerHeader}>
            <div className={styles.mobileDrawerBrand}>
              <span className={styles.mobileDrawerBrandIcon}>🌿</span>
              <span>Al Aweer Vendor</span>
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

          <div className={styles.sidebarScrollArea}>
            {/* Stall Profile Mini Card */}
            <div className={styles.sidebarCard}>
              <div className={styles.sidebarCardAvatar}>🏪</div>
              <div className={styles.sidebarCardInfo}>
                <div className={styles.sidebarCardTitle} title={shop?.name || user?.businessName || 'Wholesale Stall'}>
                  {shop?.name || user?.businessName || 'Wholesale Stall'}
                </div>
                <div className={styles.sidebarCardSub} title={shop?.stallNumber || 'Al Aweer Market'}>
                  {formatStallBadge(shop?.stallNumber)}
                </div>
              </div>
            </div>

            {/* Navigation Menu (12 items strictly matching specification) */}
            <nav className={styles.navGroup}>
              {/* 1. Dashboard */}
              <button
                type="button"
                onClick={() => handleNavSelect('dashboard')}
                className={`${styles.navItem} ${activeTab === 'dashboard' ? styles.navItemActive : ''}`}
                id="tab-dashboard-btn"
              >
                <div className={styles.navItemLeft}>
                  <span className={styles.navItemIcon}>📊</span>
                  <span className={styles.navItemText}>1. Dashboard</span>
                </div>
              </button>

              {/* 2. Products */}
              <button
                type="button"
                onClick={() => handleNavSelect('products')}
                className={`${styles.navItem} ${activeTab === 'products' ? styles.navItemActive : ''}`}
                id="tab-products-btn"
              >
                <div className={styles.navItemLeft}>
                  <span className={styles.navItemIcon}>🍎</span>
                  <span className={styles.navItemText}>2. Products</span>
                </div>
                <span className={styles.navBadge}>{products.length}</span>
              </button>

              {/* 3. Orders */}
              <button
                type="button"
                onClick={() => handleNavSelect('orders')}
                className={`${styles.navItem} ${activeTab === 'orders' ? styles.navItemActive : ''}`}
                id="tab-orders-btn"
              >
                <div className={styles.navItemLeft}>
                  <span className={styles.navItemIcon}>🛒</span>
                  <span className={styles.navItemText}>3. Orders</span>
                </div>
                {pendingOrdersCount > 0 ? (
                  <span className={styles.badgeCountRed}>{pendingOrdersCount}</span>
                ) : (
                  <span className={styles.navBadge}>{orders.length}</span>
                )}
              </button>

              {/* 4. Invoice (AweerMarket + Personal Sales) */}
              <button
                type="button"
                onClick={() => handleNavSelect('invoice')}
                className={`${styles.navItem} ${activeTab === 'invoice' ? styles.navItemActive : ''}`}
                id="tab-invoice-btn"
              >
                <div className={styles.navItemLeft}>
                  <span className={styles.navItemIcon}>🧾</span>
                  <span className={styles.navItemText}>4. Invoice</span>
                </div>
              </button>

              {/* 5. Inventory & Stock */}
              <button
                type="button"
                onClick={() => handleNavSelect('inventory')}
                className={`${styles.navItem} ${activeTab === 'inventory' ? styles.navItemActive : ''}`}
                id="tab-inventory-btn"
              >
                <div className={styles.navItemLeft}>
                  <span className={styles.navItemIcon}>📦</span>
                  <span className={styles.navItemText}>5. Inventory &amp; Stock</span>
                </div>
                {lowStockItems.length > 0 && (
                  <span className={styles.navStockLowBadge}>
                    {lowStockItems.length} low
                  </span>
                )}
              </button>

              {/* 6. Sales & Reports */}
              <button
                type="button"
                onClick={() => handleNavSelect('sales')}
                className={`${styles.navItem} ${activeTab === 'sales' ? styles.navItemActive : ''}`}
                id="tab-sales-btn"
              >
                <div className={styles.navItemLeft}>
                  <span className={styles.navItemIcon}>📈</span>
                  <span className={styles.navItemText}>6. Sales &amp; Reports</span>
                </div>
              </button>

              {/* 7. Payouts (Marketplace Sales − Configured Commission = Net) */}
              <button
                type="button"
                onClick={() => handleNavSelect('payouts')}
                className={`${styles.navItem} ${activeTab === 'payouts' ? styles.navItemActive : ''}`}
                id="tab-payouts-btn"
              >
                <div className={styles.navItemLeft}>
                  <span className={styles.navItemIcon}>💳</span>
                  <span className={styles.navItemText}>7. Payouts</span>
                </div>
              </button>

              {/* 8. Shop Profile */}
              <button
                type="button"
                onClick={() => handleNavSelect('profile')}
                className={`${styles.navItem} ${activeTab === 'profile' ? styles.navItemActive : ''}`}
                id="tab-profile-btn"
              >
                <div className={styles.navItemLeft}>
                  <span className={styles.navItemIcon}>🏪</span>
                  <span className={styles.navItemText}>8. Shop Profile</span>
                </div>
              </button>

              {/* 9. Customers */}
              <button
                type="button"
                onClick={() => handleNavSelect('customers')}
                className={`${styles.navItem} ${activeTab === 'customers' ? styles.navItemActive : ''}`}
                id="tab-customers-btn"
              >
                <div className={styles.navItemLeft}>
                  <span className={styles.navItemIcon}>👥</span>
                  <span className={styles.navItemText}>9. Customers</span>
                </div>
                <span className={styles.navBadge}>{uniqueBuyers.length}</span>
              </button>

              {/* 10. Reviews & Ratings */}
              <button
                type="button"
                onClick={() => handleNavSelect('reviews')}
                className={`${styles.navItem} ${activeTab === 'reviews' ? styles.navItemActive : ''}`}
                id="tab-reviews-btn"
              >
                <div className={styles.navItemLeft}>
                  <span className={styles.navItemIcon}>⭐</span>
                  <span className={styles.navItemText}>10. Reviews &amp; Ratings</span>
                </div>
                <span className={styles.navBadge}>{reviews.length}</span>
              </button>

              {/* 11. Notifications */}
              <button
                type="button"
                onClick={() => handleNavSelect('notifications')}
                className={`${styles.navItem} ${activeTab === 'notifications' ? styles.navItemActive : ''}`}
                id="tab-notifications-btn"
              >
                <div className={styles.navItemLeft}>
                  <span className={styles.navItemIcon}>🔔</span>
                  <span className={styles.navItemText}>11. Notifications</span>
                </div>
                {lowStockItems.length > 0 && <span className={styles.badgeCountRed}>!</span>}
              </button>

              {/* 12. Settings */}
              <button
                type="button"
                onClick={() => handleNavSelect('settings')}
                className={`${styles.navItem} ${activeTab === 'settings' ? styles.navItemActive : ''}`}
                id="tab-settings-btn"
              >
                <div className={styles.navItemLeft}>
                  <span className={styles.navItemIcon}>⚙️</span>
                  <span className={styles.navItemText}>12. Settings</span>
                </div>
              </button>
            </nav>

            {/* Sidebar Footer */}
            <div className={styles.sidebarFooter}>
              <div className={styles.sidebarFooterStatus}>
                <span className={styles.livePulseDot} />
                <span>Stall Active</span>
              </div>
              <span className={styles.sidebarFooterVersion}>v2.0.0</span>
            </div>
          </div>
        </aside>

        {/* RIGHT MAIN CONTENT AREA */}
        <main className={styles.mainContent}>
          {profileSuccess && (
            <div className={styles.successBanner} role="status">
              ✓ {profileSuccess}
            </div>
          )}

          {profileError && (
            <div className={styles.errorBanner} role="alert">
              ⚠️ {profileError}
            </div>
          )}

          {/* ===================================================================
              VIEW 1: DASHBOARD (Sales overview, order summary, low-stock alerts)
             =================================================================== */}
          {activeTab === 'dashboard' && (
            <>
              {/* Top Banner Row: Hero Card + Quick Actions */}
              <div className={styles.topBannerRow}>
                {/* Hero Banner */}
                <div className={styles.heroBanner}>
                  <div className={styles.heroLeft}>
                    <div className={styles.heroBadge}>
                      🌿 AL AWEER WHOLESALE MARKET
                    </div>
                    <h1 className={styles.heroTitle}>
                      {shop?.name || user?.businessName || 'Your Wholesale Stall'}
                    </h1>
                    <div className={styles.heroMetaLine}>
                      <span className={styles.heroStallPill}>
                        📍 {formatStallBadge(shop?.stallNumber)}
                      </span>
                      <span className={styles.heroDivider}>•</span>
                      <span className={styles.heroTagline}>
                        Real-time wholesale orders, produce inventory &amp; Dhs settlements.
                      </span>
                    </div>
                    <div style={{ marginTop: 6 }}>
                      {isApproved ? (
                        <span className={`${styles.statusPill} ${styles.statusActive}`}>
                          <span className={styles.livePulseDot} />
                          ✓ Approved — Live on Al Aweer Marketplace
                        </span>
                      ) : (
                        <span className={`${styles.statusPill} ${styles.statusPending}`}>
                          ⏳ Pending Super Admin Verification
                        </span>
                      )}
                    </div>
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
                    <h3 className={styles.quickActionsTitle}>Quick Operations</h3>
                    <span className={styles.quickActionsLiveIndicator}>
                      <span className={styles.pulseDot} />
                      <span>Live</span>
                    </span>
                  </div>
                  <div className={styles.quickActionsList}>
                    <button
                      type="button"
                      onClick={openAddProduceModal}
                      className={styles.actionPillBtn}
                      id="quick-add-produce-btn"
                    >
                      <span>+ List New Produce</span>
                      <span>›</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('orders')}
                      className={styles.actionPillBtn}
                    >
                      <span>🛒 Orders ({orders.length})</span>
                      <span>›</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('invoice')}
                      className={styles.actionPillBtn}
                    >
                      <span>🧾 Print Wholesale Invoice</span>
                      <span>›</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('inventory')}
                      className={styles.actionPillBtn}
                    >
                      <span>📦 Inventory &amp; Stock</span>
                      <span>›</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Low Stock Alert Banner (If Any Produce < 10 Units) */}
              {lowStockItems.length > 0 && (
                <div style={{ background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.35)', borderRadius: 10, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: '1.4rem' }}>⚠️</span>
                    <div>
                      <strong style={{ color: '#fbbf24', fontSize: '0.9rem' }}>Low Stock Alert: {lowStockItems.length} Produce Items Need Replenishment</strong>
                      <div style={{ color: '#cbd5e1', fontSize: '0.78rem' }}>
                        {lowStockItems.map((p) => `${p.name} (${p.offer?.availableStock || 0} ${p.offer?.unit || 'units'} left)`).join(' • ')}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('inventory')}
                    className={styles.actionBtnPrimary}
                    style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                  >
                    Adjust Stock →
                  </button>
                </div>
              )}

              {/* 5 KPI Metric Cards */}
              <div className={styles.kpiGrid}>
                {/* 1. Today's Sales */}
                <div className={styles.kpiCard}>
                  <div className={styles.kpiTopRow}>
                    <div className={styles.kpiAvatarWrap}>💰</div>
                    <span className={styles.kpiDeltaBadge}>Today</span>
                  </div>
                  <div className={styles.kpiTitle}>Today&apos;s Sales</div>
                  <div className={styles.kpiValue}>Dhs {todaySalesAed.toFixed(2)}</div>
                  <div className={styles.kpiSubtext}>
                    {todayOrders.length} order(s) placed today
                  </div>
                </div>

                {/* 2. Total Orders Breakdown */}
                <div className={styles.kpiCard}>
                  <div className={styles.kpiTopRow}>
                    <div className={styles.kpiAvatarWrap}>🛒</div>
                    <span className={styles.kpiDeltaBadge}>Lifecycle</span>
                  </div>
                  <div className={styles.kpiTitle}>Total Orders: {orders.length}</div>
                  <div className={styles.kpiValue} style={{ fontSize: '1.3rem' }}>
                    {pendingOrdersCount} Pending • {processingOrdersCount} Active
                  </div>
                  <div className={styles.kpiSubtext}>
                    Completed: {completedOrdersCount} fulfilled orders
                  </div>
                </div>

                {/* 3. Completed Sales Revenue */}
                <div className={styles.kpiCard}>
                  <div className={styles.kpiTopRow}>
                    <div className={styles.kpiAvatarWrap}>📈</div>
                    <span className={styles.kpiDeltaBadge}>Fulfilled</span>
                  </div>
                  <div className={styles.kpiTitle}>Completed Revenue</div>
                  <div className={styles.kpiValue}>Dhs {grossMarketplaceSalesAed.toFixed(2)}</div>
                  <div className={styles.kpiSubtext}>
                    From {completedOrdersCount} delivered wholesale orders
                  </div>
                </div>

                {/* 4. Active Produce Listings & Stock Alerts */}
                <div className={styles.kpiCard}>
                  <div className={styles.kpiTopRow}>
                    <div className={styles.kpiAvatarWrap}>📦</div>
                    <span className={styles.kpiDeltaBadge}>{lowStockItems.length} Low</span>
                  </div>
                  <div className={styles.kpiTitle}>Produce Listings</div>
                  <div className={styles.kpiValue}>{products.length}</div>
                  <div className={styles.kpiSubtext}>
                    Active: {activeStockCount} | Out of Stock: {outOfStockItems.length}
                  </div>
                </div>

                {/* 5. Assigned Stall & Market Location */}
                <div className={styles.kpiCard}>
                  <div className={styles.kpiTopRow}>
                    <div className={styles.kpiAvatarWrap}>📍</div>
                    <span className={styles.kpiDeltaBadge}>Terminal</span>
                  </div>
                  <div className={styles.kpiTitle}>Assigned Stall</div>
                  <div className={styles.kpiValue} title={shop?.stallNumber || 'Wholesale Stall'}>
                    {getStallShortCode(shop?.stallNumber)}
                  </div>
                  <div className={styles.kpiSubtext}>
                    {shop?.marketLocation ? 'Al Aweer Central Fruits & Veg' : 'Al Aweer Central Wholesale Terminal'}
                  </div>
                </div>
              </div>

              {/* Dynamic Real-Data Sales Chart (strictly real data only) */}
              <div className={styles.chartWrap}>
                <div className={styles.chartHeader}>
                  <div>
                    <h3 className={styles.chartTitle}>Wholesale Sales Performance (Dhs)</h3>
                    <p className={styles.chartSubtitle}>
                      Daily sales generated from real delivered wholesale orders.
                    </p>
                  </div>
                  <span style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: 700 }}>
                    Strictly Real Data Only
                  </span>
                </div>

                {salesByDate.length === 0 ? (
                  <div className={styles.chartEmptyBox}>
                    <span style={{ fontSize: '2rem', marginBottom: 8 }}>📊</span>
                    <strong style={{ color: '#cbd5e1' }}>No Fulfilled Sales Recorded Yet</strong>
                    <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                      As wholesale orders are delivered and marked completed, real revenue transactions will automatically plot here.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, height: 180, paddingTop: 20 }}>
                    {salesByDate.map((item, idx) => {
                      const maxAmount = Math.max(...salesByDate.map((s) => s.amount), 100);
                      const heightPercent = Math.max(15, (item.amount / maxAmount) * 100);
                      return (
                        <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                          <span style={{ fontSize: '0.72rem', color: '#34d399', fontWeight: 800, marginBottom: 4 }}>
                            Dhs {item.amount.toFixed(0)}
                          </span>
                          <div
                            style={{
                              width: '100%',
                              maxWidth: 48,
                              height: `${heightPercent}%`,
                              background: 'linear-gradient(180deg, #10b981 0%, #064e3b 100%)',
                              borderRadius: '6px 6px 0 0',
                              border: '1px solid #34d399'
                            }}
                          />
                          <span style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 6 }}>
                            {item.date}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Overview Section: Recent Incoming Orders */}
              <section className={styles.tableSection}>
                <div className={styles.tableHeaderBar}>
                  <div>
                    <h3 className={styles.tableTitle}>Recent Incoming Orders</h3>
                    <p className={styles.tableSubtitle}>
                      Wholesale buyer orders awaiting fulfillment or recently dispatched.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('orders')}
                    className={styles.viewAllLink}
                  >
                    View All Orders ({orders.length}) →
                  </button>
                </div>
                <div className={styles.tableWrapper}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Order #</th>
                        <th>Date &amp; Fulfillment</th>
                        <th>Wholesale Items</th>
                        <th>Total Amount</th>
                        <th>Status</th>
                        <th>Quick Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.length === 0 ? (
                        <tr>
                          <td colSpan={6} className={styles.emptyState}>
                            No wholesale orders received yet for this stall.
                          </td>
                        </tr>
                      ) : (
                        orders.slice(0, 5).map((ord) => (
                          <tr key={ord.id}>
                            <td>
                              <strong>#{ord.orderNumber}</strong>
                            </td>
                            <td>
                              <span style={{ fontSize: '0.8rem' }}>
                                {new Date(ord.createdAt).toLocaleDateString()}
                              </span>
                              <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'capitalize' }}>
                                {ord.deliveryType}
                              </div>
                            </td>
                            <td>
                              {ord.items.map((i, idx) => (
                                <span key={idx} style={{ display: 'block', fontSize: '0.78rem' }}>
                                  {i.quantity}x {i.name}
                                </span>
                              ))}
                            </td>
                            <td>
                              <strong style={{ color: '#34d399' }}>
                                Dhs {ord.totalAmountAed.toFixed(2)}
                              </strong>
                            </td>
                            <td>
                              <span className={`${styles.statusPill} ${getStatusBadge(ord.status)}`}>
                                {ord.status.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td>
                              <button
                                type="button"
                                className={styles.actionBtn}
                                onClick={() => {
                                  setSelectedOrderForInvoice(ord);
                                  setActiveTab('orders');
                                }}
                              >
                                Manage Order →
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          {/* ===================================================================
              VIEW 2: PRODUCTS (Add, edit, manage and publish with categories)
             =================================================================== */}
          {activeTab === 'products' && (
            <section className={styles.tableSection}>
              <div className={styles.tableHeaderBar}>
                <div>
                  <h3 className={styles.tableTitle}>Products Management &amp; Offers</h3>
                  <p className={styles.tableSubtitle}>
                    Add, edit, manage and publish products with prices, images and approved marketplace categories.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    type="button"
                    className={styles.filterTabBtn}
                    onClick={() => setShowCategoryExplorer(!showCategoryExplorer)}
                    style={{ background: showCategoryExplorer ? '#07251b' : 'transparent' }}
                  >
                    🏷️ {showCategoryExplorer ? 'Hide Categories' : 'Browse Categories'} ({categories.length})
                  </button>
                  <button
                    type="button"
                    className={styles.addBtn}
                    onClick={openAddProduceModal}
                    id="add-produce-btn"
                  >
                    <span>+</span>
                    <span>Add New Product</span>
                  </button>
                </div>
              </div>

              {/* Expandable Super Admin Approved Categories Explorer */}
              {showCategoryExplorer && (
                <div style={{ padding: '16px 20px', background: '#020b08', borderBottom: '1px solid rgba(16, 185, 129, 0.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div>
                      <strong style={{ color: '#10b981', fontSize: '0.88rem' }}>Super Admin Marketplace Categories</strong>
                      <div style={{ fontSize: '0.74rem', color: '#64748b' }}>Select any category to filter stall listings:</div>
                    </div>
                    <button
                      type="button"
                      className={styles.actionBtn}
                      onClick={() => setInventoryFilterCategory('all')}
                      style={{ fontSize: '0.75rem', padding: '3px 10px' }}
                    >
                      Clear Category Filter
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {categories.map((cat) => {
                      const stallItemsCount = products.filter((p) => p.category === cat.slug).length;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setInventoryFilterCategory(cat.slug)}
                          className={`${styles.filterTabBtn} ${inventoryFilterCategory === cat.slug ? styles.filterTabActive : ''}`}
                        >
                          <span>{cat.icon || '📦'}</span>
                          <span>{cat.name}</span>
                          <span style={{ opacity: 0.7 }}>({stallItemsCount})</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {inventoryError && (
                <div className={styles.errorBanner} role="alert" style={{ margin: '16px' }}>
                  {inventoryError}
                </div>
              )}

              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Image</th>
                      <th>Product Name</th>
                      <th>Category</th>
                      <th>Stall Price (Dhs)</th>
                      <th>Stock Available</th>
                      <th>Visibility</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.length === 0 ? (
                      <tr>
                        <td colSpan={7} className={styles.emptyState}>
                          {isLoadingInventory
                            ? 'Loading stall produce listings...'
                            : 'No products listed matching criteria. Click "+ Add New Product" to publish your offers.'}
                        </td>
                      </tr>
                    ) : (
                      filteredProducts.map((p) => {
                        const o = p.offer;
                        const isPublished = o?.isActive ?? true;
                        const stock = o?.availableStock || 0;
                        return (
                          <tr key={p.id}>
                            <td>
                              <img
                                src={p.imageUrl || '/images/apple.jpg'}
                                alt={p.name}
                                className={styles.produceThumb}
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = '/images/hero-basket.jpg';
                                }}
                              />
                            </td>
                            <td>
                              <strong>{p.name}</strong>
                              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                Origin: {formatCountryWithFlag(p.originCountry)} | MOQ: {o?.minOrderQuantity || 1}
                              </div>
                            </td>
                            <td>
                              <span style={{ textTransform: 'capitalize', color: '#34d399' }}>
                                {p.category.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td>
                              <strong style={{ color: '#ffffff' }}>
                                Dhs {o ? `${o.priceAed.toFixed(2)} / ${o.unit}` : '—'}
                              </strong>
                            </td>
                            <td>
                              {stock === 0 ? (
                                <span className={styles.outOfStockPill}>0 (Out of Stock)</span>
                              ) : stock <= 10 ? (
                                <span className={styles.lowStockPill}>Low: {stock} units</span>
                              ) : (
                                <span className={`${styles.statusPill} ${styles.statusActive}`}>
                                  {stock} units
                                </span>
                              )}
                            </td>
                            <td>
                              {isPublished ? (
                                <span className={`${styles.statusPill} ${styles.statusActive}`}>
                                  ✓ Published
                                </span>
                              ) : (
                                <span className={`${styles.statusPill} ${styles.statusSuspended}`}>
                                  ✕ Unpublished
                                </span>
                              )}
                            </td>
                            <td>
                              <div className={styles.actionBtnGroup}>
                                <button
                                  type="button"
                                  className={styles.actionBtn}
                                  onClick={() => openEditOfferModal(p)}
                                  title="Edit produce terms"
                                >
                                  ✏️ Edit
                                </button>
                                <button
                                  type="button"
                                  className={isPublished ? styles.actionBtnDanger : styles.actionBtnSuccess}
                                  onClick={() => handleTogglePublish(p)}
                                  title={isPublished ? 'Unpublish from marketplace' : 'Publish to marketplace'}
                                >
                                  {isPublished ? 'Unpublish' : 'Publish'}
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
              VIEW 3: ORDERS (View and manage marketplace orders & track fulfillment)
             =================================================================== */}
          {activeTab === 'orders' && (
            <section className={styles.tableSection}>
              <div className={styles.tableHeaderBar}>
                <div>
                  <h3 className={styles.tableTitle}>Marketplace Orders</h3>
                  <p className={styles.tableSubtitle}>
                    View and manage marketplace orders, update order status and track fulfillment lifecycle.
                  </p>
                </div>
                <button
                  type="button"
                  className={styles.addBtn}
                  onClick={loadOrders}
                  disabled={isLoadingOrders}
                  style={{ background: '#07251b', border: '1px solid rgba(16, 185, 129, 0.3)' }}
                >
                  <span>↻</span>
                  <span>{isLoadingOrders ? 'Refreshing...' : 'Refresh Orders'}</span>
                </button>
              </div>

              {/* Order Status Tabs */}
              <div className={styles.filterTabs}>
                {[
                  { key: 'all', label: `All Orders (${orders.length})` },
                  { key: 'pending', label: `Pending (${pendingOrdersCount})` },
                  { key: 'processing', label: `Processing (${processingOrdersCount})` },
                  { key: 'delivered', label: `Completed (${completedOrdersCount})` },
                  { key: 'cancelled', label: `Cancelled (${orders.filter((o) => o.status === 'cancelled').length})` }
                ].map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    className={`${styles.filterTabBtn} ${orderFilterStatus === t.key ? styles.filterTabActive : ''}`}
                    onClick={() => setOrderFilterStatus(t.key)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {ordersError && (
                <div className={styles.errorBanner} role="alert" style={{ margin: '16px' }}>
                  {ordersError}
                </div>
              )}

              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Order #</th>
                      <th>Date &amp; Fulfillment</th>
                      <th>Wholesale Items</th>
                      <th>Total Amount (Dhs)</th>
                      <th>Status</th>
                      <th>Fulfillment Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={6} className={styles.emptyState}>
                          {isLoadingOrders
                            ? 'Loading incoming orders...'
                            : 'No wholesale orders found matching criteria.'}
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map((ord) => {
                        const currentOrderId = ord.id || (ord as any)._id;
                        const isUpdating = updatingOrderId === currentOrderId;
                        return (
                          <tr key={currentOrderId}>
                            <td>
                              <strong>#{ord.orderNumber}</strong>
                              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                Buyer ID: {ord.buyerId.slice(0, 8)}...
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedOrderForInvoice(ord);
                                  setInvoiceSubTab('marketplace');
                                  setActiveTab('invoice');
                                }}
                                style={{ background: 'none', border: 'none', color: '#10b981', fontSize: '0.72rem', fontWeight: 700, padding: 0, marginTop: 4, cursor: 'pointer' }}
                              >
                                🧾 View Invoice →
                              </button>
                            </td>
                            <td>
                              <div style={{ fontWeight: 600 }}>
                                {new Date(ord.createdAt).toLocaleDateString()}{' '}
                                {new Date(ord.createdAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 3 }}>
                                <span style={{ textTransform: 'capitalize', fontWeight: 700, color: '#10b981' }}>
                                  {ord.deliveryType}
                                </span>
                                {ord.deliveryType === 'delivery' && ord.deliveryAddress
                                  ? ` — ${ord.deliveryAddress}`
                                  : ''}
                                {ord.deliveryType === 'pickup' && ord.pickupTime
                                  ? ` — ${ord.pickupTime}`
                                  : ''}
                              </div>
                            </td>
                            <td>
                              <ul style={{ margin: 0, paddingLeft: 16, fontSize: '0.8rem', color: '#cbd5e1' }}>
                                {ord.items.map((item, idx) => (
                                  <li key={idx}>
                                    <strong>{item.quantity}x</strong> {item.name} ({item.unitWeightKg}kg {item.unit}) — Dhs {item.lineTotalAed.toFixed(2)}
                                  </li>
                                ))}
                              </ul>
                            </td>
                            <td>
                              <strong style={{ fontSize: '0.95rem', color: '#34d399' }}>
                                Dhs {ord.totalAmountAed.toFixed(2)}
                              </strong>
                            </td>
                            <td>
                              <span className={`${styles.statusPill} ${getStatusBadge(ord.status)}`}>
                                {ord.status.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td>
                              <div className={styles.actionBtnGroup}>
                                {ord.status === 'pending' && (
                                  <>
                                    <button
                                      type="button"
                                      className={styles.actionBtnPrimary}
                                      onClick={() => requestStatusChangeWithConfirmation(currentOrderId, ord.orderNumber, 'confirmed', 'Confirmed')}
                                      disabled={isUpdating}
                                    >
                                      Confirm Order
                                    </button>
                                    <button
                                      type="button"
                                      className={styles.actionBtnDanger}
                                      onClick={() => requestStatusChangeWithConfirmation(currentOrderId, ord.orderNumber, 'cancelled', 'Cancelled')}
                                      disabled={isUpdating}
                                    >
                                      Reject
                                    </button>
                                  </>
                                )}

                                {ord.status === 'confirmed' && (
                                  <>
                                    <button
                                      type="button"
                                      className={styles.actionBtnPrimary}
                                      onClick={() => requestStatusChangeWithConfirmation(currentOrderId, ord.orderNumber, 'preparing', 'Preparing / Packed')}
                                      disabled={isUpdating}
                                    >
                                      Pack &amp; Prepare
                                    </button>
                                    <button
                                      type="button"
                                      className={styles.actionBtnDanger}
                                      onClick={() => requestStatusChangeWithConfirmation(currentOrderId, ord.orderNumber, 'cancelled', 'Cancelled')}
                                      disabled={isUpdating}
                                    >
                                      Cancel
                                    </button>
                                  </>
                                )}

                                {ord.status === 'preparing' && (
                                  <>
                                    {ord.deliveryType === 'delivery' ? (
                                      <button
                                        type="button"
                                        className={styles.actionBtnPrimary}
                                        onClick={() => requestStatusChangeWithConfirmation(currentOrderId, ord.orderNumber, 'out_for_delivery', 'Out for Delivery')}
                                        disabled={isUpdating}
                                      >
                                        Dispatch
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        className={styles.actionBtnPrimary}
                                        onClick={() => requestStatusChangeWithConfirmation(currentOrderId, ord.orderNumber, 'ready_for_pickup', 'Ready for Pickup')}
                                        disabled={isUpdating}
                                      >
                                        Ready for Pickup
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      className={styles.actionBtnDanger}
                                      onClick={() => requestStatusChangeWithConfirmation(currentOrderId, ord.orderNumber, 'cancelled', 'Cancelled')}
                                      disabled={isUpdating}
                                    >
                                      Cancel
                                    </button>
                                  </>
                                )}

                                {(ord.status === 'ready_for_pickup' || ord.status === 'out_for_delivery') && (
                                  <button
                                    type="button"
                                    className={styles.actionBtnSuccess}
                                    onClick={() => requestStatusChangeWithConfirmation(currentOrderId, ord.orderNumber, 'delivered', 'Delivered')}
                                    disabled={isUpdating}
                                  >
                                    Mark Delivered
                                  </button>
                                )}

                                {ord.status === 'delivered' && (
                                  <span style={{ color: '#34d399', fontSize: '0.8rem', fontWeight: 700 }}>
                                    ✓ Fulfilled
                                  </span>
                                )}

                                {ord.status === 'cancelled' && (
                                  <span style={{ color: '#f87171', fontSize: '0.8rem', fontWeight: 700 }}>
                                    ✕ Cancelled
                                  </span>
                                )}
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
              VIEW 4: INVOICE (AweerMarket Orders vs. Personal/Off-Platform Sales)
             =================================================================== */}
          {activeTab === 'invoice' && (
            <section className={styles.sectionCard}>
              {/* Separate Tabs for Marketplace vs Personal Sales */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(16, 185, 129, 0.2)', paddingBottom: 16, marginBottom: 20 }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    type="button"
                    className={`${styles.filterTabBtn} ${invoiceSubTab === 'marketplace' ? styles.filterTabActive : ''}`}
                    onClick={() => setInvoiceSubTab('marketplace')}
                  >
                    🌿 AweerMarket Orders ({orders.length})
                  </button>
                  <button
                    type="button"
                    className={`${styles.filterTabBtn} ${invoiceSubTab === 'personal' ? styles.filterTabActive : ''}`}
                    onClick={() => setInvoiceSubTab('personal')}
                  >
                    🏪 Personal / Off-Platform Sales ({personalInvoices.length})
                  </button>
                </div>
                {invoiceSubTab === 'personal' && (
                  <button
                    type="button"
                    className={styles.addBtn}
                    onClick={() => setIsCreatePersonalInvoiceOpen(true)}
                  >
                    <span>+</span>
                    <span>Create Direct Stall Invoice</span>
                  </button>
                )}
              </div>

              {/* Notice Regarding Separation Rule */}
              <div style={{ background: '#020b08', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: 8, padding: '10px 16px', marginBottom: 20, fontSize: '0.8rem', color: '#94a3b8' }}>
                ℹ️ <strong>Invoice Separation Policy:</strong> Personal stall sales remain completely separate from AweerMarket marketplace orders and are <strong>exempt from platform commission</strong>.
              </div>

              {/* SUB-TAB 1: AweerMarket Marketplace Orders Invoicing */}
              {invoiceSubTab === 'marketplace' && (
                <>
                  <div className={styles.invoiceActionToolbar}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Select Marketplace Order:</label>
                      <select
                        className={styles.formSelect}
                        style={{ width: 240 }}
                        value={selectedOrderForInvoice?.id || ''}
                        onChange={(e) => {
                          const found = orders.find((o) => o.id === e.target.value);
                          if (found) setSelectedOrderForInvoice(found);
                        }}
                      >
                        {orders.map((o) => (
                          <option key={o.id} value={o.id}>
                            #{o.orderNumber} (Dhs {o.totalAmountAed.toFixed(2)})
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      className={styles.printBtn}
                      onClick={() => window.print()}
                    >
                      <span>🖨️</span>
                      <span>Print Marketplace Invoice</span>
                    </button>
                  </div>

                  {selectedOrderForInvoice ? (
                    <div className={styles.invoiceCard} id="printable-marketplace-invoice">
                      <div className={styles.invoiceHeaderRow}>
                        <div>
                          <div className={styles.invoiceBrandTitle}>
                            🌿 {shop?.name || user?.businessName || 'Al Aweer Wholesale Produce'}
                          </div>
                          <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: 4 }}>
                            {formatStallBadge(shop?.stallNumber)} • Al Aweer Central Fruits &amp; Vegetables Market, Dubai
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                            Tel: {shop?.phone || 'Contact Stall Operations'} | TRN: {shop?.tradeLicenseNumber || 'Registered Wholesale Stall'}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#0f172a' }}>AWEERMARKET TAX INVOICE</h2>
                          <div style={{ fontWeight: 700, color: '#047857', marginTop: 4 }}>
                            #{selectedOrderForInvoice.orderNumber}
                          </div>
                          <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                            Date: {new Date(selectedOrderForInvoice.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      <div className={styles.invoiceMetaGrid}>
                        <div>
                          <strong style={{ color: '#0f172a' }}>Billed &amp; Delivered To:</strong>
                          <div style={{ marginTop: 4 }}>Wholesale Buyer Account: {selectedOrderForInvoice.buyerId.slice(0, 12)}</div>
                          <div>Fulfillment Type: <strong style={{ textTransform: 'capitalize' }}>{selectedOrderForInvoice.deliveryType}</strong></div>
                          {selectedOrderForInvoice.deliveryAddress && (
                            <div>Address: {selectedOrderForInvoice.deliveryAddress}</div>
                          )}
                          {selectedOrderForInvoice.pickupTime && (
                            <div>Pickup Schedule: {selectedOrderForInvoice.pickupTime}</div>
                          )}
                        </div>
                        <div>
                          <strong style={{ color: '#0f172a' }}>Channel &amp; Commission:</strong>
                          <div style={{ marginTop: 4 }}>Sales Channel: <strong>AweerMarket Platform Order</strong></div>
                          <div>Platform Commission: <strong>5% Applied to Settlement</strong></div>
                          <div>Order Status: <strong style={{ textTransform: 'capitalize' }}>{selectedOrderForInvoice.status.replace(/_/g, ' ')}</strong></div>
                        </div>
                      </div>

                      <div className={styles.tableWrapper}>
                        <table className={styles.invoiceTable}>
                          <thead>
                            <tr>
                              <th>Item Description</th>
                              <th>Packaging &amp; Unit</th>
                              <th>Quantity</th>
                              <th>Rate (Dhs)</th>
                              <th>Amount (Dhs)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedOrderForInvoice.items.map((item, idx) => (
                              <tr key={idx}>
                                <td><strong>{item.name}</strong></td>
                                <td>{item.unitWeightKg} kg / {item.unit}</td>
                                <td>{item.quantity}</td>
                                <td>Dhs {item.unitPriceAed.toFixed(2)}</td>
                                <td>Dhs {item.lineTotalAed.toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className={styles.invoiceTotalRow}>
                        <div>Subtotal: <strong>Dhs {(selectedOrderForInvoice.totalAmountAed / 1.05).toFixed(2)}</strong></div>
                        <div>VAT (5% Inclusive): <strong>Dhs {(selectedOrderForInvoice.totalAmountAed - selectedOrderForInvoice.totalAmountAed / 1.05).toFixed(2)}</strong></div>
                        <div className={styles.invoiceGrandTotal}>
                          Total Due: Dhs {selectedOrderForInvoice.totalAmountAed.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.chartEmptyBox}>
                      <p>No marketplace orders found to invoice.</p>
                    </div>
                  )}
                </>
              )}

              {/* SUB-TAB 2: Personal / Off-Platform Direct Stall Invoicing */}
              {invoiceSubTab === 'personal' && (
                <>
                  <div className={styles.invoiceActionToolbar}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Select Personal Invoice:</label>
                      <select
                        className={styles.formSelect}
                        style={{ width: 240 }}
                        value={selectedPersonalInvoice?.id || ''}
                        onChange={(e) => {
                          const found = personalInvoices.find((pi) => pi.id === e.target.value);
                          if (found) setSelectedPersonalInvoice(found);
                        }}
                      >
                        {personalInvoices.map((pi) => (
                          <option key={pi.id} value={pi.id}>
                            #{pi.invoiceNumber} — {pi.buyerName} (Dhs {pi.totalAmountAed.toFixed(2)})
                          </option>
                        ))}
                      </select>
                    </div>
                    {selectedPersonalInvoice && (
                      <button
                        type="button"
                        className={styles.printBtn}
                        onClick={() => window.print()}
                      >
                        <span>🖨️</span>
                        <span>Print Direct Stall Invoice</span>
                      </button>
                    )}
                  </div>

                  {selectedPersonalInvoice ? (
                    <div className={styles.invoiceCard} id="printable-personal-invoice">
                      <div className={styles.invoiceHeaderRow}>
                        <div>
                          <div className={styles.invoiceBrandTitle}>
                            🏪 {shop?.name || user?.businessName || 'Al Aweer Vendor Stall'}
                          </div>
                          <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: 4 }}>
                            {formatStallBadge(shop?.stallNumber)} • Direct Wholesale Sales Invoice
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                            Tel: {shop?.phone || 'Contact Stall Operations'} | TRN: {shop?.tradeLicenseNumber || 'Registered Wholesale Stall'}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#0f172a' }}>DIRECT STALL INVOICE</h2>
                          <div style={{ fontWeight: 700, color: '#2563eb', marginTop: 4 }}>
                            #{selectedPersonalInvoice.invoiceNumber}
                          </div>
                          <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                            Date: {new Date(selectedPersonalInvoice.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      <div className={styles.invoiceMetaGrid}>
                        <div>
                          <strong style={{ color: '#0f172a' }}>Direct Stall Buyer:</strong>
                          <div style={{ marginTop: 4 }}>Buyer: <strong>{selectedPersonalInvoice.buyerName}</strong></div>
                          <div>Phone: {selectedPersonalInvoice.buyerPhone || 'Counter Sale'}</div>
                          {selectedPersonalInvoice.buyerTrn && <div>Buyer TRN: {selectedPersonalInvoice.buyerTrn}</div>}
                        </div>
                        <div>
                          <strong style={{ color: '#0f172a' }}>Direct Billing Terms:</strong>
                          <div style={{ marginTop: 4 }}>Channel: <strong>Off-Platform Direct Stall Sale</strong></div>
                          <div>Marketplace Commission: <strong>0% (Exempt from AweerMarket)</strong></div>
                          <div>Payment Terms: <strong>{selectedPersonalInvoice.paymentMethod}</strong></div>
                        </div>
                      </div>

                      <div className={styles.tableWrapper}>
                        <table className={styles.invoiceTable}>
                          <thead>
                            <tr>
                              <th>Produce Description</th>
                              <th>Unit Packaging</th>
                              <th>Quantity</th>
                              <th>Rate (Dhs)</th>
                              <th>Amount (Dhs)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedPersonalInvoice.items.map((item, idx) => (
                              <tr key={idx}>
                                <td><strong>{item.name}</strong></td>
                                <td>{item.unitWeightKg} kg / {item.unit}</td>
                                <td>{item.quantity}</td>
                                <td>Dhs {item.unitPriceAed.toFixed(2)}</td>
                                <td>Dhs {item.lineTotalAed.toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className={styles.invoiceTotalRow}>
                        <div>Subtotal: <strong>Dhs {selectedPersonalInvoice.subtotalAed.toFixed(2)}</strong></div>
                        <div>VAT (5%): <strong>Dhs {selectedPersonalInvoice.vatAed.toFixed(2)}</strong></div>
                        <div className={styles.invoiceGrandTotal} style={{ color: '#2563eb' }}>
                          Total Due: Dhs {selectedPersonalInvoice.totalAmountAed.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.chartEmptyBox}>
                      <span style={{ fontSize: '2rem', marginBottom: 8 }}>🧾</span>
                      <strong style={{ color: '#cbd5e1' }}>No Personal / Off-Platform Invoices Created Yet</strong>
                      <p style={{ margin: '4px 0 14px', fontSize: '0.8rem', color: '#64748b' }}>
                        Create direct wholesale challans and invoices for walk-in buyers at your stall.
                      </p>
                      <button
                        type="button"
                        className={styles.actionBtnPrimary}
                        onClick={() => setIsCreatePersonalInvoiceOpen(true)}
                      >
                        + Create First Direct Stall Invoice
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>
          )}

          {/* ===================================================================
              VIEW 5: INVENTORY & STOCK (Manage quantities, adjustments, low-stock)
             =================================================================== */}
          {activeTab === 'inventory' && (
            <section className={styles.tableSection}>
              <div className={styles.tableHeaderBar}>
                <div>
                  <h3 className={styles.tableTitle}>Stock Quantities &amp; Low-Stock Alerts</h3>
                  <p className={styles.tableSubtitle}>
                    Manage real stock levels, unit adjustments (kg, box, crate), and automatic low-stock triggers.
                  </p>
                </div>
                <button
                  type="button"
                  className={styles.addBtn}
                  onClick={() => setIsAddModalOpen(true)}
                >
                  <span>+</span>
                  <span>Add Produce Stock</span>
                </button>
              </div>

              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Produce Item</th>
                      <th>Category</th>
                      <th>Packaging Unit</th>
                      <th>Current Stock</th>
                      <th>Threshold Alert</th>
                      <th>Quick Stock Adjust</th>
                      <th>Catalog Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.length === 0 ? (
                      <tr>
                        <td colSpan={7} className={styles.emptyState}>
                          No produce found in inventory.
                        </td>
                      </tr>
                    ) : (
                      products.map((p) => {
                        const o = p.offer;
                        const stock = o?.availableStock || 0;
                        return (
                          <tr key={p.id}>
                            <td>
                              <strong>{p.name}</strong>
                              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                Origin: {formatCountryWithFlag(p.originCountry)}
                              </div>
                            </td>
                            <td>
                              <span style={{ textTransform: 'capitalize', color: '#34d399' }}>
                                {p.category.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td>{o ? `${o.unitWeightKg} kg / ${o.unit}` : '—'}</td>
                            <td>
                              <strong style={{ fontSize: '1rem', color: stock === 0 ? '#f87171' : stock <= 10 ? '#fbbf24' : '#ffffff' }}>
                                {stock} units
                              </strong>
                            </td>
                            <td>
                              {stock === 0 ? (
                                <span className={styles.outOfStockPill}>Out of Stock (Unavailable)</span>
                              ) : stock <= 10 ? (
                                <span className={styles.lowStockPill}>Low-Stock Alert (&lt;10)</span>
                              ) : (
                                <span style={{ color: '#34d399', fontSize: '0.78rem' }}>Optimal Stock</span>
                              )}
                            </td>
                            <td>
                              <div className={styles.stockAdjustWrap}>
                                <button
                                  type="button"
                                  className={styles.stockAdjustBtn}
                                  onClick={() => handleQuickStockAdjust(p, 10)}
                                  title="Add +10 units"
                                >
                                  +10
                                </button>
                                <button
                                  type="button"
                                  className={styles.stockAdjustBtn}
                                  onClick={() => handleQuickStockAdjust(p, -10)}
                                  disabled={stock <= 0}
                                  title="Reduce -10 units"
                                  style={{ color: '#f87171' }}
                                >
                                  -10
                                </button>
                                <button
                                  type="button"
                                  className={styles.actionBtn}
                                  onClick={() => openEditOfferModal(p)}
                                  style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                                >
                                  Set Custom
                                </button>
                              </div>
                            </td>
                            <td>
                              <span className={`${styles.statusPill} ${stock > 0 ? styles.statusActive : styles.statusSuspended}`}>
                                {stock > 0 ? 'Available to Buyers' : 'Unavailable'}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Stock Movement History Log */}
              <div style={{ padding: 20, borderTop: '1px solid rgba(16, 185, 129, 0.15)' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '0.9rem', color: '#ffffff' }}>
                  Stock Adjustments &amp; Movement Audit
                </h4>
                <div style={{ background: '#020b08', borderRadius: 8, padding: 12, border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                  {stockLogs.map((log) => (
                    <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <div>
                        <strong style={{ color: '#10b981' }}>{log.productName}</strong> — {log.reason}
                      </div>
                      <div style={{ color: '#94a3b8' }}>
                        {log.change !== 0 ? (log.change > 0 ? `+${log.change}` : log.change) : ''} (New: {log.newStock}) • {log.timestamp}
                      </div>
                    </div>
                  ))}
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 8 }}>
                    ℹ️ Stock is automatically deducted when buyers place wholesale orders, and restored on order cancellation.
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ===================================================================
              VIEW 6: SALES & REPORTS (Daily/monthly sales, order performance)
             =================================================================== */}
          {activeTab === 'sales' && (
            <section className={styles.sectionCard}>
              <div className={styles.tableHeaderBar} style={{ padding: 0, marginBottom: 20 }}>
                <div>
                  <h3 className={styles.sectionTitle}>Daily &amp; Monthly Sales Reports</h3>
                  <p className={styles.sectionSubtitle}>
                    Real order fulfillment metrics and wholesale volume breakdown.
                  </p>
                </div>
                <button
                  type="button"
                  className={styles.addBtn}
                  onClick={() => window.print()}
                >
                  <span>🖨️</span>
                  <span>Print Sales Report</span>
                </button>
              </div>

              <div className={styles.payoutOverviewGrid}>
                <div className={styles.payoutCard}>
                  <div className={styles.payoutTitle}>Today&apos;s Gross Sales</div>
                  <div className={styles.payoutAmount}>Dhs {todaySalesAed.toFixed(2)}</div>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{todayOrders.length} order(s) placed today</span>
                </div>
                <div className={styles.payoutCard}>
                  <div className={styles.payoutTitle}>Fulfilled Marketplace Sales</div>
                  <div className={styles.payoutAmount}>Dhs {grossMarketplaceSalesAed.toFixed(2)}</div>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{completedOrdersCount} fulfilled orders</span>
                </div>
                <div className={styles.payoutCard}>
                  <div className={styles.payoutTitle}>Fulfillment Rate</div>
                  <div className={styles.payoutAmount}>
                    {orders.length > 0 ? `${((completedOrdersCount / orders.length) * 100).toFixed(0)}%` : '100%'}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Completed without cancellation</span>
                </div>
              </div>

              <h4 style={{ color: '#ffffff', margin: '20px 0 12px' }}>Produce Sales Volume Performance</h4>
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Produce Item</th>
                      <th>Category</th>
                      <th>Quantity Sold</th>
                      <th>Unit Price</th>
                      <th>Gross Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.slice(0, 5).map((p) => {
                      const qtySold = orders
                        .filter((o) => o.status === 'delivered')
                        .reduce((acc, o) => {
                          const item = o.items.find((i) => i.productId === p.id);
                          return acc + (item ? item.quantity : 0);
                        }, 0);
                      const gross = qtySold * (p.offer?.priceAed || 0);
                      return (
                        <tr key={p.id}>
                          <td><strong>{p.name}</strong></td>
                          <td><span style={{ textTransform: 'capitalize', color: '#34d399' }}>{p.category.replace(/_/g, ' ')}</span></td>
                          <td><strong>{qtySold} packages</strong></td>
                          <td>Dhs {p.offer ? `${p.offer.priceAed.toFixed(2)} / ${p.offer.unit}` : '0.00'}</td>
                          <td><strong style={{ color: '#34d399' }}>Dhs {gross.toFixed(2)}</strong></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ===================================================================
              VIEW 7: PAYOUTS (Marketplace sales − Commission deductions = Payable)
             =================================================================== */}
          {activeTab === 'payouts' && (
            <section className={styles.sectionCard}>
              <h3 className={styles.sectionTitle}>Marketplace Sales, Commission &amp; Payouts</h3>
              <p className={styles.sectionSubtitle}>
                View real marketplace sales, configured commission deductions, and net payable vendor earnings.
              </p>

              {/* Commission Calculation Formula Box */}
              <div style={{ background: '#041610', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 10, padding: 18, marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <strong style={{ color: '#ffffff', fontSize: '0.95rem' }}>Commission Formula &amp; Settlement Rule:</strong>
                    <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: 4 }}>
                      Example: <strong>Dhs 1,000 marketplace sale − Dhs 50 commission (5%) = Dhs 950 net payable earnings.</strong>
                    </div>
                  </div>
                  <span style={{ background: '#0b2b20', border: '1px solid #10b981', color: '#10b981', fontWeight: 800, padding: '4px 10px', borderRadius: 6, fontSize: '0.78rem' }}>
                    Configured Rate: {(MARKETPLACE_COMMISSION_RATE * 100).toFixed(0)}%
                  </span>
                </div>
              </div>

              <div className={styles.payoutOverviewGrid}>
                {/* 1. Gross Marketplace Sales */}
                <div className={styles.payoutCard}>
                  <div className={styles.payoutTitle}>Gross Marketplace Sales</div>
                  <div className={styles.payoutAmount}>Dhs {grossMarketplaceSalesAed.toFixed(2)}</div>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>From fulfilled orders</span>
                </div>

                {/* 2. Platform Commission Deducted */}
                <div className={styles.payoutCard}>
                  <div className={styles.payoutTitle}>Commission Deducted ({(MARKETPLACE_COMMISSION_RATE * 100).toFixed(0)}%)</div>
                  <div className={styles.payoutAmount} style={{ color: '#f87171' }}>
                    - Dhs {platformCommissionAed.toFixed(2)}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>AweerMarket fee</span>
                </div>

                {/* 3. Net Payable Earnings */}
                <div className={styles.payoutCard}>
                  <div className={styles.payoutTitle}>Net Payable Earnings</div>
                  <div className={styles.payoutAmount}>Dhs {netPayableEarningsAed.toFixed(2)}</div>
                  <span style={{ fontSize: '0.75rem', color: '#34d399' }}>✓ Available for payout</span>
                </div>
              </div>

              <div style={{ background: '#020b08', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: 10, padding: 20, marginTop: 16 }}>
                <h4 style={{ margin: '0 0 10px', color: '#ffffff', fontSize: '0.9rem' }}>Wholesale Settlement Account Information</h4>
                <div style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: 1.6 }}>
                  <div>Settlement Beneficiary: <strong>{shop?.name || user?.businessName || 'Verified Vendor Stall'}</strong></div>
                  <div>Assigned Stall: <strong>{formatStallBadge(shop?.stallNumber)}</strong></div>
                  <div>Trade License / TRN: <strong>{shop?.tradeLicenseNumber || 'Verified Wholesale Business'}</strong></div>
                  <div>Clearing Mechanism: <strong>Direct Bank Settlement via UAE Central Bank WPS / Clearinghouse</strong></div>
                  <div>Settlement Schedule: <strong>Automated weekly clearing on verified delivered orders</strong></div>
                </div>
              </div>

              {/* Settlement Lifecycle & Duplicate-Payment Protection */}
              <div style={{ marginTop: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <h4 style={{ margin: 0, color: '#ffffff', fontSize: '0.95rem' }}>Settlement Batches &amp; Lifecycle Ledger</h4>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                    Supported Statuses: <span style={{ color: '#fbbf24' }}>Pending</span> • <span style={{ color: '#38bdf8' }}>Processing</span> • <span style={{ color: '#34d399' }}>Paid</span> • <span style={{ color: '#f87171' }}>Failed</span> • <span style={{ color: '#a78bfa' }}>On Hold</span>
                  </div>
                </div>

                <div style={{ background: '#020b08', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: 10, padding: 14, fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.6 }}>
                  <strong style={{ color: '#10b981' }}>🛡️ Duplicate-Payment &amp; Integrity Protection:</strong>
                  <div>
                    Payouts are calculated strictly from verified delivered orders. Batches are reconciled with UAE banking clearing references before status progression. Batches cannot be marked Paid without verified payment settlement.
                  </div>
                </div>

                {grossMarketplaceSalesAed > 0 ? (
                  <div style={{ marginTop: 14, background: '#030f0b', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: 8, padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong style={{ color: '#ffffff' }}>Batch Ref: AW-PAY-{shop?.id ? shop.id.slice(0, 8).toUpperCase() : 'STALL'}</strong>
                        <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                          Fulfilled Orders: {orders.filter((o) => o.status === 'delivered').length} delivered order(s)
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span className={`${styles.statusPill} ${styles.statusPending}`}>Pending Clearing</span>
                        <div style={{ color: '#34d399', fontWeight: 800, marginTop: 4 }}>
                          Dhs {netPayableEarningsAed.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={styles.chartEmptyBox} style={{ marginTop: 14 }}>
                    <span style={{ fontSize: '1.8rem', marginBottom: 6 }}>💳</span>
                    <strong style={{ color: '#cbd5e1' }}>No Fulfilled Marketplace Orders Awaiting Payout</strong>
                    <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                      As customer orders reach &lsquo;Delivered&rsquo; status, eligible net earnings and clearing batch references will automatically populate here.
                    </p>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ===================================================================
              VIEW 8: SHOP PROFILE (Name, logo, contact, address & business info)
             =================================================================== */}
          {activeTab === 'profile' && (
            <section className={styles.sectionCard}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <h3 className={styles.sectionTitle}>Shop Profile &amp; Business Information</h3>
                  <p className={styles.sectionSubtitle}>
                    Manage shop name, logo, contact details, address, and Al Aweer stall verification status.
                  </p>
                </div>
                <div>
                  {isApproved ? (
                    <span className={`${styles.statusPill} ${styles.statusActive}`}>
                      ✓ Verified Al Aweer Stall
                    </span>
                  ) : (
                    <span className={`${styles.statusPill} ${styles.statusPending}`}>
                      ⏳ Pending Super Admin Verification
                    </span>
                  )}
                </div>
              </div>

              <form onSubmit={handleSaveProfile}>
                <div className={styles.formGrid}>
                  <div className={styles.fieldGroup}>
                    <label htmlFor="edit-stallname" className={styles.formLabel}>
                      Shop / Stall Name *
                    </label>
                    <input
                      id="edit-stallname"
                      type="text"
                      className={styles.formInput}
                      value={stallName}
                      onChange={(e) => setStallName(e.target.value)}
                      disabled={isSavingProfile}
                      required
                    />
                  </div>

                  <div className={styles.fieldGroup}>
                    <label htmlFor="edit-stallnumber" className={styles.formLabel}>
                      Al Aweer Stall Number *
                    </label>
                    <input
                      id="edit-stallnumber"
                      type="text"
                      className={styles.formInput}
                      value={stallNumber}
                      onChange={(e) => setStallNumber(e.target.value)}
                      disabled={isSavingProfile}
                      required
                    />
                  </div>

                  <div className={styles.fieldGroup}>
                    <label htmlFor="edit-phone" className={styles.formLabel}>
                      Contact Phone Number *
                    </label>
                    <input
                      id="edit-phone"
                      type="tel"
                      className={styles.formInput}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      disabled={isSavingProfile}
                      required
                    />
                  </div>

                  <div className={styles.fieldGroup}>
                    <label htmlFor="edit-hours" className={styles.formLabel}>
                      Wholesale Opening Hours
                    </label>
                    <input
                      id="edit-hours"
                      type="text"
                      className={styles.formInput}
                      value={openingHours}
                      onChange={(e) => setOpeningHours(e.target.value)}
                      placeholder="e.g. 04:00 AM - 02:00 PM"
                    />
                  </div>

                  <div className={styles.fieldGroup}>
                    <label htmlFor="edit-schedule" className={styles.formLabel}>
                      Weekly Operating Schedule
                    </label>
                    <input
                      id="edit-schedule"
                      type="text"
                      className={styles.formInput}
                      value={weeklySchedule}
                      onChange={(e) => setWeeklySchedule(e.target.value)}
                      placeholder="e.g. Saturday to Thursday"
                    />
                  </div>

                  <div className={styles.fieldGroup}>
                    <label htmlFor="edit-location" className={styles.formLabel}>
                      Physical Stall Address &amp; Market Location
                    </label>
                    <input
                      id="edit-location"
                      type="text"
                      className={styles.formInput}
                      value={marketLocation}
                      onChange={(e) => setMarketLocation(e.target.value)}
                      placeholder="e.g. Block A Stall #15, Al Aweer Central Market"
                    />
                  </div>
                </div>

                <div style={{ marginTop: 20 }}>
                  <button type="submit" className={styles.saveBtn} disabled={isSavingProfile}>
                    {isSavingProfile ? 'Saving Changes...' : 'Save Stall Business Settings'}
                  </button>
                </div>
              </form>
            </section>
          )}

          {/* ===================================================================
              VIEW 9: CUSTOMERS (View customers & their order history)
             =================================================================== */}
          {activeTab === 'customers' && (
            <section className={styles.sectionCard}>
              <h3 className={styles.sectionTitle}>Wholesale Customers &amp; Order History</h3>
              <p className={styles.sectionSubtitle}>
                View verified commercial buyers, restaurants, and grocery businesses ordering from your stall.
              </p>

              {uniqueBuyers.length === 0 ? (
                <div className={styles.chartEmptyBox}>
                  <p>No customer records yet. Buyer accounts appear automatically as incoming orders arrive.</p>
                </div>
              ) : (
                uniqueBuyers.map((buyer) => (
                  <div key={buyer.id} className={styles.customerCard}>
                    <div>
                      <div style={{ fontWeight: 800, color: '#ffffff', fontSize: '0.95rem' }}>
                        Commercial Buyer #{buyer.id.slice(0, 12)}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: 2 }}>
                        Preferred Fulfillment: <strong style={{ color: '#10b981', textTransform: 'capitalize' }}>{buyer.deliveryType}</strong> • Last Order Date: {new Date(buyer.lastOrderDate).toLocaleDateString()}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <strong style={{ color: '#34d399', fontSize: '1rem' }}>
                        Dhs {buyer.totalSpendAed.toFixed(2)}
                      </strong>
                      <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                        {buyer.ordersCount} marketplace order(s)
                      </div>
                    </div>
                  </div>
                ))
              )}
            </section>
          )}

          {/* ===================================================================
              VIEW 10: REVIEWS & RATINGS (Genuine customer reviews from real data)
             =================================================================== */}
          {activeTab === 'reviews' && (
            <section className={styles.sectionCard}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <h3 className={styles.sectionTitle}>Customer Reviews &amp; Product Ratings</h3>
                  <p className={styles.sectionSubtitle}>
                    Genuine reviews and ratings submitted by verified wholesale buyers for your produce quality and service.
                  </p>
                </div>
                <div style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: 700 }}>
                  Strictly Genuine Feedback Only
                </div>
              </div>

              {reviews.length === 0 ? (
                <div className={styles.chartEmptyBox}>
                  <span style={{ fontSize: '2rem', marginBottom: 8 }}>⭐</span>
                  <strong style={{ color: '#cbd5e1' }}>No Customer Reviews Submitted Yet</strong>
                  <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                    As verified buyers receive fulfilled orders and leave feedback, genuine customer ratings and produce reviews will display here.
                  </p>
                </div>
              ) : (
                reviews.map((rev) => (
                  <div key={rev.id} className={styles.reviewCard}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <strong style={{ color: '#ffffff', fontSize: '0.95rem' }}>{rev.buyerName}</strong>
                        <div style={{ fontSize: '0.74rem', color: '#64748b' }}>{rev.buyerBusiness} • {rev.date}</div>
                      </div>
                      <div className={styles.reviewStars}>
                        {'★'.repeat(rev.rating)}{'☆'.repeat(5 - rev.rating)}
                      </div>
                    </div>
                    <p style={{ margin: '8px 0', fontSize: '0.85rem', color: '#cbd5e1' }}>
                      &ldquo;{rev.comment}&rdquo;
                    </p>

                    {rev.reply ? (
                      <div className={styles.reviewReply}>
                        <strong style={{ color: '#10b981' }}>Stall Response:</strong> {rev.reply}
                      </div>
                    ) : (
                      <div>
                        {replyReviewId === rev.id ? (
                          <div style={{ marginTop: 10 }}>
                            <input
                              type="text"
                              className={styles.formInput}
                              placeholder="Write official response to buyer..."
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              style={{ marginBottom: 8 }}
                            />
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button
                                type="button"
                                className={styles.actionBtnPrimary}
                                onClick={() => handleReplyReview(rev.id)}
                              >
                                Post Response
                              </button>
                              <button
                                type="button"
                                className={styles.actionBtn}
                                onClick={() => setReplyReviewId(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className={styles.actionBtn}
                            onClick={() => setReplyReviewId(rev.id)}
                            style={{ marginTop: 6 }}
                          >
                            💬 Reply to Review
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </section>
          )}

          {/* ===================================================================
              VIEW 11: NOTIFICATIONS (Order updates, stock alerts, announcements)
             =================================================================== */}
          {activeTab === 'notifications' && (
            <section className={styles.sectionCard}>
              <h3 className={styles.sectionTitle}>Operations Notifications &amp; Alerts</h3>
              <p className={styles.sectionSubtitle}>
                Receive order updates, stock threshold notifications, payout updates, and marketplace advisories.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {pendingOrdersCount > 0 && (
                  <div style={{ background: '#07251b', border: '1px solid #10b981', borderRadius: 8, padding: 14 }}>
                    <strong style={{ color: '#34d399' }}>🔔 New Wholesale Orders Awaiting Confirmation</strong>
                    <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#cbd5e1' }}>
                      You have {pendingOrdersCount} new marketplace order(s) waiting to be confirmed in your Orders tab.
                    </p>
                  </div>
                )}

                {lowStockItems.length > 0 && (
                  <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.4)', borderRadius: 8, padding: 14 }}>
                    <strong style={{ color: '#fbbf24' }}>📦 Low-Stock Threshold Alert</strong>
                    <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#cbd5e1' }}>
                      {lowStockItems.length} produce listings have fewer than 10 units in stock. Check your Inventory tab to adjust stock.
                    </p>
                  </div>
                )}

                <div style={{ background: '#041610', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: 8, padding: 14 }}>
                  <strong style={{ color: '#ffffff' }}>🏛️ Al Aweer Central Market Platform Advisory</strong>
                  <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                    Wholesale morning auctions begin at 04:00 AM daily. Loading dock inspectors will verify cold-chain compliance.
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* ===================================================================
              VIEW 12: SETTINGS (Manage account, security, preferences)
             =================================================================== */}
          {activeTab === 'settings' && (
            <section className={styles.sectionCard}>
              <h3 className={styles.sectionTitle}>Account &amp; Shop Settings</h3>
              <p className={styles.sectionSubtitle}>
                Manage account security, operational preferences, and commercial ordering limits.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ background: '#041610', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: 8, padding: 16 }}>
                  <strong style={{ color: '#ffffff' }}>Minimum Commercial Order Value</strong>
                  <p style={{ margin: '4px 0 10px', fontSize: '0.8rem', color: '#94a3b8' }}>
                    Set default minimum cart value for buyer orders.
                  </p>
                  <input type="text" className={styles.formInput} defaultValue="Dhs 100.00" style={{ maxWidth: 200 }} />
                </div>

                <div style={{ background: '#041610', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: 8, padding: 16 }}>
                  <strong style={{ color: '#ffffff' }}>Auto-Confirm Repeat Hospitality Buyers</strong>
                  <p style={{ margin: '4px 0 10px', fontSize: '0.8rem', color: '#94a3b8' }}>
                    Automatically confirm orders placed by verified enterprise hotel and restaurant accounts.
                  </p>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: '#cbd5e1' }}>
                    <input type="checkbox" defaultChecked /> Enable automated confirmation for verified buyers
                  </label>
                </div>
              </div>
            </section>
          )}



          {/* Footer */}
          <footer className={styles.dashboardFooter}>
            <div>Aweermarket | Stall Operations Panel</div>
            <div className={styles.footerLinks}>
              <span>© 2026 Aweermarket. All rights reserved.</span>
              <a href="#" className={styles.footerLink}>Privacy</a>
              <a href="#" className={styles.footerLink}>Terms</a>
              <a href="#" className={styles.footerLink}>Help</a>
            </div>
          </footer>
        </main>
      </div>

      {/* =====================================================================
          MODAL: ADD NEW PRODUCT (Strict 8-Field Specification)
         ===================================================================== */}
      {isAddModalOpen && (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-labelledby="add-product-modal-title">
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <div>
                <h3 id="add-product-modal-title" className={styles.modalTitle}>
                  🌿 Add New Produce Listing
                </h3>
                <p className={styles.modalSubtitle}>
                  Publish fresh wholesale offers to Dubai Al Aweer marketplace buyers.
                </p>
              </div>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => {
                  setIsAddModalOpen(false);
                  resetAddProductForm();
                }}
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            {addModalError && (
              <div className={styles.errorBanner} role="alert" style={{ margin: '14px 22px 0' }}>
                {addModalError}
              </div>
            )}

            <form onSubmit={handleAddProduce} className={styles.modalForm}>
              <div className={styles.modalBody}>
                {/* 1. Product Name */}
                <div className={styles.fieldGroup}>
                  <label className={styles.formLabel} htmlFor="field-prod-name">
                    Product Name *
                  </label>
                  <input
                    id="field-prod-name"
                    type="text"
                    className={styles.formInput}
                    placeholder="e.g. Valencia Oranges, Cavendish Bananas, Vine Tomatoes"
                    value={prodName}
                    onChange={(e) => setProdName(e.target.value)}
                    required
                    autoComplete="off"
                  />
                </div>

                {/* 2. Category & 3. Country of Origin */}
                <div className={styles.formGrid2Col}>
                  {/* 2. Category */}
                  <div className={styles.fieldGroup}>
                    <label className={styles.formLabel} htmlFor="field-prod-category">
                      Category *
                    </label>
                    <select
                      id="field-prod-category"
                      className={styles.formSelect}
                      value={prodCategory}
                      onChange={(e) => setProdCategory(e.target.value)}
                      required
                    >
                      {categories && categories.length > 0 ? (
                        categories.filter((c) => c.isActive !== false).map((c) => {
                          const val = c.slug || (c as any).key;
                          const name = c.name || (c as any).label || val;
                          return (
                            <option key={c.id || val} value={val}>
                              {c.icon ? `${c.icon} ` : ''}{name}
                            </option>
                          );
                        })
                      ) : (
                        <>
                          <option value="fresh_fruits">🍎 Fresh Fruits</option>
                          <option value="fresh_vegetables">🥬 Fresh Vegetables</option>
                          <option value="citrus">🍊 Citrus Fruits</option>
                          <option value="exotic_produce">🥭 Exotic / Tropical</option>
                          <option value="leafy_greens">🌿 Leafy Greens</option>
                          <option value="root_vegetables">🥔 Root Vegetables</option>
                          <option value="berries">🍓 Berries &amp; Melons</option>
                        </>
                      )}
                    </select>
                  </div>

                  {/* 3. Country of Origin */}
                  <div className={styles.fieldGroup}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <label className={styles.formLabel} htmlFor="field-prod-origin" style={{ margin: 0 }}>
                        Country of Origin *
                      </label>
                      {getCountryFlag(prodOrigin) && (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            color: '#4ade80',
                            background: 'rgba(34, 197, 94, 0.14)',
                            border: '1px solid rgba(34, 197, 94, 0.35)',
                            padding: '2px 8px',
                            borderRadius: 6
                          }}
                        >
                          <span style={{ fontSize: '1.05rem', lineHeight: 1 }}>{getCountryFlag(prodOrigin)}</span>
                          <span>Auto Flag</span>
                        </span>
                      )}
                    </div>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      {getCountryFlag(prodOrigin) && (
                        <span
                          style={{
                            position: 'absolute',
                            left: 12,
                            fontSize: '1.25rem',
                            pointerEvents: 'none',
                            lineHeight: 1,
                            zIndex: 2
                          }}
                        >
                          {getCountryFlag(prodOrigin)}
                        </span>
                      )}
                      <input
                        id="field-prod-origin"
                        type="text"
                        list="country-origins-list"
                        className={styles.formInput}
                        style={{
                          paddingLeft: getCountryFlag(prodOrigin) ? 44 : undefined,
                          transition: 'padding-left 0.2s ease'
                        }}
                        placeholder="e.g. Pakistan, Egypt, Turkey, Sri Lanka"
                        value={prodOrigin}
                        onChange={(e) => setProdOrigin(e.target.value)}
                        required
                        autoComplete="country-name"
                      />
                    </div>
                    <datalist id="country-origins-list">
                      {COMMON_PRODUCE_ORIGINS.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.flag} {c.name}
                        </option>
                      ))}
                    </datalist>
                  </div>
                </div>

                {/* 4. Product Image */}
                <div className={styles.fieldGroup}>
                  <label className={styles.formLabel}>
                    Product Image *
                  </label>
                  <div className={styles.imageUploadCard}>
                    <input
                      ref={fileInputRef}
                      id="field-prod-image-file"
                      type="file"
                      accept="image/png, image/jpeg, image/webp"
                      style={{ display: 'none' }}
                      onChange={handleImageFileChange}
                    />

                    {/* Selected Image Preview or Compact Upload Dropzone */}
                    {(uploadPreviewUrl || prodImageUrl) ? (
                      <div className={styles.imagePreviewWrap}>
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                          <img
                            src={uploadPreviewUrl || prodImageUrl}
                            alt={prodName || 'Product Preview'}
                            className={styles.imagePreviewThumb}
                          />
                          {isUploadingImage && (
                            <div className={styles.uploadingOverlay}>
                              <span>☁️ Uploading to R2...</span>
                            </div>
                          )}
                        </div>
                        <div className={styles.imagePreviewMeta}>
                          <div className={styles.imagePreviewStatus}>
                            <span className={styles.imagePreviewBadge}>✓ Photo Selected</span>
                            <span className={styles.imagePreviewTitle}>
                              {isUploadingImage
                                ? 'Uploading to Cloudflare R2...'
                                : prodImageUrl.startsWith('http')
                                ? 'Custom R2 Produce Photo'
                                : 'Catalog Produce Photo'}
                            </span>
                          </div>
                          <div className={styles.imageActionButtons}>
                            <button
                              type="button"
                              className={styles.imageActionBtn}
                              onClick={() => fileInputRef.current?.click()}
                              disabled={isUploadingImage}
                            >
                              📷 Change Photo
                            </button>
                            <button
                              type="button"
                              className={styles.imageRemoveBtn}
                              onClick={() => {
                                if (draftUploadedKey) {
                                  safeCleanupDraftImage(draftUploadedKey);
                                  setDraftUploadedKey(null);
                                }
                                setProdImageUrl('');
                                setUploadPreviewUrl(null);
                              }}
                              disabled={isUploadingImage}
                            >
                              ✕ Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div
                        className={styles.imageDropzone}
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const droppedFile = e.dataTransfer.files?.[0];
                          if (droppedFile) {
                            processImageFile(droppedFile);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            fileInputRef.current?.click();
                          }
                        }}
                      >
                        <div className={styles.dropzoneIconWrap}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="17 8 12 3 7 8"/>
                            <line x1="12" y1="3" x2="12" y2="15"/>
                          </svg>
                        </div>
                        <div className={styles.dropzoneTextWrap}>
                          <span className={styles.dropzoneMainText}>Upload Custom Produce Photo</span>
                          <span className={styles.dropzoneSubText}>Click to browse or drag file (JPG, PNG, WebP up to 5MB)</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 5. Selling Price & 6. Unit */}
                <div className={styles.formGrid2Col}>
                  {/* 5. Selling Price */}
                  <div className={styles.fieldGroup}>
                    <label className={styles.formLabel} htmlFor="field-prod-price">
                      Selling Price (AED) *
                    </label>
                    <div className={styles.inputWithAddon}>
                      <span className={styles.inputAddonPrefix}>AED</span>
                      <input
                        id="field-prod-price"
                        type="number"
                        step="0.01"
                        min="0.01"
                        inputMode="decimal"
                        className={styles.formInputAddon}
                        placeholder="e.g. 35.00"
                        value={prodPrice === 0 ? '' : prodPrice}
                        onChange={(e) => setProdPrice(e.target.value === '' ? 0 : Number(e.target.value))}
                        required
                      />
                    </div>
                  </div>

                  {/* 6. Unit */}
                  <div className={styles.fieldGroup}>
                    <label className={styles.formLabel} htmlFor="field-prod-unit">
                      Wholesale Unit *
                    </label>
                    <select
                      id="field-prod-unit"
                      className={styles.formSelect}
                      value={prodUnit}
                      onChange={(e) => {
                        const nextUnit = e.target.value;
                        setProdUnit(nextUnit);
                        if (!['box', 'ctn', 'pkt', 'bag', 'sack'].includes(nextUnit.toLowerCase())) {
                          setProdWeight(0);
                        } else {
                          setProdWeight(getDefaultUnitWeightKg(nextUnit));
                        }
                      }}
                      required
                    >
                      <option value="box">Box</option>
                      <option value="kg">KG</option>
                      <option value="ctn">CTN</option>
                      <option value="piece">Piece</option>
                      <option value="bag">Bag</option>
                      <option value="pkt">PKT</option>
                    </select>
                  </div>
                </div>

                {/* Conditional Weight (KG) for Box, CTN, PKT, Bag, Sack */}
                {['box', 'ctn', 'pkt', 'bag', 'sack'].includes(prodUnit.toLowerCase()) && (
                  <div className={styles.fieldGroup}>
                    <label className={styles.formLabel} htmlFor="field-prod-weight">
                      Weight (KG) *
                    </label>
                    <div className={styles.inputWithAddon}>
                      <span className={styles.inputAddonPrefix}>KG</span>
                      <input
                        id="field-prod-weight"
                        type="number"
                        step="0.01"
                        min="0.01"
                        inputMode="decimal"
                        className={styles.formInputAddon}
                        placeholder={`e.g. ${getDefaultUnitWeightKg(prodUnit)}`}
                        value={prodWeight === 0 ? '' : prodWeight}
                        onChange={(e) => setProdWeight(e.target.value === '' ? 0 : Number(e.target.value))}
                        required
                      />
                    </div>
                  </div>
                )}

                {/* 7. Minimum Order Quantity & 8. Available Stock */}
                <div className={styles.formGrid2Col}>
                  {/* 7. Minimum Order Quantity */}
                  <div className={styles.fieldGroup}>
                    <label className={styles.formLabel} htmlFor="field-prod-moq">
                      Minimum Order Quantity (MOQ) *
                    </label>
                    <input
                      id="field-prod-moq"
                      type="number"
                      min="1"
                      step="1"
                      inputMode="numeric"
                      className={styles.formInput}
                      placeholder="e.g. 1"
                      value={prodMoq === 0 ? '' : prodMoq}
                      onChange={(e) => setProdMoq(e.target.value === '' ? 1 : Math.max(1, parseInt(e.target.value, 10) || 1))}
                      required
                    />
                  </div>

                  {/* 8. Available Stock */}
                  <div className={styles.fieldGroup}>
                    <label className={styles.formLabel} htmlFor="field-prod-stock">
                      Available Stock *
                    </label>
                    <input
                      id="field-prod-stock"
                      type="number"
                      min="0"
                      step="1"
                      inputMode="numeric"
                      className={styles.formInput}
                      placeholder="e.g. 50"
                      value={prodStock === 0 ? '' : prodStock}
                      onChange={(e) => setProdStock(e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value, 10) || 0))}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.confirmCancelBtn}
                  onClick={() => {
                    setIsAddModalOpen(false);
                    resetAddProductForm();
                  }}
                  disabled={isSubmittingProd}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.saveBtn}
                  disabled={isSubmittingProd || isUploadingImage}
                  id="save-product-btn"
                >
                  {isSubmittingProd ? (
                    'Publishing...'
                  ) : isUploadingImage ? (
                    'Uploading Image...'
                  ) : (
                    '✓ Publish Produce Listing'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: QUICK UPDATE OFFER (Price & Stock)
         ===================================================================== */}
      {editingItem && (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true">
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Update Produce Terms</h3>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setEditingItem(null)}
              >
                ✕
              </button>
            </div>

            <p style={{ margin: '14px 22px 0', fontSize: '0.85rem', color: '#94a3b8' }}>
              Updating wholesale pricing, package weight, and active stock for{' '}
              <strong style={{ color: '#ffffff' }}>{editingItem.name}</strong>
            </p>

            {editOfferError && (
              <div className={styles.errorBanner} role="alert" style={{ margin: '14px 22px 0' }}>
                {editOfferError}
              </div>
            )}

            <form onSubmit={handleUpdateOffer} className={styles.modalForm}>
              <div className={styles.modalBody}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.formLabel}>
                      Selling Price (AED per {editingItem.offer?.unit || 'unit'}) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      className={styles.formInput}
                      value={editPrice === 0 ? '' : editPrice}
                      onChange={(e) => setEditPrice(e.target.value === '' ? 0 : Number(e.target.value))}
                      required
                    />
                  </div>

                  <div className={styles.fieldGroup}>
                    <label className={styles.formLabel}>
                      Weight (KG per {editingItem.offer?.unit || 'unit'}) *
                    </label>
                    <div className={styles.inputWithAddon}>
                      <span className={styles.inputAddonPrefix}>KG</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        inputMode="decimal"
                        className={styles.formInputAddon}
                        placeholder="e.g. 10.00"
                        value={editWeight === 0 ? '' : editWeight}
                        onChange={(e) => setEditWeight(e.target.value === '' ? 0 : Number(e.target.value))}
                        required
                      />
                    </div>
                  </div>

                  <div className={styles.fieldGroup}>
                    <label className={styles.formLabel}>Available Stock *</label>
                    <input
                      type="number"
                      min="0"
                      className={styles.formInput}
                      value={editStock === 0 ? '' : editStock}
                      onChange={(e) => setEditStock(e.target.value === '' ? 0 : Number(e.target.value))}
                      required
                    />
                  </div>

                  <div className={styles.fieldGroup}>
                    <label className={styles.formLabel}>Minimum Order (MOQ) *</label>
                    <input
                      type="number"
                      min="1"
                      className={styles.formInput}
                      value={editMoq === 0 ? '' : editMoq}
                      onChange={(e) => setEditMoq(e.target.value === '' ? 1 : Math.max(1, parseInt(e.target.value, 10) || 1))}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.confirmCancelBtn}
                  onClick={() => setEditingItem(null)}
                  disabled={isSavingOffer}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.saveBtn}
                  disabled={isSavingOffer}
                >
                  {isSavingOffer ? 'Saving...' : 'Save Updated Offer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: CREATE DIRECT OFF-PLATFORM PERSONAL STALL INVOICE
         ===================================================================== */}
      {isCreatePersonalInvoiceOpen && (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true">
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Create Direct Stall Invoice (Off-Platform)</h3>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setIsCreatePersonalInvoiceOpen(false)}
              >
                ✕
              </button>
            </div>

            <div style={{ margin: '14px 22px 0', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', padding: 10, borderRadius: 6, fontSize: '0.78rem', color: '#93c5fd' }}>
              ℹ️ <strong>0% Commission Policy:</strong> Direct off-platform invoices are for walk-in stall buyers. They are not subject to AweerMarket commission and do not count toward marketplace order stats.
            </div>

            <form onSubmit={handleCreatePersonalInvoice}>
              <div className={styles.modalBody}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.formLabel}>Buyer / Business Name *</label>
                    <input
                      type="text"
                      className={styles.formInput}
                      placeholder="e.g. Al Madina Grocers LLC"
                      value={piBuyerName}
                      onChange={(e) => setPiBuyerName(e.target.value)}
                      required
                    />
                  </div>

                  <div className={styles.fieldGroup}>
                    <label className={styles.formLabel}>Buyer Phone Number</label>
                    <input
                      type="tel"
                      className={styles.formInput}
                      placeholder="e.g. +971 50 123 4567"
                      value={piBuyerPhone}
                      onChange={(e) => setPiBuyerPhone(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.formLabel}>Buyer TRN / Tax Reg (Optional)</label>
                    <input
                      type="text"
                      className={styles.formInput}
                      placeholder="100..."
                      value={piBuyerTrn}
                      onChange={(e) => setPiBuyerTrn(e.target.value)}
                    />
                  </div>

                  <div className={styles.fieldGroup}>
                    <label className={styles.formLabel}>Payment Method</label>
                    <select
                      className={styles.formSelect}
                      value={piPaymentMethod}
                      onChange={(e) => setPiPaymentMethod(e.target.value)}
                    >
                      <option value="Cash on Delivery at Stall">Cash at Stall</option>
                      <option value="Direct UAE Bank Transfer (ACH)">Direct Bank Transfer</option>
                      <option value="Commercial Cheque (7 Days)">Wholesale Cheque</option>
                    </select>
                  </div>
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.formLabel}>Produce Item Description *</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={piItemName}
                    onChange={(e) => setPiItemName(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.formLabel}>Packaging Unit</label>
                    <select
                      className={styles.formSelect}
                      value={piItemUnit}
                      onChange={(e) => setPiItemUnit(e.target.value as WholesaleUnit)}
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
                    <label className={styles.formLabel}>Quantity *</label>
                    <input
                      type="number"
                      min="1"
                      className={styles.formInput}
                      value={piItemQuantity}
                      onChange={(e) => setPiItemQuantity(Number(e.target.value))}
                      required
                    />
                  </div>

                  <div className={styles.fieldGroup}>
                    <label className={styles.formLabel}>Unit Price (Dhs) *</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.1"
                      className={styles.formInput}
                      value={piItemUnitPrice}
                      onChange={(e) => setPiItemUnitPrice(Number(e.target.value))}
                      required
                    />
                  </div>
                </div>

                <div style={{ background: '#041610', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '10px 14px', borderRadius: 8, fontSize: '0.85rem', color: '#10b981' }}>
                  Invoice Total: Subtotal Dhs {(piItemQuantity * piItemUnitPrice).toFixed(2)} + 5% VAT ={' '}
                  <strong>Dhs {((piItemQuantity * piItemUnitPrice) * 1.05).toFixed(2)}</strong>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.confirmCancelBtn}
                  onClick={() => setIsCreatePersonalInvoiceOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.saveBtn}
                >
                  Generate &amp; Save Direct Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          CONFIRMATION POPUP MODAL (Cancel Order / Update Offer / Update Profile)
         ===================================================================== */}
      {confirmDialog && confirmDialog.isOpen && (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true">
          <div className={styles.confirmModalCard}>
            <div className={styles.confirmHeader}>
              <div
                className={
                  confirmDialog.variant === 'danger'
                    ? styles.confirmIconDanger
                    : styles.confirmIconPrimary
                }
              >
                {confirmDialog.variant === 'danger' ? '⚠️' : '✏️'}
              </div>
              <h3 className={styles.confirmTitle}>{confirmDialog.title}</h3>
            </div>

            <div className={styles.confirmBody}>
              <p style={{ margin: 0 }}>{confirmDialog.message}</p>

              {confirmDialog.detail && (
                <div className={styles.confirmDetailBox}>
                  {confirmDialog.detail}
                </div>
              )}

              {confirmDialog.warningNotice && (
                <div className={styles.confirmNotice}>
                  ⚠️ <strong>Notice:</strong> {confirmDialog.warningNotice}
                </div>
              )}
            </div>

            <div className={styles.confirmFooter}>
              <button
                type="button"
                className={styles.confirmCancelBtn}
                onClick={() => !isExecutingDialog && setConfirmDialog(null)}
                disabled={isExecutingDialog}
              >
                {confirmDialog.cancelLabel || 'Cancel'}
              </button>
              <button
                type="button"
                className={
                  confirmDialog.variant === 'danger'
                    ? styles.confirmSubmitDangerBtn
                    : styles.confirmSubmitPrimaryBtn
                }
                disabled={isExecutingDialog}
                onClick={async () => {
                  setIsExecutingDialog(true);
                  try {
                    await confirmDialog.onConfirm();
                  } finally {
                    setIsExecutingDialog(false);
                    setConfirmDialog(null);
                  }
                }}
              >
                {isExecutingDialog ? 'Processing...' : confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MOBILE BOTTOM NAVIGATION (Fixed at bottom for vendor quick actions)
         ===================================================================== */}
      <nav className={styles.mobileBottomNav} aria-label="Vendor Quick Navigation">
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
          onClick={() => handleNavSelect('products')}
          className={`${styles.mobileNavItem} ${activeTab === 'products' ? styles.mobileNavItemActive : ''}`}
        >
          <svg className={styles.mobileNavSvg} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2l9 4.9V17L12 22l-9-5V6.9L12 2z"></path>
            <path d="M12 22V12"></path>
            <path d="M21 7l-9 5-9-5"></path>
          </svg>
          <span>Products</span>
          {products.length > 0 && <span className={styles.mobileNavCountBadge}>{products.length}</span>}
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
          {pendingOrdersCount > 0 && (
            <span className={styles.mobileNavAlertBadge}>{pendingOrdersCount}</span>
          )}
        </button>

        <button
          type="button"
          onClick={() => handleNavSelect('invoice')}
          className={`${styles.mobileNavItem} ${activeTab === 'invoice' ? styles.mobileNavItemActive : ''}`}
        >
          <svg className={styles.mobileNavSvg} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
          <span>Invoice</span>
        </button>

        <button
          type="button"
          onClick={() => setIsMobileDrawerOpen((prev) => !prev)}
          className={`${styles.mobileNavItem} ${isMobileDrawerOpen ? styles.mobileNavItemActive : ''}`}
          aria-label={isMobileDrawerOpen ? 'Close navigation menu' : 'Open navigation menu'}
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
