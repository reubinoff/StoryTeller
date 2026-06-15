import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router";
import { z } from "zod";
import { AuthFrame, AuthSide } from "~/components/AuthFrame";
import { IconGoogle } from "~/components/Icons";
import { ApiError } from "~/lib/api/client";
import { useAuth } from "~/lib/auth";
import { postAuthDestination, safeReturnTo } from "~/lib/auth-routing";

const LoginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(1, "Required"),
});

type LoginValues = z.infer<typeof LoginSchema>;

export function meta() {
  return [{ title: "Log in · Storyteller" }];
}

export default function LoginRoute() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user, ready, signin, signinGoogle } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const returnTo = safeReturnTo(params.get("returnTo"));

  useEffect(() => {
    if (ready && user) {
      navigate(postAuthDestination(user, returnTo), { replace: true });
    }
  }, [ready, user, returnTo, navigate]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(LoginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      const signedIn = await signin(values.email, values.password);
      navigate(postAuthDestination(signedIn, returnTo));
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.problem.detail || e.problem.title
          : "Invalid email or password";
      setSubmitError(msg);
    }
  });

  const onGoogle = () => {
    setSubmitError(null);
    void signinGoogle(returnTo, "login").catch(() => {
      setSubmitError("Couldn't sign in with Google");
    });
  };

  return (
    <AuthFrame
      side={
        <AuthSide
          title="Welcome back."
          subtitle="Pick up your latest story practice and keep your streak moving."
          pose="read"
        />
      }
    >
      <h2 style={{ marginBottom: 6 }}>Log in</h2>
      <p style={{ color: "var(--ink-3)", fontSize: 14, marginBottom: 24 }}>
        Welcome back, friend.
      </p>
      <button
        type="button"
        className="btn btn-soft btn-block btn-lg"
        onClick={onGoogle}
      >
        <IconGoogle size={18} /> Continue with Google
      </button>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          margin: "18px 0",
          color: "var(--ink-4)",
          fontSize: 12,
        }}
      >
        <div style={{ flex: 1, height: 1, background: "var(--line)" }} /> OR{" "}
        <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
      </div>
      <form onSubmit={onSubmit} className="col gap-16" noValidate>
        <div>
          <label className="field-label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className="field-input"
            {...register("email")}
          />
          {errors.email && (
            <div className="field-error">{errors.email.message}</div>
          )}
        </div>
        <div>
          <label className="field-label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            className="field-input"
            {...register("password")}
          />
          <div style={{ textAlign: "right", marginTop: 6 }}>
            <a style={{ fontSize: 12, color: "var(--rust)", cursor: "pointer" }}>
              Forgot password?
            </a>
          </div>
          {errors.password && (
            <div className="field-error">{errors.password.message}</div>
          )}
        </div>
        {submitError && <div className="field-error">{submitError}</div>}
        <button
          type="submit"
          className="btn btn-accent btn-block btn-lg"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <span className="row gap-8">
              <span className="spinner" /> Signing in…
            </span>
          ) : (
            "Log in"
          )}
        </button>
        <div style={{ fontSize: 13, color: "var(--ink-3)", textAlign: "center" }}>
          New here?{" "}
          <Link
            to="/signup"
            style={{ color: "var(--rust)", fontWeight: 600 }}
          >
            Create an account
          </Link>
        </div>
      </form>
    </AuthFrame>
  );
}
