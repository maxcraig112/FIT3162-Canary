import React, { useState } from 'react';
import { Box, Button, TextField, Typography, Paper, Divider } from '@mui/material';
import { handleLogin, handleRegister } from './authHandlers';
import AppThemeProvider from '../assets/AppThemeProvider';
import { CANARY_BUTTON_COLOR, CANARY_BUTTON_TEXT_COLOR } from '../assets/constants';
import { useNavigate } from 'react-router-dom';
import { useSkipLogin } from '../utils/authUtil';

interface LoginPageProps {
  onLoginSuccess?: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  useSkipLogin();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [result, setResult] = useState<string | null>(null);

  const handleLoginClick = async () => {
    setResult(null);
    try {
      await handleLogin(email, password, (msg: string) => {
        setResult(msg);
        if (msg && msg.toLowerCase().includes('login successful')) {
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

  const resultIsSuccess = result ? /success|press login/i.test(result) : false;

  return (
    <AppThemeProvider>
      <Box
        sx={{
          minHeight: '100vh',
          minWidth: '100vw',
          background: 'linear-gradient(135deg, #f5f7fa 0%, #ffffff 60%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'fixed',
          inset: 0,
          m: 0,
          p: 2,
          overflow: 'hidden',
        }}
      >
        {/* Header (logo + title + subtitle) */}
        <Box
          sx={{
            position: 'absolute',
            top: { xs: 16, md: 28 },
            left: 0,
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            pointerEvents: 'none',
            px: 2,
          }}
        >
          <Box
            component="img"
            src="/logo.png"
            alt="Canary Logo"
            sx={{
              width: { xs: 120, md: 150 },
              height: { xs: 120, md: 150 },
              objectFit: 'contain',
              mb: { xs: 1, md: 2 },
            }}
          />
          <Typography
            variant="h1"
            sx={{
              fontSize: { xs: '3.25rem', md: '4.25rem' },
              fontWeight: 800,
              letterSpacing: '-2px',
              lineHeight: 1.05,
              background: 'linear-gradient(90deg,#0f172a,#334155)',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
              textAlign: 'center',
              textShadow: '0 2px 6px rgba(0,0,0,0.15)',
              userSelect: 'none',
            }}
          >
            Canary
          </Typography>
          <Typography
            sx={{
              fontSize: { xs: '1.15rem', md: '1.6rem' },
              fontWeight: 500,
              color: '#374151',
              textAlign: 'center',
              letterSpacing: 0.5,
              mb: { xs: 1, md: 0 },
              userSelect: 'none',
            }}
          >
            Bird annotation simplified
          </Typography>
        </Box>
        <Paper
          elevation={10}
          sx={{
            p: { xs: 4, md: 6 },
            borderRadius: 5,
            minWidth: { xs: 340, sm: 420 },
            maxWidth: 520,
            width: '100%',
            bgcolor: '#ffffff',
            border: '1px solid #e5e8ec',
            boxShadow: '0 6px 14px rgba(0,0,0,0.10), 0 18px 42px -8px rgba(0,0,0,0.25), 0 28px 60px -12px rgba(0,0,0,0.30)',
            backdropFilter: 'blur(2px)',
          }}
        >
          <Divider sx={{ mb: 4, visibility: 'hidden' }} />
          <Typography variant="h5" align="center" gutterBottom sx={{ fontWeight: 600, mb: 3, color: '#111827' }}>
            Login
          </Typography>
          <Box component="form" noValidate autoComplete="off" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Email"
              variant="outlined"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
              placeholder="you@example.com"
              InputProps={{
                sx: {
                  borderRadius: 3,
                  bgcolor: '#ffffff',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#d1d5db' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#9ca3af' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: CANARY_BUTTON_COLOR },
                  '& input': { color: '#111827', fontWeight: 500 },
                  '& .MuiInputBase-input::placeholder': { color: '#111827', opacity: 0.55 },
                },
              }}
              InputLabelProps={{
                sx: {
                  color: '#111827',
                  '&.Mui-focused': { color: CANARY_BUTTON_COLOR },
                },
              }}
            />
            <TextField
              label="Password"
              variant="outlined"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
              placeholder="••••••••"
              InputProps={{
                sx: {
                  borderRadius: 3,
                  bgcolor: '#ffffff',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#d1d5db' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#9ca3af' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: CANARY_BUTTON_COLOR },
                  '& input': { color: '#111827', fontWeight: 500 },
                  '& .MuiInputBase-input::placeholder': { color: '#111827', opacity: 0.55 },
                },
              }}
              InputLabelProps={{
                sx: {
                  color: '#111827',
                  '&.Mui-focused': { color: CANARY_BUTTON_COLOR },
                },
              }}
            />
            {result && (
              <Typography
                sx={{
                  mt: 1,
                  color: resultIsSuccess ? '#047857' : '#b91c1c',
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-line',
                  maxWidth: '100%',
                  overflowWrap: 'break-word',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  textAlign: 'center',
                }}
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
                  py: 1.3,
                  backgroundColor: CANARY_BUTTON_COLOR,
                  color: CANARY_BUTTON_TEXT_COLOR,
                  textTransform: 'none',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                  '&:hover': {
                    backgroundColor: '#0097a7',
                    color: CANARY_BUTTON_TEXT_COLOR,
                    boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
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
                  py: 1.3,
                  backgroundColor: CANARY_BUTTON_COLOR,
                  color: CANARY_BUTTON_TEXT_COLOR,
                  textTransform: 'none',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                  '&:hover': {
                    backgroundColor: '#0097a7',
                    color: CANARY_BUTTON_TEXT_COLOR,
                    boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
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
