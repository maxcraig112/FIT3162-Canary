import React, { useEffect, useState } from "react";
import { Box, Typography, Toolbar, AppBar, Button, TextField, Paper, IconButton, InputAdornment, Modal, Menu, MenuItem } from "@mui/material";
import Grid from "@mui/material/Grid";
import SearchIcon from "@mui/icons-material/Search";
import MoreVertIcon from '@mui/icons-material/MoreVert';
import * as projectHandler from "./projectHandler";
import { useNavigate } from "react-router-dom";

// Project type based on Go struct
export interface Project {
  projectID: string;
  projectName: string;
  userID: string;
  numberOfFiles: number;
  lastUpdated: string;
  settings?: unknown;
}


const ProjectsPage: React.FC = () => {
  const navigate = useNavigate();

  const [projects, setProjects] = useState<Project[]>([]);
  const [search, setSearch] = useState("");
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [sortKey, setSortKey] = useState<keyof Project>("projectName");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [modalOpen, setModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  // Rename modal state
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renameProjectId, setRenameProjectId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  // Delete confirm state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);

  // State for project menu
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [menuProjectId, setMenuProjectId] = useState<string | null>(null);

  useEffect(() => {
    projectHandler.fetchProjects()
      .then((data) => setProjects(data))
      .catch((err) => console.error(err));
  }, []);

  useEffect(() => {
    let result = projectHandler.handleSearch(projects, search);
    result = projectHandler.handleSort(result, sortKey, sortDirection);
    setFilteredProjects(result);
  }, [search, projects, sortKey, sortDirection]);

  function handleNewProject() {
    setModalOpen(true);
  }

  function handleCloseModal() {
    setModalOpen(false);
    setNewProjectName("");
  }

  return (
    <Box sx={{ mx: 'auto', maxWidth: '80vw', bgcolor: "#f5f5f5", minHeight: "100vh", minWidth: "fit-content" }}>
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar sx={{ display: "flex", justifyContent: "space-between" }}>
          <Typography variant="h4" sx={{ fontWeight: "bold" }}>Projects</Typography>
            <Box sx={{ display: "flex", alignItems: "center", flexGrow: 1, mx: 4 }}>
            <TextField
              variant="outlined"
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              size="small"
              fullWidth
              sx={{ mr: 2 }}
              InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                <IconButton>
                  <SearchIcon />
                </IconButton>
                </InputAdornment>
              ),
              }}
            />
            </Box>
          <Button variant="contained" color="primary" sx={{ fontWeight: "bold" }} onClick={handleNewProject}>
            New Project
          </Button>
        </Toolbar>
      </AppBar>
      <Box sx={{ px: 4, py: 2 }}>
        <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
          <TextField
            select
            label="Sort By"
            value={`${sortKey}-${sortDirection}`}
            onChange={(e) => {
              projectHandler.handleSortChange(e.target.value, setSortKey, setSortDirection);
            }}
            size="small"
            variant="outlined"
            sx={{ minWidth: 200 }}
            SelectProps={{
              native: true,
            }}
          >
            <option value="projectName-asc">Name (A-Z)</option>
            <option value="projectName-desc">Name (Z-A)</option>
            <option value="numberOfFiles-asc">Files (Low to High)</option>
            <option value="numberOfFiles-desc">Files (High to Low)</option>
            <option value="lastUpdated-desc">Last Updated (Newest)</option>
            <option value="lastUpdated-asc">Last Updated (Oldest)</option>
          </TextField>
        </Box>
        <Grid container spacing={3} justifyContent="center">
          {filteredProjects.map((project) => (
            <Grid key={project.projectID} sx={{ minHeight: "10vh", minWidth: "15vw" }}>
              <Paper 
                elevation={3} 
                sx={{ 
                  p: 3, 
                  textAlign: "center", 
                  position: "relative", 
                  minHeight: 180,
                  cursor: "pointer",
                  '&:hover': {
                    elevation: 6,
                    transform: "translateY(-2px)",
                    transition: "all 0.2s ease-in-out"
                  }
                }}
                onClick={() => projectHandler.handleProjectsPage(project.projectID, navigate)}
              >
            <IconButton
            sx={{
              position: "absolute",
              top: 8,
              right: 8,
              fontSize: 32,
              color: (theme) => theme.palette.grey[700],
              zIndex: 2
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
            onClick={e => e.stopPropagation()}
            >
            <MenuItem onClick={(e) => {
              e.stopPropagation();
              setRenameProjectId(project.projectID);
              setRenameValue(project.projectName);
              setRenameModalOpen(true);
              setMenuAnchorEl(null);
              setMenuProjectId(null);
            }}>Rename</MenuItem>
            <MenuItem onClick={(e) => {
              e.stopPropagation();
              setDeleteProjectId(project.projectID);
              setDeleteDialogOpen(true);
              setMenuAnchorEl(null);
              setMenuProjectId(null);
            }}>Delete</MenuItem>
            </Menu>
          <Typography variant="h5" sx={{ fontWeight: "bold", mb: 2 }}>
            {project.projectName}
          </Typography>
          <Box sx={{ position: "absolute", bottom: 16, left: 0, right: 0 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: "medium" }}>
              {project.numberOfFiles} files
            </Typography>
          </Box>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* Rename Project Modal */}
      <Modal
        open={renameModalOpen}
        onClose={() => setRenameModalOpen(false)}
        aria-labelledby="rename-project-modal-title"
      >
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
          <TextField
            label="New Project Name"
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            fullWidth
            autoFocus
            sx={{ mb: 2 }}
          />
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
                  setRenameValue("");
                  // Refresh projects
                  const updatedProjects = await projectHandler.fetchProjects();
                  setProjects(updatedProjects);
                } catch (error) {
                  alert((error instanceof Error ? error.message : error) || "Failed to rename project");
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
                setRenameValue("");
              }}
            >
              Cancel
            </Button>
          </Box>
        </Box>
      </Modal>

      {/* Delete Project Confirmation Dialog */}
      <Modal
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        aria-labelledby="delete-project-modal-title"
      >
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
                  alert((error instanceof Error ? error.message : error) || "Failed to delete project");
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
      <Modal
        open={modalOpen}
        onClose={handleCloseModal}
        aria-labelledby="project-modal-title"
        aria-describedby="project-modal-description"
      >
        <Box
          sx={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: "30vw",
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
          <TextField
        variant="outlined"
        label="Project Name"
        value={newProjectName}
        onChange={(e) => setNewProjectName(e.target.value)}
        size="medium"
        fullWidth
        sx={{ mb: 3 }}
        autoFocus
          />
            <Button
            variant="contained"
            color="primary"
            fullWidth
            onClick={async () => {
              try {
                const message = await projectHandler.handleNewProject(newProjectName);
                console.log("Project created successfully:", message);
                handleCloseModal();
                // Refresh the projects list
                const updatedProjects = await projectHandler.fetchProjects();
                setProjects(updatedProjects);
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : "Failed to create project";
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
