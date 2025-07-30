import React from "react";
import { Box, Button, Typography, Paper } from "@mui/material";
import AppThemeProvider from "../assets/AppThemeProvider";
import {
  CANARY_BUTTON_COLOR,
  CANARY_BUTTON_TEXT_COLOR,
} from "../assets/constants";
import { useNavigate } from "react-router-dom";

import {
  handleProjects,
  handleJoinSession,
  handleSettings,
} from "./homeHandlers";

const HomePage: React.FC = () => {
  const navigate = useNavigate();

  function handleLogoutAndRedirect() {
    // Remove JWT token from cookies
    document.cookie = "token=; path=/; max-age=0";
    navigate("/login");
  }

  return (
    <AppThemeProvider>
      <Box
        sx={{
          minHeight: "100vh",
          minWidth: "100vw",
          bgcolor: "background.default",
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          m: 0,
          p: 0,
          overflow: "hidden",
        }}
      >
        {/* Background image */}
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            zIndex: 0,
            background: "rgba(0,0,0,0.5)",
            backgroundImage: "url(src/images/canary.jpg)",
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "brightness(0.5) blur(6px)",
            transition: "filter 0.3s",
          }}
        />
        {/* Main content */}
        <Box
          sx={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
          }}
        >
          <Typography
            variant="h1"
            sx={{
              color: "#fff",
              fontWeight: 900,
              mb: 6,
              letterSpacing: 4,
              fontSize: { xs: "3.5rem", md: "7rem", lg: "9rem" },
              lineHeight: 1,
            }}
          >
            Canary
          </Typography>
          <Paper
            elevation={8}
            sx={{
              bgcolor: "background.paper",
              borderRadius: 4,
              p: 4,
              display: "flex",
              flexDirection: "column",
              gap: 3,
              alignItems: "center",
              minWidth: 350,
              opacity: 0.95,
            }}
          >
            {[
              {
                label: "Projects",
                onClick: handleProjects,
              },
              {
                label: "Join Session",
                onClick: handleJoinSession,
              },
              {
                label: "Settings",
                onClick: handleSettings,
              },
            ].map(({ label, onClick }) => (
              <Button
                key={label}
                variant="contained"
                sx={{
                  fontSize: "1.5rem",
                  borderRadius: 3,
                  width: 250,
                  py: 2,
                  fontWeight: 700,
                  backgroundColor: CANARY_BUTTON_COLOR,
                  color: CANARY_BUTTON_TEXT_COLOR,
                  "&:hover": {
                    backgroundColor: "#0097a7",
                    color: CANARY_BUTTON_TEXT_COLOR,
                  },
                }}
                onClick={onClick}
              >
                {label}
              </Button>
            ))}
          </Paper>
        </Box>
        {/* Logout button bottom right */}
        <Box
          sx={{
            position: "fixed",
            right: 32,
            bottom: 32,
            zIndex: 2,
          }}
        >
          <Button
            variant="contained"
            sx={{
              fontWeight: 900,
              fontSize: "1.2rem",
              borderRadius: 3,
              px: 5,
              py: 2,
              boxShadow: 6,
              letterSpacing: 2,
              textTransform: "uppercase",
              border: "2px solid #fff",
              color: CANARY_BUTTON_TEXT_COLOR,
              backgroundColor: CANARY_BUTTON_COLOR,
              "&:hover": {
                backgroundColor: "#0097a7",
                color: CANARY_BUTTON_TEXT_COLOR,
                border: "2px solid #fff",
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
