'use client';

import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Sparkles, Keyboard } from 'lucide-react';

export interface SettingsData {
  editor: {
    fontSize: number;
    fontFamily: string;
    tabSize: number;
    wordWrap: boolean;
    minimap: boolean;
    lineNumbers: boolean;
    autoSave: boolean;
    autoSaveDelay: number;
    formatOnSave: boolean;
  };
  terminal: {
    fontSize: number;
    fontFamily: string;
    shell: string;
  };
  ai: {
    defaultModel: string;
    ollamaHost: string;
    temperature: number;
    maxTokens: number;
  };
  inlineCompletion: {
    enabled: boolean;
    debounceDelay: number;
    maxTokens: number;
    model: string;
    temperature: number;
    triggerOnSpace: boolean;
    triggerOnNewline: boolean;
    minPrefixLength: number;
    showLoadingIndicator: boolean;
    respectComments: boolean;
    showSuggestionSource: boolean;
  };
  appearance: {
    theme: 'dark' | 'light' | 'system';
    accentColor: string;
  };
}

const DEFAULT_SETTINGS: SettingsData = {
  editor: {
    fontSize: 14,
    fontFamily: 'JetBrains Mono',
    tabSize: 2,
    wordWrap: true,
    minimap: true,
    lineNumbers: true,
    autoSave: true,
    autoSaveDelay: 1000,
    formatOnSave: true,
  },
  terminal: {
    fontSize: 13,
    fontFamily: 'JetBrains Mono',
    shell: 'auto',
  },
  ai: {
    defaultModel: 'llama3.2',
    ollamaHost: 'http://localhost:11434',
    temperature: 0.7,
    maxTokens: 2048,
  },
  inlineCompletion: {
    enabled: true,
    debounceDelay: 300,
    maxTokens: 150,
    model: 'llama3.2',
    temperature: 0.2,
    triggerOnSpace: true,
    triggerOnNewline: true,
    minPrefixLength: 3,
    showLoadingIndicator: true,
    respectComments: true,
    showSuggestionSource: true,
  },
  appearance: {
    theme: 'dark',
    accentColor: 'blue',
  },
};

interface SettingsProps {
  initialSettings?: Partial<SettingsData>;
  onSave?: (settings: SettingsData) => void;
  className?: string;
}

