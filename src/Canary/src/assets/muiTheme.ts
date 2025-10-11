import { createTheme } from '@mui/material/styles';

export const lightTheme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#ffffffff',
      paper: '#ffffffff',
    },
    primary: {
      main: '#ffdf01',
      contrastText: '#000',
    },
    secondary: {
      main: '#008080',
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
          '& svg': { color: '#000000' },
          '&.Mui-checked svg': {
            color: '#ffdf01',
          },
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true
      }
    },
  },
});
