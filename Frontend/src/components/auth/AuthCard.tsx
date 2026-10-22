import React, { ReactNode } from 'react';
import Link from 'next/link';
import styles from './AuthForm.module.css';

export interface AuthCardProps {
  title: string;
  subtitle: string;
  badge?: string;
  children: ReactNode;
  footerText: string;
  footerLinkText: string;
  footerLinkHref: string;
  homeLinkText?: string;
}

export function AuthCard({
  title,
  subtitle,
  badge = 'Buyer Portal',
  children,
  footerText,
  footerLinkText,
  footerLinkHref,
  homeLinkText = '← Back to Marketplace'
}: AuthCardProps) {
  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <span className={styles.brandBadge}>{badge}</span>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.subtitle}>{subtitle}</p>
        </div>

        {children}

        <div className={styles.footer}>
          <span>{footerText}</span>
          <Link href={footerLinkHref} className={styles.footerLink}>
            {footerLinkText}
          </Link>
          <Link href="/" className={styles.homeLink}>
            {homeLinkText}
          </Link>
        </div>
      </div>
    </div>
  );
}
