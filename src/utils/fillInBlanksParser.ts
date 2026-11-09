/**
 * Fill-in-the-Blanks Parser
 * Parses AI-generated fill-in-the-blank responses into structured FillInBlanksQuiz data
 */

import { FillInBlanksQuiz, BlankQuestion } from '../types';

/**
 * Parse fill-in-the-blanks quiz from AI markdown/text response
 * Expected format: A ```fillblanks JSON block containing a quiz
 *
 * Example:
 * ```fillblanks
 * {
 *   "title": "Συμπλήρωση Τύπων",
 *   "courseName": "Φυσική",
 *   "difficulty": "medium",
 *   "questions": [
 *     { "id": 1, "text": "Η δύναμη F = [BLANK] * a", "blanks": [...], "explanation": "..." }
 *   ]
 * }
 * ```
 */
export function parseFillInBlanksFromText(text: string): { cleanedText: string; quiz: FillInBlanksQuiz | null } {
  if (!text || typeof text !== 'string') {
    return { cleanedText: '', quiz: null };
  }

  const trimmed = text.trim();

  // 1. Try markdown code block with fillblanks or json
  const codeBlockRegex = /```(?:fillblanks|fillblank|fill-in-blanks|fill|json)?\s*(\{[\s\S]*?"questions"\s*:\s*\[[\s\S]*?\}\s*)\s*```/i;
  const blockMatch = trimmed.match(codeBlockRegex);

  if (blockMatch && blockMatch[1]) {
    const parsed = tryParseJson(blockMatch[1]);
    if (parsed && isValidQuiz(parsed)) {
      const cleaned = trimmed.replace(blockMatch[0], '').trim();
      return {
        cleanedText: cleaned || (parsed.title ? `### ✏️ ${parsed.title}` : ''),
        quiz: sanitizeQuiz(parsed),
      };
    }
  }

  // 2. Check if entire string is raw JSON
  if (trimmed.startsWith('{') && trimmed.includes('"questions"')) {
    const parsed = tryParseJson(trimmed);
    if (parsed && isValidQuiz(parsed)) {
      return {
        cleanedText: parsed.title ? `### ✏️ ${parsed.title}` : '',
        quiz: sanitizeQuiz(parsed),
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
      if (parsed && isValidQuiz(parsed)) {
        const textBefore = trimmed.substring(0, firstBrace).trim();
        const textAfter = trimmed.substring(lastBrace + 1).trim();
        const combinedCleaned = [textBefore, textAfter].filter(Boolean).join('\n\n');

        return {
          cleanedText: combinedCleaned || (parsed.title ? `### ✏️ ${parsed.title}` : ''),
          quiz: sanitizeQuiz(parsed),
        };
      }
    }
  }

  return { cleanedText: text, quiz: null };
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

function isValidQuiz(obj: any): boolean {
  return (
    obj &&
    typeof obj === 'object' &&
    Array.isArray(obj.questions) &&
    obj.questions.length > 0 &&
    obj.questions.some((q: any) => q && q.text && Array.isArray(q.blanks) && q.blanks.length > 0)
  );
}

function sanitizeQuiz(raw: any): FillInBlanksQuiz {
  const questions: BlankQuestion[] = (raw.questions || [])
    .filter((q: any) => q && q.text && Array.isArray(q.blanks) && q.blanks.length > 0)
    .map((q: any, idx: number) => ({
      id: typeof q.id === 'number' ? q.id : idx + 1,
      text: String(q.text).trim(),
      blanks: (q.blanks || []).map((b: any, bIdx: number) => ({
        position: typeof b.position === 'number' ? b.position : bIdx,
        correctAnswers: Array.isArray(b.correctAnswers)
          ? b.correctAnswers.map((a: any) => String(a).trim()).filter(Boolean)
          : [String(b.correctAnswer || '').trim()].filter(Boolean),
        options: Array.isArray(b.options)
          ? b.options.map((opt: any) => String(opt).trim())
          : undefined,
      })),
      explanation: q.explanation ? String(q.explanation).trim() : 'Δεν δόθηκε επεξήγηση.',
      topic: q.topic ? String(q.topic).trim() : (raw.courseName || raw.title || 'Γενική Ύλη'),
    }));

  return {
    title: raw.title ? String(raw.title).trim() : 'Συμπλήρωση Κενών',
    courseName: raw.courseName ? String(raw.courseName).trim() : undefined,
    difficulty: ['easy', 'medium', 'hard'].includes(raw.difficulty)
      ? raw.difficulty
      : 'medium',
    questions,
  };
}

/**
 * Extract all blank placeholders from a question text
 * Returns array of { index, startPos, endPos, text } objects
 */
export function findBlankPlaceholders(text: string): Array<{ index: number; startPos: number; endPos: number; text: string }> {
  const placeholders: Array<{ index: number; startPos: number; endPos: number; text: string }> = [];
  const regex = /\[(?:BLANK|blank|___|____|……)\]/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    placeholders.push({
      index: placeholders.length,
      startPos: match.index,
      endPos: match.index + match[0].length,
      text: match[0],
    });
  }

  return placeholders;
}

/**
 * Replace blank placeholders with user answers and return rendered text
 * Processes from last placeholder to first to preserve correct positions
 */
export function renderWithBlanks(text: string, userAnswers: string[]): string {
  let result = text;
  const placeholders = findBlankPlaceholders(text);

  // Replace from last to first to avoid position shifts
  for (let i = placeholders.length - 1; i >= 0; i--) {
    const placeholder = placeholders[i];
    const answer = userAnswers[i] || '____';
    result = result.substring(0, placeholder.startPos) + answer + result.substring(placeholder.endPos);
  }

  return result;
}

/**
 * Check if a user answer is correct for a blank
 */
export function isBlankCorrect(userAnswer: string, correctAnswers: string[]): boolean {
  const normalizedUser = normalizeAnswer(userAnswer);
  return correctAnswers.some((answer) => {
    const normalizedAnswer = normalizeAnswer(answer);
    if (normalizedUser === normalizedAnswer) return true;
    if (normalizedUser.length > 2 && normalizedAnswer.includes(normalizedUser)) return true;
    return false;
  });
}

/**
 * Normalize answer for fuzzy comparison
 */
function normalizeAnswer(text: string): string {
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
