'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCart, CartItem } from '@/lib/cart-context';
import { getProductById } from '@/lib/api-client';
import { resolveProduceImage } from '@/lib/catalog-utils';
import type { ProductItem, ProductOfferSummary } from '@aweermarket/types';
import styles from './ProductDetails.module.css';

interface ProductDisplayModel {
  id: string;
  name: string;
  category: string;
  originCountry: string;
  description: string;
  lowestPriceAedPerKg: number;
  image: string;
}

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params?.id as string;
  const { addToCart, conflict, resolveConflict } = useCart();

  const [product, setProduct] = useState<ProductDisplayModel | null>(null);
  const [offers, setOffers] = useState<ProductOfferSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!productId) return;

    setLoading(true);
    setError(null);

    getProductById(productId)
      .then((res) => {
        if (res?.product) {
          const p = res.product;
          setProduct({
            id: p.id,
            name: p.name,
            category: p.category,
            originCountry: p.originCountry,
            description: p.description || 'Wholesale produce sourced directly from Dubai Al Aweer Central Market.',
            lowestPriceAedPerKg: p.lowestPriceAedPerKg || 0,
            image: resolveProduceImage(p.name, p.category, p.imageUrl)
          });
          // Sort offers by equivalent price per kg ascending
          const sortedOffers = [...(p.offers || [])].sort(
            (a, b) => a.equivalentPricePerKg - b.equivalentPricePerKg
          );
          setOffers(sortedOffers);
        } else {
          setError('Product not found in Al Aweer catalog.');
        }
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Unable to load produce details from server.';
        setError(msg);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [productId]);

  const handleAddOffer = (offer: ProductOfferSummary) => {
    if (!product || offer.availableStock <= 0) return;

    const item: CartItem = {
      productId: product.id,
      name: `${product.name} (${offer.unitWeightKg}kg ${offer.unit})`,
      unit: offer.unit,
      unitWeightKg: offer.unitWeightKg,
      quantity: offer.minOrderQuantity || 1,
      unitPriceAed: offer.priceAed,
      minOrderQuantity: offer.minOrderQuantity || 1,
      availableStock: offer.availableStock
    };

    const shop = {
      id: offer.vendorId,
      name: offer.shopName
    };

    const success = addToCart(item, shop);
    if (success) {
      setToastMessage(`Added ${product.name} from ${offer.shopName} to cart!`);
      setTimeout(() => setToastMessage(null), 2500);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div style={{ textAlign: 'center', padding: '80px 20px', color: '#86efac' }}>
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>📦</div>
          <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>Loading wholesale produce details...</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className={styles.container}>
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
          <h2 style={{ color: '#ffffff', marginBottom: 8 }}>Produce Not Available</h2>
          <p style={{ maxWidth: 500, margin: '0 auto 20px', color: '#cbd5e1' }}>
            {error || 'The requested produce item could not be found in the Al Aweer wholesale catalog.'}
          </p>
          <Link
            href="/products"
            style={{
              display: 'inline-block',
              marginTop: 16,
              background: '#22c55e',
              color: '#052e16',
              padding: '10px 24px',
              borderRadius: 9999,
              fontWeight: 800,
              textDecoration: 'none'
            }}
          >
            &larr; Return to Produce Catalog
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: 80,
            right: 24,
            backgroundColor: '#15803d',
            color: '#ffffff',
            padding: '12px 20px',
            borderRadius: 12,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            zIndex: 2000,
            fontWeight: 700,
            fontSize: '0.88rem',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            animation: 'fadeIn 0.2s ease'
          }}
        >
          <span>✓</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className={styles.breadcrumbs}>
        <Link href="/" className={styles.breadcrumbLink}>
          Home
        </Link>
        <span className={styles.breadcrumbSep}>/</span>
        <Link href="/products" className={styles.breadcrumbLink}>
          Produce
        </Link>
        <span className={styles.breadcrumbSep}>/</span>
        <span className={styles.breadcrumbCurrent}>{product.name}</span>
      </nav>

      {/* Main Details Grid */}
      <div className={styles.mainGrid}>
        {/* Left: Product Image & Trust Points */}
        <div className={styles.imageCol}>
          <div className={styles.imageWrap}>
            <img src={product.image} alt={product.name} className={styles.productImg} />
          </div>
          <div className={styles.trustPoints}>
            <div className={styles.trustPoint}>
              <span>🛡️</span>
              <span>100% Verified Al Aweer Market Stalls</span>
            </div>
            <div className={styles.trustPoint}>
              <span>🚚</span>
              <span>Same-Day Scheduled Commercial Delivery</span>
            </div>
            <div className={styles.trustPoint}>
              <span>⚖️</span>
              <span>Price per KG Standardized Across All Stalls</span>
            </div>
          </div>
        </div>

        {/* Right: Info & Pricing */}
        <div className={styles.infoCol}>
          <div className={styles.badgeRow}>
            <span className={styles.categoryTag}>{product.category}</span>
            <span className={styles.originTag}>Origin: {product.originCountry}</span>
            <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: '#86efac' }}>
              ID: {product.id}
            </span>
          </div>

          <h1 className={styles.productTitle}>{product.name}</h1>

          <div className={styles.ratingRow}>
            <span className={styles.star}>★</span>
            <span style={{ color: '#ffffff', fontWeight: 700 }}>4.9</span>
            <span>•</span>
            <span>Dubai Fruits & Vegetables Market</span>
          </div>

          <div className={styles.priceBanner}>
            <div>
              <div className={styles.priceLabel}>Best Available Wholesale Price</div>
              <div className={styles.priceVal}>
                Dhs {offers[0] ? offers[0].priceAed.toFixed(2) : product.lowestPriceAedPerKg.toFixed(2)}
                <span style={{ fontSize: '1rem', color: '#94a3b8', fontWeight: 500 }}>
                  {' '}
                  / {offers[0] ? offers[0].unit : 'unit'}
                </span>
              </div>
            </div>
            <span
              style={{
                background: 'rgba(34,197,94,0.15)',
                color: '#4ade80',
                padding: '6px 14px',
                borderRadius: 9999,
                fontWeight: 800,
                fontSize: '0.8rem'
              }}
            >
              ⚡ Lowest Price Guaranteed
            </span>
          </div>

          <p className={styles.productDesc}>
            {product.description || `Fresh, commercial-grade ${product.name.toLowerCase()} sourced directly from verified wholesale vendors in Al Aweer.`}
          </p>

          {/* Multi-Stall Comparison Offers Table */}
          <div className={styles.offersSection}>
            <h2 className={styles.offersHeading}>
              <span>🏢</span> Available Stall Offers & Multi-Vendor Pricing
            </h2>
            <table className={styles.offersTable}>
              <thead>
                <tr>
                  <th>Vendor Stall</th>
                  <th>Wholesale Packaging</th>
                  <th>Price / Unit</th>
                  <th>Equivalent / KG</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {offers.map((offer, idx) => (
                  <tr key={offer.vendorId}>
                    <td>
                      <div className={styles.stallName}>
                        <Link href={`/shops/${offer.vendorId}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                          {offer.shopName}
                        </Link>
                      </div>
                      <div className={styles.stallLoc}>{offer.stallNumber || 'Al Aweer Central Market'}</div>
                    </td>
                    <td>
                      {offer.unitWeightKg}kg {offer.unit}
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                        MOQ: {offer.minOrderQuantity} {offer.unit}
                      </div>
                    </td>
                    <td style={{ fontWeight: 700, color: '#ffffff' }}>
                      Dhs {offer.priceAed.toFixed(2)} / {offer.unit}
                    </td>
                    <td>
                      <span
                        style={{
                          fontWeight: 800,
                          color: idx === 0 ? '#4ade80' : '#cbd5e1'
                        }}
                      >
                        Dhs {offer.equivalentPricePerKg.toFixed(2)}/kg
                      </span>
                      {idx === 0 && (
                        <span
                          style={{
                            display: 'block',
                            fontSize: '0.65rem',
                            color: '#4ade80',
                            fontWeight: 800
                          }}
                        >
                          CHEAPEST
                        </span>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => handleAddOffer(offer)}
                        className={styles.tableAddBtn}
                        id={`add-offer-${offer.vendorId}`}
                        disabled={offer.availableStock <= 0}
                      >
                        {offer.availableStock > 0 ? 'Add to Cart 🛒' : 'Out of Stock'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Single-Vendor Cart Conflict Modal */}
      {conflict && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3000,
            padding: 16
          }}
        >
          <div
            style={{
              background: '#0c1f14',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              borderRadius: 20,
              padding: 24,
              maxWidth: 440,
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)'
            }}
          >
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
              Switch Wholesale Stall?
            </h3>
            <p style={{ fontSize: '0.88rem', color: '#cbd5e1', lineHeight: 1.5, margin: 0 }}>
              Your cart currently contains produce from <strong>{conflict.existingShopName}</strong>.
              Wholesale orders in Dubai Al Aweer market must be fulfilled by a single stall.
              <br /><br />
              Would you like to replace your cart with items from <strong>{conflict.newShopName}</strong>?
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
              <button
                type="button"
                onClick={() => resolveConflict(false)}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#cbd5e1',
                  borderRadius: 10,
                  padding: '8px 16px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Keep Current Cart
              </button>
              <button
                type="button"
                onClick={() => {
                  resolveConflict(true);
                  setToastMessage(`Cart updated with items from ${conflict.newShopName}`);
                  setTimeout(() => setToastMessage(null), 2500);
                }}
                style={{
                  background: '#22c55e',
                  border: 'none',
                  color: '#052e16',
                  borderRadius: 10,
                  padding: '8px 16px',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                Replace Cart & Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
