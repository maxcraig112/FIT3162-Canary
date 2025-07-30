import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./LoginPage/LoginPage";
import HomePage from "./HomePage/HomePage";
// import ProjectsPage from './ProjectsPage/ProjectsPage'; // Placeholder for future

const AppRouter: React.FC = () => {
  // Simple auth check (replace with real logic as needed)
  const isLoggedIn = !!document.cookie.match(/token=/);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/home"
        element={isLoggedIn ? <HomePage /> : <Navigate to="/login" replace />}
      />
      {/* <Route path="/projects" element={<ProjectsPage />} /> */}
      <Route
        path="*"
        element={<Navigate to={isLoggedIn ? "/home" : "/login"} replace />}
      />
    </Routes>
  );
};

export default AppRouter;
