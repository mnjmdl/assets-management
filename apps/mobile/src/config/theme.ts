// WAP (Web App / PWA) Color Palette & Design Tokens
export const theme = {
  colors: {
    background: '#f8fafc', // slate-50
    card: '#ffffff', // pure white
    cardBorder: '#e2e8f0', // slate-200
    divider: '#f1f5f9', // slate-100

    textPrimary: '#0f172a', // slate-900
    textSecondary: '#475569', // slate-600
    textMuted: '#64748b', // slate-500
    textLight: '#94a3b8', // slate-400

    primary: '#2563eb', // blue-600
    primaryHover: '#1d4ed8', // blue-700
    primaryLight: '#eff6ff', // blue-50
    primaryBorder: '#bfdbfe', // blue-200

    success: '#059669', // emerald-600
    successLight: '#ecfdf5', // emerald-50
    successBorder: '#a7f3d0', // emerald-200

    warning: '#d97706', // amber-600
    warningLight: '#fffbeb', // amber-50
    warningBorder: '#fde68a', // amber-200

    danger: '#dc2626', // red-600
    dangerLight: '#fef2f2', // red-50
    dangerBorder: '#fecaca', // red-200

    purple: '#7c3aed',
    purpleLight: '#f5f3ff',
    purpleBorder: '#ddd6fe',
  },
  shadows: {
    sm: {
      shadowColor: '#0f172a',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    card: {
      shadowColor: '#0f172a',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 6,
      elevation: 2,
    },
  },
  borderRadius: {
    sm: 6,
    md: 10,
    lg: 14,
    xl: 18,
    full: 9999,
  },
};

