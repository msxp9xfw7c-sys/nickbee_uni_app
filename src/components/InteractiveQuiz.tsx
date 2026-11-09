import React, { useState, useEffect } from 'react';
import MarkdownContent from '../lib/MarkdownContent';
import {
  Award,
  RotateCcw,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  BookOpen,
  Copy,
  Check,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  PlusCircle,
  Share2,
  TrendingUp,
  AlertTriangle,
  HelpCircle,
  Flame,
  FileCheck2,
  Maximize2,
} from 'lucide-react';
import { QuizData, QuizQuestion, AppTheme } from '../types';

interface InteractiveQuizProps {
  quiz: QuizData;
  currentTheme: AppTheme;
  lang: 'el' | 'en';
  onAskFollowup?: (prompt: string) => void;
  isActive?: boolean;
}

type QuizViewMode = 'slides' | 'flashcards' | 'list';

export const InteractiveQuiz: React.FC<InteractiveQuizProps> = ({
  quiz: initialQuiz,
  currentTheme,
  lang,
  onAskFollowup,
  isActive = true,
}) => {
  const [quizData, setQuizData] = useState<QuizData>(initialQuiz);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [isCompleted, setIsCompleted] = useState(false);
  const [viewMode, setViewMode] = useState<QuizViewMode>('slides');
  const [isFlipped, setIsFlipped] = useState(false);
  const [copied, setCopied] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerActive, setTimerActive] = useState(true);
  const [onlyMistakesMode, setOnlyMistakesMode] = useState(false);
  const [activeQuestions, setActiveQuestions] = useState<QuizQuestion[]>(initialQuiz.questions || []);
  const [customAddOpen, setCustomAddOpen] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');

  const quizSignature = React.useMemo(() => {
    return `${initialQuiz.title || ''}_${initialQuiz.questions?.length || 0}_${initialQuiz.questions?.[0]?.question || ''}`;
  }, [initialQuiz.title, initialQuiz.questions]);

  const prevSignatureRef = React.useRef(quizSignature);

  // Sync only if quiz content actually changes
  useEffect(() => {
    if (prevSignatureRef.current !== quizSignature) {
      prevSignatureRef.current = quizSignature;
      setQuizData(initialQuiz);
      setActiveQuestions(initialQuiz.questions || []);
      setSelectedAnswers({});
      setCurrentIndex(0);
      setIsCompleted(false);
      setTimerSeconds(0);
      setTimerActive(true);
    }
  }, [quizSignature, initialQuiz]);

  // Timer tick
  useEffect(() => {
    let interval: any = null;
    if (timerActive && !isCompleted && isActive) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerActive, isCompleted, isActive]);

  const totalQuestions = activeQuestions.length;
  if (totalQuestions === 0) return null;

  const currentQ = activeQuestions[currentIndex] || activeQuestions[0];
  const userSelected = selectedAnswers[currentIndex];
  const isAnswered = userSelected !== undefined;

  const formatTimer = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSelectOption = (optIndex: number) => {
    if (isAnswered) return;
    setSelectedAnswers((prev) => ({ ...prev, [currentIndex]: optIndex }));
  };

  const handleNext = () => {
    setIsFlipped(false);
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setIsCompleted(true);
      setTimerActive(false);
    }
  };

  const handlePrev = () => {
    setIsFlipped(false);
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleRestartFull = () => {
    setActiveQuestions(quizData.questions);
    setOnlyMistakesMode(false);
    setSelectedAnswers({});
    setCurrentIndex(0);
    setIsCompleted(false);
    setTimerSeconds(0);
    setTimerActive(true);
    setIsFlipped(false);
  };

  const handleRetakeMistakesOnly = () => {
    const missedQuestions = activeQuestions.filter(
      (q, idx) => selectedAnswers[idx] !== undefined && selectedAnswers[idx] !== q.correctIndex
    );
    if (missedQuestions.length === 0) return;

    setActiveQuestions(missedQuestions);
    setOnlyMistakesMode(true);
    setSelectedAnswers({});
    setCurrentIndex(0);
    setIsCompleted(false);
    setTimerSeconds(0);
    setTimerActive(true);
    setIsFlipped(false);
  };

  // Performance calculations
  const correctCount = Object.entries(selectedAnswers).filter(
    ([qIndex, optIndex]) => activeQuestions[Number(qIndex)]?.correctIndex === optIndex
  ).length;

  const scorePercentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

  // Topic Breakdown Analytics
  const topicStats: Record<string, { total: number; correct: number }> = {};
  activeQuestions.forEach((q, idx) => {
    const topic = q.topic || quizData.courseName || (lang === 'el' ? 'Γενική Ύλη' : 'General Topic');
    if (!topicStats[topic]) {
      topicStats[topic] = { total: 0, correct: 0 };
    }
    topicStats[topic].total += 1;
    if (selectedAnswers[idx] === q.correctIndex) {
      topicStats[topic].correct += 1;
    }
  });

  const getGradeInfo = () => {
    if (scorePercentage >= 90) {
      return {
        label: lang === 'el' ? 'Άριστα (Grade A+)' : 'Excellent (Grade A+)',
        color: 'text-emerald-400',
        badge: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300',
        message:
          lang === 'el'
            ? 'Εξαιρετική επίδοση! Έχεις εμπεδώσει πλήρως τις βασικές αρχές και τις λεπτομέρειες της ύλης.'
            : 'Outstanding performance! You have mastered both the core fundamentals and nuances of the syllabus.',
        studyAdvice:
          lang === 'el'
            ? 'Συνέχισε με επίλυση παλαιότερων θεμάτων εξετάσεων ή δοκίμασε ερωτήσεις υψηλότερης δυσκολίας.'
            : 'Proceed to past exam papers or request higher difficulty mock tests.',
      };
    }
    if (scorePercentage >= 70) {
      return {
        label: lang === 'el' ? 'Πολύ Καλά (Grade B)' : 'Very Good (Grade B)',
        color: 'text-amber-400',
        badge: 'bg-amber-500/20 border-amber-500/40 text-amber-300',
        message:
          lang === 'el'
            ? 'Πολύ καλή κατανόηση της ύλης! Με μια σύντομη επανάληψη στα αδύναμα σημεία θα κλειδώσεις το 10.'
            : 'Great grasp of the syllabus! A targeted review on weak topics will secure a top grade.',
        studyAdvice:
          lang === 'el'
            ? 'Επανάλαβε τις επεξηγήσεις στις ερωτήσεις που απάντησες λάθος και ζήτησε διευκρινίσεις.'
            : 'Review the explanations for missed questions and request clarifications.',
      };
    }
    if (scorePercentage >= 50) {
      return {
        label: lang === 'el' ? 'Βάση / Ικανοποιητικά (Grade C)' : 'Passing (Grade C)',
        color: 'text-amber-300',
        badge: 'bg-amber-600/20 border-amber-600/40 text-amber-300',
        message:
          lang === 'el'
            ? 'Πέρασες τη βάση, αλλά υπάρχουν βασικά κενά σε ορισμένες έννοιες.'
            : 'Passed the baseline, but there are conceptual gaps in specific chapters.',
        studyAdvice:
          lang === 'el'
            ? 'Δοκίμασε τη λειτουργία Flashcards και ζήτησε από το AI σύνοψη θεωρίας για τα κεφάλαια με λάθη.'
            : 'Use Flashcards mode and ask AI for concise theoretical summaries of weak chapters.',
      };
    }
    return {
      label: lang === 'el' ? 'Χρειάζεται Επανάληψη (Grade D/F)' : 'Needs Revision (Grade D/F)',
      color: 'text-rose-400',
      badge: 'bg-rose-500/20 border-rose-500/40 text-rose-300',
      message:
        lang === 'el'
          ? 'Μην ανησυχείς! Η εξάσκηση είναι μέρος της μάθησης. Επανάλαβε τη θεωρία και ξαναδοκίμασε.'
          : 'Do not worry! Learning takes practice. Review the key lecture concepts and retake the quiz.',
      studyAdvice:
        lang === 'el'
          ? 'Ζήτησε άμεσα από το AI εκπαιδευτικό πλάνο μελέτης και επανάληψη των βασικών ορισμών.'
          : 'Ask AI for a structured revision roadmap and foundational definitions.',
    };
  };

  const grade = getGradeInfo();

  // Export Quiz
  const handleCopyQuiz = () => {
    let text = `🎓 ${quizData.title}\n`;
    if (quizData.courseName) text += `📚 Μάθημα: ${quizData.courseName}\n`;
    text += `⏱️ Χρόνος: ${formatTimer(timerSeconds)} | Σκορ: ${correctCount}/${totalQuestions} (${scorePercentage}%)\n\n`;

    activeQuestions.forEach((q, idx) => {
      text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      text += `Διαφάνεια ${idx + 1}: ${q.question}\n`;
      if (q.topic) text += `[Θεματική: ${q.topic}]\n`;
      q.options.forEach((opt, oIdx) => {
        const letter = String.fromCharCode(65 + oIdx);
        text += `  [${letter}] ${opt}\n`;
      });
      const correctLetter = String.fromCharCode(65 + q.correctIndex);
      text += `✓ Σωστή Απάντηση: [${correctLetter}] ${q.options[q.correctIndex]}\n`;
      text += `💡 Επεξήγηση: ${q.explanation}\n\n`;
    });

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Add more questions actions
  const handleRequestMoreQuestions = (type: 'more' | 'hard' | 'traps' | 'custom') => {
    if (!onAskFollowup) return;

    const currentTitle = quizData.title || quizData.courseName || 'την ύλη του μαθήματος';

    if (type === 'more') {
      onAskFollowup(
        `Πρόσθεσε 5 νέες διαφάνειες/ερωτήσεις πολλαπλής επιλογής για την ύλη "${currentTitle}" ώστε να επεκτείνω το κουίζ μου.`
      );
    } else if (type === 'hard') {
      onAskFollowup(
        `Δημιούργησε 5 νέες ερωτήσεις υψηλής δυσκολίας (Επίπεδο Τελικών Εξετάσεων) για "${currentTitle}" με λεπτομερή ανάλυση.`
      );
    } else if (type === 'traps') {
      onAskFollowup(
        `Δημιούργησε 5 ερωτήσεις με SOS παγίδες εξετάσεων και παραπλανητικές επιλογές για "${currentTitle}".`
      );
    } else if (type === 'custom' && customPrompt.trim()) {
      onAskFollowup(
        `Πρόσθεσε ερωτήσεις πολλαπλής επιλογής στο κουίζ για "${currentTitle}" με βάση το εξής: ${customPrompt.trim()}`
      );
      setCustomPrompt('');
      setCustomAddOpen(false);
    }
  };

  return (
    <div
      className={`my-2 box-border w-full min-w-0 max-w-full overflow-x-clip overscroll-contain rounded-2xl border ${currentTheme.classes.borderPrimary} ${currentTheme.classes.bgCard} p-3 sm:p-4 font-sans shadow-2xl relative transition-all ${
        viewMode === 'slides'
          ? 'flex h-[calc(100dvh-15rem)] min-h-0 flex-col overflow-y-hidden'
          : 'max-h-[calc(100dvh-15rem)] overflow-y-auto'
      }`}
    >
      <div className="z-30 -mx-3 -mt-3 mb-2 shrink-0 bg-slate-950/95 px-3 pt-3 backdrop-blur-md sm:-mx-4 sm:-mt-4 sm:px-4 sm:pt-4">
      {/* Top Banner / Slide Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm sm:text-base font-bold text-white font-mono flex items-center gap-2">
                <span>{quizData.title || (lang === 'el' ? 'Διαφάνειες Ακαδημαϊκού Κουίζ' : 'Academic Quiz Slides')}</span>
              </h4>
              {quizData.difficulty && (
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-400/20 text-amber-300 border border-amber-400/40 font-bold uppercase tracking-wider">
                  {quizData.difficulty}
                </span>
              )}
              {onlyMistakesMode && (
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold">
                  {lang === 'el' ? 'Επανάληψη Λαθών' : 'Mistakes Mode'}
                </span>
              )}
            </div>
            {quizData.courseName && (
              <span className="text-xs text-slate-400 font-sans">{quizData.courseName}</span>
            )}
          </div>
        </div>

        {/* View Mode Controls & Timer */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Timer Display */}
          <div className="px-2.5 py-1 rounded-lg bg-black/40 border border-white/10 text-slate-300 text-xs flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-mono">{formatTimer(timerSeconds)}</span>
          </div>

          {/* Export / Copy Button */}
          <button
            onClick={handleCopyQuiz}
            className="px-2.5 py-1 rounded-lg text-xs border border-white/10 hover:border-amber-400/40 text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
            title={lang === 'el' ? 'Αντιγραφή Διαφανειών & Απαντήσεων' : 'Export & Copy'}
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="text-[11px] hidden sm:inline">
              {copied ? (lang === 'el' ? 'Αντιγράφηκε' : 'Copied') : (lang === 'el' ? 'Εξαγωγή' : 'Export')}
            </span>
          </button>
        </div>
      </div>

      {/* Progress Bar & Slide Index Indicator */}
      {!isCompleted && viewMode !== 'list' && (
        <div className="space-y-1.5 border-b border-white/10 py-2">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span>
              {lang === 'el'
                ? `Διαφάνεια ${currentIndex + 1} από ${totalQuestions}`
                : `Slide ${currentIndex + 1} of ${totalQuestions}`}
            </span>
            <span className="text-amber-300 font-bold">
              {Math.round(((currentIndex + 1) / totalQuestions) * 100)}%
            </span>
          </div>
          <div className="w-full h-2 bg-black/50 rounded-full overflow-hidden border border-white/10">
            <div
              className="h-full bg-linear-to-r from-amber-500 to-amber-300 transition-all duration-300 rounded-full shadow-sm shadow-amber-500/50"
              style={{
                width: `${((currentIndex + 1) / totalQuestions) * 100}%`,
              }}
            />
          </div>
        </div>
      )}
      </div>

      {!isCompleted && viewMode === 'slides' && (
        <div className="mb-2 min-w-0 shrink-0 rounded-2xl border border-white/10 bg-black/40 p-3 shadow-inner sm:p-4">
          <div className="mb-2 flex items-center justify-between gap-2 text-[11px] font-bold uppercase tracking-widest text-amber-400">
            <span className="flex items-center gap-1.5">
              <Flame className="size-3.5" />
              {lang === 'el' ? `ΕΡΩΤΗΣΗ #${currentIndex + 1}` : `QUESTION #${currentIndex + 1}`}
            </span>
            {currentQ.topic && <span className="rounded border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-normal text-slate-400">{currentQ.topic}</span>}
          </div>
          <h3 className="text-sm font-bold leading-relaxed text-slate-100 sm:text-base">
            <MarkdownContent>{currentQ.question}</MarkdownContent>
          </h3>
        </div>
      )}

      {/* Main Content Area */}
      {!isCompleted ? (
        viewMode === 'slides' ? (
          /* ========================================================================= */
          /* 1. SLIDES MODE (Gemini / Quiz Style)                                      */
          /* ========================================================================= */
          <div className="mt-1 flex min-h-0 min-w-0 flex-1 flex-col wrap-anywhere animate-fade-in">
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-1">
            {/* Slide Options (A, B, C, D) */}
            <div className="grid grid-cols-1 gap-2.5">
              {currentQ.options.map((option, optIdx) => {
                const optionLetter = String.fromCharCode(65 + optIdx);
                const isOptionSelected = userSelected === optIdx;
                const isCorrectOption = currentQ.correctIndex === optIdx;

                let optionStyle =
                  'bg-black/30 border-white/10 text-slate-200 hover:border-amber-400 hover:bg-white/5';

                if (isAnswered) {
                  if (isCorrectOption) {
                    optionStyle =
                      'bg-emerald-950/60 border-emerald-500/80 text-emerald-100 shadow-md shadow-emerald-900/30';
                  } else if (isOptionSelected) {
                    optionStyle =
                      'bg-rose-950/60 border-rose-500/80 text-rose-100 shadow-md shadow-rose-900/30';
                  } else {
                    optionStyle = 'bg-black/20 border-white/5 text-slate-500 opacity-50';
                  }
                }

                return (
                  <button
                    key={optIdx}
                    onClick={() => handleSelectOption(optIdx)}
                    disabled={isAnswered}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-start gap-3.5 cursor-pointer group ${optionStyle}`}
                  >
                    <span
                      className={`w-7 h-7 rounded-lg text-xs font-bold font-mono flex items-center justify-center shrink-0 mt-0.5 border transition-all ${
                        isAnswered && isCorrectOption
                          ? 'bg-emerald-500 text-black border-emerald-400 shadow-sm'
                          : isAnswered && isOptionSelected
                          ? 'bg-rose-500 text-white border-rose-400'
                          : 'bg-white/10 text-amber-300 border-white/20 group-hover:bg-amber-400 group-hover:text-black group-hover:border-amber-400'
                      }`}
                    >
                      {optionLetter}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="text-xs sm:text-sm font-sans font-medium markdown-body">
                        <MarkdownContent>{option}</MarkdownContent>
                      </div>
                    </div>

                    {isAnswered && isCorrectOption && (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    )}
                    {isAnswered && isOptionSelected && !isCorrectOption && (
                      <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Explanation Callout */}
            {isAnswered && currentQ.explanation && (
              <div className="p-4 rounded-xl bg-linear-to-r from-amber-950/40 to-black/60 border border-amber-500/40 text-xs text-amber-200/95 font-sans animate-fade-in space-y-1.5 shadow-lg">
                <div className="flex items-center gap-2 font-bold font-mono text-amber-300 text-xs uppercase tracking-wider">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>{lang === 'el' ? 'Ακαδημαϊκή Επεξήγηση & Ανάλυση' : 'Academic Explanation & Analysis'}</span>
                </div>
                <div className="markdown-body leading-relaxed text-slate-200">
                  <MarkdownContent>{currentQ.explanation}</MarkdownContent>
                </div>
              </div>
            )}
            </div>

            {/* Slide Navigation Controls */}
            <div className="-mx-3 -mb-3 mt-2 flex shrink-0 items-center justify-between gap-2 border-t border-white/10 bg-slate-950 px-3 pb-3 pt-3 sm:-mx-4 sm:-mb-4 sm:px-4 sm:pb-4">
              <button
                onClick={handlePrev}
                disabled={currentIndex === 0}
                aria-label={lang === 'el' ? 'Προηγούμενη διαφάνεια' : 'Previous slide'}
                className="px-2.5 py-2 sm:px-3.5 rounded-xl border border-white/10 text-xs font-bold text-slate-300 hover:border-white/30 disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">{lang === 'el' ? 'Προηγούμενη Διαφάνεια' : 'Previous Slide'}</span>
              </button>

              {isAnswered ? (
                <button
                  onClick={handleNext}
                  className={`px-3 sm:px-5 py-2 rounded-xl text-xs font-bold ${currentTheme.classes.btnPrimary} ${currentTheme.classes.btnPrimaryHover} shadow-lg flex items-center gap-2 cursor-pointer transition-all`}
                >
                  <span>
                    {currentIndex === totalQuestions - 1
                      ? lang === 'el'
                        ? 'Ολοκλήρωση'
                        : 'Finish & View Performance'
                      : lang === 'el'
                      ? 'Επόμενη'
                      : 'Next Slide'}
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <span className="text-xs text-slate-500 italic font-sans">
                  {lang === 'el' ? 'Επέλεξε μία απάντηση για να συνεχίσεις' : 'Select an answer to continue'}
                </span>
              )}
            </div>
          </div>
        ) : viewMode === 'flashcards' ? (
          /* ========================================================================= */
          /* 2. FLASHCARDS / FLIP CARDS MODE                                           */
          /* ========================================================================= */
          <div className="mt-3 min-w-0 space-y-3 wrap-anywhere animate-fade-in">
            <div
              onClick={() => setIsFlipped(!isFlipped)}
              className="p-6 sm:p-8 min-h-55 rounded-2xl bg-linear-to-br from-black/60 to-black/90 border border-amber-500/40 hover:border-amber-400 cursor-pointer transition-all flex flex-col justify-between shadow-xl relative select-none"
            >
              <div className="flex items-center justify-between text-xs text-amber-400 font-mono">
                <span>{lang === 'el' ? `ΚΑΡΤΑ ΜΕΛΕΤΗΣ #${currentIndex + 1}` : `FLASHCARD #${currentIndex + 1}`}</span>
                <span className="text-[11px] text-slate-400">
                  {isFlipped
                    ? lang === 'el'
                      ? '💡 Κλικ για Ερώτηση'
                      : '💡 Click to see Question'
                    : lang === 'el'
                    ? '🔄 Κλικ για Απάντηση'
                    : '🔄 Click to Flip'}
                </span>
              </div>

              <div className="py-4 text-center">
                {!isFlipped ? (
                  <div>
                    <span className="text-[10px] uppercase tracking-widest text-slate-400 mb-2 block font-mono">
                      {lang === 'el' ? 'ΕΡΩΤΗΣΗ' : 'QUESTION'}
                    </span>
                    <p className="text-base sm:text-lg font-bold text-white font-sans">
                      {currentQ.question}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 animate-fade-in">
                    <span className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold block font-mono">
                      {lang === 'el' ? '✓ ΣΩΣΤΗ ΑΠΑΝΤΗΣΗ' : '✓ CORRECT ANSWER'}
                    </span>
                    <p className="text-base sm:text-lg font-bold text-emerald-300 font-sans">
                      {currentQ.options[currentQ.correctIndex]}
                    </p>
                    <div className="markdown-body text-xs text-slate-300 font-sans pt-2 border-t border-white/10 leading-relaxed">
                      <MarkdownContent>{currentQ.explanation}</MarkdownContent>
                    </div>
                  </div>
                )}
              </div>

              <div className="text-[10px] text-center text-slate-500 font-mono">
                {currentQ.topic || quizData.courseName}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className="px-3.5 py-2 rounded-xl border border-white/10 text-xs font-bold text-slate-300 hover:border-white/30 disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1.5 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>{lang === 'el' ? 'Προηγούμενη' : 'Previous'}</span>
              </button>

              <button
                onClick={() => setIsFlipped(!isFlipped)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-amber-300 flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{lang === 'el' ? 'Αναστροφή Κάρτας' : 'Flip Card'}</span>
              </button>

              <button
                onClick={handleNext}
                className={`px-4 py-2 rounded-xl text-xs font-bold ${currentTheme.classes.btnPrimary} ${currentTheme.classes.btnPrimaryHover} flex items-center gap-1.5 cursor-pointer`}
              >
                <span>
                  {currentIndex === totalQuestions - 1
                    ? lang === 'el'
                      ? 'Τέλος Καρτών'
                      : 'Finish Deck'
                    : lang === 'el'
                    ? 'Επόμενη'
                    : 'Next'}
                </span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* 3. FULL LIST REVIEW MODE                                                  */
          /* ========================================================================= */
          <div className="mt-4 space-y-4 max-h-120 overflow-y-auto pr-1 animate-fade-in">
            {activeQuestions.map((q, qIdx) => (
              <div
                key={q.id || qIdx}
                className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-2.5"
              >
                <div className="flex items-center justify-between text-xs font-mono text-amber-400 font-bold">
                  <span>{lang === 'el' ? `Διαφάνεια ${qIdx + 1}` : `Slide ${qIdx + 1}`}</span>
                  {q.topic && <span className="text-[10px] text-slate-400 font-normal">{q.topic}</span>}
                </div>
                <p className="text-xs sm:text-sm font-semibold text-white font-sans">{q.question}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {q.options.map((opt, oIdx) => {
                    const isCorrect = oIdx === q.correctIndex;
                    return (
                      <div
                        key={oIdx}
                        className={`p-2 rounded-lg text-xs font-sans border flex items-center gap-2 ${
                          isCorrect
                            ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-200 font-bold'
                            : 'bg-black/30 border-white/5 text-slate-400'
                        }`}
                      >
                        <span className="font-mono text-[10px] font-bold text-amber-400">
                          [{String.fromCharCode(65 + oIdx)}]
                        </span>
                        <span>{opt}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="markdown-body text-[11px] text-slate-300 font-sans bg-white/5 p-2.5 rounded-lg border border-white/5">
                  <span>💡 <span className="font-bold text-amber-300">Ανάλυση:</span>{' '}</span>
                  <MarkdownContent>{q.explanation}</MarkdownContent>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* ========================================================================= */
        /* 4. PERFORMANCE & COMPREHENSIVE ASSESSMENT DASHBOARD (FINAL SLIDE)         */
        /* ========================================================================= */
        <div className="mt-5 space-y-6 animate-fade-in">
          {/* Header Score Card */}
          <div className="p-5 sm:p-6 rounded-2xl bg-linear-to-b from-black/70 to-black/90 border border-white/15 text-center space-y-3 relative overflow-hidden shadow-2xl">
            <div className="inline-flex p-3 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-md">
              <Award className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-xl sm:text-2xl font-black text-white font-mono">
                {lang === 'el' ? 'Πίνακας Αξιολόγησης Επιδόσεων' : 'Performance Assessment Dashboard'}
              </h3>
              <p className="text-xs text-slate-400 font-sans mt-1">
                {quizData.title} {quizData.courseName && `• ${quizData.courseName}`}
              </p>
            </div>

            {/* Score & Grade Display */}
            <div className="flex flex-wrap items-center justify-center gap-4 py-2">
              <div className="px-5 py-2.5 rounded-xl bg-black/60 border border-white/10">
                <span className="text-xs text-slate-400 uppercase font-mono block">
                  {lang === 'el' ? 'Συνολικό Σκορ' : 'Total Score'}
                </span>
                <span className="text-2xl sm:text-3xl font-black font-mono text-white">
                  <span className={grade.color}>{correctCount}</span> / {totalQuestions}
                </span>
              </div>

              <div className="px-5 py-2.5 rounded-xl bg-black/60 border border-white/10">
                <span className="text-xs text-slate-400 uppercase font-mono block">
                  {lang === 'el' ? 'Ποσοστό Επιτυχίας' : 'Success Rate'}
                </span>
                <span className="text-2xl sm:text-3xl font-black font-mono text-amber-300">
                  {scorePercentage}%
                </span>
              </div>

              <div className="px-5 py-2.5 rounded-xl bg-black/60 border border-white/10">
                <span className="text-xs text-slate-400 uppercase font-mono block">
                  {lang === 'el' ? 'Χρόνος Επίλυσης' : 'Total Time'}
                </span>
                <span className="text-2xl sm:text-3xl font-black font-mono text-slate-200">
                  {formatTimer(timerSeconds)}
                </span>
              </div>
            </div>

            {/* Grade Badge & Pedagogical Evaluation */}
            <div className="max-w-xl mx-auto space-y-2 pt-1">
              <div className={`inline-block px-4 py-1.5 rounded-full text-xs font-black border uppercase tracking-wider ${grade.badge}`}>
                {grade.label}
              </div>
              <p className="text-xs sm:text-sm text-slate-200 font-sans leading-relaxed">
                {grade.message}
              </p>
              <p className="text-xs text-amber-300/90 font-sans font-medium bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">
                🎯 <span className="font-bold">{lang === 'el' ? 'Πρόταση Μελέτης:' : 'Study Advice:'}</span> {grade.studyAdvice}
              </p>
            </div>
          </div>

          {/* Topic Mastery & Breakdown */}
          {Object.keys(topicStats).length > 0 && (
            <div className="p-4 sm:p-5 rounded-2xl bg-black/40 border border-white/10 space-y-3">
              <div className="flex items-center gap-2 font-mono text-xs font-bold text-amber-400 uppercase tracking-wider">
                <TrendingUp className="w-4 h-4" />
                <span>{lang === 'el' ? 'Ανάλυση ανά Κεφάλαιο & Θεματική' : 'Chapter & Topic Mastery'}</span>
              </div>

              <div className="space-y-3">
                {Object.entries(topicStats).map(([topic, stats]) => {
                  const topicPercent = Math.round((stats.correct / stats.total) * 100);
                  const isPerfect = topicPercent === 100;
                  const isLow = topicPercent < 60;

                  return (
                    <div key={topic} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-sans">
                        <span className="font-semibold text-slate-200">{topic}</span>
                        <span className="font-mono text-xs font-bold text-slate-300">
                          {stats.correct}/{stats.total} ({topicPercent}%)
                        </span>
                      </div>
                      <div className="w-full h-2 bg-black/60 rounded-full overflow-hidden border border-white/10">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isPerfect
                              ? 'bg-emerald-400'
                              : isLow
                              ? 'bg-rose-500'
                              : 'bg-amber-400'
                          }`}
                          style={{ width: `${topicPercent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Post-Assessment Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={handleRestartFull}
              className="px-4 py-2.5 rounded-xl border border-white/20 hover:border-amber-400 text-xs font-bold text-slate-200 hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              <span>{lang === 'el' ? 'Επανάληψη ΟΛΩΝ των Διαφανειών' : 'Retake All Slides'}</span>
            </button>

            {/* Retake only mistakes button */}
            {correctCount < totalQuestions && (
              <button
                onClick={handleRetakeMistakesOnly}
                className="px-4 py-2.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/50 text-xs font-bold text-rose-200 flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-rose-950/40"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                <span>{lang === 'el' ? `Επανάληψη ${totalQuestions - correctCount} Λαθών` : `Retake Missed Only`}</span>
              </button>
            )}

            {onAskFollowup && (
              <button
                onClick={() =>
                  onAskFollowup(
                    `Έκανα ${totalQuestions - correctCount} λάθη στο κουίζ για "${quizData.title}". Μπορείς να μου εξηγήσεις αναλυτικά τη θεωρία πίσω από τα λάθη μου και να μου δώσεις συμβουλές εξετάσεων;`
                  )
                }
                className={`px-4 py-2.5 rounded-xl text-xs font-bold ${currentTheme.classes.btnPrimary} ${currentTheme.classes.btnPrimaryHover} shadow-lg flex items-center gap-2 transition-all cursor-pointer`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{lang === 'el' ? 'Εξήγηση Λαθών από τον AI Καθηγητή' : 'Explain My Mistakes with AI'}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. ADD MORE QUESTIONS TOOLBAR (+ Προσθήκη Ερωτήσεων)                        */}
      {/* ========================================================================= */}
      {false && onAskFollowup && (
        <div className="mt-5 pt-4 border-t border-white/10 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold font-mono text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <PlusCircle className="w-3.5 h-3.5" />
              <span>{lang === 'el' ? 'Επέκταση Κουίζ / Προσθήκη Ερωτήσεων' : 'Extend Quiz / Add Questions'}</span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleRequestMoreQuestions('more')}
              className="px-3 py-1.5 rounded-lg bg-black/40 hover:bg-amber-400 hover:text-black border border-white/10 hover:border-amber-400 text-slate-300 text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>+ 5 Νέες Διαφάνειες</span>
            </button>

            <button
              onClick={() => handleRequestMoreQuestions('hard')}
              className="px-3 py-1.5 rounded-lg bg-black/40 hover:bg-amber-400 hover:text-black border border-white/10 hover:border-amber-400 text-slate-300 text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>+ Ερωτήσεις Εξετάσεων (Hard)</span>
            </button>

            <button
              onClick={() => handleRequestMoreQuestions('traps')}
              className="px-3 py-1.5 rounded-lg bg-black/40 hover:bg-amber-400 hover:text-black border border-white/10 hover:border-amber-400 text-slate-300 text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>+ SOS Παγίδες Θεμάτων</span>
            </button>

            <button
              onClick={() => setCustomAddOpen(!customAddOpen)}
              className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3 h-3" />
              <span>{lang === 'el' ? 'Προσαρμοσμένο Κεφάλαιο...' : 'Custom Topic...'}</span>
            </button>
          </div>

          {/* Custom Add Input */}
          {customAddOpen && (
            <div className="p-3 rounded-xl bg-black/50 border border-amber-500/30 flex items-center gap-2 animate-fade-in">
              <input
                type="text"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRequestMoreQuestions('custom');
                }}
                placeholder={
                  lang === 'el'
                    ? 'π.χ. Πρόσθεσε 3 ερωτήσεις για τον αλγόριθμο LRU και TLB cache'
                    : 'e.g. Add 3 questions on LRU and TLB caching'
                }
                className="flex-1 bg-transparent border-0 text-xs font-sans text-white focus:outline-none placeholder:text-slate-500"
              />
              <button
                onClick={() => handleRequestMoreQuestions('custom')}
                disabled={!customPrompt.trim()}
                className={`px-3 py-1 rounded-lg text-xs font-bold ${currentTheme.classes.btnPrimary} ${currentTheme.classes.btnPrimaryHover} disabled:opacity-40 cursor-pointer`}
              >
                {lang === 'el' ? 'Προσθήκη' : 'Add'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
