import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

interface MermaidDiagramProps {
  code: string;
}

let mermaidReady = false;

export const MermaidDiagram: React.FC<MermaidDiagramProps> = ({ code }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const render = async () => {
      if (!containerRef.current) return;
      if (!mermaidReady) {
        mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'dark' });
        mermaidReady = true;
      }
      try {
        const id = `diagram-${Math.random().toString(36).slice(2)}`;
        const result = await mermaid.render(id, code.trim());
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = result.svg;
          result.bindFunctions?.(containerRef.current);
          setError(false);
        }
      } catch {
        if (!cancelled) setError(true);
      }
    };
    render();
    return () => { cancelled = true; };
  }, [code]);

  return error ? <pre className="whitespace-pre-wrap text-xs text-rose-300">{code}</pre> : <div ref={containerRef} className="my-3 overflow-x-auto rounded-xl border border-white/10 bg-black/20 p-3" />;
};
