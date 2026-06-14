import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";
import { api } from "./endpoints";
import type {
  AnswerQuestionRequest,
  CourseId,
  RollTaskRequest,
  SubmitTaskRequest,
  Task,
  TaskStatus,
  UpdateUserRequest,
} from "./types";

export const queryKeys = {
  me: ["me"] as const,
  dashboard: ["me", "dashboard"] as const,
  achievements: ["me", "achievements"] as const,
  notifications: ["me", "notifications"] as const,
  courses: ["catalog", "courses"] as const,
  course: (id: CourseId) => ["catalog", "course", id] as const,
  interests: ["catalog", "interests"] as const,
  tasks: (status?: TaskStatus) => ["tasks", { status }] as const,
  task: (id: string) => ["tasks", id] as const,
  result: (id: string) => ["tasks", id, "result"] as const,
};

export function useDashboard() {
  return useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: () => api.me.dashboard(),
  });
}

export function useCourses() {
  return useQuery({
    queryKey: queryKeys.courses,
    queryFn: () => api.catalog.courses(),
    staleTime: 5 * 60_000,
  });
}

export function useCourse(id: CourseId) {
  return useQuery({
    queryKey: queryKeys.course(id),
    queryFn: () => api.catalog.course(id),
    staleTime: 5 * 60_000,
  });
}

export function useInterests() {
  return useQuery({
    queryKey: queryKeys.interests,
    queryFn: () => api.catalog.interests(),
    staleTime: 60 * 60_000,
  });
}

export function useAchievements() {
  return useQuery({
    queryKey: queryKeys.achievements,
    queryFn: () => api.me.achievements(),
  });
}

export function useTask(id: string | undefined) {
  return useQuery({
    queryKey: id ? queryKeys.task(id) : ["tasks", "_"],
    enabled: Boolean(id),
    queryFn: () => api.tasks.get(id as string),
    refetchInterval: (q) => {
      const data = q.state.data as Task | undefined;
      return data?.status === "processing" ? 5000 : false;
    },
  });
}

export function useTaskResult(id: string | undefined) {
  return useQuery({
    queryKey: id ? queryKeys.result(id) : ["tasks", "_", "result"],
    enabled: Boolean(id),
    queryFn: () => api.tasks.result(id as string),
  });
}

export function useTaskList(status?: TaskStatus) {
  return useQuery({
    queryKey: queryKeys.tasks(status),
    queryFn: () => api.tasks.list(status),
  });
}

export function useRollTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      courseId,
      body,
    }: {
      courseId: CourseId;
      body?: RollTaskRequest;
    }) => api.tasks.roll(courseId, body ?? {}),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tasks"] });
      void qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useStartTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.tasks.start(id),
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.task(data.id), data);
    },
  });
}

export function useAnswerQuestion(taskId: string) {
  return useMutation({
    mutationFn: (body: AnswerQuestionRequest) =>
      api.tasks.answer(taskId, body),
  });
}

export function useSubmitTask(
  options?: UseMutationOptions<
    Task,
    unknown,
    { taskId: string; body: SubmitTaskRequest }
  >
) {
  const qc = useQueryClient();
  const { onSuccess: callerOnSuccess, ...rest } = options ?? {};
  return useMutation({
    mutationFn: ({ taskId, body }) => api.tasks.submit(taskId, body),
    onSuccess: (data, vars, onMutateResult, ctx) => {
      qc.setQueryData(queryKeys.task(data.id), data);
      void qc.invalidateQueries({ queryKey: ["tasks"] });
      void qc.invalidateQueries({ queryKey: queryKeys.dashboard });
      callerOnSuccess?.(data, vars, onMutateResult, ctx);
    },
    ...rest,
  });
}

export function useSaveDraft(taskId: string) {
  return useMutation({
    mutationFn: (text: string) => api.tasks.saveDraft(taskId, text),
  });
}

export function useRedoTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.tasks.redo(id),
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.task(data.id), data);
      void qc.invalidateQueries({ queryKey: queryKeys.result(data.id) });
      void qc.invalidateQueries({ queryKey: ["tasks"] });
      void qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateUserRequest) => api.me.patch(body),
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.me, data);
      void qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}
