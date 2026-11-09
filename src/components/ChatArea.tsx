import React, { useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import MarkdownContent from '../lib/MarkdownContent';
import {
  Music,
  Video,
  Copy,
  Check,
  ExternalLink,
  FileText,
  Terminal,
  KeyRound,
  Lock,
  Cpu,
  GraduationCap,
  Award,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import { ChatMessage, AppTheme, ThemeSettings, QuizData, MultimodalAttachment, ConceptMap as ConceptMapData, FillInBlanksQuiz, FlashcardDeck as FlashcardDeckData, SocraticSession, ExamSession } from '../types';
import { InteractiveQuiz } from './InteractiveQuiz';
import { FlashcardDeck } from './FlashcardDeck';
import { SocraticTeacher } from './SocraticTeacher';
import { ConceptMap } from './ConceptMap';
import { FillInBlanks } from './FillInBlanks';
import { ExamSimulator } from './ExamSimulator';
import type { InteractiveLabSpec } from './InteractiveLab';
import { InteractiveLabViewer } from './InteractiveLabViewer';
import { ChemistryWorkspace, CHEMISTRY_REACTION_REQUEST_MARKER } from './ChemistryWorkspace';
import { MermaidDiagram } from './MermaidDiagram';
import { parseQuizFromText } from '../utils/quizParser';
import { parseFlashcardsFromText } from '../utils/flashcardParser';
import { parseSocraticFromText } from '../utils/socraticParser';
import { parseFillInBlanksFromText } from '../utils/fillInBlanksParser';
import { parseExamFromText } from '../utils/examParser';
import { parseConceptMapFromText } from '../utils/conceptMapParser';

interface ChatAreaProps {
  messages: ChatMessage[];
  isGenerating: boolean;
  lang: 'el' | 'en';
  onQuickCommand?: (cmd: string) => void;
  onOpenUniversityHub?: () => void;
  chemistryWorkspaceOpen: boolean;
  onChemistryWorkspaceOpenChange: (open: boolean) => void;
  chemistryWorkspaceRequest: number;
  onSendMessage?: (text: string, attachments?: MultimodalAttachment[]) => void;
  currentTheme: AppTheme;
  themeSettings: ThemeSettings;
  selectedModel: string;
  chatScale: number;
  onEditMessage?: (messageId: string, text: string) => void;
  inputBar?: React.ReactNode;
}

function extractQuizData(text: string): { cleanedText: string; quiz: QuizData | null } {
  const parsed = parseQuizFromText(text);
  if (!parsed.quiz && /\{[\s\S]*"questions"\s*:\s*\[[\s\S]*\}[\s\S]*\}/i.test(text)) {
    return {
      cleanedText: '⚠️ Το Quiz δεν μπόρεσε να φορτωθεί. Τα δεδομένα του AI δεν ήταν έγκυρα.',
      quiz: null,
    };
  }
  return parsed;
}

function extractLabJson(text: string): { raw: string; block: string } | null {
  const fencedBlocks = [...text.matchAll(/```(?:lab|json)\s*([\s\S]*?)```/gi)];
  const candidates = fencedBlocks.map((match) => ({ raw: match[1], block: match[0] }));
  if (fencedBlocks.length === 0) {
    for (let start = text.indexOf('{'); start >= 0; start = text.indexOf('{', start + 1)) {
      let depth = 0;
      let inString = false;
      let escaped = false;
      for (let index = start; index < text.length; index += 1) {
        const character = text[index];
        if (inString) {
          if (escaped) escaped = false;
          else if (character === '\\') escaped = true;
          else if (character === '"') inString = false;
        } else if (character === '"') inString = true;
        else if (character === '{') depth += 1;
        else if (character === '}' && --depth === 0) {
          const candidate = text.slice(start, index + 1);
          candidates.push({ raw: candidate, block: candidate });
          break;
        }
      }
    }
  }
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate.raw) as Record<string, unknown>;
      const isLabBlock = /^```lab\b/i.test(candidate.block.trim());
      if (isLabBlock || parsed.scene || parsed.controls || parsed.type === 'canvas2d') {
        return { raw: candidate.raw.trim(), block: candidate.block };
      }
    } catch {
      if (/(?:"scene"|"controls"|"type"\s*:\s*"canvas2d")\s*:/.test(candidate.raw)) {
        return { raw: candidate.raw.trim(), block: candidate.block };
      }
    }
  }
  return null;
}

function isInteractiveLabRequest(text: string): boolean {
  return text.includes(CHEMISTRY_REACTION_REQUEST_MARKER) ||
    /\binteractive\s+lab\b|\b2d\s+canvas\b|\bcanvas\s+animation\b|\blab\s+json\b|διαδραστικ(?:ό|ή|ο|ού)\s+(?:lab|εργαστ)|οπτικοποι|animation|ανιμ(?:έισιον|εισιόν)|πρόβλεψ(?:η|ε)\s+(?:των\s+)?προϊόν|χημικ(?:ή|ές)\s+αντίδρασ|χημικ(?:ή|ές)\s+ένωσ|ισοστάθμ(?:ιση|ισε)/i.test(text);
}

function extractStudyData(text: string) {
  const flashcards = parseFlashcardsFromText(text);
  const socratic = parseSocraticFromText(text);
  const fillBlanks = parseFillInBlanksFromText(text);
  const exam = parseExamFromText(text);
  const mapBlock = text.match(/```(?:conceptmap|concept-map|map)\s*([\s\S]*?)```/i);
  const conceptMap: ConceptMapData | null = mapBlock
    ? parseConceptMapFromText(mapBlock[1], text.match(/^#\s*(.+)$/m)?.[1] || 'Concept Map')
    : null;
  const labBlock = extractLabJson(text);
  const mermaidBlock = text.match(/```mermaid\s*([\s\S]*?)```/i) || text.match(/(^|\n)((?:graph|flowchart)\s+(?:TD|LR|TB|RL)[\s\S]*)$/i);
  const lab: InteractiveLabSpec | null = null;
  const parsedText = flashcards.deck
    ? flashcards.cleanedText
    : socratic.session
    ? socratic.cleanedText
    : fillBlanks.quiz
    ? fillBlanks.cleanedText
    : exam.exam
    ? exam.cleanedText
    : undefined;
  return {
    cleanedText: parsedText || (mapBlock || labBlock || mermaidBlock ? text.replace(mapBlock?.[0] || labBlock?.block || mermaidBlock?.[0] || '', '').trim() : text),
    deck: flashcards.deck,
    session: socratic.session,
    fillQuiz: fillBlanks.quiz,
    exam: exam.exam,
    conceptMap,
    lab,
    labJson: labBlock?.raw || null,
    mermaidCode: mermaidBlock?.[1]?.trim() || null,
  };
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  messages,
  isGenerating,
  lang,
  onQuickCommand,
  onOpenUniversityHub,
  chemistryWorkspaceOpen,
  onChemistryWorkspaceOpenChange: setChemistryWorkspaceOpen,
  chemistryWorkspaceRequest,
  onSendMessage,
  currentTheme,
  themeSettings,
  selectedModel,
  chatScale,
  onEditMessage,
  inputBar,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const studyHomeRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<HTMLDivElement>(null);
  const [studyHost, setStudyHost] = React.useState<HTMLDivElement | null>(null);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = React.useState<string | null>(null);
  const [editingText, setEditingText] = React.useState('');
  const [selectedStudyId, setSelectedStudyId] = React.useState<string | null>(null);
  const [studyPanelVisible, setStudyPanelVisible] = React.useState(false);
  const [dismissedStudyIds, setDismissedStudyIds] = React.useState<Set<string>>(() => new Set());
  const [chatColumnPercent, setChatColumnPercent] = React.useState(() => {
    const saved = Number(localStorage.getItem('nickbee-study-split'));
    return Number.isFinite(saved) && saved >= 32 && saved <= 68 ? saved : 54;
  });
  const [isResizingColumns, setIsResizingColumns] = React.useState(false);
  const [studyWindow, setStudyWindow] = React.useState<Window | null>(null);
  const [studyWindowError, setStudyWindowError] = React.useState('');
  const [studyQuestion, setStudyQuestion] = React.useState('');

  useEffect(() => {
    const host = document.createElement('div');
    host.className = 'study-content-host box-border w-full min-w-0 max-w-full';
    setStudyHost(host);
  }, []);
  const parsedMessages = new Map(messages.flatMap((msg) => {
    if (msg.role !== 'model') return [];
    return [[msg.id, { quizData: extractQuizData(msg.text), studyData: extractStudyData(msg.text) }] as const];
  }));

  const generatedStudyItems = messages.flatMap((msg) => {
    if (msg.role !== 'model') return [];

    const parsed = parsedMessages.get(msg.id);
    if (!parsed) return [];
    const messageIndex = messages.findIndex((message) => message.id === msg.id);
    const previousUser = messages.slice(0, messageIndex).reverse().find((message) => message.role === 'user');
    const study = parsed.studyData;
    if (previousUser && isInteractiveLabRequest(previousUser.text)) {
      if (study.labJson) {
        return [{
          id: msg.id,
          label: lang === 'el' ? 'Εργαστήριο' : 'Lab',
          title: lang === 'el' ? 'Διαδραστικό εργαστήριο' : 'Interactive lab',
          content: <InteractiveLabViewer key={msg.id} rawJson={study.labJson} currentTheme={currentTheme} lang={lang} isActive={studyPanelVisible && selectedStudyId === msg.id} onRetry={() => {
            onSendMessage?.(`${previousUser.text}\n\nΑυστηρά ζήτησα εργαστήριο. Απάντησε μόνο με ένα έγκυρο JSON μέσα σε block \`\`\`lab. Μην δημιουργήσεις quiz, flashcards ή άλλο εργαλείο.`, previousUser.attachments);
          }} />,
        }];
      }

      return [{
        id: msg.id,
        label: lang === 'el' ? 'Εργαστήριο' : 'Lab',
        title: lang === 'el' ? 'Δεν δημιουργήθηκε εργαστήριο' : 'Lab was not generated',
        content: (
          <div className="rounded-xl border border-amber-400/30 bg-amber-950/20 p-4 text-sm text-amber-100">
            <p className="font-bold">{lang === 'el'
              ? 'Η πρόβλεψη δεν επέστρεψε διαδραστικό μοντέλο.'
              : 'The prediction did not return an interactive model.'}</p>
            {study.cleanedText.trim() && (
              <div className="markdown-body mt-3 rounded-lg border border-white/10 bg-black/25 p-3 font-sans text-sm leading-6 text-slate-100">
                <MarkdownContent>{study.cleanedText}</MarkdownContent>
              </div>
            )}
            <button
              type="button"
              onClick={() => onSendMessage?.(`${previousUser.text}\n\nΗ προηγούμενη απάντηση δεν έγινε ορατό Interactive Lab. Επανέλαβε την πρόβλεψη και επέστρεψε μόνο ένα πλήρες, έγκυρο JSON σε block \`\`\`lab, με scene:"reaction", equation, species και steps. Μην δημιουργήσεις quiz, flashcards ή άλλο εργαλείο.`, previousUser.attachments)}
              className="mt-3 rounded-lg border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-xs font-bold hover:bg-amber-400/20"
            >
              {lang === 'el' ? 'Δοκίμασε ξανά την πρόβλεψη' : 'Retry the prediction'}
            </button>
          </div>
        ),
      }];
    }

    const quiz = parsed.quizData.quiz;
    if (quiz) {
      return [{
        id: msg.id,
        label: lang === 'el' ? 'Κουίζ' : 'Quiz',
        title: quiz.title || (lang === 'el' ? 'Διαδραστικό κουίζ' : 'Interactive quiz'),
        content: <InteractiveQuiz key={msg.id} quiz={quiz} currentTheme={currentTheme} lang={lang} isActive={studyPanelVisible && selectedStudyId === msg.id} onAskFollowup={(prompt) => onSendMessage?.(prompt)} />,
      }];
    }

    if (study.deck) {
      return [{
        id: msg.id,
        label: lang === 'el' ? 'Κάρτες' : 'Flashcards',
        title: study.deck.name,
        content: <FlashcardDeck key={msg.id} deck={study.deck} currentTheme={currentTheme} lang={lang} onAskFollowup={(prompt) => onSendMessage?.(prompt)} />,
      }];
    }
    if (study.session) {
      return [{
        id: msg.id,
        label: lang === 'el' ? 'Σωκρατική μέθοδος' : 'Socratic',
        title: study.session.topic || (lang === 'el' ? 'Καθοδηγούμενη μελέτη' : 'Guided study'),
        content: <SocraticTeacher key={msg.id} session={study.session} currentTheme={currentTheme} lang={lang} onAskFollowup={(prompt) => onSendMessage?.(prompt)} />,
      }];
    }
    if (study.conceptMap) {
      return [{
        id: msg.id,
        label: lang === 'el' ? 'Χάρτης' : 'Concept map',
        title: study.conceptMap.title,
        content: <ConceptMap key={msg.id} map={study.conceptMap} currentTheme={currentTheme} lang={lang} />,
      }];
    }
    if (study.fillQuiz) {
      return [{
        id: msg.id,
        label: lang === 'el' ? 'Συμπλήρωση' : 'Fill in',
        title: study.fillQuiz.title,
        content: <FillInBlanks key={msg.id} quiz={study.fillQuiz} currentTheme={currentTheme} lang={lang} />,
      }];
    }
    if (study.exam) {
      return [{
        id: msg.id,
        label: lang === 'el' ? 'Προσομοίωση' : 'Exam',
        title: study.exam.title,
        content: <ExamSimulator key={msg.id} exam={study.exam} currentTheme={currentTheme} lang={lang} isActive={studyPanelVisible && selectedStudyId === msg.id} />,
      }];
    }
    if (study.labJson) {
      return [{
        id: msg.id,
        label: lang === 'el' ? 'Εργαστήριο' : 'Lab',
        title: lang === 'el' ? 'Διαδραστικό εργαστήριο' : 'Interactive lab',
        content: <InteractiveLabViewer key={msg.id} rawJson={study.labJson} currentTheme={currentTheme} lang={lang} isActive={studyPanelVisible && selectedStudyId === msg.id} onRetry={() => {
          if (previousUser) onSendMessage?.(previousUser.text, previousUser.attachments);
        }} />,
      }];
    }
    if (study.mermaidCode) {
      return [{
        id: msg.id,
        label: lang === 'el' ? 'Διάγραμμα' : 'Diagram',
        title: lang === 'el' ? 'Διάγραμμα ροής' : 'Flowchart',
        content: <MermaidDiagram key={msg.id} code={study.mermaidCode} />,
      }];
    }
    return [];
  });
  const chemistryItem = chemistryWorkspaceOpen ? [{
    id: 'chemistry-workspace',
    label: lang === 'el' ? 'Χημεία' : 'Chemistry',
    title: lang === 'el' ? 'Χημεία · Περιοδικός πίνακας' : 'Chemistry · Periodic table',
    content: <ChemistryWorkspace currentTheme={currentTheme} lang={lang} onExplainReaction={(prompt) => onSendMessage?.(prompt)} />,
  }] : [];
  const studyItems = [...chemistryItem, ...generatedStudyItems.filter((item) => !dismissedStudyIds.has(item.id))];
  const latestStudyId = generatedStudyItems.filter((item) => !dismissedStudyIds.has(item.id)).at(-1)?.id ?? null;
  const studyPanelOpen = studyPanelVisible;

  const navigateToStudyItem = (id: string) => {
    setSelectedStudyId(id);
    setStudyPanelVisible(true);
  };

  useEffect(() => {
    if (chemistryWorkspaceOpen) navigateToStudyItem('chemistry-workspace');
  }, [chemistryWorkspaceOpen]);

  useEffect(() => {
    if (latestStudyId) navigateToStudyItem(latestStudyId);
  }, [latestStudyId]);

  useEffect(() => {
    if (chemistryWorkspaceRequest > 0) navigateToStudyItem('chemistry-workspace');
  }, [chemistryWorkspaceRequest]);

  const openStudyWindow = () => {
    const popup = window.open('', 'nickbee-study-space', 'popup=yes,width=1100,height=850,resizable=yes,scrollbars=yes');
    if (!popup) {
      setStudyWindowError(lang === 'el' ? 'Το πρόγραμμα περιήγησης μπλόκαρε το νέο παράθυρο. Επίτρεψε τα αναδυόμενα παράθυρα για αυτόν τον ιστότοπο.' : 'The browser blocked the new window. Allow pop-ups for this site.');
      return;
    }

    popup.document.documentElement.lang = lang;
    popup.document.head.replaceChildren(...Array.from(document.head.querySelectorAll('style, link[rel="stylesheet"]'), (node) => node.cloneNode(true)));
    const viewport = popup.document.createElement('meta');
    viewport.name = 'viewport';
    viewport.content = 'width=device-width, initial-scale=1';
    popup.document.head.appendChild(viewport);
    popup.document.title = lang === 'el' ? 'Χώρος μελέτης · nickbee AI' : 'Study space · nickbee AI';
    popup.document.body.style.cssText = 'margin:0; min-height:100vh; padding:20px; box-sizing:border-box; background:#09090b; color:#e2e8f0; font-family:system-ui,sans-serif;';
    const root = popup.document.createElement('main');
    root.style.cssText = 'max-width:1100px; margin:0 auto;';
    popup.document.body.replaceChildren(root);
    if (studyHost) root.appendChild(studyHost);
    setStudyWindowError('');
    setStudyWindow(popup);
  };

  const returnStudyToChat = () => {
    if (studyHost && studyHomeRef.current) studyHomeRef.current.appendChild(studyHost);
    studyWindow?.close();
    setStudyWindow(null);
  };

  useEffect(() => {
    if (!studyWindow) return;
    const timer = window.setInterval(() => {
      if (!studyWindow.closed) return;
      if (studyHost && studyHomeRef.current) studyHomeRef.current.appendChild(studyHost);
      setStudyWindow(null);
    }, 300);
    return () => window.clearInterval(timer);
  }, [studyWindow, studyHost]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  const copyMessage = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const submitStudyQuestion = (event: React.FormEvent) => {
    event.preventDefault();
    const question = studyQuestion.trim();
    if (!question || !onSendMessage) return;
    const currentStudy = studyItems.find((item) => item.id === selectedStudyId);
    onSendMessage(`Σχετικά με το «${currentStudy?.title || 'εργαλείο μελέτης'}»: ${question}`);
    setStudyQuestion('');
  };

  const resizeChatColumn = (clientX: number) => {
    const bounds = layoutRef.current?.getBoundingClientRect();
    if (!bounds || bounds.width <= 0) return;
    const availableWidth = Math.max(1, bounds.width - 12);
    const next = Math.min(68, Math.max(32, ((clientX - bounds.left) / availableWidth) * 100));
    setChatColumnPercent(next);
    localStorage.setItem('nickbee-study-split', String(next));
  };

  const handleDividerKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const direction = event.key === 'ArrowLeft' ? -1 : 1;
      const next = Math.min(68, Math.max(32, chatColumnPercent + direction * (event.shiftKey ? 5 : 2)));
      setChatColumnPercent(next);
      localStorage.setItem('nickbee-study-split', String(next));
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const next = event.key === 'Home' ? 32 : 68;
      setChatColumnPercent(next);
      localStorage.setItem('nickbee-study-split', String(next));
    }
  };

  const fontSizeClass =
    themeSettings.fontSize === 'compact'
      ? 'text-sm'
      : themeSettings.fontSize === 'spacious'
      ? 'text-base'
      : 'text-base';

  return (
    <div
      ref={layoutRef}
      className={`flex min-h-0 flex-1 flex-col overflow-hidden lg:grid ${isResizingColumns ? 'lg:transition-none' : 'lg:transition-[grid-template-columns] lg:duration-200 lg:ease-out'}`}
      style={{ gridTemplateColumns: studyPanelOpen ? `minmax(0, ${chatColumnPercent}fr) 12px minmax(0, ${100 - chatColumnPercent}fr)` : 'minmax(0, 1fr)' }}
    >
      <div
        className="flex min-h-0 min-w-0 w-full flex-col lg:col-start-1"
      >
      <div
        className={`relative min-h-0 flex-1 overflow-y-auto px-4 pt-6 pb-8 space-y-5 ${currentTheme.classes.bgRoot} font-mono ${fontSizeClass} select-text`}
        style={{ zoom: chatScale }}
      >
      {/* Optional Honeycomb Mesh Background Pattern */}
      {themeSettings.showHexagonMesh && (
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[radial-gradient(#f59e0b_1px,transparent_1px)] bg-size-[20px_20px]"
          aria-hidden="true"
        />
      )}

      {studyItems.length > 0 && !studyPanelOpen && (
        <div className="sticky top-0 z-20 flex justify-end">
          <button
            type="button"
            onClick={() => {
              setSelectedStudyId((current) => current && studyItems.some((item) => item.id === current) ? current : latestStudyId);
              setStudyPanelVisible(true);
            }}
            className="rounded-lg border border-emerald-500/40 bg-slate-950/90 px-3 py-2 text-xs font-bold text-emerald-200 shadow-lg hover:border-emerald-300"
          >
            {lang === 'el' ? 'Άνοιγμα χώρου μελέτης' : 'Open study space'}
          </button>
        </div>
      )}

      {messages.length === 0 ? (
        <div className="max-w-2xl mx-auto text-center py-8 px-4 relative z-10">
          {/* Official nickbee Bee Mascot & Logo Avatar */}
          <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-amber-400 shadow-xl shadow-amber-500/20 mx-auto mb-4 bg-slate-900 ring-4 ring-amber-400/20">
            <img
              src="/nickbee_logo.jpg"
              alt="nickbee logo"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLElement).style.display = 'none';
                e.currentTarget.parentElement!.innerHTML = `<span class="flex items-center justify-center w-full h-full text-3xl">🐝</span>`;
              }}
            />
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center justify-center gap-2 font-mono">
            <span className={`${currentTheme.classes.textAccent} drop-shadow-[0_0_12px_rgba(251,191,36,0.6)]`}>
              nick
            </span>
            <span className="text-white">bee</span>
            <span className="text-xs px-2 py-0.5 rounded bg-black/60 border border-amber-500/40 text-amber-400">
              ACADEMIC AI
            </span>
          </h2>

          <div className="flex items-center justify-center gap-2 mt-2">
            <span className="text-xs text-slate-400">
              {lang === 'el' ? 'Χρήστης:' : 'User:'}{' '}
              <strong className="text-amber-300 font-bold">nickbee</strong>
            </span>
            <span className="text-slate-600">&bull;</span>
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <Cpu className="w-3 h-3 text-amber-400" />
              <span>{lang === 'el' ? 'Βοηθός:' : 'Assistant:'}</span>
              <strong className="text-amber-400 font-bold">Ai ({selectedModel})</strong>
            </span>
          </div>

          {/* Quick command & University Hub buttons */}
          <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
            {onOpenUniversityHub && (
              <button
                onClick={onOpenUniversityHub}
                className={`px-3.5 py-2 rounded-xl border border-amber-500/50 bg-amber-500/10 text-xs font-mono font-bold text-amber-300 hover:bg-amber-500/20 hover:border-amber-400 hover:text-white transition-all flex items-center gap-2 shadow-sm shadow-amber-500/20 cursor-pointer`}
              >
                <GraduationCap className="w-4 h-4 text-amber-400" />
                <span>{lang === 'el' ? '🎓 Ύλη Εξαμήνου & Φωτογραφίες' : '🎓 Semester Syllabus & Photos'}</span>
              </button>
            )}

            <button
              onClick={() => {
                if (onOpenUniversityHub) {
                  onOpenUniversityHub();
                } else {
                  onSendMessage?.('Φτιάξε μου ένα διαδραστικό Quiz 10 ερωτήσεων πολλαπλής επιλογής (A, B, C, D) για την εξεταστική.');
                }
              }}
              className={`px-3.5 py-2 rounded-xl border ${currentTheme.classes.borderMuted} ${currentTheme.classes.bgCard} text-xs font-mono font-medium text-slate-200 hover:border-amber-400 hover:text-white transition-all flex items-center gap-2 shadow-xs cursor-pointer`}
            >
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <span>{lang === 'el' ? '🎯 Διαδραστικό Quiz Πολλαπλής' : '🎯 Interactive Quiz'}</span>
            </button>

            <button
              onClick={() => onQuickCommand?.('read')}
              className={`px-3.5 py-2 rounded-xl border ${currentTheme.classes.borderMuted} ${currentTheme.classes.bgCard} text-xs font-mono font-medium text-slate-200 hover:border-amber-400 hover:text-white transition-all flex items-center gap-2 shadow-xs cursor-pointer`}
            >
              <span className={`px-1.5 py-0.5 rounded ${currentTheme.classes.badgeBg} ${currentTheme.classes.badgeText} font-bold border ${currentTheme.classes.borderMuted}`}>
                read
              </span>
              <span>&bull; {lang === 'el' ? 'HoneyVault (.enc)' : 'HoneyVault (.enc)'}</span>
            </button>

            <button
              onClick={() => onQuickCommand?.('upload')}
              className={`px-3.5 py-2 rounded-xl border ${currentTheme.classes.borderMuted} ${currentTheme.classes.bgCard} text-xs font-mono font-medium text-slate-200 hover:border-amber-400 hover:text-white transition-all flex items-center gap-2 shadow-xs cursor-pointer`}
            >
              <span className={`px-1.5 py-0.5 rounded ${currentTheme.classes.badgeBg} ${currentTheme.classes.badgeText} font-bold border ${currentTheme.classes.borderMuted}`}>
                upload
              </span>
              <span>&bull; {lang === 'el' ? 'Φόρτωση Αρχείων' : 'Upload Files'}</span>
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-white/10 flex flex-wrap items-center justify-center gap-5 text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5 font-mono">
              <GraduationCap className="w-3.5 h-3.5 text-amber-400" /> University Academic Tutor
            </span>
            <span className="flex items-center gap-1.5 font-mono">
              <KeyRound className="w-3.5 h-3.5 text-amber-400" /> secret.key (AES-128)
            </span>
            <span className="flex items-center gap-1.5 font-mono">
              <Terminal className="w-3.5 h-3.5 text-amber-400" /> Python CLI Ready
            </span>
          </div>
        </div>
      ) : (
        messages.map((msg) => {
          const isUser = msg.role === 'user';
          const parsed = parsedMessages.get(msg.id);
          const quizData = !isUser && parsed ? parsed.quizData : { cleanedText: msg.text, quiz: null };
          const studyData = !isUser && parsed ? parsed.studyData : { cleanedText: msg.text, deck: null, session: null, fillQuiz: null, exam: null, conceptMap: null, lab: null, labJson: null, mermaidCode: null };
          const previousUser = !isUser
            ? messages.slice(0, messages.findIndex((message) => message.id === msg.id)).reverse().find((message) => message.role === 'user')
            : undefined;
          const requestedLab = Boolean(previousUser && isInteractiveLabRequest(previousUser.text));
          const requestedLabWithoutData = requestedLab && !studyData.labJson;
          const requestedLabText = msg.text
            .replace(/```(?:lab|json|flashcards|flashcard|quiz|socratic|fillblanks|exam|conceptmap|concept-map|map)\s*[\s\S]*?```/gi, '')
            .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
            .trim();
          const cleanedText = requestedLab
            ? requestedLabWithoutData
              ? lang === 'el'
                ? '⚠️ Ζητήθηκε πρόβλεψη αντίδρασης, αλλά η απάντηση δεν περιείχε έγκυρο μοντέλο εργαστηρίου. Η απάντηση εμφανίζεται στην καρτέλα με δυνατότητα επανάληψης.'
                : '⚠️ A reaction prediction was requested, but the response did not contain a valid lab model. The response is available in the study tab with a retry option.'
              : requestedLabText
            : quizData.quiz ? '' : studyData.cleanedText.replaceAll(CHEMISTRY_REACTION_REQUEST_MARKER, '').trim();
          const quiz = requestedLab ? null : quizData.quiz;
          const { session, fillQuiz, exam, conceptMap, lab, labJson, mermaidCode } = studyData;
          const deck = requestedLab ? null : studyData.deck;
          const thinkingMatch = !isUser ? cleanedText.match(/<thinking>([\s\S]*?)<\/thinking>/i) : null;
          const visibleText = thinkingMatch ? cleanedText.replace(thinkingMatch[0], '').trim() : cleanedText;

          // Collect all attachments from message
          const allAttachments: MultimodalAttachment[] = [];
          if (msg.attachments && Array.isArray(msg.attachments)) {
            allAttachments.push(...msg.attachments);
          }
          if (msg.attachment && !allAttachments.some((a) => a.name === msg.attachment?.name && a.dataBase64 === msg.attachment?.dataBase64)) {
            allAttachments.push(msg.attachment);
          }

          return (
            <div
              key={msg.id}
              className={`flex w-full gap-3 max-w-3xl mx-auto group ${
                isUser ? 'justify-end' : 'justify-start'
              }`}
            >
              {!isUser && (
                <div className="w-8 h-8 rounded-full overflow-hidden border border-amber-400/80 shadow-md shrink-0 bg-slate-900 mt-1">
                  <img
                    src="/nickbee_logo.jpg"
                    alt="Ai avatar"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                      e.currentTarget.parentElement!.innerHTML = `<span class="flex items-center justify-center w-full h-full text-sm">🐝</span>`;
                    }}
                  />
                </div>
              )}

              <div className={`space-y-1.5 max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
                {/* Header label: User is nickbee, AI is Ai */}
                <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono px-1">
                  <span
                    className={`font-bold ${
                      isUser ? 'text-amber-300' : `${currentTheme.classes.textAccent}`
                    }`}
                  >
                    {isUser ? '👤 nickbee' : '🐝 Ai (Academic Professor)'}
                  </span>
                  <span>&bull;</span>
                  <span>{msg.timestamp}</span>
                  {!isUser && msg.apiKeyFingerprint && (
                    <span className="text-[10px] text-emerald-400/70" title="Gemini API key fingerprint">
                      &bull; {msg.modelUsed || selectedModel} &bull; API {msg.apiKeyFingerprint}
                    </span>
                  )}
                </div>

                {/* Bubble Container */}
                <div className="relative">
                {editingMessageId === msg.id && (
                  <div className="rounded-xl border border-amber-400/50 bg-black/50 p-3 space-y-2">
                    <textarea value={editingText} onChange={(event) => setEditingText(event.target.value)} rows={4} className="w-full resize-y rounded-lg border border-white/10 bg-black/40 p-2 text-sm text-white outline-none focus:border-amber-400" autoFocus />
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => setEditingMessageId(null)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:text-white cursor-pointer">Cancel</button>
                      <button type="button" onClick={() => { if (editingText.trim()) onEditMessage?.(msg.id, editingText.trim()); setEditingMessageId(null); }} className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-black hover:bg-amber-400 cursor-pointer">Save &amp; Submit</button>
                    </div>
                  </div>
                )}
                <div
                  className={`${editingMessageId === msg.id ? 'hidden' : ''} p-4 rounded-xl leading-relaxed border transition-all ${
                    isUser
                      ? `${currentTheme.classes.userBubble} ${currentTheme.classes.userBubbleBorder} rounded-tr-xs shadow-xs`
                      : `${currentTheme.classes.aiBubble} ${currentTheme.classes.aiBubbleBorder} rounded-tl-xs shadow-md ${
                          themeSettings.enableGlow ? currentTheme.classes.glowClass : ''
                        }`
                  }`}
                >
                  {/* Multi-Attachment Grid */}
                  {allAttachments.length > 0 && (
                    <div className="mb-3 space-y-2">
                      <div className="text-[11px] font-bold text-amber-300 flex items-center gap-1 font-mono">
                        <GraduationCap className="w-3.5 h-3.5" />
                        <span>
                          {allAttachments.length === 1
                            ? lang === 'el' ? 'Συνημμένο Αρχείο / Ύλη:' : 'Attached Syllabus File:'
                            : lang === 'el' ? `${allAttachments.length} Φωτογραφίες / Αρχεία Ύλης:` : `${allAttachments.length} Syllabus Files / Photos:`}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {allAttachments.map((att, attIdx) => (
                          <div
                            key={attIdx}
                            className={`p-2 rounded-lg border text-xs flex items-center gap-2.5 overflow-hidden ${
                              isUser
                                ? 'bg-black/30 border-white/10 text-amber-100'
                                : `${currentTheme.classes.bgCard} ${currentTheme.classes.borderMuted} text-slate-200`
                            }`}
                          >
                            {att.mimeType.startsWith('image/') ? (
                              <img
                                src={
                                  att.previewUrl ||
                                  `data:${att.mimeType};base64,${att.dataBase64}`
                                }
                                alt={att.name}
                                className="w-14 h-14 object-cover rounded-lg shrink-0 border border-white/20"
                              />
                            ) : att.mimeType.startsWith('audio/') ? (
                              <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                                <Music className="w-5 h-5" />
                              </div>
                            ) : att.mimeType.startsWith('video/') ? (
                              <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                                <Video className="w-5 h-5" />
                              </div>
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                                <FileText className="w-5 h-5" />
                              </div>
                            )}

                            <div className="truncate flex-1">
                              <div className="font-bold truncate text-amber-300 font-mono text-[11px]">
                                {att.name}
                              </div>
                              <div className="text-[10px] opacity-70 font-mono">
                                {att.mimeType} &bull; {(att.sizeBytes / 1024).toFixed(1)} KB
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Exactly one response renderer: structured data never falls through to Markdown. */}
                  {isUser ? (
                    <div className="whitespace-pre-wrap font-mono leading-relaxed text-amber-100">{msg.text}</div>
                  ) : quiz || deck || session || conceptMap || fillQuiz || exam || lab || labJson || mermaidCode ? (
                    <div className="rounded-lg border border-amber-500/20 bg-black/20 px-3 py-2 text-xs text-amber-200/80">
                      {lang === 'el' ? 'Το διαδραστικό εργαλείο είναι ανοιχτό στο πλαϊνό πάνελ.' : 'Interactive study tool is open in the side panel.'}
                    </div>
                  ) : msg.text.startsWith('⚠️ [Σφάλμα') || msg.text.startsWith('[Σφάλμα') || msg.text.startsWith('⏱️') || msg.text.includes('Quota') || msg.text.includes('Rate Limit') ? (
                    <div className="p-3.5 rounded-xl bg-linear-to-br from-rose-950/60 to-black/80 border border-rose-500/50 text-rose-200 font-mono text-xs space-y-2.5 shadow-lg">
                      <div className="font-bold flex items-center gap-1.5 text-rose-400">
                        <span>{msg.text.startsWith('⏱️') ? '⏱️' : '⚠️'}</span>
                        <span>
                          {msg.text.startsWith('⏱️')
                            ? (lang === 'el' ? 'Προσωρινό Όριο Αιτημάτων (Rate Limit Quota)' : 'Rate Limit Quota Exceeded')
                            : (lang === 'el' ? 'Σφάλμα Απόκρισης AI' : 'AI Response Error')}
                        </span>
                      </div>
                      <p className="text-rose-100/90 leading-relaxed text-xs">{msg.text}</p>
                      {onSendMessage && (
                        <div className="pt-1 flex items-center gap-2">
                          <button
                            onClick={() => {
                              // Find previous user message text if any
                              const msgIndex = messages.findIndex((m) => m.id === msg.id);
                              const prevUserMsg = messages
                                .slice(0, msgIndex)
                                .reverse()
                                .find((m) => m.role === 'user');
                              if (prevUserMsg) {
                                onSendMessage(prevUserMsg.text, prevUserMsg.attachments);
                              } else {
                                onSendMessage('Επανάληψη ερωτήματος');
                              }
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold ${currentTheme.classes.btnPrimary} ${currentTheme.classes.btnPrimaryHover} flex items-center gap-1.5 cursor-pointer shadow-md transition-all`}
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>{lang === 'el' ? '🔄 Δοκιμή Ξανά (Retry)' : '🔄 Retry Now'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="markdown-body text-slate-100">
                      <MarkdownContent>{visibleText}</MarkdownContent>
                    </div>
                  )}

                  {thinkingMatch && (
                    <details className="mt-3 rounded-xl border border-sky-500/20 bg-sky-950/20 p-3 text-xs text-sky-200">
                      <summary className="cursor-pointer font-bold">💭 {lang === 'el' ? 'Σύντομη σκέψη του AI' : 'AI progress summary'}</summary>
                      <p className="mt-2 whitespace-pre-wrap">{thinkingMatch[1].trim()}</p>
                    </details>
                  )}

                  {/* Web Grounding references */}
                  {msg.groundingSources && msg.groundingSources.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-white/10 text-xs">
                      <div className="font-bold text-[11px] text-amber-400/80 mb-1 font-mono">
                        {lang === 'el' ? 'Πηγές Αναζήτησης:' : 'Sources:'}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.groundingSources.map((source, idx) => (
                          <a
                            key={idx}
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-black/60 border border-amber-500/30 text-amber-300 hover:text-white hover:border-amber-400 hover:underline transition-all"
                          >
                            <ExternalLink className="w-3 h-3 text-amber-400" />
                            <span className="truncate max-w-45">{source.title}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-lg border border-white/10 bg-black/75 p-1 opacity-0 shadow-lg backdrop-blur transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => copyMessage(msg.text, msg.id)}
                    className="rounded px-1.5 py-1 text-[10px] text-slate-300 hover:bg-white/10 hover:text-white cursor-pointer"
                    title="Copy message"
                  >
                    {copiedId === msg.id ? 'Copied' : 'Copy'}
                  </button>
                  {isUser && onEditMessage && (
                    <button
                      type="button"
                      onClick={() => { setEditingMessageId(msg.id); setEditingText(msg.text); }}
                      className="rounded px-1.5 py-1 text-[10px] text-slate-300 hover:bg-white/10 hover:text-white cursor-pointer"
                      title="Edit message"
                    >
                      Edit
                    </button>
                  )}
                </div>
              </div>

                </div>

              {isUser && (
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center justify-center shrink-0 shadow-xs mt-1 font-black text-[11px] font-mono">
                  NB
                </div>
              )}
            </div>
          );
        })
      )}

      {/* Generating Indicator */}
      {isGenerating && (
        <div className="flex w-full gap-3 max-w-3xl mx-auto items-start">
          <div className="w-8 h-8 rounded-full overflow-hidden border border-amber-400 shadow-md shrink-0 bg-slate-900 mt-1">
            <img
              src="/nickbee_logo.jpg"
              alt="Ai avatar"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLElement).style.display = 'none';
                e.currentTarget.parentElement!.innerHTML = `<span class="flex items-center justify-center w-full h-full text-sm">🐝</span>`;
              }}
            />
          </div>
          <div className={`p-3.5 rounded-xl ${currentTheme.classes.bgPanel} border ${currentTheme.classes.borderPrimary} text-xs text-amber-300 flex items-center gap-2 shadow-sm font-mono`}>
            <div className="flex space-x-1">
              <div
                className="w-2 h-2 rounded-full bg-amber-400 animate-bounce"
                style={{ animationDelay: '0ms' }}
              />
              <div
                className="w-2 h-2 rounded-full bg-amber-400 animate-bounce"
                style={{ animationDelay: '150ms' }}
              />
              <div
                className="w-2 h-2 rounded-full bg-amber-400 animate-bounce"
                style={{ animationDelay: '300ms' }}
              />
            </div>
            <span className="font-semibold text-amber-200">
              {lang === 'el' ? '🐝 Ai επεξεργάζεται την ύλη και απαντάει...' : '🐝 Ai analyzing syllabus & computing response...'}
            </span>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
      </div>
      {inputBar}
      </div>

      {studyPanelVisible && (
        <>
        <div
          role="separator"
          aria-label={lang === 'el' ? 'Αλλαγή πλάτους συνομιλίας και χώρου μελέτης' : 'Resize chat and study space'}
          aria-orientation="vertical"
          aria-valuemin={32}
          aria-valuemax={68}
          aria-valuenow={Math.round(chatColumnPercent)}
          aria-valuetext={lang === 'el' ? `Συνομιλία ${Math.round(chatColumnPercent)}%, χώρος μελέτης ${100 - Math.round(chatColumnPercent)}%` : `Chat ${Math.round(chatColumnPercent)}%, study space ${100 - Math.round(chatColumnPercent)}%`}
          tabIndex={studyPanelOpen ? 0 : -1}
          onKeyDown={handleDividerKeyDown}
          onPointerDown={(event) => {
            if (!studyPanelOpen) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            setIsResizingColumns(true);
          }}
          onPointerMove={(event) => {
            if (isResizingColumns || event.buttons === 1) {
              if (!isResizingColumns) setIsResizingColumns(true);
              resizeChatColumn(event.clientX);
            }
          }}
          onPointerUp={() => setIsResizingColumns(false)}
          onPointerCancel={() => setIsResizingColumns(false)}
          className={`${studyPanelOpen ? 'hidden lg:flex' : 'hidden'} group z-20 w-3 shrink-0 cursor-col-resize touch-none items-center justify-center outline-none transition-colors hover:bg-cyan-400/10 focus-visible:bg-cyan-400/15 lg:col-start-2 lg:row-start-1`}
        >
          <span className="flex h-12 w-2 flex-col items-center justify-center gap-1 rounded-full border border-white/10 bg-slate-800 text-[8px] leading-none text-slate-400 shadow-lg transition group-hover:border-cyan-300/50 group-hover:text-cyan-200">
            <span>‹</span><span>›</span>
          </span>
        </div>
        <aside aria-hidden={!studyPanelOpen} className={`${studyPanelOpen ? 'flex' : 'hidden'} min-h-0 min-w-0 w-full flex-col border-t ${currentTheme.classes.borderPrimary} ${currentTheme.classes.bgPanel} transition-[width,opacity] duration-200 ease-out lg:col-start-3 lg:row-start-1 lg:h-full lg:border-l lg:border-t-0`}>
          <div className="shrink-0 border-b border-white/10">
            <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2">
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                  {lang === 'el' ? 'Χώρος μελέτης' : 'Study space'}
                </div>
                <h3 className="truncate text-sm font-bold text-white">
                  {studyItems.find((item) => item.id === selectedStudyId)?.title || (lang === 'el' ? 'Εργαλείο μελέτης' : 'Study tool')}
                </h3>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setChemistryWorkspaceOpen(true);
                    setSelectedStudyId('chemistry-workspace');
                    setStudyPanelVisible(true);
                  }}
                  className="rounded-lg border border-cyan-400/30 px-2 py-1.5 text-[10px] text-cyan-200 hover:border-cyan-300 hover:bg-cyan-400/10"
                >
                  {lang === 'el' ? 'Χημεία' : 'Chemistry'}
                </button>
                <button type="button" onClick={openStudyWindow} className="rounded-lg border border-white/10 px-2 py-1.5 text-[10px] text-slate-300 hover:border-emerald-400 hover:text-emerald-200">
                  {lang === 'el' ? '↗ Νέο παράθυρο' : '↗ Pop out'}
                </button>
                <button type="button" onClick={() => { if (studyWindow) returnStudyToChat(); setStudyPanelVisible(false); }} aria-label={lang === 'el' ? 'Κλείσιμο χώρου μελέτης' : 'Close study space'} title={lang === 'el' ? 'Κλείσιμο' : 'Close'} className="rounded-lg border border-white/10 px-2 py-1 text-sm text-slate-300 hover:border-rose-400 hover:text-rose-200">
                  ×
                </button>
              </div>
            </div>
            {studyItems.length > 0 && (
              <div className="flex gap-1 overflow-x-auto px-3 pb-2">
                {studyItems.map((item, index) => (
                  <div key={item.id} className={`flex max-w-60 shrink-0 items-center rounded-lg border text-[11px] transition-colors ${
                    studyPanelOpen && selectedStudyId === item.id
                      ? 'border-amber-400/60 bg-amber-500/15 text-amber-200'
                      : 'border-white/10 text-slate-400 hover:border-white/25 hover:text-slate-200'
                  }`}>
                    <button
                      type="button"
                      onClick={() => navigateToStudyItem(item.id)}
                      aria-pressed={studyPanelOpen && selectedStudyId === item.id}
                      className="min-w-0 truncate px-2.5 py-1.5 text-left"
                    >
                      {item.label} {index + 1}: {item.title}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (item.id === 'chemistry-workspace') {
                          setChemistryWorkspaceOpen(false);
                        } else {
                          setDismissedStudyIds((current) => new Set(current).add(item.id));
                        }
                        const remaining = studyItems.filter((study) => study.id !== item.id);
                        if (selectedStudyId === item.id) {
                          const fallback = remaining[0]?.id;
                          if (fallback) navigateToStudyItem(fallback);
                          else setSelectedStudyId(null);
                        }
                      }}
                      aria-label={lang === 'el' ? `Κλείσιμο καρτέλας ${item.title}` : `Close ${item.title} tab`}
                      title={lang === 'el' ? 'Κλείσιμο καρτέλας' : 'Close tab'}
                      className="shrink-0 rounded-r-md px-2 py-1.5 text-slate-500 hover:bg-rose-400/15 hover:text-rose-200"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          {studyWindowError && <p role="alert" className="px-4 py-2 text-xs text-rose-300">{studyWindowError}</p>}
          <div ref={(node) => {
            studyHomeRef.current = node;
            if (node && studyHost && studyHost.parentElement !== node) node.appendChild(studyHost);
          }} className="box-border min-h-0 min-w-0 w-full max-w-full flex-1 overflow-y-auto overscroll-contain px-3 py-2 sm:px-4">
            {studyHost && createPortal(
                <div className="study-content-inner box-border w-full min-w-0 max-w-full">
                  {studyWindow && (
                    <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-3 py-2">
                      <span className="text-xs text-emerald-200">{lang === 'el' ? 'Ο χώρος μελέτης είναι σε ξεχωριστό παράθυρο.' : 'Study space is in a separate window.'}</span>
                      <button type="button" onClick={returnStudyToChat} className="shrink-0 rounded-lg border border-emerald-500/40 px-2.5 py-1.5 text-xs text-emerald-100 hover:bg-emerald-500/20">
                        {lang === 'el' ? '↙ Επιστροφή στο chat' : '↙ Return to chat'}
                      </button>
                    </div>
                  )}
                  {studyItems.length === 0 && (
                    <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/10 bg-black/10 p-6 text-center">
                      <p className="text-sm font-bold text-slate-200">{lang === 'el' ? 'Οι καρτέλες μελέτης έκλεισαν' : 'Study tabs are closed'}</p>
                      <p className="text-xs text-slate-500">{lang === 'el' ? 'Άνοιξε ξανά τη Χημεία ή συνέχισε τη συνομιλία για να δημιουργήσεις νέο εργαλείο.' : 'Reopen Chemistry or continue the chat to create a new study tool.'}</p>
                      <button type="button" onClick={() => {
                        setChemistryWorkspaceOpen(true);
                        navigateToStudyItem('chemistry-workspace');
                      }} className="rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-xs font-bold text-cyan-100 hover:bg-cyan-400/20">
                        {lang === 'el' ? 'Άνοιγμα Χημείας' : 'Open Chemistry'}
                      </button>
                    </div>
                  )}
                  {studyItems.map((item) => (
                    <div key={item.id} hidden={selectedStudyId !== item.id}>
                      {item.content}
                    </div>
                  ))}
                </div>,
                studyHost
              )}
          </div>
          <form onSubmit={submitStudyQuestion} className="shrink-0 border-t border-white/10 bg-black/20 p-3">
            <label htmlFor="study-question" className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-emerald-200">
              {lang === 'el' ? 'Ρώτησε το chat για αυτό το εργαλείο' : 'Ask chat about this tool'}
            </label>
            <div className="flex gap-2">
              <input
                id="study-question"
                value={studyQuestion}
                onChange={(event) => setStudyQuestion(event.target.value)}
                placeholder={lang === 'el' ? 'Γράψε την ερώτησή σου…' : 'Type your question…'}
                className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-950/80 px-3 py-2 text-xs text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60"
              />
              <button type="submit" disabled={!studyQuestion.trim()} className="shrink-0 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-100 hover:bg-emerald-500/25 disabled:opacity-40">
                {lang === 'el' ? 'Στο chat ↙' : 'Send ↙'}
              </button>
            </div>
          </form>
        </aside>
        </>
      )}
    </div>
  );
};
