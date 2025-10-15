import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, Tabs, Tab, IconButton } from '@mui/material';
import AppThemeProvider from '../assets/AppThemeProvider';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { fetchProjectByID } from './projectHandlers';
import { BatchesTab } from './Tabs/BatchesTab';
import { DatasetTab } from './Tabs/DatasetTab';
import { ExportTab } from './Tabs/ExportTab';
import { SettingsTab } from './Tabs/SettingsTab';
import { UploadTab } from './Tabs/UploadTab';
import CloudUploadOutlined from '@mui/icons-material/CloudUploadOutlined';
import ShapeLineIcon from '@mui/icons-material/ShapeLine';
import BurstModeIcon from '@mui/icons-material/BurstMode';
import IosShareOutlined from '@mui/icons-material/IosShareOutlined';
import SettingsOutlined from '@mui/icons-material/SettingsOutlined';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import type { Project } from '../utils/interfaces/interfaces';
import { useAuthGuard } from '../utils/authUtil';

const ProjectPage: React.FC = () => {
  const navigate = useNavigate();
  useAuthGuard();
  const location = useLocation();
  const { projectID: paramProjectID } = useParams<{ projectID: string }>();
  const projectID = paramProjectID;

  const passedProject = (location.state as { project?: Project })?.project;
  const [projectData, setProjectData] = useState<Project | null>(passedProject || null);

  const [loading, setLoading] = useState<boolean>(!passedProject);
  const [selectedTab, setSelectedTab] = useState(0);
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

  useEffect(() => {
    if (selectedTab !== 4 || !projectID) {
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchProjectByID(projectID);
        if (!cancelled) {
          setProjectData(data);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load project data.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedTab, projectID]);

  function handleBackToAllProjects() {
    navigate('/projects');
  }

  // Map tab index <-> view string
  const indexToView: Record<number, string> = {
    0: 'upload',
    1: 'datasets',
    2: 'batches',
    3: 'export',
    4: 'settings',
  };

  function viewToIndex(view: string | null): number | null {
    if (!view) return null;
    switch (view.toLowerCase()) {
      case 'upload':
        return 0;
      case 'datasets':
        return 1;
      case 'batches':
        return 2;
      case 'export':
        return 3;
      case 'settings':
        return 4;
      default:
        return null;
    }
  }

  // Sync component state with the query parameter (?view=...)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const view = params.get('view');
    if (view === 'settings') {
      setSelectedTab(4);
      return;
    }
    const idx = viewToIndex(view);
    if (idx !== null) {
      setSelectedTab(idx);
    } else if (!view) {
      setSelectedTab(0);
    }
  }, [location.search]);

  function navigateWithView(view: string) {
    // Preserve current pathname (projectID path) but update view param
    const newUrl = `${location.pathname}?view=${view}`;
    if (location.search !== `?view=${view}`) {
      navigate(newUrl, { replace: false });
    }
  }

  function handleTabChange(_: React.SyntheticEvent, newValue: number) {
    setSelectedTab(newValue);
    navigateWithView(indexToView[newValue]);
  }

  const title = projectData?.projectName || (error ? 'Error' : loading ? 'Loading project...' : 'Project');
  const isSettingsSelected = selectedTab === 4;

  return (
    <AppThemeProvider>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          width: '100%',
          overflow: 'hidden',
          backgroundColor: '#f2f4f7ff',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            backgroundColor: '#ffffff',
            padding: '12px 24px',
            boxShadow: '0',
            borderBottom: '1px solid #d9e0e6',
          }}
        >
          <IconButton
            aria-label="Back to projects"
            onClick={handleBackToAllProjects}
            sx={{
              color: '#000000',
              width: 64,
              height: 44,
              borderRadius: 0.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              '&:hover': { backgroundColor: '#f1f5f9', color: '#000000' },
            }}
          >
            <ArrowBackIcon sx={{ fontSize: 36 }} />
          </IconButton>
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
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              width: 200,
              flexShrink: 0,
              background: 'linear-gradient(180deg,#ffffff 0%, #f0f4f8 100%)',
              boxShadow: '2px 0 6px rgba(0, 0, 0, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              borderRight: (t) => `1px solid ${t.palette.divider}`,
              height: '100%',
            }}
          >
            <Tabs
              orientation="vertical"
              value={selectedTab}
              onChange={handleTabChange}
              sx={{
                borderRight: 1,
                borderColor: 'divider',
                color: '#000000',
                width: '100%',
                overflow: 'visible',
                '& .MuiTabs-indicator': {
                  left: 'auto',
                  right: 0,
                  width: 6,
                  borderRadius: 0,
                  backgroundColor: (t) => t.palette.primary.main,
                },
                '& .MuiTabs-flexContainer': {
                  flexDirection: 'column',
                  gap: 0,
                  alignItems: 'stretch',
                },
                '& .MuiTab-root': {
                  width: '100%',
                  color: '#000000',
                  fontSize: '1.3rem',
                  textTransform: 'none',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  minHeight: 56,
                  padding: '12px 20px',
                  borderRadius: 0,
                  transition: 'background-color 0.2s ease',
                  '&.Mui-selected': {
                    fontWeight: 700,
                    backgroundColor: 'rgba(250, 204, 21, 0.22)',
                    color: '#000000',
                  },
                  '&:hover': {
                    backgroundColor: 'rgba(250, 204, 21, 0.12)',
                  },
                },
                '& .settings-tab': {
                  mt: 6,
                  borderTop: '1px solid',
                  borderColor: 'divider',
                },
              }}
            >
              <Tab icon={<CloudUploadOutlined />} iconPosition="start" label="Upload" aria-label="Upload" value={0} />
              <Tab icon={<ShapeLineIcon />} iconPosition="start" label="Datasets" aria-label="Datasets" value={1} />
              <Tab icon={<BurstModeIcon />} iconPosition="start" label="Batches" aria-label="Batches" value={2} />
              <Tab icon={<IosShareOutlined />} iconPosition="start" label="Export" aria-label="Export" value={3} />
              <Tab
                icon={<SettingsOutlined />}
                iconPosition="start"
                label="Settings"
                aria-label="Settings"
                value={4}
                className="settings-tab"
                disableRipple
                disableFocusRipple
                sx={{
                  backgroundColor: isSettingsSelected ? 'rgba(250, 204, 21, 0.22)' : 'transparent',
                  '&.Mui-selected': { color: '#000000' },
                }}
              />
            </Tabs>
          </Box>

          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              flexGrow: 1,
              px: 4,
              py: 0,
              overflow: 'hidden',
              alignItems: 'stretch',
              height: '100%',
            }}
          >
            {error && (
              <Paper sx={{ p: 3, mb: 2, width: '100%' }} elevation={2}>
                <Typography color="error">{error}</Typography>
              </Paper>
            )}
            <Box
              sx={{
                flex: '1 1 auto',
                width: '100%',
                height: '100%',
                px: 5,
                py: 0,
                display: 'flex',
                flexDirection: 'column',
                boxSizing: 'border-box',
                overflow: 'hidden',
              }}
            >
              <Box
                sx={{
                  flexGrow: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  width: '100%',
                  overflow: 'auto',
                }}
              >
                <Box
                  sx={{
                    flexGrow: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    pt: 3,
                    pb: 3,
                    px: { xs: 2, md: 4 },
                  }}
                >
                  {loading && !projectData && (
                    <Typography variant="body1" sx={{ color: '#000000ff' }}>
                      Loading content...
                    </Typography>
                  )}
                  {(!loading || projectData) && !error && (
                    <>
                      {isSettingsSelected ? (
                        <SettingsTab project={projectData} />
                      ) : (
                        <>
                          {selectedTab === 0 && <UploadTab project={projectData} />}
                          {selectedTab === 1 && <DatasetTab project={projectData} />}
                          {selectedTab === 2 && <BatchesTab project={projectData} />}
                          {selectedTab === 3 && <ExportTab project={projectData} />}
                        </>
                      )}
                    </>
                  )}
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </AppThemeProvider>
  );
};

export default ProjectPage;
