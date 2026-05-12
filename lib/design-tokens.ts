// Design system extrait du site vitrine ampconseil.com
// Toutes les valeurs de design doivent provenir uniquement de ce fichier.

export const colors = {
  // Bleu ardoise — couleur primaire
  blue: '#6381a8',
  blueDark: '#4a6185',
  blueDeep: '#2d4462',
  bluePale: '#edf1f7',
  blueLight: '#c9d5e5',

  // Or — accent principal
  gold: '#b69957',
  goldLight: '#cdb47a',
  goldPale: '#f7f2e8',

  // Neutres
  white: '#ffffff',
  offWhite: '#f8f7f5',
  border: '#e2ddd6',

  // Textes
  text: '#2a3645',
  textMid: '#5a6a7e',
  textLight: '#8a9aac',

  // Statuts CRM (dans l'esprit de la palette — sobres, pas criards)
  success: '#3d6b4f',
  successBg: '#edf5f0',
  successBorder: '#b8d8c4',
  warning: '#8a6d2a',
  warningBg: '#f7f2e8',
  warningBorder: '#d4b96c',
  danger: '#7a3636',
  dangerBg: '#f5eded',
  dangerBorder: '#d4a0a0',
  info: '#6381a8',
  infoBg: '#edf1f7',
  infoBorder: '#c9d5e5',
} as const

export const fonts = {
  body: "'DM Sans', sans-serif",
  heading: "'Cormorant Garamond', serif",
} as const

