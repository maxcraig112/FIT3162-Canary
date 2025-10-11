import React from 'react';
import { Box, Button, Typography, Paper, Modal, IconButton, TextField } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AppThemeProvider from '../assets/AppThemeProvider';
import { useNavigate } from 'react-router-dom';

import { handleProjectsPage } from './homeHandlers';
import { clearCookie, setCookie } from '../utils/cookieUtils';
import { useAuthGuard } from '../utils/authUtil';
import { joinSession } from '../utils/interfaces/session';

const HomePage: React.FC = () => {
  // validate the user authentication, otherwise redirect to login
  useAuthGuard();

  const navigate = useNavigate();

  const [joinOpen, setJoinOpen] = React.useState(false);
  const [sessionID, setSessionID] = React.useState('');
  const [sessionPassword, setSessionPassword] = React.useState('');

  function handleOpenJoin() {
    setJoinOpen(true);
  }
  async function handleCloseJoin() {
    setJoinOpen(false);
    setSessionID('');
    setSessionPassword('');
  }

  async function handleJoinSession() {
    setJoinOpen(false);
    const result = await joinSession(sessionID, sessionPassword);
    if (result.ok) {
      if (result.data.role === 'owner') {
        alert('As the session owner, please enter your session through the project batches page.');
        setSessionID('');
        setSessionPassword('');
        return;
      }
      if (result.data.token) {
        setCookie('join_session_cookie', result.data.token);
      } else {
        clearCookie('join_session_cookie');
      }
      setCookie('session_id_cookie', result.data.sessionID);
      const navigateURL = `/annotate?batchID=${encodeURIComponent(result.data.batchID)}&projectID=${encodeURIComponent(result.data.projectID)}`;
      navigate(navigateURL);
    } else {
      alert(`Failed to join session: ${result.error}`);
    }
    setSessionID('');
    setSessionPassword('');
  }

  function handleLogoutAndRedirect() {
    // Remove JWT token from cookies
    clearCookie('auth_token');
    clearCookie('user_id');
    navigate('/login');
  }

  const buttonSx = {
    width: { xs: '100%', sm: 320 },
    fontWeight: 800,
    fontSize: '1.75rem',
    py: 0.75,
    borderRadius: 2,
    textTransform: 'none',
    mt: "1rem"
  };
  const textFieldSx = {
    alignSelf: 'center',
    maxWidth: 480,
    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#999' },
  };

  return (
    <AppThemeProvider>
      <Box
        sx={{
          minHeight: '100vh',
          width: '100%',
          bgcolor: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          pt: { xs: 4, md: 6 },
        }}
      >
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
            }}
          >
            Canary
          </Typography>
          <Typography
            sx={{
              fontSize: { xs: '1rem', md: '1.35rem' },
              fontWeight: 500,
              color: '#374151',
              letterSpacing: 0.5,
            }}
          >
            Bird annotation simplified
          </Typography>
        </Box>

        <Box sx={{ width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, mt: '4rem' }}>
          <Button variant="contained" sx={buttonSx} onClick={() => handleProjectsPage(navigate)}>
            Projects
          </Button>
          <Button variant="contained" sx={buttonSx} onClick={handleOpenJoin}>
            Join Session
          </Button>
        </Box>

        <Box
          sx={{
            width: '100%',
            maxWidth: 960,
            mt: { xs: 6, md: 8 },
            px: { xs: 3, md: 4 },
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#0f172a', mb: 1 }}>
              Welcome back to Canary
            </Typography>
            <Typography variant="body1" sx={{ color: '#475569', maxWidth: 640, mx: 'auto' }}>
              Continue collaborating on avian annotation projects, manage your data, or jump straight into an active session. Your latest work is only a click away.
            </Typography>
          </Box>
        </Box>

        {/* Join Session Modal */}
        <Modal open={joinOpen} onClose={handleCloseJoin} aria-labelledby="join-session-modal" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Paper
            elevation={12}
            sx={{
              position: 'relative',
              p: 4,
              minWidth: 320,
              borderRadius: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
            }}
          >
            <IconButton sx={{ position: 'absolute', top: 12, right: 12 }} onClick={handleCloseJoin}>
              <CloseIcon />
            </IconButton>
            <Typography variant="h5" sx={{ fontWeight: 700, textAlign: 'center' }}>
              Join Session
            </Typography>
            <TextField
              label="Session ID"
              name="session-id"
              variant="outlined"
              value={sessionID}
              onChange={(e) => setSessionID(e.target.value)}
              fullWidth
              autoComplete="off"
              InputProps={{ sx: { color: '#000', bgcolor: '#fff' } }}
              InputLabelProps={{ sx: { color: '#999', '&.Mui-focused': { color: '#000' } } }}
              sx={textFieldSx}
            />
            <TextField
              label="Password (optional)"
              name="session-password"
              variant="outlined"
              type="password"
              value={sessionPassword}
              onChange={(e) => setSessionPassword(e.target.value)}
              fullWidth
              autoComplete="new-password"
              InputProps={{ sx: { color: '#000', bgcolor: '#fff' } }}
              InputLabelProps={{ sx: { color: '#999', '&.Mui-focused': { color: '#000' } } }}
              sx={textFieldSx}
            />
            <Button variant="contained" sx={{ ...buttonSx, alignSelf: 'center', px: 4 }} onClick={handleJoinSession}>
              Join
            </Button>
          </Paper>
        </Modal>
        <Box sx={{ position: 'fixed', right: 32, bottom: 32 }}>
          <Button variant="contained" sx={{ ...buttonSx, width: 'auto', px: 4, fontWeight: 800 }} onClick={handleLogoutAndRedirect}>
            Log Out
          </Button>
        </Box>
      </Box>
    </AppThemeProvider>
  );
};

export default HomePage;