export default function Settings({ initialSettings, onSave, className }: SettingsProps) {
  const [settings, setSettings] = useState<SettingsData>({
    ...DEFAULT_SETTINGS,
    ...initialSettings,
    editor: { ...DEFAULT_SETTINGS.editor, ...initialSettings?.editor },
    terminal: { ...DEFAULT_SETTINGS.terminal, ...initialSettings?.terminal },
    ai: { ...DEFAULT_SETTINGS.ai, ...initialSettings?.ai },
    inlineCompletion: { ...DEFAULT_SETTINGS.inlineCompletion, ...initialSettings?.inlineCompletion },
    appearance: { ...DEFAULT_SETTINGS.appearance, ...initialSettings?.appearance },
  });

  const updateEditor = (key: keyof SettingsData['editor'], value: unknown) => {
    setSettings(s => ({ ...s, editor: { ...s.editor, [key]: value } }));
  };

  const updateTerminal = (key: keyof SettingsData['terminal'], value: unknown) => {
    setSettings(s => ({ ...s, terminal: { ...s.terminal, [key]: value } }));
  };

  const updateAI = (key: keyof SettingsData['ai'], value: unknown) => {
    setSettings(s => ({ ...s, ai: { ...s.ai, [key]: value } }));
  };

  const updateInlineCompletion = (key: keyof SettingsData['inlineCompletion'], value: unknown) => {
    setSettings(s => ({ ...s, inlineCompletion: { ...s.inlineCompletion, [key]: value } }));
  };

  const updateAppearance = (key: keyof SettingsData['appearance'], value: unknown) => {
    setSettings(s => ({ ...s, appearance: { ...s.appearance, [key]: value } }));
  };

  return (
    <div className={cn('h-full', className)}>
      <Tabs defaultValue="editor" className="h-full flex flex-col">
        <TabsList className="mx-4 mt-4 shrink-0">
          <TabsTrigger value="editor">Editor</TabsTrigger>
          <TabsTrigger value="inlineCompletion">Completion</TabsTrigger>
          <TabsTrigger value="terminal">Terminal</TabsTrigger>
          <TabsTrigger value="ai">AI</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1 p-4">
          <TabsContent value="editor" className="space-y-6 m-0">
            <Card>
              <CardHeader>
                <CardTitle>Text Editor</CardTitle>
                <CardDescription>Configure the code editor behavior</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Font Size</Label>
                    <Input
                      type="number"
                      value={settings.editor.fontSize}
                      onChange={e => updateEditor('fontSize', parseInt(e.target.value) || 14)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tab Size</Label>
                    <Select
                      value={String(settings.editor.tabSize)}
                      onValueChange={v => updateEditor('tabSize', parseInt(v))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2">2 spaces</SelectItem>
                        <SelectItem value="4">4 spaces</SelectItem>
                        <SelectItem value="8">8 spaces</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Font Family</Label>
                  <Select
                    value={settings.editor.fontFamily}
                    onValueChange={v => updateEditor('fontFamily', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="JetBrains Mono">JetBrains Mono</SelectItem>
                      <SelectItem value="Fira Code">Fira Code</SelectItem>
                      <SelectItem value="Monaco">Monaco</SelectItem>
                      <SelectItem value="Menlo">Menlo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Word Wrap</Label>
                    <Switch
                      checked={settings.editor.wordWrap}
                      onCheckedChange={v => updateEditor('wordWrap', v)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Show Minimap</Label>
                    <Switch
                      checked={settings.editor.minimap}
                      onCheckedChange={v => updateEditor('minimap', v)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Line Numbers</Label>
                    <Switch
                      checked={settings.editor.lineNumbers}
                      onCheckedChange={v => updateEditor('lineNumbers', v)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Auto Save</Label>
                    <Switch
                      checked={settings.editor.autoSave}
                      onCheckedChange={v => updateEditor('autoSave', v)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Format on Save</Label>
                    <Switch
                      checked={settings.editor.formatOnSave}
                      onCheckedChange={v => updateEditor('formatOnSave', v)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="inlineCompletion" className="space-y-6 m-0">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-400" />
                  <CardTitle>AI Inline Completion</CardTitle>
                </div>
                <CardDescription>Configure AI-powered code completion settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Enable/Disable */}
                <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                  <div>
                    <Label className="text-base font-medium">Enable Inline Completion</Label>
                    <p className="text-xs text-muted-foreground">Show ghost text suggestions while typing</p>
                  </div>
                  <Switch
                    checked={settings.inlineCompletion.enabled}
                    onCheckedChange={v => updateInlineCompletion('enabled', v)}
                  />
                </div>

                {/* Model Selection */}
                <div className="space-y-2">
                  <Label>Completion Model</Label>
                  <Select
                    value={settings.inlineCompletion.model}
                    onValueChange={v => updateInlineCompletion('model', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="llama3.2">Llama 3.2 (Local)</SelectItem>
                      <SelectItem value="codellama">Code Llama (Local)</SelectItem>
                      <SelectItem value="deepseek-coder">DeepSeek Coder (Local)</SelectItem>
                      <SelectItem value="mistral">Mistral (Local)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Debounce Delay */}
                <div className="space-y-2">
                  <Label>Debounce Delay: {settings.inlineCompletion.debounceDelay}ms</Label>
                  <Slider
                    value={[settings.inlineCompletion.debounceDelay]}
                    onValueChange={([v]) => updateInlineCompletion('debounceDelay', v)}
                    min={100}
                    max={1000}
                    step={50}
                  />
                  <p className="text-xs text-muted-foreground">Delay before triggering completion after typing stops</p>
                </div>

                {/* Temperature */}
                <div className="space-y-2">
                  <Label>Temperature: {settings.inlineCompletion.temperature}</Label>
                  <Slider
                    value={[settings.inlineCompletion.temperature]}
                    onValueChange={([v]) => updateInlineCompletion('temperature', v)}
                    min={0}
                    max={1}
                    step={0.1}
                  />
                  <p className="text-xs text-muted-foreground">Lower = more deterministic, Higher = more creative</p>
                </div>

                {/* Max Tokens */}
                <div className="space-y-2">
                  <Label>Max Tokens</Label>
                  <Input
                    type="number"
                    value={settings.inlineCompletion.maxTokens}
                    onChange={e => updateInlineCompletion('maxTokens', parseInt(e.target.value) || 150)}
                  />
                  <p className="text-xs text-muted-foreground">Maximum length of completion suggestions</p>
                </div>

                {/* Min Prefix Length */}
                <div className="space-y-2">
                  <Label>Min Prefix Length: {settings.inlineCompletion.minPrefixLength} chars</Label>
                  <Slider
                    value={[settings.inlineCompletion.minPrefixLength]}
                    onValueChange={([v]) => updateInlineCompletion('minPrefixLength', v)}
                    min={1}
                    max={10}
                    step={1}
                  />
                  <p className="text-xs text-muted-foreground">Minimum characters before triggering completion</p>
                </div>

                {/* Toggle Options */}
                <div className="space-y-3 pt-2 border-t border-zinc-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Trigger on Space</Label>
                      <p className="text-xs text-muted-foreground">Trigger completion after typing space</p>
                    </div>
                    <Switch
                      checked={settings.inlineCompletion.triggerOnSpace}
                      onCheckedChange={v => updateInlineCompletion('triggerOnSpace', v)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Trigger on Newline</Label>
                      <p className="text-xs text-muted-foreground">Trigger completion after new line</p>
                    </div>
                    <Switch
                      checked={settings.inlineCompletion.triggerOnNewline}
                      onCheckedChange={v => updateInlineCompletion('triggerOnNewline', v)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Show Loading Indicator</Label>
                      <p className="text-xs text-muted-foreground">Show spinner while AI is thinking</p>
                    </div>
                    <Switch
                      checked={settings.inlineCompletion.showLoadingIndicator}
                      onCheckedChange={v => updateInlineCompletion('showLoadingIndicator', v)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Respect Comments</Label>
                      <p className="text-xs text-muted-foreground">Don&apos;t suggest completions inside comments</p>
                    </div>
                    <Switch
                      checked={settings.inlineCompletion.respectComments}
                      onCheckedChange={v => updateInlineCompletion('respectComments', v)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Show Suggestion Source</Label>
                      <p className="text-xs text-muted-foreground">Display which AI model generated the suggestion</p>
                    </div>
                    <Switch
                      checked={settings.inlineCompletion.showSuggestionSource}
                      onCheckedChange={v => updateInlineCompletion('showSuggestionSource', v)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Keyboard Shortcuts */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Keyboard className="h-5 w-5 text-blue-400" />
                  <CardTitle>Keyboard Shortcuts</CardTitle>
                </div>
                <CardDescription>Inline completion keyboard shortcuts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between py-2 border-b border-zinc-700">
                    <span className="text-zinc-300">Accept suggestion</span>
                    <Badge variant="secondary" className="font-mono">Tab</Badge>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-zinc-700">
                    <span className="text-zinc-300">Dismiss suggestion</span>
                    <Badge variant="secondary" className="font-mono">Esc</Badge>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-zinc-700">
                    <span className="text-zinc-300">Trigger manually</span>
                    <Badge variant="secondary" className="font-mono">Alt + \</Badge>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-zinc-300">Toggle completion</span>
                    <Badge variant="secondary" className="font-mono">Ctrl + Alt + Space</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="terminal" className="space-y-6 m-0">
            <Card>
              <CardHeader>
                <CardTitle>Terminal</CardTitle>
                <CardDescription>Configure terminal settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Font Size</Label>
                    <Input
                      type="number"
                      value={settings.terminal.fontSize}
                      onChange={e => updateTerminal('fontSize', parseInt(e.target.value) || 13)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Shell</Label>
                    <Select
                      value={settings.terminal.shell}
                      onValueChange={v => updateTerminal('shell', v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Auto Detect</SelectItem>
                        <SelectItem value="bash">Bash</SelectItem>
                        <SelectItem value="zsh">Zsh</SelectItem>
                        <SelectItem value="fish">Fish</SelectItem>
                        <SelectItem value="powershell">PowerShell</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ai" className="space-y-6 m-0">
            <Card>
              <CardHeader>
                <CardTitle>AI Settings</CardTitle>
                <CardDescription>Configure AI model behavior</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Default Model</Label>
                  <Select
                    value={settings.ai.defaultModel}
                    onValueChange={v => updateAI('defaultModel', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="llama3.2">Llama 3.2 (Local)</SelectItem>
                      <SelectItem value="codellama">Code Llama (Local)</SelectItem>
                      <SelectItem value="deepseek-coder">DeepSeek Coder (Local)</SelectItem>
                      <SelectItem value="mistral">Mistral (Local)</SelectItem>
                      <SelectItem value="claude-3-sonnet">Claude 3.5 Sonnet</SelectItem>
                      <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Ollama Host</Label>
                  <Input
                    value={settings.ai.ollamaHost}
                    onChange={e => updateAI('ollamaHost', e.target.value)}
                    placeholder="http://localhost:11434"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Temperature: {settings.ai.temperature}</Label>
                  <Slider
                    value={[settings.ai.temperature]}
                    onValueChange={([v]) => updateAI('temperature', v)}
                    min={0}
                    max={1}
                    step={0.1}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Max Tokens</Label>
                  <Input
                    type="number"
                    value={settings.ai.maxTokens}
                    onChange={e => updateAI('maxTokens', parseInt(e.target.value) || 2048)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="appearance" className="space-y-6 m-0">
            <Card>
              <CardHeader>
                <CardTitle>Appearance</CardTitle>
                <CardDescription>Customize the IDE look and feel</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Theme</Label>
                  <Select
                    value={settings.appearance.theme}
                    onValueChange={v => updateAppearance('theme', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Accent Color</Label>
                  <Select
                    value={settings.appearance.accentColor}
                    onValueChange={v => updateAppearance('accentColor', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="blue">Blue</SelectItem>
                      <SelectItem value="purple">Purple</SelectItem>
                      <SelectItem value="green">Green</SelectItem>
                      <SelectItem value="orange">Orange</SelectItem>
                      <SelectItem value="red">Red</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </ScrollArea>

        <div className="p-4 border-t shrink-0">
          <Button onClick={() => onSave?.(settings)} className="w-full">
            Save Settings
          </Button>
        </div>
      </Tabs>
    </div>
  );
}
