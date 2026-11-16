import React from 'react';
import type { CertificateDesignType } from './CertificateDesigns';

export function CornerFlourish({ color, size = 60 }: { color: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 60 60"
      fill="none"
    >
      <path
        d="M5 55 L5 25 Q5 5 25 5 L55 5"
        stroke={color}
        strokeWidth="2"
        fill="none"
        opacity="0.8"
      />
      <path
        d="M10 50 L10 30 Q10 10 30 10 L50 10"
        stroke={color}
        strokeWidth="1"
        fill="none"
        opacity="0.5"
      />
      <circle cx="8" cy="8" r="3" fill={color} opacity="0.6" />
      <path
        d="M15 5 L18 2 M5 15 L2 18"
        stroke={color}
        strokeWidth="1.5"
        opacity="0.7"
      />
    </svg>
  );
}

export function Seal({ color, size = 70 }: { color: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 70 70"
      style={{ display: 'block' }}
    >
      <circle cx="35" cy="35" r="32" fill="none" stroke={color} strokeWidth="2" opacity="0.6" />
      <circle cx="35" cy="35" r="26" fill="none" stroke={color} strokeWidth="1" opacity="0.4" />
      <text
        x="35"
        y="38"
        textAnchor="middle"
        fontSize="11"
        fontWeight="bold"
        fill={color}
        opacity="0.7"
        fontFamily="Georgia, serif"
      >
        CERTIFIED
      </text>
    </svg>
  );
}

export function Ribbon({ color, text }: { color: string; text: string }) {
  return (
    <div style={{
      position: 'absolute',
      top: '-12px',
      right: '40px',
      background: `linear-gradient(135deg, ${color} 0%, ${color}dd 100%)`,
      color: '#fff',
      padding: '4px 24px',
      fontSize: '11px',
      fontWeight: 'bold',
      letterSpacing: '2px',
      textTransform: 'uppercase',
      boxShadow: `0 2px 8px ${color}44`,
      clipPath: 'polygon(0 0, 100% 0, 95% 100%, 5% 100%)',
    }}>
      {text}
    </div>
  );
}

export function GeometricPattern({ color, opacity = 0.06 }: { color: string; opacity?: number }) {
  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        opacity,
      }}
    >
      <defs>
        <pattern id="geo" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
          <rect x="0" y="0" width="40" height="40" fill="none" />
          <rect x="0" y="0" width="20" height="20" fill={color} opacity="0.3" />
          <rect x="20" y="20" width="20" height="20" fill={color} opacity="0.3" />
          <circle cx="20" cy="20" r="2" fill={color} opacity="0.5" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#geo)" />
    </svg>
  );
}

export function FloralPattern({ color, opacity = 0.05 }: { color: string; opacity?: number }) {
  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        opacity,
      }}
    >
      <defs>
        <pattern id="floral" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
          <circle cx="30" cy="30" r="4" fill={color} />
          <circle cx="15" cy="15" r="2" fill={color} opacity="0.6" />
          <circle cx="45" cy="15" r="2" fill={color} opacity="0.6" />
          <circle cx="15" cy="45" r="2" fill={color} opacity="0.6" />
          <circle cx="45" cy="45" r="2" fill={color} opacity="0.6" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#floral)" />
    </svg>
  );
}

export function TraditionalPattern({ color, opacity = 0.04 }: { color: string; opacity?: number }) {
  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        opacity,
      }}
    >
      <defs>
        <pattern id="trad" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
          <rect x="0" y="0" width="80" height="80" fill="none" />
          <path d="M40 0 L80 40 L40 80 L0 40 Z" fill="none" stroke={color} strokeWidth="0.5" opacity="0.4" />
          <circle cx="40" cy="40" r="8" fill="none" stroke={color} strokeWidth="0.5" opacity="0.3" />
          <circle cx="40" cy="40" r="3" fill={color} opacity="0.2" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#trad)" />
    </svg>
  );
}

export function ArtDecoPattern({ color, opacity = 0.05 }: { color: string; opacity?: number }) {
  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        opacity,
      }}
    >
      <defs>
        <pattern id="deco" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
          <rect x="0" y="0" width="100" height="100" fill="none" />
          <path d="M0 50 L50 0 L100 50 L50 100 Z" fill="none" stroke={color} strokeWidth="0.5" opacity="0.3" />
          <path d="M25 50 L50 25 L75 50 L50 75 Z" fill="none" stroke={color} strokeWidth="0.5" opacity="0.2" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#deco)" />
    </svg>
  );
}

export function DecorativeElements({ design }: { design: CertificateDesignType }) {
  const { decorative, layout, colors } = design;
  const PatternComponent = {
    geometric: GeometricPattern,
    floral: FloralPattern,
    traditional: TraditionalPattern,
    art_deco: ArtDecoPattern,
    none: () => null,
  }[decorative.pattern];

  return (
    <>
      {PatternComponent && <PatternComponent color={decorative.ornamentColor} />}
      {layout.hasCornerFlourish && (
        <>
          <CornerFlourish color={colors.accent} />
          <span style={{ display: 'inline-block', transform: 'rotate(180deg)', position: 'absolute', bottom: 0, right: 0, top: 'auto', left: 'auto' }}>
            <CornerFlourish color={colors.accent} />
          </span>
        </>
      )}
      {layout.hasSeal && <Seal color={colors.secondary} />}
      {layout.hasRibbon && <Ribbon color={colors.accent} text="Official" />}
    </>
  );
}
