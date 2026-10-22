'use client';

/**
 * AweerMarket Buyer Login Page
 * Enforces client-side validation using shared LoginSchema.
 * Strictly scopes session to Buyer role via backend Set-Cookie.
 */

import React, { useState, FormEvent, ChangeEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LoginSchema } from '@aweermarket/validation';
import { loginBuyer, ApiClientError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { AuthCard } from '@/components/auth/AuthCard';
import styles from '@/components/auth/AuthForm.module.css';

interface FormState {
  email: string;
  password: string;
}

interface FormErrors {
  email?: string;
  password?: string;
}

const initialFormState: FormState = {
  email: '',
  password: ''
};

export default function LoginPage() {
  const router = useRouter();
  const { setSessionUser } = useAuth();
  const [formData, setFormData] = useState<FormState>(initialFormState);
  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
    if (serverError) {
      setServerError(null);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setServerError(null);

    // 1. Client-Side Validation against shared LoginSchema
    const parseResult = LoginSchema.safeParse({
      email: formData.email,
      password: formData.password
    });

    if (!parseResult.success) {
      const fieldErrors: FormErrors = {};
      for (const issue of parseResult.error.issues) {
        const fieldName = issue.path[0] as keyof FormErrors;
        if (fieldName && !fieldErrors[fieldName]) {
          fieldErrors[fieldName] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    // 2. Submit credentials to Backend API
    try {
      const res = await loginBuyer(parseResult.data);
      setSessionUser(res.user);
      setIsSuccess(true);
      // Redirect to home/marketplace
      setTimeout(() => {
        router.push('/');
      }, 1000);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.statusCode === 401) {
          // Generic safe error message to prevent account enumeration
          setServerError('Invalid email or password');
        } else if (err.statusCode === 403) {
          setServerError('Account has been deactivated. Please contact support.');
        } else if (err.statusCode === 503) {
          setServerError('Service temporarily unavailable. Please try again later.');
        } else {
          setServerError(err.message || 'Login failed. Please check your credentials.');
        }
      } else {
        setServerError('Unable to connect to the marketplace server. Please check your connection.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthCard
      title="Buyer Log In"
      subtitle="Sign in to your wholesale buyer account to place and track produce orders."
      badge="Buyer Portal"
      footerText="Don't have an account yet?"
      footerLinkText="Register here"
      footerLinkHref="/register"
    >
      <form onSubmit={handleSubmit} className={styles.form} noValidate>
        {serverError && (
          <div className={styles.bannerError} role="alert">
            <span>{serverError}</span>
          </div>
        )}

        {isSuccess && (
          <div className={styles.bannerSuccess} role="status">
            Login successful! Redirecting to marketplace...
          </div>
        )}

        {/* Email Address */}
        <div className={styles.fieldGroup}>
          <label htmlFor="email" className={styles.label}>
            Email Address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="buyer@aweermarket.ae"
            value={formData.email}
            onChange={handleChange}
            className={`${styles.input} ${errors.email ? styles.inputError : ''}`}
            aria-invalid={Boolean(errors.email)}
            disabled={isSubmitting || isSuccess}
          />
          {errors.email && <span className={styles.fieldError}>{errors.email}</span>}
        </div>

        {/* Password */}
        <div className={styles.fieldGroup}>
          <label htmlFor="password" className={styles.label}>
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="Enter your password"
            value={formData.password}
            onChange={handleChange}
            className={`${styles.input} ${errors.password ? styles.inputError : ''}`}
            aria-invalid={Boolean(errors.password)}
            disabled={isSubmitting || isSuccess}
          />
          {errors.password && <span className={styles.fieldError}>{errors.password}</span>}
        </div>

        <button
          type="submit"
          className={styles.submitBtn}
          disabled={isSubmitting || isSuccess}
        >
          {isSubmitting ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </AuthCard>
  );
}
