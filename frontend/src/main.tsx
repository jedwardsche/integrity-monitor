import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AuthGuard } from "./components/AuthGuard";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { SchemaPage } from "./pages/SchemaPage";
import { RunStatusPage } from "./pages/RunStatusPage";
import { ReportsPage } from "./pages/ReportsPage";
import { RunsPage } from "./pages/RunsPage";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <AuthGuard>
                <App>
                  <DashboardPage />
                </App>
              </AuthGuard>
            }
          />
          <Route
            path="/runs"
            element={
              <AuthGuard>
                <App>
                  <RunsPage />
                </App>
              </AuthGuard>
            }
          />
          <Route
            path="/schema"
            element={
              <AuthGuard>
                <App>
                  <SchemaPage />
                </App>
              </AuthGuard>
            }
          />
          <Route
            path="/run/:runId"
            element={
              <AuthGuard>
                <App>
                  <RunStatusPage />
                </App>
              </AuthGuard>
            }
          />
          <Route
            path="/reports"
            element={
              <AuthGuard>
                <App>
                  <ReportsPage />
                </App>
              </AuthGuard>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>
);
