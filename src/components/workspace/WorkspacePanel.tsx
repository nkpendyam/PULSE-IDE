'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  FolderOpen,
  Settings,
  Save,
  RotateCcw,
  ChevronRight,
  ChevronDown,
  Monitor,
  Code,
  Palette,
  Zap,
  Database,
  Globe,
  Shield,
  Info,
  Check,
  AlertCircle,
  Folder,
  Home,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// Types
export interface WorkspaceSettings {
  // Editor
  fontSize: number;
  fontFamily: string;
  tabSize: number;
  wordWrap: boolean;
  minimap: boolean;
  lineNumbers: 'on' | 'off' | 'relative';
  autoSave: boolean;
  autoSaveDelay: number;
  formatOnSave: boolean;
  lintOnSave: boolean;
  
  // Theme
  theme: 'light' | 'dark' | 'system';
  accentColor: string;
  
  // AI
  defaultModel: string;
  agentMode: 'off' | 'review' | 'agent' | 'strict';
  autoSuggest: boolean;
  
  // Terminal
  terminalFontSize: number;
  terminalFontFamily: string;
  shell: string;
  
  // Files
  excludePatterns: string[];
  showHiddenFiles: boolean;
  autoReveal: boolean;
}

export interface WorkspaceInfo {
  name: string;
  path: string;
  isOpen: boolean;
  lastOpened: Date;
  fileCount: number;
  folderCount: number;
}

export interface WorkspacePanelProps {
  workspace?: WorkspaceInfo;
  settings?: WorkspaceSettings;
  onSettingsChange?: (settings: WorkspaceSettings) => void;
  onWorkspaceChange?: (workspace: Partial<WorkspaceInfo>) => void;
  onSave?: () => void;
  className?: string;
}

// Default settings
const DEFAULT_SETTINGS: WorkspaceSettings = {
  fontSize: 14,
  fontFamily: 'JetBrains Mono, Menlo, Monaco, monospace',
  tabSize: 2,
  wordWrap: true,
  minimap: true,
  lineNumbers: 'on',
  autoSave: true,
  autoSaveDelay: 1000,
  formatOnSave: true,
  lintOnSave: false,
  theme: 'dark',
  accentColor: '#3b82f6',
  defaultModel: 'llama3.2',
  agentMode: 'review',
  autoSuggest: true,
  terminalFontSize: 13,
  terminalFontFamily: 'JetBrains Mono, Menlo, Monaco, monospace',
  shell: '/bin/bash',
  excludePatterns: ['node_modules', '.git', 'dist', 'build'],
  showHiddenFiles: false,
  autoReveal: true,
};

// Default workspace
const DEFAULT_WORKSPACE: WorkspaceInfo = {
  name: 'my-project',
  path: '/home/user/projects/my-project',
  isOpen: true,
  lastOpened: new Date(),
  fileCount: 42,
  folderCount: 8,
};

// Setting Section Component
interface SettingSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

const SettingSection: React.FC<SettingSectionProps> = ({
  title,
  icon,
  children,
  defaultOpen = true,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 px-1 hover:bg-accent/50 rounded-md transition-colors">
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        )}
        {icon}
        <span className="text-sm font-medium">{title}</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-6 pr-1 pt-2 pb-4 space-y-3">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
};

// Setting Item Component
interface SettingItemProps {
  label: string;
  description?: string;
  children: React.ReactNode;
}

const SettingItem: React.FC<SettingItemProps> = ({
  label,
  description,
  children,
}) => (
  <div className="flex items-start justify-between gap-4">
    <div className="flex-1">
      <Label className="text-sm">{label}</Label>
      {description && (
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      )}
    </div>
    <div className="shrink-0">{children}</div>
  </div>
);

// Helper function to load settings from localStorage
const loadStoredSettings = (): WorkspaceSettings => {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const storedSettings = localStorage.getItem('kyro-workspace-settings');
    if (storedSettings) {
      const parsed = JSON.parse(storedSettings);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.error('Failed to load workspace settings:', e);
  }
  return DEFAULT_SETTINGS;
};

