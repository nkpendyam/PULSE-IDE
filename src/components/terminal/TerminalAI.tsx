'use client';

import React, { useState, useCallback } from 'react';
import { useKyroStore } from '@/store/kyroStore';
import { AlertTriangle, Copy, Send, Sparkles, X } from 'lucide-react';

interface TerminalAIProps {
  terminalOutput: string;
  onSendToChat: (message: string) => void;
}

interface ErrorExplanation {
  error: string;
  explanation: string;
  suggestion: string;
  command?: string;
}

type CommandRiskLevel = 'low' | 'medium' | 'high';

interface RunResultAnalysis {
  status: 'success' | 'failure' | 'unknown';
  summary: string;
  action?: string;
}

interface FixAttemptHistoryItem {
  command: string;
  status: RunResultAnalysis['status'];
  summary: string;
  timestamp: number;
}

// Common error patterns for quick local detection
const ERROR_PATTERNS: Array<{ pattern: RegExp; type: string }> = [
  { pattern: /error\[E\d+\]:/i, type: 'rust_compiler' },
  { pattern: /npm ERR!/i, type: 'npm_error' },
  { pattern: /command not found/i, type: 'command_not_found' },
  { pattern: /permission denied/i, type: 'permission_denied' },
  { pattern: /ENOENT|no such file/i, type: 'file_not_found' },
  { pattern: /EADDRINUSE/i, type: 'port_in_use' },
  { pattern: /SyntaxError:/i, type: 'syntax_error' },
  { pattern: /TypeError:/i, type: 'type_error' },
  { pattern: /ModuleNotFoundError/i, type: 'module_not_found' },
  { pattern: /TS\d{4}:/i, type: 'typescript_error' },
  { pattern: /FAILED|FAIL/i, type: 'test_failure' },
  { pattern: /panic!/i, type: 'rust_panic' },
  { pattern: /segmentation fault/i, type: 'segfault' },
  { pattern: /out of memory/i, type: 'oom' },
];

function detectErrors(output: string): string[] {
  const lines = output.split('\n');
  const errors: string[] = [];
  
  for (const line of lines) {
    for (const { pattern } of ERROR_PATTERNS) {
      if (pattern.test(line)) {
        errors.push(line.trim());
        break;
      }
    }
  }
  
  return errors.slice(-10); // Keep last 10 errors
}

function classifyCommandRisk(command: string): {
  level: CommandRiskLevel;
  reason: string;
} {
  const trimmed = command.trim();
  if (!trimmed) {
    return { level: 'low', reason: 'No command provided' };
  }

  if (/\b(rm\s+-rf|del\s+\/s|format\s+|mkfs\b|dd\s+if=|chmod\s+777|sudo\s+rm)\b/i.test(trimmed)) {
    return { level: 'high', reason: 'Potentially destructive command detected' };
  }

  if (/\b(sudo\b|npm\s+install\b|pnpm\s+add\b|yarn\s+add\b|pip\s+install\b|cargo\s+add\b|git\s+reset\s+--hard\b)\b/i.test(trimmed)) {
    return { level: 'medium', reason: 'System/package or git state changing command detected' };
  }

  return { level: 'low', reason: 'Command appears non-destructive' };
}

function analyzeRunOutput(command: string, outputDelta: string): RunResultAnalysis {
  const output = outputDelta.trim();
  if (!output) {
    return {
      status: 'unknown',
      summary: 'No terminal output detected yet after running the command.',
      action: 'Wait a moment and re-check terminal output.',
    };
  }

  const failurePattern = /(error|failed|exception|cannot|not found|permission denied|enoent|eaddrinuse|panic!|traceback)/i;
  const successPattern = /(success|succeeded|completed|compiled|finished|listening on|done)/i;

  if (failurePattern.test(output)) {
    return {
      status: 'failure',
      summary: `Fix command appears to have failed: ${command}`,
      action: 'Review error lines below and ask AI for a refined fix.',
    };
  }

  if (successPattern.test(output)) {
    return {
      status: 'success',
      summary: `Fix command appears successful: ${command}`,
      action: 'Continue workflow or run verification tests.',
    };
  }

  return {
    status: 'unknown',
    summary: `Command executed but result is unclear: ${command}`,
    action: 'Inspect output manually or ask AI to interpret the result.',
  };
}

