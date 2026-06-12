import type {
  AnswerQuestionRequest,
  CourseId,
  InterestId,
  Notification,
  ReadingPayload,
  RollTaskRequest,
  SubmitTaskRequest,
  Task,
  TaskQuestion,
  TaskResult,
  WritingPayload,
} from "../../types";
import { TOPIC_BY_ID } from "~/lib/topics";
import {
  READING_BANK,
  SAMPLE_WRITING_EVALUATION,
  WRITING_BANK,
  commit,
  getState,
  uuid,
  type ReadingContent,
  type WritingPromptContent,
} from "../db";
import { err, ok, pathParts, type MockRequest, type MockResponse } from "../router";

function getCurrentUserId(token: string | null): string | null {
  const state = getState();
  if (token) return token.split(".")[1] ?? null;
  return state.current_user_id;
}

const SAMPLE_WRITING_TEXT =
  "I would love to visit Kyoto, the old capital of Japan. I would walk through the bamboo forest in Arashiyama early in the morning, when it's quiet and a little misty. After that, I would stop at a small tea shop to try matcha and sweet mochi. In the afternoon, I would visit the Fushimi Inari shrine and slowly climb the path under thousands of red gates. Kyoto matters to me because my grandmother always told me stories about Japanese gardens, and I want to see them with my own eyes one day.";

function pickReadingContent(interestId?: InterestId): {
  topicId: InterestId;
  content: ReadingContent;
} {
  const candidates = Object.keys(READING_BANK) as Array<keyof typeof READING_BANK>;
  if (interestId && READING_BANK[interestId]) {
    return { topicId: interestId, content: READING_BANK[interestId] };
  }
  // Fallback to space (Saturn, the design's hero passage).
  return { topicId: "space", content: READING_BANK.space };
}

function pickWritingContent(interestId?: InterestId): WritingPromptContent {
  if (interestId) {
    const found = WRITING_BANK.find((p) => p.topic_id === interestId);
    if (found) return found;
  }
  return WRITING_BANK[0];
}

function buildReadingPayload(content: ReadingContent): {
  payload: ReadingPayload;
  correct: Map<string, { type: TaskQuestion["question_type"]; correct: string | string[] }>;
} {
  const correct = new Map<
    string,
    { type: TaskQuestion["question_type"]; correct: string | string[] }
  >();
  const questions: TaskQuestion[] = content.questions.map((q, i) => {
    const id = uuid();
    if (q.type === "fill_blank") {
      correct.set(id, { type: "fill_blank", correct: q.correct_strings ?? [] });
    } else {
      correct.set(id, {
        type: q.type,
        correct: String(q.correct_index ?? 0),
      });
    }
    return {
      id,
      position: i + 1,
      question_type: q.type,
      prompt: q.prompt,
      options: q.options ?? null,
      explanation: q.explanation,
      max_points: 1,
    };
  });
  const payload: ReadingPayload = {
    title: content.title,
    passage_paragraphs: content.paragraphs,
    passage_text: content.paragraphs.join("\n\n"),
    passage_word_count: content.paragraphs
      .join(" ")
      .split(/\s+/)
      .filter(Boolean).length,
    questions,
  };
  return { payload, correct };
}

interface CorrectMap {
  [questionId: string]: {
    type: TaskQuestion["question_type"];
    correct: string | string[];
  };
}

function getCorrectMap(task: Task): CorrectMap {
  // Persisted on the task as a hidden meta field. We sneak this onto the task
  // because there's no separate questions table in the mock.
  return ((task as unknown as { _correct?: CorrectMap })._correct ?? {}) as CorrectMap;
}

function setCorrectMap(task: Task, map: CorrectMap): void {
  (task as unknown as { _correct?: CorrectMap })._correct = map;
}

function strippedQuestions(task: Task): TaskQuestion[] {
  if (!task.reading) return [];
  return task.reading.questions.map((q) => ({
    ...q,
    explanation: undefined,
  }));
}

