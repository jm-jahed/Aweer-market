'use client';

import React, { useState, useEffect, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import styles from './Register.module.css';

export default function VendorRegisterPage() {
  const router = useRouter();
  const { user, register, isLoading: authLoading } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [stallName, setStallName] = useState('');
  const [stallNumber, setStallNumber] = useState('');
  const [tradeLicenseNumber, setTradeLicenseNumber] = useState('');
  const [phone, setPhone] = useState('');

  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/');
    }
  }, [user, authLoading, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!fullName || !email || !password || !stallName || !stallNumber || !tradeLicenseNumber || !phone) {
      setLocalError('Please complete all required stall and vendor registration fields.');
      return;
    }

    setIsSubmitting(true);
    try {
      await register({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        stallName: stallName.trim(),
        stallNumber: stallNumber.trim(),
        tradeLicenseNumber: tradeLicenseNumber.trim(),
        phone: phone.trim()
      });
      router.replace('/');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed. Please check your details.';
      setLocalError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <span className={styles.badge}>Vendor Onboarding</span>
          <h1 className={styles.title}>Register Wholesale Stall</h1>
          <p className={styles.subtitle}>
            Join Dubai Al Aweer Central Fruits &amp; Vegetables Marketplace
          </p>
        </div>

        {localError && (
          <div className={styles.errorBanner} role="alert">
            {localError}
          </div>
        )}

        <div className={styles.infoBanner}>
          Notice: Newly registered stalls start in <strong>Pending Super Admin Approval</strong> status
          before wholesale produce listings become visible in the public marketplace.
        </div>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.fieldGroup}>
            <label htmlFor="reg-fullname" className={styles.label}>
              Primary Contact / Stall Manager Full Name *
            </label>
            <input
              id="reg-fullname"
              type="text"
              className={styles.input}
              placeholder="e.g. Tariq Al Hashemi"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={isSubmitting || authLoading}
              required
            />
          </div>

          <div className={styles.row}>
            <div className={styles.fieldGroup}>
              <label htmlFor="reg-email" className={styles.label}>
                Vendor Email Address *
              </label>
              <input
                id="reg-email"
                type="email"
                className={styles.input}
                placeholder="stall@al-aweer.ae"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting || authLoading}
                required
              />
            </div>

            <div className={styles.fieldGroup}>
              <label htmlFor="reg-password" className={styles.label}>
                Account Password *
              </label>
              <input
                id="reg-password"
                type="password"
                className={styles.input}
                placeholder="Min. 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting || authLoading}
                required
              />
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label htmlFor="reg-stallname" className={styles.label}>
              Wholesale Stall / Trade Name *
            </label>
            <input
              id="reg-stallname"
              type="text"
              className={styles.input}
              placeholder="e.g. Al Aweer Fresh Citrus Wholesale LLC"
              value={stallName}
              onChange={(e) => setStallName(e.target.value)}
              disabled={isSubmitting || authLoading}
              required
            />
          </div>

          <div className={styles.row}>
            <div className={styles.fieldGroup}>
              <label htmlFor="reg-stallnumber" className={styles.label}>
                Al Aweer Stall Number *
              </label>
              <input
                id="reg-stallnumber"
                type="text"
                className={styles.input}
                placeholder="e.g. ST-42, Block C"
                value={stallNumber}
                onChange={(e) => setStallNumber(e.target.value)}
                disabled={isSubmitting || authLoading}
                required
              />
            </div>

            <div className={styles.fieldGroup}>
              <label htmlFor="reg-phone" className={styles.label}>
                Contact Mobile / Phone *
              </label>
              <input
                id="reg-phone"
                type="tel"
                className={styles.input}
                placeholder="+971501234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={isSubmitting || authLoading}
                required
              />
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label htmlFor="reg-tradelicense" className={styles.label}>
              Dubai Trade License Number *
            </label>
            <input
              id="reg-tradelicense"
              type="text"
              className={styles.input}
              placeholder="e.g. TL-DXB-987654"
              value={tradeLicenseNumber}
              onChange={(e) => setTradeLicenseNumber(e.target.value)}
              disabled={isSubmitting || authLoading}
              required
            />
          </div>

          <button
            type="submit"
            className={styles.submitBtn}
            disabled={isSubmitting || authLoading}
          >
            {isSubmitting ? 'Registering Stall...' : 'Submit Vendor Registration'}
          </button>
        </form>

        <div className={styles.footerAction}>
          Already registered as an Al Aweer vendor?
          <Link href="/login" className={styles.link}>
            Sign In here
          </Link>
        </div>
      </div>
    </div>
  );
}
