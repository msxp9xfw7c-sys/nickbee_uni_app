/**
 * Exam Simulator Parser
 * Parses AI-generated exam responses into structured ExamSession data
 */

import { ExamSession, ExamQuestion, WeakPointAnalysis } from '../types';
import { analyzeExamPerformance } from './examAnalytics';

/**
 * Parse exam from AI markdown/text response
 * Expected format: A ```exam JSON block containing an exam
 *
 * Example:
 * ```exam
 * {
 *   "title": "Διαγώνισμα - Δίκτυα",
 *   "courseName": "Δίκτυα Υπολογιστών",
 *   "timeLimit": 45,
 *   "questions": [
 *     { "id": 1, "question": "...", "options": [...], "correctIndex": 0, "explanation": "...", "topic": "...", "difficulty": "medium" }
 *   ]
 * }
 * ```
 */
export function parseExamFromText(text: string): { cleanedText: string; exam: ExamSession | null } {
  if (!text || typeof text !== 'string') {
    return { cleanedText: '', exam: null };
  }

  const trimmed = text.trim();

  // 1. Try markdown code block with exam or json
  const codeBlockRegex = /```(?:exam|exam_sim|exam-sim|mock|json)?\s*(\{[\s\S]*?"questions"\s*:\s*\[[\s\S]*?\}\s*)\s*```/i;
  const blockMatch = trimmed.match(codeBlockRegex);

  if (blockMatch && blockMatch[1]) {
    const parsed = tryParseJson(blockMatch[1]);
    if (parsed && isValidExam(parsed)) {
      const cleaned = trimmed.replace(blockMatch[0], '').trim();
      return {
        cleanedText: cleaned || (parsed.title ? `### 📝 ${parsed.title}` : ''),
        exam: sanitizeExam(parsed),
      };
    }
  }

  // 2. Check if entire string is raw JSON
  if (trimmed.startsWith('{') && trimmed.includes('"questions"')) {
    const parsed = tryParseJson(trimmed);
    if (parsed && isValidExam(parsed)) {
      return {
        cleanedText: parsed.title ? `### 📝 ${parsed.title}` : '',
        exam: sanitizeExam(parsed),
      };
    }
  }

  // 3. Search for outermost JSON object containing questions
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const candidateJson = trimmed.substring(firstBrace, lastBrace + 1);
    if (candidateJson.includes('"questions"')) {
      const parsed = tryParseJson(candidateJson);
      if (parsed && isValidExam(parsed)) {
        const textBefore = trimmed.substring(0, firstBrace).trim();
        const textAfter = trimmed.substring(lastBrace + 1).trim();
        const combinedCleaned = [textBefore, textAfter].filter(Boolean).join('\n\n');

        return {
          cleanedText: combinedCleaned || (parsed.title ? `### 📝 ${parsed.title}` : ''),
          exam: sanitizeExam(parsed),
        };
      }
    }
  }

  return { cleanedText: text, exam: null };
}

function tryParseJson(jsonStr: string): any {
  try {
    return JSON.parse(jsonStr);
  } catch {
    try {
      const repaired = jsonStr
        .replace(/,\s*([\]}])/g, '$1')
        .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":');
      return JSON.parse(repaired);
    } catch {
      return null;
    }
  }
}

function isValidExam(obj: any): boolean {
  return (
    obj &&
    typeof obj === 'object' &&
    Array.isArray(obj.questions) &&
    obj.questions.length > 0 &&
    obj.questions.some((q: any) => q && q.question && Array.isArray(q.options) && q.options.length >= 2)
  );
}

function sanitizeExam(raw: any): ExamSession {
  const questions: ExamQuestion[] = (raw.questions || [])
    .filter((q: any) => q && q.question && Array.isArray(q.options) && q.options.length >= 2)
    .map((q: any, idx: number) => ({
      id: typeof q.id === 'number' ? q.id : idx + 1,
      question: String(q.question).trim(),
      options: q.options.map((opt: any) => String(opt).trim()),
      correctIndex:
        typeof q.correctIndex === 'number' && q.correctIndex >= 0 && q.correctIndex < q.options.length
          ? q.correctIndex
          : 0,
      explanation: q.explanation ? String(q.explanation).trim() : 'Δεν δόθηκε αναλυτική επεξήγηση.',
      topic: q.topic ? String(q.topic).trim() : (raw.courseName || 'Γενική Ύλη'),
      difficulty: ['easy', 'medium', 'hard'].includes(q.difficulty)
        ? q.difficulty
        : 'medium',
      timeToAnswer: typeof q.timeToAnswer === 'number' ? q.timeToAnswer : undefined,
    }));

  const now = Date.now();

  return {
    id: `exam_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    title: raw.title ? String(raw.title).trim() : 'Διαγώνισμα Εξετάσεων',
    totalQuestions: questions.length,
    timeLimit: typeof raw.timeLimit === 'number' ? raw.timeLimit : 45,
    startedAt: now,
    questions,
    userAnswers: {},
    scores: {
      totalScore: 0,
      maxScore: questions.length,
      percentage: 0,
    },
  };
}

/**
 * Calculate exam scores from user answers
 */
export function calculateExamScore(session: ExamSession): ExamSession {
  let correct = 0;
  session.questions.forEach((question) => {
    const userAnswer = session.userAnswers[question.id];
    if (userAnswer === question.correctIndex) {
      correct++;
    }
  });

  const percentage = session.totalQuestions > 0
    ? Math.round((correct / session.totalQuestions) * 100)
    : 0;

  return {
    ...session,
    scores: {
      totalScore: correct,
      maxScore: session.totalQuestions,
      percentage,
    },
  };
}

/**
 * Generate WeakPointAnalysis for an exam session
 */
export function generateWeakPointAnalysis(session: ExamSession): WeakPointAnalysis {
  return analyzeExamPerformance(session);
}

/**
 * Get the next unanswered question ID
 */
export function getNextUnansweredQuestion(session: ExamSession): number | null {
  const answeredIds = Object.keys(session.userAnswers).map(Number);
  const unanswered = session.questions.find((q) => !answeredIds.includes(q.id));
  return unanswered ? unanswered.id : null;
}

/**
 * Check if exam is complete (all questions answered)
 */
export function isExamComplete(session: ExamSession): boolean {
  return session.questions.every((q) => session.userAnswers[q.id] !== undefined);
}

/**
 * Track time remaining for exam
 */
export function getTimeRemaining(session: ExamSession, now: number = Date.now()): number {
  const elapsedMs = now - session.startedAt;
  const remainingMs = session.timeLimit * 60 * 1000 - elapsedMs;
  return Math.max(0, Math.floor(remainingMs / 1000));
}
