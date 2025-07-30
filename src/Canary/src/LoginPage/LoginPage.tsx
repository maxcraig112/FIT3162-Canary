import React, { useState } from 'react';
import { Box, Button, TextField, Typography, Paper } from '@mui/material';
import { handleLogin, handleRegister } from './authHandlers';
import AppThemeProvider from '../assets/AppThemeProvider';
import { CANARY_BUTTON_COLOR, CANARY_BUTTON_TEXT_COLOR } from '../assets/constants';
import { useNavigate } from 'react-router-dom';

interface LoginPageProps {
  onLoginSuccess?: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleLoginClick = async () => {
    setResult(null);
    try {
      await handleLogin(email, password, (msg) => {
        setResult(msg);
        if (msg && msg.toLowerCase().includes('success')) {
          if (onLoginSuccess) onLoginSuccess();
          navigate('/home');
        }
      });
    } catch {
      setResult('Login failed');
    }
  };

  const handleRegisterClick = async () => {
    setResult(null);
    try {
      await handleRegister(email, password, setResult);
    } catch {
      setResult('Register failed');
    }
  };

  return (
    <AppThemeProvider>
      <Box sx={{
        minHeight: '100vh',
        minWidth: '100vw',
        bgcolor: 'background.default',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        m: 0,
        p: 0,
      }}>
        <Paper elevation={6} sx={{ p: 4, borderRadius: 4, minWidth: 350, bgcolor: 'background.paper' }}>
          <Typography variant="h4" align="center" gutterBottom>
            Login
          </Typography>
          <Box component="form" noValidate autoComplete="off" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Email"
              variant="outlined"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              fullWidth
              InputProps={{ sx: { borderRadius: 3 } }}
            />
            <TextField
              label="Password"
              variant="outlined"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              fullWidth
              InputProps={{ sx: { borderRadius: 3 } }}
            />
            {result && (
              <Typography
                sx={{
                  mt: 1,
                  color: '#fff',
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-line',
                  maxWidth: '100%',
                  overflowWrap: 'break-word',
                }}
                align="center"
              >
                {result}
              </Typography>
            )}
            <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
              <Button
                variant="contained"
                fullWidth
                sx={{
                  borderRadius: 3,
                  fontWeight: 600,
                  fontSize: '1rem',
                  letterSpacing: 1,
                  backgroundColor: CANARY_BUTTON_COLOR,
                  color: CANARY_BUTTON_TEXT_COLOR,
                  '&:hover': {
                    backgroundColor: '#0097a7',
                    color: CANARY_BUTTON_TEXT_COLOR,
                  },
                }}
                onClick={handleLoginClick}
              >
                Login
              </Button>
              <Button
                variant="contained"
                fullWidth
                sx={{
                  borderRadius: 3,
                  fontWeight: 600,
                  fontSize: '1rem',
                  letterSpacing: 1,
                  backgroundColor: CANARY_BUTTON_COLOR,
                  color: CANARY_BUTTON_TEXT_COLOR,
                  '&:hover': {
                    backgroundColor: '#0097a7',
                    color: CANARY_BUTTON_TEXT_COLOR,
                  },
                }}
                onClick={handleRegisterClick}
              >
                Register
              </Button>
            </Box>
          </Box>
        </Paper>
      </Box>
    </AppThemeProvider>
  );
};

export default LoginPage;
