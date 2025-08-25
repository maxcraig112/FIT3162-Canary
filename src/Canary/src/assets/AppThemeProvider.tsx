import React from 'react';
import type { ReactNode } from 'react';
import { ThemeProvider } from '@mui/material';
import { darkTheme } from './muiTheme';

interface AppThemeProviderProps {
  children: ReactNode;
}

const AppThemeProvider: React.FC<AppThemeProviderProps> = ({ children }) => <ThemeProvider theme={darkTheme}>{children}</ThemeProvider>;

export default AppThemeProvider;