function rollTask(
  userId: string,
  courseId: CourseId,
  interestId?: InterestId
): Task {
  const state = getState();
  const user = state.users[userId];
  const baseInterest =
    interestId ??
    user?.interests?.[0] ??
    (courseId === "reading" ? "space" : "travel");
  const id = uuid();
  const now = new Date().toISOString();
  if (courseId === "reading") {
    const { topicId, content } = pickReadingContent(baseInterest);
    const { payload, correct } = buildReadingPayload(content);
    const correctMap: CorrectMap = {};
    correct.forEach((v, k) => {
      correctMap[k] = v;
    });
    const task: Task = {
      id,
      user_id: userId,
      course_id: "reading",
      course_type: "unseen_text",
      interest_id: topicId,
      grade_level_at_roll: user?.grade_level ?? 4,
      status: "not_started",
      title: payload.title,
      topic_label: TOPIC_BY_ID[topicId]?.display_name ?? content.topic,
      reading: payload,
      score: null,
      xp_awarded: 0,
      started_at: null,
      submitted_at: null,
      completed_at: null,
      failed_at: null,
      fail_reason: null,
      created_at: now,
      updated_at: now,
    };
    setCorrectMap(task, correctMap);
    state.tasks[id] = task;
    state.user_tasks[userId] = [id, ...(state.user_tasks[userId] ?? [])];
    commit();
    return task;
  }

  const prompt = pickWritingContent(baseInterest);
  const writing: WritingPayload = {
    title: prompt.title,
    prompt: prompt.prompt,
    hints: prompt.hints,
    min_words: prompt.min_words,
    max_words: prompt.max_words,
  };
  const task: Task = {
    id,
    user_id: userId,
    course_id: "writing",
    course_type: "short_writing",
    interest_id: (prompt.topic_id as InterestId) ?? baseInterest,
    grade_level_at_roll: user?.grade_level ?? 4,
    status: "not_started",
    title: prompt.title,
    topic_label: prompt.topic_label,
    writing,
    score: null,
    xp_awarded: 0,
    started_at: null,
    submitted_at: null,
    completed_at: null,
    failed_at: null,
    fail_reason: null,
    created_at: now,
    updated_at: now,
  };
  state.tasks[id] = task;
  state.user_tasks[userId] = [id, ...(state.user_tasks[userId] ?? [])];
  commit();
  return task;
}

function publicTask(task: Task): Task {
  // Hide the correct-answer map from the wire response.
  const { _correct, ...rest } = task as unknown as Task & {
    _correct?: CorrectMap;
  };
  if (rest.reading) {
    return { ...rest, reading: { ...rest.reading, questions: strippedQuestions(rest) } };
  }
  return rest;
}

function isAnswerCorrect(
  q: TaskQuestion,
  userAnswer: string | number,
  correctMap: CorrectMap
): boolean {
  const entry = correctMap[q.id];
  if (!entry) return false;
  if (entry.type === "fill_blank") {
    const list = Array.isArray(entry.correct) ? entry.correct : [entry.correct];
    const u = String(userAnswer ?? "").trim().toLowerCase();
    return list.some((c) => u === c.toLowerCase());
  }
  return String(userAnswer) === String(entry.correct);
}

function scheduleWritingEvaluation(taskId: string, userId: string) {
  if (typeof window === "undefined") return;
  setTimeout(() => {
    const state = getState();
    const task = state.tasks[taskId];
    if (!task) return;
    if (task.status !== "processing") return;
    task.status = "completed";
    task.score = SAMPLE_WRITING_EVALUATION.score_overall;
    task.xp_awarded = 80;
    task.completed_at = new Date().toISOString();
    task.updated_at = task.completed_at;
    (task as unknown as { _evaluation: typeof SAMPLE_WRITING_EVALUATION })._evaluation =
      SAMPLE_WRITING_EVALUATION;

    const notif: Notification = {
      id: uuid(),
      kind: "task_completed",
      payload: {
        task_id: taskId,
        course_type: "short_writing",
        title: task.title,
        score: task.score,
      },
      read_at: null,
      created_at: new Date().toISOString(),
    };
    state.notifications[userId] = [notif, ...(state.notifications[userId] ?? [])];
    commit();
    // Publish to subscribers (frontend toast).
    window.dispatchEvent(
      new CustomEvent("storyteller:task-completed", {
        detail: notif.payload,
      })
    );
  }, 8000);
}

