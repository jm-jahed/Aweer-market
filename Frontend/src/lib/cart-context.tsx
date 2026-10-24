'use client';

/**
 * AweerMarket Buyer Cart Context
 * Enforces the approved Single-Vendor Cart Policy:
 * A buyer's cart may contain wholesale produce from only ONE stall at a time.
 * Attempting to add items from a second stall triggers an explicit conflict confirmation.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';

export interface CartItem {
  productId: string;
  name: string;
  unit: string;
  unitWeightKg: number;
  unitPriceAed: number;
  quantity: number;
  minOrderQuantity: number;
  availableStock: number;
}

export interface VendorConflict {
  existingShopName: string;
  newShopId: string;
  newShopName: string;
  pendingItem: CartItem;
}

export interface CartContextValue {
  shopId: string | null;
  shopName: string | null;
  items: CartItem[];
  conflict: VendorConflict | null;
  addToCart: (item: CartItem, shop: { id: string; name: string }) => boolean;
  resolveConflict: (replace: boolean) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  totalItemsCount: number;
  cartTotalAed: number;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

const CART_STORAGE_KEY = 'aweer_market_cart';

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [shopId, setShopId] = useState<string | null>(null);
  const [shopName, setShopName] = useState<string | null>(null);
  const [items, setItems] = useState<CartItem[]>([]);
  const [conflict, setConflict] = useState<VendorConflict | null>(null);

  // Restore cart state from localStorage on initial render
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.shopId && Array.isArray(parsed.items)) {
          setShopId(parsed.shopId);
          setShopName(parsed.shopName || 'Al Aweer Stall');
          setItems(parsed.items);
        }
      }
    } catch {
      // Ignore parse failure on storage
    }
  }, []);

  // Persist cart state on modification
  useEffect(() => {
    try {
      if (items.length > 0 && shopId) {
        localStorage.setItem(
          CART_STORAGE_KEY,
          JSON.stringify({ shopId, shopName, items })
        );
      } else {
        localStorage.removeItem(CART_STORAGE_KEY);
      }
    } catch {
      // Storage unavailable or disabled
    }
  }, [shopId, shopName, items]);

  const addToCart = (item: CartItem, shop: { id: string; name: string }): boolean => {
    // 1. If cart is empty or same shop, add directly
    if (!shopId || items.length === 0 || shopId === shop.id) {
      setShopId(shop.id);
      setShopName(shop.name);

      setItems((prev) => {
        const existingIdx = prev.findIndex((i) => i.productId === item.productId);
        if (existingIdx >= 0) {
          const updated = [...prev];
          const newQty = updated[existingIdx].quantity + item.quantity;
          updated[existingIdx] = {
            ...updated[existingIdx],
            quantity: Math.min(newQty, item.availableStock)
          };
          return updated;
        }
        return [...prev, item];
      });
      return true;
    }

    // 2. Conflict detected: Cart contains items from another vendor!
    setConflict({
      existingShopName: shopName || 'another stall',
      newShopId: shop.id,
      newShopName: shop.name,
      pendingItem: item
    });
    return false;
  };

  const resolveConflict = (replace: boolean) => {
    if (!conflict) return;

    if (replace) {
      // Clear existing vendor items and initialize cart with new vendor item
      setShopId(conflict.newShopId);
      setShopName(conflict.newShopName);
      setItems([conflict.pendingItem]);
    }
    setConflict(null);
  };

  const updateQuantity = (productId: string, quantity: number) => {
    setItems((prev) =>
      prev
        .map((item) => {
          if (item.productId === productId) {
            if (quantity <= 0) return null;
            const validQty = Math.max(item.minOrderQuantity, Math.min(quantity, item.availableStock));
            return { ...item, quantity: validQty };
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (productId: string) => {
    setItems((prev) => {
      const remaining = prev.filter((i) => i.productId !== productId);
      if (remaining.length === 0) {
        setShopId(null);
        setShopName(null);
      }
      return remaining;
    });
  };

  const clearCart = () => {
    setItems([]);
    setShopId(null);
    setShopName(null);
    setConflict(null);
  };

  const totalItemsCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotalAed = items.reduce((sum, item) => sum + item.quantity * item.unitPriceAed, 0);

  return (
    <CartContext.Provider
      value={{
        shopId,
        shopName,
        items,
        conflict,
        addToCart,
        resolveConflict,
        updateQuantity,
        removeFromCart,
        clearCart,
        totalItemsCount,
        cartTotalAed: Math.round(cartTotalAed * 100) / 100
      }}
    >
      {children}
      {/* Vendor Conflict Modal */}
      {conflict && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '14px',
              maxWidth: '480px',
              width: '100%',
              padding: '28px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div
                style={{
                  backgroundColor: '#fef3c7',
                  color: '#b45309',
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.25rem',
                  fontWeight: 'bold'
                }}
              >
                !
              </div>
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a' }}>
                Single-Vendor Cart Policy
              </h3>
            </div>

            <p style={{ margin: '0 0 16px 0', color: '#334155', lineHeight: 1.5, fontSize: '0.95rem' }}>
              Your cart currently contains produce from <strong>{conflict.existingShopName}</strong>.
            </p>
            <p style={{ margin: '0 0 24px 0', color: '#64748b', lineHeight: 1.5, fontSize: '0.9rem' }}>
              In Dubai Al Aweer wholesale, each order is fulfilled by a single stall. Would you like to clear your current cart and start a new order with <strong>{conflict.newShopName}</strong>?
            </p>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => resolveConflict(false)}
                style={{
                  padding: '10px 18px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  color: '#334155',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Keep Current Cart
              </button>
              <button
                type="button"
                onClick={() => resolveConflict(true)}
                style={{
                  padding: '10px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#16a34a',
                  color: '#ffffff',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Replace Cart &amp; Add
              </button>
            </div>
          </div>
        </div>
      )}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
