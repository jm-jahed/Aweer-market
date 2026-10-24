'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { getShopById, ShopPublicSummary, ShopStorefrontProduct } from '@/lib/api-client';
import styles from './Storefront.module.css';

export default function ShopStorefrontPage() {
  const params = useParams();
  const shopId = params?.id as string;

  const [shop, setShop] = useState<ShopPublicSummary | null>(null);
  const [products, setProducts] = useState<ShopStorefrontProduct[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shopId) return;

    async function loadStorefront() {
      setLoading(true);
      setError(null);
      try {
        const res = await getShopById(shopId);
        setShop(res.shop);
        setProducts(res.products || []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load shop storefront');
      } finally {
        setLoading(false);
      }
    }

    loadStorefront();
  }, [shopId]);

  if (loading) {
    return (
      <main className={styles.container}>
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
          <p>Loading stall storefront...</p>
        </div>
      </main>
    );
  }

  if (error || !shop) {
    return (
      <main className={styles.container}>
        <div className={styles.errorBox}>
          <h2>Stall Not Available</h2>
          <p>{error || 'This shop is either not verified or currently unavailable.'}</p>
          <Link href="/" className={styles.backBtn}>
            &larr; Return to Marketplace
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.container}>
      <div style={{ marginBottom: '20px' }}>
        <Link href="/" className={styles.backLink}>
          &larr; Back to Wholesale Catalog
        </Link>
      </div>

      {/* Stall Storefront Header */}
      <section className={styles.headerCard}>
        <div className={styles.headerMain}>
          <div>
            <span className={styles.stallBadge}>{shop.stallNumber || 'Stall TBA'}</span>
            <h1 className={styles.shopTitle}>{shop.name}</h1>
            <p className={styles.shopSub}>
              Licensed wholesale produce merchant at Dubai Al Aweer Central Fruits &amp; Vegetables Market.
            </p>
          </div>
          <div className={styles.verifiedBadge}>
            Verified Al Aweer Vendor
          </div>
        </div>

        <div className={styles.contactRow}>
          <div className={styles.contactItem}>
            <span className={styles.contactLabel}>Market Location</span>
            <span className={styles.contactValue}>Al Aweer Market, {shop.stallNumber}</span>
          </div>
          <div className={styles.contactItem}>
            <span className={styles.contactLabel}>Phone / WhatsApp</span>
            <span className={styles.contactValue}>{shop.phone}</span>
          </div>
          <div className={styles.contactItem}>
            <span className={styles.contactLabel}>Catalog Size</span>
            <span className={styles.contactValue}>{products.length} wholesale produce items</span>
          </div>
        </div>
      </section>

      {/* Products & Offers */}
      <section style={{ marginTop: '32px' }}>
        <div className={styles.sectionHeading}>
          <h2>Produce Available at this Stall</h2>
          <span style={{ fontSize: '0.9rem', color: '#64748b' }}>
            Showing {products.length} {products.length === 1 ? 'item' : 'items'}
          </span>
        </div>

        {products.length === 0 ? (
          <div className={styles.emptyBox}>
            <p>This stall currently has no active produce offers listed.</p>
          </div>
        ) : (
          <div className={styles.grid}>
            {products.map((item) => (
              <div key={item.id} className={styles.card} data-product-id={item.id}>
                <div className={styles.cardMeta}>
                  <span className={styles.catBadge}>{item.category.replace('_', ' ')}</span>
                  <span className={styles.originTag}>Origin: {item.originCountry}</span>
                </div>

                <h3 className={styles.prodName}>{item.name}</h3>
                <p className={styles.prodDesc}>
                  {item.description || 'Wholesale produce sourced directly from Al Aweer.'}
                </p>

                {item.offers.map((offer, idx) => (
                  <div key={idx} className={styles.offerCard}>
                    <div className={styles.offerHeader}>
                      <div>
                        <div className={styles.packagingText}>
                          {offer.unitWeightKg}kg {offer.unit}
                        </div>
                        <div className={styles.moqText}>Min Order: {offer.minOrderQuantity} {offer.unit}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div className={styles.offerPriceAed}>AED {offer.priceAed}</div>
                        <div className={styles.eqAedKg}>
                          {offer.equivalentPricePerKg.toFixed(2)} AED/kg
                        </div>
                      </div>
                    </div>

                    <div className={styles.stockFooter}>
                      <span className={offer.availableStock > 0 ? styles.inStock : styles.outOfStock}>
                        {offer.availableStock > 0
                          ? `${offer.availableStock} ${offer.unit}s in stock`
                          : 'Currently Out of Stock'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
