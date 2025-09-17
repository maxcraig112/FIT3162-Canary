import React from 'react';
import { Box, Button, Typography, Paper, Modal, IconButton, TextField } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AppThemeProvider from '../assets/AppThemeProvider';
import { CANARY_BUTTON_COLOR, CANARY_BUTTON_TEXT_COLOR } from '../assets/constants';
import { useNavigate } from 'react-router-dom';

import { handleProjectsPage, handleJoinSession, handleSettings } from './homeHandlers';
import { clearCookie } from '../utils/cookieUtils';
import canaryImg from '../images/canary.jpg';
import { useAuthGuard } from '../utils/authUtil';

const HomePage: React.FC = () => {
  // validate the user authentication, otherwise redirect to login
  useAuthGuard();

  const navigate = useNavigate();

  const [joinOpen, setJoinOpen] = React.useState(false);
  const [sessionName, setSessionName] = React.useState('');
  const [sessionPassword, setSessionPassword] = React.useState('');

  function handleOpenJoin() {
    setJoinOpen(true);
  }
  function handleCloseJoin() {
    setJoinOpen(false);
    setSessionName('');
    setSessionPassword('');
  }
  function handleJoinSession() {
    // TODO: Implement join session logic
    setJoinOpen(false);
  }

  function handleLogoutAndRedirect() {
    // Remove JWT token from cookies
    clearCookie('auth_token');
    clearCookie('user_id');
    navigate('/login');
  }

  return (
    <AppThemeProvider>
      <Box
        sx={{
          minHeight: '100vh',
          minWidth: '100vw',
          bgcolor: 'background.default',
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          p: 0,
          overflow: 'hidden',
        }}
      >
        {/* Background image */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 0,
            background: 'rgba(0,0,0,0.5)',
            backgroundImage: `url(${canaryImg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'brightness(0.5) blur(6px)',
            transition: 'filter 0.3s',
          }}
        />
        {/* Main content */}
        <Box
          sx={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
          }}
        >
          <Typography
            variant="h1"
            sx={{
              color: '#fff',
              fontWeight: 900,
              mb: 6,
              letterSpacing: 4,
              fontSize: { xs: '3.5rem', md: '7rem', lg: '9rem' },
              lineHeight: 1,
            }}
          >
            Canary
          </Typography>
          <Paper
            elevation={8}
            sx={{
              bgcolor: 'background.paper',
              borderRadius: 4,
              p: 4,
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
              alignItems: 'center',
              minWidth: 350,
              opacity: 0.95,
            }}
          >
            <Button
              variant="contained"
              sx={{
                fontSize: '1.5rem',
                borderRadius: 3,
                width: 250,
                py: 2,
                fontWeight: 700,
                backgroundColor: CANARY_BUTTON_COLOR,
                color: CANARY_BUTTON_TEXT_COLOR,
                '&:hover': {
                  backgroundColor: '#0097a7',
                  color: CANARY_BUTTON_TEXT_COLOR,
                },
              }}
              onClick={() => handleProjectsPage(navigate)}
            >
              Projects
            </Button>
            <Button
              variant="contained"
              sx={{
                fontSize: '1.5rem',
                borderRadius: 3,
                width: 250,
                py: 2,
                fontWeight: 700,
                backgroundColor: CANARY_BUTTON_COLOR,
                color: CANARY_BUTTON_TEXT_COLOR,
                '&:hover': {
                  backgroundColor: '#0097a7',
                  color: CANARY_BUTTON_TEXT_COLOR,
                },
              }}
              onClick={handleOpenJoin}
            >
              Join Session
            </Button>
        {/* Join Session Modal */}
        <Modal open={joinOpen} onClose={handleCloseJoin} aria-labelledby="join-session-modal" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Paper elevation={12} sx={{ position: 'relative', p: 4, minWidth: 350, borderRadius: 4, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <IconButton sx={{ position: 'absolute', top: 12, right: 12 }} onClick={handleCloseJoin}>
              <CloseIcon />
            </IconButton>
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
              Join Session
            </Typography>
            <TextField
              label="Session Name"
              variant="outlined"
              value={sessionName}
              onChange={e => setSessionName(e.target.value)}
              fullWidth
              autoComplete="off"
            />
            <TextField
              label="Password"
              variant="outlined"
              type="password"
              value={sessionPassword}
              onChange={e => setSessionPassword(e.target.value)}
              fullWidth
              autoComplete="off"
            />
            <Button
              variant="contained"
              sx={{ fontWeight: 700, fontSize: '1.2rem', borderRadius: 3, py: 1, backgroundColor: CANARY_BUTTON_COLOR, color: CANARY_BUTTON_TEXT_COLOR }}
              onClick={handleJoinSession}
            >
              Join
            </Button>
          </Paper>
        </Modal>
          </Paper>
        </Box>
        {/* Logout button bottom right */}
        <Box
          sx={{
            position: 'fixed',
            right: 32,
            bottom: 32,
            zIndex: 2,
          }}
        >
          <Button
            variant="contained"
            sx={{
              fontWeight: 900,
              fontSize: '1.2rem',
              borderRadius: 3,
              px: 5,
              py: 2,
              boxShadow: 6,
              letterSpacing: 2,
              textTransform: 'uppercase',
              border: '2px solid #fff',
              color: CANARY_BUTTON_TEXT_COLOR,
              backgroundColor: CANARY_BUTTON_COLOR,
              '&:hover': {
                backgroundColor: '#0097a7',
                color: CANARY_BUTTON_TEXT_COLOR,
                border: '2px solid #fff',
              },
            }}
            onClick={handleLogoutAndRedirect}
          >
            Log Out
          </Button>
        </Box>
      </Box>
    </AppThemeProvider>
  );
};

export default HomePage;
