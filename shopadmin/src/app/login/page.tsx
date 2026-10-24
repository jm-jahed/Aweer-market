'use client';

import React, { useState, useEffect, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useShopAdminAuth, useAuth } from '../../lib/auth-context';
import styles from './Login.module.css';

export default function LoginPage() {
  const router = useRouter();
  const { user, login, isLoading: authLoading } = useShopAdminAuth();

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
      setLocalError('Please enter both vendor email and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(trimmedEmail, password);
      router.replace('/');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid vendor credentials or unprivileged account.';
      setLocalError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <span className={styles.badge}>Shop Admin Portal</span>
          <h1 className={styles.title}>Al Aweer Stall Login</h1>
          <p className={styles.subtitle}>
            Sign in to manage your wholesale produce stall, catalog, and orders (Port 3001)
          </p>
        </div>

        {localError && (
          <div className={styles.errorBanner} role="alert">
            {localError}
          </div>
        )}

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.fieldGroup}>
            <label htmlFor="vendor-email" className={styles.label}>
              Vendor Email Address
            </label>
            <input
              id="vendor-email"
              type="email"
              className={styles.input}
              placeholder="stall.owner@al-aweer.ae"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting || authLoading}
              required
              autoFocus
            />
          </div>

          <div className={styles.fieldGroup}>
            <label htmlFor="vendor-password" className={styles.label}>
              Password
            </label>
            <input
              id="vendor-password"
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
            {isSubmitting ? 'Signing In...' : 'Sign In to Stall Admin'}
          </button>
        </form>

        <div className={styles.footerAction}>
          Are you a new Al Aweer wholesale vendor?
          <Link href="/register" className={styles.link}>
            Register your stall
          </Link>
        </div>
      </div>
    </div>
  );
}
