import React, { useMemo, useState } from 'react';
import { AppTheme } from '../types';

type OrganicSeries = 'alkane' | 'alkene' | 'alkyne' | 'alcohol' | 'aldehyde' | 'ketone' | 'acid';

const seriesInfo: Record<OrganicSeries, { el: string; en: string; suffixEl: string; suffixEn: string; color: string }> = {
  alkane: { el: 'Αλκάνια', en: 'Alkanes', suffixEl: 'άνιο', suffixEn: 'ane', color: '#fbbf24' },
  alkene: { el: 'Αλκένια', en: 'Alkenes', suffixEl: 'ένιο', suffixEn: 'ene', color: '#38bdf8' },
  alkyne: { el: 'Αλκίνια', en: 'Alkynes', suffixEl: 'ίνιο', suffixEn: 'yne', color: '#c084fc' },
  alcohol: { el: 'Αλκοόλες', en: 'Alcohols', suffixEl: 'όλη', suffixEn: 'ol', color: '#34d399' },
  aldehyde: { el: 'Αλδεΰδες', en: 'Aldehydes', suffixEl: 'ανάλη', suffixEn: 'anal', color: '#fb7185' },
  ketone: { el: 'Κετόνες', en: 'Ketones', suffixEl: 'όνη', suffixEn: 'one', color: '#f97316' },
  acid: { el: 'Καρβοξυλικά οξέα', en: 'Carboxylic acids', suffixEl: 'ανικό οξύ', suffixEn: 'anoic acid', color: '#2dd4bf' },
};

const carbonRoots = [
  { el: 'μεθ', en: 'meth' },
  { el: 'αιθ', en: 'eth' },
  { el: 'προπ', en: 'prop' },
  { el: 'βουτ', en: 'but' },
  { el: 'πεντ', en: 'pent' },
  { el: 'εξ', en: 'hex' },
  { el: 'επτα', en: 'hept' },
  { el: 'οκτ', en: 'oct' },
];

const seriesDetails: Record<OrganicSeries, { formula: (n: number) => string; groupEl: string; groupEn: string; introEl: string; introEn: string }> = {
  alkane: {
    formula: (n) => `C${n}H${2 * n + 2}`,
    groupEl: 'Μόνο απλοί δεσμοί C–C',
    groupEn: 'Only single C–C bonds',
    introEl: 'Κορεσμένοι υδρογονάνθρακες. Κάθε επόμενο μέλος διαφέρει κατά –CH₂–.',
    introEn: 'Saturated hydrocarbons. Consecutive members differ by –CH₂–.',
  },
  alkene: {
    formula: (n) => `C${n}H${2 * n}`,
    groupEl: 'Ένας διπλός δεσμός C=C',
    groupEn: 'One C=C double bond',
    introEl: 'Άκυκλοι ακόρεστοι υδρογονάνθρακες με έναν διπλό δεσμό.',
    introEn: 'Acyclic unsaturated hydrocarbons with one double bond.',
  },
  alkyne: {
    formula: (n) => `C${n}H${2 * n - 2}`,
    groupEl: 'Ένας τριπλός δεσμός C≡C',
    groupEn: 'One C≡C triple bond',
    introEl: 'Άκυκλοι ακόρεστοι υδρογονάνθρακες με έναν τριπλό δεσμό.',
    introEn: 'Acyclic unsaturated hydrocarbons with one triple bond.',
  },
  alcohol: {
    formula: (n) => `C${n}H${2 * n + 2}O`,
    groupEl: 'Υδροξυλομάδα –OH',
    groupEn: 'Hydroxyl group –OH',
    introEl: 'Η χαρακτηριστική ομάδα –OH συνδέεται με κορεσμένο άτομο άνθρακα.',
    introEn: 'The characteristic –OH group is attached to a saturated carbon.',
  },
  aldehyde: {
    formula: (n) => `C${n}H${2 * n}O`,
    groupEl: 'Αλδεϋδομάδα –CHO',
    groupEn: 'Aldehyde group –CHO',
    introEl: 'Η καρβονυλομάδα βρίσκεται στο άκρο της ανθρακικής αλυσίδας.',
    introEn: 'The carbonyl group is at the end of the carbon chain.',
  },
  ketone: {
    formula: (n) => `C${n}H${2 * n}O`,
    groupEl: 'Καρβονυλομάδα >C=O',
    groupEn: 'Carbonyl group >C=O',
    introEl: 'Η καρβονυλομάδα βρίσκεται στο εσωτερικό της ανθρακικής αλυσίδας.',
    introEn: 'The carbonyl group is within the carbon chain.',
  },
  acid: {
    formula: (n) => `C${n}H${2 * n}O2`,
    groupEl: 'Καρβοξυλομάδα –COOH',
    groupEn: 'Carboxyl group –COOH',
    introEl: 'Η καρβοξυλομάδα βρίσκεται στο άκρο της αλυσίδας.',
    introEn: 'The carboxyl group is at the end of the chain.',
  },
};

