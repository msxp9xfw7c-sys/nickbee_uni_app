import React, { useState } from 'react';
import MarkdownContent from '../lib/MarkdownContent';
import {
  GraduationCap,
  Lightbulb,
  Check,
  X,
  Send,
  RotateCcw,
  ChevronRight,
  HelpCircle,
  Award,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import { AppTheme, SocraticSession, SocraticStep } from '../types';
import { isAnswerCorrect, normalizeAnswer } from '../utils/socraticParser';

interface SocraticTeacherProps {
  session: SocraticSession;
  currentTheme: AppTheme;
  lang: 'el' | 'en';
  onAskFollowup?: (prompt: string) => void;
}

export const SocraticTeacher: React.FC<SocraticTeacherProps> = ({
  session: initialSession,
  currentTheme,
  lang,
  onAskFollowup,
}) => {
  const [sessionState, setSessionState] = useState<SocraticSession>(initialSession);
  const [userInput, setUserInput] = useState('');
  const [feedback, setFeedback] = useState<{ correct: boolean; message: string } | null>(null);
  const [showCorrect, setShowCorrect] = useState(false);
  const [revealedAnswer, setRevealedAnswer] = useState(false);
  const [hintLevel, setHintLevel] = useState(0);

  const currentStep = sessionState.steps[sessionState.currentStep];
  const isCompleted = sessionState.completedAt !== undefined || sessionState.currentStep >= sessionState.steps.length;

  if (!currentStep) {
    return (
      <div className={`my-4 rounded-2xl border ${currentTheme.classes.borderPrimary} ${currentTheme.classes.bgCard} p-6 font-mono shadow-2xl text-center`}>
        <GraduationCap className="w-8 h-8 text-amber-400 mx-auto mb-2" />
        <p className="text-sm text-slate-300">
          {lang === 'el' ? 'Η συνεδρία ολοκληρώθηκε.' : 'Session complete.'}
        </p>
      </div>
    );
  }

  const handleSubmitAnswer = () => {
    const trimmed = userInput.trim();
    if (!trimmed) return;

    const correct = isAnswerCorrect(trimmed, currentStep.correctAnswer);

    if (correct) {
      setFeedback({
        correct: true,
        message: lang === 'el'
          ? 'Σωστά! Συνέχισε στο επόμενο βήμα.'
          : 'Correct! Move on to the next step.',
      });

      // Update session state
      const updatedSteps = sessionState.steps.map((step, idx) =>
        idx === sessionState.currentStep
          ? { ...step, userAnswer: trimmed, isCorrect: true }
          : step
      );

      const nextStepIndex = sessionState.currentStep + 1;
      const newSession: SocraticSession = {
        ...sessionState,
        steps: updatedSteps,
        currentStep: nextStepIndex,
        completedAt: nextStepIndex >= sessionState.steps.length ? Date.now() : undefined,
      };

      setSessionState(newSession);
      setUserInput('');
      setFeedback(null);
      setShowCorrect(false);
      setRevealedAnswer(false);
      setHintLevel(0);
    } else {
      setFeedback({
        correct: false,
        message: lang === 'el'
          ? 'Σχεδόν! Δοκίμασε ξανά ή ζήτα ένα hint. Δες την εξήγηση.'
          : 'Almost! Try again or request a hint. Check the explanation.',
      });
      setShowCorrect(true);
    }
  };

  const handleRequestHint = () => {
    if (hintLevel < currentStep.hints.length) {
      setHintLevel((prev) => prev + 1);
    }
  };

  const handleRevealAnswer = () => {
    setRevealedAnswer(true);
    setShowCorrect(true);
  };

  const handleRestart = () => {
    setSessionState({
      ...initialSession,
      currentStep: 0,
      completedAt: undefined,
      steps: initialSession.steps.map((step) => ({
        ...step,
        userAnswer: undefined,
        isCorrect: undefined,
        hintLevel: 0,
      })),
    });
    setUserInput('');
    setFeedback(null);
    setShowCorrect(false);
    setRevealedAnswer(false);
    setHintLevel(0);
  };

  const handleSkipToAnswer = () => {
    // Mark step as incorrect but move forward
    const updatedSteps = sessionState.steps.map((step, idx) =>
      idx === sessionState.currentStep
        ? { ...step, userAnswer: 'Παραλείφθηκε', isCorrect: false }
        : step
    );

    const nextStepIndex = sessionState.currentStep + 1;
    const newSession: SocraticSession = {
      ...sessionState,
      steps: updatedSteps,
      currentStep: nextStepIndex,
      completedAt: nextStepIndex >= sessionState.steps.length ? Date.now() : undefined,
    };

    setSessionState(newSession);
    setUserInput('');
    setFeedback(null);
    setShowCorrect(false);
    setRevealedAnswer(false);
    setHintLevel(0);
  };

  const progressPercent = Math.round((sessionState.currentStep / sessionState.steps.length) * 100);
  const visibleHints = currentStep.hints.slice(0, hintLevel);

  return (
    <div
      className={`my-4 rounded-2xl border ${currentTheme.classes.borderPrimary} ${currentTheme.classes.bgCard} p-4 sm:p-6 font-mono shadow-2xl relative overflow-hidden transition-all`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm sm:text-base font-bold text-white font-mono">
                {lang === 'el' ? 'Σωκρατικός Καθηγητής' : 'Socratic Teacher'}
              </h4>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-400/20 text-amber-300 border border-amber-400/40 font-bold uppercase tracking-wider">
                {lang === 'el' ? 'Βήμα-Βήμα' : 'Step-by-Step'}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-sans mt-0.5 max-w-md truncate">
              {sessionState.problemStatement}
            </p>
          </div>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">
            {lang === 'el'
              ? `Βήμα ${Math.min(sessionState.currentStep + 1, sessionState.steps.length)}/${sessionState.steps.length}`
              : `Step ${Math.min(sessionState.currentStep + 1, sessionState.steps.length)}/${sessionState.steps.length}`}
          </span>
          <div className="w-24 h-2 bg-black/50 rounded-full overflow-hidden border border-white/10">
            <div
              className="h-full bg-linear-to-r from-amber-500 to-amber-300 transition-all duration-300 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="mt-4 space-y-4 animate-fade-in">
        {/* Problem Statement Display */}
        <div className="p-3.5 rounded-xl bg-black/30 border border-white/10 flex items-start gap-2.5">
          <BookOpen className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-300 font-sans leading-relaxed">
            <span className="font-bold text-amber-300">
              {lang === 'el' ? 'Πρόβλημα:' : 'Problem:'}
            </span>{' '}
            {sessionState.problemStatement}
          </div>
        </div>

        {/* Current Step Question */}
        <div className="p-4 sm:p-5 rounded-2xl bg-black/40 border border-amber-500/30 shadow-inner">
          <div className="text-[11px] font-bold text-amber-400 uppercase tracking-widest mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>{lang === 'el' ? `ΒΗΜΑ ${currentStep.stepNumber}` : `STEP ${currentStep.stepNumber}`}</span>
            </span>
            {currentStep.hints.length > 0 && (
              <span className="text-[10px] text-slate-400 font-normal">
                {hintLevel}/{currentStep.hints.length} {lang === 'el' ? 'hints' : 'hints'}
              </span>
            )}
          </div>

          <div className="text-sm sm:text-base font-bold text-slate-100 font-sans leading-relaxed markdown-body mt-2">
            <MarkdownContent>{currentStep.question}</MarkdownContent>
          </div>
        </div>

        {/* Hints Display */}
        {visibleHints.length > 0 && (
          <div className="space-y-2 animate-fade-in">
            {visibleHints.map((hint, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-sky-950/40 border border-sky-500/30 flex items-start gap-2.5"
              >
                <Lightbulb className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                <div className="text-xs text-sky-200 font-sans leading-relaxed">
                  <span className="font-bold text-sky-300">
                    {lang === 'el' ? `Hint ${idx + 1}: ` : `Hint ${idx + 1}: `}
                  </span>
                  {hint}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* User Input Area */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmitAnswer();
                }
              }}
              placeholder={
                lang === 'el'
                  ? 'Γράψε την απάντησή σου εδώ...'
                  : 'Type your answer here...'
              }
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-xs placeholder-slate-500 focus:outline-hidden focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 font-mono"
              disabled={revealedAnswer}
            />
            <button
              onClick={handleSubmitAnswer}
              disabled={!userInput.trim() || revealedAnswer}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold ${currentTheme.classes.btnPrimary} ${currentTheme.classes.btnPrimaryHover} disabled:opacity-40 flex items-center gap-1.5 cursor-pointer transition-all`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>{lang === 'el' ? 'Υποβολή' : 'Submit'}</span>
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {currentStep.hints.length > 0 && hintLevel < currentStep.hints.length && !revealedAnswer && (
              <button
                onClick={handleRequestHint}
                className="px-3 py-1.5 rounded-lg bg-sky-950/40 hover:bg-sky-900/60 border border-sky-500/50 text-sky-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
              >
                <Lightbulb className="w-3.5 h-3.5 text-sky-400" />
                <span>{lang === 'el' ? 'Ζήτα Hint' : 'Get Hint'}</span>
              </button>
            )}

            <button
              onClick={handleRevealAnswer}
              disabled={revealedAnswer}
              className="px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/50 text-rose-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <HelpCircle className="w-3.5 h-3.5 text-rose-400" />
              <span>{lang === 'el' ? 'Αποκάλυψη Απάντησης' : 'Reveal Answer'}</span>
            </button>

            <button
              onClick={handleRestart}
              className="px-3 py-1.5 rounded-lg bg-black/40 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              <span>{lang === 'el' ? 'Επανάληψη' : 'Restart'}</span>
            </button>
          </div>
        </div>

        {/* Feedback / Revealed Answer */}
        {showCorrect && (
          <div className={`p-4 rounded-xl border animate-fade-in ${
            revealedAnswer
              ? 'bg-rose-950/40 border-rose-500/50 text-rose-200'
              : 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
          }`}>
            <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider mb-2">
              {revealedAnswer ? (
                <>
                  <X className="w-4 h-4 text-rose-400" />
                  <span>{lang === 'el' ? 'Σωστή Απάντηση:' : 'Correct Answer:'}</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>{lang === 'el' ? 'Απάντηση' : 'Answer'}</span>
                </>
              )}
            </div>

            <div className="text-xs font-sans leading-relaxed markdown-body">
              <span className="font-bold text-amber-300">
                {currentStep.correctAnswer}
              </span>
              <div className="mt-2 text-slate-300">
                <span className="font-bold text-amber-300">
                  {lang === 'el' ? 'Επεξήγηση: ' : 'Explanation: '}
                </span>
                <MarkdownContent>{currentStep.explanation}</MarkdownContent>
              </div>
            </div>

            {!revealedAnswer && (
              <button
                onClick={handleSkipToAnswer}
                className="mt-3 px-3 py-1.5 rounded-lg bg-black/40 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
              >
                <ChevronRight className="w-3.5 h-3.5 text-amber-400" />
                <span>{lang === 'el' ? 'Επόμενο Βήμα' : 'Next Step'}</span>
              </button>
            )}

            {revealedAnswer && (
              <button
                onClick={handleSkipToAnswer}
                className="mt-3 px-3 py-1.5 rounded-lg bg-black/40 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
              >
                <ChevronRight className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  {sessionState.currentStep + 1 >= sessionState.steps.length
                    ? lang === 'el' ? 'Ολοκλήρωση' : 'Finish'
                    : lang === 'el' ? 'Επόμενο Βήμα' : 'Next Step'}
                </span>
              </button>
            )}
          </div>
        )}

        {/* Completion Screen */}
        {isCompleted && (
          <div className="p-6 rounded-2xl bg-linear-to-br from-emerald-950/40 to-black/40 border border-emerald-500/40 text-center space-y-4 animate-fade-in">
            <div className="inline-flex p-3 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-md">
              <Award className="w-8 h-8" />
            </div>
            <div>
              <h4 className="text-lg font-black text-white">
                {lang === 'el' ? 'Συγχαρητήρια! Ολοκλήρωσες την καθοδήγηση.' : 'Congratulations! You completed the guidance.'}
              </h4>
              <p className="text-xs text-slate-300 mt-1">
                {lang === 'el'
                  ? 'Πέρασες όλα τα βήματα. Είσαι έτοιμος για το επόμενο πρόβλημα.'
                  : 'You passed all steps. Ready for the next problem.'}
              </p>
            </div>
            <button
              onClick={handleRestart}
              className={`px-4 py-2 rounded-xl text-xs font-bold ${currentTheme.classes.btnPrimary} ${currentTheme.classes.btnPrimaryHover} flex items-center gap-2 mx-auto cursor-pointer transition-all`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{lang === 'el' ? 'Επανάληψη Συνεδρίας' : 'Restart Session'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
