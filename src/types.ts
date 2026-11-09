export interface MultimodalAttachment {
  name: string;
  mimeType: string;
  dataBase64: string;
  sizeBytes: number;
  previewUrl?: string;
}

export interface QuizQuestion {
  id: number;
  question: string;
  options: string[]; // Options e.g. ["A...", "B...", "C...", "D..."]
  correctIndex: number; // 0, 1, 2, 3
  explanation: string;
  topic?: string;
}

export interface QuizData {
  title: string;
  courseName?: string;
  difficulty?: 'easy' | 'medium' | 'hard' | 'exam';
  questions: QuizQuestion[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model' | 'system';
  text: string;
  attachment?: MultimodalAttachment;
  attachments?: MultimodalAttachment[];
  quizData?: QuizData;
  timestamp: string;
  groundingSources?: { title: string; url: string }[];
  modelUsed?: string;
  apiKeyFingerprint?: string;
  isStreaming?: boolean;
}

export interface VaultFile {
  filename: string;
  sizeBytes: number;
  createdAt: string;
  modifiedAt: string;
}

export interface SystemStatus {
  online: boolean;
  keyFile: {
    path: string;
    exists: boolean;
    valid: boolean;
    fingerprint: string;
  };
  vault: {
    fileCount: number;
    files: string[];
  };
  usage?: {
    used: number;
    limit: number;
    resetAt: string;
    providerRetryUntil: string | null;
  };
  google?: {
    available: boolean;
    models: string[];
    configured?: boolean;
    keyCount?: number;
  };
  apiKeys?: Array<{ index: number; fingerprint: string; label: string; accountId?: string; provider: string; model: string; modelId?: string; masked: string; lastUsedAt: string | null; rpmUsed: number; rpmLimit: number; rpdUsed: number; rpdLimit: number; status: 'available' | 'rate-limited' | 'exhausted'; reason: string | null; rateLimitedUntil?: string | null; active?: boolean }>;
  model: string;
}

export interface DecryptedSession {
  filename: string;
  timestamp?: string;
  structured: boolean;
  messages?: Array<{
    role: string;
    text: string;
    attachment?: any;
    timestamp?: string;
  }>;
  rawText: string;
}

export type ThemeId =
  | 'honey-gold'
  | 'cyber-bee'
  | 'royal-jelly'
  | 'propolis-dark'
  | 'smoker-amber'
  | 'matrix-hive';

export interface AppTheme {
  id: ThemeId;
  name: string;
  nameEl: string;
  descriptionEl: string;
  icon: string;
  colorSwatch: string;
  classes: {
    bgRoot: string;
    bgPanel: string;
    bgCard: string;
    bgInput: string;
    borderPrimary: string;
    borderMuted: string;
    textAccent: string;
    textMuted: string;
    btnPrimary: string;
    btnPrimaryHover: string;
    badgeBg: string;
    badgeText: string;
    userBubble: string;
    userBubbleBorder: string;
    aiBubble: string;
    aiBubbleBorder: string;
    glowClass: string;
  };
}

export interface ThemeSettings {
  themeId: ThemeId;
  fontSize: 'compact' | 'standard' | 'spacious';
  contrast: 'balanced' | 'high' | 'oled';
  showHexagonMesh: boolean;
  enableGlow: boolean;
}

export interface ModelOption {
  id: string;
  name: string;
  badge: string;
  descEl: string;
  descEn: string;
  isDefault?: boolean;
}

// ============================================
// NEW FEATURES: 5 Study Modes
// ============================================

// 1. FLASHCARDS with Spaced Repetition
export interface Flashcard {
  id: string;
  front: string;
  back: string;
  topic?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  nextReviewAt: number; // timestamp
  interval: number; // days
  easeFactor: number; // SM-2 algorithm
  repetitions: number;
  lapses: number;
  lastReviewedAt?: number;
}

export interface FlashcardDeck {
  id: string;
  name: string;
  description?: string;
  cards: Flashcard[];
  createdAt: string;
  updatedAt: string;
  totalCards: number;
  masterCards: number;
}

// 2. SOCRATIC TEACHER - Step-by-Step Guidance
export interface SocraticStep {
  stepNumber: number;
  question: string;
  hints: string[];
  correctAnswer: string;
  explanation: string;
  userAnswer?: string;
  isCorrect?: boolean;
  hintLevel: number; // 0 = no hints shown, 1 = first hint, 2 = more hints
}

export interface SocraticSession {
  id: string;
  problemStatement: string;
  steps: SocraticStep[];
  currentStep: number;
  completedAt?: number;
  topic?: string;
}

// 3. INTERACTIVE CONCEPT MAP
export interface ConceptMapNode {
  id: string;
  label: string;
  description?: string;
  children: string[]; // IDs of child concepts
  relatedTo: string[]; // IDs of related concepts
  examples?: string[];
  formulas?: string[];
}

export interface ConceptMapLink {
  from: string;
  to: string;
  relationship: string; // e.g., "depends on", "extends", "related to"
}

export interface ConceptMap {
  id: string;
  title: string;
  rootNode: ConceptMapNode;
  allNodes: Record<string, ConceptMapNode>;
  links: ConceptMapLink[];
  topic?: string;
}

// 4. FILL-IN-THE-BLANKS (extends Quiz concept)
export interface BlankQuestion {
  id: number;
  text: string; // Text with [BLANK] placeholders or HTML with <blank></blank>
  blanks: Array<{
    position: number;
    correctAnswers: string[];
    options?: string[]; // multiple choice options
  }>;
  userAnswers?: string[];
  isCorrect?: boolean;
  explanation?: string;
  topic?: string;
}

export interface FillInBlanksQuiz {
  title: string;
  courseName?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  questions: BlankQuestion[];
}

// 5. EXAM SIMULATOR with SOS Radar
export interface ExamQuestion {
  id: number;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  timeToAnswer?: number; // seconds
}

export interface ExamSession {
  id: string;
  title: string;
  totalQuestions: number;
  timeLimit: number; // minutes
  startedAt: number;
  endedAt?: number;
  questions: ExamQuestion[];
  userAnswers: Record<number, number>; // questionId -> selectedOptionIndex
  scores: {
    totalScore: number;
    maxScore: number;
    percentage: number;
  };
  analysisData?: WeakPointAnalysis;
}

export interface TopicPerformance {
  topic: string;
  attempted: number;
  correct: number;
  percentage: number;
  weakPoints: string[]; // Sub-topics to review
}

export interface WeakPointAnalysis {
  overallScore: number;
  topicBreakdown: TopicPerformance[];
  weakestTopics: string[]; // Top 3 weakest areas
  recommendedReview: string[];
  strengths: string[];
}