const reactionTheory: Record<OrganicSeries, Array<{ el: string; en: string; equation: string }>> = {
  alkane: [
    { el: 'Πλήρης καύση', en: 'Complete combustion', equation: 'CnH2n+2 + (3n+1)/2 O2 → nCO2 + (n+1)H2O' },
    { el: 'Υποκατάσταση με αλογόνο', en: 'Halogen substitution', equation: 'R–H + X2 → R–X + H–X' },
  ],
  alkene: [
    { el: 'Προσθήκη υδρογόνου', en: 'Hydrogen addition', equation: 'R–CH=CH2 + H2 → R–CH2–CH3' },
    { el: 'Προσθήκη αλογόνου', en: 'Halogen addition', equation: 'R–CH=CH2 + X2 → R–CHX–CH2X' },
    { el: 'Προσθήκη νερού', en: 'Water addition', equation: 'C=C + H2O → alcohol' },
  ],
  alkyne: [
    { el: 'Προσθήκη υδρογόνου', en: 'Hydrogen addition', equation: 'R–C≡C–R′ + 2H2 → R–CH2–CH2–R′' },
    { el: 'Προσθήκη αλογόνου', en: 'Halogen addition', equation: 'C≡C + 2X2 → –CX2–CX2–' },
  ],
  alcohol: [
    { el: 'Οξείδωση πρωτοταγούς αλκοόλης', en: 'Primary alcohol oxidation', equation: 'R–CH2OH → R–CHO → R–COOH' },
    { el: 'Αφυδάτωση', en: 'Dehydration', equation: 'alcohol → alkene + H2O' },
    { el: 'Εστεροποίηση', en: 'Esterification', equation: 'R–COOH + R′–OH ⇌ R–COO–R′ + H2O' },
  ],
  aldehyde: [
    { el: 'Οξείδωση', en: 'Oxidation', equation: 'R–CHO + [O] → R–COOH' },
    { el: 'Αναγωγή', en: 'Reduction', equation: 'R–CHO + H2 → R–CH2OH' },
  ],
  ketone: [
    { el: 'Αναγωγή', en: 'Reduction', equation: 'R–CO–R′ + H2 → R–CHOH–R′' },
  ],
  acid: [
    { el: 'Εστεροποίηση', en: 'Esterification', equation: 'R–COOH + R′–OH ⇌ R–COO–R′ + H2O' },
    { el: 'Εξουδετέρωση', en: 'Neutralization', equation: 'R–COOH + NaOH → R–COONa + H2O' },
  ],
};

function formulaParts(formula: string) {
  return formula.split(/(\d+)/g).map((part, index) =>
    /^\d+$/.test(part) ? <sub key={`${part}-${index}`}>{part}</sub> : <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>
  );
}

