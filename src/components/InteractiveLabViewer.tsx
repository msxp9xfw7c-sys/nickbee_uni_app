import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { AppTheme } from '../types';
import { InteractiveLab, InteractiveLabSpec, InteractiveLabSpecies, InteractiveLabStep } from './InteractiveLab';

interface InteractiveLabViewerProps {
  rawJson: string;
  currentTheme: AppTheme;
  lang: 'el' | 'en';
  onRetry?: () => void;
  isActive?: boolean;
}

function normalizeLabSteps(value: unknown): InteractiveLabSpec['steps'] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((step): Array<string | InteractiveLabStep> => {
    if (typeof step === 'string') return [step];
    if (!step || typeof step !== 'object' || Array.isArray(step)) return [];
    const record = step as Record<string, unknown>;
    if (typeof record.explanation !== 'string') return [];
    const oxidationStateChanges = Array.isArray(record.oxidationStateChanges)
      ? record.oxidationStateChanges.flatMap((change) => {
        if (!change || typeof change !== 'object' || Array.isArray(change)) return [];
        const item = change as Record<string, unknown>;
        const direction = item.direction;
        if (
          typeof item.element !== 'string' ||
          !Number.isFinite(item.from) ||
          !Number.isFinite(item.to) ||
          (direction !== 'oxidation' && direction !== 'reduction')
        ) return [];
        return [{
          element: item.element,
          from: item.from as number,
          to: item.to as number,
          direction: direction as 'oxidation' | 'reduction',
          ...(Number.isFinite(item.electrons) ? { electrons: item.electrons as number } : {}),
        }];
      })
      : undefined;
    const molecularChanges = Array.isArray(record.molecularChanges)
      ? record.molecularChanges.flatMap((change) => {
        if (!change || typeof change !== 'object' || Array.isArray(change)) return [];
        const item = change as Record<string, unknown>;
        const action = item.action;
        if (typeof item.fromSpecies !== 'string') return [];
        let normalizedAction: 'break' | 'form' | 'transfer';
        if (action === 'break') normalizedAction = 'break';
        else if (action === 'form') normalizedAction = 'form';
        else if (action === 'transfer') normalizedAction = 'transfer';
        else return [];
        const normalizeBond = (bond: unknown): [number, number] | undefined =>
          Array.isArray(bond) && bond.length === 2 &&
          Number.isInteger(bond[0]) && Number.isInteger(bond[1]) &&
          Number(bond[0]) >= 0 && Number(bond[1]) >= 0
            ? [Number(bond[0]), Number(bond[1])]
            : undefined;
        const fromBond = normalizeBond(item.fromBond);
        const toBond = normalizeBond(item.toBond);
        return [{
          action: normalizedAction,
          fromSpecies: item.fromSpecies,
          ...(typeof item.toSpecies === 'string' ? { toSpecies: item.toSpecies } : {}),
          ...(typeof item.element === 'string' ? { element: item.element } : {}),
          ...(fromBond ? { fromBond } : {}),
          ...(toBond ? { toBond } : {}),
        }];
      })
      : undefined;
    return [{
      ...(typeof record.title === 'string' ? { title: record.title } : {}),
      explanation: record.explanation,
      ...(Array.isArray(record.focus) ? { focus: record.focus.filter((entry): entry is string => typeof entry === 'string') } : {}),
      ...(typeof record.insight === 'string' ? { insight: record.insight } : {}),
      ...(typeof record.equation === 'string' ? { equation: record.equation } : {}),
      ...(oxidationStateChanges?.length ? { oxidationStateChanges } : {}),
      ...(molecularChanges?.length ? { molecularChanges } : {}),
    }];
  });
}

function normalizeLabSpecies(value: unknown): InteractiveLabSpecies[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const item = entry as Record<string, unknown>;
    if (
      typeof item.formula !== 'string' ||
      typeof item.name !== 'string' ||
      (item.role !== 'reactant' && item.role !== 'intermediate' && item.role !== 'product')
    ) return [];
    const structure = item.structure && typeof item.structure === 'object' && !Array.isArray(item.structure)
      ? item.structure as Record<string, unknown>
      : null;
    const rawAtoms = structure && Array.isArray(structure.atoms) ? structure.atoms : [];
    const atoms = rawAtoms.flatMap((atom) => {
      if (!atom || typeof atom !== 'object' || Array.isArray(atom)) return [];
      const candidate = atom as Record<string, unknown>;
      if (
        typeof candidate.element !== 'string' ||
        typeof candidate.x !== 'number' || !Number.isFinite(candidate.x) || candidate.x < 0 || candidate.x > 100 ||
        typeof candidate.y !== 'number' || !Number.isFinite(candidate.y) || candidate.y < 0 || candidate.y > 100
      ) return [];
      return [{ element: candidate.element, x: candidate.x, y: candidate.y }];
    });
    const rawBonds = structure && Array.isArray(structure.bonds) ? structure.bonds : [];
    const bonds = rawBonds.flatMap((bond) => {
      if (!bond || typeof bond !== 'object' || Array.isArray(bond)) return [];
      const candidate = bond as Record<string, unknown>;
      const order = candidate.order ?? 1;
      if (
        !Number.isInteger(candidate.from) || !Number.isInteger(candidate.to) ||
        Number(candidate.from) < 0 || Number(candidate.to) < 0 ||
        Number(candidate.from) >= atoms.length || Number(candidate.to) >= atoms.length ||
        candidate.from === candidate.to || (order !== 1 && order !== 2 && order !== 3)
      ) return [];
      return [{ from: Number(candidate.from), to: Number(candidate.to), order: order as 1 | 2 | 3 }];
    });
    return [{
      formula: item.formula,
      name: item.name,
      role: item.role,
      ...(atoms.length ? { structure: { atoms, bonds } } : {}),
    }];
  });
}

export const InteractiveLabViewer: React.FC<InteractiveLabViewerProps> = ({ rawJson, currentTheme, lang, onRetry, isActive = true }) => {
  try {
    const parsed = JSON.parse(rawJson) as Partial<InteractiveLabSpec>;
    if (!parsed.title || !parsed.description) throw new Error('Missing lab title or description');
    return <InteractiveLab spec={{ ...parsed, particles: Array.isArray(parsed.particles) ? parsed.particles : [], species: normalizeLabSpecies(parsed.species), steps: normalizeLabSteps(parsed.steps) } as InteractiveLabSpec} currentTheme={currentTheme} lang={lang} isActive={isActive} />;
  } catch {
    return <div className={`my-4 rounded-xl border border-rose-500/40 bg-rose-950/30 p-4 text-xs text-rose-200`}><AlertTriangle className="mb-2 h-4 w-4 text-rose-400" /><p>{lang === 'el' ? 'Το Interactive Lab δεν μπόρεσε να διαβάσει τα δεδομένα animation.' : 'Interactive Lab data could not be parsed.'}</p>{onRetry && <button type="button" onClick={onRetry} className="mt-3 rounded-lg border border-rose-400/40 px-3 py-1.5 text-rose-100 hover:bg-rose-500/20 cursor-pointer">{lang === 'el' ? 'Επαναπροσπάθεια' : 'Retry'}</button>}</div>;
  }
};