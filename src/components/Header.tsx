import React, { useEffect, useState } from 'react';
import {
  Wifi,
  WifiOff,
  Layers,
  Palette,
  Cpu,
  Laptop,
  Smartphone,
  ChevronDown,
  Check,
  GraduationCap,
  Timer,
} from 'lucide-react';
import { SystemStatus, AppTheme, ModelOption } from '../types';
import { AVAILABLE_MODELS } from '../lib/themes';

interface HeaderProps {
  status: SystemStatus | null;
  activeView: 'studio';
  setActiveView: (view: 'studio') => void;
  onOpenThemeModal: () => void;
  onOpenUniversityHub?: () => void;
  layoutMode: 'mobile' | 'desktop';
  onLayoutModeChange: (mode: 'mobile' | 'desktop') => void;
  selectedModel: string;
  activeApiKeyId?: string | null;
  onSelectModel: (modelId: string) => void;
  currentTheme: AppTheme;
  lang: 'el' | 'en';
  setLang: (l: 'el' | 'en') => void;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  activeView,
  setActiveView,
  onOpenThemeModal,
  onOpenUniversityHub,
  layoutMode,
  onLayoutModeChange,
  selectedModel,
  activeApiKeyId,
  onSelectModel,
  currentTheme,
  lang,
  setLang,
}) => {
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const isOnline = status?.online ?? true;
  const [countdownSeconds, setCountdownSeconds] = useState(0);
  const activeApi = status?.apiKeys?.find((api) => api.fingerprint === activeApiKeyId) || status?.apiKeys?.find((api) => api.active);

  useEffect(() => {
    const updateCountdown = () => {
      const retryAt = activeApi?.rateLimitedUntil ? new Date(activeApi.rateLimitedUntil).getTime() : status?.usage?.providerRetryUntil ? new Date(status.usage.providerRetryUntil).getTime() : 0;
      const target = retryAt > Date.now() ? retryAt : 0;
      setCountdownSeconds(Math.max(0, Math.ceil((target - Date.now()) / 1000)));
    };
    updateCountdown();
    const timer = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(timer);
  }, [activeApi?.rateLimitedUntil, status?.usage?.providerRetryUntil, status?.usage?.resetAt]);

  const currentModelObj =
    AVAILABLE_MODELS.find((m) => m.id === selectedModel) || AVAILABLE_MODELS[0];
  const installedModels = status?.google?.models || [];
  const visibleModels = installedModels.length > 0
    ? AVAILABLE_MODELS.filter((model) => installedModels.includes(model.id))
    : AVAILABLE_MODELS.filter((model) => model.id === 'gemini-3.6-flash');
  const hasProviderRetry = countdownSeconds > 0;

  return (
    <header
      id="mac-header"
      className={`border-b ${currentTheme.classes.borderPrimary} ${currentTheme.classes.bgPanel} text-slate-100 backdrop-blur-md sticky top-0 z-30 select-none shadow-md shadow-black/40`}
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        {/* Left: official nickbee Bee Logo */}
        <div className="flex w-full items-center gap-2 sm:w-auto sm:gap-3">
          {/* Official nickbee Logo with uploaded Bee Avatar */}
          <div className="flex items-center gap-2.5">
            <div className="relative w-8 h-8 rounded-full overflow-hidden border-2 border-amber-400/80 shadow-md shadow-amber-500/30 shrink-0 bg-slate-900">
              <img
                src="/nickbee_logo.jpg"
                alt="nickbee logo"
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Fallback if image path differs
                  (e.currentTarget as HTMLElement).style.display = 'none';
                  e.currentTarget.parentElement!.innerHTML = `<span class="flex items-center justify-center w-full h-full text-base">🐝</span>`;
                }}
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black tracking-tight text-white font-mono flex items-center gap-1">
                  <span className={`${currentTheme.classes.textAccent} drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]`}>
                    nick
                  </span>
                  <span className="text-white">bee</span>
                </h1>

                <span
                  className={`hidden sm:flex text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${currentTheme.classes.badgeBg} ${currentTheme.classes.badgeText} border ${currentTheme.classes.borderMuted} items-center gap-1`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  AES-128
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Center/Right: Model Selector, Academic Hub, Theme Customizer & System Controls */}
        <div className="flex w-full flex-nowrap items-center justify-between gap-1.5 sm:w-auto sm:justify-end sm:gap-2">
          {/* University Academic Hub Button */}
          {onOpenUniversityHub && (
            <button
              id="btn-open-university-hub"
              onClick={onOpenUniversityHub}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/15 px-2 py-1.5 text-xs font-mono font-bold text-amber-300 shadow-xs transition-all hover:border-amber-400 hover:bg-amber-500/25 sm:px-2.5 sm:py-1`}
              title={lang === 'el' ? 'Πανεπιστήμιο: Διαχείριση Ύλης & Κουίζ' : 'University Syllabus & Quiz Hub'}
            >
              <GraduationCap className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden md:inline">{lang === 'el' ? 'Ύλη & Quiz' : 'Syllabus & Quiz'}</span>
            </button>
          )}

          {/* Model Selector Dropdown */}
          <div className="relative">
            <button
              id="btn-model-selector"
              onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-mono font-bold text-white shadow-xs transition-all hover:border-amber-300 sm:px-2.5 sm:py-1 ${currentTheme.classes.bgCard} ${currentTheme.classes.borderPrimary}`}
              title="Επιλογή AI Μοντέλου"
            >
              <Cpu className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden lg:inline font-mono">{currentModelObj.name}</span>
              <span className="lg:hidden font-mono">{currentModelObj.badge}</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {modelDropdownOpen && (
              <div
                className={`absolute left-0 sm:right-0 sm:left-auto mt-2 w-72 max-w-[calc(100vw-1.5rem)] rounded-xl shadow-2xl border ${currentTheme.classes.borderPrimary} ${currentTheme.classes.bgPanel} p-2 z-50 animate-fade-in font-mono`}
              >
                <div className="text-[10px] font-bold text-slate-400 px-2 py-1 uppercase tracking-wider border-b border-white/10 mb-1 flex items-center justify-between">
                  <span>{lang === 'el' ? 'Μοντέλο Google Gemini' : 'Google Gemini Model'}</span>
                  <span className="text-amber-400">Google</span>
                </div>

                <div className="space-y-1">
                  {visibleModels.map((model) => {
                    const isSelected = selectedModel === model.id;
                    return (
                      <button
                        key={model.id}
                        onClick={() => {
                          onSelectModel(model.id);
                          setModelDropdownOpen(false);
                        }}
                        className={`w-full text-left p-2 rounded-lg text-xs transition-all flex items-start justify-between cursor-pointer ${
                          isSelected
                            ? `${currentTheme.classes.badgeBg} ${currentTheme.classes.badgeText} border ${currentTheme.classes.borderPrimary} font-bold`
                            : 'text-slate-300 hover:bg-white/5 border border-transparent'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold">{model.name}</span>
                            {model.isDefault && (
                              <span className="text-[9px] px-1 rounded bg-amber-400/20 text-amber-300 border border-amber-400/40">
                                Default
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] opacity-70 mt-0.5 leading-tight">
                            {lang === 'el' ? model.descEl : model.descEn}
                          </div>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-1" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {status?.usage && (
            <div
              className={`hidden lg:flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-mono ${
                status.usage.used >= status.usage.limit
                  ? 'border-rose-500/50 bg-rose-950/30 text-rose-300'
                  : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              }`}
              title="Χρήση Google Gemini και όριο εφαρμογής"
            >
              <Timer className="w-3.5 h-3.5" />
              <span>{activeApi ? `${activeApi.label} ${activeApi.rpmUsed}/${activeApi.rpmLimit} RPM · ${activeApi.rpdUsed}/${activeApi.rpdLimit} RPD` : `Gemini ${status.usage.used}/${status.usage.limit}`}</span>
              <span className="text-slate-400">
                {hasProviderRetry
                  ? `${activeApi?.label || 'API'}: διαθέσιμο σε ${countdownSeconds}s`
                  : activeApi?.status === 'exhausted' ? 'Daily Quota Exceeded' : activeApi?.status === 'rate-limited' && activeApi.reason ? `${activeApi.reason} (${activeApi.rpmUsed}/${activeApi.rpmLimit})` : 'API διαθέσιμο'}
              </span>
            </div>
          )}

          <div className="flex shrink-0 items-center rounded-lg border border-white/10 bg-black/20 p-0.5">
            <button
              type="button"
              onClick={() => onLayoutModeChange('desktop')}
              aria-label={lang === 'el' ? 'Διάταξη υπολογιστή' : 'Desktop layout'}
              aria-pressed={layoutMode === 'desktop'}
              className={`rounded-md p-1.5 transition ${layoutMode === 'desktop' ? 'bg-cyan-400/15 text-cyan-200' : 'text-slate-500 hover:text-slate-200'}`}
            >
              <Laptop className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onLayoutModeChange('mobile')}
              aria-label={lang === 'el' ? 'Διάταξη κινητού' : 'Mobile layout'}
              aria-pressed={layoutMode === 'mobile'}
              className={`rounded-md p-1.5 transition ${layoutMode === 'mobile' ? 'bg-emerald-400/15 text-emerald-200' : 'text-slate-500 hover:text-slate-200'}`}
            >
              <Smartphone className="h-4 w-4" />
            </button>
          </div>

          {/* Theme & Shades Customizer Button */}
          <button
            id="btn-open-theme-modal"
            onClick={onOpenThemeModal}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-mono font-medium text-white transition-all hover:border-amber-400 sm:px-2.5 sm:py-1 ${currentTheme.classes.bgCard} ${currentTheme.classes.borderMuted}`}
            title={lang === 'el' ? 'Αποχρώσεις & Θέματα' : 'Shades & Themes'}
          >
            <Palette className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden xl:inline">{lang === 'el' ? 'Αποχρώσεις' : 'Themes'}</span>
            <span
              className="w-2.5 h-2.5 rounded-full border border-white/30"
              style={{ backgroundColor: currentTheme.colorSwatch }}
            />
          </button>

          {/* Language Toggle */}
          <button
            id="btn-toggle-lang"
            onClick={() => setLang(lang === 'el' ? 'en' : 'el')}
            className={`px-2 py-1 text-xs font-mono font-bold rounded border ${currentTheme.classes.borderMuted} text-slate-200 hover:bg-white/10 transition-colors`}
          >
            {lang === 'el' ? 'EN' : 'ΕΛ'}
          </button>
        </div>
      </div>
    </header>
  );
};
