/**
 * Flashcard Parser
 * Parses AI-generated flashcard responses into structured FlashcardDeck data
 */

import { Flashcard, FlashcardDeck } from '../types';
import { calculateNextReview, createFlashcard, ReviewResult } from './spacedRepetition';

/**
 * Parse flashcards from AI markdown/text response
 * Expected format: A ```flashcards JSON block containing a deck
 *
 * Example:
 * Some intro text...
 * ```flashcards
 * {
 *   "name": "Κάρτες Επανάληψης",
 *   "description": "Βασικές έννοιες",
 *   "cards": [
 *     { "front": "...", "back": "...", "topic": "..." }
 *   ]
 * }
 * ```
 */
export function parseFlashcardsFromText(text: string): { cleanedText: string; deck: FlashcardDeck | null } {
  if (!text || typeof text !== 'string') {
    return { cleanedText: '', deck: null };
  }

  const trimmed = text.trim();

  // 1. Try markdown code block with flashcards or json
  const codeBlockRegex = /```(?:flashcards|flashcard|json)?\s*(\{[\s\S]*?"cards"\s*:\s*\[[\s\S]*?\}\s*)\s*```/i;
  const blockMatch = trimmed.match(codeBlockRegex);

  if (blockMatch && blockMatch[1]) {
    const parsed = tryParseJson(blockMatch[1]);
    if (parsed && isValidDeck(parsed)) {
      const cleaned = trimmed.replace(blockMatch[0], '').trim();
      return {
        cleanedText: cleaned || (parsed.name ? `### 🃏 ${parsed.name}` : ''),
        deck: sanitizeDeck(parsed),
      };
    }
  }

  // 2. Check if entire string is raw JSON
  if (trimmed.startsWith('{') && trimmed.includes('"cards"')) {
    const parsed = tryParseJson(trimmed);
    if (parsed && isValidDeck(parsed)) {
      return {
        cleanedText: parsed.name ? `### 🃏 ${parsed.name}` : '',
        deck: sanitizeDeck(parsed),
      };
    }
  }

  // 3. Search for outermost JSON object containing cards
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const candidateJson = trimmed.substring(firstBrace, lastBrace + 1);
    if (candidateJson.includes('"cards"')) {
      const parsed = tryParseJson(candidateJson);
      if (parsed && isValidDeck(parsed)) {
        const textBefore = trimmed.substring(0, firstBrace).trim();
        const textAfter = trimmed.substring(lastBrace + 1).trim();
        const combinedCleaned = [textBefore, textAfter].filter(Boolean).join('\n\n');

        return {
          cleanedText: combinedCleaned || (parsed.name ? `### 🃏 ${parsed.name}` : ''),
          deck: sanitizeDeck(parsed),
        };
      }
    }
  }

  // 4. Balanced-object fallback for raw JSON with nested card content.
  for (let start = trimmed.indexOf('{'); start >= 0; start = trimmed.indexOf('{', start + 1)) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < trimmed.length; index += 1) {
      const character = trimmed[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === '"') inString = false;
      } else if (character === '"') inString = true;
      else if (character === '{') depth += 1;
      else if (character === '}' && --depth === 0) {
        const candidate = trimmed.slice(start, index + 1);
        if (candidate.includes('"cards"')) {
          const parsed = tryParseJson(candidate);
          if (parsed && isValidDeck(parsed)) {
            return { cleanedText: '', deck: sanitizeDeck(parsed) };
          }
        }
        break;
      }
    }
  }

  // 5. Fallback: try to parse plain text flashcards (front -> back format)
  const plainTextDeck = parsePlainTextFlashcards(trimmed);
  if (plainTextDeck && plainTextDeck.deck.cards.length >= 2) {
    return {
      cleanedText: plainTextDeck.introText,
      deck: plainTextDeck.deck,
    };
  }

  if (/flashcard|flash cards|κάρτες\s+(επανάληψης|μελέτης)|μπροστινή\s+πλευρά/i.test(trimmed)) {
    return {
      cleanedText: '⚠️ Οι Flashcards δεν είχαν έγκυρη structured μορφή JSON και δεν φορτώθηκαν.',
      deck: null,
    };
  }

  return { cleanedText: text, deck: null };
}

