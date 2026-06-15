import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";
import { BrandLogo } from "./components/Mascot";
import { AppProviders } from "./lib/providers";

export const links: Route.LinksFunction = () => [
  { rel: "icon", type: "image/svg+xml", href: "/brand/favicon.svg" },
  { rel: "apple-touch-icon", href: "/brand/app-icon.svg" },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Nunito:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <meta name="application-name" content="Storyteller" />
        <meta name="theme-color" content="#FBF5E9" />
        <Meta />
        <Links />
      </head>
      <body
        data-theme="light"
        data-theme-preference="auto"
        data-palette="default"
        data-density="default"
        data-text-size="md"
        data-reduce-motion="false"
      >
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <AppProviders>
      <Outlet />
    </AppProviders>
  );
}

export function HydrateFallback() {
  return (
    <main
      className="fullbleed-shell hydrate-fallback"
      aria-labelledby="hydrate-fallback-title"
      aria-busy="true"
    >
      <div className="hydrate-fallback-panel">
        <BrandLogo width={176} />
        <div className="hydrate-fallback-status">
          <span className="spinner" aria-hidden="true" />
          <p id="hydrate-fallback-title">Loading Storyteller...</p>
        </div>
        <p className="sr">The app is loading.</p>
        <div className="hydrate-fallback-skeleton" aria-hidden="true">
          <div className="skeleton hydrate-fallback-skeleton-title" />
          <div className="skeleton hydrate-fallback-skeleton-line" />
          <div className="skeleton hydrate-fallback-skeleton-line short" />
        </div>
      </div>
    </main>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main
      className="fullbleed-shell"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        className="card"
        style={{ maxWidth: 520, width: "100%", textAlign: "center" }}
      >
        <h1 style={{ fontSize: 56, marginBottom: 8 }}>{message}</h1>
        <p style={{ color: "var(--ink-3)", marginBottom: 16 }}>{details}</p>
        {stack && (
          <pre
            style={{
              textAlign: "left",
              background: "var(--paper-2)",
              borderRadius: 12,
              padding: 14,
              fontSize: 12,
              overflowX: "auto",
            }}
          >
            <code>{stack}</code>
          </pre>
        )}
      </div>
    </main>
  );
}
