'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  Palette, Sun, Moon, Monitor, Check, Copy, Download, Upload, Trash2,
  Edit3, Sparkles, Eye, X, Plus, FileJson, AlertCircle, RefreshCw,
  ChevronDown, ChevronUp, Info
} from 'lucide-react';
import {
  Theme,
  BUILT_IN_THEMES,
  useThemeStore,
  applyTheme,
  getSystemTheme,
  onSystemThemeChange,
  importFromVSCode,
  generateCSSVariables,
  getThemePreviewColors,
  generateThemeId,
  isValidHexColor,
} from '@/lib/themes';
import { Textarea } from '@/components/ui/textarea';

// ============================================================================
// COLOR INPUT COMPONENT
// ============================================================================

interface ColorInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  description?: string;
}

function ColorInput({ label, value, onChange, description }: ColorInputProps) {
  const [localValue, setLocalValue] = useState(value);
  
  useEffect(() => {
    setLocalValue(value);
  }, [value]);
  
  const handleChange = (newValue: string) => {
    setLocalValue(newValue);
    if (isValidHexColor(newValue) || isValidHexColor(`#${newValue}`)) {
      onChange(newValue.startsWith('#') ? newValue : `#${newValue}`);
    }
  };
  
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="flex-1 min-w-0">
        <Label className="text-xs font-medium truncate">{label}</Label>
        {description && (
          <p className="text-[10px] text-muted-foreground truncate">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-7 h-7 rounded border cursor-pointer"
        />
        <Input
          value={localValue}
          onChange={(e) => handleChange(e.target.value)}
          className="w-20 h-7 text-xs font-mono"
        />
      </div>
    </div>
  );
}

// ============================================================================
// THEME PREVIEW COMPONENT
// ============================================================================

interface ThemePreviewProps {
  theme: Theme;
  isSelected: boolean;
  onClick: () => void;
}

function ThemePreview({ theme, isSelected, onClick }: ThemePreviewProps) {
  const preview = getThemePreviewColors(theme);
  
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative w-full rounded-lg border p-3 text-left transition-all hover:ring-2 hover:ring-primary/50',
        isSelected && 'ring-2 ring-primary bg-primary/5'
      )}
      style={{ backgroundColor: preview.background }}
    >
      {isSelected && (
        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
          <Check className="w-3 h-3 text-primary-foreground" />
        </div>
      )}
      
      {/* Theme name */}
      <div className="font-semibold text-sm mb-2 truncate" style={{ color: preview.foreground }}>
        {theme.displayName}
      </div>
      
      {/* Syntax preview */}
      <div className="flex gap-1 mb-2">
        {preview.syntax.map((color, i) => (
          <div
            key={i}
            className="w-5 h-5 rounded"
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
      
      {/* Code preview */}
      <div className="font-mono text-[10px] leading-relaxed" style={{ color: preview.foreground }}>
        <div>
          <span style={{ color: preview.syntax[0] }}>function</span>{' '}
          <span style={{ color: preview.syntax[2] }}>hello</span>() {'{'}
        </div>
        <div className="pl-2">
          <span style={{ color: preview.syntax[0] }}>return</span>{' '}
          <span style={{ color: preview.syntax[1] }}>&quot;world&quot;</span>;
        </div>
        <div>{'}'}</div>
      </div>
      
      {/* Theme type badge */}
      <div className="mt-2">
        <Badge 
          variant="outline" 
          className="text-[10px]"
          style={{ 
            borderColor: preview.accent + '40',
            color: preview.foreground,
            opacity: 0.8
          }}
        >
          {theme.type}
        </Badge>
        {theme.custom && (
          <Badge variant="secondary" className="text-[10px] ml-1">custom</Badge>
        )}
      </div>
    </button>
  );
}

// ============================================================================
// THEME EDITOR DIALOG
// ============================================================================

interface ThemeEditorProps {
  theme: Theme | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (theme: Theme) => void;
  isNew?: boolean;
}

function ThemeEditor({ theme, open, onOpenChange, onSave, isNew = false }: ThemeEditorProps) {
  const [editingTheme, setEditingTheme] = useState<Theme | null>(() => theme ? { ...theme } : null);
  const [activeTab, setActiveTab] = useState('general');
  
  // Sync theme prop changes using key prop pattern (handled by parent)
  // When the dialog opens with a new theme, the parent should remount this component
  
  if (!editingTheme) return null;
  
  const updateTheme = (updates: Partial<Theme>) => {
    setEditingTheme(prev => prev ? { ...prev, ...updates } : null);
  };
  
  const updateColor = (category: 'colors' | 'syntax', key: string, value: string) => {
    setEditingTheme(prev => {
      if (!prev) return null;
      return {
        ...prev,
        [category]: {
          ...prev[category],
          [key]: value,
        },
      };
    });
  };
  
  const handleSave = () => {
    if (editingTheme) {
      onSave(editingTheme);
      onOpenChange(false);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 gap-0">
        <DialogHeader className="p-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Edit3 className="w-4 h-4" />
            {isNew ? 'Create New Theme' : 'Edit Theme'}
          </DialogTitle>
          <DialogDescription>
            Customize colors for the IDE interface and syntax highlighting
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex h-[70vh]">
          {/* Sidebar */}
          <div className="w-48 border-r bg-muted/30 p-2">
            <div className="space-y-1">
              <Button
                variant={activeTab === 'general' ? 'secondary' : 'ghost'}
                size="sm"
                className="w-full justify-start"
                onClick={() => setActiveTab('general')}
              >
                General
              </Button>
              <Button
                variant={activeTab === 'ui' ? 'secondary' : 'ghost'}
                size="sm"
                className="w-full justify-start"
                onClick={() => setActiveTab('ui')}
              >
                UI Colors
              </Button>
              <Button
                variant={activeTab === 'editor' ? 'secondary' : 'ghost'}
                size="sm"
                className="w-full justify-start"
                onClick={() => setActiveTab('editor')}
              >
                Editor
              </Button>
              <Button
                variant={activeTab === 'syntax' ? 'secondary' : 'ghost'}
                size="sm"
                className="w-full justify-start"
                onClick={() => setActiveTab('syntax')}
              >
                Syntax
              </Button>
              <Button
                variant={activeTab === 'terminal' ? 'secondary' : 'ghost'}
                size="sm"
                className="w-full justify-start"
                onClick={() => setActiveTab('terminal')}
              >
                Terminal
              </Button>
            </div>
          </div>
          
          {/* Content */}
          <ScrollArea className="flex-1 p-4">
            {activeTab === 'general' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Theme Name</Label>
                    <Input
                      value={editingTheme.displayName}
                      onChange={(e) => updateTheme({ 
                        displayName: e.target.value,
                        name: e.target.value.toLowerCase().replace(/\s+/g, '-'),
                        id: isNew ? generateThemeId(e.target.value) : editingTheme.id,
                      })}
                      placeholder="My Theme"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Theme Type</Label>
                    <Select
                      value={editingTheme.type}
                      onValueChange={(v) => updateTheme({ type: v as 'light' | 'dark' })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dark">Dark</SelectItem>
                        <SelectItem value="light">Light</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={editingTheme.description || ''}
                    onChange={(e) => updateTheme({ description: e.target.value })}
                    placeholder="A beautiful theme for coding"
                    rows={2}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Author</Label>
                  <Input
                    value={editingTheme.author || ''}
                    onChange={(e) => updateTheme({ author: e.target.value })}
                    placeholder="Your name"
                  />
                </div>
              </div>
            )}
            
            {activeTab === 'ui' && (
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Base Colors</h4>
                  <div className="grid grid-cols-2 gap-x-4">
                    <ColorInput
                      label="Background"
                      value={editingTheme.colors.background}
                      onChange={(v) => updateColor('colors', 'background', v)}
                    />
                    <ColorInput
                      label="Foreground"
                      value={editingTheme.colors.foreground}
                      onChange={(v) => updateColor('colors', 'foreground', v)}
                    />
                  </div>
                </div>
                
                <Separator />
                
                <div>
                  <h4 className="font-medium mb-2">Primary Colors</h4>
                  <div className="grid grid-cols-2 gap-x-4">
                    <ColorInput
                      label="Primary"
                      value={editingTheme.colors.primary}
                      onChange={(v) => updateColor('colors', 'primary', v)}
                    />
                    <ColorInput
                      label="Primary Foreground"
                      value={editingTheme.colors.primaryForeground}
                      onChange={(v) => updateColor('colors', 'primaryForeground', v)}
                    />
                    <ColorInput
                      label="Secondary"
                      value={editingTheme.colors.secondary}
                      onChange={(v) => updateColor('colors', 'secondary', v)}
                    />
                    <ColorInput
                      label="Secondary Foreground"
                      value={editingTheme.colors.secondaryForeground}
                      onChange={(v) => updateColor('colors', 'secondaryForeground', v)}
                    />
                    <ColorInput
                      label="Accent"
                      value={editingTheme.colors.accent}
                      onChange={(v) => updateColor('colors', 'accent', v)}
                    />
                    <ColorInput
                      label="Muted"
                      value={editingTheme.colors.muted}
                      onChange={(v) => updateColor('colors', 'muted', v)}
                    />
                  </div>
                </div>
                
                <Separator />
                
                <div>
                  <h4 className="font-medium mb-2">Border & Input</h4>
                  <div className="grid grid-cols-2 gap-x-4">
                    <ColorInput
                      label="Border"
                      value={editingTheme.colors.border}
                      onChange={(v) => updateColor('colors', 'border', v)}
                    />
                    <ColorInput
                      label="Input"
                      value={editingTheme.colors.input}
                      onChange={(v) => updateColor('colors', 'input', v)}
                    />
                    <ColorInput
                      label="Ring"
                      value={editingTheme.colors.ring}
                      onChange={(v) => updateColor('colors', 'ring', v)}
                    />
                    <ColorInput
                      label="Destructive"
                      value={editingTheme.colors.destructive}
                      onChange={(v) => updateColor('colors', 'destructive', v)}
                    />
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'editor' && (
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Editor Base</h4>
                  <div className="grid grid-cols-2 gap-x-4">
                    <ColorInput
                      label="Editor Background"
                      value={editingTheme.colors.editorBackground}
                      onChange={(v) => updateColor('colors', 'editorBackground', v)}
                    />
                    <ColorInput
                      label="Editor Foreground"
                      value={editingTheme.colors.editorForeground}
                      onChange={(v) => updateColor('colors', 'editorForeground', v)}
                    />
                  </div>
                </div>
                
                <Separator />
                
                <div>
                  <h4 className="font-medium mb-2">Line Numbers & Cursor</h4>
                  <div className="grid grid-cols-2 gap-x-4">
                    <ColorInput
                      label="Line Numbers"
                      value={editingTheme.colors.editorLineNumber}
                      onChange={(v) => updateColor('colors', 'editorLineNumber', v)}
                    />
                    <ColorInput
                      label="Active Line Number"
                      value={editingTheme.colors.editorLineNumberActive}
                      onChange={(v) => updateColor('colors', 'editorLineNumberActive', v)}
                    />
                    <ColorInput
                      label="Cursor"
                      value={editingTheme.colors.editorCursor}
                      onChange={(v) => updateColor('colors', 'editorCursor', v)}
                    />
                    <ColorInput
                      label="Current Line"
                      value={editingTheme.colors.editorCurrentLine}
                      onChange={(v) => updateColor('colors', 'editorCurrentLine', v)}
                    />
                  </div>
                </div>
                
                <Separator />
                
                <div>
                  <h4 className="font-medium mb-2">Selection & Highlights</h4>
                  <div className="grid grid-cols-2 gap-x-4">
                    <ColorInput
                      label="Selection"
                      value={editingTheme.colors.editorSelection}
                      onChange={(v) => updateColor('colors', 'editorSelection', v)}
                    />
                    <ColorInput
                      label="Selection Background"
                      value={editingTheme.colors.editorSelectionBackground}
                      onChange={(v) => updateColor('colors', 'editorSelectionBackground', v)}
                    />
                    <ColorInput
                      label="Find Match"
                      value={editingTheme.colors.editorFindMatch}
                      onChange={(v) => updateColor('colors', 'editorFindMatch', v)}
                    />
                    <ColorInput
                      label="Bracket Match"
                      value={editingTheme.colors.editorBracketMatch}
                      onChange={(v) => updateColor('colors', 'editorBracketMatch', v)}
                    />
                  </div>
                </div>
                
                <Separator />
                
                <div>
                  <h4 className="font-medium mb-2">Indent Guides</h4>
                  <div className="grid grid-cols-2 gap-x-4">
                    <ColorInput
                      label="Indent Guide"
                      value={editingTheme.colors.editorIndentGuide}
                      onChange={(v) => updateColor('colors', 'editorIndentGuide', v)}
                    />
                    <ColorInput
                      label="Active Indent Guide"
                      value={editingTheme.colors.editorIndentGuideActive}
                      onChange={(v) => updateColor('colors', 'editorIndentGuideActive', v)}
                    />
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'syntax' && (
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Comments</h4>
                  <div className="grid grid-cols-2 gap-x-4">
                    <ColorInput
                      label="Comment"
                      value={editingTheme.syntax.comment}
                      onChange={(v) => updateColor('syntax', 'comment', v)}
                    />
                    <ColorInput
                      label="Doc Comment"
                      value={editingTheme.syntax.commentDoc}
                      onChange={(v) => updateColor('syntax', 'commentDoc', v)}
                    />
                  </div>
                </div>
                
                <Separator />
                
                <div>
                  <h4 className="font-medium mb-2">Keywords & Types</h4>
                  <div className="grid grid-cols-2 gap-x-4">
                    <ColorInput
                      label="Keyword"
                      value={editingTheme.syntax.keyword}
                      onChange={(v) => updateColor('syntax', 'keyword', v)}
                    />
                    <ColorInput
                      label="Type"
                      value={editingTheme.syntax.type}
                      onChange={(v) => updateColor('syntax', 'type', v)}
                    />
                    <ColorInput
                      label="Class"
                      value={editingTheme.syntax.class}
                      onChange={(v) => updateColor('syntax', 'class', v)}
                    />
                    <ColorInput
                      label="Interface"
                      value={editingTheme.syntax.interface}
                      onChange={(v) => updateColor('syntax', 'interface', v)}
                    />
                  </div>
                </div>
                
                <Separator />
                
                <div>
                  <h4 className="font-medium mb-2">Functions & Variables</h4>
                  <div className="grid grid-cols-2 gap-x-4">
                    <ColorInput
                      label="Function"
                      value={editingTheme.syntax.function}
                      onChange={(v) => updateColor('syntax', 'function', v)}
                    />
                    <ColorInput
                      label="Method"
                      value={editingTheme.syntax.method}
                      onChange={(v) => updateColor('syntax', 'method', v)}
                    />
                    <ColorInput
                      label="Variable"
                      value={editingTheme.syntax.variable}
                      onChange={(v) => updateColor('syntax', 'variable', v)}
                    />
                    <ColorInput
                      label="Parameter"
                      value={editingTheme.syntax.variableParameter}
                      onChange={(v) => updateColor('syntax', 'variableParameter', v)}
                    />
                  </div>
                </div>
                
                <Separator />
                
                <div>
                  <h4 className="font-medium mb-2">Strings & Numbers</h4>
                  <div className="grid grid-cols-2 gap-x-4">
                    <ColorInput
                      label="String"
                      value={editingTheme.syntax.string}
                      onChange={(v) => updateColor('syntax', 'string', v)}
                    />
                    <ColorInput
                      label="Number"
                      value={editingTheme.syntax.number}
                      onChange={(v) => updateColor('syntax', 'number', v)}
                    />
                    <ColorInput
                      label="Escape"
                      value={editingTheme.syntax.stringEscape}
                      onChange={(v) => updateColor('syntax', 'stringEscape', v)}
                    />
                    <ColorInput
                      label="Constant"
                      value={editingTheme.syntax.constant}
                      onChange={(v) => updateColor('syntax', 'constant', v)}
                    />
                  </div>
                </div>
                
                <Separator />
                
                <div>
                  <h4 className="font-medium mb-2">Tags (HTML/JSX)</h4>
                  <div className="grid grid-cols-2 gap-x-4">
                    <ColorInput
                      label="Tag"
                      value={editingTheme.syntax.tag}
                      onChange={(v) => updateColor('syntax', 'tag', v)}
                    />
                    <ColorInput
                      label="Tag Name"
                      value={editingTheme.syntax.tagName}
                      onChange={(v) => updateColor('syntax', 'tagName', v)}
                    />
                    <ColorInput
                      label="Attribute"
                      value={editingTheme.syntax.tagAttribute}
                      onChange={(v) => updateColor('syntax', 'tagAttribute', v)}
                    />
                  </div>
                </div>
                
                <Separator />
                
                <div>
                  <h4 className="font-medium mb-2">Diff Colors</h4>
                  <div className="grid grid-cols-2 gap-x-4">
                    <ColorInput
                      label="Added"
                      value={editingTheme.syntax.diffAdded}
                      onChange={(v) => updateColor('syntax', 'diffAdded', v)}
                    />
                    <ColorInput
                      label="Removed"
                      value={editingTheme.syntax.diffRemoved}
                      onChange={(v) => updateColor('syntax', 'diffRemoved', v)}
                    />
                    <ColorInput
                      label="Modified"
                      value={editingTheme.syntax.diffModified}
                      onChange={(v) => updateColor('syntax', 'diffModified', v)}
                    />
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'terminal' && (
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Terminal Base</h4>
                  <div className="grid grid-cols-2 gap-x-4">
                    <ColorInput
                      label="Terminal Background"
                      value={editingTheme.colors.terminalBackground}
                      onChange={(v) => updateColor('colors', 'terminalBackground', v)}
                    />
                    <ColorInput
                      label="Terminal Foreground"
                      value={editingTheme.colors.terminalForeground}
                      onChange={(v) => updateColor('colors', 'terminalForeground', v)}
                    />
                    <ColorInput
                      label="Cursor"
                      value={editingTheme.colors.terminalCursor}
                      onChange={(v) => updateColor('colors', 'terminalCursor', v)}
                    />
                    <ColorInput
                      label="Selection"
                      value={editingTheme.colors.terminalSelection}
                      onChange={(v) => updateColor('colors', 'terminalSelection', v)}
                    />
                  </div>
                </div>
              </div>
            )}
          </ScrollArea>
        </div>
        
        <DialogFooter className="p-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            {isNew ? 'Create Theme' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// IMPORT THEME DIALOG
// ============================================================================

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (theme: Theme) => void;
}

function ImportDialog({ open, onOpenChange, onImport }: ImportDialogProps) {
  const [importType, setImportType] = useState<'kyro' | 'vscode'>('kyro');
  const [importData, setImportData] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const handleImport = () => {
    setError(null);
    
    try {
      const parsed = JSON.parse(importData);
      
      if (importType === 'vscode') {
        const theme = importFromVSCode(parsed);
        onImport(theme);
        onOpenChange(false);
        setImportData('');
      } else {
        // Kyro theme format
        if (!parsed.theme) {
          throw new Error('Invalid Kyro theme format');
        }
        onImport(parsed.theme);
        onOpenChange(false);
        setImportData('');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to parse theme');
    }
  };
  
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      setImportData(event.target?.result as string);
    };
    reader.readAsText(file);
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Import Theme
          </DialogTitle>
          <DialogDescription>
            Import a theme from a JSON file
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Import Type</Label>
            <Select value={importType} onValueChange={(v) => setImportType(v as 'kyro' | 'vscode')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="kyro">Kyro IDE Theme</SelectItem>
                <SelectItem value="vscode">VS Code Theme</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label>Theme JSON</Label>
            <Textarea
              value={importData}
              onChange={(e) => setImportData(e.target.value)}
              placeholder={`Paste ${importType === 'vscode' ? 'VS Code' : 'Kyro IDE'} theme JSON here...`}
              rows={10}
              className="font-mono text-xs"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
              id="theme-file-upload"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => document.getElementById('theme-file-upload')?.click()}
            >
              <FileJson className="w-3 h-3 mr-2" />
              Upload File
            </Button>
          </div>
          
          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={!importData}>
            Import Theme
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// MAIN THEME SETTINGS COMPONENT
// ============================================================================

interface ThemeSettingsProps {
  className?: string;
}

export default function ThemeSettings({ className }: ThemeSettingsProps) {
  const {
    activeThemeId,
    preferredTheme,
    customThemes,
    setActiveTheme,
    setPreferredTheme,
    addCustomTheme,
    updateCustomTheme,
    deleteCustomTheme,
    duplicateTheme,
    exportTheme,
    importTheme,
    getAllThemes,
  } = useThemeStore();
  
  const [filter, setFilter] = useState<'all' | 'light' | 'dark' | 'custom'>('all');
  const [editingTheme, setEditingTheme] = useState<Theme | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isNewTheme, setIsNewTheme] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(() => getSystemTheme());
  const [expandedSection, setExpandedSection] = useState<string | null>('themes');
  
  // System theme change listener
  useEffect(() => {
    const unsubscribe = onSystemThemeChange(setSystemTheme);
    return unsubscribe;
  }, []);
  
  // Apply theme on change
  useEffect(() => {
    const activeTheme = getAllThemes().find(t => t.id === activeThemeId);
    if (activeTheme) {
      applyTheme(activeTheme);
    }
  }, [activeThemeId, getAllThemes]);
  
  // Handle preferred theme with system detection
  useEffect(() => {
    if (preferredTheme === 'system') {
      const themeToUse = systemTheme === 'dark' 
        ? 'kyro-dark' 
        : 'kyro-light';
      setActiveTheme(themeToUse);
    }
  }, [preferredTheme, systemTheme, setActiveTheme]);
  
  const filteredThemes = getAllThemes().filter(theme => {
    if (filter === 'all') return true;
    if (filter === 'custom') return theme.custom;
    return theme.type === filter;
  });
  
  const handleThemeSelect = (themeId: string) => {
    setActiveTheme(themeId);
    if (preferredTheme === 'system') {
      setPreferredTheme('dark');
    }
  };
  
  const handleCreateTheme = () => {
    const newTheme: Theme = {
      id: generateThemeId('new-theme'),
      name: 'New Theme',
      displayName: 'New Theme',
      description: 'A custom theme',
      type: 'dark',
      colors: { ...getAllThemes()[0].colors },
      syntax: { ...getAllThemes()[0].syntax },
      custom: true,
    };
    setEditingTheme(newTheme);
    setIsNewTheme(true);
    setIsEditorOpen(true);
  };
  
  const handleEditTheme = (theme: Theme) => {
    setEditingTheme(theme);
    setIsNewTheme(false);
    setIsEditorOpen(true);
  };
  
  const handleSaveTheme = (theme: Theme) => {
    if (isNewTheme) {
      addCustomTheme(theme);
    } else {
      updateCustomTheme(theme.id, theme);
    }
  };
  
  const handleDuplicateTheme = (themeId: string) => {
    const duplicated = duplicateTheme(themeId);
    if (duplicated) {
      setActiveTheme(duplicated.id);
    }
  };
  
  const handleExportTheme = (themeId: string) => {
    const exported = exportTheme(themeId);
    if (exported) {
      const blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${exported.theme.name}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };
  
  const handleImportTheme = (theme: Theme) => {
    const result = importTheme({ version: '1.0.0', exportedAt: new Date().toISOString(), theme });
    if (result.success && result.theme) {
      setActiveTheme(result.theme.id);
    }
  };
  
  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };
  
  return (
    <div className={cn('h-full', className)}>
      <Tabs defaultValue="themes" className="h-full flex flex-col">
        <TabsList className="mx-4 mt-4 shrink-0">
          <TabsTrigger value="themes">
            <Palette className="w-3 h-3 mr-1" />
            Themes
          </TabsTrigger>
          <TabsTrigger value="appearance">
            <Sparkles className="w-3 h-3 mr-1" />
            Appearance
          </TabsTrigger>
        </TabsList>
        
        <ScrollArea className="flex-1 p-4">
          <TabsContent value="themes" className="space-y-4 m-0">
            {/* Theme Mode Selection */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Theme Mode</CardTitle>
                <CardDescription>Choose your preferred color scheme mode</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant={preferredTheme === 'light' ? 'default' : 'outline'}
                    size="sm"
                    className="justify-start"
                    onClick={() => setPreferredTheme('light')}
                  >
                    <Sun className="w-4 h-4 mr-2" />
                    Light
                  </Button>
                  <Button
                    variant={preferredTheme === 'dark' ? 'default' : 'outline'}
                    size="sm"
                    className="justify-start"
                    onClick={() => setPreferredTheme('dark')}
                  >
                    <Moon className="w-4 h-4 mr-2" />
                    Dark
                  </Button>
                  <Button
                    variant={preferredTheme === 'system' ? 'default' : 'outline'}
                    size="sm"
                    className="justify-start"
                    onClick={() => setPreferredTheme('system')}
                  >
                    <Monitor className="w-4 h-4 mr-2" />
                    System
                    {preferredTheme === 'system' && (
                      <Badge variant="secondary" className="ml-2 text-[10px]">
                        {systemTheme}
                      </Badge>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
            
            {/* Theme Gallery */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm">Theme Gallery</CardTitle>
                    <CardDescription>Select a theme to customize your IDE</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleCreateTheme}>
                      <Plus className="w-3 h-3 mr-1" />
                      New
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setIsImportOpen(true)}>
                      <Upload className="w-3 h-3 mr-1" />
                      Import
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Filter tabs */}
                <div className="flex gap-1 mb-4">
                  {(['all', 'light', 'dark', 'custom'] as const).map((f) => (
                    <Button
                      key={f}
                      variant={filter === f ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setFilter(f)}
                    >
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </Button>
                  ))}
                </div>
                
                {/* Theme grid */}
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredThemes.map((theme) => (
                    <div key={theme.id} className="relative group">
                      <ThemePreview
                        theme={theme}
                        isSelected={activeThemeId === theme.id}
                        onClick={() => handleThemeSelect(theme.id)}
                      />
                      
                      {/* Action buttons */}
                      <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="flex gap-1">
                          <Button
                            variant="secondary"
                            size="icon"
                            className="w-6 h-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDuplicateTheme(theme.id);
                            }}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="secondary"
                            size="icon"
                            className="w-6 h-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleExportTheme(theme.id);
                            }}
                          >
                            <Download className="w-3 h-3" />
                          </Button>
                          {theme.custom && (
                            <>
                              <Button
                                variant="secondary"
                                size="icon"
                                className="w-6 h-6"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditTheme(theme);
                                }}
                              >
                                <Edit3 className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="secondary"
                                size="icon"
                                className="w-6 h-6 text-destructive hover:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteCustomTheme(theme.id);
                                }}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            {/* VS Code Compatibility Info */}
            <Card>
              <CardHeader className="pb-3">
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => toggleSection('vscode')}
                >
                  <div>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileJson className="w-4 h-4" />
                      VS Code Theme Compatibility
                    </CardTitle>
                    <CardDescription>Import themes from VS Code</CardDescription>
                  </div>
                  {expandedSection === 'vscode' ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </div>
              </CardHeader>
              {expandedSection === 'vscode' && (
                <CardContent>
                  <div className="space-y-3 text-sm text-muted-foreground">
                    <p>
                      Kyro IDE supports importing VS Code themes. Simply export your VS Code theme as JSON and import it using the button above.
                    </p>
                    <div className="flex items-center gap-2">
                      <Info className="w-4 h-4 text-blue-400" />
                      <span>Supported: VS Code theme JSON format with colors and tokenColors</span>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          </TabsContent>
          
          <TabsContent value="appearance" className="space-y-4 m-0">
            {/* Syntax Highlighting */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Syntax Highlighting</CardTitle>
                <CardDescription>Configure code syntax colors</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Syntax highlighting colors are defined by the active theme. To customize syntax colors, create or edit a custom theme.
                </p>
                <Button variant="outline" size="sm" onClick={() => {
                  const activeTheme = getAllThemes().find(t => t.id === activeThemeId);
                  if (activeTheme) {
                    handleEditTheme(activeTheme);
                  }
                }}>
                  <Edit3 className="w-3 h-3 mr-2" />
                  Edit Current Theme Syntax
                </Button>
              </CardContent>
            </Card>
            
            {/* CSS Variables Export */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Developer Options</CardTitle>
                <CardDescription>Export theme for custom styling</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Export CSS variables for the current theme to use in custom stylesheets or plugins.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const theme = getAllThemes().find(t => t.id === activeThemeId);
                      if (theme) {
                        const css = generateCSSVariables(theme);
                        navigator.clipboard.writeText(css);
                      }
                    }}
                  >
                    <Copy className="w-3 h-3 mr-2" />
                    Copy CSS Variables
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const theme = getAllThemes().find(t => t.id === activeThemeId);
                      if (theme) {
                        const css = generateCSSVariables(theme);
                        const blob = new Blob([css], { type: 'text/css' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${theme.name}-variables.css`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }
                    }}
                  >
                    <Download className="w-3 h-3 mr-2" />
                    Export CSS File
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </ScrollArea>
      </Tabs>
      
      {/* Theme Editor Dialog */}
      <ThemeEditor
        theme={editingTheme}
        open={isEditorOpen}
        onOpenChange={setIsEditorOpen}
        onSave={handleSaveTheme}
        isNew={isNewTheme}
      />
      
      {/* Import Dialog */}
      <ImportDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        onImport={handleImportTheme}
      />
    </div>
  );
}
