import React from 'react';
import type { CertificateDesignType } from './CertificateDesigns';
import {
  CornerFlourish,
  Seal,
  Ribbon,
  GeometricPattern,
  FloralPattern,
  TraditionalPattern,
  ArtDecoPattern,
} from './CertificateDecorations';

export function getPatternComponent(pattern: string) {
  const components: Record<string, React.FC<{ color: string; opacity?: number }>> = {
    geometric: GeometricPattern,
    floral: FloralPattern,
    traditional: TraditionalPattern,
    art_deco: ArtDecoPattern,
  };
  return components[pattern];
}

export function CertificateSheet({ record, design, logo }: { record: any; design: CertificateDesignType; logo?: string | null }) {
  const { colors, typography, layout, decorative } = design;
  const typoSizes = {
    large: { heading: '32px', subheading: '20px', body: '15px' },
    medium: { heading: '26px', subheading: '18px', body: '14px' },
    small: { heading: '22px', subheading: '16px', body: '13px' },
  }[typography.headingSize];
  const alignment = layout.headerAlignment === 'center' ? 'center' : layout.headerAlignment === 'right' ? 'right' : 'left';
  const Pattern = getPatternComponent(decorative.pattern);

  return (
    <article
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: '794px',
        minHeight: '1050px',
        margin: '0 auto',
        padding: '48px',
        background: colors.background,
        color: colors.text,
        fontFamily: typography.bodyFont,
        fontSize: typoSizes.body,
        lineHeight: 1.75,
        overflowWrap: 'anywhere',
        boxSizing: 'border-box',
        ...getCertificateBorder(design),
      }}
    >
      {Pattern && <Pattern color={decorative.ornamentColor} />}
      {layout.hasCornerFlourish && (
        <>
          <CornerFlourish color={colors.accent} />
          <span style={{ position: 'absolute', bottom: 0, right: 0, transform: 'rotate(180deg)' } as any}>
            <CornerFlourish color={colors.accent} />
          </span>
        </>
      )}
      {record.status === 'void' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              fontSize: '64px',
              fontWeight: 'bold',
              color: 'rgba(160,0,0,0.12)',
              transform: 'rotate(-25deg)',
              letterSpacing: '6px',
              border: '4px solid rgba(160,0,0,0.15)',
              padding: '16px 48px',
              borderRadius: '8px',
            }}
          >
            VOID
          </div>
        </div>
      )}
      <header
        style={{
          textAlign: alignment,
          borderBottom: `2px solid ${colors.primary}`,
          paddingBottom: '24px',
          marginBottom: '32px',
          position: 'relative',
          breakInside: 'avoid',
          display: 'flex',
          flexDirection: 'column',
          alignItems: alignment,
          gap: '12px',
        }}
      >
        {logo && (
          <img
            src={logo}
            alt=""
            style={{
              maxHeight: '64px',
              maxWidth: '180px',
              objectFit: 'contain',
              background: 'transparent',
            }}
          />
        )}
        <h1
          style={{
            fontSize: typoSizes.heading,
            fontWeight: 'bold',
            color: colors.primary,
            margin: 0,
            lineHeight: 1.3,
            letterSpacing: '0.5px',
          }}
        >
          {record.schoolName}
        </h1>
        {record.schoolAddress && (
          <p
            style={{
              margin: '0 0 12px',
              fontSize: typoSizes.body,
              color: colors.secondary,
              fontStyle: 'italic',
            }}
          >
            {record.schoolAddress}
          </p>
        )}
        <h2
          style={{
            fontSize: typoSizes.subheading,
            fontWeight: '600',
            color: colors.primary,
            margin: '16px 0 8px',
            letterSpacing: '0.3px',
          }}
        >
          {record.headerTitle}
        </h2>
        {record.subheader && (
          <p
            style={{
              margin: '4px 0 0',
              fontSize: typoSizes.body,
              color: colors.secondary,
            }}
          >
            {record.subheader}
          </p>
        )}
      </header>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '32px',
          padding: '12px 16px',
          background: `${colors.primary}08`,
          borderRadius: '4px',
          fontSize: '12px',
          breakInside: 'avoid',
        }}
      >
        <div>
          <strong>Certificate No:</strong> {record.certificateNo}
        </div>
        <div>
          <strong>Issue Date:</strong> {record.issueDate}
        </div>
      </div>
      <div
        style={{
          whiteSpace: 'pre-wrap',
          lineHeight: 1.9,
          fontSize: typoSizes.body,
          marginBottom: '48px',
        }}
      >
        {record.bodyContent}
      </div>
      {(record.footerLeft || record.footerRight) && (
        <footer
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '32px',
            marginTop: 'auto',
            paddingTop: '48px',
            borderTop: `1px solid ${colors.primary}`,
            breakInside: 'avoid',
          }}
        >
          {record.footerLeft && (
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div
                style={{
                  borderTop: `1px solid ${colors.text}`,
                  paddingTop: '8px',
                  marginTop: '32px',
                  fontSize: '12px',
                  color: colors.secondary,
                }}
              >
                {record.footerLeft}
              </div>
            </div>
          )}
          {record.footerRight && (
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div
                style={{
                  borderTop: `1px solid ${colors.text}`,
                  paddingTop: '8px',
                  marginTop: '32px',
                  fontSize: '12px',
                  color: colors.secondary,
                }}
              >
                {record.footerRight}
              </div>
            </div>
          )}
        </footer>
      )}
      {layout.hasSeal && (
        <div
          style={{
            position: 'absolute',
            bottom: '24px',
            right: '24px',
            opacity: 0.08,
          }}
        >
          <Seal color={colors.primary} size={90} />
        </div>
      )}
      {layout.hasRibbon && (
        <Ribbon color={colors.accent} text="Official Document" />
      )}
      {record.status === 'void' && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%) rotate(-25deg)',
            padding: '16px 48px',
            border: `3px solid rgba(160,0,0,0.2)`,
            color: 'rgba(160,0,0,0.15)',
            fontSize: '48px',
            fontWeight: 'bold',
            letterSpacing: '4px',
            zIndex: 5,
            pointerEvents: 'none',
          }}
        >
          VOID
        </div>
      )}
    </article>
  );
}

function getCertificateBorder(design: CertificateDesignType): React.CSSProperties {
  const base: React.CSSProperties = {};
  switch (design.layout.borderStyle) {
    case 'ornate':
      return {
        border: `12px double ${design.colors.primary}`,
        outline: `3px solid ${design.colors.accent}`,
        outlineOffset: '6px',
      };
    case 'elegant':
      return {
        border: `8px solid ${design.colors.primary}`,
        outline: `2px solid ${design.colors.accent}`,
        outlineOffset: '4px',
      };
    case 'classic':
      return {
        border: `6px double ${design.colors.primary}`,
      };
    case 'modern':
      return {
        border: `3px solid ${design.colors.primary}`,
        borderLeft: `12px solid ${design.colors.accent}`,
      };
    case 'minimal':
      return {
        border: `1px solid ${design.colors.primary}`,
      };
    default:
      return base;
  }
}
