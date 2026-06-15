import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useSearchParams } from "react-router";
import { App } from "./App";
import "./styles.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element not found");
}

function AdminRouter() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const error = searchParams.get("error");
  const returnTo = searchParams.get("returnTo") || "/";

  if (error) {
    return <App initialAuthError={error} />;
  }

  return (
    <App
      onAuthenticated={() => {
        navigate(returnTo.startsWith("/") ? returnTo : "/", { replace: true });
      }}
    />
  );
}

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/auth/callback" element={<AdminRouter />} />
        <Route path="/" element={<App />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