export function TerminalAI({ terminalOutput, onSendToChat }: TerminalAIProps) {
  const [explanation, setExplanation] = useState<ErrorExplanation | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);
  const [isRunningFix, setIsRunningFix] = useState(false);
  const [isAnalyzingRun, setIsAnalyzingRun] = useState(false);
  const [runResult, setRunResult] = useState<RunResultAnalysis | null>(null);
  const [fixHistory, setFixHistory] = useState<FixAttemptHistoryItem[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const appendFixHistory = useCallback((item: FixAttemptHistoryItem) => {
    setFixHistory((prev) => [item, ...prev].slice(0, 3));
  }, []);

  // Detect errors when terminal output changes
  const detectedErrors = React.useMemo(() => {
    const errors = detectErrors(terminalOutput);
    return errors.filter(e => !dismissed.has(e));
  }, [terminalOutput, dismissed]);

  const handleExplain = useCallback(async (error: string) => {
    setIsExplaining(true);
    
    // Send to AI for explanation via chat
    const prompt = `Explain this terminal error and suggest a fix:\n\`\`\`\n${error}\n\`\`\``;
    
    try {
      if (typeof window !== 'undefined' && window.__TAURI__) {
        const response = await window.__TAURI__.core.invoke<string>('chat_completion', {
          model: useKyroStore.getState().selectedModel,
          messages: [
            { role: 'system', content: 'You are a terminal error expert. Explain errors concisely and suggest fixes. Respond in JSON: {"explanation": "...", "suggestion": "...", "command": "optional fix command"}' },
            { role: 'user', content: prompt }
          ]
        });
        
        try {
          const parsed = JSON.parse(response);
          setExplanation({
            error,
            explanation: parsed.explanation || response,
            suggestion: parsed.suggestion || '',
            command: parsed.command,
          });
          setRunResult(null);
        } catch {
          setExplanation({
            error,
            explanation: response,
            suggestion: '',
          });
          setRunResult(null);
        }
      }
    } catch {
      // Fallback: just send to chat
      onSendToChat(`@terminal Explain this error:\n${error}`);
    }
    
    setIsExplaining(false);
  }, [onSendToChat]);

  const handleDismiss = useCallback((error: string) => {
    setDismissed(prev => new Set([...prev, error]));
  }, []);

  const handleSendOutputToChat = useCallback(() => {
    const lastLines = terminalOutput.split('\n').slice(-30).join('\n');
    onSendToChat(`@terminal Here's my terminal output:\n\`\`\`\n${lastLines}\n\`\`\``);
  }, [terminalOutput, onSendToChat]);

  const handleCopyError = useCallback((error: string) => {
    navigator.clipboard.writeText(error);
  }, []);

  const handleRunFixCommand = useCallback(async (command: string) => {
    if (!command.trim()) {
      return;
    }

    const risk = classifyCommandRisk(command);
    const needsConfirmation = risk.level !== 'low';
    if (needsConfirmation && typeof window !== 'undefined') {
      const confirmed = window.confirm(
        `This fix command is classified as ${risk.level.toUpperCase()} risk.\n${risk.reason}\n\nRun anyway?\n\n${command}`
      );
      if (!confirmed) {
        return;
      }
    }

    setIsRunningFix(true);
    setRunResult(null);
    const outputBeforeRun = useKyroStore.getState().terminalOutput;
    try {
      if (typeof window !== 'undefined' && window.__TAURI__) {
        await window.__TAURI__.core.invoke('write_to_terminal', {
          id: 'main',
          data: `${command}\n`,
        });

        setIsAnalyzingRun(true);
        await new Promise((resolve) => setTimeout(resolve, 1300));
        const outputAfterRun = useKyroStore.getState().terminalOutput;
        const outputDelta = outputAfterRun.startsWith(outputBeforeRun)
          ? outputAfterRun.slice(outputBeforeRun.length)
          : outputAfterRun.split('\n').slice(-80).join('\n');
        const analysis = analyzeRunOutput(command, outputDelta);
        setRunResult(analysis);
        appendFixHistory({
          command,
          status: analysis.status,
          summary: analysis.summary,
          timestamp: Date.now(),
        });
      }
    } catch {
      onSendToChat(`@terminal I want to run this fix command but execution failed:\n\n\`${command}\``);
      const failedRunResult: RunResultAnalysis = {
        status: 'failure',
        summary: 'Failed to send fix command to terminal.',
        action: 'Check terminal session status and try running the command manually.',
      };
      setRunResult(failedRunResult);
      appendFixHistory({
        command,
        status: failedRunResult.status,
        summary: failedRunResult.summary,
        timestamp: Date.now(),
      });
    } finally {
      setIsRunningFix(false);
      setIsAnalyzingRun(false);
    }
  }, [appendFixHistory, onSendToChat]);

  if (detectedErrors.length === 0 && !explanation) return null;

  const commandRisk = explanation?.command ? classifyCommandRisk(explanation.command) : null;

  return (
    <div className="border-t border-[#30363d] bg-[#161b22]">
      {/* Error Banners */}
      {detectedErrors.length > 0 && !explanation && (
        <div className="px-3 py-1.5">
          {detectedErrors.slice(0, 3).map((error, i) => (
            <div key={i} className="flex items-center gap-2 py-1 text-xs">
              <AlertTriangle size={12} className="text-[#d29922] shrink-0" />
              <span className="flex-1 text-[#c9d1d9] truncate font-mono text-[11px]">{error}</span>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => handleExplain(error)}
                  disabled={isExplaining}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-[#a371f7]/10 text-[#a371f7] hover:bg-[#a371f7]/20 disabled:opacity-50"
                  title="Explain with AI"
                >
                  <Sparkles size={9} /> Explain
                </button>
                <button
                  onClick={() => handleCopyError(error)}
                  className="p-0.5 rounded text-[#8b949e] hover:text-[#c9d1d9]"
                  title="Copy error"
                >
                  <Copy size={10} />
                </button>
                <button
                  onClick={() => handleDismiss(error)}
                  className="p-0.5 rounded text-[#8b949e] hover:text-[#c9d1d9]"
                  title="Dismiss"
                >
                  <X size={10} />
                </button>
              </div>
            </div>
          ))}
          {detectedErrors.length > 3 && (
            <div className="text-[10px] text-[#8b949e] pl-5">+{detectedErrors.length - 3} more errors</div>
          )}
        </div>
      )}

      {/* AI Explanation Card */}
      {explanation && (
        <div className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-[#a371f7]">
              <Sparkles size={12} /> AI Explanation
            </div>
            <button onClick={() => setExplanation(null)} className="text-[#8b949e] hover:text-[#c9d1d9]">
              <X size={12} />
            </button>
          </div>
          <div className="text-xs text-[#c9d1d9] leading-relaxed">{explanation.explanation}</div>
          {explanation.suggestion && (
            <div className="text-xs text-[#3fb950] bg-[#238636]/10 rounded px-2 py-1">
              💡 {explanation.suggestion}
            </div>
          )}
          {explanation.command && (
            <div className="space-y-1">
              {commandRisk && (
                <div className={`text-[10px] ${
                  commandRisk.level === 'high'
                    ? 'text-[#f85149]'
                    : commandRisk.level === 'medium'
                      ? 'text-[#d29922]'
                      : 'text-[#8b949e]'
                }`}>
                  Risk: {commandRisk.level.toUpperCase()} — {commandRisk.reason}
                </div>
              )}
              <div className="flex items-center gap-2">
              <code className="text-[11px] bg-[#0d1117] text-[#c9d1d9] px-2 py-1 rounded font-mono flex-1">
                {explanation.command}
              </code>
              <button
                onClick={() => handleRunFixCommand(explanation.command!)}
                disabled={isRunningFix}
                className="px-2 py-1 rounded text-[10px] bg-[#238636] text-white hover:bg-[#2ea043] disabled:opacity-50"
                title="Run command in terminal"
              >
                {isRunningFix ? 'Running...' : 'Run Fix'}
              </button>
              <button
                onClick={() => handleCopyError(explanation.command!)}
                className="p-1 rounded text-[#8b949e] hover:text-[#c9d1d9]"
              >
                <Copy size={12} />
              </button>
            </div>
            {isAnalyzingRun && (
              <div className="text-[10px] text-[#8b949e]">Analyzing terminal output...</div>
            )}
            {runResult && (
              <div className={`rounded px-2 py-1 text-[10px] ${
                runResult.status === 'success'
                  ? 'bg-[#238636]/10 text-[#3fb950]'
                  : runResult.status === 'failure'
                    ? 'bg-[#da3633]/10 text-[#f85149]'
                    : 'bg-[#30363d] text-[#8b949e]'
              }`}>
                <div>{runResult.summary}</div>
                {runResult.action && <div className="opacity-85">{runResult.action}</div>}
                <button
                  onClick={() => onSendToChat(`@terminal Analyze this command result: ${runResult.summary}`)}
                  className="mt-1 underline underline-offset-2 hover:opacity-85"
                >
                  Ask AI to review result
                </button>
              </div>
            )}
            </div>
          )}
        </div>
      )}

      {/* Quick Actions */}
      <div className="px-3 py-1 border-t border-[#21262d] flex items-center gap-2">
        <button
          onClick={handleSendOutputToChat}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#21262d] transition-colors"
        >
          <Send size={9} /> Send to Chat
        </button>
      </div>

      {fixHistory.length > 0 && (
        <div className="px-3 py-2 border-t border-[#21262d]">
          <div className="text-[10px] text-[#8b949e] mb-1">Recent Fix Attempts</div>
          <div className="space-y-1">
            {fixHistory.map((item) => (
              <div key={`${item.timestamp}-${item.command}`} className="text-[10px] rounded bg-[#0d1117] px-2 py-1">
                <div className="flex items-center justify-between gap-2">
                  <code className="text-[#c9d1d9] truncate">{item.command}</code>
                  <span className={`${
                    item.status === 'success'
                      ? 'text-[#3fb950]'
                      : item.status === 'failure'
                        ? 'text-[#f85149]'
                        : 'text-[#8b949e]'
                  }`}>{item.status.toUpperCase()}</span>
                </div>
                <div className="text-[#8b949e] truncate">{item.summary}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
