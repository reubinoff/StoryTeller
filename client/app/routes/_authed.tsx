import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";
import { Shell } from "~/components/Shell";
import { useToast } from "~/components/Toast";
import { useAuth } from "~/lib/auth";

export default function AuthedLayout() {
  const { user, ready } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { push } = useToast();

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      const returnTo = encodeURIComponent(location.pathname + location.search);
      navigate(`/login?returnTo=${returnTo}`, { replace: true });
    }
  }, [ready, user, location.pathname, location.search, navigate]);

  // Subscribe to writing-task completion events from the mock backend
  // and surface them as toasts (PRD §7.3).
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ task_id: string; title: string; score: number }>)
        .detail;
      if (!detail) return;
      push({
        icon: "✨",
        title: "Your writing task is ready!",
        body: `${detail.title} — Quill scored it ${detail.score}.`,
        action: "View result",
        onAction: () => navigate(`/tasks/${detail.task_id}/result`),
      });
    };
    window.addEventListener("lq:task-completed", handler);
    return () => window.removeEventListener("lq:task-completed", handler);
  }, [push, navigate]);

  if (!ready || !user) {
    return (
      <div className="fullbleed-shell" style={{ display: "grid", placeItems: "center" }}>
        <div className="row gap-8" style={{ color: "var(--ink-3)", fontSize: 14 }}>
          <span className="spinner" /> Loading…
        </div>
      </div>
    );
  }

  return (
    <Shell>
      <Outlet />
    </Shell>
  );
}
