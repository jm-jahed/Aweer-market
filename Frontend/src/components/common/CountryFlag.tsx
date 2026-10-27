'use client';

import React from 'react';
import { getCountryCode, getCountryFlag, cleanCountryName } from '@/lib/country-flags';

interface CountryFlagProps {
  country?: string;
  className?: string;
  style?: React.CSSProperties;
  width?: number;
  height?: number;
}

/**
 * Universal Country Flag component.
 * On Windows, Unicode flag emojis render as plain text 'PK', 'EG', 'IN' because Windows
 * lacks emoji flag glyphs. This component renders an official high-resolution flag image
 * from FlagCDN so that real national flags render identically on Windows, Mac, Android, and iOS.
 */
export function CountryFlag({
  country,
  className,
  style,
  width = 18,
  height = 13
}: CountryFlagProps) {
  const code = getCountryCode(country);

  if (code) {
    return (
      <img
        src={`https://flagcdn.com/w40/${code}.png`}
        srcSet={`https://flagcdn.com/w80/${code}.png 2x`}
        alt={country || 'Country Flag'}
        width={width}
        height={height}
        className={className}
        style={{
          display: 'inline-block',
          verticalAlign: '-1px',
          marginRight: '4px',
          borderRadius: '2px',
          objectFit: 'cover',
          boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
          border: '1px solid rgba(255,255,255,0.15)',
          flexShrink: 0,
          ...style
        }}
        loading="lazy"
      />
    );
  }

  const emoji = getCountryFlag(country);
  if (emoji) {
    return (
      <span className={className} style={{ marginRight: '4px', ...style }}>
        {emoji}
      </span>
    );
  }

  return null;
}

/**
 * Renders the colorful flag image alongside the clean country name.
 * e.g. [Flag Image] Pakistan
 */
export function CountryWithFlag({
  country,
  className,
  style
}: {
  country?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  if (!country) return null;
  const name = cleanCountryName(country);

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        verticalAlign: 'middle',
        gap: '2px',
        ...style
      }}
    >
      <CountryFlag country={country} />
      <span>{name}</span>
    </span>
  );
}

export default CountryWithFlag;
