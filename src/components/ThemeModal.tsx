import React from 'react';
import { Palette, Check, Sparkles, X, Sun, Moon, Sliders, Type, Grid } from 'lucide-react';
import { ThemeSettings, ThemeId, AppTheme } from '../types';
import { APP_THEMES } from '../lib/themes';

interface ThemeModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ThemeSettings;
  onUpdateSettings: (newSettings: Partial<ThemeSettings>) => void;
  lang: 'el' | 'en';
  currentTheme: AppTheme;
}

export const ThemeModal: React.FC<ThemeModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  lang,
  currentTheme,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in font-mono">
      <div className={`rounded-2xl shadow-2xl border ${currentTheme.classes.borderPrimary} w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden ${currentTheme.classes.bgPanel} text-slate-100`}>
        {/* Header */}
        <div className={`p-4 border-b ${currentTheme.classes.borderMuted} flex items-center justify-between bg-black/40`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shadow-md bg-gradient-to-br from-amber-400 to-yellow-600 text-slate-950 font-bold">
              <Palette className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                <span>{lang === 'el' ? 'Επιλογές Αποχρώσεων & Θεμάτων' : 'Shades & Themes Customizer'}</span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${currentTheme.classes.badgeBg} ${currentTheme.classes.badgeText} border ${currentTheme.classes.borderMuted} font-bold`}>
                  {currentTheme.name}
                </span>
              </h2>
              <p className={`text-xs ${currentTheme.classes.textMuted}`}>
                {lang === 'el'
                  ? 'Προσαρμόστε την παλέτα, τις αποχρώσεις και τα οπτικά εφέ του περιβάλλοντος'
                  : 'Customize the palette, shades and visual elements of nickbee environment'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg ${currentTheme.classes.textMuted} hover:text-white transition-colors cursor-pointer`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Themes Grid */}
          <div>
            <label className={`block text-xs font-bold ${currentTheme.classes.textAccent} mb-3 flex items-center gap-2`}>
              <Palette className="w-4 h-4" />
              <span>{lang === 'el' ? 'Επιλογή Παλέτας & Αποχρώσεων' : 'Select Theme Palette & Shades'}</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {APP_THEMES.map((theme) => {
                const isSelected = settings.themeId === theme.id;
                return (
                  <button
                    key={theme.id}
                    onClick={() => onUpdateSettings({ themeId: theme.id })}
                    className={`p-3.5 rounded-xl border text-left transition-all relative overflow-hidden group cursor-pointer ${
                      isSelected
                        ? `${theme.classes.borderPrimary} ${theme.classes.bgCard} ring-2 ring-amber-400/40 shadow-md`
                        : `${theme.classes.borderMuted} bg-black/40 hover:border-amber-400/40`
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{theme.icon}</span>
                        <span className="font-bold text-xs text-white">
                          {lang === 'el' ? theme.nameEl : theme.name}
                        </span>
                      </div>
                      <div
                        className="w-4 h-4 rounded-full border border-white/20 shadow-xs flex items-center justify-center"
                        style={{ backgroundColor: theme.colorSwatch }}
                      >
                        {isSelected && <Check className="w-2.5 h-2.5 text-black stroke-[3]" />}
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-400 leading-tight">
                      {theme.descriptionEl}
                    </p>

                    {/* Color bar preview */}
                    <div className="mt-2.5 flex items-center gap-1">
                      <div className="h-1.5 flex-1 rounded-full" style={{ backgroundColor: theme.colorSwatch }} />
                      <div className="h-1.5 flex-1 rounded-full bg-slate-800" />
                      <div className="h-1.5 flex-1 rounded-full bg-slate-950 border border-white/10" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Typography Scale */}
          <div className="pt-4 border-t border-white/10">
            <label className={`block text-xs font-bold ${currentTheme.classes.textAccent} mb-2 flex items-center gap-2`}>
              <Type className="w-4 h-4" />
              <span>{lang === 'el' ? 'Μέγεθος Γραμματοσειράς' : 'Monospace Font Scaling'}</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'compact', label: lang === 'el' ? 'Συμπαγές (Compact)' : 'Compact', sizeClass: 'text-[11px]' },
                { id: 'standard', label: lang === 'el' ? 'Κανονικό (Standard)' : 'Standard', sizeClass: 'text-xs' },
                { id: 'spacious', label: lang === 'el' ? 'Ευρύχωρο (Spacious)' : 'Spacious', sizeClass: 'text-sm' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => onUpdateSettings({ fontSize: item.id as any })}
                  className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                    settings.fontSize === item.id
                      ? `${currentTheme.classes.btnPrimary} font-black`
                      : `border-white/10 bg-black/40 text-slate-400 hover:text-white hover:border-white/20`
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Contrast & Effects */}
          <div className="pt-4 border-t border-white/10 space-y-3">
            <label className={`block text-xs font-bold ${currentTheme.classes.textAccent} mb-1 flex items-center gap-2`}>
              <Sliders className="w-4 h-4" />
              <span>{lang === 'el' ? 'Ειδικά Οπτικά Εφέ' : 'Visual FX & Mesh'}</span>
            </label>

            <div className="flex flex-col sm:flex-row gap-3">
              {/* Hexagon Mesh Toggle */}
              <button
                onClick={() => onUpdateSettings({ showHexagonMesh: !settings.showHexagonMesh })}
                className={`flex-1 p-3 rounded-xl border text-xs flex items-center justify-between cursor-pointer transition-all ${
                  settings.showHexagonMesh
                    ? `${currentTheme.classes.borderPrimary} ${currentTheme.classes.bgCard} text-white`
                    : 'border-white/10 bg-black/40 text-slate-400'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Grid className="w-4 h-4 text-amber-400" />
                  <div className="text-left">
                    <div className="font-bold">{lang === 'el' ? 'Πλέγμα Κηρήθρας' : 'Honeycomb Mesh'}</div>
                    <div className="text-[10px] opacity-70">{lang === 'el' ? 'Διακριτικό background pattern' : 'Subtle background overlay'}</div>
                  </div>
                </div>
                <div className={`w-8 h-4 rounded-full relative transition-colors ${settings.showHexagonMesh ? 'bg-amber-500' : 'bg-slate-700'}`}>
                  <div className={`w-3 h-3 rounded-full bg-white absolute top-0.5 transition-all ${settings.showHexagonMesh ? 'right-0.5' : 'left-0.5'}`} />
                </div>
              </button>

              {/* Glow Effect Toggle */}
              <button
                onClick={() => onUpdateSettings({ enableGlow: !settings.enableGlow })}
                className={`flex-1 p-3 rounded-xl border text-xs flex items-center justify-between cursor-pointer transition-all ${
                  settings.enableGlow
                    ? `${currentTheme.classes.borderPrimary} ${currentTheme.classes.bgCard} text-white`
                    : 'border-white/10 bg-black/40 text-slate-400'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <div className="text-left">
                    <div className="font-bold">{lang === 'el' ? 'Ambient Glow' : 'Ambient Glow'}</div>
                    <div className="text-[10px] opacity-70">{lang === 'el' ? 'Ατμοσφαιρικός φωτισμός στα πλαίσια' : 'Soft glow on borders'}</div>
                  </div>
                </div>
                <div className={`w-8 h-4 rounded-full relative transition-colors ${settings.enableGlow ? 'bg-amber-500' : 'bg-slate-700'}`}>
                  <div className={`w-3 h-3 rounded-full bg-white absolute top-0.5 transition-all ${settings.enableGlow ? 'right-0.5' : 'left-0.5'}`} />
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`p-4 border-t ${currentTheme.classes.borderMuted} bg-black/40 flex items-center justify-between text-xs`}>
          <button
            onClick={() => onUpdateSettings({ themeId: 'honey-gold', fontSize: 'standard', showHexagonMesh: true, enableGlow: true })}
            className="text-slate-400 hover:text-white underline cursor-pointer"
          >
            {lang === 'el' ? 'Επαναφορά Προεπιλογών' : 'Reset to Defaults'}
          </button>

          <button
            onClick={onClose}
            className={`px-5 py-2 rounded-xl font-bold ${currentTheme.classes.btnPrimary} ${currentTheme.classes.btnPrimaryHover} cursor-pointer shadow-md`}
          >
            {lang === 'el' ? 'Εφαρμογή & Κλείσιμο' : 'Apply & Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
