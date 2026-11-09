import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronDown, ChevronUp, Pause, Play, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { AppTheme } from '../types';

export type LabScene = 'atom' | 'cell' | 'dna' | 'reaction';

export interface InteractiveLabParticle {
  label: string;
  kind: 'electron' | 'proton' | 'neutron' | 'nucleus' | 'cell' | 'dna' | 'molecule' | 'reactant' | 'product';
  color: string;
  orbit?: number;
}

export interface InteractiveLabStep {
  title?: string;
  explanation: string;
  focus?: string[];
  insight?: string;
  equation?: string;
  oxidationStateChanges?: Array<{
    element: string;
    from: number;
    to: number;
    electrons?: number;
    direction: 'oxidation' | 'reduction';
  }>;
  molecularChanges?: Array<{
    action: 'break' | 'form' | 'transfer';
    fromSpecies: string;
    toSpecies?: string;
    element?: string;
    fromBond?: [number, number];
    toBond?: [number, number];
  }>;
}

export interface InteractiveLabSpecies {
  formula: string;
  name: string;
  role: 'reactant' | 'intermediate' | 'product';
  structure?: {
    atoms: Array<{ element: string; x: number; y: number }>;
    bonds: Array<{ from: number; to: number; order?: 1 | 2 | 3 }>;
  };
}

export interface InteractiveLabSpec {
  title: string;
  description: string;
  scene?: LabScene | string;
  particles: InteractiveLabParticle[];
  steps?: Array<string | InteractiveLabStep>;
  equation?: string;
  species?: InteractiveLabSpecies[];
  conditions?: string[];
  reactionType?: string;
  conservationNote?: string;
  safetyNote?: string;
  zoomMin?: number;
  zoomMax?: number;
  element?: string;
  protons?: number;
  neutrons?: number;
  electronShells?: number[];
  bond?: { left: string; right: string; transferredElectrons?: number };
}

interface InteractiveLabProps {
  spec: InteractiveLabSpec;
  currentTheme: AppTheme;
  lang?: 'el' | 'en';
  isActive?: boolean;
}

type EquationHoverTarget =
  | { kind: 'element'; value: string }
  | { kind: 'coefficient'; value: string; coefficient: string };

function normalizeFormulaText(value: string): string {
  return value
    .replace(/[₀-₉]/g, (digit) => String('₀₁₂₃₄₅₆₇₈₉'.indexOf(digit)))
    .replace(/[⁺⁻]/g, (charge) => charge === '⁺' ? '+' : '-')
    .replace(/\s/g, '');
}

function formulaHasElement(formula: string, element: string): boolean {
  return Array.from(normalizeFormulaText(formula).matchAll(/[A-Z][a-z]?/g))
    .some(([symbol]) => symbol === element);
}

function countFormulaAtoms(formula: string): string | null {
  const normalized = normalizeFormulaText(formula);
  if (!/^(?:[A-Z][a-z]?\d*)+$/.test(normalized)) return null;
  const counts = new Map<string, number>();
  for (const [_, element, count] of normalized.matchAll(/([A-Z][a-z]?)(\d*)/g)) {
    counts.set(element, (counts.get(element) || 0) + Number(count || 1));
  }
  return Array.from(counts, ([element, count]) => `${element}${count > 1 ? ` ${count}` : ''}`).join(' · ');
}

function splitEquation(equation: string): Array<{ type: 'term' | 'operator'; value: string; side: 'reactant' | 'product' }> {
  const parts: Array<{ type: 'term' | 'operator'; value: string; side: 'reactant' | 'product' }> = [];
  let side: 'reactant' | 'product' = 'reactant';
  for (const rawPart of equation.split(/(⇌|⟶|→|=|\+)/g).filter(Boolean)) {
    const value = rawPart.trim();
    if (!value) continue;
    if (/^(⇌|⟶|→|=|\+)$/.test(value)) {
      parts.push({ type: 'operator', value, side });
      if (/^(⇌|⟶|→|=)$/.test(value)) side = 'product';
      continue;
    }
    parts.push({ type: 'term', value, side });
  }
  return parts;
}

function renderInteractiveFormula(formula: string, onElementHover: (element: string) => void): React.ReactNode[] {
  return formula.split(/([A-Z][a-z]?|[0-9]+)/g).filter(Boolean).map((part, index) => {
    if (/^[A-Z][a-z]?$/.test(part)) {
      return (
        <button
          key={`${part}-${index}`}
          type="button"
          onMouseEnter={() => onElementHover(part)}
          onFocus={() => onElementHover(part)}
          title={part}
          aria-label={part}
          className="rounded px-0.5 text-inherit transition duration-150 hover:scale-125 hover:bg-amber-300/20 hover:text-amber-200 focus-visible:outline-1 focus-visible:outline-amber-300"
        >
          {part}
        </button>
      );
    }
    if (/^\d+$/.test(part)) return <sub key={`${part}-${index}`}>{part}</sub>;
    return <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>;
  });
}

function renderFormulaLabel(formula: string): React.ReactNode[] {
  return formula.split(/(\d+|[₀-₉]+)/g).filter(Boolean).map((part, index) =>
    /^\d+$/.test(part)
      ? <sub key={`${part}-${index}`}>{part}</sub>
      : <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>
  );
}

