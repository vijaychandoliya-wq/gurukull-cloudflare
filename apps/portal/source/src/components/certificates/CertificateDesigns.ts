import React from 'react';

export type CertificateDesign = {
  id: string;
  name: string;
  category: 'academic' | 'achievement' | 'formal' | 'sports' | 'custom';
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  typography: {
    headingFont: string;
    bodyFont: string;
    headingSize: 'large' | 'medium' | 'small';
  };
  layout: {
    borderStyle: 'ornate' | 'minimal' | 'modern' | 'classic' | 'elegant';
    hasCornerFlourish: boolean;
    hasSeal: boolean;
    hasRibbon: boolean;
    headerAlignment: 'center' | 'left' | 'right';
  };
  decorative: {
    pattern: 'geometric' | 'floral' | 'none' | 'art_deco' | 'traditional';
    ornamentColor: string;
  };
};

export const CERTIFICATE_DESIGNS: readonly CertificateDesign[] = [
  {
    id: 'academic_blue',
    name: 'Academic Blue',
    category: 'academic',
    colors: {
      primary: '#1a365d',
      secondary: '#2c5282',
      accent: '#4299e1',
      background: '#ffffff',
      text: '#1a202c',
    },
    typography: {
      headingFont: 'Georgia, serif',
      bodyFont: 'Arial, sans-serif',
      headingSize: 'large',
    },
    layout: {
      borderStyle: 'classic',
      hasCornerFlourish: true,
      hasSeal: true,
      hasRibbon: false,
      headerAlignment: 'center',
    },
    decorative: {
      pattern: 'geometric',
      ornamentColor: '#4299e1',
    },
  },
  {
    id: 'achievement_gold',
    name: 'Achievement Gold',
    category: 'achievement',
    colors: {
      primary: '#744210',
      secondary: '#b7791f',
      accent: '#f6e05e',
      background: '#fffbeb',
      text: '#1a202c',
    },
    typography: {
      headingFont: 'Georgia, serif',
      bodyFont: 'Arial, sans-serif',
      headingSize: 'large',
    },
    layout: {
      borderStyle: 'ornate',
      hasCornerFlourish: true,
      hasSeal: true,
      hasRibbon: true,
      headerAlignment: 'center',
    },
    decorative: {
      pattern: 'geometric',
      ornamentColor: '#f6e05e',
    },
  },
  {
    id: 'elegant_purple',
    name: 'Elegant Purple',
    category: 'formal',
    colors: {
      primary: '#44337a',
      secondary: '#6b46c1',
      accent: '#9f7aea',
      background: '#faf5ff',
      text: '#1a202c',
    },
    typography: {
      headingFont: 'Georgia, serif',
      bodyFont: 'Arial, sans-serif',
      headingSize: 'medium',
    },
    layout: {
      borderStyle: 'elegant',
      hasCornerFlourish: false,
      hasSeal: true,
      hasRibbon: false,
      headerAlignment: 'center',
    },
    decorative: {
      pattern: 'floral',
      ornamentColor: '#9f7aea',
    },
  },
  {
    id: 'sports_green',
    name: 'Sports Green',
    category: 'sports',
    colors: {
      primary: '#22543d',
      secondary: '#276749',
      accent: '#48bb78',
      background: '#f0fff4',
      text: '#1a202c',
    },
    typography: {
      headingFont: 'Arial, sans-serif',
      bodyFont: 'Arial, sans-serif',
      headingSize: 'medium',
    },
    layout: {
      borderStyle: 'modern',
      hasCornerFlourish: false,
      hasSeal: true,
      hasRibbon: true,
      headerAlignment: 'center',
    },
    decorative: {
      pattern: 'geometric',
      ornamentColor: '#48bb78',
    },
  },
  {
    id: 'modern_teal',
    name: 'Modern Teal',
    category: 'academic',
    colors: {
      primary: '#234e52',
      secondary: '#285e61',
      accent: '#38b2ac',
      background: '#e6fffa',
      text: '#1a202c',
    },
    typography: {
      headingFont: 'Arial, sans-serif',
      bodyFont: 'Arial, sans-serif',
      headingSize: 'medium',
    },
    layout: {
      borderStyle: 'modern',
      hasCornerFlourish: false,
      hasSeal: false,
      hasRibbon: false,
      headerAlignment: 'left',
    },
    decorative: {
      pattern: 'none',
      ornamentColor: '#38b2ac',
    },
  },
  {
    id: 'formal_maroon',
    name: 'Formal Maroon',
    category: 'formal',
    colors: {
      primary: '#742a2a',
      secondary: '#9b2c2c',
      accent: '#fc8181',
      background: '#fff5f5',
      text: '#1a202c',
    },
    typography: {
      headingFont: 'Georgia, serif',
      bodyFont: 'Arial, sans-serif',
      headingSize: 'large',
    },
    layout: {
      borderStyle: 'classic',
      hasCornerFlourish: true,
      hasSeal: true,
      hasRibbon: false,
      headerAlignment: 'center',
    },
    decorative: {
      pattern: 'traditional',
      ornamentColor: '#fc8181',
    },
  },
  {
    id: 'minimal_black',
    name: 'Minimal Black',
    category: 'custom',
    colors: {
      primary: '#000000',
      secondary: '#4a5568',
      accent: '#718096',
      background: '#ffffff',
      text: '#000000',
    },
    typography: {
      headingFont: 'Arial, sans-serif',
      bodyFont: 'Arial, sans-serif',
      headingSize: 'small',
    },
    layout: {
      borderStyle: 'minimal',
      hasCornerFlourish: false,
      hasSeal: false,
      hasRibbon: false,
      headerAlignment: 'left',
    },
    decorative: {
      pattern: 'none',
      ornamentColor: '#000000',
    },
  },
  {
    id: 'traditional_red',
    name: 'Traditional Red',
    category: 'academic',
    colors: {
      primary: '#9b2c2c',
      secondary: '#c53030',
      accent: '#f56565',
      background: '#fffaf0',
      text: '#1a202c',
    },
    typography: {
      headingFont: 'Georgia, serif',
      bodyFont: 'Arial, sans-serif',
      headingSize: 'large',
    },
    layout: {
      borderStyle: 'ornate',
      hasCornerFlourish: true,
      hasSeal: true,
      hasRibbon: false,
      headerAlignment: 'center',
    },
    decorative: {
      pattern: 'traditional',
      ornamentColor: '#f56565',
    },
  },
  {
    id: 'sports_blue',
    name: 'Sports Blue',
    category: 'sports',
    colors: {
      primary: '#2a4365',
      secondary: '#2b6cb0',
      accent: '#63b3ed',
      background: '#ebf8ff',
      text: '#1a202c',
    },
    typography: {
      headingFont: 'Arial, sans-serif',
      bodyFont: 'Arial, sans-serif',
      headingSize: 'medium',
    },
    layout: {
      borderStyle: 'modern',
      hasCornerFlourish: false,
      hasSeal: true,
      hasRibbon: true,
      headerAlignment: 'center',
    },
    decorative: {
      pattern: 'geometric',
      ornamentColor: '#63b3ed',
    },
  },
  {
    id: 'achievement_bronze',
    name: 'Achievement Bronze',
    category: 'achievement',
    colors: {
      primary: '#7b341e',
      secondary: '#c05621',
      accent: '#ed8936',
      background: '#fffaf0',
      text: '#1a202c',
    },
    typography: {
      headingFont: 'Georgia, serif',
      bodyFont: 'Arial, sans-serif',
      headingSize: 'medium',
    },
    layout: {
      borderStyle: 'ornate',
      hasCornerFlourish: true,
      hasSeal: true,
      hasRibbon: true,
      headerAlignment: 'center',
    },
    decorative: {
      pattern: 'geometric',
      ornamentColor: '#ed8936',
    },
  },
] as const;

