import React, { useEffect, useState } from 'react';
import { Box, Typography, Toolbar, AppBar, Button, TextField, Paper, IconButton, InputAdornment, Modal, Menu, MenuItem, Checkbox, FormControlLabel } from '@mui/material';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import SearchIcon from '@mui/icons-material/Search';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import * as projectHandler from './projectHandler';
import { useNavigate } from 'react-router-dom';
import { useAuthGuard } from '../utils/authUtil';
import type { Project } from '../utils/intefaces/interfaces';

const ProjectsPage: React.FC = () => {
  // validate the user authentication, otherwise redirect to login
  useAuthGuard();

  const navigate = useNavigate();

  const [projects, setProjects] = useState<Project[]>([]);
  const [search, setSearch] = useState('');
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [sortKey, setSortKey] = useState<keyof Project>('projectName');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [modalOpen, setModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [createDefaultLabels, setCreateDefaultLabels] = useState(true); // checkbox for default labels
  // Renacame modal state
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renameProjectId, setRenameProjectId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  // Delete confirm state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);

  // State for project menu
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [menuProjectId, setMenuProjectId] = useState<string | null>(null);

  useEffect(() => {
    projectHandler
      .fetchProjects()
      .then((data) => setProjects(data))
      .catch((err) => console.error(err));
  }, []);

  useEffect(() => {
    let result = projectHandler.handleSearch(projects, search);
    result = projectHandler.handleSort(result, sortKey, sortDirection);
    setFilteredProjects(result);
  }, [search, projects, sortKey, sortDirection]);

  function handleBackToAllProjects() {
    navigate('/home');
  }
  function handleNewProject() {
    setModalOpen(true);
  }

  function handleCloseModal() {
    setModalOpen(false);
    setNewProjectName('');
  }

  const handleProjectClick = (projectID: string) => {
    projectHandler.handleProjectPage(projectID, navigate);
  };

  return (
    <Box
      sx={{
        width: '100%',
        minHeight: '100vh',
        bgcolor: '#f5f5f5',
      }}
    >
      <AppBar
        position="static"
        elevation={0}
        sx={{
          background: 'linear-gradient(135deg,#2c3a47 0%, #1f2732 55%, #192029 100%)',
          color: '#f1f5f9',
          boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          position: 'relative',
          '&:before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(circle at 25% 20%, rgba(255,255,255,0.09), transparent 60%)',
            pointerEvents: 'none',
            mixBlendMode: 'overlay',
          },
        }}
      >
        <Toolbar
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            minHeight: { xs: 92, md: 104 },
            px: { xs: 2.5, md: 6 },
            gap: 4,
          }}
        >
          <Button
            startIcon={<ExitToAppIcon sx={{ fontSize: 32 }} />}
            onClick={handleBackToAllProjects}
            sx={{
              color: '#f1f5f9',
              display: 'flex',
              alignItems: 'center',
              minWidth: 80,
              minHeight: 56,
              p: 1,
              borderRadius: 3,
              justifyContent: 'center',
              backgroundColor: 'rgba(255,255,255,0.04)',
              '&:hover': { backgroundColor: 'rgba(255,255,255,0.10)' },
            }}
          ></Button>
          <Typography
            variant="h3"
            sx={{
              fontWeight: 800,
              letterSpacing: 0.5,
              textShadow: '0 2px 6px rgba(0,0,0,0.45)',
              lineHeight: 1,
              fontSize: { xs: '2.1rem', md: '2.6rem' },
            }}
          >
            Projects
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1, mx: 4, gap: 2, maxWidth: '100%' }}>
            <TextField
              variant="outlined"
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              size="small"
              fullWidth
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: '#f1f5f9',
                  fontWeight: 500,
                  background: 'rgba(255,255,255,0.06)',
                  borderRadius: 2.5,
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.25)' },
                  '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.4)' },
                  '&.Mui-focused fieldset': { borderColor: '#ffffff' },
                  height: 52,
                },
                '& input::placeholder': { color: '#e2e8f0', opacity: 0.7 },
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <IconButton sx={{ color: '#e2e8f0' }}>
                      <SearchIcon />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              select
              label="Sort By"
              value={`${sortKey}-${sortDirection}`}
              onChange={(e) => {
                projectHandler.handleSortChange(e.target.value, setSortKey, setSortDirection);
              }}
              size="small"
              variant="outlined"
              sx={{
                minWidth: { xs: 160, sm: 200 },
                '& .MuiOutlinedInput-root': {
                  color: '#f1f5f9',
                  background: 'rgba(255,255,255,0.06)',
                  borderRadius: 2.5,
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.25)' },
                  '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.4)' },
                  '&.Mui-focused fieldset': { borderColor: '#ffffff' },
                  height: 52,
                },
                '& select': { paddingTop: '14px', paddingBottom: '14px' },
                '& .MuiSelect-icon': { color: '#f1f5f9' },
                '& .MuiInputLabel-root': { color: '#e2e8f0' },
                '& .MuiInputLabel-root.Mui-focused': { color: '#ffffff' },
              }}
              SelectProps={{ native: true }}
            >
              <option value="projectName-asc">Name (A-Z)</option>
              <option value="projectName-desc">Name (Z-A)</option>
              <option value="numberOfBatches-asc">Batches (Low to High)</option>
              <option value="numberOfBatches-desc">Batches (High to Low)</option>
              <option value="lastUpdated-desc">Last Updated (Newest)</option>
              <option value="lastUpdated-asc">Last Updated (Oldest)</option>
            </TextField>
          </Box>
          <Button
            variant="contained"
            color="primary"
            sx={{
              fontWeight: 600,
              letterSpacing: 0.5,
              boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
              textTransform: 'none',
              px: 4,
              py: 1.5,
              borderRadius: 3.5,
              backgroundColor: '#0ea5b6',
              '&:hover': {
                backgroundColor: '#0d93a2',
                boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
              },
            }}
            onClick={handleNewProject}
          >
            New Project
          </Button>
        </Toolbar>
      </AppBar>
      <Box sx={{ px: '10%', pt: { xs: 8, md: 12 }, pb: 3 }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            columnGap: '4%',
            rowGap: 6,
            alignItems: 'start',
          }}
        >
          {filteredProjects.map((project) => {
            const formattedUpdated = (() => {
              const d = new Date(project.lastUpdated);
              if (isNaN(d.getTime())) return project.lastUpdated;
              return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
            })();
            return (
              <Box key={project.projectID} sx={{ minHeight: '10vh' }}>
                <Paper
                  sx={{
                    p: 3,
                    textAlign: 'center',
                    position: 'relative',
                    height: 240,
                    cursor: 'pointer',
                    boxShadow: '0 10px 28px rgba(0,0,0,0.35), 0 4px 12px -2px rgba(0,0,0,0.25)',
                    transition: 'box-shadow 0.35s ease, transform 0.35s ease',
                    borderRadius: 10,
                    border: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    pt: 2,
                    pb: 7, // reserve space for bottom batch text
                    background: 'linear-gradient(135deg,#2c3a47 0%, #1f2732 55%, #192029 100%)',
                    color: '#f1f5f9',
                    overflow: 'hidden',
                    '&:before': {
                      content: '""',
                      position: 'absolute',
                      inset: 0,
                      background: 'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.08), transparent 60%)',
                      pointerEvents: 'none',
                      mixBlendMode: 'overlay',
                    },
                    '&:after': {
                      content: '""',
                      position: 'absolute',
                      inset: 0,
                      boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)',
                      borderRadius: 10,
                      pointerEvents: 'none',
                    },
                    '&:hover': {
                      boxShadow: '0 16px 42px rgba(0,0,0,0.55), 0 6px 18px -2px rgba(0,0,0,0.35)',
                      transform: 'translateY(-4px)',
                    },
                  }}
                  onClick={() => handleProjectClick(project.projectID)}
                >
                  <Box
                    sx={{
                      flexGrow: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '100%',
                      px: 1,
                    }}
                  >
                    <IconButton
                      sx={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        fontSize: 32,
                        color: (theme) => theme.palette.grey[700],
                        zIndex: 2,
                      }}
                      size="large"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuAnchorEl(e.currentTarget);
                        setMenuProjectId(project.projectID);
                      }}
                    >
                      <MoreVertIcon sx={{ fontSize: 32 }} />
                    </IconButton>
                    <Menu
                      anchorEl={menuAnchorEl}
                      open={menuProjectId === project.projectID}
                      onClose={() => {
                        setMenuAnchorEl(null);
                        setMenuProjectId(null);
                      }}
                      anchorOrigin={{
                        vertical: 'bottom',
                        horizontal: 'right',
                      }}
                      transformOrigin={{
                        vertical: 'top',
                        horizontal: 'right',
                      }}
                      slotProps={{
                        paper: {
                          sx: {
                            bgcolor: '#fff',
                            color: '#000',
                            border: '1px solid #e0e0e0',
                            boxShadow: 8,
                          },
                        },
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenameProjectId(project.projectID);
                          setRenameValue(project.projectName);
                          setRenameModalOpen(true);
                          setMenuAnchorEl(null);
                          setMenuProjectId(null);
                        }}
                      >
                        Rename
                      </MenuItem>
                      <MenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteProjectId(project.projectID);
                          setDeleteDialogOpen(true);
                          setMenuAnchorEl(null);
                          setMenuProjectId(null);
                        }}
                      >
                        Delete
                      </MenuItem>
                    </Menu>
                    <Typography
                      sx={{
                        fontWeight: 800,
                        fontSize: '2.0rem',
                        letterSpacing: 0.5,
                        lineHeight: 1.05,
                        textShadow: '0 2px 4px rgba(0,0,0,0.45)',
                        px: 1,
                        maxWidth: '100%',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                      title={project.projectName}
                    >
                      {project.projectName}
                    </Typography>
                    <Typography
                      sx={{
                        mt: 1,
                        color: '#cbd5e1',
                        fontSize: '1.05rem',
                        fontWeight: 500,
                        letterSpacing: 0.25,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '100%',
                      }}
                      title={`Updated ${formattedUpdated}`}
                    >
                      Updated {formattedUpdated}
                    </Typography>
                  </Box>
                  <Box sx={{ position: 'absolute', bottom: 16, left: 0, right: 0 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 500, fontSize: '1.05rem', color: '#e2e8f0', textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}>
                      {project.numberOfBatches} {project.numberOfBatches === 1 ? 'batch' : 'batches'}
                    </Typography>
                  </Box>
                </Paper>
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* Rename Project Modal */}
      <Modal open={renameModalOpen} onClose={() => setRenameModalOpen(false)} aria-labelledby="rename-project-modal-title">
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 350,
            bgcolor: 'background.paper',
            border: '2px solid #000',
            boxShadow: 24,
            p: 3,
          }}
        >
          <Typography id="rename-project-modal-title" variant="h6" align="center" sx={{ mb: 2 }}>
            Rename Project
          </Typography>
          <TextField label="New Project Name" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} fullWidth autoFocus sx={{ mb: 2 }} />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="contained"
              color="primary"
              fullWidth
              disabled={!renameValue.trim()}
              onClick={async () => {
                if (!renameProjectId) return;
                try {
                  await projectHandler.renameProject(renameProjectId, renameValue.trim());
                  setRenameModalOpen(false);
                  setRenameProjectId(null);
                  setRenameValue('');
                  // Refresh projects
                  const updatedProjects = await projectHandler.fetchProjects();
                  setProjects(updatedProjects);
                } catch (error) {
                  alert((error instanceof Error ? error.message : error) || 'Failed to rename project');
                }
              }}
            >
              Rename
            </Button>
            <Button
              variant="outlined"
              color="secondary"
              fullWidth
              onClick={() => {
                setRenameModalOpen(false);
                setRenameProjectId(null);
                setRenameValue('');
              }}
            >
              Cancel
            </Button>
          </Box>
        </Box>
      </Modal>

      {/* Delete Project Confirmation Dialog */}
      <Modal open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} aria-labelledby="delete-project-modal-title">
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 350,
            bgcolor: 'background.paper',
            border: '2px solid #000',
            boxShadow: 24,
            p: 3,
          }}
        >
          <Typography id="delete-project-modal-title" variant="h6" align="center" sx={{ mb: 2 }}>
            Delete Project?
          </Typography>
          <Typography align="center" sx={{ mb: 3, color: 'text.primary' }}>
            Are you sure you want to delete this project? This action cannot be undone.
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="contained"
              color="error"
              fullWidth
              onClick={async () => {
                if (!deleteProjectId) return;
                try {
                  await projectHandler.deleteProject(deleteProjectId);
                  setDeleteDialogOpen(false);
                  setDeleteProjectId(null);
                  // Refresh projects
                  const updatedProjects = await projectHandler.fetchProjects();
                  setProjects(updatedProjects);
                } catch (error) {
                  alert((error instanceof Error ? error.message : error) || 'Failed to delete project');
                }
              }}
            >
              Delete
            </Button>
            <Button
              variant="outlined"
              color="secondary"
              fullWidth
              onClick={() => {
                setDeleteDialogOpen(false);
                setDeleteProjectId(null);
              }}
            >
              Cancel
            </Button>
          </Box>
        </Box>
      </Modal>

      {/* New Project Modal */}
      <Modal open={modalOpen} onClose={handleCloseModal} aria-labelledby="project-modal-title" aria-describedby="project-modal-description">
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '30vw',
            bgcolor: 'background.paper',
            border: '2px solid #000',
            boxShadow: 24,
            p: 4,
          }}
        >
          <IconButton
            aria-label="close"
            onClick={handleCloseModal}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
              color: (theme) => theme.palette.grey[500],
            }}
          >
            ×
          </IconButton>
          <Typography id="project-modal-title" variant="h5" component="h2" color="black" align="center" sx={{ mb: 2 }}>
            Create New Project
          </Typography>
          <TextField variant="outlined" label="Project Name" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} size="medium" fullWidth sx={{ mb: 3 }} autoFocus />
          <FormControlLabel
            control={<Checkbox checked={createDefaultLabels} onChange={(e) => setCreateDefaultLabels(e.target.checked)} />}
            label="Create default labels"
            sx={{ 
              mb: 3,
              color: 'black'
             }}
          />
          <Button
            variant="contained"
            color="primary"
            fullWidth
            onClick={async () => {
              try {
                const message = await projectHandler.handleNewProject(newProjectName, createDefaultLabels);
                console.log('Project created successfully:', message);
                handleCloseModal();
                // Refresh the projects list
                const updatedProjects = await projectHandler.fetchProjects();
                setProjects(updatedProjects);
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Failed to create project';
                alert(errorMessage);
              }
            }}
            disabled={!newProjectName.trim()}
          >
            Create
          </Button>
        </Box>
      </Modal>
    </Box>
  );
};

export default ProjectsPage;
