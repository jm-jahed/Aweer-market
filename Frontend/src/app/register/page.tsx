'use client';

/**
 * AweerMarket Buyer Registration Page
 * Enforces client-side validation using shared RegisterBuyerSchema.
 * Strictly assigns UserRole.BUYER without any client role selector.
 */

import React, { useState, FormEvent, ChangeEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RegisterBuyerSchema } from '@aweermarket/validation';
import { registerBuyer, ApiClientError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { AuthCard } from '@/components/auth/AuthCard';
import styles from '@/components/auth/AuthForm.module.css';

interface FormState {
  fullName: string;
  email: string;
  password: string;
  phone: string;
  businessName: string;
  tradeLicenseNumber: string;
}

interface FormErrors {
  fullName?: string;
  email?: string;
  password?: string;
  phone?: string;
  businessName?: string;
  tradeLicenseNumber?: string;
}

const initialFormState: FormState = {
  fullName: '',
  email: '',
  password: '',
  phone: '',
  businessName: '',
  tradeLicenseNumber: ''
};

export default function RegisterPage() {
  const router = useRouter();
  const { setSessionUser } = useAuth();
  const [formData, setFormData] = useState<FormState>(initialFormState);
  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isConflict, setIsConflict] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear field-specific error as user types
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
    if (serverError) {
      setServerError(null);
      setIsConflict(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setIsConflict(false);

    // 1. Client-Side Validation against shared RegisterBuyerSchema
    const parseResult = RegisterBuyerSchema.safeParse({
      fullName: formData.fullName,
      email: formData.email,
      password: formData.password,
      phone: formData.phone,
      businessName: formData.businessName.trim() ? formData.businessName.trim() : undefined,
      tradeLicenseNumber: formData.tradeLicenseNumber.trim() ? formData.tradeLicenseNumber.trim() : undefined
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

    // 2. Submit to Backend API via typed client
    try {
      const res = await registerBuyer(parseResult.data);
      setSessionUser(res.user);
      setIsSuccess(true);
      // Redirect after brief delay
      setTimeout(() => {
        router.push('/');
      }, 1500);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.statusCode === 409) {
          setIsConflict(true);
          setServerError('An account with this email already exists. Please log in instead.');
        } else if (err.statusCode === 503) {
          setServerError('Service temporarily unavailable. Please try again later.');
        } else {
          setServerError(err.message || 'Registration failed. Please check your information.');
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
      title="Create Buyer Account"
      subtitle="Register to access wholesale produce pricing and single-vendor checkout across Al Aweer market."
      badge="Buyer Registration"
      footerText="Already have an account?"
      footerLinkText="Log in"
      footerLinkHref="/login"
    >
      <form onSubmit={handleSubmit} className={styles.form} noValidate>
        {serverError && (
          <div className={styles.bannerError} role="alert">
            <span>{serverError}</span>
            {isConflict && (
              <Link href="/login" style={{ color: '#b91c1c', fontWeight: 600, marginTop: 4 }}>
                → Go to Login Page
              </Link>
            )}
          </div>
        )}

        {isSuccess && (
          <div className={styles.bannerSuccess} role="status">
            Buyer registration successful! Redirecting to marketplace...
          </div>
        )}

        {/* Full Name */}
        <div className={styles.fieldGroup}>
          <label htmlFor="fullName" className={styles.label}>
            Full Name <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            required
            autoComplete="name"
            placeholder="e.g. Fatima Al Mansoori"
            value={formData.fullName}
            onChange={handleChange}
            className={`${styles.input} ${errors.fullName ? styles.inputError : ''}`}
            aria-invalid={Boolean(errors.fullName)}
            disabled={isSubmitting || isSuccess}
          />
          {errors.fullName && <span className={styles.fieldError}>{errors.fullName}</span>}
        </div>

        {/* Email Address */}
        <div className={styles.fieldGroup}>
          <label htmlFor="email" className={styles.label}>
            Email Address <span style={{ color: '#dc2626' }}>*</span>
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
            Password <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={formData.password}
            onChange={handleChange}
            className={`${styles.input} ${errors.password ? styles.inputError : ''}`}
            aria-invalid={Boolean(errors.password)}
            disabled={isSubmitting || isSuccess}
          />
          {errors.password && <span className={styles.fieldError}>{errors.password}</span>}
        </div>

        {/* Phone Number */}
        <div className={styles.fieldGroup}>
          <label htmlFor="phone" className={styles.label}>
            Phone Number <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            required
            autoComplete="tel"
            placeholder="+971 50 123 4567"
            value={formData.phone}
            onChange={handleChange}
            className={`${styles.input} ${errors.phone ? styles.inputError : ''}`}
            aria-invalid={Boolean(errors.phone)}
            disabled={isSubmitting || isSuccess}
          />
          {errors.phone && <span className={styles.fieldError}>{errors.phone}</span>}
        </div>

        {/* Business Name (Optional) */}
        <div className={styles.fieldGroup}>
          <label htmlFor="businessName" className={styles.label}>
            Business / Restaurant Name <span className={styles.optionalBadge}>(Optional)</span>
          </label>
          <input
            id="businessName"
            name="businessName"
            type="text"
            autoComplete="organization"
            placeholder="e.g. Fresh Oasis Restaurant LLC"
            value={formData.businessName}
            onChange={handleChange}
            className={`${styles.input} ${errors.businessName ? styles.inputError : ''}`}
            aria-invalid={Boolean(errors.businessName)}
            disabled={isSubmitting || isSuccess}
          />
          {errors.businessName && <span className={styles.fieldError}>{errors.businessName}</span>}
        </div>

        {/* Trade License Number (Optional) */}
        <div className={styles.fieldGroup}>
          <label htmlFor="tradeLicenseNumber" className={styles.label}>
            Trade License Number <span className={styles.optionalBadge}>(Optional)</span>
          </label>
          <input
            id="tradeLicenseNumber"
            name="tradeLicenseNumber"
            type="text"
            placeholder="e.g. CN-1234567"
            value={formData.tradeLicenseNumber}
            onChange={handleChange}
            className={`${styles.input} ${errors.tradeLicenseNumber ? styles.inputError : ''}`}
            aria-invalid={Boolean(errors.tradeLicenseNumber)}
            disabled={isSubmitting || isSuccess}
          />
          {errors.tradeLicenseNumber && <span className={styles.fieldError}>{errors.tradeLicenseNumber}</span>}
        </div>

        <button
          type="submit"
          className={styles.submitBtn}
          disabled={isSubmitting || isSuccess}
        >
          {isSubmitting ? 'Creating Account...' : 'Register as Buyer'}
        </button>
      </form>
    </AuthCard>
  );
}
