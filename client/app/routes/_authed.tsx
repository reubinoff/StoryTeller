import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";
import { Shell } from "~/components/Shell";
import { useAuth } from "~/lib/auth";

export default function AuthedLayout() {
  const { user, ready } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      const returnTo = encodeURIComponent(location.pathname + location.search);
      navigate(`/login?returnTo=${returnTo}`, { replace: true });
      return;
    }
    if (!user.onboarding_completed) {
      navigate("/onboarding", { replace: true });
    }
  }, [ready, user, location.pathname, location.search, navigate]);

  if (!ready || !user || !user.onboarding_completed) {
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