export function handleTasks(req: MockRequest): MockResponse<unknown> | null {
  const { pathname, query } = pathParts(req.url);
  const userId = getCurrentUserId(req.token);

  // POST /courses/:id/tasks
  const rollMatch = pathname.match(/^\/courses\/([^/]+)\/tasks$/);
  if (req.method === "POST" && rollMatch) {
    if (!userId) return err(401, "unauthenticated", "Sign in required");
    const courseId = rollMatch[1] as CourseId;
    if (courseId !== "reading" && courseId !== "writing") {
      return err(404, "not_found", "Unknown course");
    }
    const body = (req.body ?? {}) as RollTaskRequest;
    const task = rollTask(userId, courseId, body.interest_id);
    return ok(publicTask(task));
  }

  // GET /tasks
  if (req.method === "GET" && pathname === "/tasks") {
    if (!userId) return err(401, "unauthenticated", "Sign in required");
    const state = getState();
    const ids = state.user_tasks[userId] ?? [];
    const items = ids
      .map((id) => state.tasks[id])
      .filter(Boolean)
      .map((t) => publicTask(t));
    const status = query.get("status");
    const filtered = status ? items.filter((t) => t.status === status) : items;
    return ok({ items: filtered, next_cursor: null });
  }

  const taskMatch = pathname.match(/^\/tasks\/([^/]+)$/);
  const startMatch = pathname.match(/^\/tasks\/([^/]+)\/start$/);
  const answerMatch = pathname.match(/^\/tasks\/([^/]+)\/answer$/);
  const submitMatch = pathname.match(/^\/tasks\/([^/]+)\/submit$/);
  const draftMatch = pathname.match(/^\/tasks\/([^/]+)\/draft$/);
  const retryMatch = pathname.match(/^\/tasks\/([^/]+)\/retry$/);
  const resultMatch = pathname.match(/^\/tasks\/([^/]+)\/result$/);

  const state = getState();

  if (req.method === "GET" && taskMatch) {
    const task = state.tasks[taskMatch[1]];
    if (!task) return err(404, "not_found", "Task not found");
    return ok(publicTask(task));
  }

  if (req.method === "PATCH" && startMatch) {
    const task = state.tasks[startMatch[1]];
    if (!task) return err(404, "not_found", "Task not found");
    if (task.status === "not_started") {
      task.status = "in_progress";
      task.started_at = new Date().toISOString();
      task.updated_at = task.started_at;
      commit();
    }
    return ok(publicTask(task));
  }

  if (req.method === "POST" && answerMatch) {
    const task = state.tasks[answerMatch[1]];
    if (!task || !task.reading) return err(404, "not_found", "Task not found");
    const body = req.body as AnswerQuestionRequest;
    if (!body?.question_id) {
      return err(422, "validation_error", "question_id required");
    }
    if (task.status === "not_started") {
      task.status = "in_progress";
      task.started_at = new Date().toISOString();
    }
    task.updated_at = new Date().toISOString();
    // Persist user answer in a hidden bag.
    const bag = (task as unknown as { _answers?: Record<string, string | number> })
      ._answers ?? {};
    bag[body.question_id] = body.answer;
    (task as unknown as { _answers?: Record<string, string | number> })._answers = bag;
    commit();
    return ok({ accepted: true });
  }

  if (req.method === "POST" && submitMatch) {
    const task = state.tasks[submitMatch[1]];
    if (!task) return err(404, "not_found", "Task not found");
    const body = (req.body ?? {}) as SubmitTaskRequest;

    if (task.course_type === "unseen_text" && task.reading) {
      const correctMap = getCorrectMap(task);
      const answers =
        "answers" in body
          ? Object.fromEntries(
              body.answers.map((a) => [a.question_id, a.answer])
            )
          : ((task as unknown as { _answers?: Record<string, string | number> })._answers ??
            {});
      let score = 0;
      task.reading.questions.forEach((q) => {
        const userAns = answers[q.id];
        if (userAns !== undefined && isAnswerCorrect(q, userAns, correctMap)) {
          score += 1;
        }
      });
      task.score = Math.round((score / task.reading.questions.length) * 100);
      task.status = "completed";
      task.submitted_at = new Date().toISOString();
      task.completed_at = task.submitted_at;
      task.updated_at = task.submitted_at;
      task.xp_awarded = 60 + score * 4;
      (task as unknown as { _answers?: Record<string, string | number> })._answers =
        answers;
      commit();
      return ok({ ...publicTask(task), correct_count: score, total: task.reading.questions.length });
    }

    if (task.course_type === "short_writing" && task.writing) {
      const fullText =
        "full_text" in body && typeof body.full_text === "string"
          ? body.full_text
          : "";
      task.writing.draft = fullText;
      task.status = "processing";
      task.submitted_at = new Date().toISOString();
      task.updated_at = task.submitted_at;
      commit();
      if (userId) scheduleWritingEvaluation(task.id, userId);
      return ok({
        id: task.id,
        status: task.status,
        submitted_at: task.submitted_at,
      });
    }

    return err(400, "invalid_state", "Task not submittable");
  }

  if (req.method === "POST" && draftMatch) {
    const task = state.tasks[draftMatch[1]];
    if (!task || !task.writing) return err(404, "not_found", "Task not found");
    const body = req.body as { text: string };
    task.writing.draft = body.text ?? "";
    task.status = task.status === "not_started" ? "in_progress" : task.status;
    task.updated_at = new Date().toISOString();
    commit();
    return ok({ saved_at: task.updated_at });
  }

  if (req.method === "POST" && retryMatch) {
    const task = state.tasks[retryMatch[1]];
    if (!task) return err(404, "not_found", "Task not found");
    task.status = "processing";
    task.failed_at = null;
    task.fail_reason = null;
    task.updated_at = new Date().toISOString();
    commit();
    if (userId) scheduleWritingEvaluation(task.id, userId);
    return ok(publicTask(task));
  }

  if (req.method === "GET" && resultMatch) {
    const task = state.tasks[resultMatch[1]];
    if (!task) return err(404, "not_found", "Task not found");

    if (task.course_type === "unseen_text" && task.reading) {
      const correctMap = getCorrectMap(task);
      const userAnswers =
        ((task as unknown as { _answers?: Record<string, string | number> })._answers) ??
        {};
      const total = task.reading.questions.length;
      let correctCount = 0;
      const questions = task.reading.questions.map((q) => {
        const userAns = userAnswers[q.id] ?? null;
        const isRight =
          userAns !== null && isAnswerCorrect(q, userAns, correctMap);
        if (isRight) correctCount += 1;
        const correctEntry = correctMap[q.id];
        const correctRaw = Array.isArray(correctEntry?.correct)
          ? correctEntry.correct[0]
          : correctEntry?.correct;
        return {
          ...q,
          user_answer: userAns,
          is_correct: isRight,
          correct_answer: correctRaw,
        };
      });
      const result: TaskResult = {
        task_id: task.id,
        mode: "reading",
        score: correctCount,
        total,
        percentage: Math.round((correctCount / total) * 100),
        duration_seconds: 262,
        xp_earned: task.xp_awarded || 60,
        questions,
      };
      return ok(result);
    }

    if (task.course_type === "short_writing" && task.writing) {
      const evalData = (task as unknown as { _evaluation?: typeof SAMPLE_WRITING_EVALUATION })
        ._evaluation;
      const result: TaskResult = {
        task_id: task.id,
        mode: "writing",
        status: task.status,
        answer_text: task.writing.draft || SAMPLE_WRITING_TEXT,
        evaluation: evalData ?? null,
        xp_earned: task.xp_awarded,
        submitted_at: task.submitted_at,
        completed_at: task.completed_at,
      };
      return ok(result);
    }
  }

  return null;
}
