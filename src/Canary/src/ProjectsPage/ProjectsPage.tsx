import React, { useEffect, useState } from "react";
import { Box, Typography, Toolbar, AppBar, Button, TextField, Paper, IconButton, InputAdornment, Modal } from "@mui/material";
import Grid from "@mui/material/Grid";
import SearchIcon from "@mui/icons-material/Search";
import * as projectHandler from "./projectHandler";

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
  const [projects, setProjects] = useState<Project[]>([]);
  const [search, setSearch] = useState("");
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [sortKey, setSortKey] = useState<keyof Project>("projectName");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [modalOpen, setModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");

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

  function handleProjectClick(project: Project) {
    console.log("Need to navigate to new page")
    
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
                onClick={() => handleProjectClick(project)}
              >
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
