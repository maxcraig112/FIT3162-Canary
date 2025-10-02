import { createTheme } from '@mui/material/styles';

export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#181A20',
      paper: '#23272F',
    },
    primary: {
      main: '#00bcd4',
      contrastText: '#fff',
    },
    secondary: {
      main: '#ff9800',
      contrastText: '#fff',
    },
  },
  shape: {
    borderRadius: 16,
  },
  components: {
    MuiCheckbox: {
      styleOverrides: {
        root: {
          opacity: 1,
          '& svg': {
            // unchecked icon color
            color: '#000000',
          },
          '&.Mui-checked svg': {
            color: '#00bcd4',
          },
        },
      },
    },
  },
});
