import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router";
import { z } from "zod";
import { AuthFrame, AuthSide } from "~/components/AuthFrame";
import { IconEye, IconGoogle } from "~/components/Icons";
import { useToast } from "~/components/Toast";
import { useAuth } from "~/lib/auth";
import { ApiError } from "~/lib/api/client";
import { postAuthDestination, safeReturnTo } from "~/lib/auth-routing";

const CURRENT_YEAR = new Date().getFullYear();

const SignupSchema = z.object({
  first_name: z
    .string()
    .min(1, "First name is required")
    .max(40, "Keep it under 40 characters"),
  last_name: z
    .string()
    .min(1, "Last name is required")
    .max(40, "Keep it under 40 characters"),
  email: z.string().email("Please enter a valid email"),
  password: z
    .string()
    .min(8, "Min 8 characters")
    .regex(/[A-Za-z]/, "Include at least one letter")
    .regex(/\d/, "Include at least one number"),
  year_of_birth: z
    .string()
    .min(1, "Year of birth is required")
    .refine((v) => /^\d{4}$/.test(v), "Must be a 4-digit year")
    .transform((v) => Number(v))
    .refine(
      (n) => n >= CURRENT_YEAR - 100,
      `Earliest accepted: ${CURRENT_YEAR - 100}`
    )
    .refine(
      (n) => n <= CURRENT_YEAR - 5,
      `Latest accepted: ${CURRENT_YEAR - 5}`
    ),
});

type SignupInput = z.input<typeof SignupSchema>;
type SignupOutput = z.output<typeof SignupSchema>;

export function meta() {
  return [{ title: "Sign up · StoryTeller" }];
}

export default function SignupRoute() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user, ready, signup, signinGoogle } = useAuth();
  const { push } = useToast();
  const [showPw, setShowPw] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
  } = useForm<SignupInput, unknown, SignupOutput>({
    resolver: zodResolver(SignupSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      password: "",
      year_of_birth: "",
    },
  });

  const password = watch("password") ?? "";
  const pwStrength = (() => {
    let s = 0;
    if (password.length >= 8) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/\d/.test(password)) s++;
    if (/[^a-zA-Z0-9]/.test(password)) s++;
    return s;
  })();
  const pwLabel = ["Weak", "Weak", "Okay", "Good", "Strong"][pwStrength];

  const returnTo = safeReturnTo(params.get("returnTo"));

  useEffect(() => {
    if (ready && user) {
      navigate(postAuthDestination(user, returnTo), { replace: true });
    }
  }, [ready, user, returnTo, navigate]);

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await signup(values);
      navigate("/onboarding");
    } catch (e) {
      const msg =
        e instanceof ApiError ? e.problem.detail || e.problem.title : "Couldn't create account";
      setSubmitError(msg);
    }
  });

  const onGoogle = async () => {
    try {
      const signedIn = await signinGoogle(returnTo, "signup");
      push({ icon: "🎉", title: "Welcome!" });
      navigate(postAuthDestination(signedIn, returnTo));
    } catch {
      setSubmitError("Couldn't sign in with Google");
    }
  };

  return (
    <AuthFrame
      side={
        <AuthSide
          title="Begin your quest."
          subtitle="Free forever for individual learners. No credit card needed."
          pose="wave"
        />
      }
    >
      <h2 style={{ marginBottom: 6 }}>Create your account</h2>
      <p style={{ color: "var(--ink-3)", fontSize: 14, marginBottom: 24 }}>
        It takes about 30 seconds.
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
        <div className="row gap-12">
          <div style={{ flex: 1 }}>
            <label className="field-label" htmlFor="fn">
              First name
            </label>
            <input
              id="fn"
              className="field-input"
              placeholder="Maya"
              {...register("first_name")}
            />
            {errors.first_name && (
              <div className="field-error">{errors.first_name.message}</div>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <label className="field-label" htmlFor="ln">
              Last name
            </label>
            <input
              id="ln"
              className="field-input"
              placeholder="Patel"
              {...register("last_name")}
            />
            {errors.last_name && (
              <div className="field-error">{errors.last_name.message}</div>
            )}
          </div>
        </div>

        <div>
          <label className="field-label" htmlFor="em">
            Email
          </label>
          <input
            id="em"
            type="email"
            autoComplete="email"
            className="field-input"
            placeholder="you@example.com"
            {...register("email")}
          />
          {errors.email && (
            <div className="field-error">{errors.email.message}</div>
          )}
        </div>

        <div>
          <label className="field-label" htmlFor="pw">
            Password
          </label>
          <div style={{ position: "relative" }}>
            <input
              id="pw"
              type={showPw ? "text" : "password"}
              autoComplete="new-password"
              className="field-input"
              placeholder="Min 8 characters, 1 number"
              style={{ paddingRight: 42 }}
              {...register("password")}
            />
            <button
              type="button"
              className="icon-btn"
              style={{
                position: "absolute",
                right: 4,
                top: "50%",
                transform: "translateY(-50%)",
              }}
              onClick={() => setShowPw((s) => !s)}
              aria-label="Toggle password visibility"
            >
              <IconEye size={18} />
            </button>
          </div>
          {password && (
            <div className="row gap-4" style={{ marginTop: 8 }}>
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: 4,
                    borderRadius: 2,
                    background:
                      i <= pwStrength
                        ? pwStrength <= 1
                          ? "var(--bad)"
                          : pwStrength <= 2
                          ? "var(--warn)"
                          : "var(--good)"
                        : "var(--line)",
                  }}
                />
              ))}
              <span
                style={{
                  fontSize: 11,
                  color: "var(--ink-3)",
                  marginLeft: 8,
                }}
              >
                {pwLabel}
              </span>
            </div>
          )}
          {errors.password && (
            <div className="field-error">{errors.password.message}</div>
          )}
        </div>

        <div>
          <label className="field-label" htmlFor="yob">
            Year of birth
          </label>
          <input
            id="yob"
            type="number"
            min={CURRENT_YEAR - 100}
            max={CURRENT_YEAR - 5}
            className="field-input"
            placeholder={String(CURRENT_YEAR - 12)}
            {...register("year_of_birth")}
          />
          <div className="field-help">
            We use this to choose age-appropriate content.
          </div>
          {errors.year_of_birth && (
            <div className="field-error">{errors.year_of_birth.message}</div>
          )}
        </div>

        {submitError && <div className="field-error">{submitError}</div>}

        <button
          className="btn btn-accent btn-block btn-lg"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <span className="row gap-8">
              <span className="spinner" /> Creating…
            </span>
          ) : (
            "Create account"
          )}
        </button>
        <div
          style={{
            fontSize: 13,
            color: "var(--ink-3)",
            textAlign: "center",
          }}
        >
          Already have an account?{" "}
          <Link
            to="/login"
            style={{ color: "var(--rust)", fontWeight: 600 }}
          >
            Log in
          </Link>
        </div>
      </form>
    </AuthFrame>
  );
}
