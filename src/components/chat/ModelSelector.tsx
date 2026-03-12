'use client';

import React, { useState, useCallback } from 'react';
import { useKyroStore } from '@/store/kyroStore';
import { ChevronDown, Cpu, Cloud, Zap } from 'lucide-react';

interface ModelOption {
  id: string;
  name: string;
  provider: 'ollama' | 'embedded' | 'cloud';
  description: string;
}

export function ModelSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const { models, selectedModel, setSelectedModel, localModels, selectedLocalModel, setSelectedLocalModel, isOllamaRunning } = useKyroStore();

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'embedded': return <Cpu size={12} className="text-[#a371f7]" />;
      case 'cloud': return <Cloud size={12} className="text-[#58a6ff]" />;
      default: return <Zap size={12} className="text-[#3fb950]" />;
    }
  };

  // Build unified model list
  const allModels: ModelOption[] = [
    // Ollama models
    ...models.map(m => ({
      id: m.name,
      name: m.name,
      provider: 'ollama' as const,
      description: `Ollama · ${m.size}`,
    })),
    // Embedded local models
    ...localModels.filter(m => m.downloaded).map(m => ({
      id: `embedded:${m.name}`,
      name: m.name,
      provider: 'embedded' as const,
      description: `Embedded · ${m.quantization} · ${Math.round(m.size_mb / 1024 * 10) / 10}GB`,
    })),
  ];

  const currentModel = allModels.find(m =>
    m.id === selectedModel || m.id === `embedded:${selectedLocalModel}`
  ) || { id: selectedModel, name: selectedModel || 'No model', provider: 'ollama', description: '' };

  const handleSelect = useCallback((model: ModelOption) => {
    if (model.provider === 'embedded') {
      setSelectedLocalModel(model.name);
    } else {
      setSelectedModel(model.id);
    }
    setIsOpen(false);
  }, [setSelectedModel, setSelectedLocalModel]);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2 py-1 rounded text-xs bg-[#161b22] border border-[#30363d] hover:border-[#58a6ff] text-[#8b949e] hover:text-[#c9d1d9] transition-colors"
      >
        {getProviderIcon(currentModel.provider)}
        <span className="max-w-30 truncate">{currentModel.name}</span>
        <ChevronDown size={10} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute bottom-full right-0 mb-1 w-72 bg-[#1c2128] border border-[#30363d] rounded-lg shadow-xl z-50 overflow-hidden">
            {/* Ollama section */}
            {models.length > 0 && (
              <div>
                <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-[#8b949e] bg-[#161b22] flex items-center gap-1.5">
                  <Zap size={10} /> Ollama {!isOllamaRunning && <span className="text-[#f85149]">(offline)</span>}
                </div>
                {models.map(m => (
                  <button
                    key={m.name}
                    onClick={() => handleSelect({ id: m.name, name: m.name, provider: 'ollama', description: m.size })}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                      selectedModel === m.name ? 'bg-[#388bfd26] text-[#c9d1d9]' : 'text-[#8b949e] hover:bg-[#21262d]'
                    }`}
                  >
                    <Zap size={12} className="text-[#3fb950]" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{m.name}</div>
                      <div className="text-[10px] opacity-60">{m.size}</div>
                    </div>
                    {selectedModel === m.name && <div className="w-2 h-2 rounded-full bg-[#58a6ff]" />}
                  </button>
                ))}
              </div>
            )}

            {/* Embedded section */}
            {localModels.filter(m => m.downloaded).length > 0 && (
              <div>
                <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-[#8b949e] bg-[#161b22] flex items-center gap-1.5">
                  <Cpu size={10} /> Embedded (Local)
                </div>
                {localModels.filter(m => m.downloaded).map(m => (
                  <button
                    key={m.name}
                    onClick={() => handleSelect({ id: `embedded:${m.name}`, name: m.name, provider: 'embedded', description: m.quantization })}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                      selectedLocalModel === m.name ? 'bg-[#388bfd26] text-[#c9d1d9]' : 'text-[#8b949e] hover:bg-[#21262d]'
                    }`}
                  >
                    <Cpu size={12} className="text-[#a371f7]" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{m.name}</div>
                      <div className="text-[10px] opacity-60">{m.quantization} · {Math.round(m.size_mb / 1024 * 10) / 10}GB</div>
                    </div>
                    {selectedLocalModel === m.name && <div className="w-2 h-2 rounded-full bg-[#a371f7]" />}
                  </button>
                ))}
              </div>
            )}

            {allModels.length === 0 && (
              <div className="px-3 py-4 text-center text-xs text-[#8b949e]">
                <p>No models available</p>
                <p className="mt-1 text-[10px]">Run <code className="bg-[#21262d] px-1 rounded">ollama pull codellama:7b</code></p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