export const fontWeights = {
  light: 300,
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const

export const fontSizes = {
  xs: '0.62rem',
  sm: '0.72rem',
  base: '0.84rem',
  md: '0.9rem',
  lg: '1.05rem',
  xl: '1.25rem',
  '2xl': '1.5rem',
  '3xl': 'clamp(1.8rem, 2.5vw, 2.4rem)',
  '4xl': 'clamp(2rem, 3vw, 3rem)',
} as const

export const letterSpacings = {
  tight: '-0.01em',
  normal: '0',
  wide: '0.06em',
  wider: '0.12em',
  widest: '0.2em',
  label: '0.14em',
  nav: '0.18em',
} as const

export const lineHeights = {
  tight: 1.2,
  base: 1.5,
  relaxed: 1.8,
  loose: 2,
} as const

export const spacing = {
  0: '0',
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  7: '28px',
  8: '32px',
  9: '36px',
  10: '40px',
  12: '48px',
  13: '52px',
  14: '56px',
  16: '64px',
  18: '72px',
  20: '80px',
  22: '88px',
} as const

export const radii = {
  none: '0',
  sm: '2px',
  md: '4px',
  lg: '8px',
  full: '9999px',
} as const

export const shadows = {
  sm: '0 2px 20px rgba(99,129,168,0.08)',
  md: '0 4px 32px rgba(45,68,98,0.13)',
  lg: '0 8px 28px rgba(45,68,98,0.14)',
  xl: '0 12px 36px rgba(99,129,168,0.15)',
  card: '0 10px 36px rgba(99,129,168,0.13)',
  nav: '0 2px 20px rgba(99,129,168,0.08)',
} as const

export const transitions = {
  fast: '0.2s cubic-bezier(0.4, 0, 0.2, 1)',
  base: '0.22s cubic-bezier(0.4, 0, 0.2, 1)',
  card: '0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  slow: '0.4s cubic-bezier(0.4, 0, 0.2, 1)',
} as const

export const breakpoints = {
  sm: '480px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
} as const

// Constantes de layout CRM
export const layout = {
  sidebarWidth: '240px',
  sidebarCollapsedWidth: '64px',
  topbarHeight: '60px',
  contentPadding: '32px',
  maxContentWidth: '1400px',
  cardGap: '20px',
} as const

// ---------------------------------------------------------------------------
// Objets de style réutilisables (inline styles)
// ---------------------------------------------------------------------------

export const buttonBase: React.CSSProperties = {
  fontFamily: fonts.body,
  fontSize: fontSizes.sm,
  fontWeight: fontWeights.medium,
  letterSpacing: letterSpacings.widest,
  textTransform: 'uppercase',
  border: 'none',
  cursor: 'pointer',
  transition: transitions.base,
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: spacing[2],
  padding: `10px 24px`,
  borderRadius: radii.none,
}

export const buttonPrimary: React.CSSProperties = {
  ...buttonBase,
  backgroundColor: colors.blue,
  color: colors.white,
}

export const buttonGold: React.CSSProperties = {
  ...buttonBase,
  backgroundColor: colors.gold,
  color: colors.white,
}

export const buttonOutline: React.CSSProperties = {
  ...buttonBase,
  backgroundColor: 'transparent',
  color: colors.blueDeep,
  border: `1.5px solid ${colors.blueLight}`,
}

export const buttonDanger: React.CSSProperties = {
  ...buttonBase,
  backgroundColor: colors.danger,
  color: colors.white,
}

export const buttonGhost: React.CSSProperties = {
  ...buttonBase,
  backgroundColor: 'transparent',
  color: colors.textMid,
  border: `1px solid ${colors.border}`,
}

export const cardBase: React.CSSProperties = {
  backgroundColor: colors.white,
  border: `1px solid ${colors.border}`,
}

export const inputBase: React.CSSProperties = {
  fontFamily: fonts.body,
  fontSize: fontSizes.base,
  color: colors.text,
  backgroundColor: colors.white,
  border: `1px solid ${colors.border}`,
  padding: `${spacing[2]} ${spacing[3]}`,
  outline: 'none',
  width: '100%',
  transition: transitions.fast,
  borderRadius: radii.none,
}

export const labelBase: React.CSSProperties = {
  fontFamily: fonts.body,
  fontSize: fontSizes.xs,
  fontWeight: fontWeights.bold,
  letterSpacing: letterSpacings.label,
  textTransform: 'uppercase',
  color: colors.textMid,
  display: 'block',
  marginBottom: spacing[1],
}

export const tableHeaderCell: React.CSSProperties = {
  fontFamily: fonts.body,
  fontSize: fontSizes.xs,
  fontWeight: fontWeights.bold,
  letterSpacing: letterSpacings.wider,
  textTransform: 'uppercase',
  color: colors.blueDeep,
  backgroundColor: colors.bluePale,
  padding: `${spacing[3]} ${spacing[4]}`,
  textAlign: 'left',
  borderBottom: `2px solid ${colors.blueLight}`,
  whiteSpace: 'nowrap',
}

export const tableCell: React.CSSProperties = {
  fontFamily: fonts.body,
  fontSize: fontSizes.base,
  color: colors.text,
  padding: `${spacing[3]} ${spacing[4]}`,
  borderBottom: `1px solid ${colors.border}`,
  verticalAlign: 'middle',
}

export const badgeBase: React.CSSProperties = {
  fontFamily: fonts.body,
  fontSize: '0.62rem',
  fontWeight: fontWeights.bold,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  padding: '3px 10px',
  borderRadius: radii.full,
  display: 'inline-block',
  lineHeight: 1.4,
}

export const sectionLabel: React.CSSProperties = {
  fontFamily: fonts.body,
  fontSize: fontSizes.xs,
  fontWeight: fontWeights.bold,
  letterSpacing: letterSpacings.widest,
  textTransform: 'uppercase',
  color: colors.gold,
  display: 'flex',
  alignItems: 'center',
  gap: spacing[3],
}

// Badges de statut prêts à l'emploi
export const statusBadge = {
  success: { ...badgeBase, backgroundColor: colors.successBg, color: colors.success, border: `1px solid ${colors.successBorder}` },
  warning: { ...badgeBase, backgroundColor: colors.warningBg, color: colors.warning, border: `1px solid ${colors.warningBorder}` },
  danger:  { ...badgeBase, backgroundColor: colors.dangerBg,  color: colors.danger,  border: `1px solid ${colors.dangerBorder}` },
  info:    { ...badgeBase, backgroundColor: colors.infoBg,    color: colors.info,    border: `1px solid ${colors.infoBorder}` },
  neutral: { ...badgeBase, backgroundColor: colors.offWhite,  color: colors.textMid, border: `1px solid ${colors.border}` },
} as const

// Sidebar
export const sidebar = {
  container: {
    backgroundColor: colors.blueDeep,
    width: layout.sidebarWidth,
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
  } as React.CSSProperties,
  link: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    letterSpacing: letterSpacings.wide,
    color: 'rgba(255,255,255,0.45)',
    textDecoration: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: spacing[3],
    padding: `${spacing[3]} ${spacing[5]}`,
    transition: transitions.fast,
    borderLeft: '3px solid transparent',
  } as React.CSSProperties,
  linkActive: {
    color: colors.white,
    backgroundColor: 'rgba(182,153,87,0.13)',
    borderLeftColor: colors.gold,
  } as React.CSSProperties,
  section: {
    fontFamily: fonts.body,
    fontSize: '0.6rem',
    fontWeight: fontWeights.bold,
    letterSpacing: letterSpacings.widest,
    textTransform: 'uppercase',
    color: colors.gold,
    padding: `${spacing[5]} ${spacing[5]} ${spacing[2]}`,
    opacity: 0.8,
  } as React.CSSProperties,
}
