import type { ThemeConfig } from 'antd';

/**
 * Ported verbatim from the production admin theme
 * (gegok12/resources/assets/js/antd/theme.js) so this SPA renders identically
 * to app.gurukull.in. Do not "improve" these values in isolation — they are
 * the shipped look, and drifting from them is what made the previous screens
 * read as unrelated to the real product.
 */
export const antdCustomTheme: ThemeConfig = {
  token: {
    colorPrimary: '#2563eb',
    colorInfo: '#2563eb',
    colorSuccess: '#16a34a',
    colorWarning: '#d97706',
    colorError: '#dc2626',
    colorBgLayout: '#f5f7fb',
    colorText: '#172033',
    colorTextSecondary: '#667085',
    borderRadius: 10,
    borderRadiusLG: 14,
    controlHeight: 40,
    fontFamily:
      'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  components: {
    Layout: { headerBg: '#ffffff', siderBg: '#ffffff' },
    Menu: { itemBorderRadius: 8, itemHeight: 44 },
    Card: { headerFontSize: 16 },
    Table: { headerBg: '#f8fafc' },
  },
};
