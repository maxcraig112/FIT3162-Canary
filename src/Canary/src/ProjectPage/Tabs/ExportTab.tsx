import type { Project } from '../../ProjectsPage/ProjectsPage';
import Typography from '@mui/material/Typography';

export const ExportTab: React.FC<{ project: Project | null }> = ({ project }) => <Typography sx={{ color: '#000' }}>Annotate assets for {project?.projectName}</Typography>;
