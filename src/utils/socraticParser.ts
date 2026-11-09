/**
 * Socratic Teacher Parser
 * Parses AI-generated Socratic tutoring responses into structured SocraticSession data
 */

import { SocraticSession, SocraticStep } from '../types';

/**
 * Parse Socratic session from AI markdown/text response
 * Expected format: A ```socratic JSON block containing a session
 *
 * Example:
 * ```socratic
 * {
 *   "problemStatement": "Να λυθεί η εξίσωση x^2 - 5x + 6 = 0",
 *   "topic": "Άλγεβρα",
 *   "steps": [
 *     { "stepNumber": 1, "question": "...", "hints": ["..."], "correctAnswer": "...", "explanation": "..." }
 *   ]
 * }
 * ```
 */
export function parseSocraticFromText(text: string): { cleanedText: string; session: SocraticSession | null } {
  if (!text || typeof text !== 'string') {
    return { cleanedText: '', session: null };
  }

  const trimmed = text.trim();

  // 1. Try markdown code block with socratic or json
  const codeBlockRegex = /```(?:socratic|socrates|tutor|teacher|json)?\s*(\{[\s\S]*?"steps"\s*:\s*\[[\s\S]*?\}\s*)\s*```/i;
  const blockMatch = trimmed.match(codeBlockRegex);

  if (blockMatch && blockMatch[1]) {
    const parsed = tryParseJson(blockMatch[1]);
    if (parsed && isValidSession(parsed)) {
      const cleaned = trimmed.replace(blockMatch[0], '').trim();
      return {
        cleanedText: cleaned || (parsed.problemStatement ? `### 🧑‍🏫 ${parsed.problemStatement}` : ''),
        session: sanitizeSession(parsed),
      };
    }
  }

  // 2. Check if entire string is raw JSON
  if (trimmed.startsWith('{') && trimmed.includes('"steps"')) {
    const parsed = tryParseJson(trimmed);
    if (parsed && isValidSession(parsed)) {
      return {
        cleanedText: parsed.problemStatement ? `### 🧑‍🏫 ${parsed.problemStatement}` : '',
        session: sanitizeSession(parsed),
      };
    }
  }

  // 3. Search for outermost JSON object containing steps
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const candidateJson = trimmed.substring(firstBrace, lastBrace + 1);
    if (candidateJson.includes('"steps"')) {
      const parsed = tryParseJson(candidateJson);
      if (parsed && isValidSession(parsed)) {
        const textBefore = trimmed.substring(0, firstBrace).trim();
        const textAfter = trimmed.substring(lastBrace + 1).trim();
        const combinedCleaned = [textBefore, textAfter].filter(Boolean).join('\n\n');

        return {
          cleanedText: combinedCleaned || (parsed.problemStatement ? `### 🧑‍🏫 ${parsed.problemStatement}` : ''),
          session: sanitizeSession(parsed),
        };
      }
    }
  }

  return { cleanedText: text, session: null };
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

function isValidSession(obj: any): boolean {
  return (
    obj &&
    typeof obj === 'object' &&
    Array.isArray(obj.steps) &&
    obj.steps.length > 0 &&
    obj.steps.some((s: any) => s && s.question && s.correctAnswer)
  );
}

function sanitizeSession(raw: any): SocraticSession {
  const steps: SocraticStep[] = (raw.steps || [])
    .filter((s: any) => s && s.question && s.correctAnswer)
    .map((s: any, idx: number) => ({
      stepNumber: typeof s.stepNumber === 'number' ? s.stepNumber : idx + 1,
      question: String(s.question).trim(),
      hints: Array.isArray(s.hints) ? s.hints.map((h: any) => String(h).trim()).filter(Boolean) : [],
      correctAnswer: String(s.correctAnswer).trim(),
      explanation: s.explanation ? String(s.explanation).trim() : 'Δεν δόθηκε επεξήγηση.',
      userAnswer: undefined,
      isCorrect: undefined,
      hintLevel: 0, // No hints shown initially
    }));

  return {
    id: `socratic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    problemStatement: raw.problemStatement ? String(raw.problemStatement).trim() : 'Επίλυση Προβλήματος',
    steps,
    currentStep: 0,
    topic: raw.topic ? String(raw.topic).trim() : undefined,
  };
}

/**
 * Normalize user answer for comparison against correct answer
 * Lowercase, remove punctuation, trim, normalize Greek accents
 */
export function normalizeAnswer(text: string): string {
  // Map Greek accented characters to their unaccented forms (soft matching)
  const greekAccents: Record<string, string> = {
    'ά': 'α', 'έ': 'ε', 'ή': 'η', 'ί': 'ι', 'ό': 'ο', 'ύ': 'υ', 'ώ': 'ω',
    'ϊ': 'ι', 'ΐ': 'ι', 'ϋ': 'υ', 'ΰ': 'υ',
    'Ά': 'α', 'Έ': 'ε', 'Ή': 'η', 'Ί': 'ι', 'Ό': 'ο', 'Ύ': 'υ', 'Ώ': 'ω',
  };

  return text
    .toLowerCase()
    .trim()
    .replace(/[.,!?;:]/g, '')
    .replace(/[ά-ωά-ώ]/gi, (char) => greekAccents[char] || char)
    .replace(/\s+/g, ' ');
}

/**
 * Check if user answer is correct (fuzzy matching)
 * Returns true if userAnswer matches correctAnswer (allowing for slight variations)
 */
export function isAnswerCorrect(userAnswer: string, correctAnswer: string): boolean {
  const normalizedUser = normalizeAnswer(userAnswer);
  const normalizedCorrect = normalizeAnswer(correctAnswer);

  if (normalizedUser === normalizedCorrect) return true;

  // Check if correct answer contains user answer or vice versa
  if (normalizedUser.length > 2 && normalizedCorrect.includes(normalizedUser)) return true;
  if (normalizedCorrect.length > 2 && normalizedUser.includes(normalizedCorrect)) return true;

  // Token matching: count matching tokens
  const userTokens = normalizedUser.split(' ').filter((t) => t.length > 1);
  const correctTokens = normalizedCorrect.split(' ').filter((t) => t.length > 1);
  if (userTokens.length > 0 && correctTokens.length > 0) {
    const matches = userTokens.filter((t) => correctTokens.includes(t)).length;
    if (matches / Math.max(userTokens.length, correctTokens.length) >= 0.6) return true;
  }

  return false;
}

/**
 * Advance a socratic session to the next step
 */
export function advanceSocraticSteps(session: SocraticSession): SocraticSession {
  const nextStep = session.currentStep + 1;
  return {
    ...session,
    currentStep: nextStep,
    completedAt: nextStep >= session.steps.length ? Date.now() : undefined,
  };
}

/**
 * Get current step of a socratic session
 */
export function getCurrentStep(session: SocraticSession): SocraticStep | null {
  return session.steps[session.currentStep] || null;
}
