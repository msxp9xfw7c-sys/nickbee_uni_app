import React, { useMemo, useState } from 'react';
import { Atom, FlaskConical, Plus, X } from 'lucide-react';
import { PERIODIC_ELEMENTS, PeriodicElement } from '../lib/periodicTable';
import { AppTheme } from '../types';
import { OrganicChemistryWorkspace } from './OrganicChemistryWorkspace';

interface ChemistryWorkspaceProps {
  currentTheme: AppTheme;
  lang: 'el' | 'en';
  onExplainReaction: (prompt: string) => void;
}

interface Reactant {
  formula: string;
  symbols: string[];
  charges: number[];
}

interface SuggestedCompound {
  formula: string;
  name: string;
}

export const CHEMISTRY_REACTION_REQUEST_MARKER = '[[NICKBEE_CHEMISTRY_REACTION_LAB]]';

const suggestedCompounds: Record<string, SuggestedCompound[]> = {
  H: [{ formula: 'H2O', name: 'Water' }, { formula: 'HCl', name: 'Hydrogen chloride' }, { formula: 'H2SO4', name: 'Sulfuric acid' }],
  K: [{ formula: 'KCl', name: 'Potassium chloride' }, { formula: 'KOH', name: 'Potassium hydroxide' }, { formula: 'KMnO4', name: 'Potassium permanganate' }],
  Mn: [{ formula: 'KMnO4', name: 'Potassium permanganate' }, { formula: 'H2SO4', name: 'Sulfuric acid' }, { formula: 'HBr', name: 'Hydrogen bromide' }, { formula: 'MnO2', name: 'Manganese dioxide' }, { formula: 'MnSO4', name: 'Manganese(II) sulfate' }],
  S: [{ formula: 'H2SO4', name: 'Sulfuric acid' }, { formula: 'SO2', name: 'Sulfur dioxide' }, { formula: 'H2S', name: 'Hydrogen sulfide' }],
  Br: [{ formula: 'HBr', name: 'Hydrogen bromide' }, { formula: 'Br2', name: 'Bromine' }],
  N: [{ formula: 'NH3', name: 'Ammonia' }, { formula: 'HNO3', name: 'Nitric acid' }, { formula: 'N2', name: 'Nitrogen' }],
  O: [{ formula: 'H2O', name: 'Water' }, { formula: 'CO2', name: 'Carbon dioxide' }, { formula: 'KMnO4', name: 'Potassium permanganate' }],
  C: [{ formula: 'CO2', name: 'Carbon dioxide' }, { formula: 'CH4', name: 'Methane' }, { formula: 'CaCO3', name: 'Calcium carbonate' }],
  Cl: [{ formula: 'HCl', name: 'Hydrogen chloride' }, { formula: 'NaCl', name: 'Sodium chloride' }, { formula: 'Cl2', name: 'Chlorine' }],
  Fe: [{ formula: 'FeO', name: 'Iron(II) oxide' }, { formula: 'Fe2O3', name: 'Iron(III) oxide' }, { formula: 'FeCl3', name: 'Iron(III) chloride' }],
  Cu: [{ formula: 'CuO', name: 'Copper(II) oxide' }, { formula: 'CuSO4', name: 'Copper(II) sulfate' }],
  Na: [{ formula: 'NaCl', name: 'Sodium chloride' }, { formula: 'NaOH', name: 'Sodium hydroxide' }, { formula: 'Na2CO3', name: 'Sodium carbonate' }],
  Ca: [{ formula: 'CaCO3', name: 'Calcium carbonate' }, { formula: 'CaO', name: 'Calcium oxide' }, { formula: 'CaCl2', name: 'Calcium chloride' }],
};

