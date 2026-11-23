/** Runtime validation for untrusted API payloads used by the mobile client. */

export type QuestionOption = string | { key?: string; label?: string; text?: string; value?: string };
export type Question = {
  id: string;
  exam_id: "rrb_ntpc";
  question_text: string;
  options: QuestionOption[];
  source_document: string;
  source_page: string | number;
  difficulty?: number | null;
};
export type QuestionPage = {
  exam_id: "rrb_ntpc";
  questions: Question[];
  total_count: number;
  strategy: "baseline" | "mixed_baseline" | "weak_topic_focus";
  focus_topic: { slug: string; topic: string; attempts: number; accuracy_pct: number } | null;
};
export type AnswerFeedback = {
  saved: true;
  is_correct: boolean;
  answer_key: string;
  solution_steps: string[];
  source_document: string;
  source_page?: string | number | null;
};
export type TopicPerformance = {
  slug: string;
  topic: string;
  attempts: number;
  accuracy_pct: number;
  average_time_seconds: number;
};
export type AttemptSummary = {
  exam_id: "rrb_ntpc";
  total_attempts: number;
  overall_accuracy_pct: number | null;
  last_5_accuracy_pct: number | null;
  average_time_seconds: number | null;
  repeat_accuracy_pct: number | null;
  recent_attempts: number;
  weakest_topic: TopicPerformance | null;
  topic_performance: TopicPerformance[];
};
export type AttemptHistoryItem = {
  question_id: string;
  question_text: string;
  topic: string;
  is_correct: boolean;
  answer_given: string | null;
  elapsed_ms: number | null;
  created_at: string | null;
  source_document: string | null;
  source_page: string | number | null;
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const isFiniteNonNegative = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

const isPercentageOrNull = (value: unknown): value is number | null =>
  value === null || typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;

function isQuestionOption(value: unknown): value is QuestionOption {
  if (typeof value === "string") return value.trim().length > 0;
  return isRecord(value)
    && [value.label, value.text, value.value, value.key]
      .some((part) => typeof part === "string" && part.trim().length > 0);
}

export function isQuestion(value: unknown): value is Question {
  return isRecord(value)
    && value.exam_id === "rrb_ntpc"
    && typeof value.id === "string" && value.id.trim().length > 0
    && typeof value.question_text === "string" && value.question_text.trim().length > 0
    && Array.isArray(value.options) && value.options.length === 4
    && value.options.every(isQuestionOption)
    && typeof value.source_document === "string" && value.source_document.trim().length > 0
    && ((typeof value.source_page === "string" && value.source_page.trim().length > 0) || (typeof value.source_page === "number" && Number.isSafeInteger(value.source_page) && value.source_page > 0))
    && !( "answer_key" in value );
}

export function isQuestionPage(value: unknown): value is QuestionPage {
  if (!isRecord(value) || value.exam_id !== "rrb_ntpc" || !Array.isArray(value.questions)
    || !value.questions.every(isQuestion)
    || !Number.isInteger(value.total_count) || Number(value.total_count) < value.questions.length
    || !["baseline", "mixed_baseline", "weak_topic_focus"].includes(String(value.strategy))) return false;
  return value.focus_topic === null || isRecord(value.focus_topic)
    && typeof value.focus_topic.slug === "string" && value.focus_topic.slug.length > 0
    && typeof value.focus_topic.topic === "string" && value.focus_topic.topic.length > 0
    && Number.isInteger(value.focus_topic.attempts) && Number(value.focus_topic.attempts) >= 0
    && typeof value.focus_topic.accuracy_pct === "number"
    && Number.isFinite(value.focus_topic.accuracy_pct)
    && value.focus_topic.accuracy_pct >= 0 && value.focus_topic.accuracy_pct <= 100;
}

export function isTopicPerformance(value: unknown): value is TopicPerformance {
  return isRecord(value)
    && typeof value.slug === "string" && value.slug.length > 0
    && typeof value.topic === "string" && value.topic.length > 0
    && Number.isInteger(value.attempts) && Number(value.attempts) >= 0
    && typeof value.accuracy_pct === "number" && Number.isFinite(value.accuracy_pct)
    && value.accuracy_pct >= 0 && value.accuracy_pct <= 100
    && isFiniteNonNegative(value.average_time_seconds);
}

export function isAttemptSummary(value: unknown): value is AttemptSummary {
  return isRecord(value)
    && value.exam_id === "rrb_ntpc"
    && Number.isInteger(value.total_attempts) && Number(value.total_attempts) >= 0
    && isPercentageOrNull(value.overall_accuracy_pct)
    && isPercentageOrNull(value.last_5_accuracy_pct)
    && isPercentageOrNull(value.repeat_accuracy_pct)
    && (value.average_time_seconds === null || isFiniteNonNegative(value.average_time_seconds))
    && Number.isInteger(value.recent_attempts) && Number(value.recent_attempts) >= 0
    && (value.weakest_topic === null || isTopicPerformance(value.weakest_topic))
    && Array.isArray(value.topic_performance) && value.topic_performance.every(isTopicPerformance);
}

export function isAttemptHistory(value: unknown): value is { attempts: AttemptHistoryItem[] } {
  return isRecord(value) && value.exam_id === "rrb_ntpc"
    && Array.isArray(value.attempts)
    && Number.isInteger(value.limit) && Number(value.limit) >= 0
    && Number.isInteger(value.offset) && Number(value.offset) >= 0
    && value.attempts.every((item) => isRecord(item)
      && typeof item.question_id === "string" && item.question_id.length > 0
      && typeof item.question_text === "string"
      && typeof item.topic === "string"
      && typeof item.is_correct === "boolean"
      && (item.answer_given === null || typeof item.answer_given === "string")
      && (item.elapsed_ms === null || isFiniteNonNegative(item.elapsed_ms))
      && (item.created_at === null || typeof item.created_at === "string")
      && (item.source_document === null || typeof item.source_document === "string")
      && (item.source_page === null || typeof item.source_page === "string" || typeof item.source_page === "number" && Number.isSafeInteger(item.source_page) && item.source_page > 0)
      && !( "answer_key" in item ));
}

export function isAnswerFeedback(value: unknown): value is AnswerFeedback {
  return isRecord(value)
    && value.saved === true
    && typeof value.is_correct === "boolean"
    && typeof value.answer_key === "string" && value.answer_key.trim().length > 0
    && Array.isArray(value.solution_steps)
    && value.solution_steps.every((step) => typeof step === "string")
    && typeof value.source_document === "string" && value.source_document.trim().length > 0
    && (value.source_page === undefined || value.source_page === null || typeof value.source_page === "string" || typeof value.source_page === "number" && Number.isSafeInteger(value.source_page) && value.source_page > 0);
}
