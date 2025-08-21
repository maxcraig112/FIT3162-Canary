import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import { createTheme, Paper, ThemeProvider, styled } from "@mui/material";
export const SettingsTab: React.FC = () => (
  <Box
    sx={{
      width: "100%",
      display: "flex",
      justifyContent: "space-between",
      gap: 4,
    }}
  >
    {/* Column 1 */}
    <Box sx={{ flex: 1 }}>
      <Typography variant="h4" sx={{ color: "#000", textAlign: "center" }}>
        Sessions
      </Typography>
      <br />
      <Box sx={{ display: "flex", justifyContent: "center" }}>
        <Typography variant="body3" sx={{ color: "#000", textAlign: "center" }}>
          Sessions allow you to cross-collaborate with multiple users on the
          same project, allowing them to upload, annotate and export images.
        </Typography>
      </Box>
      <br />
      <br />
      <Box sx={{ display: "flex", justifyContent: "center" }}>
        <Typography variant="body3" sx={{ color: "#000", textAlign: "center" }}>
          To enable sessions, tick the checkbox below, and enter a unique
          session code. This will be used by users to join your project.
        </Typography>
      </Box>
      <br />
      <Typography variant="body1" sx={{ color: "#000", textAlign: "center" }}>
        DO NOT SHARE THIS CODE WITH ANYONE YOU DO NOT TRUST.
      </Typography>
      <br />
      <Box sx={{ display: "flex", justifyContent: "center", color: "#000" }}>
        <FormControlLabel
          control={<Checkbox defaultChecked />}
          label="Enable Sessions"
        />
      </Box>
      <br />
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          paddingInline: 2,
          gap: 2,
        }}
      >
        <TextField
          label="Session Code"
          variant="outlined"
          color="primary"
          focused
          InputProps={{ style: { color: "#000" } }}
        />
        <Button variant="contained">Save</Button>
      </Box>
    </Box>
    {/* Column 2 */}
    <Box sx={{ flex: 1 }}>
      <Typography variant="h4" sx={{ color: "#000", textAlign: "center" }}>
        Configure KeyPoints
      </Typography>
      <br />
      <Box sx={{ display: "flex", justifyContent: "center" }}>
        <Typography variant="body3" sx={{ color: "#000", textAlign: "center" }}>
          All tags used for the annotation of KeyPoints can be
          configured here. Warning, deleting a tag that is currently in use will
          remove it from all annotations.
        </Typography>
      </Box>
    </Box>
    {/* Column 3 */}
    <Box sx={{ flex: 1 }}>
      <Typography variant="h4" sx={{ color: "#000", textAlign: "center" }}>
        Configure BoundingBox
      </Typography>
      <br />
      <Box sx={{ display: "flex", justifyContent: "center" }}>
        <Typography variant="body3" sx={{ color: "#000", textAlign: "center" }}>
          All tags used for the annotation of BoundingBoxes can be
          configured here. Warning, deleting a tag that is currently in use will
          remove it from all annotations.
        </Typography>
      </Box>
    </Box>
  </Box>
);
