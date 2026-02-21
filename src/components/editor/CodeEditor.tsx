'use client';

import React, { useRef, useCallback, useEffect, useState } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { cn } from '@/lib/utils';
import { Loader2, Sparkles } from 'lucide-react';
import { 
  getInlineCompletionProvider, 
  disposeInlineCompletionProvider,
  type InlineCompletionConfig 
} from '@/lib/pulse/ai/inline-completion';
import { useSettingsStore } from '@/lib/stores/settings';

export interface CodeEditorProps {
  value: string;
  language?: string;
  onChange?: (value: string) => void;
  onSave?: () => void;
  readOnly?: boolean;
  minimap?: boolean;
  lineNumbers?: 'on' | 'off' | 'relative';
  fontSize?: number;
  theme?: 'vs-dark' | 'vs-light';
  className?: string;
  filePath?: string;
}

// Loading indicator component for inline completions
function InlineCompletionLoadingIndicator({ isLoading }: { isLoading: boolean }) {
  if (!isLoading) return null;
  
  return (
    <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5 px-2 py-1 bg-zinc-800/90 rounded border border-zinc-700 text-xs text-zinc-400">
      <Loader2 className="h-3 w-3 animate-spin" />
      <span>AI thinking...</span>
    </div>
  );
}

// Suggestion source badge
function SuggestionSourceBadge({ 
  visible, 
  source, 
  model 
}: { 
  visible: boolean; 
  source?: string; 
  model?: string;
}) {
  if (!visible) return null;
  
  return (
    <div className="absolute bottom-2 right-2 z-10 flex items-center gap-1.5 px-2 py-1 bg-purple-900/50 rounded border border-purple-700/50 text-xs text-purple-300">
      <Sparkles className="h-3 w-3" />
      <span>{source || 'AI'} • {model || 'llama3.2'}</span>
    </div>
  );
}

export default function CodeEditor({
  value,
  language = 'typescript',
  onChange,
  onSave,
  readOnly = false,
  minimap = true,
  lineNumbers = 'on',
  fontSize = 14,
  theme = 'vs-dark',
  className,
  filePath,
}: CodeEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof import('monaco-editor') | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const [suggestionSource, setSuggestionSource] = useState<string | undefined>();
  
  // Get settings from store
  const inlineCompletionSettings = useSettingsStore(state => state.getInlineCompletionSettings());
  const updateInlineCompletionSettings = useSettingsStore(state => state.updateInlineCompletionSettings);
  
  // Convert settings to config
  const completionConfig: Partial<InlineCompletionConfig> = {
    enabled: inlineCompletionSettings.enabled,
    debounceDelay: inlineCompletionSettings.debounceDelay,
    maxTokens: inlineCompletionSettings.maxTokens,
    model: inlineCompletionSettings.model,
    temperature: inlineCompletionSettings.temperature,
    triggerOnSpace: inlineCompletionSettings.triggerOnSpace,
    triggerOnNewline: inlineCompletionSettings.triggerOnNewline,
    minPrefixLength: inlineCompletionSettings.minPrefixLength,
    showLoadingIndicator: inlineCompletionSettings.showLoadingIndicator,
    multilineThreshold: inlineCompletionSettings.multilineThreshold,
    respectComments: inlineCompletionSettings.respectComments,
  };

  const handleMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Keybindings
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onSave?.();
    });

    // Emit events for command palette
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyP, () => {
      window.dispatchEvent(new CustomEvent('pulse:quickopen'));
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyP, () => {
      window.dispatchEvent(new CustomEvent('pulse:commandpalette'));
    });

    // Manual inline completion trigger: Alt+\
    editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.Backslash, () => {
      // Trigger inline completion manually
      const provider = getInlineCompletionProvider();
      provider.triggerManualCompletion();
    });

    // Toggle inline completion: Ctrl+Alt+Space
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.Space, () => {
      const provider = getInlineCompletionProvider();
      const currentConfig = provider.getConfig();
      provider.updateConfig({ enabled: !currentConfig.enabled });
      updateInlineCompletionSettings({ enabled: !currentConfig.enabled });
    });

    // Initialize and register inline completion provider
    const provider = getInlineCompletionProvider(completionConfig);
    provider.init(monaco);

    // Set up callbacks
    provider.onLoadingChange = (loading) => {
      setIsLoading(loading);
    };

    provider.onSuggestionAccepted = (suggestion) => {
      setSuggestionSource(suggestion.source);
      setShowSource(true);
      setTimeout(() => setShowSource(false), 2000);
    };

    // Register the provider with Monaco
    const disposable = monaco.languages.registerInlineCompletionsProvider(
      { pattern: '**' },
      provider.getProvider()
    );

    // Store disposable for cleanup
    (editor as editor.IStandaloneCodeEditor & { _inlineCompletionDisposable?: unknown })._inlineCompletionDisposable = disposable;

  }, [onSave, completionConfig, updateInlineCompletionSettings]);

  // Update provider config when settings change
  useEffect(() => {
    const provider = getInlineCompletionProvider();
    provider.updateConfig(completionConfig);
  }, [completionConfig]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Dispose inline completion provider
      if (editorRef.current) {
        const editor = editorRef.current as editor.IStandaloneCodeEditor & { 
          _inlineCompletionDisposable?: { dispose: () => void } 
        };
        if (editor._inlineCompletionDisposable) {
          editor._inlineCompletionDisposable.dispose();
        }
      }
    };
  }, []);

  const handleChange = useCallback((val: string | undefined) => {
    onChange?.(val || '');
  }, [onChange]);

  return (
    <div className={cn('h-full w-full relative', className)}>
      <InlineCompletionLoadingIndicator isLoading={isLoading} />
      <SuggestionSourceBadge 
        visible={showSource} 
        source={suggestionSource}
        model={inlineCompletionSettings.model}
      />
      <Editor
        height="100%"
        language={language}
        value={value}
        theme={theme}
        onChange={handleChange}
        onMount={handleMount}
        path={filePath}
        loading={
          <div className="flex items-center justify-center h-full bg-zinc-900">
            <div className="animate-pulse text-zinc-500">Loading editor...</div>
          </div>
        }
        options={{
          minimap: { enabled: minimap },
          lineNumbers,
          fontSize,
          fontFamily: 'JetBrains Mono, Menlo, Monaco, monospace',
          tabSize: 2,
          wordWrap: 'on',
          readOnly,
          automaticLayout: true,
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          bracketPairColorization: { enabled: true },
          guides: { bracketPairs: true, indentation: true },
          stickyScroll: { enabled: true },
          // Enable inline suggestions
          suggest: {
            showInlineDetails: true,
            showMethods: true,
            showFunctions: true,
            showConstructors: true,
            showFields: true,
            showVariables: true,
            showClasses: true,
            showStructs: true,
            showInterfaces: true,
            showModules: true,
            showProperties: true,
            showEvents: true,
            showOperators: true,
            showUnits: true,
            showValues: true,
            showConstants: true,
            showEnums: true,
            showEnumMembers: true,
            showKeywords: true,
            showWords: true,
            showColors: true,
            showFiles: true,
            showReferences: true,
            showFolders: true,
            showTypeParameters: true,
            showSnippets: true,
          },
          // Inline suggestion settings
          inlineSuggest: {
            enabled: inlineCompletionSettings.enabled,
            showToolbar: 'onHover',
          },
          // Ghost text settings
          suggestSelection: 'first',
          quickSuggestions: {
            other: true,
            comments: false,
            strings: false,
          },
        }}
      />
    </div>
  );
}
