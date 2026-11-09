import React, { useState, useRef } from 'react';
import {
  X,
  GraduationCap,
  Sparkles,
  Upload,
  Layers,
  FileText,
  Award,
  BookOpen,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Image as ImageIcon,
  ArrowRight,
  PlayCircle,
} from 'lucide-react';
import { AppTheme, MultimodalAttachment } from '../types';

interface UniversityHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRunAction: (prompt: string, attachments?: MultimodalAttachment[]) => void;
  currentTheme: AppTheme;
  lang: 'el' | 'en';
  onOpenChemistry: () => void;
}

export const UniversityHubModal: React.FC<UniversityHubModalProps> = ({
  isOpen,
  onClose,
  onRunAction,
  currentTheme,
  lang,
  onOpenChemistry,
}) => {
  const [activeTab, setActiveTab] = useState<'syllabus' | 'sos'>('syllabus');
  const [uploadedFiles, setUploadedFiles] = useState<MultimodalAttachment[]>([]);
  const [customCourseName, setCustomCourseName] = useState('');
  const [quizDifficulty, setQuizDifficulty] = useState<'easy' | 'medium' | 'hard' | 'exam'>('exam');
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [pendingAction, setPendingAction] = useState<Parameters<typeof handleTriggerSyllabusAction>[0] | null>(null);
  const [flashcardCount, setFlashcardCount] = useState(15);
  const [labComplexity, setLabComplexity] = useState<'basic' | 'detailed'>('basic');
  const [labDuration, setLabDuration] = useState<'short' | 'medium' | 'long'>('medium');
  const [labPrompt, setLabPrompt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isOpen) {
      setIsSubmitting(false);
      setPendingAction(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64Data = result.split(',')[1];
        setUploadedFiles((prev) => [
          ...prev,
          {
            name: file.name,
            mimeType: file.type || 'application/octet-stream',
            dataBase64: base64Data,
            sizeBytes: file.size,
            previewUrl: file.type.startsWith('image/') ? result : undefined,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  };

  const handleRemoveFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClearAllFiles = () => {
    setUploadedFiles([]);
  };

  const handleTriggerSyllabusAction = (actionType: 'quiz' | 'summary' | 'sos' | 'flashcards' | 'exam' | 'lab') => {
    let prompt = '';
    const topic = customCourseName.trim();
    const coursePrefix = topic ? `για το θέμα "${topic}"` : 'για την ύλη που παρατίθεται';
    const sourceInstruction = uploadedFiles.length > 0
      ? 'Ανάλυσε και τις συνημμένες εικόνες/σημειώσεις.'
      : 'Βασίσου αποκλειστικά στο θέμα που έδωσε ο χρήστης.';

    switch (actionType) {
      case 'quiz':
        prompt = `Παρακαλώ ${sourceInstruction} ${coursePrefix} και δημιούργησε ένα διαδραστικό Κουίζ Πολλαπλής Επιλογής (${questionCount} ερωτήσεις, δυσκολία: ${quizDifficulty}).`;
        break;
      case 'summary':
        prompt = `Παρακαλώ ${sourceInstruction} ${coursePrefix} και φτιάξε πλήρη, δομημένη σύνοψη με ορισμούς, βασικές θεωρίες, τύπους σε plain text και κρίσιμα σημεία.`;
        break;
      case 'sos':
        prompt = `${sourceInstruction} Εξέτασε ${coursePrefix} και εντόπισε SOS θέματα εξετάσεων, πιθανές ερωτήσεις ανάπτυξης, παγίδες και βασικά παραδείγματα.`;
        break;
      case 'flashcards':
        prompt = `${sourceInstruction} Δημιούργησε ${flashcardCount} περιεκτικές Flashcards επανάληψης ${coursePrefix}.`;
        break;
      case 'exam':
        prompt = `${sourceInstruction} Δημιούργησε Exam Simulator ${coursePrefix} με ${questionCount} ερωτήσεις επιπέδου ${quizDifficulty}, με ερωτήσεις πολλαπλής επιλογής και ανάπτυξης όπου ταιριάζει.`;
        break;
      case 'lab':
        prompt = `${sourceInstruction} Δημιούργησε Interactive Lab 2D Canvas Animation για ${coursePrefix}. Οπτικοποίησε ειδικά: "${labPrompt.trim() || topic}". Διάρκεια ${labDuration}, πολυπλοκότητα ${labComplexity}. Αυτό το αίτημα είναι αποκλειστικά για εργαστήριο: μην το αντικαταστήσεις με κουίζ, flashcards ή άλλο εργαλείο. Επέστρεψε ακριβώς ένα έγκυρο JSON μέσα σε block \`\`\`lab σύμφωνα με τις οδηγίες. Μην επιστρέψεις JavaScript, HTML ή LaTeX.`;
        break;
    }

    if (additionalNotes.trim()) {
      prompt += `\n\nΕπιπλέον οδηγίες χρήστη: ${additionalNotes.trim()}`;
    }

    onRunAction(prompt, uploadedFiles.length > 0 ? uploadedFiles : undefined);
    onClose();
  };

  const openActionWizard = (action: Parameters<typeof handleTriggerSyllabusAction>[0]) => setPendingAction(action);

  const handleBuildCustomQuiz = () => {
    const course = customCourseName.trim() || 'Πανεπιστημιακή Ύλη';
    const prompt = `Φτιάξε ένα διαδραστικό Κουίζ Πολλαπλής Επιλογής ${questionCount} ερωτήσεων για το θέμα/μάθημα: "${course}" σε επίπεδο δυσκολίας: "${quizDifficulty}".
Κάθε ερώτηση πρέπει να έχει 4 επιλογές (A, B, C, D), μόνο 1 σωστή, αναλυτική ακαδημαϊκή εξήγηση και το αντίστοιχο JSON \`\`\`quiz block στο τέλος για διαδραστική εκτέλεση.`;

    onRunAction(prompt, uploadedFiles.length > 0 ? uploadedFiles : undefined);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in font-mono">
      <div
        className={`w-full max-w-3xl max-h-[90vh] rounded-2xl border ${currentTheme.classes.borderPrimary} ${currentTheme.classes.bgPanel} shadow-2xl flex flex-col overflow-hidden`}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-black/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <span>{lang === 'el' ? 'Πανεπιστημιακό Κέντρο Εκπαίδευσης' : 'University Academic Hub'}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40">
                  AI Tutor
                </span>
              </h2>
              <p className="text-xs text-slate-400 font-sans">
                {lang === 'el'
                  ? 'Μαζική επεξεργασία φωτογραφιών ύλης, διαδραστικά κουίζ & SOS εξετάσεων'
                  : 'Bulk syllabus processing, interactive quizzes & high-yield exam prep'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-white/10 bg-black/20 px-4 pt-2 gap-2 text-xs font-bold">
          <button
            onClick={() => setActiveTab('syllabus')}
            className={`px-3.5 py-2 rounded-t-xl border-t border-x transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'syllabus'
                ? `${currentTheme.classes.bgCard} ${currentTheme.classes.borderPrimary} text-amber-300 border-b-0`
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>{lang === 'el' ? 'Φωτογραφίες Ύλης Εξαμήνου' : 'Syllabus & Lecture Photos'}</span>
            {uploadedFiles.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-black text-[10px] font-bold">
                {uploadedFiles.length}
              </span>
            )}
          </button>

        </div>

        {/* Body Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {pendingAction && (
            <div className={`rounded-2xl border ${currentTheme.classes.borderPrimary} bg-black/30 p-4 space-y-4`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-amber-400 font-bold">{lang === 'el' ? 'Επιλεγμένη λειτουργία' : 'Selected tool'}</p>
                  <h3 className="text-sm font-bold text-white">{lang === 'el' ? 'Ρύθμιση λειτουργίας' : 'Tool settings'}</h3>
                </div>
                <button type="button" onClick={() => setPendingAction(null)} className="text-xs text-slate-300 hover:text-white cursor-pointer">{lang === 'el' ? '← Κατηγορίες' : '← Categories'}</button>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">{lang === 'el' ? 'Θέμα / Ύλη' : 'Topic / material'}</label>
                <textarea value={customCourseName} onChange={(event) => setCustomCourseName(event.target.value)} rows={3} className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs focus:outline-hidden focus:border-amber-400" placeholder={lang === 'el' ? 'Γράψε οποιοδήποτε θέμα...' : 'Type any topic...'} />
              </div>
              {pendingAction === 'flashcards' && <div><label className="block text-xs text-slate-300 mb-1.5">Cards</label><select value={flashcardCount} onChange={(event) => setFlashcardCount(Number(event.target.value))} className="w-full rounded-xl bg-black/40 border border-white/10 text-white text-xs p-2"><option value="5">5</option><option value="10">10</option><option value="20">20</option></select></div>}
              {['quiz', 'exam'].includes(pendingAction) && <div className="grid grid-cols-2 gap-2"><label className="text-xs text-slate-300">Questions<select value={questionCount} onChange={(event) => setQuestionCount(Number(event.target.value))} className="mt-1 w-full rounded-xl bg-black/40 border border-white/10 text-white text-xs p-2"><option value="5">5</option><option value="10">10</option><option value="20">20</option></select></label><label className="text-xs text-slate-300">Difficulty<select value={quizDifficulty} onChange={(event) => setQuizDifficulty(event.target.value as typeof quizDifficulty)} className="mt-1 w-full rounded-xl bg-black/40 border border-white/10 text-white text-xs p-2"><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option><option value="exam">Exam</option></select></label></div>}
              {pendingAction === 'lab' && <div className="space-y-2"><label className="block text-xs text-slate-300">Custom visual prompt<textarea value={labPrompt} onChange={(event) => setLabPrompt(event.target.value)} rows={2} className="mt-1 w-full rounded-xl bg-black/40 border border-white/10 text-white text-xs p-2" placeholder="π.χ. Δείξε πώς σχηματίζεται ο δεσμός NaCl..." /></label><div className="grid grid-cols-2 gap-2"><label className="text-xs text-slate-300">Duration<select value={labDuration} onChange={(event) => setLabDuration(event.target.value as typeof labDuration)} className="mt-1 w-full rounded-xl bg-black/40 border border-white/10 text-white text-xs p-2"><option value="short">Short</option><option value="medium">Medium</option><option value="long">Long</option></select></label><label className="text-xs text-slate-300">Complexity<select value={labComplexity} onChange={(event) => setLabComplexity(event.target.value as typeof labComplexity)} className="mt-1 w-full rounded-xl bg-black/40 border border-white/10 text-white text-xs p-2"><option value="basic">Basic</option><option value="detailed">Detailed</option></select></label></div></div>}
              <button type="button" disabled={isSubmitting} onClick={() => { if (isSubmitting) return; setIsSubmitting(true); handleTriggerSyllabusAction(pendingAction); setPendingAction(null); }} className={`w-full py-2.5 rounded-xl text-xs font-bold ${currentTheme.classes.btnPrimary} ${currentTheme.classes.btnPrimaryHover} cursor-pointer disabled:opacity-50 disabled:pointer-events-none`}>🚀 {isSubmitting ? (lang === 'el' ? 'Δημιουργείται...' : 'Generating...') : (lang === 'el' ? 'Δημιουργία' : 'Generate')}</button>
            </div>
          )}
          {!pendingAction && activeTab === 'syllabus' && (
            <div className="space-y-4">
              {/* Course Title input */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  {lang === 'el' ? 'Θέμα για όλες τις λειτουργίες:' : 'Universal topic for every mode:'}
                </label>
                <textarea
                  value={customCourseName}
                  onChange={(e) => setCustomCourseName(e.target.value)}
                  rows={2}
                  placeholder={lang === 'el' ? 'Περιέγραψε εδώ το θέμα ή την άσκηση...' : 'Describe the topic or exercise here...'}
                  className="mt-2 w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-xs placeholder-slate-500 focus:outline-hidden focus:border-amber-400"
                />
              </div>

              {/* Upload Zone */}
              <div>
                <label className="flex items-center justify-between text-xs font-bold text-slate-300 mb-1.5">
                  <span>{lang === 'el' ? 'Μαζική Φόρτωση Φωτογραφιών Ύλης / Διαφανειών:' : 'Bulk Lecture Photos / Slides:'}</span>
                  {uploadedFiles.length > 0 && (
                    <button
                      onClick={handleClearAllFiles}
                      className="text-[11px] text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>{lang === 'el' ? 'Καθαρισμός όλων' : 'Clear all'}</span>
                    </button>
                  )}
                </label>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  multiple
                  accept="image/*,.pdf,text/*"
                  className="hidden"
                />

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed ${
                    uploadedFiles.length > 0 ? 'border-amber-500/50 bg-amber-500/5' : 'border-white/20 bg-black/20'
                  } hover:border-amber-400 rounded-2xl p-5 text-center cursor-pointer transition-all`}
                >
                  <Upload className="w-7 h-7 text-amber-400 mx-auto mb-2 opacity-80" />
                  <p className="text-xs font-bold text-white font-sans">
                    {lang === 'el'
                      ? 'Κάνε κλικ για να επιλέξεις πολλαπλές φωτογραφίες ή διαφάνειες της ύλης'
                      : 'Click to select multiple photos, slides or syllabus documents'}
                  </p>
                  <p className="text-[11px] text-slate-400 font-sans mt-1">
                    {lang === 'el'
                      ? 'Υποστηρίζει πολλαπλές λήψεις από βιβλία, σημειώσεις καθηγητή, πίνακες & PDF'
                      : 'Supports multi-page textbook photos, lecture slides, handwriting & PDFs'}
                  </p>
                </div>

                {/* Uploaded files preview grid */}
                {uploadedFiles.length > 0 && (
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {uploadedFiles.map((file, idx) => (
                      <div
                        key={idx}
                        className="relative group rounded-xl overflow-hidden border border-white/15 bg-black/40 p-2 flex flex-col items-center text-center"
                      >
                        {file.previewUrl ? (
                          <img
                            src={file.previewUrl}
                            alt={file.name}
                            className="w-full h-16 object-cover rounded-lg mb-1 border border-white/10"
                          />
                        ) : (
                          <div className="w-full h-16 bg-white/5 rounded-lg flex items-center justify-center text-amber-400 mb-1">
                            <FileText className="w-6 h-6" />
                          </div>
                        )}
                        <span className="text-[10px] text-slate-300 truncate w-full font-mono">
                          {file.name}
                        </span>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveFile(idx);
                          }}
                          className="absolute top-1 right-1 p-1 rounded-md bg-black/80 text-rose-400 hover:bg-rose-500 hover:text-white transition-colors"
                          title="Διαγραφή"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons Grid */}
              <div className="pt-2">
                <label className="block text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">
                  {lang === 'el' ? 'Επέλεξε τι θέλεις να κάνει το Ai για εσένα:' : 'Select what you want Ai to do:'}
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    onClick={() => openActionWizard('quiz')}
                    className={`p-3.5 rounded-xl border ${currentTheme.classes.borderPrimary} ${currentTheme.classes.bgCard} hover:border-amber-400 hover:bg-white/5 text-left transition-all cursor-pointer flex items-start gap-3 group`}
                  >
                    <div className="p-2 rounded-lg bg-amber-500/20 text-amber-300 group-hover:scale-110 transition-transform shrink-0">
                      <Award className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1">
                        <span>{lang === 'el' ? 'Διαδραστικό Quiz Πολλαπλής' : 'Interactive Multiple-Choice Quiz'}</span>
                        <ArrowRight className="w-3 h-3 text-amber-400" />
                      </div>
                      <p className="text-[11px] text-slate-400 font-sans mt-0.5">
                        {lang === 'el'
                          ? '10 ερωτήσεις με απαντήσεις A-B-C-D, βαθμολογία & αναλυτικές επεξηγήσεις'
                          : '10 questions with instant feedback, live scoring & reasoning'}
                      </p>
                    </div>
                  </button>

                  <button
                    onClick={() => openActionWizard('sos')}
                    className={`p-3.5 rounded-xl border ${currentTheme.classes.borderPrimary} ${currentTheme.classes.bgCard} hover:border-amber-400 hover:bg-white/5 text-left transition-all cursor-pointer flex items-start gap-3 group`}
                  >
                    <div className="p-2 rounded-lg bg-rose-500/20 text-rose-300 group-hover:scale-110 transition-transform shrink-0">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1">
                        <span>{lang === 'el' ? 'SOS Θέματα & Παγίδες Εξετάσεων' : 'High-Yield SOS Exam Topics'}</span>
                        <ArrowRight className="w-3 h-3 text-amber-400" />
                      </div>
                      <p className="text-[11px] text-slate-400 font-sans mt-0.5">
                        {lang === 'el'
                          ? 'Εντοπισμός των πιο συχνών ερωτήσεων και κρίσιμων σημείων βαθμολόγησης'
                          : 'Identify recurrent exam patterns, tricky traps and key definitions'}
                      </p>
                    </div>
                  </button>

                  <button
                    onClick={() => openActionWizard('summary')}
                    className={`p-3.5 rounded-xl border ${currentTheme.classes.borderPrimary} ${currentTheme.classes.bgCard} hover:border-amber-400 hover:bg-white/5 text-left transition-all cursor-pointer flex items-start gap-3 group`}
                  >
                    <div className="p-2 rounded-lg bg-sky-500/20 text-sky-300 group-hover:scale-110 transition-transform shrink-0">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1">
                        <span>{lang === 'el' ? 'Πλήρης Σύνοψη Ύλης Εξαμήνου' : 'Semester Cheat Sheet / Notes'}</span>
                        <ArrowRight className="w-3 h-3 text-amber-400" />
                      </div>
                      <p className="text-[11px] text-slate-400 font-sans mt-0.5">
                        {lang === 'el'
                          ? 'Συνοπτικές σημειώσεις με ορισμούς, τύπους και διαγράμματα'
                          : 'Structured notes covering all chapters, key formulas and models'}
                      </p>
                    </div>
                  </button>

                  <button onClick={() => openActionWizard('flashcards')} className={`p-3.5 rounded-xl border ${currentTheme.classes.borderPrimary} ${currentTheme.classes.bgCard} hover:border-amber-400 hover:bg-white/5 text-left transition-all cursor-pointer flex items-start gap-3 group`}>
                    <div className="p-2 rounded-lg bg-amber-500/20 text-amber-300 group-hover:scale-110 transition-transform shrink-0"><Layers className="w-5 h-5" /></div>
                    <div><div className="text-xs font-bold text-white">{lang === 'el' ? 'Flashcards με Spaced Repetition' : 'Spaced-Repetition Flashcards'}</div><p className="text-[11px] text-slate-400 font-sans mt-0.5">{lang === 'el' ? 'Κάρτες με αξιολόγηση δυσκολίας και επανάληψη SM-2' : 'Review cards with SM-2 difficulty scheduling'}</p></div>
                  </button>
                  <button onClick={() => openActionWizard('exam')} className={`p-3.5 rounded-xl border ${currentTheme.classes.borderPrimary} ${currentTheme.classes.bgCard} hover:border-amber-400 hover:bg-white/5 text-left transition-all cursor-pointer flex items-start gap-3 group`}>
                    <div className="p-2 rounded-lg bg-rose-500/20 text-rose-300 group-hover:scale-110 transition-transform shrink-0"><AlertTriangle className="w-5 h-5" /></div>
                    <div><div className="text-xs font-bold text-white">{lang === 'el' ? 'Exam Simulator & SOS Radar' : 'Exam Simulator & SOS Radar'}</div><p className="text-[11px] text-slate-400 font-sans mt-0.5">{lang === 'el' ? 'Χρονόμετρο, βαθμολογία και ανάλυση αδυναμιών' : 'Timed exam, scoring and weakness analysis'}</p></div>
                  </button>
                  <button onClick={() => openActionWizard('lab')} className={`p-3.5 rounded-xl border ${currentTheme.classes.borderPrimary} ${currentTheme.classes.bgCard} hover:border-amber-400 hover:bg-white/5 text-left transition-all cursor-pointer flex items-start gap-3 group`}>
                    <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-300 group-hover:scale-110 transition-transform shrink-0"><PlayCircle className="w-5 h-5" /></div>
                    <div><div className="text-xs font-bold text-white">{lang === 'el' ? 'Διαδραστική Οπτικοποίηση / 2D Canvas Animation' : 'Interactive Visualization / 2D Canvas Animation'}</div><p className="text-[11px] text-slate-400 font-sans mt-0.5">{lang === 'el' ? 'Άτομα, κύτταρα, DNA και χημικές αντιδράσεις' : 'Atoms, cells, DNA and chemical reactions'}</p></div>
                  </button>
                  <button onClick={() => { onClose(); onOpenChemistry(); }} className={`p-3.5 rounded-xl border ${currentTheme.classes.borderPrimary} ${currentTheme.classes.bgCard} hover:border-cyan-300 hover:bg-cyan-400/5 text-left transition-all cursor-pointer flex items-start gap-3 group`}>
                    <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-300 group-hover:scale-110 transition-transform shrink-0"><span className="text-xl" aria-hidden="true">⚗</span></div>
                    <div><div className="text-xs font-bold text-white flex items-center gap-1">{lang === 'el' ? 'Χημεία' : 'Chemistry'}<ArrowRight className="w-3 h-3 text-cyan-300" /></div><p className="text-[11px] text-slate-400 font-sans mt-0.5">{lang === 'el' ? 'Περιοδικός πίνακας, ενώσεις και διαδραστικές αντιδράσεις' : 'Periodic table, compounds and interactive reactions'}</p></div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {false && activeTab === 'syllabus' && (
            <div className="space-y-4 font-mono">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  {lang === 'el' ? 'Θέμα ή Μάθημα Κουίζ:' : 'Quiz Subject / Topic:'}
                </label>
                <input
                  type="text"
                  value={customCourseName}
                  onChange={(e) => setCustomCourseName(e.target.value)}
                  placeholder={
                    lang === 'el'
                      ? 'π.χ. Δίκτυα Υπολογιστών - Πρωτόκολλα TCP/IP, Βιοχημεία, Αστικό Δίκαιο...'
                      : 'e.g. Computer Networks TCP/IP, Microeconomics, Organic Chemistry...'
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-xs placeholder-slate-500 focus:outline-hidden focus:border-amber-400"
                />
              </div>

              {/* Number of questions */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  {lang === 'el' ? 'Αριθμός Ερωτήσεων:' : 'Number of Questions:'}
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[5, 10, 15, 20].map((num) => (
                    <button
                      key={num}
                      onClick={() => setQuestionCount(num)}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        questionCount === num
                          ? `${currentTheme.classes.badgeBg} ${currentTheme.classes.badgeText} border-amber-400`
                          : 'bg-black/30 border-white/10 text-slate-400 hover:border-white/30'
                      }`}
                    >
                      {num} {lang === 'el' ? 'Ερωτήσεις' : 'Questions'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Difficulty Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  {lang === 'el' ? 'Επίπεδο Δυσκολίας:' : 'Difficulty Level:'}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'easy', label: lang === 'el' ? 'Βασικό' : 'Basic', badge: 'bg-emerald-500/20 text-emerald-300' },
                    { id: 'medium', label: lang === 'el' ? 'Μεσαίο' : 'Medium', badge: 'bg-sky-500/20 text-sky-300' },
                    { id: 'hard', label: lang === 'el' ? 'Προχωρημένο' : 'Advanced', badge: 'bg-amber-500/20 text-amber-300' },
                    { id: 'exam', label: lang === 'el' ? 'Εξετάσεις SOS' : 'Exam SOS', badge: 'bg-rose-500/20 text-rose-300' },
                  ].map((lvl) => (
                    <button
                      key={lvl.id}
                      onClick={() => setQuizDifficulty(lvl.id as any)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center gap-1 ${
                        quizDifficulty === lvl.id
                          ? `${currentTheme.classes.badgeBg} ${currentTheme.classes.badgeText} border-amber-400`
                          : 'bg-black/30 border-white/10 text-slate-400 hover:border-white/30'
                      }`}
                    >
                      <span>{lvl.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Optional notes */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  {lang === 'el' ? 'Ειδικές Εστιάσεις ή Σημειώσεις (προαιρετικό):' : 'Specific Focus Areas (optional):'}
                </label>
                <textarea
                  value={additionalNotes}
                  onChange={(e) => setAdditionalNotes(e.target.value)}
                  rows={2}
                  placeholder={
                    lang === 'el'
                      ? 'π.χ. Εστίασε στα κεφάλαια 4 και 5, δώσε έμφαση σε αλγοριθμικές ασκήσεις...'
                      : 'e.g. Focus on Chapters 4 & 5, emphasize numerical calculations...'
                  }
                  className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs placeholder-slate-500 focus:outline-hidden focus:border-amber-400"
                />
              </div>

              <div className="pt-2">
                <button
                  onClick={() => openActionWizard('quiz')}
                  className={`w-full py-3 rounded-xl text-xs font-bold ${currentTheme.classes.btnPrimary} ${currentTheme.classes.btnPrimaryHover} shadow-lg shadow-amber-500/30 flex items-center justify-center gap-2 cursor-pointer transition-all`}
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{lang === 'el' ? 'Δημιουργία Διαδραστικού Κουίζ Τώρα' : 'Generate Interactive Quiz Now'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
