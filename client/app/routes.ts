import { type RouteConfig, index, route, layout } from "@react-router/dev/routes";

export default [
  index("routes/landing.tsx"),
  route("signup", "routes/signup.tsx"),
  route("login", "routes/login.tsx"),
  route("auth/callback", "routes/auth-callback.tsx"),
  route("onboarding", "routes/onboarding.tsx"),
  route("help", "routes/help.tsx"),
  layout("routes/_authed.tsx", [
    route("dashboard", "routes/dashboard.tsx"),
    route("courses", "routes/courses.tsx"),
    route("courses/:courseId", "routes/course-detail.tsx"),
    route("tasks", "routes/tasks.tsx"),
    route("tasks/:taskId", "routes/task.tsx"),
    route("tasks/:taskId/result", "routes/task-result.tsx"),
    route("achievements", "routes/achievements.tsx"),
    route("settings", "routes/settings.tsx"),
  ]),
] satisfies RouteConfig;