export const OrganicChemistryWorkspace: React.FC<{ currentTheme: AppTheme; lang: 'el' | 'en' }> = ({ currentTheme, lang }) => {
  const [series, setSeries] = useState<OrganicSeries>('alkane');
  const [carbonCount, setCarbonCount] = useState(4);
  const [position, setPosition] = useState(1);
  const [methylAt, setMethylAt] = useState<number | null>(null);
  const localized = (el: string, en: string) => lang === 'el' ? el : en;
  const validSeries = series === 'ketone' ? carbonCount >= 3 : series !== 'alkene' && series !== 'alkyne' ? true : carbonCount >= 2;
  const positionMin = series === 'ketone' ? 2 : 1;
  const positionMax = series === 'alkene' || series === 'alkyne' ? carbonCount - 1
    : series === 'ketone' ? carbonCount - 1
      : carbonCount;
  const activePosition = Math.max(positionMin, Math.min(position, Math.max(positionMax, positionMin)));
  const branchPosition = methylAt !== null && methylAt >= 2 && methylAt < carbonCount ? methylAt : null;
  const totalCarbons = carbonCount + (branchPosition ? 1 : 0);
  const formula = seriesDetails[series].formula(series === 'alkane' ? totalCarbons : carbonCount);
  const name = useMemo(() => {
    const root = carbonRoots[carbonCount - 1];
    if (!root) return '';
    const rootName = lang === 'el' ? root.el : root.en;
    const prefix = branchPosition ? `${branchPosition}-${localized('μεθυλο', 'methyl')}${lang === 'en' ? '-' : ''}` : '';
    const suffix = lang === 'el' ? seriesInfo[series].suffixEl : seriesInfo[series].suffixEn;
    if (series === 'alkene' || series === 'alkyne') return `${prefix}${rootName}-${activePosition}-${suffix}`;
    if (series === 'alcohol' || series === 'ketone') return `${prefix}${rootName}${lang === 'el' ? 'αν' : 'an'}-${activePosition}-${suffix}`;
    return `${prefix}${rootName}${suffix}`;
  }, [activePosition, branchPosition, carbonCount, lang, series]);

  const atoms = Array.from({ length: carbonCount }, (_, index) => {
    const leftBondOrder = index > 0 && (series === 'alkene' && activePosition === index ? 2 : series === 'alkyne' && activePosition === index ? 3 : 1);
    const rightBondOrder = index < carbonCount - 1 && (series === 'alkene' && activePosition === index + 1 ? 2 : series === 'alkyne' && activePosition === index + 1 ? 3 : 1);
    const branchBond = branchPosition === index + 1 ? 1 : 0;
    const oxygenBond = series === 'alcohol' && activePosition === index + 1 ? 1
      : (series === 'aldehyde' && index === carbonCount - 1) ||
        (series === 'ketone' && activePosition === index + 1) ||
        (series === 'acid' && index === carbonCount - 1) ? 2 : 0;
    const acidHydroxylBond = series === 'acid' && index === carbonCount - 1 ? 1 : 0;
    const hydrogens = Math.max(0, 4 - leftBondOrder - rightBondOrder - branchBond - oxygenBond - acidHydroxylBond);
    return { index, hydrogens: Math.max(hydrogens, 0), x: 70 + index * 100, y: 120 + (index % 2 ? 26 : 0) };
  });
  const svgWidth = Math.max(220, carbonCount * 100 + 80);

  return (
    <div className="space-y-4">
      <section className={`rounded-2xl border ${currentTheme.classes.borderPrimary} bg-slate-950/60 p-4`}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300">{localized('Κατασκευαστής μορίων', 'Molecule builder')}</p>
            <h4 className="mt-1 text-lg font-black text-white">{localized('Οργανική Χημεία', 'Organic Chemistry')}</h4>
            <p className="mt-1 max-w-2xl font-sans text-sm leading-6 text-slate-300">{localized('Χτίσε ανθρακική αλυσίδα, διάλεξε ομόλογη σειρά και δες τον συντακτικό τύπο, τον μοριακό τύπο και την ονομασία.', 'Build a carbon chain, choose a homologous series, and inspect its structural formula, molecular formula, and name.')}</p>
          </div>
          <label className="text-xs text-slate-300">
            {localized('Άτομα άνθρακα', 'Carbon atoms')}
            <select value={carbonCount} onChange={(event) => { const count = Number(event.target.value); setCarbonCount(count); setMethylAt(null); setPosition(1); if ((series === 'alkene' || series === 'alkyne') && count < 2 || series === 'ketone' && count < 3) setSeries('alkane'); }} className="ml-2 rounded-lg border border-white/10 bg-slate-900 px-2.5 py-2 text-sm text-white">
              {Array.from({ length: 8 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}
            </select>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label={localized('Ομόλογες σειρές', 'Homologous series')}>
          {(Object.keys(seriesInfo) as OrganicSeries[]).map((key) => (
            <button key={key} type="button" disabled={(key === 'alkene' || key === 'alkyne') && carbonCount < 2 || key === 'ketone' && carbonCount < 3} onClick={() => { setSeries(key); setPosition(key === 'ketone' ? 2 : 1); if (key !== 'alkane') setMethylAt(null); }} aria-pressed={series === key} className={`rounded-lg border px-3 py-2 text-xs font-bold transition ${series === key ? 'text-slate-950' : 'border-white/10 bg-black/30 text-slate-300 hover:border-white/30'} disabled:cursor-not-allowed disabled:opacity-30`} style={series === key ? { color: '#06111f', backgroundColor: seriesInfo[key].color, borderColor: seriesInfo[key].color } : undefined}>
              {seriesInfo[key][lang]}
            </button>
          ))}
        </div>
        {!validSeries && <p className="mt-2 text-xs text-amber-200">{localized('Η σειρά αυτή χρειάζεται μεγαλύτερη ανθρακική αλυσίδα.', 'This family requires a longer carbon chain.')}</p>}
        {['alkene', 'alkyne', 'alcohol', 'ketone'].includes(series) && (
          <label className="mt-3 inline-flex items-center gap-2 text-xs text-slate-300">
            {localized('Θέση χαρακτηριστικής ομάδας / πολλαπλού δεσμού', 'Functional group / multiple bond position')}
            <select value={activePosition} onChange={(event) => setPosition(Number(event.target.value))} className="rounded-lg border border-white/10 bg-slate-900 px-2 py-1.5 text-white">
              {Array.from({ length: Math.max(positionMax - positionMin + 1, 1) }, (_, index) => <option key={index + positionMin} value={index + positionMin}>{index + positionMin}</option>)}
            </select>
          </label>
        )}
        {series === 'alkane' && carbonCount >= 3 && (
          <label className="mt-3 inline-flex items-center gap-2 text-xs text-slate-300">
            {localized('Πρόσθεσε διακλάδωση μεθυλίου', 'Add a methyl branch')}
            <select value={methylAt ?? ''} onChange={(event) => setMethylAt(event.target.value ? Number(event.target.value) : null)} className="rounded-lg border border-white/10 bg-slate-900 px-2 py-1.5 text-white">
              <option value="">{localized('Καμία', 'None')}</option>
              {Array.from({ length: Math.max(0, carbonCount - 2) }, (_, index) => <option key={index + 2} value={index + 2}>{index + 2}</option>)}
            </select>
          </label>
        )}
      </section>

      <section className="rounded-2xl border border-white/10 bg-[linear-gradient(145deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))] p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">{localized('Συντακτικός τύπος', 'Structural formula')}</p>
            <h5 className="mt-1 font-serif text-xl font-bold text-white" style={{ color: seriesInfo[series].color }}>{name}</h5>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-2 text-center">
            <div className="text-[9px] uppercase tracking-wider text-slate-500">{localized('Μοριακός τύπος', 'Molecular formula')}</div>
            <div className="font-mono text-lg font-black text-white">{formulaParts(formula)}</div>
          </div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-white/5 bg-slate-950/70 p-3">
          <svg viewBox={`0 0 ${svgWidth} 230`} role="img" aria-label={`${name}, ${formula}`} className="mx-auto h-56 min-w-full">
            {atoms.slice(0, -1).map((atom, index) => {
              const next = atoms[index + 1];
              const bondOrder = (series === 'alkene' && activePosition === index + 1) ? 2 : (series === 'alkyne' && activePosition === index + 1) ? 3 : 1;
              return Array.from({ length: bondOrder }, (_, bondIndex) => {
                const offset = (bondIndex - (bondOrder - 1) / 2) * 7;
                return <line key={`bond-${index}-${bondIndex}`} x1={atom.x + 23} y1={atom.y + offset} x2={next.x - 23} y2={next.y + offset} stroke={bondOrder > 1 ? seriesInfo[series].color : '#94a3b8'} strokeWidth="2.5" />;
              });
            })}
            {branchPosition && (() => {
              const parent = atoms[branchPosition - 1];
              const branchX = parent.x;
              const branchY = parent.y - 72;
              return <g><line x1={parent.x} y1={parent.y - 20} x2={branchX} y2={branchY + 18} stroke="#fbbf24" strokeWidth="2.5" /><circle cx={branchX} cy={branchY} r="23" fill="#451a03" stroke="#fbbf24" strokeWidth="2" /><text x={branchX} y={branchY + 5} textAnchor="middle" fill="#fde68a" fontSize="13" fontWeight="700">CH₃</text><text x={branchX} y={branchY - 30} textAnchor="middle" fill="#fbbf24" fontSize="10">μεθύλιο</text></g>;
            })()}
            {atoms.map((atom) => {
              const groupText = series === 'alcohol' && atom.index + 1 === activePosition ? 'OH'
                : ['aldehyde', 'ketone', 'acid'].includes(series) &&
                  (series === 'ketone' ? atom.index + 1 === activePosition : atom.index === carbonCount - 1) ? '=O'
                  : '';
              return <g key={`carbon-${atom.index}`}>
                <circle cx={atom.x} cy={atom.y} r="23" fill="#0f172a" stroke="#64748b" strokeWidth="2" />
                <text x={atom.x} y={atom.y + 5} textAnchor="middle" fill="#e2e8f0" fontSize="13" fontWeight="700">
                  <tspan>C</tspan>
                  {atom.hydrogens > 0 && <><tspan>H</tspan>{atom.hydrogens > 1 && <tspan fontSize="9" baselineShift="sub">{atom.hydrogens}</tspan>}</>}
                </text>
                <text x={atom.x} y={atom.y + 45} textAnchor="middle" fill="#64748b" fontSize="10">{atom.index + 1}</text>
                {groupText && <g><line x1={atom.x} y1={atom.y - 24} x2={atom.x} y2={atom.y - 52} stroke={seriesInfo[series].color} strokeWidth="2" /><rect x={atom.x - 31} y={atom.y - 91} width="62" height="32" rx="10" fill="#0f172a" stroke={seriesInfo[series].color} strokeWidth="1.5" /><text x={atom.x} y={atom.y - 70} textAnchor="middle" fill={seriesInfo[series].color} fontSize="13" fontWeight="700">{groupText}</text></g>}
                {series === 'acid' && atom.index === carbonCount - 1 && <g><line x1={atom.x + 23} y1={atom.y} x2={atom.x + 43} y2={atom.y} stroke={seriesInfo[series].color} strokeWidth="2" /><text x={atom.x + 51} y={atom.y + 5} fill={seriesInfo[series].color} fontSize="13" fontWeight="700">OH</text></g>}
              </g>;
            })}
          </svg>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border px-3 py-1.5" style={{ color: seriesInfo[series].color, borderColor: `${seriesInfo[series].color}66`, backgroundColor: `${seriesInfo[series].color}12` }}>{seriesDetails[series].groupEl}</span>
          {branchPosition && <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1.5 text-amber-100">{localized(`${branchPosition}-μεθυλο`, `${branchPosition}-methyl`)}</span>}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <article className="rounded-xl border border-emerald-300/20 bg-emerald-950/15 p-4">
          <h5 className="text-xs font-bold text-emerald-200">{localized('Ομόλογη σειρά', 'Homologous series')} · {seriesInfo[series][lang]}</h5>
          <p className="mt-2 font-sans text-sm leading-6 text-slate-200">{seriesDetails[series][lang === 'el' ? 'introEl' : 'introEn']}</p>
          <p className="mt-2 font-mono text-sm text-emerald-100">{localized('Γενικός τύπος:', 'General formula:')} {series === 'alkane' ? 'CnH2n+2' : series === 'alkene' ? 'CnH2n' : series === 'alkyne' ? 'CnH2n−2' : series === 'alcohol' ? 'CnH2n+2O' : series === 'acid' ? 'CnH2nO2' : 'CnH2nO'}</p>
        </article>
        <article className="rounded-xl border border-sky-300/20 bg-sky-950/15 p-4">
          <h5 className="text-xs font-bold text-sky-200">{localized('Ονοματολογία', 'Naming')}</h5>
          <p className="mt-2 font-sans text-sm leading-6 text-slate-200">{localized('Μετράμε τη μεγαλύτερη ανθρακική αλυσίδα και αριθμούμε από το άκρο που δίνει τον μικρότερο αριθμό στον πολλαπλό δεσμό ή στη χαρακτηριστική ομάδα.', 'Choose the longest carbon chain and number from the end that gives the lowest locant to the multiple bond or functional group.')}</p>
          <p className="mt-2 font-serif text-lg font-bold" style={{ color: seriesInfo[series].color }}>{name}</p>
        </article>
      </section>
      <details className="group rounded-xl border border-amber-300/20 bg-amber-950/10 p-4">
        <summary className="cursor-pointer text-sm font-bold text-amber-100">{localized('Θεωρία και βασικές αντιδράσεις Πανελλαδικών', 'Exam theory and key reactions')} · {seriesInfo[series][lang]}</summary>
        <div className="mt-3 space-y-2">
          <p className="font-sans text-xs leading-5 text-slate-300">{localized('Στις ασκήσεις ελέγχουμε πρώτα τη χαρακτηριστική ομάδα, τον αριθμό ατόμων άνθρακα και τη θέση του πολλαπλού δεσμού. Οι αντιδράσεις παρακάτω είναι γενικά συμβολικά πρότυπα.', 'In problems, first identify the functional group, number of carbon atoms, and position of any multiple bond. The reactions below are general symbolic patterns.')}</p>
          {reactionTheory[series].map((reaction) => (
            <div key={reaction.equation} className="rounded-lg border border-white/10 bg-black/25 px-3 py-2">
              <p className="text-[10px] font-bold text-amber-200">{reaction[lang]}</p>
              <p className="mt-1 overflow-x-auto font-mono text-xs text-slate-100">{reaction.equation}</p>
            </div>
          ))}
          <p className="text-[10px] leading-relaxed text-slate-500">{localized('R και R′ δηλώνουν ανθρακικές ομάδες, ενώ X δηλώνει αλογόνο. Οι εξισώσεις είναι εκπαιδευτικά πρότυπα και δεν περιλαμβάνουν πειραματικές οδηγίες.', 'R and R′ denote carbon groups, while X denotes a halogen. These are educational reaction patterns and do not provide experimental instructions.')}</p>
        </div>
      </details>
      <p className="text-[10px] leading-relaxed text-slate-500">{localized('Εκπαιδευτικό μοντέλο βασικών άκυκλων ομόλογων σειρών. Οι δομές είναι σχηματικές και καλύπτουν βασικές περιπτώσεις επιπέδου σχολικής Χημείας.', 'Educational model of basic acyclic homologous series. Structures are schematic and cover introductory school chemistry cases.')}</p>
    </div>
  );
};
