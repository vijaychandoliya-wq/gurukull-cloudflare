import { theme } from 'antd';
import type { ThemeConfig } from 'antd';
import type { ResolvedTheme } from './themePreference';

/**
 * Ported verbatim from the production admin theme
 * (gegok12/resources/assets/js/antd/theme.js) so this SPA renders identically
 * to app.gurukull.in. Do not "improve" these values in isolation — they are
 * the shipped look, and drifting from them is what made the previous screens
 * read as unrelated to the real product.
 */
export const antdCustomTheme = (mode: ResolvedTheme): ThemeConfig => ({
  token: {
    colorPrimary: '#2563eb',
    colorInfo: '#2563eb',
    colorSuccess: '#16a34a',
    colorWarning: '#d97706',
    colorError: '#dc2626',
    colorBgLayout: mode === 'dark' ? '#000000' : '#f5f7fb',
    colorBgContainer: mode === 'dark' ? '#0a0a0a' : '#ffffff',
    colorBgElevated: mode === 'dark' ? '#111111' : '#ffffff',
    colorText: mode === 'dark' ? '#ededed' : '#172033',
    colorTextSecondary: mode === 'dark' ? '#a3a3a3' : '#667085',
    colorTextTertiary: mode === 'dark' ? '#929292' : '#98a2b3',
    colorBorder: mode === 'dark' ? '#2e2e2e' : '#d0d5dd',
    colorBorderSecondary: mode === 'dark' ? '#242424' : '#eaecf0',
    borderRadius: 10,
    borderRadiusLG: 14,
    controlHeight: 40,
    fontFamily:
      'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  components: {
    Layout: { headerBg: mode === 'dark' ? '#0a0a0a' : '#ffffff', siderBg: mode === 'dark' ? '#0a0a0a' : '#ffffff' },
    Menu: {
      itemBorderRadius: 8,
      itemHeight: 44,
      itemBg: 'transparent',
      itemColor: mode === 'dark' ? '#a3a3a3' : '#344054',
      itemHoverBg: mode === 'dark' ? '#1f1f1f' : '#f5f7fb',
      itemSelectedBg: mode === 'dark' ? '#252525' : '#eaf2ff',
      itemSelectedColor: mode === 'dark' ? '#ededed' : '#1d4ed8',
      groupTitleColor: mode === 'dark' ? '#737373' : '#667085',
    },
    Card: { headerFontSize: 16 },
    Table: { headerBg: mode === 'dark' ? '#111111' : '#f8fafc', rowHoverBg: mode === 'dark' ? '#171717' : '#f8fafc' },
    Modal: { contentBg: mode === 'dark' ? '#111111' : '#ffffff', headerBg: mode === 'dark' ? '#111111' : '#ffffff' },
    Drawer: { colorBgElevated: mode === 'dark' ? '#111111' : '#ffffff' },
    Dropdown: { colorBgElevated: mode === 'dark' ? '#111111' : '#ffffff' },
  },
  algorithm: mode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
});
