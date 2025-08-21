import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  Typography,
  Paper,
  Tabs,
  Tab,
  Divider,
} from "@mui/material";
import AppThemeProvider from "../assets/AppThemeProvider";
import {
  CANARY_BUTTON_COLOR,
  CANARY_BUTTON_TEXT_COLOR,
} from "../assets/constants";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { fetchProjectByID } from "./projectHandlers";

export interface Project {
  projectName: string /* other fields here */;
}

const ProjectPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { projectID: paramProjectID } = useParams<{ projectID: string }>();
  const projectID = paramProjectID;

  const passedProject = (location.state as { project?: Project })?.project;
  const [projectData, setProjectData] = useState<Project | null>(
    passedProject || null,
  );

  const [loading, setLoading] = useState<boolean>(!passedProject);
  const [selectedTab, setSelectedTab] = useState(0);
  const [settingsTab, setSettingsTab] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!projectID) {
        setError("No project selected.");
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const data = await fetchProjectByID(projectID);
        if (!cancelled) setProjectData(data);
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "Failed to load project data.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [projectID]);

  function handleBackToAllProjects() {
    navigate("/projects");
  }

  function handleTabChange(_: React.SyntheticEvent, newValue: number) {
    setSelectedTab(newValue);
    setSettingsTab(false);
  }

  function handleSettingsClick() {
    setSelectedTab(-1);
    setSettingsTab(true);
  }

  const title =
    projectData?.projectName ||
    (error ? "Error" : loading ? "Loading project..." : "Project");

  return (
    <AppThemeProvider>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          minHeight: "100vh",
          width: "100%",
          overflowX: "hidden",
          backgroundColor: "#ffffff", // force white background
        }}
      >
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
          <Typography
            variant="h4"
            sx={{ flexGrow: 1, textAlign: "center", color: "#000000" }}
          >
            {title}
          </Typography>
        </Box>

        <Box
          sx={{
            display: "flex",
            flexDirection: "row",
            flexGrow: 1,
            width: "100%",
          }}
        >
          <Box
            sx={{
              width: 260,
              flexShrink: 0,
              backgroundColor: "#ffffff", // sidebar white
              padding: "20px",
              boxShadow: "2px 0 5px rgba(0, 0, 0, 0.1)",
              display: "flex",
              flexDirection: "column",
              borderRight: (t) => `1px solid ${t.palette.divider}`,
            }}
          >
            <Tabs
              orientation="vertical"
              value={selectedTab}
              onChange={handleTabChange}
              sx={{
                borderRight: 1,
                borderColor: "divider",
                color: "#000000",
                "& .MuiTab-root": { color: "#000000" },
                "& .Mui-selected": { fontWeight: 600 },
              }}
            >
              <Tab label="Upload" />
              <Tab label="Annotate" />
              <Tab label="Dataset" />
              <Tab label="Export" />
            </Tabs>
            <Divider sx={{ my: 2 }} />
            <Tab
              label="Settings"
              onClick={handleSettingsClick}
              sx={{
                textAlign: "left",
                padding: "10px 16px",
                borderTop: 1,
                borderColor: "divider",
                mt: "auto",
                color: "#000000",
              }}
            />
          </Box>

          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              flexGrow: 1,
              p: 4,
              overflow: "hidden",
              alignItems: "stretch", // stretch so child fills width
            }}
          >
            {error && (
              <Paper sx={{ p: 3, mb: 2, width: "100%" }} elevation={2}>
                <Typography color="error">{error}</Typography>
              </Paper>
            )}
            <Paper
              elevation={3}
              sx={{
                flex: "1 1 auto",
                width: "100%",
                minWidth: 1000, // keep a stable wide layout
                minHeight: 500,
                px: 5,
                py: 4,
                display: "flex",
                flexDirection: "column",
                boxSizing: "border-box",
                backgroundColor: "#ffffff", // ensure paper stays white
              }}
            >
              <Box
                sx={{
                  flexGrow: 1,
                  display: "flex",
                  flexDirection: "column",
                  width: "100%",
                }}
              >
                {loading && !projectData && (
                  <Typography variant="body1">Loading content...</Typography>
                )}
                {!loading && !error && (
                  <>
                    {selectedTab === 0 && <UploadTab project={projectData} />}
                    {selectedTab === 1 && <AnnotateTab project={projectData} />}
                    {selectedTab === 2 && <DatasetTab project={projectData} />}
                    {selectedTab === 3 && <ExportTab project={projectData} />}
                    {settingsTab && <SettingsTab project={projectData} />}
                  </>
                )}
              </Box>
            </Paper>
          </Box>
        </Box>
      </Box>
    </AppThemeProvider>
  );
};

// Tab content (untyped now, since ProjectDetails removed)
const UploadTab: React.FC<{ project: Project | null }> = ({ project }) => (
  <Typography sx={{ color: "#000" }}>
    {project ? `Upload files to ${project.projectName}` : "Loading..."}
  </Typography>
);
const AnnotateTab: React.FC<{ project: Project | null }> = ({ project }) => (
  <Typography sx={{ color: "#000" }}>
    Annotate assets for {project?.projectName}
  </Typography>
);
const DatasetTab: React.FC<{ project: Project | null }> = ({ project }) => (
  <Typography sx={{ color: "#000" }}>
    Dataset overview for {project?.projectName}
  </Typography>
);
const ExportTab: React.FC<{ project: Project | null }> = ({ project }) => (
  <Typography sx={{ color: "#000" }}>
    Export options for {project?.projectName}
  </Typography>
);
const SettingsTab: React.FC<{ project: Project | null }> = ({ project }) => (
  <Typography sx={{ color: "#000" }}>
    Settings for {project?.projectName}
  </Typography>
);

export default ProjectPage;
