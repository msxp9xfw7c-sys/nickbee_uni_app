import { QuizData, QuizQuestion } from '../types';

/**
 * Robustly parses and extracts quiz data from AI output text.
 * Handles:
 * 1. ```quiz or ```json code blocks containing a quiz
 * 2. Raw JSON string starting with { or containing "questions": [...]
 * 3. Text with mixed introduction and JSON
 * 4. Automatic repair of trailing commas or slight syntax variations
 */
export function parseQuizFromText(text: string): { cleanedText: string; quiz: QuizData | null } {
  if (!text || typeof text !== 'string') {
    return { cleanedText: '', quiz: null };
  }

  const trimmed = text.trim();

  // 1. Try markdown code block with quiz or json
  const codeBlockRegex = /```(?:quiz|json)?\s*(\{[\s\S]*?"questions"\s*:\s*\[[\s\S]*?\}\s*)\s*```/i;
  const blockMatch = trimmed.match(codeBlockRegex);

  if (blockMatch && blockMatch[1]) {
    const parsed = tryParseJson(blockMatch[1]);
    if (parsed && isValidQuiz(parsed)) {
      const cleaned = trimmed.replace(blockMatch[0], '').trim();
      return {
        cleanedText: cleaned || (parsed.title ? `### 🎓 ${parsed.title}` : ''),
        quiz: sanitizeQuiz(parsed),
      };
    }
  }

  // 2. Check if the entire string or a large section is raw JSON (starts with { and ends with })
  if (trimmed.startsWith('{') && trimmed.includes('"questions"')) {
    const parsed = tryParseJson(trimmed);
    if (parsed && isValidQuiz(parsed)) {
      return {
        cleanedText: parsed.title ? `### 🎓 ${parsed.title}` : '',
        quiz: sanitizeQuiz(parsed),
      };
    }
  }

  // 3. Search for the outermost JSON object containing "questions" in mixed text
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
          cleanedText: combinedCleaned || (parsed.title ? `### 🎓 ${parsed.title}` : ''),
          quiz: sanitizeQuiz(parsed),
        };
      }
    }
  }

  // 4. Try parsing plain text multiple-choice questions if standard JSON was not found
  const plainTextQuiz = parsePlainTextQuestions(trimmed);
  if (plainTextQuiz && plainTextQuiz.quiz.questions.length >= 2) {
    return {
      cleanedText: plainTextQuiz.introText,
      quiz: plainTextQuiz.quiz,
    };
  }

  return { cleanedText: text, quiz: null };
}

function tryParseJson(jsonStr: string): any {
  try {
    return JSON.parse(jsonStr);
  } catch {
    // Attempt simple repair: remove trailing commas before ] or }
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
    obj.questions.some((q: any) => q && q.question && Array.isArray(q.options) && q.options.length >= 2)
  );
}

function sanitizeQuiz(raw: any): QuizData {
  const questions: QuizQuestion[] = (raw.questions || [])
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
    }));

  return {
    title: raw.title ? String(raw.title).trim() : 'Διαδραστικό Ακαδημαϊκό Κουίζ Ύλης',
    courseName: raw.courseName ? String(raw.courseName).trim() : undefined,
    difficulty: ['easy', 'medium', 'hard', 'exam'].includes(raw.difficulty)
      ? raw.difficulty
      : 'medium',
    questions,
  };
}

/**
 * Fallback parser for standard plain text numbered multiple-choice questions
 */
function parsePlainTextQuestions(text: string): { introText: string; quiz: QuizData } | null {
  // Look for patterns like "1. Question... A) ... B) ... C) ... D) ... Σωστή απάντηση:"
  const questionBlocks = text.split(/(?=\n\s*(?:[0-9]{1,2}[\.\)]|Ερώτηση\s+[0-9]{1,2}:?))/i);
  if (questionBlocks.length < 2) return null;

  const parsedQuestions: QuizQuestion[] = [];
  let intro = questionBlocks[0];

  for (let i = 1; i < questionBlocks.length; i++) {
    const block = questionBlocks[i].trim();
    if (!block) continue;

    // Extract options
    const optionMatches = [...block.matchAll(/(?:[A-DΑ-Δa-d][\.\)]|\([A-DΑ-Δa-d]\))\s*([^\n]+)/g)];
    if (optionMatches.length >= 2) {
      const options = optionMatches.map((m) => m[1].trim());

      // Extract question text before the first option
      const firstOptIndex = block.indexOf(optionMatches[0][0]);
      const questionText = block
        .substring(0, firstOptIndex)
        .replace(/^(?:[0-9]{1,2}[\.\)]|Ερώτηση\s+[0-9]{1,2}:?)\s*/i, '')
        .trim();

      // Extract correct answer / explanation if present
      let correctIndex = 0;
      let explanation = 'Βασισμένο στην πανεπιστημιακή ύλη.';
      
      const correctMatch = block.match(/(?:Σωστό|Σωστή\s+απάντηση|Correct\s+answer|Answer|Λύση)[:\s]*([A-DΑ-Δa-d1-4])/i);
      if (correctMatch) {
        const char = correctMatch[1].toUpperCase();
        if (char === 'A' || char === 'Α' || char === '1') correctIndex = 0;
        else if (char === 'B' || char === 'Β' || char === '2') correctIndex = 1;
        else if (char === 'C' || char === 'Γ' || char === '3') correctIndex = 2;
        else if (char === 'D' || char === 'Δ' || char === '4') correctIndex = 3;
      }

      const explMatch = block.match(/(?:Επεξήγηση|Explanation|Αιτιολόγηση)[:\s]*([^\n]+(?:\n[^\n]+)*)/i);
      if (explMatch) {
        explanation = explMatch[1].trim();
      }

      if (questionText && options.length >= 2) {
        parsedQuestions.push({
          id: parsedQuestions.length + 1,
          question: questionText,
          options,
          correctIndex,
          explanation,
          topic: 'Πανεπιστημιακή Ύλη',
        });
      }
    }
  }

  if (parsedQuestions.length >= 2) {
    return {
      introText: intro.trim(),
      quiz: {
        title: 'Διαδραστικό Κουίζ Επανάληψης',
        difficulty: 'medium',
        questions: parsedQuestions,
      },
    };
  }

  return null;
}
