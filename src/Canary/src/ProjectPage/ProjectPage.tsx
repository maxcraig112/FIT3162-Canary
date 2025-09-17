import React, { useState, useEffect } from 'react';
import { Box, Button, Typography, Paper, Tabs, Tab, Divider } from '@mui/material';
import AppThemeProvider from '../assets/AppThemeProvider';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { fetchProjectByID } from './projectHandlers';
import { BatchesTab } from './Tabs/BatchesTab';
import { DatasetTab } from './Tabs/DatasetTab';
import { ExportTab } from './Tabs/ExportTab';
import { SettingsTab } from './Tabs/SettingsTab';
import { UploadTab } from './Tabs/UploadTab';
import CloudUploadOutlined from '@mui/icons-material/CloudUploadOutlined';
import GpsFixedOutlined from '@mui/icons-material/GpsFixedOutlined';
import BarChartOutlined from '@mui/icons-material/BarChartOutlined';
import IosShareOutlined from '@mui/icons-material/IosShareOutlined';
import SettingsOutlined from '@mui/icons-material/SettingsOutlined';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';

export interface Project {
  projectID: string;
  projectName: string;
  userID: string;
  numberOfBatches: number;
  lastUpdated: string;
  settings?: unknown;
}

const ProjectPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { projectID: paramProjectID } = useParams<{ projectID: string }>();
  const projectID = paramProjectID;

  const passedProject = (location.state as { project?: Project })?.project;
  const [projectData, setProjectData] = useState<Project | null>(passedProject || null);

  const [loading, setLoading] = useState<boolean>(!passedProject);
  const [selectedTab, setSelectedTab] = useState(0);
  const [settingsTab, setSettingsTab] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!projectID) {
        setError('No project selected.');
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const data = await fetchProjectByID(projectID);
        if (!cancelled) setProjectData(data);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load project data.');
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
    navigate('/projects');
  }

  function handleTabChange(_: React.SyntheticEvent, newValue: number) {
    setSelectedTab(newValue);
    setSettingsTab(false);
  }

  function handleSettingsClick() {
    setSelectedTab(-1);
    setSettingsTab(true);
  }

  const title = projectData?.projectName || (error ? 'Error' : loading ? 'Loading project...' : 'Project');

  return (
    <AppThemeProvider>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          width: '100%',
          overflowX: 'hidden',
          backgroundColor: '#ffffff', // force white background
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            background: 'linear-gradient(135deg,#f5f7fa 0%, #e7ecf2 100%)',
            padding: '12px 24px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.10)',
            borderBottom: '1px solid #d9e0e6',
          }}
        >
          <Button
            startIcon={<ExitToAppIcon />}
            onClick={handleBackToAllProjects}
            sx={{
              color: '#000000',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center' }}>Back to Projects</Box>
          </Button>
          <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center' }}>
            <Typography
              variant="h4"
              sx={{
                display: 'flex',
                alignItems: 'center',
                color: '#000000',
                textAlign: 'center',
              }}
            >
              {title}
            </Typography>
          </Box>
        </Box>

        <Box
          sx={{
            display: 'flex',
            flexDirection: 'row',
            flexGrow: 1,
            width: '100%',
          }}
        >
          <Box
            sx={{
              width: 260,
              flexShrink: 0,
              background: 'linear-gradient(180deg,#ffffff 0%, #f0f4f8 100%)',
              padding: '20px',
              boxShadow: '2px 0 6px rgba(0, 0, 0, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              borderRight: (t) => `1px solid ${t.palette.divider}`,
            }}
          >
            <Box sx={{ height: '50vh' }}>
              <Tabs
                orientation="vertical"
                value={selectedTab}
                onChange={handleTabChange}
                sx={{
                  height: '100%',
                  borderRight: 1,
                  borderColor: 'divider',
                  color: '#000000',
                  '& .MuiTabs-flexContainer': {
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  },
                  '& .MuiTab-root': {
                    color: '#000000',
                    fontSize: '1.3rem',
                    textTransform: 'none',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    minHeight: 56,
                  },
                  '& .Mui-selected': { fontWeight: 700 },
                }}
              >
                <Tab icon={<CloudUploadOutlined />} iconPosition="start" label="Upload" />
                <Tab icon={<GpsFixedOutlined />} iconPosition="start" label="Datasets" />
                <Tab icon={<BarChartOutlined />} iconPosition="start" label="Batches" />
                <Tab icon={<IosShareOutlined />} iconPosition="start" label="Export" />
              </Tabs>
            </Box>
            <Divider sx={{ my: 2 }} />
            <Tab
              icon={<SettingsOutlined />}
              iconPosition="start"
              label="Settings"
              onClick={handleSettingsClick}
              sx={{
                textAlign: 'left',
                padding: '10px 16px',
                borderTop: 1,
                borderColor: 'divider',
                mt: 'auto',
                color: '#000000',
                fontSize: '1.3rem',
                textTransform: 'none',
                justifyContent: 'flex-start',
              }}
            />
          </Box>

          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              flexGrow: 1,
              p: 4,
              overflow: 'hidden',
              alignItems: 'stretch', // stretch so child fills width
            }}
          >
            {error && (
              <Paper sx={{ p: 3, mb: 2, width: '100%' }} elevation={2}>
                <Typography color="error">{error}</Typography>
              </Paper>
            )}
            <Paper
              elevation={3}
              sx={{
                flex: '1 1 auto',
                width: '100%',
                minWidth: 1000, // keep a stable wide layout
                minHeight: 500,
                px: 5,
                py: 4,
                display: 'flex',
                flexDirection: 'column',
                boxSizing: 'border-box',
                backgroundColor: '#ffffff', // ensure paper stays white
              }}
            >
              <Box
                sx={{
                  flexGrow: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  width: '100%',
                }}
              >
                {loading && !projectData && <Typography variant="body1">Loading content...</Typography>}
                {!loading && !error && (
                  <>
                    {selectedTab === 0 && <UploadTab project={projectData} />}
                    {selectedTab === 1 && <DatasetTab project={projectData} />}
                    {selectedTab === 2 && <BatchesTab project={projectData} />}
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

export default ProjectPage;