const fallbackParticles: Record<LabScene, InteractiveLabParticle[]> = {
  atom: [
    { label: 'p+', kind: 'proton', color: '#f59e0b', orbit: 0 },
    { label: 'n', kind: 'neutron', color: '#94a3b8', orbit: 0 },
    { label: 'e-', kind: 'electron', color: '#38bdf8', orbit: 1 },
    { label: 'e-', kind: 'electron', color: '#38bdf8', orbit: 2 },
  ],
  cell: [{ label: 'Κύτταρο', kind: 'cell', color: '#34d399', orbit: 0 }, { label: 'DNA', kind: 'dna', color: '#f472b6', orbit: 1 }],
  dna: [{ label: 'DNA', kind: 'dna', color: '#f472b6', orbit: 0 }, { label: 'Γονίδιο', kind: 'molecule', color: '#38bdf8', orbit: 1 }],
  reaction: [{ label: 'Α', kind: 'reactant', color: '#fb7185', orbit: 1 }, { label: 'Β', kind: 'reactant', color: '#fbbf24', orbit: 1 }, { label: 'Προϊόν', kind: 'product', color: '#34d399', orbit: 2 }],
};

const atomColors: Record<string, string> = {
  C: '#94a3b8',
  H: '#e2e8f0',
  N: '#60a5fa',
  O: '#fb7185',
  S: '#facc15',
  P: '#fb923c',
  K: '#c084fc',
  Mn: '#f472b6',
  Na: '#a3e635',
  Ca: '#22d3ee',
  Fe: '#f97316',
  Cu: '#fb923c',
  Mg: '#4ade80',
  Al: '#cbd5e1',
  Si: '#2dd4bf',
  B: '#f9a8d4',
  Li: '#fda4af',
  Zn: '#818cf8',
  Cr: '#34d399',
  Cl: '#4ade80',
  F: '#2dd4bf',
  Br: '#c084fc',
  I: '#a78bfa',
};

const atomPalette = ['#38bdf8', '#f472b6', '#a3e635', '#fb923c', '#818cf8', '#2dd4bf', '#facc15', '#fb7185'];

function getAtomColor(element: string): string {
  if (atomColors[element]) return atomColors[element];
  const index = Array.from(element).reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return atomPalette[index % atomPalette.length];
}

function MolecularPreview({
  species,
  highlightedElement,
  isActive,
  brokenBonds,
  formedBonds,
}: {
  species: InteractiveLabSpecies;
  highlightedElement?: string | null;
  isActive: boolean;
  brokenBonds: Array<[number, number]>;
  formedBonds: Array<[number, number]>;
}) {
  const { atoms, bonds } = species.structure || { atoms: [], bonds: [] };
  const validAtoms = atoms.filter((atom) =>
    Boolean(atom.element) && Number.isFinite(atom.x) && Number.isFinite(atom.y) && atom.x >= 0 && atom.x <= 100 && atom.y >= 0 && atom.y <= 100
  );
  const isValidStructure = atoms.length > 0 && validAtoms.length === atoms.length && bonds.every((bond) =>
    Number.isInteger(bond.from) && Number.isInteger(bond.to) &&
    bond.from >= 0 && bond.to >= 0 && bond.from < atoms.length && bond.to < atoms.length &&
    bond.from !== bond.to && [1, 2, 3].includes(bond.order ?? 1)
  );
  if (!isValidStructure) {
    return (
      <div role="note" className="mx-auto mt-2 flex h-36 w-full max-w-72 flex-col items-center justify-center px-2 text-center sm:h-44">
        <span className="font-serif text-lg font-semibold text-amber-100 sm:text-xl">{species.name}</span>
        <span className="mt-1 font-mono text-xs text-slate-400">({renderFormulaLabel(species.formula)})</span>
      </div>
    );
  }

  return (
    <svg viewBox="0 0 130 110" role="img" aria-label={`${species.name} ${species.formula} molecular structure`} className="mx-auto mt-2 h-36 w-full max-w-72 overflow-visible sm:h-44">
      {bonds.map((bond, index) => {
        const from = atoms[bond.from];
        const to = atoms[bond.to];
        const fromX = 15 + from.x;
        const fromY = 10 + from.y * 0.85;
        const toX = 15 + to.x;
        const toY = 10 + to.y * 0.85;
        const order = bond.order ?? 1;
        const bondChanged = (pairs: Array<[number, number]>) => pairs.some(([first, second]) =>
          (first === bond.from && second === bond.to) || (first === bond.to && second === bond.from)
        );
        const isBreaking = bondChanged(brokenBonds);
        const isForming = bondChanged(formedBonds);
        return Array.from({ length: order }, (_, lineIndex) => {
          const offset = (lineIndex - (order - 1) / 2) * 3;
          return (
            <line
              key={`${index}-${lineIndex}`}
              x1={fromX + offset}
              y1={fromY}
              x2={toX + offset}
              y2={toY}
              stroke={isBreaking ? '#fb7185' : isForming ? '#34d399' : isActive ? '#fde68a' : '#94a3b8'}
              strokeOpacity={isActive || isBreaking || isForming ? '0.95' : '0.7'}
              strokeWidth={isBreaking || isForming ? '3' : isActive ? '2.5' : '2'}
              strokeLinecap="round"
              strokeDasharray={isBreaking ? '3 3' : isForming ? '6 3' : undefined}
              className={isBreaking ? 'molecule-bond-breaking' : isForming ? 'molecule-bond-forming' : 'transition-all duration-300'}
            />
          );
        });
      })}
      {atoms.map((atom, index) => (
        <g key={`${atom.element}-${index}`}>
          <circle cx={15 + atom.x} cy={10 + atom.y * 0.85} r="16" fill={getAtomColor(atom.element)} opacity={isActive ? '0.14' : '0'} className="transition-opacity duration-300" />
          <circle cx={15 + atom.x} cy={10 + atom.y * 0.85} r={atom.element === highlightedElement ? '14' : '12'} fill={atom.element === highlightedElement ? '#78350f' : '#0f172a'} stroke={atom.element === highlightedElement ? '#fcd34d' : getAtomColor(atom.element)} strokeWidth={atom.element === highlightedElement ? '3' : '2'} className="transition-all duration-200" />
          <text x={15 + atom.x} y={14 + atom.y * 0.85} textAnchor="middle" fill={atom.element === highlightedElement ? '#fef3c7' : getAtomColor(atom.element)} fontSize="10" fontWeight="800">{atom.element}</text>
        </g>
      ))}
    </svg>
  );
}

