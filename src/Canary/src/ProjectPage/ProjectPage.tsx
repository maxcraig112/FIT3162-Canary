import React, { useState, useEffect, useCallback } from 'react';
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
import ShapeLineIcon from '@mui/icons-material/ShapeLine';
import BurstModeIcon from '@mui/icons-material/BurstMode';
import IosShareOutlined from '@mui/icons-material/IosShareOutlined';
import SettingsOutlined from '@mui/icons-material/SettingsOutlined';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import type { Project, Session } from '../utils/interfaces/interfaces';

const ProjectPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { projectID: paramProjectID } = useParams<{ projectID: string }>();
  const projectID = paramProjectID;

  const passedProject = (location.state as { project?: Project })?.project;
  const [projectData, setProjectData] = useState<Project | null>(passedProject || null);

  const [loading, setLoading] = useState<boolean>(!passedProject);
  const [selectedTab, setSelectedTab] = useState(0); // 0..3 for the main tabs
  const [settingsTab, setSettingsTab] = useState(false); // separate flag for settings so layout stays identical
  const [error, setError] = useState<string | null>(null);

  const handleSessionSettingsSaved = useCallback((session: Session) => {
    setProjectData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        settings: {
          ...(prev.settings ?? {}),
          session: { ...session },
        },
      };
    });
  }, []);

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
    if (!settingsTab || !projectID) {
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
  }, [settingsTab, projectID]);

  function handleBackToAllProjects() {
    navigate('/projects');
  }

  // Map tab index <-> view string
  const indexToView: Record<number, string> = {
    0: 'upload',
    1: 'datasets',
    2: 'batches',
    3: 'export',
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
      default:
        return null;
    }
  }

  // Sync component state with the query parameter (?view=...)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const view = params.get('view');
    if (view === 'settings') {
      setSettingsTab(true);
      // Deselect any main tab so user can click it again to return
      setSelectedTab(-1);
      return; // leave selectedTab as-is (so no main tab appears selected intentionally)
    }
    const idx = viewToIndex(view);
    if (idx !== null) {
      setSelectedTab(idx);
      setSettingsTab(false);
    } else if (!view) {
      // default state if no view specified -> upload
      setSelectedTab(0);
      setSettingsTab(false);
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
    setSettingsTab(false);
    navigateWithView(indexToView[newValue]);
  }

  function handleSettingsClick() {
    setSettingsTab(true);
    // Deselect main tabs so a click on the same tab index registers
    setSelectedTab(-1);
    navigateWithView('settings');
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
            startIcon={<ArrowBackIcon />}
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
                value={selectedTab < 0 ? false : selectedTab}
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
                <Tab icon={<CloudUploadOutlined />} iconPosition="start" label="Upload" aria-label="Upload" />
                <Tab icon={<ShapeLineIcon />} iconPosition="start" label="Datasets" aria-label="Datasets" />
                <Tab icon={<BurstModeIcon />} iconPosition="start" label="Batches" aria-label="Batches" />
                <Tab icon={<IosShareOutlined />} iconPosition="start" label="Export" aria-label="Export" />
              </Tabs>
            </Box>
            <Divider sx={{ my: 2 }} />
            <Tab
              icon={<SettingsOutlined />}
              iconPosition="start"
              label="Settings"
              onClick={handleSettingsClick}
              disableRipple
              disableFocusRipple
              sx={{
                textAlign: 'left',
                padding: '10px 16px',
                mt: 'auto',
                // remove the hover blue line on the top edge
                borderTop: 'none',
                borderColor: 'transparent',
                color: (t) => (settingsTab ? t.palette.primary.main : '#000000'),
                fontWeight: settingsTab ? 700 : 400,
                fontSize: '1.3rem',
                textTransform: 'none',
                justifyContent: 'flex-start',
                '& .MuiSvgIcon-root': { color: 'inherit' },
                opacity: 1,
                WebkitTapHighlightColor: 'transparent',
                '&:hover': {
                  backgroundColor: (t) => t.palette.action.hover,
                  borderTop: 'none',
                  boxShadow: 'none',
                },
                '&:focus, &.Mui-focusVisible': {
                  outline: 'none',
                  boxShadow: 'none',
                  borderTop: 'none',
                },
                '&::before, &::after': {
                  display: 'none',
                },
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
                height: 'calc(100vh - 200px)', // Set fixed height based on viewport
                px: 5,
                py: 4,
                display: 'flex',
                flexDirection: 'column',
                boxSizing: 'border-box',
                backgroundColor: '#ffffff', // ensure paper stays white
                overflow: 'hidden', // Prevent Paper itself from scrolling
              }}
            >
              <Box
                sx={{
                  flexGrow: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  width: '100%',
                  overflow: 'auto', // Enable scrolling for the content area only
                }}
              >
                {loading && !projectData && <Typography variant="body1">Loading content...</Typography>}
                {(!loading || projectData) && !error && (
                  <>
                    {settingsTab ? (
                      <SettingsTab project={projectData} onSessionSettingsSaved={handleSessionSettingsSaved} />
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
            </Paper>
          </Box>
        </Box>
      </Box>
    </AppThemeProvider>
  );
};

export default ProjectPage;
