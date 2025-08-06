import React, { useState } from "react";
import { Box, Button, Typography, Paper, Tabs, Tab, Divider } from "@mui/material";
import AppThemeProvider from "../assets/AppThemeProvider";
import {
  CANARY_BUTTON_COLOR,
  CANARY_BUTTON_TEXT_COLOR,
} from "../assets/constants";
import { useNavigate } from "react-router-dom";

const ProjectPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedTab, setSelectedTab] = useState(0);
  const [settingsTab, setSettingsTab] = useState(false); // Separate state for the Settings tab

  function handleBackToAllProjects() {
    navigate("/projects");
  }

  function handleTabChange(event: React.SyntheticEvent, newValue: number) {
    setSelectedTab(newValue);
    setSettingsTab(false); // Ensure Settings tab is deselected when switching main tabs
  }

  function handleSettingsClick() {
    setSelectedTab(-1); // Deselect main tabs
    setSettingsTab(true); // Activate the Settings tab
  }

  return (
    <AppThemeProvider>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          minHeight: "100vh", // Ensure the parent container fills the full height
          width: "100%",
          backgroundColor: "#ffffff",
          overflowX: "hidden", // Hide any accidental horizontal overflow
        }}
      >
        {/* Top bar with title and back button */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            backgroundColor: "#f5f5f5",
            padding: "10px 20px",
            boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.1)",
          }}
        >
          <Button
            onClick={handleBackToAllProjects}
            style={{
              backgroundColor: CANARY_BUTTON_COLOR,
              color: CANARY_BUTTON_TEXT_COLOR,
            }}
          >
            Back to Projects
          </Button>
          <Typography variant="h4" sx={{ flexGrow: 1, textAlign: "center" }}>
            Project Title
          </Typography>
        </Box>

        {/* Main content area with sidebar and main content */}
        <Box
          sx={{
            display: "flex",
            flexDirection: "row",
            flexGrow: 1,
            width: "100%",
          }}
        >
          {/* Sidebar */}
          <Box
            sx={{
              width: "200px",
              backgroundColor: "#f0f0f0",
              padding: "20px",
              boxShadow: "2px 0 5px rgba(0, 0, 0, 0.1)",
              display: "flex",
              flexDirection: "column",
              flexGrow: 1, // Ensure the sidebar stretches to fill the height
            }}
          >
            {/* Main Tabs */}
            <Tabs
              orientation="vertical"
              value={selectedTab}
              onChange={handleTabChange}
              sx={{
                borderRight: 1,
                borderColor: "divider",
              }}
            >
              <Tab label="Upload" />
              <Tab label="Annotate" />
              <Tab label="Dataset" />
              <Tab label="Export" />
            </Tabs>

            {/* Divider */}
            <Divider sx={{ margin: "20px 0" }} />

            {/* Settings Tab */}
            <Box
              sx={{
                marginTop: "auto", // Push the Settings tab to the bottom
              }}
            >
              <Tab
                label="Settings"
                onClick={handleSettingsClick}
                sx={{
                  textAlign: "left",
                  padding: "10px 16px",
                  borderTop: 1,
                  borderColor: "divider",
                }}
              />
            </Box>
          </Box>

          {/* Main Content Area */}
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              flexGrow: 1, // Ensure the main content takes up the remaining space
              padding: "20px",
              overflowX: "hidden", // Prevent horizontal overflow
            }}
          >
            <Paper
              elevation={3}
              sx={{
                width: "100%",
                maxWidth: "800px", // Limit the width for better readability
                padding: 3,
                textAlign: "center",
                margin: "0 auto", // Center the content horizontally
              }}
            >
              <Typography variant="body1">
                {selectedTab === 0 && "Upload content goes here."}
                {selectedTab === 1 && "Annotate content goes here."}
                {selectedTab === 2 && "Dataset content goes here."}
                {selectedTab === 3 && "Export content goes here."}
                {settingsTab && "Settings content goes here."}
              </Typography>
            </Paper>
          </Box>
        </Box>
      </Box>
    </AppThemeProvider>
  );
};

export default ProjectPage;