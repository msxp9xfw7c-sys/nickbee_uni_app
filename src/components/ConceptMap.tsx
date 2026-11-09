import React, { useState } from 'react';
import { ChevronRight, Link2, Network } from 'lucide-react';
import { AppTheme, ConceptMap as ConceptMapData, ConceptMapNode } from '../types';
import MarkdownContent from '../lib/MarkdownContent';

interface ConceptMapProps {
  map: ConceptMapData;
  currentTheme: AppTheme;
  lang: 'el' | 'en';
}

export const ConceptMap: React.FC<ConceptMapProps> = ({ map, currentTheme, lang }) => {
  const [selectedId, setSelectedId] = useState(map.rootNode.id);
  const selected = map.allNodes[selectedId] || map.rootNode;

  const renderNode = (node: ConceptMapNode, depth = 0): React.ReactNode => (
    <div key={`${node.id}-${depth}`} className={depth > 0 ? 'ml-4 border-l border-amber-500/20 pl-3' : ''}>
      <button
        onClick={() => setSelectedId(node.id)}
        className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-colors cursor-pointer ${selectedId === node.id ? 'border-amber-400/70 bg-amber-500/15 text-amber-200' : 'border-white/10 bg-black/20 text-slate-300 hover:border-amber-500/40'}`}
      >
        <ChevronRight className="w-3.5 h-3.5 shrink-0 text-amber-400" />
        <span>{node.label}</span>
      </button>
      {node.children.map((childId) => map.allNodes[childId] && renderNode(map.allNodes[childId], depth + 1))}
    </div>
  );

  return (
    <div className={`my-4 rounded-2xl border ${currentTheme.classes.borderPrimary} ${currentTheme.classes.bgCard} p-4 sm:p-6 font-mono shadow-2xl`}>
      <div className="flex items-center gap-2 border-b border-white/10 pb-4">
        <Network className="w-5 h-5 text-amber-400" />
        <div>
          <h4 className="text-sm sm:text-base font-bold text-white">{map.title}</h4>
          <p className="text-[11px] text-slate-400">{lang === 'el' ? 'Διαδραστικός χάρτης εννοιών' : 'Interactive concept map'}</p>
        </div>
      </div>
      <div className="grid xl:grid-cols-[minmax(0,1fr)_minmax(220px,0.8fr)] gap-4 mt-4">
        <div className="space-y-2">{renderNode(map.rootNode)}</div>
        <div className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-3">
          <div className="flex items-center gap-2 text-amber-300 text-xs font-bold"><Link2 className="w-3.5 h-3.5" />{selected.label}</div>
          {selected.description && <div className="text-xs text-slate-300 markdown-body"><MarkdownContent>{selected.description}</MarkdownContent></div>}
          {selected.examples?.length ? <div><div className="text-[10px] uppercase text-slate-500 mb-1">{lang === 'el' ? 'Παραδείγματα' : 'Examples'}</div><ul className="text-xs text-slate-300 list-disc pl-4">{selected.examples.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
          {selected.formulas?.length ? <div className="text-xs text-emerald-300">{selected.formulas.join(' · ')}</div> : null}
          {map.links.filter((link) => link.from === selected.id || link.to === selected.id).map((link) => <div key={`${link.from}-${link.to}-${link.relationship}`} className="text-[11px] text-slate-400">{link.from === selected.id ? '→' : '←'} {link.relationship} {map.allNodes[link.from === selected.id ? link.to : link.from]?.label}</div>)}
        </div>
      </div>
    </div>
  );
};
