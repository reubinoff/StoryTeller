import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { BrandMark } from "~/components/Mascot";
import { useAuth } from "~/lib/auth";
import { postAuthDestination, safeReturnTo } from "~/lib/auth-routing";

export function meta() {
  return [{ title: "Signing in · StoryTeller" }];
}

export default function AuthCallbackRoute() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user, ready, refreshSession } = useAuth();
  const [message, setMessage] = useState("Finishing sign-in…");
  const returnTo = safeReturnTo(params.get("returnTo"));
  const error = params.get("error");

  useEffect(() => {
    let cancelled = false;

    const complete = async () => {
      if (error) {
        setMessage("Google sign-in could not be completed.");
        return;
      }
      if (ready && user) {
        navigate(postAuthDestination(user, returnTo), { replace: true });
        return;
      }
      const refreshed = await refreshSession();
      if (cancelled) return;
      if (refreshed) {
        navigate(postAuthDestination(refreshed, returnTo), { replace: true });
      } else {
        setMessage("Your sign-in session expired. Please try again.");
      }
    };

    void complete();
    return () => {
      cancelled = true;
    };
  }, [error, ready, user, returnTo, refreshSession, navigate]);

  return (
    <main
      className="fullbleed-shell"
      style={{ display: "grid", minHeight: "100vh", placeItems: "center", padding: 24 }}
    >
      <div className="card" style={{ maxWidth: 420, width: "100%", textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <BrandMark size={42} color="var(--ink)" />
        </div>
        <h1 style={{ fontSize: 32, marginBottom: 8 }}>StoryTeller</h1>
        <p style={{ color: "var(--ink-3)", marginBottom: error ? 18 : 0 }}>
          {message}
        </p>
        {!error && message.includes("Finishing") && (
          <div className="row gap-8" style={{ justifyContent: "center", marginTop: 18 }}>
            <span className="spinner" /> Please wait
          </div>
        )}
        {error && (
          <Link to="/login" className="btn btn-accent">
            Back to login
          </Link>
        )}
      </div>
    </main>
  );
}