const manganeseLessonSteps = [
  { titleEl: 'Αρχική εξίσωση', titleEn: 'Starting equation', explanationEl: 'Αναγνωρίζουμε τα αντιδρώντα και τα προϊόντα της συγκεκριμένης θεωρητικής οξειδοαναγωγικής μετατροπής. Οι συντελεστές παραμένουν κρυφοί μέχρι να αιτιολογηθούν.', explanationEn: 'Identify the reactants and products in this theoretical redox transformation. Coefficients stay hidden until they are justified.' },
  { titleEl: 'Εντοπισμός αριθμών οξείδωσης', titleEn: 'Identify oxidation states', explanationEl: 'Το Mn στο MnO₄⁻ είναι +7. Το Br στο HBr είναι −1. Αυτά είναι τα άτομα των οποίων οι αριθμοί οξείδωσης μεταβάλλονται.', explanationEn: 'Mn in MnO₄⁻ is +7. Br in HBr is −1. These are the atoms whose oxidation states change.' },
  { titleEl: 'Αναγωγή μαγγανίου', titleEn: 'Manganese is reduced', explanationEl: 'Το Mn μεταβαίνει από +7 σε +2: κάθε άτομο Mn προσλαμβάνει 5 ηλεκτρόνια. Η πρόσληψη ηλεκτρονίων είναι αναγωγή.', explanationEn: 'Mn changes from +7 to +2: each Mn atom gains 5 electrons. Gaining electrons is reduction.' },
  { titleEl: 'Οξείδωση βρωμιδίου', titleEn: 'Bromide is oxidized', explanationEl: 'Το Br μεταβαίνει από −1 σε 0 στο Br₂: κάθε Br⁻ αποβάλλει 1 ηλεκτρόνιο. Η αποβολή ηλεκτρονίων είναι οξείδωση.', explanationEn: 'Br changes from −1 to 0 in Br₂: each Br⁻ loses 1 electron. Losing electrons is oxidation.' },
  { titleEl: 'Ισοστάθμιση ηλεκτρονίων', titleEn: 'Balance electrons', explanationEl: 'Δύο άτομα Mn προσλαμβάνουν συνολικά 10 e⁻. Δέκα ιόντα Br⁻ αποδίδουν τα ίδια 10 e⁻, οπότε εμφανίζονται οι συντελεστές 2, 10 και 5.', explanationEn: 'Two Mn atoms gain 10 e⁻ in total. Ten Br⁻ ions supply those same 10 e⁻, revealing coefficients 2, 10, and 5.' },
  { titleEl: 'Ισοστάθμιση θειικών ιόντων και καλίου', titleEn: 'Balance sulfate and potassium', explanationEl: 'Τα δύο MnSO₄ χρειάζονται δύο θειικά ιόντα και το K₂SO₄ ένα ακόμη. Έτσι προκύπτουν 3 H₂SO₄ και 1 K₂SO₄.', explanationEn: 'The two MnSO₄ units need two sulfate ions, and K₂SO₄ needs one more. This gives 3 H₂SO₄ and 1 K₂SO₄.' },
  { titleEl: 'Ισοστάθμιση υδρογόνου και οξυγόνου', titleEn: 'Balance hydrogen and oxygen', explanationEl: 'Μετρώντας τα H και O απομένουν 8 μόρια νερού στη δεξιά πλευρά. Ελέγχουμε ξανά όλα τα άτομα.', explanationEn: 'Counting H and O leaves 8 water molecules on the right. Check every atom again.' },
  { titleEl: 'Τελικός έλεγχος', titleEn: 'Final check', explanationEl: 'Η εξίσωση διατηρεί K, Mn, S, O, H και Br. Η παρουσία Br₂, τοξικού προϊόντος, αναφέρεται μόνο συμβολικά: αυτό το μάθημα δεν αποτελεί οδηγία ανάμειξης ή πειράματος.', explanationEn: 'The equation conserves K, Mn, S, O, H, and Br. Br₂, a toxic product, is shown symbolically only: this lesson is not mixing or experiment guidance.' },
];

const variableOxidationStates: Record<string, number[]> = {
  H: [1, -1], C: [4, -4], N: [-3, 3, 5], P: [-3, 3, 5], S: [-2, 4, 6], Se: [-2, 4, 6],
  Fe: [2, 3], Cu: [1, 2], Mn: [2, 4, 7], Cr: [3, 6], Co: [2, 3], Ni: [2, 3],
  Sn: [2, 4], Pb: [2, 4], Hg: [1, 2], Au: [1, 3], Ag: [1], Zn: [2], Al: [3],
  Cl: [-1, 1, 3, 5, 7], Br: [-1, 1, 3, 5, 7], I: [-1, 1, 5, 7], O: [-2, -1],
};

const elementColor: Record<string, string> = {
  H: '#cbd5e1', C: '#64748b', N: '#60a5fa', O: '#fb7185', S: '#facc15',
  P: '#fb923c', Cl: '#4ade80', F: '#2dd4bf', Br: '#c084fc', I: '#a78bfa',
};

const categoryStyles: Record<string, string> = {
  alkali: 'border-rose-400/40 bg-rose-500/15 text-rose-100 hover:bg-rose-500/30',
  alkaline: 'border-orange-400/40 bg-orange-500/15 text-orange-100 hover:bg-orange-500/30',
  transition: 'border-amber-400/40 bg-amber-500/15 text-amber-100 hover:bg-amber-500/30',
  postTransition: 'border-sky-400/40 bg-sky-500/15 text-sky-100 hover:bg-sky-500/30',
  metalloid: 'border-teal-400/40 bg-teal-500/15 text-teal-100 hover:bg-teal-500/30',
  nonmetal: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/30',
  halogen: 'border-violet-400/40 bg-violet-500/15 text-violet-100 hover:bg-violet-500/30',
  noble: 'border-indigo-400/40 bg-indigo-500/15 text-indigo-100 hover:bg-indigo-500/30',
  lanthanide: 'border-fuchsia-400/40 bg-fuchsia-500/15 text-fuchsia-100 hover:bg-fuchsia-500/30',
  actinide: 'border-pink-400/40 bg-pink-500/15 text-pink-100 hover:bg-pink-500/30',
};

