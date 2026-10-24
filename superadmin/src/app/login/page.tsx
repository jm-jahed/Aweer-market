'use client';

import React, { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useSuperAdminAuth } from '../../lib/auth-context';
import styles from './Login.module.css';

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const { user, login, isLoading: authLoading } = useSuperAdminAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setLocalError('Please enter both Super Admin email and master password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(trimmedEmail, password);
      router.replace('/');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid credentials or unprivileged account.';
      setLocalError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <span className={styles.badge}>Platform Super Admin</span>
          <h1 className={styles.title}>AweerMarket Central</h1>
          <p className={styles.subtitle}>
            Wholesale Fruit &amp; Vegetable Platform Governance Portal (Port 3002)
          </p>
        </div>

        {localError && (
          <div className={styles.errorBanner} role="alert">
            {localError}
          </div>
        )}

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.fieldGroup}>
            <label htmlFor="admin-email" className={styles.label}>
              Super Admin Email
            </label>
            <input
              id="admin-email"
              type="email"
              className={styles.input}
              placeholder="root@aweermarket.ae"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting || authLoading}
              required
              autoFocus
            />
          </div>

          <div className={styles.fieldGroup}>
            <label htmlFor="admin-password" className={styles.label}>
              Master Password
            </label>
            <input
              id="admin-password"
              type="password"
              className={styles.input}
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting || authLoading}
              required
            />
          </div>

          <button
            type="submit"
            className={styles.submitBtn}
            disabled={isSubmitting || authLoading}
          >
            {isSubmitting ? 'Authenticating...' : 'Sign In to Super Admin'}
          </button>
        </form>

        <div className={styles.footerNote}>
          Strict Access Control: Only users with the <code>super_admin</code> role can authenticate here.
          Buyer or vendor accounts will receive 403 Forbidden.
        </div>
      </div>
    </div>
  );
}
