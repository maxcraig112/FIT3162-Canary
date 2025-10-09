import React, { useEffect, useState } from 'react';
import { Box, Typography, Toolbar, AppBar, Button, TextField, Paper, IconButton, InputAdornment, Modal, Menu, MenuItem, Checkbox, FormControlLabel } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SearchIcon from '@mui/icons-material/Search';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import * as projectHandler from './projectHandler';
import { useNavigate } from 'react-router-dom';
import { useAuthGuard } from '../utils/authUtil';
import type { Project } from '../utils/interfaces/interfaces';

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
        bgcolor: '#f9fafc',
      }}
    >
      <AppBar
        position="static"
        elevation={0}
        sx={{
          backgroundColor: '#ffffff',
          color: '#0f172a',
          borderBottom: '1px solid #e5e7eb',
          boxShadow: '0 2px 8px rgba(15, 23, 42, 0.06)',
        }}
      >
        <Toolbar
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            minHeight: { xs: 88, md: 100 },
            px: { xs: 2.5, md: 6 },
            gap: 4,
          }}
        >
          <Button
            onClick={handleBackToAllProjects}
            sx={{
              color: '#0f172a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 40,
              minHeight: 40,
              p: 1.5,
              mx: 'auto',
              '&:hover': { backgroundColor: '#f1f5f9' },
            }}
          >
            <ArrowBackIcon sx={{ fontSize: 50 }} />
          </Button>
          <Typography
            variant="h3"
            sx={{
              fontWeight: 800,
              letterSpacing: 0.5,
              lineHeight: 1,
              color: '#0f172a',
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
                  color: '#0f172a',
                  fontWeight: 500,
                  background: '#ffffff',
                  borderRadius: 2,
                  '& fieldset': { borderColor: '#d1d5db' },
                  '&:hover fieldset': { borderColor: '#94a3b8' },
                  '&.Mui-focused fieldset': { borderColor: '#ffdf01' },
                  height: 52,
                },
                '& input::placeholder': { color: '#64748b', opacity: 0.8 },
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <IconButton sx={{ color: '#64748b' }}>
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
                  color: '#0f172a',
                  background: '#ffffff',
                  borderRadius: 2,
                  '& fieldset': { borderColor: '#d1d5db' },
                  '&:hover fieldset': { borderColor: '#94a3b8' },
                  '&.Mui-focused fieldset': { borderColor: '#ffdf01' },
                  height: 52,
                },
                '& select': { paddingTop: '14px', paddingBottom: '14px' },
                '& .MuiSelect-icon': { color: '#64748b' },
                '& .MuiInputLabel-root': { color: '#64748b' },
                '& .MuiInputLabel-root.Mui-focused': { color: '#ffdf01' },
              }}
              SelectProps={{ native: true }}
            >
              <option value="projectName-asc" style={{ color: 'black' }}>
                Name (A-Z) Ascending
              </option>
              <option value="projectName-desc" style={{ color: 'black' }}>
                Name (Z-A) Descending
              </option>
              <option value="numberOfBatches-asc" style={{ color: 'black' }}>
                Number of Batches Ascending
              </option>
              <option value="numberOfBatches-desc" style={{ color: 'black' }}>
                Number of Batches Descending
              </option>
              <option value="lastUpdated-desc" style={{ color: 'black' }}>
                Last Updated Descending
              </option>
              <option value="lastUpdated-asc" style={{ color: 'black' }}>
                Last Updated Ascending
              </option>
            </TextField>
          </Box>
          <Button
            variant="contained"
            color="primary"
            sx={{
              fontWeight: 600,
              letterSpacing: 0.5,
              textTransform: 'none',
              px: 4,
              py: 1.5,
              borderRadius: 3,
              backgroundColor: '#ffdf01',
              boxShadow: '0 4px 12px rgba(255,223,1,0.35)',
              color: '#000',
              '&:hover': {
                backgroundColor: '#e6c200',           // darker hover
                boxShadow: '0 6px 16px rgba(230,194,0,0.45)',
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
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            columnGap: 2,
            rowGap: 4,
            alignItems: 'start',
            justifyItems: 'center',
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
                    p: 2,
                    width: '100%',
                    maxWidth: 240,
                    textAlign: 'center',
                    position: 'relative',
                    height: 200,
                    cursor: 'pointer',
                    boxShadow: '0 8px 18px rgba(15, 23, 42, 0.08)',
                    transition: 'box-shadow 0.3s ease, transform 0.3s ease, border-color 0.3s ease',
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    pt: 2,
                    pb: 5,
                    background: '#ffffff',
                    color: '#0f172a',
                    '&:hover': {
                      boxShadow: '0 14px 28px rgba(15,23,42,0.14)',
                      transform: 'translateY(-4px)',
                      borderColor: '#ffdf01',
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
                            bgcolor: '#ffffff',
                            color: '#0f172a',
                            border: '1px solid #e0e0e0',
                            boxShadow: 6,
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
                        color: '#0f172a',
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
                        color: '#475569',
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
                    <Typography variant="subtitle2" sx={{ fontWeight: 500, fontSize: '1.05rem', color: '#334155' }}>
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
              color: 'black',
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
