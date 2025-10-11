import React from 'react';
import type { ReactNode } from 'react';
import { ThemeProvider } from '@mui/material';
import { lightTheme } from './muiTheme';

interface AppThemeProviderProps {
  children: ReactNode;
}

const AppThemeProvider: React.FC<AppThemeProviderProps> = ({ children }) => <ThemeProvider theme={lightTheme}>{children}</ThemeProvider>;

export default AppThemeProvider;
