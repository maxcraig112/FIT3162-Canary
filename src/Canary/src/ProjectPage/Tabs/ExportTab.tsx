import React, { useState } from 'react';
import { Box, Stack, FormControl, Select, MenuItem, Button, Alert, Typography } from '@mui/material';
import { getAuthTokenFromCookie } from '../../utils/cookieUtils';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import type { Project } from '../../utils/interfaces/interfaces';
import { projectServiceUrl } from '../../utils/apis';
import { useAuthGuard } from '../../utils/authUtil';

type ExportFormat = 'coco' | 'pascal-voc';
type AnnotationType = 'bbox' | 'keypoint';

const formatLabels: Record<ExportFormat, string> = {
  coco: 'COCO',
  'pascal-voc': 'Pascal VOC',
};

export const ExportTab: React.FC<{ project: Project | null }> = ({ project }) => {
  useAuthGuard();
  /* ---------- state ---------- */
  const [format, setFormat] = useState<ExportFormat | ''>('');
  const [annotationType, setAnnotationType] = useState<AnnotationType | ''>('');
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  /* ---------- helpers ---------- */
  const pascal_voc_disabled = annotationType === 'keypoint';

  /* ---------- export ---------- */
  function inferFilename(res: Response, fallbackBase: string): string {
    const cd = res.headers.get('content-disposition') || '';
    const m = cd.match(/filename="?([^"]+)"?/i);
    if (m?.[1]) return m[1];

    const ct = (res.headers.get('content-type') || '').toLowerCase();
    const ext = ct.includes('application/zip') ? '.zip' : ct.includes('application/json') ? '.json' : ct.includes('text/xml') ? '.xml' : '.bin';
    return `${fallbackBase}${ext}`;
  }

  async function handleExport() {
    setError(null);
    setMessage(null);

    if (!project?.projectID) return setError('No project selected.');
    if (!format) return setError('Please select an export format.');
    if (!annotationType) return setError('Please select an annotation type.');

    setExporting(true);
    try {
      let url;
      if (format === 'pascal-voc' && annotationType === 'bbox') {
        url = `${projectServiceUrl()}/project/${encodeURIComponent(project.projectID)}/boundingboxes/export/pascal_voc`;
      } else if (format === 'coco' && annotationType === 'bbox') {
        url = `${projectServiceUrl()}/project/${encodeURIComponent(project.projectID)}/boundingboxes/export/coco`;
      } else if (format === 'coco' && annotationType === 'keypoint') {
        url = `${projectServiceUrl()}/project/${encodeURIComponent(project.projectID)}/keypoints/export/coco`;
      }
      if (!url) {
        throw new Error('Invalid format or annotation type.');
      }
      // <-- type query-param
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
      const nameBase = `${project.projectName || 'project'}_${format}_${annotationType}`;
      const filename = inferFilename(res, nameBase);

      const href = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), {
        href,
        download: filename,
      });
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

  /* ---------- render ---------- */
  const selectSx = {
    color: "#000",
    '& .MuiSelect-select': {
      color: '#000',
      bgcolor: '#fff',
      borderRadius: 2,
    },
    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#000' },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#000' },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000' },
    '& .MuiSelect-icon': { color: '#000' },
    minWidth: 260,
  };

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
        <Typography variant="h5" sx={{ mt: -2, mb: 6, fontWeight: 600, color: '#111', textAlign: 'center' }}>
          Export all finished annotations
        </Typography>

        {/* Annotation-type selector */}
        <FormControl size="small">
          <Select
            value={annotationType}
            onChange={(e) => {
              const t = e.target.value as AnnotationType | '';
              setAnnotationType(t);
              setFormat('');
            }}
            displayEmpty
            renderValue={(s) => (s ? s.replace('bbox', 'Bounding box').replace('keypoint', 'Keypoint') : <Typography sx={{ color: '#777' }}>Select annotation type…</Typography>)}
            IconComponent={ExpandMoreIcon}
            sx={selectSx}
          >
            <MenuItem
              value="keypoint"
              sx={{
                color: '#000',
                '&:hover': { bgcolor: '#e5e7eb' },
                '&.Mui-selected': { bgcolor: '#fff !important', color: '#000 !important' },
                '&.Mui-selected:hover': { bgcolor: '#e5e7eb !important' },
              }}
            >
              Keypoint
            </MenuItem>
            <MenuItem
              value="bbox"
              sx={{
                color: '#000',
                '&:hover': { bgcolor: '#e5e7eb' },
                '&.Mui-selected': { bgcolor: '#fff !important', color: '#000 !important' },
                '&.Mui-selected:hover': { bgcolor: '#e5e7eb !important' },
              }}
            >
              Bounding Box
            </MenuItem>
          </Select>
        </FormControl>

        {/* Format selector (shown once an annotation type is chosen) */}
        {annotationType && (
          <FormControl size="small">
            <Select
              value={format}
              onChange={(e) => {
                const f = e.target.value as ExportFormat | '';
                setFormat(f);
                if (f === 'pascal-voc' && annotationType === 'keypoint') {
                  setAnnotationType('');
                }
              }}
              displayEmpty
              renderValue={(s) => (s ? formatLabels[s as ExportFormat] : <Typography sx={{ color: '#777' }}>Select format…</Typography>)}
              IconComponent={ExpandMoreIcon}
              sx={selectSx}
            >
              <MenuItem
                value="coco"
                sx={{
                  color: '#000',
                  '&:hover': { bgcolor: '#e5e7eb' },
                  '&.Mui-selected': { bgcolor: '#fff !important', color: '#000 !important' },
                  '&.Mui-selected:hover': { bgcolor: '#e5e7eb !important' },
                }}
              >
                {formatLabels.coco}
              </MenuItem>
              <MenuItem
                value="pascal-voc"
                disabled={pascal_voc_disabled}
                sx={{
                  color: pascal_voc_disabled ? '#aaa !important' : '#000',
                  pointerEvents: pascal_voc_disabled ? 'none' : 'auto',
                  '&:hover': { bgcolor: pascal_voc_disabled ? 'inherit' : '#e5e7eb' },
                  '&.Mui-selected': { bgcolor: '#fff !important', color: '#000 !important' },
                  '&.Mui-selected:hover': { bgcolor: '#e5e7eb !important' },
                }}
              >
                {formatLabels['pascal-voc']}
              </MenuItem>
            </Select>
          </FormControl>
        )}

        {/* Export button */}
        <Button
          variant="outlined"
          disabled={!project || exporting || !format || !annotationType}
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

        {/* Feedback */}
        {message && (
          <Alert severity="success" onClose={() => setMessage(null)} sx={{ borderRadius: 2, width: '100%' }}>
            {message}
          </Alert>
        )}
        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ borderRadius: 2, width: '100%' }}>
            {error}
          </Alert>
        )}
      </Stack>
    </Box>
  );
};