function drawLab(ctx: CanvasRenderingContext2D, width: number, height: number, spec: InteractiveLabSpec, elapsed: number, zoom: number) {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#07111f';
  ctx.fillRect(0, 0, width, height);
  const centerX = width / 2;
  const centerY = height / 2;
  const scene = spec.scene && spec.scene in fallbackParticles ? spec.scene as LabScene : 'atom';
  const shells = spec.electronShells?.length ? spec.electronShells : null;
  const particles = Array.isArray(spec.particles) && spec.particles.length ? spec.particles : fallbackParticles[scene];
  const maxOrbit = Math.max(1, ...particles.map((particle) => particle.orbit || 0));

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.scale(zoom, zoom);
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
  ctx.lineWidth = 1;
  if (shells) {
    shells.forEach((_, index) => {
      ctx.beginPath();
      ctx.arc(0, 0, 48 + index * 42, 0, Math.PI * 2);
      ctx.stroke();
    });
    const nucleusRadius = 38;
    ctx.fillStyle = '#f59e0b';
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(0, 0, nucleusRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 16px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(spec.element || 'Atom', 0, -4);
    ctx.font = '10px ui-monospace, monospace';
    ctx.fillText(`p+ ${spec.protons ?? '?'}  n ${spec.neutrons ?? '?'}`, 0, 13);
    shells.forEach((count, shellIndex) => {
      const radius = 48 + shellIndex * 42;
      for (let electron = 0; electron < count; electron += 1) {
        const angle = elapsed * 0.001 * (shellIndex + 1) + electron * ((Math.PI * 2) / Math.max(1, count));
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius * 0.72;
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e2e8f0';
        ctx.font = '9px ui-monospace, monospace';
        ctx.fillText('e-', x, y - 8);
      }
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillText(['K', 'L', 'M'][shellIndex] || `S${shellIndex + 1}`, radius, 0);
    });
  }
  for (let orbit = 1; orbit <= maxOrbit; orbit += 1) {
    ctx.beginPath();
    ctx.arc(0, 0, 42 + orbit * 38, 0, Math.PI * 2);
    ctx.stroke();
  }

  particles.forEach((particle, index) => {
    const orbit = particle.orbit || 0;
    const angle = elapsed * (0.0008 + orbit * 0.00025) + index * 2.1;
    const radius = orbit === 0 ? (scene === 'cell' ? 48 : 25) : 42 + orbit * 38;
    const x = orbit === 0 ? (index - (particles.length - 1) / 2) * 26 : Math.cos(angle) * radius;
    const y = orbit === 0 ? Math.sin(index * 1.7) * 12 : Math.sin(angle) * radius * 0.72;
    const size = particle.kind === 'nucleus' || particle.kind === 'cell' ? 30 : 10;
    ctx.fillStyle = particle.color || '#fbbf24';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '11px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(particle.label.slice(0, 14), x, y + size + 15);
  });

  if (spec.bond) {
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-110, 0);
    ctx.lineTo(110, 0);
    ctx.stroke();
    const progress = (Math.sin(elapsed * 0.002) + 1) / 2;
    const electronX = -95 + progress * 190;
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(electronX, -12, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 18px ui-monospace, monospace';
    ctx.fillText(spec.bond.left, -110, -48);
    ctx.fillText(spec.bond.right, 110, -48);
    ctx.font = '11px ui-monospace, monospace';
    ctx.fillText(`${spec.bond.left}+   ${spec.bond.right}-`, 0, 58);
  }

  if (scene === 'dna') {
    ctx.strokeStyle = '#f472b6';
    ctx.lineWidth = 4;
    for (let index = -4; index <= 4; index += 1) {
      const y = index * 18;
      ctx.beginPath();
      ctx.moveTo(-34 + Math.sin(elapsed * 0.001 + index) * 10, y);
      ctx.lineTo(34 + Math.sin(elapsed * 0.001 + index + Math.PI) * 10, y);
      ctx.stroke();
    }
  }
  ctx.restore();
}

export const InteractiveLab: React.FC<InteractiveLabProps> = ({ spec, currentTheme, lang = 'el', isActive = true }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number | null>(null);
  const [analysisExpanded, setAnalysisExpanded] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [hoveredEquationTarget, setHoveredEquationTarget] = useState<EquationHoverTarget | null>(null);
  const elapsedRef = useRef(0);
  const playingRef = useRef(true);
  const speedRef = useRef(1);
  const zoomRef = useRef(1);
  const isReaction = spec.scene === 'reaction';
  useEffect(() => {
    if (!isActive) return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const context = canvas.getContext('2d');
    if (!context) return undefined;
    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      const bounds = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(bounds.width * ratio));
      canvas.height = Math.max(1, Math.floor(bounds.height * ratio));
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    let startedAt = performance.now() - elapsedRef.current;
    const animate = (now: number) => {
      const nextElapsed = playingRef.current
        ? (now - startedAt) * speedRef.current
        : elapsedRef.current;
      elapsedRef.current = nextElapsed;
      drawLab(context, canvas.clientWidth, canvas.clientHeight, spec, nextElapsed, zoomRef.current);
      frameRef.current = requestAnimationFrame(animate);
    };
    frameRef.current = requestAnimationFrame(animate);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      observer.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, [spec, isActive]);

  const zoomMin = spec.zoomMin ?? 0.7;
  const zoomMax = spec.zoomMax ?? 2;
  const reset = () => {
    elapsedRef.current = 0;
    speedRef.current = 1;
    zoomRef.current = 1;
    playingRef.current = true;
    setZoom(1);
    setSpeed(1);
    setPlaying(true);
    setStepIndex(0);
  };
  const nextStep = () => {
    const stepCount = spec.steps?.length || 1;
    setStepIndex((current) => Math.min(stepCount - 1, current + 1));
  };

  const previousStep = () => {
    setStepIndex((current) => Math.max(0, current - 1));
  };
  const steps = spec.steps || [];
  const goToStep = (index: number) => {
    setStepIndex(index);
    playingRef.current = false;
    setPlaying(false);
  };
  const activeStep = steps[stepIndex];
  const stepExplanation = typeof activeStep === 'string' ? activeStep : activeStep?.explanation;
  const focus = typeof activeStep === 'string' ? [] : activeStep?.focus || [];
  const stepEquation = typeof activeStep === 'string' ? undefined : activeStep?.equation;
  const oxidationStateChanges = typeof activeStep === 'string' ? undefined : activeStep?.oxidationStateChanges;
  const molecularChanges = typeof activeStep === 'string' ? [] : activeStep?.molecularChanges || [];
  const focusedSpecies = focus.map((item) => item.toLowerCase());
  const roleGroups = [
    { role: 'reactant', items: spec.species?.filter((item) => item.role === 'reactant') || [] },
    { role: 'intermediate', items: spec.species?.filter((item) => item.role === 'intermediate') || [] },
    { role: 'product', items: spec.species?.filter((item) => item.role === 'product') || [] },
  ].filter((group) => group.items.length > 0);
  const equationToShow = stepEquation || spec.equation;
  const equationTerms = equationToShow ? splitEquation(equationToShow) : [];
  const balancedEquationTerms = spec.equation ? splitEquation(spec.equation) : [];
  const balanceableTermCount = balancedEquationTerms.filter((part) => part.type === 'term' && Number(part.value.match(/^(\d+(?:\.\d+)?)\s+/)?.[1]) > 1).length;
  const revealedCoefficientCount = stepEquation
    ? balanceableTermCount
    : steps.length <= 1
      ? balanceableTermCount
      : Math.floor((stepIndex / (steps.length - 1)) * balanceableTermCount);
  let coefficientRevealIndex = 0;
  const stagedEquationParts = equationTerms.map((part) => {
    if (part.type !== 'term') return { ...part, coefficient: undefined, formula: part.value, showCoefficient: false };
    const match = part.value.match(/^(\d+(?:\.\d+)?)\s*(.+)$/);
    const coefficient = match?.[1];
    const coefficientIndex = coefficient ? coefficientRevealIndex++ : -1;
    return {
      ...part,
      coefficient,
      formula: match?.[2] || part.value,
      showCoefficient: Boolean(coefficient) && (Boolean(stepEquation) || coefficientIndex < revealedCoefficientCount),
    };
  });
  const hoveredFormula = hoveredEquationTarget?.kind === 'coefficient' ? hoveredEquationTarget.value : null;
  const hoveredCoefficient = hoveredEquationTarget?.kind === 'coefficient' ? hoveredEquationTarget.coefficient : null;
  const coefficientAtomCounts = hoveredFormula ? countFormulaAtoms(hoveredFormula) : null;
  const hoveredElement = hoveredEquationTarget?.kind === 'element' ? hoveredEquationTarget.value : null;
  const linkedSpecies = hoveredElement
    ? (spec.species || []).filter((item) => formulaHasElement(item.formula, hoveredElement))
    : hoveredFormula
      ? (spec.species || []).filter((item) => normalizeFormulaText(item.formula) === normalizeFormulaText(hoveredFormula))
      : [];
  const linkedReactants = linkedSpecies.filter((item) => item.role === 'reactant');
  const linkedProducts = linkedSpecies.filter((item) => item.role === 'product');
  const linkedOxidationChange = hoveredElement
    ? oxidationStateChanges?.find((change) => change.element === hoveredElement)
    : undefined;

  useEffect(() => {
    if (isReaction || !playing || !isActive || steps.length < 2) return undefined;
    const timer = window.setInterval(() => {
      setStepIndex((current) => (current + 1) % steps.length);
    }, 3500);
    return () => window.clearInterval(timer);
  }, [isReaction, playing, isActive, steps.length]);

  return (
    <section onMouseLeave={() => setHoveredEquationTarget(null)} className={`my-3 min-w-0 w-full max-w-full rounded-2xl border ${currentTheme.classes.borderPrimary} ${currentTheme.classes.bgCard} p-3 sm:p-4 shadow-2xl`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-amber-400 font-bold">Interactive Lab</p>
          <h3 className="text-base font-bold text-white">{spec.title}</h3>
          {!isReaction && <p className="mt-1 max-w-2xl font-sans text-sm leading-6 text-slate-300">{spec.description}</p>}
        </div>
        {isReaction && steps.length > 0 ? (
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={previousStep} disabled={stepIndex === 0} aria-label={lang === 'el' ? 'Προηγούμενο βήμα' : 'Previous step'} title={lang === 'el' ? 'Προηγούμενο βήμα' : 'Previous step'} className="rounded-lg border border-white/10 p-2 text-slate-300 hover:text-white disabled:opacity-40">
              <ArrowLeft className="size-4" />
            </button>
            <button type="button" onClick={nextStep} disabled={stepIndex >= steps.length - 1} aria-label={lang === 'el' ? 'Επόμενο βήμα' : 'Next step'} title={lang === 'el' ? 'Επόμενο βήμα' : 'Next step'} className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-2 text-amber-100 hover:bg-amber-300/20 disabled:opacity-40">
              <ArrowRight className="size-4" />
            </button>
          </div>
        ) : !isReaction ? (
          <button type="button" onClick={reset} aria-label={lang === 'el' ? 'Επαναφορά' : 'Reset'} className="rounded-lg border border-white/10 p-2 text-slate-300 hover:text-white">
            <RotateCcw className="size-4" />
          </button>
        ) : null}
      </div>
      {spec.equation && (
        <div className="mb-3 rounded-xl border border-cyan-300/25 bg-cyan-950/25 px-3 py-3">
          <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.16em] text-cyan-200">
            {lang === 'el' ? 'Προεπισκόπηση · ισοσταθμισμένη αντίδραση' : 'Preview · balanced reaction'}
          </div>
          <div className="flex flex-wrap items-center gap-y-1 font-mono text-lg font-bold text-white sm:text-xl">
            {balancedEquationTerms.map((part, index) => (
              part.type === 'operator'
                ? <span key={`preview-operator-${index}`} className="px-1.5 text-cyan-200">{part.value}</span>
                : <span key={`preview-term-${index}`} className="inline-flex items-center">
                    {part.value.match(/^(\d+(?:\.\d+)?)\s+/)?.[1] && <span className="mr-1 text-violet-300">{part.value.match(/^(\d+(?:\.\d+)?)\s+/)?.[1]}</span>}
                    <span>{renderInteractiveFormula(part.value.replace(/^\d+(?:\.\d+)?\s+/, ''), (element) => setHoveredEquationTarget({ kind: 'element', value: element }))}</span>
                  </span>
            ))}
          </div>
        </div>
      )}
      {!isReaction && steps.length > 0 && (
        <div className="sticky top-0 z-30 mb-4 rounded-xl border border-amber-400/25 bg-slate-950/95 p-3 shadow-xl backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="rounded-md bg-amber-400/15 px-2 py-1 text-[10px] font-bold text-amber-200">
              {lang === 'el' ? `ΒΗΜΑ ${stepIndex + 1} / ${steps.length}` : `STEP ${stepIndex + 1} / ${steps.length}`}
            </span>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => goToStep(0)} disabled={stepIndex === 0} className="rounded-lg border border-white/10 px-2 py-1.5 text-[10px] text-slate-300 hover:text-white disabled:opacity-40">{lang === 'el' ? '1ο' : 'First'}</button>
              <button type="button" onClick={previousStep} disabled={stepIndex === 0} aria-label={lang === 'el' ? 'Προηγούμενο βήμα' : 'Previous step'} className="rounded-lg border border-white/10 px-2 py-1.5 text-xs text-slate-300 hover:text-white disabled:opacity-40">←</button>
              <button type="button" onClick={() => { playingRef.current = !playingRef.current; setPlaying(playingRef.current); }} aria-label={playing ? 'Pause' : 'Play'} className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-2 py-1.5 text-amber-100">{playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}</button>
              <button type="button" onClick={nextStep} disabled={stepIndex >= steps.length - 1} aria-label={lang === 'el' ? 'Επόμενο βήμα' : 'Next step'} className="rounded-lg border border-amber-300/30 bg-amber-300/10 px-2.5 py-1.5 text-xs font-bold text-amber-100 hover:bg-amber-300/20 disabled:opacity-40">{lang === 'el' ? 'Επόμενο →' : 'Next →'}</button>
            </div>
          </div>
          <div className="mt-2 flex gap-1 overflow-x-auto pb-0.5">
            {steps.map((step, index) => {
              const label = typeof step === 'string' ? step : step.title || `${index + 1}`;
              return <button key={`${index}-${label}`} type="button" onClick={() => goToStep(index)} aria-current={index === stepIndex ? 'step' : undefined} title={label} className={`size-6 shrink-0 rounded-full border text-[9px] font-bold transition ${index === stepIndex ? 'border-amber-300 bg-amber-300 text-slate-950' : index < stepIndex ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200' : 'border-white/10 bg-white/5 text-slate-500 hover:text-white'}`}>{index + 1}</button>;
            })}
          </div>
          {stepExplanation && (
            <div className="mt-2 border-t border-white/10 pt-2">
              <p className="font-sans text-sm leading-6 text-slate-100">{stepExplanation}</p>
              {typeof activeStep !== 'string' && activeStep?.insight && <p className="mt-1 font-sans text-sm leading-6 text-amber-100/90"><strong className="text-amber-300">{lang === 'el' ? 'Κλειδί: ' : 'Key idea: '}</strong>{activeStep.insight}</p>}
            </div>
          )}
        </div>
      )}
      {equationToShow && (
        <div className="relative mb-4 overflow-hidden rounded-2xl border border-sky-400/25 bg-[radial-gradient(ellipse_at_top,rgba(14,116,144,0.2),rgba(2,6,23,0.95)_70%)] px-4 py-5 text-center sm:px-6">
          <div className="absolute inset-x-8 top-0 h-px bg-linear-to-r from-transparent via-sky-300/70 to-transparent" />
          <div className="mb-2 flex flex-wrap items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest text-sky-300">
            <span>{lang === 'el' ? 'Ισοστάθμιση βήμα-βήμα' : 'Step-by-step balancing'}</span>
            {spec.reactionType && <span className="rounded-full border border-sky-300/20 bg-sky-300/10 px-2 py-0.5 normal-case tracking-normal text-sky-100">{spec.reactionType}</span>}
          </div>
          {stepEquation && <style>{'@keyframes equation-step-in { 0% { opacity: 0; transform: translateY(4px); } 100% { opacity: 1; transform: translateY(0); } }'}</style>}
          <style>{'@keyframes coefficient-pop { 0% { opacity: 0; transform: translateY(6px) scale(.75); } 70% { transform: translateY(-2px) scale(1.16); } 100% { opacity: 1; transform: translateY(0) scale(1); } }'}</style>
          <div key={`${equationToShow}-${stepIndex}`} className="flex flex-wrap items-center justify-center gap-y-1 font-mono text-xl font-bold tracking-wide text-white sm:text-2xl" style={stepEquation ? { animation: 'equation-step-in 320ms ease-out' } : undefined}>
            {stagedEquationParts.map((part, index) => {
              if (part.type === 'operator') {
                return <span key={`operator-${index}`} className="px-1.5 text-sky-200">{part.value}</span>;
              }
              const { coefficient, formula, showCoefficient } = part;
              const isRelevant = hoveredElement
                ? formulaHasElement(formula, hoveredElement)
                : hoveredFormula
                  ? normalizeFormulaText(formula) === normalizeFormulaText(hoveredFormula)
                  : true;
              return (
                <span key={`term-${index}`} className={`inline-flex items-center rounded-lg px-1 transition-all duration-200 ${hoveredEquationTarget && !isRelevant ? 'opacity-30' : ''} ${hoveredEquationTarget && isRelevant ? 'scale-110 bg-amber-300/10 text-amber-100 shadow-[0_0_18px_rgba(251,191,36,0.15)]' : ''}`}>
                  {showCoefficient && coefficient && (
                    <button
                      type="button"
                      onMouseEnter={() => setHoveredEquationTarget({ kind: 'coefficient', value: formula, coefficient })}
                      onFocus={() => setHoveredEquationTarget({ kind: 'coefficient', value: formula, coefficient })}
                      title={lang === 'el' ? `Συντελεστής ${coefficient} · δείξε τη μονάδα τύπου` : `Coefficient ${coefficient} · highlight this formula unit`}
                      aria-label={lang === 'el' ? `Συντελεστής ${coefficient} για ${formula}` : `Coefficient ${coefficient} for ${formula}`}
                      className="mr-1 rounded px-1 text-violet-300 transition hover:scale-125 hover:bg-violet-300/20 hover:text-violet-100 focus-visible:outline-1 focus-visible:outline-violet-300"
                      style={{ animation: 'coefficient-pop 420ms ease-out' }}
                    >
                      {coefficient}
                    </button>
                  )}
                  {renderInteractiveFormula(formula, (element) => setHoveredEquationTarget({ kind: 'element', value: element }))}
                </span>
              );
            })}
          </div>
        </div>
      )}
      {oxidationStateChanges && oxidationStateChanges.length > 0 && (
        <div className="mb-4 grid gap-2 sm:grid-cols-2" aria-label={lang === 'el' ? 'Μεταβολές αριθμών οξείδωσης' : 'Oxidation-state changes'}>
          <style>{'@keyframes equation-step-in { 0% { opacity: 0; transform: translateY(4px); } 100% { opacity: 1; transform: translateY(0); } }'}</style>
          {oxidationStateChanges.map((change, index) => {
            const isReduction = change.direction === 'reduction';
            const colorClass = isReduction ? 'border-violet-300/30 bg-violet-400/10 text-violet-100' : 'border-fuchsia-300/30 bg-fuchsia-400/10 text-fuchsia-100';
            return (
              <div key={`${change.element}-${index}`} className={`rounded-xl border p-3 transition-colors duration-300 ${colorClass}`}>
                <div className="text-[9px] font-bold uppercase tracking-wider opacity-70">{isReduction ? (lang === 'el' ? 'Αναγωγή' : 'Reduction') : (lang === 'el' ? 'Οξείδωση' : 'Oxidation')}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-sm font-bold">
                  <span>{change.element} {change.from > 0 ? `+${change.from}` : change.from}</span>
                  <span aria-hidden="true">→</span>
                  <span key={`${change.element}-${change.to}`} className="inline-block" style={{ animation: 'equation-step-in 320ms ease-out' }}>{change.element} {change.to > 0 ? `+${change.to}` : change.to}</span>
                </div>
                {Number.isFinite(change.electrons) && (change.electrons ?? 0) > 0 && (
                  <div className="mt-1 text-[10px] opacity-80">{change.electrons} e⁻ {isReduction ? (lang === 'el' ? 'προσλαμβάνονται' : 'gained') : (lang === 'el' ? 'αποβάλλονται' : 'lost')}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {roleGroups.length > 0 && (
        <div className="relative mb-4 overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(145deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))] p-4 pb-10 sm:p-5 sm:pb-11">
          <style>{'@keyframes molecule-bond-break { 0%,100% { stroke-dashoffset: 0; opacity: 1; } 50% { stroke-dashoffset: 12; opacity: .35; } } @keyframes molecule-bond-form { 0% { stroke-dashoffset: 18; opacity: .25; } 100% { stroke-dashoffset: 0; opacity: 1; } } @keyframes molecule-transfer { 0% { transform: translateX(-10px); opacity: .25; } 50% { opacity: 1; } 100% { transform: translateX(10px); opacity: .25; } } .molecule-bond-breaking { animation: molecule-bond-break 1.2s ease-in-out infinite; } .molecule-bond-forming { animation: molecule-bond-form 1.2s ease-out infinite; } .molecule-transfer-dot { animation: molecule-transfer 1.1s ease-in-out infinite; }'}</style>
          <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{lang === 'el' ? 'Πορεία αντίδρασης' : 'Reaction pathway'}</div>
          <div className={`grid gap-3 sm:items-stretch ${roleGroups.length > 2 ? 'sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)]' : 'sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]'}`}>
            {roleGroups.map((group, groupIndex) => (
              <React.Fragment key={group.role}>
                {groupIndex > 0 && (
                  <div className={`relative hidden items-center justify-center text-xl sm:flex ${molecularChanges.length ? 'text-emerald-200' : 'text-slate-500'}`}>
                    {group.role === 'product' ? '→' : '⇌'}
                    {molecularChanges.length > 0 && <span className="molecule-transfer-dot absolute size-1.5 rounded-full bg-amber-200 shadow-[0_0_8px_rgba(253,230,138,0.9)]" />}
                  </div>
                )}
                <div className="min-w-0 rounded-xl border border-white/5 bg-black/20 p-2.5">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">{group.role === 'reactant' ? (lang === 'el' ? 'Αντιδρώντα' : 'Reactants') : group.role === 'intermediate' ? (lang === 'el' ? 'Ενδιάμεσα' : 'Intermediates') : (lang === 'el' ? 'Προϊόντα' : 'Products')}</span>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-3">
                    {group.items.map((item, itemIndex) => {
                      const changesSpecies = molecularChanges.some((change) =>
                        [change.fromSpecies, change.toSpecies].some((formula) =>
                          formula && normalizeFormulaText(formula) === normalizeFormulaText(item.formula)
                        )
                      );
                      const highlighted = hoveredEquationTarget
                        ? linkedSpecies.some((linked) => linked.formula === item.formula && linked.role === item.role)
                        : focusedSpecies.length === 0
                          ? molecularChanges.length === 0 || changesSpecies
                          : focusedSpecies.some((term) => `${item.formula} ${item.name}`.toLowerCase().includes(term)) || changesSpecies;
                      const brokenBonds = molecularChanges
                        .filter((change) => change.action === 'break' && normalizeFormulaText(change.fromSpecies) === normalizeFormulaText(item.formula) && change.fromBond)
                        .map((change) => change.fromBond as [number, number]);
                      const formedBonds = molecularChanges
                        .filter((change) => change.action === 'form' && normalizeFormulaText(change.toSpecies || '') === normalizeFormulaText(item.formula) && change.toBond)
                        .map((change) => change.toBond as [number, number]);
                      return (
                        <div key={`${item.role}-${item.formula}-${item.name}`} className={`relative min-w-24 flex-1 overflow-hidden rounded-xl border px-1 py-1 text-center transition-all duration-300 ${highlighted ? 'scale-[1.02] border-amber-300/60 bg-amber-400/10 text-amber-100 shadow-[0_0_24px_rgba(251,191,36,0.16)]' : 'border-white/5 bg-white/2 text-slate-500 opacity-30'}`}>
                          <MolecularPreview species={item} highlightedElement={hoveredElement} isActive={highlighted} brokenBonds={brokenBonds} formedBonds={formedBonds} />
                          {item.structure?.atoms.length ? <div className="mt-1 font-mono text-xs text-slate-300">({renderFormulaLabel(item.formula)})</div> : null}
                        </div>
                      );
                    }).flatMap((item, index) => index < group.items.length - 1 ? [item, <span key={`plus-${group.role}-${index}`} aria-hidden="true" className="text-lg font-semibold text-cyan-200">+</span>] : [item])}
                  </div>
                </div>
              </React.Fragment>
            ))}
          </div>
          {steps.length > 0 && <span className="absolute bottom-3 right-4 text-[10px] text-slate-500">{lang === 'el' ? `Βήμα ${stepIndex + 1} από ${steps.length}` : `Step ${stepIndex + 1} of ${steps.length}`}</span>}
        </div>
      )}
      {steps.length > 0 && (
        <div className="mb-4">
          <button type="button" onClick={() => setAnalysisExpanded((expanded) => !expanded)} aria-expanded={analysisExpanded} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-400 transition hover:border-amber-300/30 hover:text-amber-100">
            {analysisExpanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            {lang === 'el' ? 'Περισσότερη ανάλυση' : 'More analysis'}
          </button>
          {analysisExpanded && (
            <div className="mt-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs leading-relaxed text-slate-300">
              {stepExplanation && <p>{stepExplanation}</p>}
              {typeof activeStep !== 'string' && activeStep?.insight && <p className="mt-1 text-amber-100/90"><strong className="text-amber-300">{lang === 'el' ? 'Κλειδί: ' : 'Key idea: '}</strong>{activeStep.insight}</p>}
              {hoveredEquationTarget?.kind === 'element' && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <strong className="text-amber-200">{hoveredElement}</strong>
                  <span>{linkedReactants.length ? linkedReactants.map((item) => item.formula).join(' + ') : '—'}</span>
                  <span aria-hidden="true" className="text-amber-300">→</span>
                  <span>{linkedProducts.length ? linkedProducts.map((item) => item.formula).join(' + ') : '—'}</span>
                  {linkedOxidationChange && <span className="text-violet-200">{linkedOxidationChange.from > 0 ? '+' : ''}{linkedOxidationChange.from} → {linkedOxidationChange.to > 0 ? '+' : ''}{linkedOxidationChange.to}</span>}
                </div>
              )}
              {hoveredEquationTarget?.kind === 'coefficient' && (
                <p className="mt-2">
                  {lang === 'el' ? `Ο συντελεστής ${hoveredCoefficient} πολλαπλασιάζει ολόκληρο το ${hoveredFormula}· δεν αλλάζουν οι δείκτες του τύπου.` : `Coefficient ${hoveredCoefficient} multiplies the whole ${hoveredFormula}; the formula subscripts do not change.`}
                  {coefficientAtomCounts && <span className="ml-2 font-mono text-amber-100">{hoveredCoefficient} × ({coefficientAtomCounts})</span>}
                </p>
              )}
              {spec.conditions?.length ? <p className="mt-2 text-slate-400">{spec.conditions.join(' · ')}</p> : null}
              {spec.conservationNote && <p className="mt-2 text-slate-400">{spec.conservationNote}</p>}
            </div>
          )}
        </div>
      )}
      {spec.scene !== 'reaction' && (
        <canvas ref={canvasRef} className="w-full h-64 sm:h-80 rounded-xl border border-white/10" aria-label={spec.title} />
      )}
      {!isReaction && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => { playingRef.current = !playingRef.current; setPlaying(playingRef.current); }} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/20 px-3 py-2 text-xs text-amber-200">
            {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}{playing ? 'Pause' : 'Play'}
          </button>
          {steps.length > 0 && <span className="ml-auto text-[11px] font-bold text-amber-200">{lang === 'el' ? `Βήμα ${stepIndex + 1} / ${steps.length}` : `Step ${stepIndex + 1} / ${steps.length}`}</span>}
          <button type="button" onClick={() => { zoomRef.current = Math.max(zoomMin, zoomRef.current - 0.1); setZoom(zoomRef.current); }} className="rounded-lg border border-white/10 p-2 text-slate-300" aria-label="Zoom out"><ZoomOut className="size-4" /></button>
          <button type="button" onClick={() => { zoomRef.current = Math.min(zoomMax, zoomRef.current + 0.1); setZoom(zoomRef.current); }} className="rounded-lg border border-white/10 p-2 text-slate-300" aria-label="Zoom in"><ZoomIn className="size-4" /></button>
          <label className="flex items-center gap-2 text-xs text-slate-400">
            Speed
            <input type="range" min="0.25" max="2" step="0.25" value={speed} onChange={(event) => { speedRef.current = Number(event.target.value); setSpeed(speedRef.current); }} />
            <span className="w-8 text-amber-300">{speed}x</span>
          </label>
        </div>
      )}
      {spec.safetyNote && <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-950/15 px-3 py-2 text-[10px] leading-relaxed text-amber-100/80"><strong className="mr-1 text-amber-200">{lang === 'el' ? 'Σημείωση ασφάλειας:' : 'Safety note:'}</strong>{spec.safetyNote}</div>}
    </section>
  );
};