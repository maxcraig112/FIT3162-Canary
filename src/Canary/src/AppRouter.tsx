import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './LoginPage/LoginPage';
import HomePage from './HomePage/HomePage';
import ProjectPage from './ProjectPage/ProjectPage';
import ProjectsPage from './ProjectsPage/ProjectsPage';
import AnnotatePage from './AnnotatePage/AnnotatePage';

const AppRouter: React.FC = () => (
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/home" element={<HomePage />} />
    <Route path="/projects" element={<ProjectsPage />} />
    <Route path="/projects/:projectID" element={<ProjectPage />} />
    <Route path="/annotate" element={<AnnotatePage />} />
    <Route path="*" element={<Navigate to="/home" replace />} />
  </Routes>
);

export default AppRouter;
