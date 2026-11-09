/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { ChatArea } from './components/ChatArea';
import { InputBar } from './components/InputBar';
import { VaultModal } from './components/VaultModal';
import { ThemeModal } from './components/ThemeModal';
import { UniversityHubModal } from './components/UniversityHubModal';
import {
  ChatMessage,
  MultimodalAttachment,
  SystemStatus,
  ThemeSettings,
  AppTheme,
} from './types';
import { APP_THEMES, DEFAULT_THEME_SETTINGS } from './lib/themes';
import { Check, AlertCircle } from 'lucide-react';

interface ConversationTab {
  id: string;
  title: string;
  messages: ChatMessage[];
  apiKeyId: string | null;
  requestStartedAt: number | null;
}

export default function App() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [conversationTabs, setConversationTabs] = useState<ConversationTab[]>([{ id: 'chat-1', title: 'Νέα συνομιλία', messages: [], apiKeyId: null, requestStartedAt: null }]);
  const [activeTabId, setActiveTabId] = useState('chat-1');
  const [editText, setEditText] = useState<string | null>(null);
  const [editMessageId, setEditMessageId] = useState<string | null>(null);
  const [chatScale, setChatScale] = useState(() => {
    const stored = Number(localStorage.getItem('nickbee-chat-scale'));
    return Number.isFinite(stored) && stored >= 0.8 && stored <= 1.3 ? stored : 1;
  });
  const [generatingTabs, setGeneratingTabs] = useState<Set<string>>(new Set());
  const [clock, setClock] = useState(() => Date.now());
  const [activeView, setActiveView] = useState<'studio'>('studio');
  const [useSearchGrounding, setUseSearchGrounding] = useState(false);
  const [lang, setLang] = useState<'el' | 'en'>('el');

  // Selected Google Gemini model
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    const saved = localStorage.getItem('nickbee_model');
    const validModels = ['gemini-3.6-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
    return saved && validModels.includes(saved) ? saved : 'gemini-3.6-flash';
  });

  // Themes and visual settings
  const [themeSettings, setThemeSettings] = useState<ThemeSettings>(() => {
    try {
      const saved = localStorage.getItem('nickbee_theme_settings');
      return saved ? { ...DEFAULT_THEME_SETTINGS, ...JSON.parse(saved) } : DEFAULT_THEME_SETTINGS;
    } catch {
      return DEFAULT_THEME_SETTINGS;
    }
  });

  // Modals
  const [vaultOpen, setVaultOpen] = useState(false);
  const [themeModalOpen, setThemeModalOpen] = useState(false);
  const [universityHubOpen, setUniversityHubOpen] = useState(false);
  const [chemistryWorkspaceOpen, setChemistryWorkspaceOpen] = useState(false);
  const [chemistryWorkspaceRequest, setChemistryWorkspaceRequest] = useState(0);
  const [notification, setNotification] = useState<{
    type: 'success' | 'info' | 'error';
    text: string;
  } | null>(null);

  // Derive active theme object
  const currentTheme: AppTheme =
    APP_THEMES.find((t) => t.id === themeSettings.themeId) || APP_THEMES[0];
  const activeTab = conversationTabs.find((tab) => tab.id === activeTabId) || conversationTabs[0];
  const messages = activeTab.messages;
  const activeApiKeyId = activeTab.apiKeyId;

  const updateConversationTab = (tabId: string, update: (tab: ConversationTab) => ConversationTab) => {
    setConversationTabs((tabs) => tabs.map((tab) => tab.id === tabId ? update(tab) : tab));
  };

  const createConversationTab = () => {
    const id = `chat-${Date.now()}`;
    setConversationTabs((tabs) => [...tabs, { id, title: 'Νέα συνομιλία', messages: [], apiKeyId: tabs[0]?.apiKeyId ?? null, requestStartedAt: null }]);
    setActiveTabId(id);
  };

  const closeConversationTab = (id: string) => {
    if (conversationTabs.length === 1) return;
    const remaining = conversationTabs.filter((tab) => tab.id !== id);
    setConversationTabs(remaining);
    if (id === activeTabId) setActiveTabId(remaining[0].id);
  };

  const handleUpdateThemeSettings = (newSettings: Partial<ThemeSettings>) => {
    setThemeSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      localStorage.setItem('nickbee_theme_settings', JSON.stringify(updated));
      return updated;
    });
  };

  const handleSelectModel = (modelId: string) => {
    setSelectedModel(modelId);
    localStorage.setItem('nickbee_model', modelId);
    showToast(
      lang === 'el' ? `Μοντέλο: ${modelId} ενεργοποιήθηκε` : `Model: ${modelId} activated`,
      'info'
    );
  };

  const fetchStatus = async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    try {
      const res = await fetch('/api/status', {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data === 'object') {
          setStatus(data);
          return;
        }
      }
    } catch {
      clearTimeout(timeoutId);
    }

    // Default optimistic state if server is momentarily unreachable
    setStatus((prev) =>
      prev || {
        online: true,
        appName: 'nickbee',
        keyFile: {
          path: 'secret.key',
          exists: true,
          valid: true,
          fingerprint: 'LIVE',
        },
        vault: {
          fileCount: 0,
          files: [],
        },
        model: selectedModel || 'gemini-3.6-flash',
      }
    );
  };

  useEffect(() => {
    fetchStatus();
    // Periodic status poll every 15s to keep connection badge accurate
    const timer = setInterval(fetchStatus, 15000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleSendMessage = async (
    text: string,
    attachments?: MultimodalAttachment[] | MultimodalAttachment
  ): Promise<string | undefined> => {
    const userMsgId = Math.random().toString();
    const requestTabId = activeTabId;
    const requestTab = conversationTabs.find((tab) => tab.id === requestTabId) || activeTab;
    const requestMessages = requestTab.messages;
    const requestApiKeyId = requestTab.apiKeyId;
    const timestampStr = new Date().toLocaleTimeString();

    // Normalize attachments to array
    const attachmentsArray: MultimodalAttachment[] = Array.isArray(attachments)
      ? attachments
      : attachments
      ? [attachments]
      : [];

    const primaryAttachment = attachmentsArray.length > 0 ? attachmentsArray[0] : undefined;

    const userMessage: ChatMessage = {
      id: userMsgId,
      role: 'user',
      text,
      attachment: primaryAttachment,
      attachments: attachmentsArray.length > 0 ? attachmentsArray : undefined,
      timestamp: timestampStr,
    };

    const newHistory = [...requestMessages, userMessage];
    updateConversationTab(requestTabId, (tab) => ({ ...tab, messages: newHistory, title: tab.messages.length === 0 ? text.slice(0, 28) || 'Νέα συνομιλία' : tab.title }));
    setGeneratingTabs((tabs) => new Set(tabs).add(requestTabId));
    updateConversationTab(requestTabId, (tab) => ({ ...tab, requestStartedAt: Date.now() }));

    try {
      // Format messages for server endpoint, ignoring error notices from history
      const payloadMessages = newHistory
        .filter((m) => !m.text.startsWith('⚠️ [Σφάλμα') && !m.text.startsWith('[Σφάλμα'))
        .map((m) => ({
          role: m.role,
          text: m.text,
          attachment: m.attachment,
          attachments: m.attachments,
        }));

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 60000);
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          messages: payloadMessages,
          useSearchGrounding,
          model: selectedModel,
          apiKeyId: requestApiKeyId,
        }),
      });
      window.clearTimeout(timeoutId);

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Chat request failed');
      }

      const aiMessage: ChatMessage = {
        id: Math.random().toString(),
        role: 'model',
        text: data.text || '',
        groundingSources: data.groundingSources,
        modelUsed: data.modelUsed,
        apiKeyFingerprint: data.apiKeyFingerprint,
        timestamp: new Date().toLocaleTimeString(),
      };

      updateConversationTab(requestTabId, (tab) => ({ ...tab, messages: [...tab.messages, aiMessage] }));
      await fetchStatus();
      return data.text;
    } catch (err: any) {
      const errMsg = err?.name === 'AbortError' ? 'Το αίτημα έληξε μετά από 60 δευτερόλεπτα.' : err.message || 'Error occurred';
      const errorResponse: ChatMessage = {
        id: Math.random().toString(),
        role: 'model',
        text: `⚠️ [Σφάλμα Ai]: ${errMsg}`,
        timestamp: new Date().toLocaleTimeString(),
      };
      updateConversationTab(requestTabId, (tab) => ({ ...tab, messages: [...tab.messages, errorResponse] }));
      showToast(errMsg, 'error');
      return `[Σφάλμα Ai]: ${errMsg}`;
    } finally {
      setGeneratingTabs((tabs) => {
        const next = new Set(tabs);
        next.delete(requestTabId);
        return next;
      });
      updateConversationTab(requestTabId, (tab) => ({ ...tab, requestStartedAt: null }));
    }
  };

  const handleEditSubmit = async (text: string, targetMessageId = editMessageId) => {
    if (!targetMessageId || !text.trim()) return;
    const requestTabId = activeTabId;
    const tab = conversationTabs.find((item) => item.id === requestTabId) || activeTab;
    const messageIndex = tab.messages.findIndex((message) => message.id === targetMessageId && message.role === 'user');
    if (messageIndex < 0) return;
    const updatedUser = { ...tab.messages[messageIndex], text: text.trim(), timestamp: new Date().toLocaleTimeString() };
    const historyWithoutOldAnswer = tab.messages.slice(0, messageIndex).concat(updatedUser);
    updateConversationTab(requestTabId, (current) => ({ ...current, messages: historyWithoutOldAnswer }));
    setEditText(null);
    setEditMessageId(null);
    setGeneratingTabs((tabs) => new Set(tabs).add(requestTabId));
    updateConversationTab(requestTabId, (current) => ({ ...current, requestStartedAt: Date.now() }));
    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 60000);
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ messages: historyWithoutOldAnswer.map(({ role, text: messageText, attachment, attachments }) => ({ role, text: messageText, attachment, attachments })), useSearchGrounding, model: selectedModel, apiKeyId: tab.apiKeyId }),
      });
      window.clearTimeout(timeoutId);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Edit regeneration failed');
      const replacement: ChatMessage = { id: Math.random().toString(), role: 'model', text: data.text || '', groundingSources: data.groundingSources, modelUsed: data.modelUsed, apiKeyFingerprint: data.apiKeyFingerprint, timestamp: new Date().toLocaleTimeString() };
      updateConversationTab(requestTabId, (current) => ({ ...current, messages: [...historyWithoutOldAnswer, replacement] }));
    } catch (error: any) {
      updateConversationTab(requestTabId, (current) => ({ ...current, messages: [...historyWithoutOldAnswer, { id: Math.random().toString(), role: 'model', text: `⚠️ [Σφάλμα] ${error.message || 'Edit regeneration failed'}`, timestamp: new Date().toLocaleTimeString() }] }));
    } finally {
      setGeneratingTabs((tabs) => { const next = new Set(tabs); next.delete(requestTabId); return next; });
      updateConversationTab(requestTabId, (current) => ({ ...current, requestStartedAt: null }));
    }
  };

  const selectApiForConversation = (tabId: string, apiKeyId: string) => {
    updateConversationTab(tabId, (tab) => ({ ...tab, apiKeyId }));
  };

  const handleSaveAndEncrypt = async (): Promise<string | undefined> => {
    const userMessages = messages.filter((message) => message.role === 'user');
    if (userMessages.length === 0) {
      showToast(
        lang === 'el' ? 'Δεν υπάρχουν μηνύματα για κρυπτογράφηση.' : 'No messages to encrypt.',
        'info'
      );
      return 'Δεν υπήρχαν μηνύματα για αποθήκευση.';
    }

    try {
      const requestedFilename = window.prompt(
        lang === 'el' ? 'Όνομα συνομιλίας (χωρίς .enc):' : 'Conversation name (without .enc):',
        activeTab.title === 'Νέα συνομιλία' ? '' : activeTab.title
      );
      if (requestedFilename === null) return 'Η αποθήκευση ακυρώθηκε.';
      const historyLog = userMessages.map((message, index) => {
          const chemistryMatch = message.text.match(/αντιδρώντα\s+(.+?)\s+και έπειτα/i);
          const text = message.text.includes('[[NICKBEE_CHEMISTRY_REACTION_LAB]]')
            ? (chemistryMatch ? `Πρόβλεψη αντίδρασης: ${chemistryMatch[1]}` : 'Αίτημα προσομοίωσης χημικής αντίδρασης')
            : message.text.replace(/\[\[NICKBEE_CHEMISTRY_REACTION_LAB\]\]\s*/g, '').trim();
          return {
            role: `nickbee · Ερώτηση ${index + 1}`,
            text,
            attachment: message.attachment
              ? { name: message.attachment.name, mimeType: message.attachment.mimeType }
              : undefined,
            attachments: message.attachments?.map((attachment) => ({ name: attachment.name, mimeType: attachment.mimeType })),
            timestamp: message.timestamp,
          };
        });

      const res = await fetch('/api/sessions/save-encrypted', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ historyLog, customFilename: requestedFilename.trim() || undefined }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to encrypt session');
      }

      fetchStatus();
      showToast(
        lang === 'el'
          ? `🔒 Η συνομιλία αποθηκεύτηκε κρυπτογραφημένη ως: ${data.filename}`
          : `🔒 Session encrypted and saved as: ${data.filename}`,
        'success'
      );

      return `🔒 Η συνομιλία αποθηκεύτηκε κρυπτογραφημένη ως: ${data.filename}`;
    } catch (err: any) {
      showToast(err.message || 'Encryption failed', 'error');
      return `❌ Σφάλμα: ${err.message}`;
    }
  };

  const handleLoadSessionToChat = (loadedMessages: any[]) => {
    const formatted: ChatMessage[] = loadedMessages.map((m) => ({
      id: Math.random().toString(),
      role:
        m.role?.toLowerCase().includes('user') ||
        m.role?.includes('nickbee') ||
        m.role?.includes('ΕΣΥ')
          ? 'user'
          : 'model',
      text: m.text || '',
      attachment: m.attachment,
      attachments: m.attachments,
      timestamp: m.timestamp || new Date().toLocaleTimeString(),
    }));
    updateConversationTab(activeTabId, (tab) => ({ ...tab, messages: formatted, title: tab.title === 'Νέα συνομιλία' ? 'Συνέχεια συνομιλίας' : tab.title }));
    showToast(
      lang === 'el' ? 'Η συνομιλία φορτώθηκε στο Chat!' : 'Session loaded to chat!',
      'success'
    );
  };

  return (
    <div
      className={`flex flex-col h-screen ${currentTheme.classes.bgRoot} text-slate-100 font-mono antialiased overflow-hidden selection:bg-amber-500/30 selection:text-amber-200`}
    >
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 animate-bounce">
          <div
            className={`px-4 py-2.5 rounded-xl shadow-lg border text-xs font-bold font-mono flex items-center gap-2 ${
              notification.type === 'success'
                ? `${currentTheme.classes.btnPrimary} shadow-amber-500/20`
                : notification.type === 'error'
                ? 'bg-rose-600 text-white border-rose-500 shadow-rose-600/20'
                : `${currentTheme.classes.bgPanel} ${currentTheme.classes.textAccent} ${currentTheme.classes.borderPrimary}`
            }`}
          >
            {notification.type === 'success' ? (
              <Check className="w-4 h-4 text-slate-950" />
            ) : notification.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-white" />
            ) : (
              <span>🐝</span>
            )}
            <span>{notification.text}</span>
          </div>
        </div>
      )}

      {/* Header with Traffic Lights, Official Logo, Theme Selector & Model Controls */}
      <Header
        status={status}
        activeView={activeView}
        setActiveView={setActiveView}
        onOpenVault={() => setVaultOpen(true)}
        onOpenKeyModal={() => setVaultOpen(true)}
        onOpenThemeModal={() => setThemeModalOpen(true)}
        onOpenUniversityHub={() => setUniversityHubOpen(true)}
        selectedModel={selectedModel}
        activeApiKeyId={activeApiKeyId}
        onSelectModel={handleSelectModel}
        currentTheme={currentTheme}
        lang={lang}
        setLang={setLang}
      />

      {/* Main Content Area */}
      <main className={`flex-1 flex flex-col overflow-hidden ${currentTheme.classes.bgRoot}`}>
        <div className="flex-1 flex flex-col h-full overflow-hidden max-w-7xl w-full mx-auto">
            <div className="flex items-center gap-1 border-b border-white/10 px-3 py-2 overflow-x-auto">
              {conversationTabs.map((tab) => (
                <div key={tab.id} className={`flex items-center gap-1 shrink-0 rounded-lg border px-2 py-1 text-xs ${tab.id === activeTabId ? 'border-amber-400 bg-amber-500/15 text-amber-200' : 'border-white/10 text-slate-400'}`}>
                  <button onClick={() => setActiveTabId(tab.id)} className="max-w-36 truncate">{tab.title}</button>
                  {tab.requestStartedAt && <span className="text-[10px] text-emerald-300 tabular-nums">AI {Math.floor((clock - tab.requestStartedAt) / 1000)}s</span>}
                  <select value={tab.apiKeyId || ''} onChange={(event) => selectApiForConversation(tab.id, event.target.value)} className="max-w-24 bg-transparent text-[10px] text-amber-300" title="API συνομιλίας">
                    <option value="">Auto</option>
                    {(status?.apiKeys || []).map((api) => <option key={api.fingerprint} value={api.fingerprint}>{api.label}</option>)}
                  </select>
                  <button onClick={() => closeConversationTab(tab.id)} className="text-slate-400 hover:text-rose-300" title="Κλείσιμο καρτέλας">×</button>
                </div>
              ))}
              <button onClick={createConversationTab} className="rounded-lg border border-amber-500/40 px-2 py-1 text-xs text-amber-300 hover:bg-amber-500/15" title="Νέα παράλληλη συνομιλία">+</button>
            </div>
            {/* Chat message stream */}
            <ChatArea
              messages={messages}
              isGenerating={generatingTabs.has(activeTabId)}
              lang={lang}
              currentTheme={currentTheme}
              themeSettings={themeSettings}
              selectedModel={selectedModel}
              chatScale={chatScale}
              onEditMessage={(messageId, text) => { void handleEditSubmit(text, messageId); }}
              onOpenUniversityHub={() => setUniversityHubOpen(true)}
              chemistryWorkspaceOpen={chemistryWorkspaceOpen}
              onChemistryWorkspaceOpenChange={setChemistryWorkspaceOpen}
              chemistryWorkspaceRequest={chemistryWorkspaceRequest}
              onSendMessage={handleSendMessage}
              onQuickCommand={(cmd) => {
                if (cmd === 'read') setVaultOpen(true);
                if (cmd === 'upload') {
                  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
                  input?.click();
                }
                if (cmd === 'exit') handleSaveAndEncrypt();
              }}
              inputBar={
                <InputBar
                  onSendMessage={handleSendMessage}
                  onSaveAndEncrypt={handleSaveAndEncrypt}
                  onOpenVault={() => setVaultOpen(true)}
                  onOpenUniversityHub={() => setUniversityHubOpen(true)}
                  isGenerating={generatingTabs.has(activeTabId)}
                  isOnline={status?.online ?? true}
                  useSearchGrounding={useSearchGrounding}
                  setUseSearchGrounding={setUseSearchGrounding}
                  lang={lang}
                  currentTheme={currentTheme}
                  chatScale={chatScale}
                  onChatScaleChange={(next) => {
                    setChatScale(next);
                    localStorage.setItem('nickbee-chat-scale', String(next));
                  }}
                  editText={editText}
                  onSubmitEdit={handleEditSubmit}
                  onCancelEdit={() => { setEditText(null); setEditMessageId(null); }}
                />
              }
            />
        </div>
      </main>

      {/* University Academic & Quiz Hub Modal */}
      <UniversityHubModal
        isOpen={universityHubOpen}
        onClose={() => setUniversityHubOpen(false)}
        onRunAction={(prompt, atts) => handleSendMessage(prompt, atts)}
        currentTheme={currentTheme}
        lang={lang}
        onOpenChemistry={() => { setChemistryWorkspaceOpen(true); setChemistryWorkspaceRequest((request) => request + 1); }}
      />


      {/* HoneyVault Modal */}
      <VaultModal
        isOpen={vaultOpen}
        onClose={() => setVaultOpen(false)}
        onLoadSessionToChat={handleLoadSessionToChat}
        lang={lang}
      />

      {/* Theme & Shades Customizer Modal */}
      <ThemeModal
        isOpen={themeModalOpen}
        onClose={() => setThemeModalOpen(false)}
        settings={themeSettings}
        onUpdateSettings={handleUpdateThemeSettings}
        lang={lang}
        currentTheme={currentTheme}
      />
    </div>
  );
}
