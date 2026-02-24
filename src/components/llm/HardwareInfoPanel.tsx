'use client';

import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useKyroStore, HardwareInfo, LocalModelInfo } from '@/store/kyroStore';
import { 
  Cpu, 
  HardDrive, 
  Zap, 
  MemoryStick, 
  Download, 
  CheckCircle, 
  XCircle,
  Loader2,
  RefreshCw
} from 'lucide-react';

export function HardwareInfoPanel() {
  const { 
    hardwareInfo, 
    setHardwareInfo, 
    localModels, 
    setLocalModels,
    isEmbeddedLLMReady,
    setEmbeddedLLMReady,
    isEmbeddedLLMLoading,
    setEmbeddedLLMLoading,
    selectedLocalModel,
    setSelectedLocalModel
  } = useKyroStore();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadHardwareInfo();
  }, []);

  const loadHardwareInfo = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const hw = await invoke<HardwareInfo>('get_hardware_info');
      setHardwareInfo(hw);
      
      const models = await invoke<LocalModelInfo[]>('list_local_models');
      setLocalModels(models);
      
      const ready = await invoke<boolean>('is_embedded_llm_ready');
      setEmbeddedLLMReady(ready);
    } catch (e) {
      setError(String(e));
    } finally {
      setIsLoading(false);
    }
  };

  const initEmbeddedLLM = async () => {
    setEmbeddedLLMLoading(true);
    setError(null);
    try {
      const result = await invoke<string>('init_embedded_llm', { 
        modelName: selectedLocalModel || null 
      });
      console.log(result);
      setEmbeddedLLMReady(true);
      loadHardwareInfo();
    } catch (e) {
      setError(String(e));
    } finally {
      setEmbeddedLLMLoading(false);
    }
  };

  const loadModel = async (modelName: string) => {
    setEmbeddedLLMLoading(true);
    setError(null);
    try {
      const result = await invoke<string>('load_model', { modelName });
      console.log(result);
      loadHardwareInfo();
    } catch (e) {
      setError(String(e));
    } finally {
      setEmbeddedLLMLoading(false);
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'Cpu': return 'text-gray-400';
      case 'Low4GB': return 'text-yellow-400';
      case 'Medium8GB': return 'text-blue-400';
      case 'High16GB': return 'text-green-400';
      case 'Ultra32GB': return 'text-purple-400';
      default: return 'text-gray-400';
    }
  };

  const getBackendIcon = (backend: string) => {
    switch (backend) {
      case 'cuda': return '🟢';
      case 'metal': return '🍎';
      case 'vulkan': return '🔵';
      default: return '⚪';
    }
  };

  if (isLoading && !hardwareInfo) {
    return (
      <div className="p-4 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
        <span className="ml-2 text-gray-400">Detecting hardware...</span>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 bg-[#1e1e1e] rounded-lg">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Cpu className="w-5 h-5" />
          Hardware Detection
        </h3>
        <button 
          onClick={loadHardwareInfo}
          className="p-1 hover:bg-gray-700 rounded"
          disabled={isLoading}
        >
          <RefreshCw className={`w-4 h-4 text-gray-400 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="p-2 bg-red-900/30 border border-red-700 rounded text-red-400 text-sm">
          {error}
        </div>
      )}

      {hardwareInfo && (
        <div className="grid grid-cols-2 gap-3">
          {/* GPU Info */}
          <div className="bg-[#252526] p-3 rounded">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
              <Zap className="w-3 h-3" />
              GPU
            </div>
            <div className="text-white font-medium">
              {hardwareInfo.gpu_name || 'CPU Only'}
            </div>
          </div>

          {/* VRAM */}
          <div className="bg-[#252526] p-3 rounded">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
              <MemoryStick className="w-3 h-3" />
              VRAM
            </div>
            <div className="text-white font-medium">
              {hardwareInfo.vram_gb.toFixed(1)} GB
            </div>
          </div>

          {/* RAM */}
          <div className="bg-[#252526] p-3 rounded">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
              <HardDrive className="w-3 h-3" />
              RAM
            </div>
            <div className="text-white font-medium">
              {hardwareInfo.ram_gb.toFixed(1)} GB
            </div>
          </div>

          {/* Memory Tier */}
          <div className="bg-[#252526] p-3 rounded">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
              Tier
            </div>
            <div className={`font-medium ${getTierColor(hardwareInfo.memory_tier)}`}>
              {hardwareInfo.memory_tier}
            </div>
          </div>

          {/* Backend */}
          <div className="bg-[#252526] p-3 rounded col-span-2">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
              Backend
            </div>
            <div className="flex items-center gap-2">
              <span>{getBackendIcon(hardwareInfo.backend)}</span>
              <span className="text-white font-medium capitalize">
                {hardwareInfo.backend}
              </span>
            </div>
          </div>

          {/* Recommended Model */}
          <div className="bg-[#252526] p-3 rounded col-span-2">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
              Recommended Model
            </div>
            <div className="text-blue-400 font-mono text-sm">
              {hardwareInfo.recommended_model}
            </div>
          </div>
        </div>
      )}

      {/* LLM Status */}
      <div className="border-t border-gray-700 pt-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-white font-medium">Embedded LLM</h4>
          <div className="flex items-center gap-2">
            {isEmbeddedLLMReady ? (
              <span className="flex items-center gap-1 text-green-400 text-sm">
                <CheckCircle className="w-4 h-4" />
                Ready
              </span>
            ) : (
              <span className="flex items-center gap-1 text-gray-400 text-sm">
                <XCircle className="w-4 h-4" />
                Not initialized
              </span>
            )}
          </div>
        </div>

        {/* Model Selector */}
        <div className="mb-3">
          <label className="text-gray-400 text-xs mb-1 block">Select Model</label>
          <select
            value={selectedLocalModel}
            onChange={(e) => setSelectedLocalModel(e.target.value)}
            className="w-full bg-[#3c3c3c] text-white p-2 rounded border border-gray-600 focus:border-blue-500 outline-none"
          >
            {localModels.map((model) => (
              <option key={model.name} value={model.name}>
                {model.name} ({model.size_mb}MB) {model.downloaded ? '✓' : '⬇'}
              </option>
            ))}
          </select>
        </div>

        {/* Initialize Button */}
        {!isEmbeddedLLMReady && (
          <button
            onClick={initEmbeddedLLM}
            disabled={isEmbeddedLLMLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white py-2 px-4 rounded flex items-center justify-center gap-2"
          >
            {isEmbeddedLLMLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Initializing...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Initialize Embedded LLM
              </>
            )}
          </button>
        )}

        {/* Model List */}
        {localModels.length > 0 && (
          <div className="mt-3 space-y-1">
            {localModels.map((model) => (
              <div 
                key={model.name}
                className="flex items-center justify-between bg-[#252526] p-2 rounded text-sm"
              >
                <div className="flex items-center gap-2">
                  {model.loaded ? (
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  ) : model.downloaded ? (
                    <Download className="w-4 h-4 text-gray-400" />
                  ) : (
                    <Download className="w-4 h-4 text-gray-600" />
                  )}
                  <span className="text-white">{model.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">{model.size_mb}MB</span>
                  {model.downloaded && !model.loaded && (
                    <button
                      onClick={() => loadModel(model.name)}
                      disabled={isEmbeddedLLMLoading}
                      className="text-blue-400 hover:text-blue-300 disabled:text-gray-600"
                    >
                      Load
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