// Helper function to load workspace info from localStorage
const loadStoredWorkspace = (): WorkspaceInfo => {
  if (typeof window === 'undefined') return DEFAULT_WORKSPACE;
  try {
    const storedWorkspace = localStorage.getItem('kyro-workspace-info');
    if (storedWorkspace) {
      const parsed = JSON.parse(storedWorkspace);
      return {
        ...DEFAULT_WORKSPACE,
        ...parsed,
        lastOpened: new Date(parsed.lastOpened),
      };
    }
  } catch (e) {
    console.error('Failed to load workspace info:', e);
  }
  return DEFAULT_WORKSPACE;
};

// Main Component
export const WorkspacePanel: React.FC<WorkspacePanelProps> = ({
  workspace: controlledWorkspace,
  settings: controlledSettings,
  onSettingsChange,
  onWorkspaceChange,
  onSave,
  className = '',
}) => {
  const [internalSettings, setInternalSettings] = useState<WorkspaceSettings>(loadStoredSettings);
  const [internalWorkspace, setInternalWorkspace] = useState<WorkspaceInfo>(loadStoredWorkspace);
  const [hasChanges, setHasChanges] = useState(false);
  const [savedSettings, setSavedSettings] = useState<WorkspaceSettings | null>(() => loadStoredSettings());

  // Use controlled or internal state
  const settings = useMemo(
    () => controlledSettings ?? internalSettings,
    [controlledSettings, internalSettings]
  );
  const workspace = useMemo(
    () => controlledWorkspace ?? internalWorkspace,
    [controlledWorkspace, internalWorkspace]
  );

  // Update settings
  const updateSettings = useCallback(
    (updates: Partial<WorkspaceSettings>) => {
      const newSettings = { ...settings, ...updates };
      if (onSettingsChange) {
        onSettingsChange(newSettings);
      } else {
        setInternalSettings(newSettings);
      }
      setHasChanges(true);
    },
    [settings, onSettingsChange]
  );

  // Update workspace
  const updateWorkspace = useCallback(
    (updates: Partial<WorkspaceInfo>) => {
      const newWorkspace = { ...workspace, ...updates };
      if (onWorkspaceChange) {
        onWorkspaceChange(newWorkspace);
      } else {
        setInternalWorkspace(newWorkspace);
      }
    },
    [workspace, onWorkspaceChange]
  );

  // Save settings
  const handleSave = useCallback(() => {
    localStorage.setItem('kyro-workspace-settings', JSON.stringify(settings));
    localStorage.setItem('kyro-workspace-info', JSON.stringify(workspace));
    setSavedSettings(settings);
    setHasChanges(false);
    onSave?.();
  }, [settings, workspace, onSave]);

  // Reset to defaults
  const handleReset = useCallback(() => {
    setInternalSettings(DEFAULT_SETTINGS);
    setHasChanges(true);
  }, []);



  // Auto-save if enabled
  useEffect(() => {
    if (settings.autoSave && hasChanges) {
      const timer = setTimeout(() => {
        handleSave();
      }, settings.autoSaveDelay);
      return () => clearTimeout(timer);
    }
  }, [settings, hasChanges, handleSave]);

  // Font size options
  const fontSizeOptions = [10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24];

  // Model options
  const modelOptions = [
    { value: 'llama3.2', label: 'Llama 3.2 (Local)' },
    { value: 'llama3.1', label: 'Llama 3.1 (Local)' },
    { value: 'codellama', label: 'Code Llama (Local)' },
    { value: 'mistral', label: 'Mistral (Local)' },
    { value: 'claude-3-opus', label: 'Claude 3 Opus (Cloud)' },
    { value: 'claude-3-sonnet', label: 'Claude 3 Sonnet (Cloud)' },
    { value: 'gpt-4', label: 'GPT-4 (Cloud)' },
  ];

  // Accent colors
  const accentColors = [
    { value: '#3b82f6', label: 'Blue' },
    { value: '#10b981', label: 'Green' },
    { value: '#f59e0b', label: 'Amber' },
    { value: '#ef4444', label: 'Red' },
    { value: '#8b5cf6', label: 'Purple' },
    { value: '#ec4899', label: 'Pink' },
    { value: '#06b6d4', label: 'Cyan' },
  ];

  return (
    <div className={cn('h-full flex flex-col bg-background', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b shrink-0">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Workspace
          </span>
        </div>
        <div className="flex items-center gap-1">
          {hasChanges && (
            <Badge variant="secondary" className="text-[10px]">
              Modified
            </Badge>
          )}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={handleReset}
                >
                  <RotateCcw className="w-3 h-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Reset to defaults
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={handleSave}
                  disabled={!hasChanges}
                >
                  <Save className="w-3 h-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Save settings
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {/* Project Info */}
          <div className="bg-muted/30 rounded-lg p-3 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Home className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">{workspace.name}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
              <Folder className="w-3 h-3" />
              <span className="truncate flex-1">{workspace.path}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 text-[10px]"
                onClick={() => navigator.clipboard.writeText(workspace.path)}
              >
                Copy
              </Button>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Code className="w-3 h-3" />
                {workspace.fileCount} files
              </span>
              <span className="flex items-center gap-1">
                <FolderOpen className="w-3 h-3" />
                {workspace.folderCount} folders
              </span>
            </div>
          </div>

          {/* Editor Settings */}
          <SettingSection
            title="Editor"
            icon={<Code className="w-4 h-4 text-blue-400" />}
          >
            <SettingItem label="Font Size" description="Editor font size in pixels">
              <Select
                value={settings.fontSize.toString()}
                onValueChange={(v) => updateSettings({ fontSize: parseInt(v) })}
              >
                <SelectTrigger className="w-20 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {fontSizeOptions.map((size) => (
                    <SelectItem key={size} value={size.toString()}>
                      {size}px
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingItem>

            <SettingItem label="Tab Size" description="Number of spaces per tab">
              <Select
                value={settings.tabSize.toString()}
                onValueChange={(v) => updateSettings({ tabSize: parseInt(v) })}
              >
                <SelectTrigger className="w-20 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="4">4</SelectItem>
                  <SelectItem value="8">8</SelectItem>
                </SelectContent>
              </Select>
            </SettingItem>

            <SettingItem label="Word Wrap" description="Wrap lines at viewport width">
              <Switch
                checked={settings.wordWrap}
                onCheckedChange={(checked) => updateSettings({ wordWrap: checked })}
              />
            </SettingItem>

            <SettingItem label="Minimap" description="Show code minimap">
              <Switch
                checked={settings.minimap}
                onCheckedChange={(checked) => updateSettings({ minimap: checked })}
              />
            </SettingItem>

            <SettingItem label="Line Numbers" description="Show line numbers">
              <Select
                value={settings.lineNumbers}
                onValueChange={(v) =>
                  updateSettings({ lineNumbers: v as 'on' | 'off' | 'relative' })
                }
              >
                <SelectTrigger className="w-24 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="on">On</SelectItem>
                  <SelectItem value="off">Off</SelectItem>
                  <SelectItem value="relative">Relative</SelectItem>
                </SelectContent>
              </Select>
            </SettingItem>

            <SettingItem label="Format on Save" description="Auto-format code when saving">
              <Switch
                checked={settings.formatOnSave}
                onCheckedChange={(checked) => updateSettings({ formatOnSave: checked })}
              />
            </SettingItem>
          </SettingSection>

          {/* AI Settings */}
          <SettingSection
            title="AI"
            icon={<Zap className="w-4 h-4 text-yellow-400" />}
          >
            <SettingItem label="Default Model" description="Primary AI model for code assistance">
              <Select
                value={settings.defaultModel}
                onValueChange={(v) => updateSettings({ defaultModel: v })}
              >
                <SelectTrigger className="w-36 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {modelOptions.map((model) => (
                    <SelectItem key={model.value} value={model.value}>
                      {model.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingItem>

            <SettingItem label="Agent Mode" description="Control how AI agents operate">
              <Select
                value={settings.agentMode}
                onValueChange={(v) =>
                  updateSettings({ agentMode: v as 'off' | 'review' | 'agent' | 'strict' })
                }
              >
                <SelectTrigger className="w-24 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="off">Off</SelectItem>
                  <SelectItem value="review">Review</SelectItem>
                  <SelectItem value="agent">Agent</SelectItem>
                  <SelectItem value="strict">Strict</SelectItem>
                </SelectContent>
              </Select>
            </SettingItem>

            <SettingItem label="Auto Suggest" description="Show AI suggestions automatically">
              <Switch
                checked={settings.autoSuggest}
                onCheckedChange={(checked) => updateSettings({ autoSuggest: checked })}
              />
            </SettingItem>
          </SettingSection>

          {/* Appearance Settings */}
          <SettingSection
            title="Appearance"
            icon={<Palette className="w-4 h-4 text-purple-400" />}
          >
            <SettingItem label="Theme" description="Color theme">
              <Select
                value={settings.theme}
                onValueChange={(v) =>
                  updateSettings({ theme: v as 'light' | 'dark' | 'system' })
                }
              >
                <SelectTrigger className="w-24 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
            </SettingItem>

            <SettingItem label="Accent Color" description="UI accent color">
              <div className="flex items-center gap-1">
                {accentColors.map((color) => (
                  <button
                    key={color.value}
                    className={cn(
                      'w-5 h-5 rounded-full border-2 transition-transform',
                      settings.accentColor === color.value
                        ? 'border-foreground scale-110'
                        : 'border-transparent hover:scale-105'
                    )}
                    style={{ backgroundColor: color.value }}
                    onClick={() => updateSettings({ accentColor: color.value })}
                    title={color.label}
                  />
                ))}
              </div>
            </SettingItem>
          </SettingSection>

          {/* Terminal Settings */}
          <SettingSection
            title="Terminal"
            icon={<Monitor className="w-4 h-4 text-green-400" />}
          >
            <SettingItem label="Font Size" description="Terminal font size">
              <Select
                value={settings.terminalFontSize.toString()}
                onValueChange={(v) =>
                  updateSettings({ terminalFontSize: parseInt(v) })
                }
              >
                <SelectTrigger className="w-20 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {fontSizeOptions.map((size) => (
                    <SelectItem key={size} value={size.toString()}>
                      {size}px
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingItem>

            <SettingItem label="Shell" description="Default shell executable">
              <Select
                value={settings.shell}
                onValueChange={(v) => updateSettings({ shell: v })}
              >
                <SelectTrigger className="w-32 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="/bin/bash">bash</SelectItem>
                  <SelectItem value="/bin/zsh">zsh</SelectItem>
                  <SelectItem value="/bin/sh">sh</SelectItem>
                </SelectContent>
              </Select>
            </SettingItem>
          </SettingSection>

          {/* Files Settings */}
          <SettingSection
            title="Files"
            icon={<Database className="w-4 h-4 text-cyan-400" />}
          >
            <SettingItem label="Show Hidden Files" description="Show files starting with .">
              <Switch
                checked={settings.showHiddenFiles}
                onCheckedChange={(checked) => updateSettings({ showHiddenFiles: checked })}
              />
            </SettingItem>

            <SettingItem label="Auto Reveal" description="Reveal file in explorer when opened">
              <Switch
                checked={settings.autoReveal}
                onCheckedChange={(checked) => updateSettings({ autoReveal: checked })}
              />
            </SettingItem>

            <SettingItem label="Auto Save" description="Save files automatically">
              <Switch
                checked={settings.autoSave}
                onCheckedChange={(checked) => updateSettings({ autoSave: checked })}
              />
            </SettingItem>

            {settings.autoSave && (
              <SettingItem
                label="Auto Save Delay"
                description="Delay in milliseconds before auto-save"
              >
                <Input
                  type="number"
                  value={settings.autoSaveDelay}
                  onChange={(e) =>
                    updateSettings({ autoSaveDelay: parseInt(e.target.value) || 1000 })
                  }
                  className="w-20 h-8"
                  min={100}
                  max={10000}
                  step={100}
                />
              </SettingItem>
            )}
          </SettingSection>
        </div>
      </ScrollArea>

      {/* Status */}
      <div className="px-3 py-2 border-t text-xs text-muted-foreground flex items-center justify-between">
        <span className="flex items-center gap-1">
          {hasChanges ? (
            <>
              <AlertCircle className="w-3 h-3 text-yellow-500" />
              Unsaved changes
            </>
          ) : (
            <>
              <Check className="w-3 h-3 text-green-500" />
              Settings saved
            </>
          )}
        </span>
        {savedSettings && (
          <span className="text-[10px]">Last saved: {new Date().toLocaleTimeString()}</span>
        )}
      </div>
    </div>
  );
};

export default WorkspacePanel;
