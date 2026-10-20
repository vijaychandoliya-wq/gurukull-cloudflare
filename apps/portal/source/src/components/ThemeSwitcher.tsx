import React from 'react';
import { LaptopOutlined, MoonOutlined, SunOutlined } from '@ant-design/icons';
import { Segmented, Tooltip } from 'antd';
import { useTheme } from '../theme/ThemeProvider';
import type { ThemePreference } from '../theme/themePreference';

const options: Array<{ value: ThemePreference; label: React.ReactNode; title: string }> = [
  { value: 'light', label: <SunOutlined />, title: 'Light theme' },
  { value: 'dark', label: <MoonOutlined />, title: 'Dark theme' },
  { value: 'system', label: <LaptopOutlined />, title: 'Use system theme' },
];

export const ThemeSwitcher: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { preference, setPreference } = useTheme();
  return (
    <Tooltip title="Appearance">
      <Segmented
        className="gk-theme-switcher"
        size={compact ? 'small' : 'middle'}
        aria-label="Appearance"
        value={preference}
        options={options.map(({ value, label, title }) => ({ value, label, title }))}
        onChange={(value) => setPreference(value as ThemePreference)}
      />
    </Tooltip>
  );
};