export type CertificateDesignType = typeof CERTIFICATE_DESIGNS[number];

export function certificateDesign(id: string | null): CertificateDesignType {
  return CERTIFICATE_DESIGNS.find((d) => d.id === id) || CERTIFICATE_DESIGNS[0];
}

const BORDER_WIDTHS: Record<string, string> = {
  ornate: '12px',
  elegant: '8px',
  classic: '6px',
  modern: '3px',
  minimal: '1px',
};

export function getCertificateBorder(design: CertificateDesign): React.CSSProperties {
  const base: React.CSSProperties = {
    border: `${BORDER_WIDTHS[design.layout.borderStyle]} solid ${design.colors.primary}`,
    boxShadow: design.layout.borderStyle === 'modern' ? `inset 0 0 0 8px ${design.colors.background}` : undefined,
  };
  return base;
}

export function getCertificateTypography(design: CertificateDesign): React.CSSProperties {
  const sizes: Record<string, React.CSSProperties> = {
    large: { '--heading': '32px', '--subheading': '22px', '--body': '15px' } as any,
    medium: { '--heading': '26px', '--subheading': '19px', '--body': '14px' } as any,
    small: { '--heading': '22px', '--subheading': '16px', '--body': '13px' } as any,
  };
  return sizes[design.typography.headingSize];
}
