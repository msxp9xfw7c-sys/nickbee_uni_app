import React, { useState, useEffect } from 'react';
import MarkdownContent from '../lib/MarkdownContent';
import {
  FolderLock,
  Lock,
  Unlock,
  Download,
  Trash2,
  FileText,
  KeyRound,
  RefreshCw,
  X,
  Check,
  AlertCircle,
  Copy,
  Sparkles,
  Hexagon,
} from 'lucide-react';
import { VaultFile, DecryptedSession } from '../types';
import { parseQuizFromText } from '../utils/quizParser';
import { AVAILABLE_MODELS } from '../lib/themes';

interface VaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadSessionToChat?: (messages: any[]) => void;
  lang: 'el' | 'en';
}

export const VaultModal: React.FC<VaultModalProps> = ({
  isOpen,
  onClose,
  onLoadSessionToChat,
  lang,
}) => {
  const [vaultFiles, setVaultFiles] = useState<VaultFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [decryptedSession, setDecryptedSession] = useState<DecryptedSession | null>(null);
  const [decrypting, setDecrypting] = useState(false);
  const [decryptError, setDecryptError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'files' | 'custom-decrypt' | 'key-mgr'>('files');

  // Key management state
  const [keyInput, setKeyInput] = useState('');
  const [keyStatusMsg, setKeyStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [googleKeys, setGoogleKeys] = useState<Array<{ index: number; fingerprint: string; label: string; accountId?: string; provider: string; model: string; modelId?: string; masked: string; lastUsedAt: string | null; rpmUsed: number; rpmLimit: number; rpdUsed: number; rpdLimit: number; status: 'available' | 'rate-limited' | 'exhausted'; reason: string | null; rateLimitedUntil?: string | null; active?: boolean }>>([]);
  const [now, setNow] = useState(() => Date.now());
  const [revealedGoogleKeys, setRevealedGoogleKeys] = useState<Record<number, string>>({});
  const [googleKeyInput, setGoogleKeyInput] = useState('');
  const [apiLabelInput, setApiLabelInput] = useState('');
  const [apiProviderInput, setApiProviderInput] = useState('Google Gemini');
  const [apiBaseUrlInput, setApiBaseUrlInput] = useState('https://generativelanguage.googleapis.com/v1beta/models');
  const [apiModelInput, setApiModelInput] = useState('gemini-3.6-flash');
  const [rawTokenInput, setRawTokenInput] = useState('');
  const [copiedTranscript, setCopiedTranscript] = useState(false);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/sessions/list');
      if (res.ok) {
        const data = await res.json();
        setVaultFiles(data.files || []);
        if (data.files && data.files.length > 0 && !selectedFile) {
          setSelectedFile(data.files[0].filename);
        }
      }
    } catch {
      // Graceful fallback
      setVaultFiles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchFiles();
      const refreshKeys = () => fetch('/api/google/keys').then((res) => res.ok ? res.json() : null).then((data) => {
        if (data?.keys) setGoogleKeys(data.keys);
      }).catch(() => undefined);
      refreshKeys();
      const timer = window.setInterval(() => { setNow(Date.now()); refreshKeys(); }, 1000);
      return () => window.clearInterval(timer);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDecrypt = async (filename: string) => {
    setDecrypting(true);
    setDecryptError(null);
    setDecryptedSession(null);

    try {
      const res = await fetch('/api/sessions/decrypt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to decrypt file');
      }

      setDecryptedSession(data);
    } catch (err: any) {
      setDecryptError(err.message || 'Decryption failed');
    } finally {
      setDecrypting(false);
    }
  };

  const handleDecryptRawToken = async () => {
    if (!rawTokenInput.trim()) return;

    setDecrypting(true);
    setDecryptError(null);
    setDecryptedSession(null);

    try {
      const res = await fetch('/api/sessions/decrypt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawEncryptedContent: rawTokenInput.trim() }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to decrypt token');
      }

      setDecryptedSession(data);
    } catch (err: any) {
      setDecryptError(err.message || 'Decryption failed');
    } finally {
      setDecrypting(false);
    }
  };

  const handleDelete = async (filename: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(lang === 'el' ? `Διαγραφή του αρχείου ${filename};` : `Delete ${filename}?`)) return;

    try {
      await fetch(`/api/sessions/${filename}`, { method: 'DELETE' });
      await fetchFiles();
      if (selectedFile === filename) {
        setSelectedFile(null);
        setDecryptedSession(null);
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const handleRenameSession = async (filename: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentName = filename.replace(/\.enc$/, '');
    const requestedName = window.prompt(lang === 'el' ? 'Νέο όνομα συνομιλίας:' : 'New conversation name:', currentName);
    if (!requestedName?.trim() || requestedName.trim() === currentName) return;
    const res = await fetch(`/api/sessions/${filename}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: requestedName }),
    });
    const data = await res.json();
    if (!res.ok) {
      setDecryptError(data.error || 'Αποτυχία μετονομασίας.');
      return;
    }
    if (selectedFile === filename) {
      setSelectedFile(data.filename);
      setDecryptedSession((previous) => previous ? { ...previous, filename: data.filename } : previous);
    }
    await fetchFiles();
  };

  const handleUpdateKey = async () => {
    if (!keyInput.trim()) return;
    try {
      const res = await fetch('/api/key/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: keyInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update key');
      setKeyStatusMsg({
        type: 'success',
        text: lang === 'el' ? `Το secret.key ενημερώθηκε επιτυχώς! (Fingerprint: ${data.fingerprint})` : `secret.key updated! (Fingerprint: ${data.fingerprint})`,
      });
      setKeyInput('');
    } catch (err: any) {
      setKeyStatusMsg({ type: 'error', text: err.message });
    }
  };

  const handleGenerateKey = async () => {
    if (!window.confirm(lang === 'el' ? 'Προσοχή: Η δημιουργία νέου κλειδιού θα αντικαταστήσει το τρέχον secret.key. Συνέχεια;' : 'Generating a new key will replace current secret.key. Continue?')) return;
    try {
      const res = await fetch('/api/key/generate', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setKeyStatusMsg({
        type: 'success',
        text: lang === 'el' ? `Νέο κλειδί δημιουργήθηκε! (Fingerprint: ${data.fingerprint})` : `New key generated! (Fingerprint: ${data.fingerprint})`,
      });
    } catch (err: any) {
      setKeyStatusMsg({ type: 'error', text: err.message });
    }
  };

  const handleAddGoogleKey = async () => {
    if (!googleKeyInput.trim()) return;
    try {
      const res = await fetch('/api/google/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: googleKeyInput.trim(), label: apiLabelInput, provider: apiProviderInput, baseUrl: apiBaseUrlInput, model: apiModelInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save Google API key');
      setGoogleKeys(data.keys || []);
      setGoogleKeyInput('');
      setApiLabelInput('');
      setKeyStatusMsg({ type: 'success', text: lang === 'el' ? 'Το Google API key αποθηκεύτηκε κρυπτογραφημένα.' : 'Google API key saved encrypted.' });
    } catch (err: any) {
      setKeyStatusMsg({ type: 'error', text: err.message });
    }
  };

  const handleRemoveGoogleKey = async (index: number) => {
    try {
      const res = await fetch(`/api/google/keys/${index}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to remove Google API key');
      setGoogleKeys(data.keys || []);
      setKeyStatusMsg({ type: 'success', text: lang === 'el' ? 'Το εφεδρικό Google API key αφαιρέθηκε.' : 'Fallback Google API key removed.' });
    } catch (err: any) {
      setKeyStatusMsg({ type: 'error', text: err.message });
    }
  };

  const revealGoogleKey = async (index: number) => {
    if (revealedGoogleKeys[index]) return;
    const res = await fetch(`/api/google/keys/${index}/reveal`);
    if (res.ok) {
      const data = await res.json();
      setRevealedGoogleKeys((previous) => ({ ...previous, [index]: data.key }));
    }
  };

  const copyGoogleKey = async (index: number) => {
    const res = await fetch(`/api/google/keys/${index}/reveal`);
    if (res.ok) await navigator.clipboard.writeText((await res.json()).key);
    setRevealedGoogleKeys((previous) => {
      const next = { ...previous };
      delete next[index];
      return next;
    });
    setKeyStatusMsg({ type: 'success', text: lang === 'el' ? 'Το API key αντιγράφηκε.' : 'API key copied.' });
  };

  const handleRenameGoogleKey = async (index: number, currentLabel: string) => {
    const label = window.prompt(lang === 'el' ? 'Νέο όνομα API:' : 'New API name:', currentLabel);
    if (!label?.trim()) return;
    const res = await fetch(`/api/google/keys/${index}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label }) });
    const data = await res.json();
    if (res.ok) {
      setGoogleKeys(data.keys || []);
    }
    else setKeyStatusMsg({ type: 'error', text: data.error || 'Rename failed' });
  };

  const handleSelectGoogleKey = async (index: number) => {
    const res = await fetch(`/api/google/keys/${index}/select`, { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      setGoogleKeys(data.keys || []);
    }
    else setKeyStatusMsg({ type: 'error', text: data.error || 'Selection failed' });
  };

  const handleChangeGoogleKeyModel = async (index: number, modelId: string) => {
    const res = await fetch(`/api/google/keys/${index}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modelId }),
    });
    const data = await res.json();
    if (res.ok) setGoogleKeys(data.keys || []);
    else setKeyStatusMsg({ type: 'error', text: data.error || 'Model update failed' });
  };

  const copyTranscript = () => {
    if (!decryptedSession) return;
    navigator.clipboard.writeText(decryptedSession.rawText);
    setCopiedTranscript(true);
    setTimeout(() => setCopiedTranscript(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in font-mono">
      <div className="bg-slate-950 rounded-2xl shadow-2xl border border-amber-500/30 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-slate-100">
        {/* Header */}
        <div className="p-4 border-b border-amber-500/20 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-linear-to-br from-amber-400 to-yellow-600 flex items-center justify-center text-slate-950 shadow-md font-bold text-base">
              🐝
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-white flex items-center gap-2 font-mono">
                <span>nickbee HoneyVault &bull; Αποκρυπτογράφηση (.enc)</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                  AES-128
                </span>
              </h2>
              <p className="text-xs text-amber-400/60 font-mono">
                {lang === 'el'
                  ? 'Αυτόματη ανάγνωση και αποκρυπτογράφηση συνομιλιών με το secret.key'
                  : 'Automated retrieval and decryption of session logs with secret.key'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-amber-400/60 hover:text-amber-300 hover:bg-amber-950/40 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-amber-500/20 px-4 gap-4 bg-slate-900/40 text-xs">
          <button
            onClick={() => setActiveTab('files')}
            className={`py-2.5 font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'files'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-amber-300'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>{lang === 'el' ? 'Αρχεία Vault (.enc)' : 'Vault Files (.enc)'}</span>
            <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[10px]">
              {vaultFiles.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('custom-decrypt')}
            className={`py-2.5 font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'custom-decrypt'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-amber-300'
            }`}
          >
            <Unlock className="w-3.5 h-3.5" />
            <span>{lang === 'el' ? 'Αποκρυπτογράφηση Raw Token' : 'Decrypt Raw Token'}</span>
          </button>

          <button
            onClick={() => setActiveTab('key-mgr')}
            className={`py-2.5 font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'key-mgr'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-amber-300'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>{lang === 'el' ? 'Διαχείριση secret.key' : 'Manage secret.key'}</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-950">
          {activeTab === 'files' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 h-full min-h-90">
              {/* File List Column */}
              <div className="md:col-span-5 border border-amber-500/20 rounded-xl p-3 flex flex-col bg-slate-900/50 overflow-hidden">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-amber-400">
                    {lang === 'el' ? 'Διαθέσιμες Κρυπτογραφημένες Συνομιλίες' : 'Available Encrypted Sessions'}
                  </span>
                  <button
                    onClick={fetchFiles}
                    disabled={loading}
                    className="p-1 rounded text-amber-400/60 hover:text-amber-300 cursor-pointer"
                    title="Refresh list"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                  {vaultFiles.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-500">
                      <FolderLock className="w-8 h-8 mx-auto mb-2 opacity-40 text-amber-400" />
                      {lang === 'el' ? 'Δεν βρέθηκαν αρχεία .enc στο HoneyVault.' : 'No .enc files found in HoneyVault.'}
                    </div>
                  ) : (
                    vaultFiles.map((file) => (
                      <div
                        key={file.filename}
                        onClick={() => {
                          setSelectedFile(file.filename);
                          handleDecrypt(file.filename);
                        }}
                        className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all flex items-center justify-between group ${
                          selectedFile === file.filename
                            ? 'bg-amber-950/50 border-amber-400 text-amber-200 shadow-xs'
                            : 'bg-slate-900/80 border-amber-500/20 hover:border-amber-400/50 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <div className="truncate">
                            <div className="font-mono font-bold text-amber-300 truncate">
                              {file.filename}
                            </div>
                            <div className="text-[10px] text-amber-400/60 flex items-center gap-2 font-mono">
                              <span>{(file.sizeBytes / 1024).toFixed(1)} KB</span>
                              <span>&bull;</span>
                              <span>{new Date(file.modifiedAt).toLocaleTimeString()}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                          <a
                            href={`/api/sessions/download/${file.filename}`}
                            download
                            onClick={(e) => e.stopPropagation()}
                            className="p-1 rounded text-amber-400/60 hover:text-amber-300 hover:bg-amber-950/40"
                            title="Download .enc file"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                          <button
                            onClick={(e) => handleRenameSession(file.filename, e)}
                            className="p-1 rounded text-amber-400/60 hover:text-amber-300 hover:bg-amber-950/40 cursor-pointer"
                            title={lang === 'el' ? 'Μετονομασία συνομιλίας' : 'Rename conversation'}
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => handleDelete(file.filename, e)}
                            className="p-1 rounded text-rose-400/60 hover:text-rose-400 hover:bg-rose-950/40 cursor-pointer"
                            title="Delete file"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Decrypted Inspector Column */}
              <div className="md:col-span-7 border border-amber-500/20 rounded-xl p-4 flex flex-col bg-slate-900/80 overflow-hidden">
                <div className="flex items-center justify-between pb-3 border-b border-amber-500/20">
                  <div className="flex items-center gap-2">
                    <Unlock className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-amber-300 font-mono truncate">
                      {decryptedSession
                        ? `${lang === 'el' ? 'Αποκρυπτογράφηση:' : 'Decrypted:'} ${decryptedSession.filename}`
                        : lang === 'el'
                        ? 'Προεπισκόπηση Αποκρυπτογράφησης'
                        : 'Decryption Preview'}
                    </span>
                  </div>

                  {decryptedSession && (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={copyTranscript}
                        className="flex items-center gap-1 px-2.5 py-1 rounded text-xs bg-slate-800 text-amber-300 hover:bg-slate-700 transition-colors cursor-pointer"
                      >
                        {copiedTranscript ? <Check className="w-3 h-3 text-amber-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedTranscript ? 'Copied' : 'Copy'}</span>
                      </button>

                      {decryptedSession.structured && decryptedSession.messages && onLoadSessionToChat && (
                        <button
                          onClick={() => {
                            onLoadSessionToChat(decryptedSession.messages || []);
                            onClose();
                          }}
                          className="flex items-center gap-1 px-2.5 py-1 rounded text-xs bg-linear-to-r from-amber-500 to-yellow-500 text-slate-950 hover:from-amber-400 hover:to-yellow-400 font-bold transition-all cursor-pointer"
                        >
                          <Sparkles className="w-3 h-3" />
                          <span>{lang === 'el' ? 'Φόρτωση στο Chat' : 'Load to Chat'}</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto mt-3 pr-1">
                  {decrypting ? (
                    <div className="h-full flex flex-col items-center justify-center text-xs text-amber-400/70 gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
                      <span>{lang === 'el' ? 'Αποκρυπτογράφηση με Fernet Cipher...' : 'Decrypting with Fernet Cipher...'}</span>
                    </div>
                  ) : decryptError ? (
                    <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                      <div>
                        <div className="font-bold">{lang === 'el' ? 'Σφάλμα Αποκρυπτογράφησης' : 'Decryption Error'}</div>
                        <div>{decryptError}</div>
                      </div>
                    </div>
                  ) : decryptedSession ? (
                    <div className="space-y-3">
                      {decryptedSession.structured && decryptedSession.messages ? (
                        <div className="space-y-2">
                          {decryptedSession.messages.map((msg, idx) => (
                            <div
                              key={idx}
                              className={`p-3 rounded-xl text-xs ${
                                msg.role.includes('ΕΣΥ') || msg.role === 'user'
                                  ? 'bg-amber-950/30 text-amber-100 ml-4 border border-amber-500/30'
                                  : 'bg-slate-950 text-slate-200 mr-4 border border-amber-500/20'
                              }`}
                            >
                              <div className="font-bold text-[11px] text-amber-400 mb-1 flex items-center justify-between">
                                <span>{msg.role}</span>
                                {msg.timestamp && <span className="text-amber-400/50 font-normal">{new Date(msg.timestamp).toLocaleTimeString()}</span>}
                              </div>
                              <div className="markdown-body leading-relaxed">
                                {(() => {
                                  const parsedQuiz = msg.role !== 'user' ? parseQuizFromText(msg.text || '') : null;
                                  return parsedQuiz?.quiz ? (
                                    <>
                                      {parsedQuiz.cleanedText && (
                                        <MarkdownContent>{parsedQuiz.cleanedText}</MarkdownContent>
                                      )}
                                      <div className="mt-3 space-y-3 rounded-lg border border-amber-500/20 bg-black/20 p-3">
                                        <h3 className="font-bold text-amber-300">{parsedQuiz.quiz.title}</h3>
                                        {parsedQuiz.quiz.questions.map((question) => (
                                          <div key={question.id} className="space-y-1.5 border-t border-white/10 pt-2 text-slate-200">
                                            <div className="font-semibold">{question.id}. <MarkdownContent>{question.question}</MarkdownContent></div>
                                            <ol className="list-[upper-alpha] pl-6">
                                              {question.options.map((option, optionIndex) => <li key={optionIndex}><MarkdownContent>{option}</MarkdownContent></li>)}
                                            </ol>
                                            <div className="text-emerald-300"><strong>Απάντηση:</strong> {String.fromCharCode(65 + question.correctIndex)}</div>
                                            <div className="text-slate-300"><strong>Επεξήγηση:</strong> <MarkdownContent>{question.explanation}</MarkdownContent></div>
                                          </div>
                                        ))}
                                      </div>
                                    </>
                                  ) : (
                                    <MarkdownContent>{msg.text || ''}</MarkdownContent>
                                  );
                                })()}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-3 rounded-lg bg-slate-950 text-amber-200 font-mono text-xs leading-relaxed border border-amber-500/20 markdown-body">
                          <MarkdownContent>{decryptedSession.rawText}</MarkdownContent>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-xs text-slate-500 gap-2 py-12">
                      <FileText className="w-8 h-8 opacity-30 text-amber-400" />
                      <span>{lang === 'el' ? 'Επιλέξτε ένα αρχείο .enc από τη λίστα για αποκρυπτογράφηση.' : 'Select an .enc file to decrypt.'}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'custom-decrypt' && (
            <div className="space-y-4 max-w-2xl mx-auto py-2">
              <div className="p-4 rounded-xl border border-amber-500/20 bg-slate-900/50">
                <h3 className="text-xs font-bold text-amber-300 mb-1 flex items-center gap-1.5 font-mono">
                  <Unlock className="w-3.5 h-3.5 text-amber-400" />
                  {lang === 'el' ? 'Επικόλληση Raw Fernet Token' : 'Paste Raw Fernet Token'}
                </h3>
                <p className="text-xs text-amber-400/60 mb-3 font-mono">
                  {lang === 'el'
                    ? 'Επικολλήστε οποιοδήποτε κρυπτογραφημένο string από αρχείο .enc για άμεση αποκρυπτογράφηση.'
                    : 'Paste any encrypted string from an .enc file for instant decryption.'}
                </p>

                <textarea
                  rows={4}
                  value={rawTokenInput}
                  onChange={(e) => setRawTokenInput(e.target.value)}
                  placeholder="gAAAAABn... (Fernet Token)"
                  className="w-full p-2.5 text-xs font-mono rounded-lg border border-amber-500/30 bg-slate-950 text-amber-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/40 mb-3"
                />

                <button
                  onClick={handleDecryptRawToken}
                  disabled={!rawTokenInput.trim() || decrypting}
                  className="px-4 py-2 rounded-lg bg-linear-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 disabled:opacity-50 text-slate-950 text-xs font-bold shadow-xs flex items-center gap-2 cursor-pointer"
                >
                  {decrypting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{lang === 'el' ? 'Αποκρυπτογράφηση Token' : 'Decrypt Token'}</span>
                </button>
              </div>

              {decryptedSession && (
                <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-950/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-amber-400" />
                      {lang === 'el' ? 'Επιτυχής Αποκρυπτογράφηση' : 'Decryption Successful'}
                    </span>
                    <button
                      onClick={copyTranscript}
                      className="text-xs text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{copiedTranscript ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950 text-amber-200 font-mono text-xs leading-relaxed max-h-60 overflow-y-auto border border-amber-500/20 markdown-body">
                    <MarkdownContent>{decryptedSession.rawText}</MarkdownContent>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'key-mgr' && (
            <div className="space-y-4 max-w-2xl mx-auto py-2">
              <div className="p-4 rounded-xl border border-amber-500/20 bg-slate-900/50">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-amber-300 flex items-center gap-1.5 font-mono">
                    <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                    {lang === 'el' ? 'Λήψη ή Αντικατάσταση secret.key' : 'Download or Replace secret.key'}
                  </h3>
                  <a
                    href="/api/key/download"
                    download="secret.key"
                    className="px-3 py-1 rounded text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center gap-1.5 shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{lang === 'el' ? 'Λήψη secret.key' : 'Download secret.key'}</span>
                  </a>
                </div>

                <p className="text-xs text-amber-400/60 mb-4 font-mono">
                  {lang === 'el'
                    ? 'Το αρχείο secret.key είναι απαραίτητο για την κρυπτογράφηση και αποκρυπτογράφηση των αρχείων .enc σύμφωνα με το Fernet AES-128 πρότυπο.'
                    : 'The secret.key file is required to encrypt and decrypt .enc files using Fernet AES-128 standard.'}
                </p>

                <div className="space-y-3 pt-3 border-t border-amber-500/20">
                  <label className="block text-xs font-bold text-amber-300 font-mono">
                    {lang === 'el' ? 'Εισαγωγή Νέου Κλειδιού (Base64 Fernet Key):' : 'Import New Key (Base64 Fernet Key):'}
                  </label>
                  <input
                    type="text"
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                    placeholder="AQ.Ab8RN6...=="
                    className="w-full p-2 text-xs font-mono rounded-lg border border-amber-500/30 bg-slate-950 text-amber-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  />

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleUpdateKey}
                      disabled={!keyInput.trim()}
                      className="px-3.5 py-1.5 rounded-lg bg-linear-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 disabled:opacity-50 text-slate-950 text-xs font-bold shadow-xs cursor-pointer"
                    >
                      {lang === 'el' ? 'Αποθήκευση Κλειδιού' : 'Save Key'}
                    </button>

                    <button
                      onClick={handleGenerateKey}
                      className="px-3.5 py-1.5 rounded-lg border border-amber-500/40 hover:bg-amber-950/40 text-amber-300 text-xs font-mono font-bold cursor-pointer"
                    >
                      {lang === 'el' ? 'Δημιουργία Νέου Random Key' : 'Generate New Random Key'}
                    </button>
                  </div>

                  {keyStatusMsg && (
                    <div
                      className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                        keyStatusMsg.type === 'success'
                          ? 'bg-amber-950/40 text-amber-300 border border-amber-500/40'
                          : 'bg-rose-950/40 text-rose-300 border border-rose-500/40'
                      }`}
                    >
                      {keyStatusMsg.type === 'success' ? <Check className="w-3.5 h-3.5 text-amber-400" /> : <AlertCircle className="w-3.5 h-3.5 text-rose-400" />}
                      <span>{keyStatusMsg.text}</span>
                    </div>
                  )}

                  <div className="pt-4 mt-4 border-t border-amber-500/20">
                    <h3 className="text-xs font-bold text-amber-300 font-mono mb-1">{lang === 'el' ? 'API providers' : 'API providers'}</h3>
                    <p className="text-[11px] text-amber-400/60 mb-3">{lang === 'el' ? 'Σε quota ή rate limit, το chat δοκιμάζει αυτόματα το επόμενο key. Τα keys αποθηκεύονται κρυπτογραφημένα.' : 'On quota or rate limits, chat automatically tries the next key. Keys are stored encrypted.'}</p>
                    <div className="space-y-2 mb-3">
                      {googleKeys.map((key) => (
                        <div key={key.index} className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-slate-950 border border-amber-500/20 text-xs">
                          <div className="min-w-0">
                            <button onMouseEnter={() => revealGoogleKey(key.index)} onMouseLeave={() => setRevealedGoogleKeys((previous) => { const next = { ...previous }; delete next[key.index]; return next; })} onClick={() => copyGoogleKey(key.index)} className="text-left text-amber-200 font-mono truncate max-w-full hover:text-amber-100" title="Hover to reveal temporarily, click to copy">
                              <span className="font-bold">{key.label}</span> &bull; <span>{revealedGoogleKeys[key.index] || key.masked}</span>
                            </button>
                            <div className="text-[10px] text-amber-400/60">
                              {key.accountId || 'default'} account &bull; {key.provider} &bull; {key.model} &bull; {key.rateLimitedUntil
                                ? `${lang === 'el' ? 'Rate Limited έως' : 'Rate Limited until'}: ${new Date(key.rateLimitedUntil).toLocaleTimeString()}`
                                : key.lastUsedAt
                                ? `${lang === 'el' ? 'Τελευταία χρήση' : 'Last used'}: ${new Date(key.lastUsedAt).toLocaleString()}`
                                : lang === 'el' ? 'Δεν έχει χρησιμοποιηθεί ακόμη' : 'Not used yet'}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <div className={`text-[10px] text-right ${key.status === 'available' ? 'text-emerald-300' : key.status === 'rate-limited' ? 'text-amber-300' : 'text-rose-300'}`}>
                              {key.status === 'rate-limited' && key.rateLimitedUntil
                                ? `${key.label}: Διαθέσιμο σε ${Math.max(0, Math.ceil((new Date(key.rateLimitedUntil).getTime() - now) / 1000))}s`
                                : key.status === 'exhausted'
                                ? `${key.label}: Exhausted (Daily Quota)`
                                : `${key.active ? 'Active' : 'Available'} (${key.rpmUsed}/${key.rpmLimit} RPM)`}
                            </div>
                                <select
                                  value={key.modelId || key.model}
                                  onChange={(event) => handleChangeGoogleKeyModel(key.index, event.target.value)}
                                  className="max-w-28 bg-slate-900 border border-amber-500/30 rounded px-1 py-1 text-[10px] text-amber-200"
                                  title="Model assigned to this API key"
                                >
                                  {AVAILABLE_MODELS.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
                                </select>
                            <button onClick={() => handleSelectGoogleKey(key.index)} className={`text-xs ${key.active ? 'text-emerald-300' : 'text-slate-400 hover:text-emerald-200'}`} title="Use this API">{key.active ? 'ACTIVE' : 'USE'}</button>
                            <button onClick={() => handleRenameGoogleKey(key.index, key.label)} className="text-amber-300 hover:text-amber-100" title="Rename API"><FileText className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleRemoveGoogleKey(key.index)} className="text-rose-300 hover:text-rose-200" title="Remove key"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                      <input value={apiLabelInput} onChange={(e) => setApiLabelInput(e.target.value)} placeholder={lang === 'el' ? 'Όνομα API' : 'API name'} className="p-2 text-xs font-mono rounded-lg border border-amber-500/30 bg-slate-950 text-amber-100 placeholder-slate-600" />
                      <input value={apiProviderInput} onChange={(e) => setApiProviderInput(e.target.value)} placeholder="Provider (Google / OpenAI-compatible)" className="p-2 text-xs font-mono rounded-lg border border-amber-500/30 bg-slate-950 text-amber-100 placeholder-slate-600" />
                      <input value={apiBaseUrlInput} onChange={(e) => setApiBaseUrlInput(e.target.value)} placeholder="Base URL" className="p-2 text-xs font-mono rounded-lg border border-amber-500/30 bg-slate-950 text-amber-100 placeholder-slate-600 sm:col-span-2" />
                      <input value={apiModelInput} onChange={(e) => setApiModelInput(e.target.value)} placeholder="Model" className="p-2 text-xs font-mono rounded-lg border border-amber-500/30 bg-slate-950 text-amber-100 placeholder-slate-600" />
                    </div>
                    <div className="flex gap-2">
                      <input type="password" value={googleKeyInput} onChange={(e) => setGoogleKeyInput(e.target.value)} placeholder="Google API key" className="flex-1 p-2 text-xs font-mono rounded-lg border border-amber-500/30 bg-slate-950 text-amber-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/40" />
                      <button onClick={handleAddGoogleKey} disabled={!googleKeyInput.trim()} className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-bold">{lang === 'el' ? 'Προσθήκη' : 'Add'}</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-amber-500/20 bg-slate-900/60 flex justify-between items-center text-xs text-amber-400/60 font-mono">
          <span>{lang === 'el' ? '🐝 nickbee &bull; Συμβατό με Python cryptography.fernet' : '🐝 nickbee &bull; Compatible with Python cryptography.fernet'}</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow-xs cursor-pointer"
          >
            {lang === 'el' ? 'Κλείσιμο' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
