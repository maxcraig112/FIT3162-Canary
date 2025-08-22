import React from "react";
import {
  Box,
  Paper,
  IconButton,
  Menu,
  MenuItem,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
} from "@mui/material";
// Using Box + CSS grid for precise gaps and alignment
import MoreVertIcon from "@mui/icons-material/MoreVert";
import type { Project } from "../ProjectPage";
import { useDatasetTab } from "./datasetTabHandler";
import { useParams, useNavigate } from "react-router-dom";

export const DatasetTab: React.FC<{ project: Project | null }> = () => {
  const { projectID } = useParams<{ projectID: string }>();
  const navigate = useNavigate();
  const {
    batches,
    loading,
    error,
    // menu
    menuAnchorEl,
    menuBatchId,
    openMenu,
    closeMenu,
    handleFinish,
    // rename
    renameOpen,
    renameValue,
    setRenameValue,
    openRename,
    submitRename,
    renaming,
    // delete
    deleteOpen,
    openDelete,
    confirmDelete,
    deleting,
    closeRename,
    closeDelete,
  } = useDatasetTab(projectID);

  // Log batches whenever they change so you can inspect the data
  React.useEffect(() => {
    if (batches) {
      console.log("[DatasetTab] Batches state:", batches);
    }
  }, [batches]);

  return (
    <Box sx={{ width: "100%" }}>
      {error && (
        <Typography color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}
  <Box sx={{ px: "5%" }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            columnGap: "5%",
            rowGap: "35%",
          }}
        >
          {loading && batches.length === 0 && (
            <Typography>Loading batches...</Typography>
          )}
          {batches.map((b) => (
            <Box key={b.batchID} sx={{ minHeight: "10vh" }}>
        <Paper
              sx={{
          p: 4,
                textAlign: "center",
                position: "relative",
          minHeight: 220,
                cursor: "pointer",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 1,
                bgcolor: "#fff",
                color: "black",
                boxShadow: 8,
                transition:
                  "box-shadow 0.2s ease-in-out, transform 0.2s ease-in-out",
                "&:hover": {
                  boxShadow: 16,
                  transform: "translateY(-2px)",
                },
              }}
              onClick={() =>
                navigate(
                  `/annotate?batchID=${encodeURIComponent(b.batchID)}&projectID=${encodeURIComponent(projectID ?? b.projectID)}`,
                )
              }
            >
              {/* top-right menu trigger */}
              <IconButton
                sx={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  zIndex: 2,
                  color: (theme) => theme.palette.grey[700],
                }}
                size="large"
                onClick={(e) => openMenu(e, b.batchID)}
              >
                <MoreVertIcon sx={{ fontSize: 32 }} />
              </IconButton>

              {/* header counts */}
              <Typography
                variant="subtitle2"
                sx={{ position: "absolute", top: 12, left: 16 }}
              >
                {b.numberOfAnnotatedFiles}/{b.numberOfTotalFiles}
              </Typography>

              {/* centered bold name */}
              <Typography variant="h6" sx={{ fontWeight: "bold" }}>
                {b.batchName}
              </Typography>

              {/* bottom date removed */}
            </Paper>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl) && Boolean(menuBatchId)}
        onClose={closeMenu}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: {
              bgcolor: "#fff",
              color: "#000",
              border: "1px solid #e0e0e0",
              boxShadow: 8,
            },
          },
        }}
      >
        <MenuItem onClick={handleFinish}>Finish</MenuItem>
        <MenuItem onClick={openRename}>Rename</MenuItem>
        <MenuItem onClick={openDelete}>Delete</MenuItem>
      </Menu>

      {/* Rename Dialog */}
      <Dialog open={renameOpen} onClose={closeRename} fullWidth maxWidth="xs">
        <DialogTitle>Rename Batch</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="New name"
            type="text"
            fullWidth
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeRename}>Cancel</Button>
          <Button
            onClick={submitRename}
            disabled={renaming || !renameValue.trim()}
            variant="contained"
          >
            {renaming ? "Renaming..." : "Rename"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onClose={closeDelete} fullWidth maxWidth="xs">
        <DialogTitle>Delete Batch</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this batch?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDelete}>Cancel</Button>
          <Button
            onClick={confirmDelete}
            disabled={deleting}
            color="error"
            variant="contained"
          >
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