function getCategory(element: PeriodicElement): string {
  if (element.atomicNumber >= 57 && element.atomicNumber <= 71) return 'lanthanide';
  if (element.atomicNumber >= 89 && element.atomicNumber <= 103) return 'actinide';
  if (element.group === 1 && element.symbol !== 'H') return 'alkali';
  if (element.group === 2) return 'alkaline';
  if (element.group >= 3 && element.group <= 12) return 'transition';
  if (element.group === 17) return 'halogen';
  if (element.group === 18) return 'noble';
  if (['B', 'Si', 'Ge', 'As', 'Sb', 'Te'].includes(element.symbol)) return 'metalloid';
  if (['H', 'C', 'N', 'O', 'P', 'S', 'Se'].includes(element.symbol)) return 'nonmetal';
  return 'postTransition';
}

function oxidationOptions(element: PeriodicElement): number[] {
  if (variableOxidationStates[element.symbol]) return variableOxidationStates[element.symbol];
  if (element.group === 1) return [1];
  if (element.group === 2) return [2];
  if (element.group === 13) return [3];
  if (element.group === 14) return [4, -4];
  if (element.group === 15) return [-3, 3, 5];
  if (element.group === 16) return [-2, 4, 6];
  if (element.group === 17) return [-1];
  if (element.group === 18) return [0];
  if (element.group >= 3 && element.group <= 12) return [2, 3];
  return [3];
}

function defaultOxidation(element: PeriodicElement): number {
  return oxidationOptions(element)[0];
}

function greatestCommonDivisor(first: number, second: number): number {
  let a = Math.abs(first);
  let b = Math.abs(second);
  while (b !== 0) [a, b] = [b, a % b];
  return a || 1;
}

function composeBinaryFormula(first: PeriodicElement, firstCharge: number, second: PeriodicElement, secondCharge: number): string | null {
  if (!firstCharge || !secondCharge || Math.sign(firstCharge) === Math.sign(secondCharge)) return null;
  const cation = firstCharge > 0 ? first : second;
  const anion = firstCharge < 0 ? first : second;
  const cationCharge = firstCharge > 0 ? firstCharge : secondCharge;
  const anionCharge = firstCharge < 0 ? firstCharge : secondCharge;
  const divisor = greatestCommonDivisor(cationCharge, anionCharge);
  const cationCount = Math.abs(anionCharge) / divisor;
  const anionCount = cationCharge / divisor;
  return `${cation.symbol}${cationCount > 1 ? cationCount : ''}${anion.symbol}${anionCount > 1 ? anionCount : ''}`;
}

function formulaParts(formula: string): React.ReactNode[] {
  return formula.split(/(\d+)/).map((part, index) =>
    /^\d+$/.test(part) ? <sub key={`${part}-${index}`}>{part}</sub> : <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>
  );
}

const categoryLabels: Record<string, { el: string; en: string }> = {
  alkali: { el: 'Αλκάλια', en: 'Alkali metals' },
  alkaline: { el: 'Αλκαλικές γαίες', en: 'Alkaline earths' },
  transition: { el: 'Μεταβατικά', en: 'Transition metals' },
  postTransition: { el: 'Μετα-μεταβατικά', en: 'Post-transition' },
  metalloid: { el: 'Μεταλλοειδή', en: 'Metalloids' },
  nonmetal: { el: 'Αμέταλλα', en: 'Nonmetals' },
  halogen: { el: 'Αλογόνα', en: 'Halogens' },
  noble: { el: 'Ευγενή αέρια', en: 'Noble gases' },
  lanthanide: { el: 'Λανθανίδες', en: 'Lanthanides' },
  actinide: { el: 'Ακτινίδες', en: 'Actinides' },
};

