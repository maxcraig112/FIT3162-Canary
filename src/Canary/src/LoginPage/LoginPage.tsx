import React, { useState } from 'react';
import { Box, Button, TextField, Typography, IconButton, InputAdornment } from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { handleLogin, handleRegister } from './authHandlers';
import AppThemeProvider from '../assets/AppThemeProvider';
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
  const [showPassword, setShowPassword] = useState(false);
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
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          pt: { xs: 2, md: 3 },
          pb: 0,
          gap: { xs: 2.5, md: 2.5 },
        }}
      >
        {/* Header (logo + title + subtitle) */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            px: 2,
            textAlign: 'center',
            userSelect: 'none',
            gap: 0.5,
          }}
        >
          <Box
            component="img"
            src="/logo.png"
            alt="Canary Logo"
            sx={{
              width: { xs: 96, md: 112 },
              height: { xs: 96, md: 112 },
              objectFit: 'contain',
              mb: { xs: 1, md: 2 },
            }}
          />
          <Typography
            variant="h1"
            sx={{
              fontSize: { xs: '2.2rem', md: '3rem' },
              fontWeight: 800,
              lineHeight: 1,
              background: 'linear-gradient(90deg,#0f172a,#334155)',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
              textAlign: 'center',
              userSelect: 'none',
            }}
          >
            Canary
          </Typography>
          <Typography
            sx={{
              fontSize: { xs: '1rem', md: '1.35rem' },
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
        <Box
          component="form"
          noValidate
          sx={{
            width: '100%',
            maxWidth: 520,
            border: '1px solid #d1d5db',
            borderRadius: 1,
            bgcolor: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            p: { xs: 4, md: 5 },
          }}
        >
          <Typography variant="h5" align="center" gutterBottom sx={{ fontWeight: 600, mb: 1, color: '#111827' }}>
            Login
          </Typography>
          <TextField
            label="Email"
            autoComplete="off"
            fullWidth
            onChange={(e) => setEmail(e.target.value)}
            variant="outlined"
            placeholder="example@email.com"
            InputProps={{
              sx: {
                color: '#000',
                bgcolor: '#fff',
              },
            }}
            InputLabelProps={{
              sx: {
                color: '#999',
                '&.Mui-focused': { color: '#000' },
              },
            }}
            sx={{
              alignSelf: 'center',
              maxWidth: 480,
              '& .MuiOutlinedInput-root .MuiOutlinedInput-notchedOutline': { borderColor: '#999' },
              '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: '#000',
                borderWidth: '1.5px',
              },
              '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: '#f7bd13',
                borderWidth: '2px',
              },
            }}
          />
          <TextField
            label="Password"
            variant="outlined"
            type={showPassword ? 'text' : 'password'}
            onChange={(e) => setPassword(e.target.value)}
            fullWidth
            placeholder="••••••••"
            InputProps={{
              sx: {
                color: '#000',
                bgcolor: '#fff',
              },
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowPassword((prev) => !prev)} edge="end" sx={{ color: '#111827' }}>
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
            InputLabelProps={{
              sx: {
                color: '#999',
                '&.Mui-focused': { color: '#000' },
              },
            }}
            sx={{
              alignSelf: 'center',
              maxWidth: 480,
              '& .MuiOutlinedInput-root .MuiOutlinedInput-notchedOutline': { borderColor: '#999' },
              '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: '#000',
                borderWidth: '1.5px',
              },
              '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: '#f7bd13',
                borderWidth: '2px',
              },
            }}
          />
          {result && (
            <Typography
              sx={{
                mt: 1,
                color: resultIsSuccess ? '#000000ff' : '#b91c1c',
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
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 2 }}>
            <Button
              variant="contained"
              sx={{
                minWidth: 140,
                fontWeight: 600,
                fontSize: '1rem',
                py: 1.1,
                px: 3,
                textTransform: 'none',
              }}
              onClick={handleLoginClick}
            >
              Login
            </Button>
            <Button
              variant="contained"
              sx={{
                minWidth: 140,
                fontWeight: 600,
                fontSize: '1rem',
                py: 1.1,
                px: 3,
                textTransform: 'none',
              }}
              onClick={handleRegisterClick}
            >
              Register
            </Button>
          </Box>
        </Box>
      </Box>
    </AppThemeProvider>
  );
};

export default LoginPage;
