/**
 * Strongly-typed wrappers around the API client. UI code should ALWAYS go
 * through these helpers (never call `request` directly), so the surface stays
 * consistent and easy to swap out when the real backend ships.
 */

import { apiUrl, request } from "./client";
import type {
  Achievement,
  AnswerQuestionRequest,
  AuthResponse,
  AuthTokens,
  CompleteOnboardingRequest,
  Course,
  CourseId,
  DashboardResponse,
  Interest,
  InterestId,
  LoginRequest,
  Notification,
  Page,
  RollTaskRequest,
  SignupRequest,
  SubmitTaskRequest,
  Task,
  TaskResult,
  TaskStatus,
  UpdateUserRequest,
  User,
} from "./types";

export const api = {
  auth: {
    signup: (body: SignupRequest) =>
      request<AuthResponse>("/auth/signup", { method: "POST", body, noAuth: true }),
    login: (body: LoginRequest) =>
      request<AuthResponse>("/auth/login", { method: "POST", body, noAuth: true }),
    google: () =>
      request<AuthResponse>("/auth/google/exchange", {
        method: "POST",
        body: { code: "demo" },
        noAuth: true,
      }),
    googleStartUrl: (returnTo: string, intent: "login" | "signup") =>
      apiUrl("/auth/google/start", { return_to: returnTo, intent }),
    refresh: () =>
      request<AuthTokens>("/auth/refresh", { method: "POST", noAuth: true }),
    logout: () => request<null>("/auth/logout", { method: "POST" }),
  },
  me: {
    get: () => request<User>("/me"),
    patch: (body: UpdateUserRequest) =>
      request<User>("/me", { method: "PATCH", body }),
    setInterests: (interest_ids: InterestId[]) =>
      request<{ interests: InterestId[] }>("/me/interests", {
        method: "PUT",
        body: { interest_ids },
      }),
    completeOnboarding: (body: CompleteOnboardingRequest) =>
      request<User>("/me/onboarding", { method: "PUT", body }),
    dashboard: () => request<DashboardResponse>("/me/dashboard"),
    achievements: () => request<Achievement[]>("/me/achievements"),
    notifications: () => request<Page<Notification>>("/me/notifications"),
    notificationsReadAll: () =>
      request<null>("/me/notifications/read-all", { method: "POST" }),
  },
  catalog: {
    interests: () => request<Interest[]>("/interests"),
    courses: () => request<Course[]>("/courses"),
    course: (id: CourseId) => request<Course>(`/courses/${id}`),
  },
  tasks: {
    list: (status?: TaskStatus) =>
      request<Page<Task>>("/tasks", { query: status ? { status } : undefined }),
    get: (id: string) => request<Task>(`/tasks/${id}`),
    roll: (courseId: CourseId, body: RollTaskRequest = {}) =>
      request<Task>(`/courses/${courseId}/tasks`, { method: "POST", body }),
    start: (id: string) =>
      request<Task>(`/tasks/${id}/start`, { method: "PATCH" }),
    answer: (id: string, body: AnswerQuestionRequest) =>
      request<{ accepted: true }>(`/tasks/${id}/answer`, {
        method: "POST",
        body,
      }),
    submit: (id: string, body: SubmitTaskRequest) =>
      request<Task>(`/tasks/${id}/submit`, { method: "POST", body }),
    saveDraft: (id: string, text: string) =>
      request<{ saved_at: string }>(`/tasks/${id}/draft`, {
        method: "POST",
        body: { text },
      }),
    retry: (id: string) =>
      request<Task>(`/tasks/${id}/retry`, { method: "POST" }),
    redo: (id: string) =>
      request<Task>(`/tasks/${id}/redo`, { method: "POST" }),
    result: (id: string) => request<TaskResult>(`/tasks/${id}/result`),
  },
};
