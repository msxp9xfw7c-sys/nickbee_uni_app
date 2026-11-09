import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Send, RefreshCw } from 'lucide-react';
import { MultimodalAttachment, AppTheme } from '../types';

interface TerminalViewProps {
  onSendMessage: (text: string, attachments?: MultimodalAttachment[] | MultimodalAttachment) => Promise<string | undefined>;
  onSaveAndEncrypt: () => Promise<string | undefined>;
  isGenerating: boolean;
  isOnline: boolean;
  lang: 'el' | 'en';
  currentTheme: AppTheme;
  selectedModel: string;
}

interface TerminalLogLine {
  id: string;
  type: 'banner' | 'user' | 'ai' | 'system' | 'error' | 'success';
  text: string;
}

export const TerminalView: React.FC<TerminalViewProps> = ({
  onSendMessage,
  onSaveAndEncrypt,
  isGenerating,
  isOnline,
  currentTheme,
  selectedModel,
}) => {
  const [logs, setLogs] = useState<TerminalLogLine[]>([]);
  const [cliInput, setCliInput] = useState('');
  const [interactiveState, setInteractiveState] = useState<'idle' | 'read_choose' | 'upload_path' | 'upload_prompt'>('idle');
  const [readFilesList, setReadFilesList] = useState<string[]>([]);
  const [pendingUploadFile, setPendingUploadFile] = useState<File | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initial nickbee Python banner
    const bannerLines: TerminalLogLine[] = [
      {
        id: '1',
        type: 'banner',
        text: '============================================================',
      },
      {
        id: '2',
        type: 'banner',
        text: `🐝 nickbee Terminal & HoneyVault Active [User: nickbee | AI: Ai (${selectedModel})]`,
      },
      {
        id: '3',
        type: 'banner',
        text: " • Type 'exit' / 'quit' -> Αυτόματη Κρυπτογράφηση & Έξοδος",
      },
      {
        id: '4',
        type: 'banner',
        text: " • Type 'read'         -> Αποκρυπτογράφηση Ιστορικού Vault",
      },
      {
        id: '5',
        type: 'banner',
        text: " • Type 'upload'       -> Αποστολή Εικόνας / Ήχου / Βίντεο / PDF",
      },
      {
        id: '6',
        type: 'banner',
        text: '============================================================\n',
      },
    ];
    setLogs(bannerLines);
  }, [selectedModel]);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs, isGenerating]);

  const addLog = (type: TerminalLogLine['type'], text: string) => {
    setLogs((prev) => [...prev, { id: Math.random().toString(), type, text }]);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPendingUploadFile(file);
    addLog('system', `📁 Επιλέχθηκε αρχείο: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
    addLog('system', '💬 Τι θέλεις να κάνει το Ai με αυτό το αρχείο; (Γράψε ερώτηση ή πάτησε Enter για ανάλυση)');
    setInteractiveState('upload_prompt');
  };

  const handleCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    const input = cliInput.trim();
    setCliInput('');

    if (!input && interactiveState === 'idle') return;

    // Handle interactive prompt states
    if (interactiveState === 'read_choose') {
      let selectedFile = readFilesList[0];
      const num = parseInt(input, 10);
      if (!isNaN(num) && num >= 1 && num <= readFilesList.length) {
        selectedFile = readFilesList[num - 1];
      }

      addLog('system', `⏳ Ανάγνωση και αποκρυπτογράφηση: ${selectedFile}...`);
      try {
        const res = await fetch('/api/sessions/decrypt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: selectedFile }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to decrypt');
        }

        addLog('banner', '============================================================');
        addLog('success', `🔓 ΑΠΟΚΡΥΠΤΟΓΡΑΦΗΜΕΝΗ ΣΥΝΟΜΙΛΙΑ: ${selectedFile}`);
        addLog('banner', '============================================================');
        addLog('ai', data.rawText);
      } catch (err: any) {
        addLog('error', `❌ Αποτυχία αποκρυπτογράφησης! ${err.message}`);
      }
      setInteractiveState('idle');
      return;
    }

    if (interactiveState === 'upload_prompt') {
      if (!pendingUploadFile) {
        setInteractiveState('idle');
        return;
      }

      const promptText = input || 'Περίγραψε και ανάλυσε αυτό το αρχείο λεπτομερώς.';
      addLog('user', `📁 Αρχείο: ${pendingUploadFile.name} | Ερώτηση: ${promptText}`);
      addLog('system', '⏳ Ανέβασμα και επεξεργασία αρχείου στο Ai...');

      const reader = new FileReader();
      reader.onload = async () => {
        const result = reader.result as string;
        const base64Data = result.split(',')[1];

        const attachment: MultimodalAttachment = {
          name: pendingUploadFile.name,
          mimeType: pendingUploadFile.type || 'application/octet-stream',
          dataBase64: base64Data,
          sizeBytes: pendingUploadFile.size,
        };

        const aiResponse = await onSendMessage(promptText, attachment);
        if (aiResponse) {
          addLog('banner', '🐝 Ai:');
          addLog('ai', aiResponse);
        }
        setPendingUploadFile(null);
        setInteractiveState('idle');
      };
      reader.readAsDataURL(pendingUploadFile);
      return;
    }

    // Standard commands
    addLog('user', `👤 nickbee: ${input}`);

    if (input.toLowerCase() === 'read') {
      try {
        const res = await fetch('/api/sessions/list');
        const data = await res.json();
        const files: string[] = (data.files || []).map((f: any) => f.filename);

        if (files.length === 0) {
          addLog('system', '📂 Δεν βρέθηκαν κρυπτογραφημένα αρχεία (.enc) στο HoneyVault.\n');
          return;
        }

        addLog('banner', '==================================================');
        addLog('system', '📂 ΔΙΑΘΕΣΙΜΕΣ ΚΡΥΠΤΟΓΡΑΦΗΜΕΝΕΣ ΣΥΝΟΜΙΛΙΕΣ (HoneyVault):');
        addLog('banner', '==================================================');
        files.forEach((file, idx) => {
          addLog('system', ` [${idx + 1}] ${file}`);
        });

        setReadFilesList(files);
        setInteractiveState('read_choose');
        addLog('system', '\nΔιάλεξε αριθμό (ή πάτησε Enter για το πιο πρόσφατο):');
      } catch (err: any) {
        addLog('error', `Σφάλμα ανάγνωσης vault: ${err.message}`);
      }
      return;
    }

    if (input.toLowerCase() === 'upload') {
      if (!isOnline) {
        addLog('error', '⚠️ ΔΕΝ ΥΠΑΡΧΕΙ ΣΥΝΔΕΣΗ ΣΤΟ INTERNET!');
        return;
      }
      addLog('system', '📁 Άνοιγμα επιλογέα αρχείου... (Επιλέξτε Εικόνα / Ήχο / Βίντεο / PDF / Κώδικα)');
      fileInputRef.current?.click();
      return;
    }

    if (input.toLowerCase() === 'save') {
      addLog('system', '🔐 Αποθήκευση ερωτήσεων στο HoneyVault...');
      const saveResult = await onSaveAndEncrypt();
      if (saveResult) addLog('success', saveResult);
      return;
    }

    if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
      addLog('system', '🔐 Αυτόματη Κρυπτογράφηση & Αποθήκευση στο HoneyVault...');
      const saveResult = await onSaveAndEncrypt();
      if (saveResult) {
        addLog('success', saveResult);
      }
      addLog('banner', '============================================================');
      addLog('system', '🐝 Ai: Συνεδρία ολοκληρώθηκε με ασφάλεια. Γεια σου nickbee!\n');
      return;
    }

    if (!isOnline) {
      addLog('error', '⚠️ ΔΕΝ ΥΠΑΡΧΕΙ ΣΥΝΔΕΣΗ ΣΤΟ INTERNET!\n   Ελέγξτε τη σύνδεσή σας και προσπαθήστε ξανά.');
      return;
    }

    // Standard chat message turn
    const responseText = await onSendMessage(input);
    if (responseText) {
      addLog('banner', '🐝 Ai:');
      addLog('ai', responseText);
    }
  };

  return (
    <div className={`flex-1 flex flex-col ${currentTheme.classes.bgRoot} text-slate-100 font-mono text-xs overflow-hidden select-text`}>
      {/* Terminal Title Bar */}
      <div className={`p-2.5 px-4 ${currentTheme.classes.bgPanel} border-b ${currentTheme.classes.borderPrimary} flex items-center justify-between text-amber-300 text-[11px]`}>
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-amber-400" />
          <span className="font-bold font-mono">nickbee-cli &mdash; python3 honey_vault.py ({selectedModel})</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-amber-400 font-bold">&bull; Hive Active</span>
          <span className="text-slate-400 font-mono">UTF-8 &bull; Fernet 128</span>
        </div>
      </div>

      {/* Terminal Output Log */}
      <div className={`flex-1 overflow-y-auto p-4 space-y-2 leading-relaxed ${currentTheme.classes.bgRoot}`}>
        {logs.map((log) => (
          <div
            key={log.id}
            className={`whitespace-pre-wrap font-mono ${
              log.type === 'banner'
                ? 'text-amber-500/80 font-bold'
                : log.type === 'user'
                ? 'text-yellow-300 font-bold'
                : log.type === 'ai'
                ? 'text-slate-200'
                : log.type === 'error'
                ? 'text-rose-400 font-semibold'
                : log.type === 'success'
                ? 'text-amber-300 font-bold'
                : 'text-amber-200/80'
            }`}
          >
            {log.text}
          </div>
        ))}

        {isGenerating && (
          <div className="text-amber-400 flex items-center gap-2 py-1 animate-pulse font-mono">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
            <span>🐝 Ai υπολογίζει την απάντηση...</span>
          </div>
        )}

        <div ref={terminalEndRef} />
      </div>

      {/* Terminal Input Line */}
      <div className={`p-3 ${currentTheme.classes.bgPanel} border-t ${currentTheme.classes.borderPrimary}`}>
        <form onSubmit={handleCommand} className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,audio/*,video/*,application/pdf,text/*"
            onChange={handleFileUpload}
            className="hidden"
          />

          <span className={`font-bold shrink-0 font-mono ${currentTheme.classes.textAccent}`}>
            {interactiveState === 'read_choose'
              ? 'Διάλεξε [1-N]:'
              : interactiveState === 'upload_prompt'
              ? 'Ερώτηση Αρχείου:'
              : 'nickbee@hive:~$'}
          </span>

          <input
            type="text"
            value={cliInput}
            onChange={(e) => setCliInput(e.target.value)}
            disabled={isGenerating}
            placeholder={
              interactiveState === 'read_choose'
                ? 'π.χ. 1 (ή Enter για το πιο πρόσφατο)'
                : interactiveState === 'upload_prompt'
                ? 'π.χ. Περίγραψε αυτό το αρχείο.'
                : 'γράψε μήνυμα, ή "read", "upload", "exit"...'
            }
            className="flex-1 bg-transparent border-none text-slate-100 placeholder-slate-600 focus:outline-none font-mono text-xs"
            autoFocus
          />

          <button
            type="submit"
            disabled={!cliInput.trim() && interactiveState === 'idle'}
            className="p-1.5 rounded text-amber-400 hover:text-amber-300 hover:bg-amber-950/40 transition-colors cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
