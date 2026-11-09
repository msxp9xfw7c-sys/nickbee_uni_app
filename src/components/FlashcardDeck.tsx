import React, { useState, useMemo } from 'react';
import MarkdownContent from '../lib/MarkdownContent';
import {
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Award,
  BookOpen,
  Check,
  X,
  Layers,
  Plus,
  ThumbsUp,
  ThumbsDown,
  Meh,
  Flame,
  RefreshCw,
  GraduationCap,
  Lock,
} from 'lucide-react';
import { AppTheme, Flashcard, FlashcardDeck as FlashcardDeckType } from '../types';
import { calculateNextReview } from '../utils/spacedRepetition';
import { getDeckStats } from '../utils/flashcardParser';

interface FlashcardDeckProps {
  deck: FlashcardDeckType;
  currentTheme: AppTheme;
  lang: 'el' | 'en';
  onAskFollowup?: (prompt: string) => void;
}

type ReviewQuality = 'again' | 'hard' | 'good' | 'easy';

const QUALITY_MAP: Record<ReviewQuality, 0 | 1 | 2 | 3 | 4 | 5> = {
  again: 1,
  hard: 3,
  good: 4,
  easy: 5,
};

export const FlashcardDeck: React.FC<FlashcardDeckProps> = ({
  deck: initialDeck,
  currentTheme,
  lang,
  onAskFollowup,
}) => {
  const [deckState, setDeckState] = useState<FlashcardDeckType>(initialDeck);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [cardQueue, setCardQueue] = useState<Flashcard[]>(initialDeck.cards);
  const [reviewStats, setReviewStats] = useState({
    reviewed: 0,
    correct: 0,
    againCount: 0,
  });
  const [sessionComplete, setSessionComplete] = useState(false);

  const stats = useMemo(() => getDeckStats(deckState), [deckState]);
  const currentCard = cardQueue[currentIndex] || deckState.cards[currentIndex];

  if (!currentCard) {
    return (
      <div className={`my-4 rounded-2xl border ${currentTheme.classes.borderPrimary} ${currentTheme.classes.bgCard} p-6 font-mono shadow-2xl text-center`}>
        <BookOpen className="w-8 h-8 text-amber-400 mx-auto mb-2" />
        <p className="text-sm text-slate-300">
          {lang === 'el' ? 'Η τράπουλα είναι άδεια.' : 'Deck is empty.'}
        </p>
      </div>
    );
  }

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleReview = (quality: ReviewQuality) => {
    if (!isFlipped) return;
    setSessionComplete(false);

    const reviewUpdates = calculateNextReview(currentCard, {
      quality: QUALITY_MAP[quality],
      correct: quality !== 'again',
    });

    // Merge partial updates with the existing card to produce a complete Flashcard
    const updatedCard: Flashcard = { ...currentCard, ...reviewUpdates };

    // Update deck state with the reviewed card
    const updatedCards = deckState.cards.map((c) =>
      c.id === currentCard.id ? { ...c, ...reviewUpdates } : c
    );
    const updatedDeck: FlashcardDeckType = {
      ...deckState,
      cards: updatedCards,
      masterCards: updatedCards.filter((c) => c.repetitions >= 3).length,
      updatedAt: new Date().toISOString(),
    };

    setDeckState(updatedDeck);

    // If "again" or "hard", push card to end of queue for re-review
    const shouldRequeue = quality === 'again' || quality === 'hard';
    let newQueue = [...cardQueue];

    if (shouldRequeue) {
      newQueue.push(updatedCard);
    }

    // Move to next card
    const nextIndex = currentIndex + 1;
    if (nextIndex >= newQueue.length) {
      // All cards reviewed - show session complete
      // Reset for a new round if there were requeued cards
      if (newQueue.length > deckState.cards.length) {
        setCardQueue(newQueue);
        setCurrentIndex(0);
      } else {
        setCardQueue(deckState.cards);
        setCurrentIndex(0);
        setSessionComplete(true);
      }
    } else {
      setCardQueue(newQueue);
      setCurrentIndex(nextIndex);
    }

    setIsFlipped(false);

    setReviewStats((prev) => ({
      ...prev,
      reviewed: prev.reviewed + 1,
      correct: prev.correct + (quality !== 'again' ? 1 : 0),
      againCount: prev.againCount + (quality === 'again' ? 1 : 0),
    }));
  };

  const handleRestart = () => {
    setCardQueue(deckState.cards);
    setCurrentIndex(0);
    setIsFlipped(false);
    setSessionComplete(false);
    setReviewStats({ reviewed: 0, correct: 0, againCount: 0 });
  };

  const handleResetCard = () => {
    const resetCard: Flashcard = {
      ...currentCard,
      repetitions: 0,
      lapses: 0,
      interval: 0,
      easeFactor: 2.5,
      nextReviewAt: Date.now(),
      difficulty: 'hard',
    };

    const updatedDeck: FlashcardDeckType = {
      ...deckState,
      cards: deckState.cards.map((c) => (c.id === currentCard.id ? resetCard : c)),
      updatedAt: new Date().toISOString(),
    };

    setDeckState(updatedDeck);
  };

  const progressPercent = Math.round((currentIndex / Math.max(1, cardQueue.length)) * 100);

  if (sessionComplete) {
    return (
      <div className={`my-4 rounded-2xl border ${currentTheme.classes.borderPrimary} ${currentTheme.classes.bgCard} p-6 font-mono shadow-2xl text-center`}>
        <Award className="w-9 h-9 text-emerald-400 mx-auto mb-2" />
        <h4 className="text-lg font-black text-white">{lang === 'el' ? 'Ολοκλήρωσες την επανάληψη!' : 'Review session complete!'}</h4>
        <p className="text-xs text-slate-300 mt-2">{reviewStats.correct}/{reviewStats.reviewed} {lang === 'el' ? 'κάρτες χωρίς ξανά' : 'cards without needing another pass'}</p>
        <button onClick={handleRestart} className={`mt-4 px-4 py-2 rounded-xl text-xs font-bold ${currentTheme.classes.btnPrimary} ${currentTheme.classes.btnPrimaryHover} cursor-pointer`}>
          {lang === 'el' ? 'Νέα επανάληψη' : 'Review again'}
        </button>
      </div>
    );
  }

  return (
    <div
      className={`my-4 rounded-2xl border ${currentTheme.classes.borderPrimary} ${currentTheme.classes.bgCard} p-4 sm:p-6 font-mono shadow-2xl relative overflow-hidden transition-all`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm sm:text-base font-bold text-white font-mono">
                {deckState.name || (lang === 'el' ? 'Κάρτες Επανάληψης' : 'Flashcards')}
              </h4>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-400/20 text-amber-300 border border-amber-400/40 font-bold uppercase tracking-wider">
                {lang === 'el' ? 'SM-2' : 'Spaced Rep.'}
              </span>
            </div>
            {deckState.description && (
              <p className="text-xs text-slate-400 font-sans mt-0.5">{deckState.description}</p>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="px-2.5 py-1 rounded-lg bg-black/40 border border-white/10 text-[11px] text-slate-300 flex items-center gap-1.5">
            <Layers className="w-3 h-3 text-amber-400" />
            <span>{cardQueue.length} {lang === 'el' ? 'κάρτες' : 'cards'}</span>
          </div>
          <div className="px-2.5 py-1 rounded-lg bg-black/40 border border-white/10 text-[11px] text-slate-300 flex items-center gap-1.5">
            <Flame className="w-3 h-3 text-amber-400" />
            <span>{stats.due} {lang === 'el' ? 'λόγω' : 'due'}</span>
          </div>
          <div className="px-2.5 py-1 rounded-lg bg-black/40 border border-white/10 text-[11px] text-emerald-300 flex items-center gap-1.5">
            <Check className="w-3 h-3" />
            <span>{stats.mature} {lang === 'el' ? 'ώριμες' : 'mature'}</span>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-4 space-y-1.5">
        <div className="flex items-center justify-between text-xs font-mono text-slate-400">
          <span>
            {lang === 'el'
              ? `Κάρτα ${Math.min(currentIndex + 1, cardQueue.length)} από ${cardQueue.length}`
              : `Card ${Math.min(currentIndex + 1, cardQueue.length)} of ${cardQueue.length}`}
          </span>
          <span className="text-amber-300 font-bold">
            {cardQueue.length > 0 ? Math.round(((currentIndex + 1) / cardQueue.length) * 100) : 100}%
          </span>
        </div>
        <div className="w-full h-2 bg-black/50 rounded-full overflow-hidden border border-white/10">
          <div
            className="h-full bg-linear-to-r from-amber-500 to-amber-300 transition-all duration-300 rounded-full shadow-sm shadow-amber-500/50"
            style={{ width: `${Math.round(((currentIndex + 1) / cardQueue.length) * 100)}%` }}
          />
        </div>
      </div>

      {/* Flashcard Body */}
      <div className="mt-4 space-y-4 animate-fade-in">
        {/* Card Flip Area */}
        <div
          onClick={handleFlip}
          className="relative p-6 sm:p-8 min-h-60 rounded-2xl bg-linear-to-br from-black/60 to-black/90 border border-amber-500/40 hover:border-amber-400 cursor-pointer transition-all flex flex-col justify-between shadow-xl select-none"
          style={{ perspective: '1200px' }}
        >
          <div className="flex items-center justify-between text-xs text-amber-400 font-mono">
            <span className="flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold">
                {currentCard.topic || deckState.name}
              </span>
            </span>
            <span className="text-[11px] text-slate-400">
              {isFlipped
                ? lang === 'el'
                  ? '🔄 Κλικ για Ερώτηση'
                  : '🔄 Click for Question'
                : lang === 'el'
                ? '🔄 Κλικ για Απάντηση'
                : '🔄 Click to Reveal'}
            </span>
          </div>

          <div className="py-6 text-center">
            {!isFlipped ? (
              <div className="animate-fade-in">
                <span className="text-[10px] uppercase tracking-widest text-slate-400 mb-3 block font-mono">
                  {lang === 'el' ? 'ΕΡΩΤΗΣΗ — Προσπάθησε να θυμηθείς' : 'QUESTION — Try to recall'}
                </span>
                <div className="text-base sm:text-lg font-bold text-white font-sans markdown-body max-w-md mx-auto">
                  <MarkdownContent>{currentCard.front}</MarkdownContent>
                </div>
              </div>
            ) : (
              <div className="space-y-2 animate-fade-in">
                <span className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold block font-mono">
                  {lang === 'el' ? '✓ ΑΠΑΝΤΗΣΗ' : '✓ ANSWER'}
                </span>
                <div className="text-base sm:text-lg font-bold text-emerald-300 font-sans markdown-body max-w-md mx-auto">
                  <MarkdownContent>{currentCard.back}</MarkdownContent>
                </div>
              </div>
            )}
          </div>

          <div className="text-[10px] text-center text-slate-500 font-mono">
            {isFlipped
              ? lang === 'el' ? 'Πόσο εύκολη ήταν;' : 'How well did you know it?'
              : lang === 'el' ? 'Πατώντας την κάρτα θα δεις την απάντηση' : 'Tap card to reveal answer'}
          </div>
        </div>

        {/* Review Controls (only when flipped) */}
        {isFlipped && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 animate-fade-in">
            <button
              onClick={() => handleReview('again')}
              className="p-3 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 border border-rose-500/50 text-rose-200 flex flex-col items-center gap-1.5 transition-all cursor-pointer"
            >
              <X className="w-5 h-5 text-rose-400" />
              <span className="text-xs font-bold">{lang === 'el' ? 'Ξανά' : 'Again'}</span>
              <span className="text-[10px] opacity-70">{`< 1 λεπτό`}</span>
            </button>

            <button
              onClick={() => handleReview('hard')}
              className="p-3 rounded-xl bg-amber-950/60 hover:bg-amber-900/80 border border-amber-500/50 text-amber-200 flex flex-col items-center gap-1.5 transition-all cursor-pointer"
            >
              <Flame className="w-5 h-5 text-amber-400" />
              <span className="text-xs font-bold">{lang === 'el' ? 'Δύσκολη' : 'Hard'}</span>
              <span className="text-[10px] opacity-70">1 λεπτό</span>
            </button>

            <button
              onClick={() => handleReview('good')}
              className="p-3 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-500/50 text-emerald-200 flex flex-col items-center gap-1.5 transition-all cursor-pointer"
            >
              <Check className="w-5 h-5 text-emerald-400" />
              <span className="text-xs font-bold">{lang === 'el' ? 'Καλή' : 'Good'}</span>
              <span className="text-[10px] opacity-70">3 λεπτά</span>
            </button>

            <button
              onClick={() => handleReview('easy')}
              className="p-3 rounded-xl bg-sky-950/60 hover:bg-sky-900/80 border border-sky-500/50 text-sky-200 flex flex-col items-center gap-1.5 transition-all cursor-pointer"
            >
              <ThumbsUp className="w-5 h-5 text-sky-400" />
              <span className="text-xs font-bold">{lang === 'el' ? 'Εύκολη' : 'Easy'}</span>
              <span className="text-[10px] opacity-70">4 λεπτά</span>
            </button>
          </div>
        )}

        {/* Navigation Controls */}
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => {
              if (currentIndex > 0) {
                setCurrentIndex(currentIndex - 1);
                setIsFlipped(false);
              }
            }}
            disabled={currentIndex === 0}
            className="px-3.5 py-2 rounded-xl border border-white/10 text-xs font-bold text-slate-300 hover:border-white/30 disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>{lang === 'el' ? 'Προηγούμενη' : 'Previous'}</span>
          </button>

          <button
            onClick={handleRestart}
            className="px-3 py-2 rounded-xl border border-white/10 text-xs font-bold text-slate-300 hover:border-amber-400 flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
            <span>{lang === 'el' ? 'Επανάληψη' : 'Restart'}</span>
          </button>

          <button
            onClick={() => {
              if (currentIndex < cardQueue.length - 1) {
                setCurrentIndex(currentIndex + 1);
                setIsFlipped(false);
              }
            }}
            disabled={currentIndex >= cardQueue.length - 1}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold ${currentTheme.classes.btnPrimary} ${currentTheme.classes.btnPrimaryHover} flex items-center gap-1.5 cursor-pointer transition-all`}
          >
            <span>{lang === 'el' ? 'Επόμενη' : 'Next'}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Session Stats Footer */}
        <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1.5">
              <Check className="w-3 h-3 text-emerald-400" />
              <span>{lang === 'el' ? 'Σωστές:' : 'Correct:'} {reviewStats.correct}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <X className="w-3 h-3 text-rose-400" />
              <span>{lang === 'el' ? 'Ξανά:' : 'Again:'} {reviewStats.againCount}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <RefreshCw className="w-3 h-3 text-slate-400" />
              <span>{lang === 'el' ? 'Σύνολο:' : 'Total:'} {reviewStats.reviewed}</span>
            </span>
          </div>

          {onAskFollowup && (
            <button
              onClick={() =>
                onAskFollowup(
                  lang === 'el'
                    ? `Δυσκολεύομαι με την κάρτα "${currentCard.front}". Μπορείς να μου δώσεις μια πιο αναλυτική επεξήγηση;`
                    : `I'm struggling with card "${currentCard.front}". Can you provide a more detailed explanation?`
                )
              }
              className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <GraduationCap className="w-3 h-3" />
              <span>{lang === 'el' ? 'Ρώτα AI' : 'Ask AI'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
