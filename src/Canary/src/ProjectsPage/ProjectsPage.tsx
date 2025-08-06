import React, { useEffect, useState } from "react";
import { Box, Typography, Toolbar, AppBar, Button, TextField, Paper, IconButton, InputAdornment } from "@mui/material";
import Grid from "@mui/material/Grid";
import SearchIcon from "@mui/icons-material/Search";
import SortIcon from "@mui/icons-material/Sort";
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
  const [sortKey] = useState<keyof Project>("projectName");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

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

  function handleSortClick() {
    // Example: toggle sort direction
    setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
  }

  function handleNewProject() {
    projectHandler.handleNewProject(() => {
      // TODO: Show modal or navigate to new project creation
      alert("New Project logic here");
    });
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
            sx={{ width: 300, mr: 2 }}
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
          <Button startIcon={<SortIcon />} variant="outlined" onClick={handleSortClick}>
            Sort By
          </Button>
        </Box>
        <Grid container spacing={3} justifyContent="center">
          {filteredProjects.map((project) => (
            <Grid sx={{ minHeight: "10vh", minWidth: "15vw" }}>
              <Paper elevation={3} sx={{ p: 3, textAlign: "center", position: "relative", minHeight: 180 }}>
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
    </Box>
  );
};

export default ProjectsPage;
