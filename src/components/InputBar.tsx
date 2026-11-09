import React, { useState, useRef } from 'react';
import {
  Send,
  Paperclip,
  X,
  Lock,
  Globe,
  FileText,
  Music,
  Video,
  GraduationCap,
  Sparkles,
  Award,
  AlertTriangle,
  BookOpen,
} from 'lucide-react';
import { MultimodalAttachment, AppTheme } from '../types';

interface InputBarProps {
  onSendMessage: (text: string, attachments?: MultimodalAttachment[]) => void;
  onSaveAndEncrypt: () => void;
  onOpenVault: () => void;
  onOpenUniversityHub?: () => void;
  isGenerating: boolean;
  isOnline: boolean;
  useSearchGrounding: boolean;
  setUseSearchGrounding: (v: boolean) => void;
  lang: 'el' | 'en';
  currentTheme: AppTheme;
  chatScale: number;
  onChatScaleChange: (next: number) => void;
  editText?: string | null;
  onSubmitEdit?: (text: string) => void;
  onCancelEdit?: () => void;
}

export const InputBar: React.FC<InputBarProps> = ({
  onSendMessage,
  onSaveAndEncrypt,
  onOpenVault,
  onOpenUniversityHub,
  isGenerating,
  isOnline,
  useSearchGrounding,
  setUseSearchGrounding,
  lang,
  currentTheme,
  chatScale,
  onChatScaleChange,
  editText,
  onSubmitEdit,
  onCancelEdit,
}) => {
  const [inputText, setInputText] = useState('');
  const [attachments, setAttachments] = useState<MultimodalAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (editText !== undefined && editText !== null) setInputText(editText);
  }, [editText]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64Data = result.split(',')[1];
        setAttachments((prev) => [
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

  const handleRemoveAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleClearAllAttachments = () => {
    setAttachments([]);
  };

  const handleSubmit = (e?: React.FormEvent, overrideText?: string) => {
    if (e) e.preventDefault();
    const textToSend = overrideText !== undefined ? overrideText : inputText;
    const trimmed = textToSend.trim();

    if (!trimmed && attachments.length === 0) return;

    // Check for Python script special commands
    if (trimmed.toLowerCase() === 'read') {
      onOpenVault();
      setInputText('');
      return;
    }

    if (trimmed.toLowerCase() === 'upload') {
      fileInputRef.current?.click();
      setInputText('');
      return;
    }

    if (trimmed.toLowerCase() === 'save' || trimmed.toLowerCase() === 'exit' || trimmed.toLowerCase() === 'quit') {
      onSaveAndEncrypt();
      setInputText('');
      return;
    }

    if (editText !== undefined && editText !== null && onSubmitEdit) {
      onSubmitEdit(trimmed);
    } else {
      onSendMessage(trimmed, attachments.length > 0 ? attachments : undefined);
    }
    setInputText('');
    setAttachments([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className={`w-full shrink-0 border-t ${currentTheme.classes.borderPrimary} ${currentTheme.classes.bgPanel} backdrop-blur-md p-3.5 sm:p-4 font-mono`}>
      <div className="w-full max-w-3xl mx-auto space-y-2.5">
        {/* Multi-Attachment preview banner */}
        {attachments.length > 0 && (
          <div className={`p-2.5 rounded-xl ${currentTheme.classes.badgeBg} border ${currentTheme.classes.borderPrimary} animate-fade-in text-xs space-y-2`}>
            <div className="flex items-center justify-between">
              <span className="font-bold text-white flex items-center gap-1.5">
                <GraduationCap className="w-4 h-4 text-amber-400" />
                <span>
                  {attachments.length === 1
                    ? lang === 'el' ? '1 Συνημμένο Αρχείο / Ύλη' : '1 Attached File / Syllabus'
                    : lang === 'el' ? `${attachments.length} Φωτογραφίες / Αρχεία Ύλης` : `${attachments.length} Attached Files / Syllabus`}
                </span>
              </span>
              <button
                type="button"
                onClick={handleClearAllAttachments}
                className="text-[11px] text-rose-400 hover:text-rose-300 underline cursor-pointer"
              >
                {lang === 'el' ? 'Αφαίρεση όλων' : 'Clear all'}
              </button>
            </div>

            {/* Thumbnail horizontal scroll row */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {attachments.map((att, idx) => (
                <div
                  key={idx}
                  className="relative group shrink-0 w-24 p-1.5 rounded-lg bg-black/40 border border-white/10 flex flex-col items-center text-center"
                >
                  {att.mimeType.startsWith('image/') ? (
                    <img
                      src={att.previewUrl}
                      alt={att.name}
                      className="w-full h-12 object-cover rounded border border-white/10 mb-1"
                    />
                  ) : att.mimeType.startsWith('audio/') ? (
                    <div className="w-full h-12 bg-amber-500/20 text-amber-400 flex items-center justify-center rounded mb-1">
                      <Music className="w-4 h-4" />
                    </div>
                  ) : att.mimeType.startsWith('video/') ? (
                    <div className="w-full h-12 bg-amber-500/20 text-amber-400 flex items-center justify-center rounded mb-1">
                      <Video className="w-4 h-4" />
                    </div>
                  ) : (
                    <div className="w-full h-12 bg-amber-500/20 text-amber-400 flex items-center justify-center rounded mb-1">
                      <FileText className="w-4 h-4" />
                    </div>
                  )}

                  <span className="text-[10px] text-slate-300 truncate w-full font-mono">
                    {att.name}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleRemoveAttachment(idx)}
                    className="absolute -top-1 -right-1 p-0.5 rounded-full bg-black text-rose-400 hover:bg-rose-600 hover:text-white border border-white/20"
                    title="Αφαίρεση"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>

            {/* Quick Action Chips for attached syllabus */}
            <div className="pt-1 flex flex-wrap items-center gap-1.5 border-t border-white/10">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                {lang === 'el' ? 'Άμεση Ενέργεια:' : 'Quick Action:'}
              </span>
              <button
                type="button"
                onClick={() =>
                  handleSubmit(
                    undefined,
                    'Παρακαλώ ανάλυσε τις συνημμένες φωτογραφίες της ύλης και δημιούργησε ένα διαδραστικό Κουίζ 10 ερωτήσεων πολλαπλής επιλογής (A, B, C, D) με αναλυτικές ακαδημαϊκές επεξηγήσεις και το αντίστοιχο ```quiz JSON block.'
                  )
                }
                className="px-2 py-0.5 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Award className="w-3 h-3" />
                <span>{lang === 'el' ? '🎯 Φτιάξε Quiz 10 Ερωτήσεων' : '🎯 Generate 10-Q Quiz'}</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  handleSubmit(
                    undefined,
                    'Παρακαλώ μελέτησε τις συνημμένες φωτογραφίες της ύλης και φτιάξε μου μια πλήρη σύνοψη εξαμήνου (Cheat Sheet) και τα βασικά SOS θέματα εξετάσεων.'
                  )
                }
                className="px-2 py-0.5 rounded-md bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
              >
                <BookOpen className="w-3 h-3" />
                <span>{lang === 'el' ? '📑 Σύνοψη & SOS Θέματα' : '📑 Summary & SOS'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Input box form with hacker terminal theme */}
        <form
          onSubmit={handleSubmit}
          className={`relative flex flex-col rounded-xl border ${currentTheme.classes.borderPrimary} ${currentTheme.classes.bgInput} shadow-md shadow-black/40 focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-500/20 transition-all`}
        >
          <div className="flex items-center justify-between px-3 pt-2 text-[11px] text-slate-400 select-none">
            <span className={`font-bold ${currentTheme.classes.textAccent}`}>nickbee@academic:~$</span>
            {editText !== undefined && editText !== null && <button type="button" onClick={onCancelEdit} className="text-[10px] text-rose-300 hover:text-white cursor-pointer">Cancel edit</button>}
          </div>

          <textarea
            rows={2}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isGenerating || !isOnline}
            placeholder={
              !isOnline
                ? lang === 'el'
                  ? '⚠️ Δεν υπάρχει σύνδεση στο Internet...'
                  : '⚠️ No Internet connection...'
                : lang === 'el'
                ? 'Πληκτρολογήστε ερώτηση, ζητήστε Quiz ή ανεβάστε φωτογραφίες ύλης...'
                : 'Ask questions, request quizzes, or upload syllabus photos...'
            }
            className="w-full resize-none px-3 py-1.5 text-xs sm:text-sm bg-transparent text-slate-100 placeholder-slate-500 focus:outline-none disabled:opacity-50 font-mono leading-relaxed"
          />

          {/* Bottom Toolbar inside input container */}
          <div className="flex items-center justify-between p-2.5 pt-1 text-xs border-t border-white/10">
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,audio/*,video/*,application/pdf,text/*"
                onChange={handleFileSelect}
                className="hidden"
              />

              {/* Upload photos/syllabus button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`p-1.5 rounded-lg ${currentTheme.classes.textMuted} hover:text-white transition-colors flex items-center gap-1 cursor-pointer`}
                title="Ανέβασμα πολλαπλών φωτογραφιών ύλης, διαφανειών ή αρχείων"
              >
                <Paperclip className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-[11px] font-bold font-mono">upload</span>
              </button>

              {/* University Hub button */}
              {onOpenUniversityHub && (
                <button
                  type="button"
                  onClick={onOpenUniversityHub}
                  className={`p-1.5 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition-colors flex items-center gap-1 text-[11px] font-bold font-mono cursor-pointer`}
                  title="Πανεπιστημιακό Κέντρο: Μαζική Ύλη & Γεννήτρια Quiz"
                >
                  <GraduationCap className="w-3.5 h-3.5 text-amber-400" />
                  <span>{lang === 'el' ? 'Ύλη & Quiz' : 'Syllabus & Quiz'}</span>
                </button>
              )}

              {/* Read button */}
              <button
                type="button"
                onClick={onOpenVault}
                className={`p-1.5 rounded-lg ${currentTheme.classes.textMuted} hover:text-white transition-colors flex items-center gap-1 cursor-pointer`}
                title="Open encrypted vault (read command)"
              >
                <Lock className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-[11px] font-bold font-mono">read</span>
              </button>

              {/* Optional external-search hint for Google Search grounding */}
              <button
                type="button"
                onClick={() => setUseSearchGrounding(!useSearchGrounding)}
                className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-mono cursor-pointer ${
                  useSearchGrounding
                    ? `${currentTheme.classes.badgeBg} ${currentTheme.classes.badgeText} border ${currentTheme.classes.borderPrimary} font-bold`
                    : 'text-slate-500 hover:text-slate-200'
                }`}
                title="Σήμανση ότι απαιτείται εξωτερική αναζήτηση"
              >
                <Globe className="w-3.5 h-3.5" />
                <span className="hidden md:inline">External Search</span>
              </button>

            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-black/30 p-1" aria-label="Chat zoom">
                <button type="button" onClick={() => onChatScaleChange(Math.max(0.8, Number((chatScale - 0.1).toFixed(2))))} className="rounded px-2 py-1 text-[11px] font-bold text-slate-300 hover:bg-white/10 hover:text-white cursor-pointer" aria-label="Decrease chat zoom">A-</button>
                <span className="min-w-8 text-center text-[10px] text-amber-300">{Math.round(chatScale * 100)}%</span>
                <button type="button" onClick={() => onChatScaleChange(Math.min(1.3, Number((chatScale + 0.1).toFixed(2))))} className="rounded px-2 py-1 text-[11px] font-bold text-slate-300 hover:bg-white/10 hover:text-white cursor-pointer" aria-label="Increase chat zoom">A+</button>
              </div>
              {/* Auto Encrypt & Save Button */}
              <button
                type="button"
                onClick={onSaveAndEncrypt}
                className={`px-2.5 py-1.5 rounded-lg border ${currentTheme.classes.borderMuted} hover:border-amber-400 text-slate-200 hover:text-white text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer`}
                title="Save user questions to an encrypted session (.enc)"
              >
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>save</span>
              </button>

              {/* Submit button */}
              <button
                type="submit"
                disabled={(!inputText.trim() && attachments.length === 0) || isGenerating || !isOnline}
                className={`p-2 rounded-lg ${currentTheme.classes.btnPrimary} ${currentTheme.classes.btnPrimaryHover} disabled:opacity-40 font-bold shadow-md shadow-amber-500/20 transition-all flex items-center justify-center cursor-pointer`}
                title={editText !== undefined && editText !== null ? 'Save & Submit' : 'Send message'}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </form>

        {/* Footnote */}
        <div className="flex items-center justify-between text-[10px] text-slate-500 px-1 font-mono">
          <span>🎓 University Academic AI &bull; Fernet AES-128</span>
          <span className="hidden sm:inline">⚡ Multi-Photo Syllabus Ready</span>
        </div>
      </div>
    </div>
  );
};