function tryParseJson(jsonStr: string): any {
  try {
    return JSON.parse(jsonStr);
  } catch {
    // Attempt simple repair: remove trailing commas, fix quotes
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

function isValidDeck(obj: any): boolean {
  return (
    obj &&
    typeof obj === 'object' &&
    Array.isArray(obj.cards) &&
    obj.cards.length > 0 &&
    obj.cards.some((c: any) => c && (c.front || c.question || c.prompt) && (c.back || c.answer || c.explanation))
  );
}

function sanitizeDeck(raw: any): FlashcardDeck {
  const cards: Flashcard[] = (raw.cards || [])
    .filter((c: any) => c && (c.front || c.question || c.prompt) && (c.back || c.answer || c.explanation))
    .map((c: any, idx: number) => {
      const front = String(c.front ?? c.question ?? c.prompt ?? '').trim();
      const back = String(c.back ?? c.answer ?? c.explanation ?? '').trim();
      const topic = c.topic ? String(c.topic).trim() : (raw.courseName || raw.name || 'Γενική Ύλη');
      const card = createFlashcard(front, back, topic);
      return {
        ...card,
        difficulty: c.difficulty && ['easy', 'medium', 'hard'].includes(c.difficulty)
          ? c.difficulty
          : card.difficulty,
      };
    });

  const now = Date.now();
  const masterCards = cards.filter((c) => c.repetitions >= 3).length;

  return {
    id: `deck_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: raw.name ? String(raw.name).trim() : 'Κάρτες Επανάληψης',
    description: raw.description ? String(raw.description).trim() : undefined,
    cards,
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
    totalCards: cards.length,
    masterCards,
  };
}

/**
 * Fallback parser for plain text flashcard format:
 * Front: back
 * or
 * Front -> Back
 * or
 * Ερώτηση: ...
 * Απάντηση: ...
 */
function parsePlainTextFlashcards(text: string): { introText: string; deck: FlashcardDeck } | null {
  const lines = text.split('\n').filter((l) => l.trim());
  const cards: Flashcard[] = [];

  let introLines: string[] = [];
  let currentFront: string | null = null;
  let currentBack: string | null = null;
  let currentTopic: string | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip headers
    if (trimmed.startsWith('#')) {
      if (!introLines.length) introLines.push(trimmed);
      continue;
    }

    // Parse arrows: "Front -> Back"
    const arrowMatch = trimmed.match(/^(.+?)\s*(?:->|→)\s*(.+)$/);
    if (arrowMatch && !trimmed.startsWith('-')) {
      cards.push({
        ...createFlashcard(arrowMatch[1].trim(), arrowMatch[2].trim()),
      });
      continue;
    }

    // Parse Ερώτηση/Απάντηση pairs
    const questionMatch = trimmed.match(/^(?:(?:Ερώτηση|Question|Q)\s*[:.])\s*(.+)$/i);
    if (questionMatch) {
      if (currentFront && currentBack) {
        cards.push({ ...createFlashcard(currentFront, currentBack, currentTopic || undefined) });
      }
      currentFront = questionMatch[1].trim();
      currentBack = null;
      continue;
    }

    const answerMatch = trimmed.match(/^(?:(?:Απάντηση|Answer|A)\s*[:.])\s*(.+)$/i);
    if (answerMatch && currentFront) {
      currentBack = answerMatch[1].trim();
      if (currentFront && currentBack) {
        cards.push({ ...createFlashcard(currentFront, currentBack, currentTopic || undefined) });
        currentFront = null;
        currentBack = null;
      }
      continue;
    }

    // Parse "**Front**" followed by "**Back**"
    const frontBoldMatch = trimmed.match(/^\*\*(.+?)\*\*$/);
    if (frontBoldMatch && currentFront === null) {
      currentFront = frontBoldMatch[1].trim();
      continue;
    }

    const backBoldMatch = trimmed.match(/^\*\*(.+?)\*\*$/);
    if (backBoldMatch && currentFront !== null) {
      currentBack = backBoldMatch[1].trim();
      if (currentFront && currentBack) {
        cards.push({ ...createFlashcard(currentFront, currentBack, currentTopic || undefined) });
        currentFront = null;
        currentBack = null;
      }
      continue;
    }

    // If we have a front but no back, and this isn't a new format, treat as back
    if (currentFront && !currentBack && !trimmed.startsWith('-') && !trimmed.startsWith('*')) {
      currentBack = trimmed;
      cards.push({ ...createFlashcard(currentFront, currentBack, currentTopic || undefined) });
      currentFront = null;
      currentBack = null;
      continue;
    }

    if (!currentFront && !currentBack && !trimmed.startsWith('-') && !trimmed.startsWith('*')) {
      introLines.push(line);
    }
  }

  // Flush any remaining card
  if (currentFront && currentBack) {
    cards.push({ ...createFlashcard(currentFront, currentBack, currentTopic || undefined) });
  }

  if (cards.length < 2) return null;

  const deck: FlashcardDeck = {
    id: `deck_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: 'Κάρτες Επανάληψης',
    cards,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    totalCards: cards.length,
    masterCards: cards.filter((c) => c.repetitions >= 3).length,
  };

  return {
    introText: introLines.join('\n').trim(),
    deck,
  };
}

/**
 * Apply spaced repetition review result to a flashcard
 */
export function applyReviewToCard(card: Flashcard, result: ReviewResult): Flashcard {
  const updates = calculateNextReview(card, result);
  return { ...card, ...updates };
}

/**
 * Get cards due for review from a deck
 */
export function getDueCards(deck: FlashcardDeck): Flashcard[] {
  return deck.cards.filter((card) => card.nextReviewAt <= Date.now());
}

/**
 * Count statistics for a deck
 */
export function getDeckStats(deck: FlashcardDeck) {
  const now = Date.now();
  return {
    total: deck.cards.length,
    due: deck.cards.filter((c) => c.nextReviewAt <= now).length,
    newCards: deck.cards.filter((c) => c.repetitions === 0).length,
    learning: deck.cards.filter((c) => c.repetitions > 0 && c.repetitions < 3).length,
    mature: deck.cards.filter((c) => c.repetitions >= 3).length,
  };
}
