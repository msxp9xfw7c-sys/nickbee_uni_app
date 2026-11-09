/**
 * Spaced Repetition Algorithm (SM-2)
 * Implementation of the SM-2 algorithm for optimal flashcard learning
 * Reference: https://en.wikipedia.org/wiki/Spaced_repetition#SM-2
 */

import { Flashcard } from '../types';

export interface ReviewResult {
  quality: 0 | 1 | 2 | 3 | 4 | 5; // 0 = blackout, 5 = perfect recall
  correct: boolean;
}

const MIN_INTERVAL = 1; // minimum interval in days
const MIN_EASE_FACTOR = 1.3;
const DEFAULT_EASE_FACTOR = 2.5;

/**
 * Calculate next review date using SM-2 algorithm
 */
export function calculateNextReview(card: Flashcard, result: ReviewResult): Partial<Flashcard> {
  const { quality } = result;
  let newInterval: number;
  let newRepetitions = card.repetitions;
  let newEaseFactor = card.easeFactor;
  let newLapses = card.lapses;

  // Quality < 3 is incorrect
  if (quality < 3) {
    newLapses = card.lapses + 1;
    newRepetitions = 0;
    newInterval = MIN_INTERVAL;
    newEaseFactor = Math.max(MIN_EASE_FACTOR, card.easeFactor + 0.3 - (5 - quality) * 0.1);
  } else {
    // Quality >= 3 is correct
    newRepetitions = card.repetitions + 1;
    newEaseFactor = Math.max(MIN_EASE_FACTOR, card.easeFactor + 0.1 - (5 - quality) * 0.08);

    if (newRepetitions === 1) {
      newInterval = 1;
    } else if (newRepetitions === 2) {
      newInterval = 3;
    } else {
      newInterval = Math.round(card.interval * newEaseFactor);
    }
  }

  const nextReviewAt = Date.now() + newInterval * 24 * 60 * 60 * 1000;

  return {
    interval: newInterval,
    easeFactor: newEaseFactor,
    repetitions: newRepetitions,
    lapses: newLapses,
    nextReviewAt,
    lastReviewedAt: Date.now(),
    difficulty: getDifficultyLevel(quality),
  };
}

/**
 * Determine difficulty level based on SM-2 quality score
 */
function getDifficultyLevel(quality: number): 'easy' | 'medium' | 'hard' {
  if (quality === 5) return 'easy';
  if (quality >= 3) return 'medium';
  return 'hard';
}

/**
 * Get cards due for review
 */
export function getCardsDueForReview(deck: Flashcard[]): Flashcard[] {
  const now = Date.now();
  return deck.filter((card) => card.nextReviewAt <= now);
}

/**
 * Calculate deck statistics
 */
export interface DeckStats {
  total: number;
  new: number;
  learning: number;
  review: number;
  mature: number;
  due: number;
}

export function calculateDeckStats(deck: Flashcard[]): DeckStats {
  const now = Date.now();
  const stats: DeckStats = {
    total: deck.length,
    new: 0,
    learning: 0,
    review: 0,
    mature: 0,
    due: 0,
  };

  deck.forEach((card) => {
    if (card.repetitions === 0) {
      stats.new++;
    } else if (card.repetitions < 3) {
      stats.learning++;
    } else if (card.interval < 21) {
      stats.review++;
    } else {
      stats.mature++;
    }

    if (card.nextReviewAt <= now) {
      stats.due++;
    }
  });

  return stats;
}

/**
 * Create a new flashcard
 */
export function createFlashcard(front: string, back: string, topic?: string): Flashcard {
  return {
    id: `card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    front,
    back,
    topic,
    difficulty: 'hard',
    nextReviewAt: Date.now(), // Due immediately
    interval: 0,
    easeFactor: DEFAULT_EASE_FACTOR,
    repetitions: 0,
    lapses: 0,
  };
}

/**
 * Reset card for relearning
 */
export function resetCard(card: Flashcard): Partial<Flashcard> {
  return {
    repetitions: 0,
    lapses: 0,
    interval: 0,
    easeFactor: DEFAULT_EASE_FACTOR,
    nextReviewAt: Date.now(),
    difficulty: 'hard',
  };
}
