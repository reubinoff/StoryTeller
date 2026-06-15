/**
 * Strongly-typed wrappers around the API client. UI code should ALWAYS go
 * through these helpers (never call `request` directly), so the surface stays
 * consistent across the app.
 */

import { apiUrl, request } from "./client";
import type {
  Achievement,
  AnswerQuestionRequest,
  AuthResponse,
  AvatarUploadResponse,
  CompleteOnboardingRequest,
  Course,
  CourseId,
  DashboardResponse,
  DashboardMetrics,
  DeleteAccountRequest,
  Interest,
  InterestId,
  LoginRequest,
  Notification,
  Page,
  PasswordChangeRequest,
  RollTaskRequest,
  SignupRequest,
  SubmitTaskRequest,
  SubmitTaskResponse,
  Task,
  TaskResult,
  TaskStatus,
  UpdateUserRequest,
  User,
  WritingSubmitAccepted,
} from "./types";

export const api = {
  auth: {
    signup: (body: SignupRequest) =>
      request<AuthResponse>("/auth/signup", { method: "POST", body, noAuth: true }),
    login: (body: LoginRequest) =>
      request<AuthResponse>("/auth/login", { method: "POST", body, noAuth: true }),
    googleStartUrl: (returnTo: string, intent: "login" | "signup") =>
      apiUrl("/auth/google/start", { return_to: returnTo, intent }),
    refresh: () =>
      request<void>("/auth/refresh", { method: "POST", noAuth: true }),
    logout: () => request<null>("/auth/logout", { method: "POST" }),
    forgotPassword: () =>
      request<null>("/auth/password/forgot", { method: "POST", noAuth: true }),
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
    metrics: () => request<DashboardMetrics>("/me/metrics"),
    achievements: () => request<Achievement[]>("/me/achievements"),
    notifications: () => request<Page<Notification>>("/me/notifications"),
    notificationRead: (id: string) =>
      request<null>(`/me/notifications/${id}/read`, { method: "POST" }),
    notificationsReadAll: () =>
      request<null>("/me/notifications/read-all", { method: "POST" }),
    changePassword: (body: PasswordChangeRequest) =>
      request<null>("/me/password/change", { method: "POST", body }),
    deleteAccount: (body: DeleteAccountRequest) =>
      request<null>("/me", { method: "DELETE", body }),
    avatarUrl: () => apiUrl("/me/avatar"),
    uploadAvatar: (file: File) => {
      const form = new FormData();
      form.set("file", file);
      return request<AvatarUploadResponse>("/me/avatar", {
        method: "POST",
        body: form,
      });
    },
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
      request<SubmitTaskResponse>(`/tasks/${id}/submit`, { method: "POST", body }),
    saveDraft: (id: string, text: string) =>
      request<{ saved_at: string }>(`/tasks/${id}/draft`, {
        method: "POST",
        body: { text },
      }),
    retry: (id: string) =>
      request<WritingSubmitAccepted>(`/tasks/${id}/retry`, { method: "POST" }),
    redo: (id: string) =>
      request<Task>(`/tasks/${id}/redo`, { method: "POST" }),
    result: (id: string) => request<TaskResult>(`/tasks/${id}/result`),
  },
};
