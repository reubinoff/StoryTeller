import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router";
import { z } from "zod";
import { AuthFrame, AuthSide } from "~/components/AuthFrame";
import { IconGoogle } from "~/components/Icons";
import { ApiError } from "~/lib/api/client";
import { useAuth } from "~/lib/auth";

const LoginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(1, "Required"),
});

type LoginValues = z.infer<typeof LoginSchema>;

export function meta() {
  return [{ title: "Log in · StoryTeller" }];
}

export default function LoginRoute() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { signin, signinGoogle } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const returnTo = params.get("returnTo") || "/dashboard";

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(LoginSchema),
    defaultValues: { email: "maya@example.com", password: "demo1234" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await signin(values.email, values.password);
      navigate(returnTo);
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.problem.detail || e.problem.title
          : "Invalid email or password";
      setSubmitError(msg);
    }
  });

  const onGoogle = async () => {
    try {
      await signinGoogle();
      navigate(returnTo);
    } catch {
      setSubmitError("Couldn't sign in with Google");
    }
  };

  return (
    <AuthFrame
      side={
        <AuthSide
          title="Welcome back."
          subtitle="Pick up where you left off — your streak is waiting."
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
