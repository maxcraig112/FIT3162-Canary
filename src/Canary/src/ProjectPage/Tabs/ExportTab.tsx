import React, { useMemo, useState } from 'react';
import { Box, Stack, FormControl, InputLabel, Select, MenuItem, Button, Alert, Typography } from '@mui/material';
import type { Project } from '../ProjectPage';
import { getAuthTokenFromCookie } from '../../utils/cookieUtils';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

type ExportFormat = 'coco' | 'pascal-voc';

export const ExportTab: React.FC<{ project: Project | null }> = ({ project }) => {
  const [format, setFormat] = useState<ExportFormat | ''>(''); // start empty
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const baseUrl = useMemo(() => import.meta.env.VITE_PROJECT_SERVICE_URL as string, []);

  function inferFilename(res: Response, fallbackBase: string): string {
    const cd = res.headers.get('content-disposition') || '';
    const m = cd.match(/filename="?([^"]+)"?/i);
    if (m?.[1]) return m[1];

    const ct = (res.headers.get('content-type') || '').toLowerCase();
    const ext =
      ct.includes('application/zip') ? '.zip' :
      ct.includes('application/json') ? '.json' :
      ct.includes('text/xml') ? '.xml' :
      '.bin';
    return `${fallbackBase}${ext}`;
  }

  async function handleExport() {
    setError(null);
    setMessage(null);
    if (!project?.projectID) {
      setError('No project selected.');
      return;
    }
    if (!format) {
      setError('Please select an export format.');
      return;
    }

    setExporting(true);
    try {
      const url = `${baseUrl}/project/${encodeURIComponent(project.projectID)}/keypoints/export/${format}`;
      const token = getAuthTokenFromCookie();

      const res = await fetch(url, {
        method: 'GET',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `Export failed with status ${res.status}`);
      }

      const blob = await res.blob();
      const nameBase = `${project.projectName || 'project'}_${format}_keypoints`;
      const filename = inferFilename(res, nameBase);

      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);

      setMessage(`Export started: ${filename}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to export.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <Box
      sx={{
        width: '100%',
        flexGrow: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        py: 4,
      }}
    >
      <Stack spacing={3} sx={{ width: '100%', maxWidth: 520, alignItems: 'center' }}>
        <Typography
          variant="h5"
          sx={{ mt: -2, mb: 6, fontWeight: 600, color: '#111', textAlign: 'center' }}
        >
          Export all finished annotations
        </Typography>

        <FormControl size="small" sx={{ minWidth: 260 }}>
          {/* No floating label; gray placeholder + black down arrow */}
          <Select
            value={format}
            onChange={(e) => setFormat(e.target.value as ExportFormat | '')}
            displayEmpty
            renderValue={(selected) =>
              selected ? (
                String(selected).toUpperCase()
              ) : (
                <Typography sx={{ color: '#777' }}>Select format…</Typography>
              )
            }
            IconComponent={ExpandMoreIcon}
            sx={{
              '& .MuiSelect-select': {
                color: format ? '#000' : '#777',
                bgcolor: '#fff',
                borderRadius: 2,
              },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: '#000' },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#000' },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000' },
              '& .MuiSelect-icon': { color: '#000' }, // make arrow visible/black
              minWidth: 260,
            }}
          >
            <MenuItem value="">
              <Typography sx={{ color: '#777' }}>Select format…</Typography>
            </MenuItem>
            <MenuItem value="coco">COCO</MenuItem>
            <MenuItem value="pascal-voc">PASCAL VOC</MenuItem>
          </Select>
        </FormControl>

        <Button
          variant="outlined"
          disabled={!project || exporting || !format}
          onClick={handleExport}
          sx={{
            fontWeight: 600,
            textTransform: 'none',
            px: 4,
            py: 1.2,
            borderRadius: 3,
            borderStyle: 'solid',
            backgroundColor: '#f5f5f5',
            borderColor: '#999',
            color: '#222',
            '&:hover': { backgroundColor: '#ececec', borderColor: '#666' },
            minWidth: 260,
            '&.Mui-disabled': {
              opacity: 1,
              color: '#888',
              borderColor: '#bbb',
              backgroundColor: '#f0f0f0',
              cursor: 'not-allowed',
            },
          }}
        >
          {exporting ? 'Exporting...' : 'Export'}
        </Button>

        {message && (
          <Alert severity="success" onClose={() => setMessage(null)} sx={{ borderRadius: 2, width: '100%', maxWidth: 520 }}>
            {message}
          </Alert>
        )}
        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ borderRadius: 2, width: '100%', maxWidth: 520 }}>
            {error}
          </Alert>
        )}
      </Stack>
    </Box>
  );
};