export const ChemistryWorkspace: React.FC<ChemistryWorkspaceProps> = ({ currentTheme, lang, onExplainReaction }) => {
  const [chemistryBranch, setChemistryBranch] = useState<'reactions' | 'organic'>('reactions');
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([]);
  const [chargeOverrides, setChargeOverrides] = useState<Record<string, number>>({});
  const [reactants, setReactants] = useState<Reactant[]>([]);
  const [search, setSearch] = useState('');
  const [manganeseLessonStep, setManganeseLessonStep] = useState<number | null>(null);
  const elementsBySymbol = useMemo(() => new Map(PERIODIC_ELEMENTS.map((element) => [element.symbol, element])), []);
  const selectedElements = selectedSymbols.map((symbol) => elementsBySymbol.get(symbol)).filter((element): element is PeriodicElement => Boolean(element));
  const currentCharges = selectedElements.map((element) => chargeOverrides[element.symbol] ?? defaultOxidation(element));
  const builtFormula = selectedElements.length === 2
    ? composeBinaryFormula(selectedElements[0], currentCharges[0], selectedElements[1], currentCharges[1])
    : null;
  const filteredElements = PERIODIC_ELEMENTS.filter((element) =>
    `${element.atomicNumber} ${element.symbol} ${element.name}`.toLowerCase().includes(search.trim().toLowerCase())
  );
  const byPosition = new Map(PERIODIC_ELEMENTS.map((element) => [`${element.row}-${element.group}`, element]));
  const localized = (el: string, en: string) => lang === 'el' ? el : en;
  const selectedSuggestedCompounds = Array.from(new Map(
    selectedSymbols.flatMap((symbol) => suggestedCompounds[symbol] ?? []).map((compound) => [compound.formula, compound])
  ).values()).slice(0, 8);

  const toggleElement = (symbol: string) => {
    setSelectedSymbols((current) => current.includes(symbol)
      ? current.filter((item) => item !== symbol)
      : current.length >= 2 ? [current[1], symbol] : [...current, symbol]);
  };

  const addReactant = () => {
    if (!builtFormula || selectedElements.length !== 2) return;
    setReactants((current) => [...current, {
      formula: builtFormula,
      symbols: selectedElements.map((element) => element.symbol),
      charges: [...currentCharges],
    }]);
    setSelectedSymbols([]);
  };

  const addSuggestedCompound = (compound: SuggestedCompound) => {
    setReactants((current) => [...current, { formula: compound.formula, symbols: [], charges: [] }]);
  };

  const loadManganeseLesson = () => {
    setReactants([
      { formula: 'KMnO4', symbols: ['K', 'Mn', 'O'], charges: [] },
      { formula: 'HBr', symbols: ['H', 'Br'], charges: [] },
      { formula: 'H2SO4', symbols: ['H', 'S', 'O'], charges: [] },
    ]);
    setManganeseLessonStep(0);
  };

  const manganeseEquation = () => {
    const stage = manganeseLessonStep ?? 0;
    const coefficients: Record<string, number> = stage >= 4
      ? { KMnO4: 2, HBr: 10, MnSO4: 2, Br2: 5 }
      : {};
    if (stage >= 5) coefficients.H2SO4 = 3;
    if (stage >= 6) coefficients.H2O = 8;
    const sides = [
      ['KMnO4', 'HBr', 'H2SO4'],
      ['MnSO4', 'K2SO4', 'Br2', 'H2O'],
    ];
    return sides.map((side, sideIndex) => (
      <React.Fragment key={sideIndex}>
        {sideIndex > 0 && <span className="px-2 text-slate-400">→</span>}
        {side.map((formula, index) => (
          <React.Fragment key={formula}>
            {index > 0 && <span className="px-1 text-slate-500">+</span>}
            {coefficients[formula] && (
              <span key={`${formula}-${coefficients[formula]}`} className="mr-1 inline-block text-amber-300" style={{ animation: 'coefficient-pop 320ms ease-out' }}>
                {coefficients[formula]}
              </span>
            )}
            <span className="text-white">{formulaParts(formula)}</span>
          </React.Fragment>
        ))}
      </React.Fragment>
    ));
  };

  const requestExplanation = (selectedReactants: Reactant[]) => {
    if (selectedReactants.length < 2) return;
    const mixture = selectedReactants.map((item) => item.formula).join(' + ');
    onExplainReaction(
      `${CHEMISTRY_REACTION_REQUEST_MARKER}\nΑυτό είναι αίτημα αποκλειστικά για πρόβλεψη χημικής αντίδρασης και Interactive Lab, όχι για quiz ή κάρτες. Μην επαναλάβεις τον δείκτη στο κείμενο της απάντησης. Κάνε πρώτα σαφή θεωρητική πρόβλεψη προϊόντων για τα αντιδρώντα ${mixture} και έπειτα δείξε τη σε διαδραστικό ψηφιακό μοντέλο. Μην απαντήσεις μόνο με γενική περιγραφή. ` +
      `Επέστρεψε μόνο ένα έγκυρο block \`\`\`lab με JSON αντικείμενο στη ρίζα (όχι μέσα σε πεδίο spec), scene:"reaction", title, description, equation, particles:[], species και steps. Το equation να είναι η πλήρης ισοσταθμισμένη αντίδραση όταν η πρόβλεψη είναι τεκμηριωμένη. Στο species να υπάρχουν όλα τα αντιδρώντα και τα προϊόντα με formula, name και role ("reactant" ή "product"), και όπου υπάρχουν τεκμηριωμένες δομές, structure:{atoms:[{element,x,y}],bonds:[{from,to,order}]}. Τα x,y είναι 0–100 και τα from/to δείκτες atoms· order 1, 2 ή 3. ` +
      `Δώσε 5–8 βήματα στα ελληνικά με title, explanation, focus και molecularChanges. Σε κάθε molecularChanges χρησιμοποίησε action ("break", "form" ή "transfer"), fromSpecies, προαιρετικό toSpecies, element και, όταν είναι γνωστά από τα structures, fromBond:[i,j] ή toBond:[i,j]. Αυτά οδηγούν τις κινούμενες επισημάνσεις των δεσμών και τη μεταφορά ατόμων. Το focus να αναφέρει ακριβώς τους τύπους ή τα ονόματα των ειδών που πρέπει να φωτιστούν σε αυτό το βήμα. ` +
      `Η περιοχή Ψηφιακό μοντέλο πρέπει να δείχνει μόνο τα μοριακά σχήματα· η συνολική αντίδραση υπάρχει χωριστά ως μικρή λεζάντα. Μην επινοήσεις προϊόντα, ατομικές συνδέσεις ή στάδια. Αν δεν υπάρχει μοναδική αξιόπιστη πρόβλεψη χωρίς πρόσθετες συνθήκες, εξήγησε το καθαρά στο description και μην παρουσιάσεις εικασία ως βέβαιο προϊόν. ` +
      `Αυτό είναι αποκλειστικά θεωρητική εξήγηση, όχι πείραμα: μην αναφέρεις ποσότητες, αναλογίες, πρακτικά βήματα ανάμειξης ή οδηγίες παρασκευής, ιδίως για τοξικά/οξειδωτικά αντιδραστήρια.`
    );
  };

  const elementButton = (element: PeriodicElement) => {
    const category = getCategory(element);
    const isSelected = selectedSymbols.includes(element.symbol);
    return (
      <button
        key={element.symbol}
        type="button"
        onClick={() => toggleElement(element.symbol)}
        aria-pressed={isSelected}
        title={`${element.atomicNumber} · ${element.name} · ${categoryLabels[category][lang]}`}
        className={`group relative flex aspect-square min-w-0 flex-col items-center justify-center rounded-lg border p-0.5 transition duration-150 hover:z-10 hover:scale-110 hover:brightness-125 ${categoryStyles[category]} ${isSelected ? 'z-10 scale-105 ring-2 ring-white/80' : ''}`}
      >
        <span className="absolute left-0.5 top-0.5 text-[clamp(5px,1.3cqw,8px)] opacity-60">{element.atomicNumber}</span>
        <span className="text-[clamp(7px,2.4cqw,14px)] font-black">{element.symbol}</span>
        <span className="hidden truncate text-[8px] opacity-70 2xl:block">{element.name}</span>
      </button>
    );
  };

  return (
    <section className={`space-y-4 rounded-2xl border ${currentTheme.classes.borderPrimary} ${currentTheme.classes.bgCard} p-3 sm:p-4`}>
      <header className="flex items-start gap-3">
        <span className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 p-2 text-cyan-200"><Atom className="size-5" /></span>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-300">{localized('Εργαστήριο σύνθεσης', 'Composition workspace')}</div>
          <h3 className="text-lg font-black text-white">{localized('Χημεία', 'Chemistry')}</h3>
          <p className="font-sans text-sm leading-6 text-slate-300">{localized('Επίλεξε δύο στοιχεία για να σχηματίσεις έναν ουδέτερο δυαδικό τύπο με βάση συνήθεις αριθμούς οξείδωσης.', 'Choose two elements to form a neutral binary formula using common oxidation states.')}</p>
        </div>
      </header>

      <div role="tablist" aria-label={localized('Κλάδοι Χημείας', 'Chemistry branches')} className="flex flex-wrap gap-2">
        <button type="button" role="tab" aria-selected={chemistryBranch === 'reactions'} onClick={() => setChemistryBranch('reactions')} className={`rounded-lg border px-3 py-2 text-xs font-bold transition ${chemistryBranch === 'reactions' ? 'border-cyan-300/40 bg-cyan-300/10 text-cyan-100' : 'border-white/10 bg-black/20 text-slate-400 hover:text-white'}`}>
          {localized('Ανόργανη Χημεία · Αντιδράσεις', 'Inorganic Chemistry · Reactions')}
        </button>
        <button type="button" role="tab" aria-selected={chemistryBranch === 'organic'} onClick={() => setChemistryBranch('organic')} className={`rounded-lg border px-3 py-2 text-xs font-bold transition ${chemistryBranch === 'organic' ? 'border-emerald-300/40 bg-emerald-300/10 text-emerald-100' : 'border-white/10 bg-black/20 text-slate-400 hover:text-white'}`}>
          {localized('Οργανική Χημεία', 'Organic Chemistry')}
        </button>
      </div>

      {chemistryBranch === 'organic' ? <OrganicChemistryWorkspace currentTheme={currentTheme} lang={lang} /> : <>
      <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-bold text-white">{localized('Περιοδικός πίνακας', 'Periodic table')}</h4>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={localized('Αναζήτηση στοιχείου…', 'Search elements…')} className="w-full max-w-56 rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 text-xs text-white outline-none focus:border-cyan-300/50" />
        </div>
        {search.trim() ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,3rem),1fr))] gap-1.5">
            {filteredElements.map(elementButton)}
          </div>
        ) : (
          <div className="@container min-w-0 w-full pb-1">
            <div className="grid grid-cols-18 gap-0.5">
              {Array.from({ length: 7 }, (_, rowIndex) => Array.from({ length: 18 }, (_, groupIndex) => {
                const element = byPosition.get(`${rowIndex + 1}-${groupIndex + 1}`);
                return element ? elementButton(element) : <span key={`empty-${rowIndex}-${groupIndex}`} aria-hidden="true" />;
              }))}
            </div>
            <div className="mt-1 grid grid-cols-18 gap-0.5">
              {[8, 9].map((row) => (
                <React.Fragment key={row}>
                  <span className="col-span-3 self-center truncate text-[clamp(5px,1.3cqw,8px)] text-slate-500">{row === 8 ? 'La–Lu' : 'Ac–Lr'}</span>
                  {PERIODIC_ELEMENTS.filter((element) => element.row === row).map(elementButton)}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {Object.entries(categoryLabels).map(([category, labels]) => (
            <span key={category} className={`rounded-full border px-2 py-0.5 text-[9px] ${categoryStyles[category].split(' ').slice(0, 3).join(' ')}`}>
              {labels[lang]}
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <div className="rounded-xl border border-cyan-400/20 bg-cyan-950/10 p-3">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-xs font-bold text-cyan-100">{localized('Σχηματισμός ένωσης', 'Build a compound')}</h4>
            <span className="text-[10px] text-slate-500">{selectedElements.length}/2 {localized('στοιχεία', 'elements')}</span>
          </div>
          {selectedElements.length > 0 ? (
            <div className="space-y-2">
              {selectedElements.map((element) => {
                const options = oxidationOptions(element);
                const charge = chargeOverrides[element.symbol] ?? defaultOxidation(element);
                return (
                  <div key={element.symbol} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/25 px-2.5 py-2">
                    <span className="font-bold" style={{ color: elementColor[element.symbol] || '#e2e8f0' }}>{element.symbol} · {element.name}</span>
                    <label className="flex items-center gap-2 text-[10px] text-slate-400">
                      {localized('Αριθμός οξείδωσης', 'Oxidation state')}
                      <select value={charge} onChange={(event) => setChargeOverrides((current) => ({ ...current, [element.symbol]: Number(event.target.value) }))} className="rounded border border-white/10 bg-slate-900 px-1.5 py-1 text-xs text-white">
                        {options.map((option) => <option key={option} value={option}>{option > 0 ? `+${option}` : option}</option>)}
                      </select>
                    </label>
                  </div>
                );
              })}
              {selectedElements.length === 2 && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                  <div>
                    <span className="block text-[9px] uppercase tracking-wider text-slate-500">{localized('Ουδέτερος εμπειρικός τύπος', 'Neutral empirical formula')}</span>
                    <strong className="font-mono text-2xl text-white">{builtFormula ? formulaParts(builtFormula) : '—'}</strong>
                    {!builtFormula && <span className="ml-2 text-[10px] text-amber-300">{localized('Χρειάζονται αντίθετα φορτία', 'Opposite charges are needed')}</span>}
                  </div>
                  <button type="button" onClick={addReactant} disabled={!builtFormula} className="inline-flex items-center gap-1 rounded-lg border border-cyan-300/30 bg-cyan-300/10 px-2.5 py-2 text-xs font-bold text-cyan-100 hover:bg-cyan-300/20 disabled:opacity-40">
                    <Plus className="size-3.5" />{localized('Προσθήκη στα αντιδρώντα', 'Add as reactant')}
                  </button>
                </div>
              )}
              {selectedSuggestedCompounds.length > 0 && (
                <div className="rounded-lg border border-cyan-300/15 bg-black/20 p-2.5">
                  <p className="mb-2 text-[10px] font-bold text-cyan-100">{localized('Γνωστές ενώσεις για τα επιλεγμένα στοιχεία', 'Common compounds for selected elements')}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedSuggestedCompounds.map((compound) => (
                      <button key={compound.formula} type="button" onClick={() => addSuggestedCompound(compound)} title={compound.name} className="rounded-md border border-white/10 bg-slate-900/80 px-2 py-1 text-[10px] text-slate-200 hover:border-cyan-300/50 hover:text-cyan-100">
                        <Plus className="mr-1 inline size-3" />{formulaParts(compound.formula)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {selectedSymbols.includes('Mn') && (
                <div className="rounded-lg border border-amber-300/20 bg-amber-950/15 p-2.5">
                  <p className="text-[10px] font-bold text-amber-100">{localized('Προτεινόμενο μάθημα οξειδοαναγωγής', 'Suggested redox lesson')}</p>
                  <p className="mt-1 text-[10px] leading-relaxed text-slate-400">{localized('Συμβολική ανάλυση KMnO₄, HBr και H₂SO₄: αριθμοί οξείδωσης, μεταφορά ηλεκτρονίων και ισοστάθμιση. Δεν περιλαμβάνει πειραματικές οδηγίες.', 'Symbolic analysis of KMnO₄, HBr, and H₂SO₄: oxidation states, electron transfer, and balancing. No experimental instructions.')}</p>
                  <button type="button" onClick={loadManganeseLesson} className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-amber-300/30 bg-amber-300/10 px-2.5 py-1.5 text-[10px] font-bold text-amber-100 hover:bg-amber-300/20">
                    <FlaskConical className="size-3.5" />{localized('Άνοιγμα μαθήματος βήμα-βήμα', 'Open step-by-step lesson')}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-white/10 px-3 py-5 text-center text-xs text-slate-500">{localized('Πάτησε δύο στοιχεία στον πίνακα.', 'Select two elements from the table.')}</p>
          )}
        </div>

        <div className="rounded-xl border border-violet-400/20 bg-violet-950/10 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h4 className="text-xs font-bold text-violet-100">{localized('Αντιδρώντα', 'Reactants')}</h4>
            <span className="text-[10px] text-slate-500">{reactants.length} {localized('ενώσεις', 'compounds')}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {reactants.map((reactant, index) => (
              <div key={`${reactant.formula}-${index}`} className="flex items-center justify-between gap-2 rounded-lg border border-violet-300/20 bg-black/25 px-2.5 py-2">
                <span><span className="block text-[9px] text-slate-500">{localized('Αντιδρών', 'Reactant')} {index + 1}</span><strong className="font-mono text-lg text-white">{formulaParts(reactant.formula)}</strong></span>
                <button type="button" onClick={() => setReactants((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={localized('Αφαίρεση αντιδρώντος', 'Remove reactant')} className="rounded p-1 text-slate-500 hover:bg-rose-400/10 hover:text-rose-300"><X className="size-3.5" /></button>
              </div>
            ))}
            {Array.from({ length: Math.max(0, 2 - reactants.length) }, (_, index) => (
              <div key={`empty-reactant-${index}`} className="flex min-h-14 items-center justify-center rounded-lg border border-dashed border-white/10 text-[10px] text-slate-600">{localized('Επίλεξε ένωση', 'Add a compound')}</div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => requestExplanation(builtFormula && selectedElements.length === 2
              ? [...reactants, { formula: builtFormula, symbols: selectedElements.map((element) => element.symbol), charges: [...currentCharges] }]
              : reactants)}
            disabled={reactants.length + (builtFormula && selectedElements.length === 2 ? 1 : 0) < 2}
            className="mt-3 w-full rounded-lg border border-violet-300/30 bg-violet-300/10 px-4 py-2.5 text-sm font-bold text-violet-100 transition hover:bg-violet-300/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {localized('Υπολόγισε αντίδραση', 'Calculate reaction')}
          </button>
        </div>
      </div>

      {manganeseLessonStep !== null && (
        <section aria-label={localized('Μάθημα οξειδοαναγωγής μαγγανίου', 'Manganese redox lesson')} className="space-y-3 rounded-xl border border-amber-300/25 bg-linear-to-br from-amber-950/30 to-slate-950/70 p-3 sm:p-4">
          <style>{'@keyframes coefficient-pop { 0% { opacity: 0; transform: translateY(5px) scale(.8); } 70% { transform: translateY(-2px) scale(1.12); } 100% { opacity: 1; transform: translateY(0) scale(1); } }'}</style>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-amber-300">{localized(`Βήμα ${manganeseLessonStep + 1} από ${manganeseLessonSteps.length}`, `Step ${manganeseLessonStep + 1} of ${manganeseLessonSteps.length}`)}</p>
              <h4 className="text-sm font-black text-white">{lang === 'el' ? manganeseLessonSteps[manganeseLessonStep].titleEl : manganeseLessonSteps[manganeseLessonStep].titleEn}</h4>
            </div>
            <div className="flex gap-1.5">
              <button type="button" onClick={() => setManganeseLessonStep((step) => Math.max(0, (step ?? 0) - 1))} disabled={manganeseLessonStep === 0} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-slate-200 hover:border-amber-300/40 disabled:opacity-40">{localized('Προηγούμενο', 'Previous')}</button>
              <button type="button" onClick={() => setManganeseLessonStep((step) => Math.min(manganeseLessonSteps.length - 1, (step ?? 0) + 1))} disabled={manganeseLessonStep === manganeseLessonSteps.length - 1} className="rounded-lg border border-amber-300/30 bg-amber-300/10 px-2.5 py-1.5 text-xs font-bold text-amber-100 hover:bg-amber-300/20 disabled:opacity-40">{localized('Επόμενο βήμα', 'Next step')}</button>
            </div>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuemin={1} aria-valuemax={manganeseLessonSteps.length} aria-valuenow={manganeseLessonStep + 1}>
            <div className="h-full rounded-full bg-amber-300 transition-[width] duration-300" style={{ width: `${((manganeseLessonStep + 1) / manganeseLessonSteps.length) * 100}%` }} />
          </div>
          <div className="overflow-x-auto rounded-lg border border-white/10 bg-black/30 p-3 text-center font-mono text-lg sm:text-xl">
            <div className="min-w-max">{manganeseEquation()}</div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className={`rounded-lg border p-2.5 transition-colors duration-300 ${manganeseLessonStep >= 2 ? 'border-violet-300/40 bg-violet-400/10' : 'border-white/10 bg-black/20'}`}>
              <p className="text-[9px] uppercase tracking-wider text-slate-500">{localized('Αναγωγή · μαγγάνιο', 'Reduction · manganese')}</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="rounded-md bg-violet-400/15 px-2 py-1 font-mono font-bold text-violet-200">Mn +7</span>
                {manganeseLessonStep >= 2 && <><span className="text-slate-500">→</span><span className="rounded-md bg-violet-400/25 px-2 py-1 font-mono font-bold text-violet-100" style={{ animation: 'coefficient-pop 320ms ease-out' }}>Mn +2</span></>}
                {manganeseLessonStep >= 2 && <span className="text-[10px] text-violet-200">{localized('προσλαμβάνει 5 e⁻ ανά Mn', 'gains 5 e⁻ per Mn')}</span>}
              </div>
            </div>
            <div className={`rounded-lg border p-2.5 transition-colors duration-300 ${manganeseLessonStep >= 3 ? 'border-fuchsia-300/40 bg-fuchsia-400/10' : 'border-white/10 bg-black/20'}`}>
              <p className="text-[9px] uppercase tracking-wider text-slate-500">{localized('Οξείδωση · βρώμιο', 'Oxidation · bromine')}</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="rounded-md bg-fuchsia-400/15 px-2 py-1 font-mono font-bold text-fuchsia-200">Br −1</span>
                {manganeseLessonStep >= 3 && <><span className="text-slate-500">→</span><span className="rounded-md bg-fuchsia-400/25 px-2 py-1 font-mono font-bold text-fuchsia-100" style={{ animation: 'coefficient-pop 320ms ease-out' }}>Br 0</span></>}
                {manganeseLessonStep >= 3 && <span className="text-[10px] text-fuchsia-200">{localized('αποβάλλει 1 e⁻ ανά Br', 'loses 1 e⁻ per Br')}</span>}
              </div>
            </div>
          </div>
          {manganeseLessonStep >= 4 && (
            <div className="rounded-lg border border-cyan-300/25 bg-cyan-950/25 p-2.5 text-center text-xs text-cyan-100" style={{ animation: 'coefficient-pop 320ms ease-out' }}>
              {localized('10 e⁻ αποδίδονται από τα Br⁻ και προσλαμβάνονται από τα Mn · τα ηλεκτρόνια δεν δημιουργούνται ούτε χάνονται.', '10 e⁻ are supplied by Br⁻ and gained by Mn · electrons are neither created nor lost.')}
            </div>
          )}
          <p aria-live="polite" className="rounded-lg border border-white/10 bg-black/20 p-3 text-xs leading-relaxed text-slate-200">
            {lang === 'el' ? manganeseLessonSteps[manganeseLessonStep].explanationEl : manganeseLessonSteps[manganeseLessonStep].explanationEn}
          </p>
          <div className="rounded-lg border border-rose-400/25 bg-rose-950/20 p-2.5 text-[10px] leading-relaxed text-rose-100">
            {localized('Σημείωση ασφάλειας: το Br₂ είναι τοξικό. Η εξίσωση παρουσιάζεται μόνο ως συμβολικό εκπαιδευτικό παράδειγμα· δεν παρέχονται οδηγίες παρασκευής, ανάμειξης ή χειρισμού.', 'Safety note: Br₂ is toxic. This equation is shown only as a symbolic educational example; no preparation, mixing, or handling instructions are provided.')}
          </div>
        </section>
      )}

      <p className="text-[10px] leading-relaxed text-slate-500">
        {localized('Οι τύποι είναι εκπαιδευτικές προβλέψεις από συνήθεις αριθμούς οξείδωσης, όχι πλήρης βάση δεδομένων. Η δημιουργία προϊόντων γίνεται μόνο όταν τεκμηριώνεται· η προσομοίωση είναι θεωρητική, όχι οδηγός πειράματος.', 'Formulas are educational predictions from common oxidation states, not a complete database. Products are shown only when supported; the simulation is theoretical, not an experiment guide.')}
      </p>
      </>}
    </section>
  );
};
