const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const output = path.join(root, ".test-build");

try {
  execFileSync("npx", [
    "--no-install", "tsc", "--strict", "--target", "ES2020",
    "--module", "commonjs", "--outDir", output, "src/domain/contracts.ts",
  ], { cwd: root, stdio: "inherit" });
  const contracts = require(path.join(output, "contracts.js"));

  const question = {
    id: "verified-q-001",
    exam_id: "rrb_ntpc",
    question_text: "A source-verified sample question?",
    options: ["A", "B", "C", "D"],
    source_document: "RRB NTPC CBT-2 2024-25 English.pdf",
    source_page: "12",
  };
  const topic = {
    slug: "arithmetic",
    topic: "Arithmetic",
    attempts: 4,
    accuracy_pct: 75,
    average_time_seconds: 42,
  };

  test("accepts source-attributed four-option RRB NTPC questions", () => {
    assert.equal(contracts.isQuestion(question), true);
    assert.equal(contracts.isQuestion({ ...question, answer_key: "A" }), false);
    assert.equal(contracts.isQuestion({ ...question, options: ["A", "B", "C"] }), false);
    assert.equal(contracts.isQuestion({ ...question, source_page: "" }), false);
    assert.equal(contracts.isQuestion({ ...question, source_page: 12 }), true);
    assert.equal(contracts.isQuestion({ ...question, source_page: 0 }), true);
    assert.equal(contracts.isQuestion({ ...question, source_document: " " }), false);
    assert.equal(contracts.isQuestion({ ...question, question_text: "  " }), false);
    assert.equal(contracts.isQuestion({ ...question, exam_id: "ssc_cgl" }), false);
    assert.equal(contracts.isQuestion(null), false);
  });

  test("rejects unsafe or malformed question-page envelopes", () => {
    const page = {
      exam_id: "rrb_ntpc", questions: [question], total_count: 10,
      strategy: "baseline", focus_topic: null,
    };
    assert.equal(contracts.isQuestionPage(page), true);
    assert.equal(contracts.isQuestionPage({ ...page, questions: [], total_count: 0 }), true);
    assert.equal(contracts.isQuestionPage({ ...page, questions: [], total_count: 10 }), true);
    assert.equal(contracts.isQuestionPage({ ...page, questions: [], total_count: undefined }), false);
    assert.equal(contracts.isQuestionPage({ ...page, total_count: 0 }), false);
    assert.equal(contracts.isQuestionPage({ ...page, strategy: "invented" }), false);
    assert.equal(contracts.isQuestionPage({ ...page, focus_topic: { slug: "x", topic: "X", attempts: 1, accuracy_pct: 101 } }), false);
  });

  test("validates bounded analytics and rejects non-finite metrics", () => {
    const summary = {
      exam_id: "rrb_ntpc", total_attempts: 4, overall_accuracy_pct: 75,
      last_5_accuracy_pct: 75, average_time_seconds: 42,
      repeat_accuracy_pct: 100, recent_attempts: 4,
      weakest_topic: topic, topic_performance: [topic],
    };
    assert.equal(contracts.isAttemptSummary(summary), true);
    assert.equal(contracts.isAttemptSummary({ ...summary, overall_accuracy_pct: 101 }), false);
    assert.equal(contracts.isAttemptSummary({ ...summary, average_time_seconds: Infinity }), false);
    assert.equal(contracts.isAttemptSummary({ ...summary, topic_performance: [{ ...topic, average_time_seconds: Infinity }] }), false);
    assert.equal(contracts.isAttemptSummary({ ...summary, total_attempts: -1 }), false);
  });

  test("validates history pagination and prevents answer-key leakage", () => {
    const history = {
      exam_id: "rrb_ntpc", limit: 10, offset: 0,
      attempts: [{
        question_id: question.id, question_text: question.question_text,
        topic: "Arithmetic", is_correct: true, answer_given: "A",
        elapsed_ms: 42000, created_at: null, source_document: question.source_document,
        source_page: question.source_page,
      }],
    };
    assert.equal(contracts.isAttemptHistory(history), true);
    assert.equal(contracts.isAttemptHistory({ ...history, offset: -1 }), false);
    assert.equal(contracts.isAttemptHistory({ ...history, attempts: [{ ...history.attempts[0], answer_key: "A" }] }), false);
    assert.equal(contracts.isAttemptHistory({ ...history, attempts: [{ ...history.attempts[0], elapsed_ms: Infinity }] }), false);
  });

  test("requires persisted grading feedback and source attribution", () => {
    const feedback = {
      saved: true, is_correct: true, answer_key: "A",
      solution_steps: ["Step one"], source_document: question.source_document,
      source_page: question.source_page,
    };
    assert.equal(contracts.isAnswerFeedback(feedback), true);
    assert.equal(contracts.isAnswerFeedback({ ...feedback, saved: false }), false);
    assert.equal(contracts.isAnswerFeedback({ ...feedback, answer_key: "" }), false);
    assert.equal(contracts.isAnswerFeedback({ ...feedback, solution_steps: ["valid", 1] }), false);
    assert.equal(contracts.isAnswerFeedback({ ...feedback, source_document: "" }), false);
    assert.equal(contracts.isAnswerFeedback({ ...feedback, source_page: 12 }), true);
  });
} finally {
  fs.rmSync(output, { recursive: true, force: true });
}
