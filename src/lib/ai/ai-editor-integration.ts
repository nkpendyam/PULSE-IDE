/**
 * Kyro IDE - AI Editor Integration
 * 
 * Connects AI service to the editor, handles code generation requests,
 * applies AI suggestions, and tracks applied suggestions.
 * 
 * Uses Monaco's edit operations API for applying changes.
 */

import { DiffEngine, FileDiff, EditOperation } from './diff-engine';
import { EditManager, PendingEdit, EditBatch, ConflictResolution } from './edit-manager';
import { MultiFileEditor, MultiFileEdit, FileInfo } from './multi-file-editor';
import { EditPreviewManager, EditPreview } from './edit-preview';

// ============================================================================
// TYPES
// ============================================================================

export interface AIEditRequest {
  type: 'inline' | 'file' | 'multi-file' | 'refactor' | 'generate';
  prompt: string;
  context?: {
    fileId?: string;
    selection?: {
      startLine: number;
      endLine: number;
      startColumn?: number;
      endColumn?: number;
    };
    language?: string;
    relatedFiles?: string[];
  };
  options?: AIEditOptions;
}

export interface AIEditOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  showPreview?: boolean;
  atomicApply?: boolean;
  autoAccept?: boolean;
}

export interface AIEditResponse {
  id: string;
  success: boolean;
  edits: AIEditSuggestion[];
  preview?: EditPreview;
  error?: string;
  metadata?: {
    model: string;
    tokens: number;
    latency: number;
  };
}

export interface AIEditSuggestion {
  id: string;
  fileId: string;
  filePath: string;
  oldContent: string;
  newContent: string;
  description?: string;
  confidence: number;
  type: 'replace' | 'insert' | 'delete' | 'rename';
}

export interface CodeGenerationRequest {
  prompt: string;
  language: string;
  context?: {
    precedingCode?: string;
    followingCode?: string;
    imports?: string[];
    symbols?: string[];
  };
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  };
}

export interface CodeGenerationResponse {
  code: string;
  language: string;
  imports?: string[];
  explanation?: string;
  metadata: {
    model: string;
    tokens: number;
    latency: number;
  };
}

export interface AppliedSuggestion {
  id: string;
  suggestionId: string;
  timestamp: Date;
  fileId: string;
  reverted: boolean;
  feedback?: 'helpful' | 'not-helpful' | 'incorrect';
}

export interface EditorState {
  activeFile: string | null;
  openFiles: Map<string, FileInfo>;
  selection: {
    startLine: number;
    endLine: number;
    startColumn: number;
    endColumn: number;
  } | null;
}

export type IntegrationEventType =
  | 'request-started'
  | 'request-completed'
  | 'suggestion-received'
  | 'suggestion-applied'
  | 'suggestion-rejected'
  | 'suggestion-reverted'
  | 'preview-shown'
  | 'error';

export interface IntegrationEvent {
  type: IntegrationEventType;
  payload: unknown;
  timestamp: Date;
}

type IntegrationEventListener = (event: IntegrationEvent) => void;

// ============================================================================
// AI EDITOR INTEGRATION CLASS
// ============================================================================

export class AIEditorIntegration {
  private diffEngine: DiffEngine;
  private editManager: EditManager;
  private multiFileEditor: MultiFileEditor;
  private previewManager: EditPreviewManager;
  private appliedSuggestions: Map<string, AppliedSuggestion> = new Map();
  private listeners: Set<IntegrationEventListener> = new Set();
  private editorState: EditorState;
  private suggestionHistory: AIEditSuggestion[] = [];

  constructor() {
    this.diffEngine = new DiffEngine();
    this.editManager = new EditManager();
    this.multiFileEditor = new MultiFileEditor();
    this.previewManager = new EditPreviewManager();
    
    this.editorState = {
      activeFile: null,
      openFiles: new Map(),
      selection: null
    };
  }

  // ============================================================================
  // EDITOR STATE MANAGEMENT
  // ============================================================================

  /**
   * Update editor state
   */
  updateEditorState(state: Partial<EditorState>): void {
    this.editorState = { ...this.editorState, ...state };
    
    // Register files with edit manager
    if (state.openFiles) {
      for (const [id, file] of state.openFiles) {
        this.editManager.registerFile(id, file.content);
        this.multiFileEditor.registerFile(file);
      }
    }
  }

  /**
   * Get current editor state
   */
  getEditorState(): EditorState {
    return { ...this.editorState };
  }

  /**
   * Register an open file
   */
  registerFile(file: FileInfo): void {
    this.editorState.openFiles.set(file.id, file);
    this.editManager.registerFile(file.id, file.content);
    this.multiFileEditor.registerFile(file);
  }

  /**
   * Update file content
   */
  updateFileContent(fileId: string, content: string): void {
    const file = this.editorState.openFiles.get(fileId);
    if (file) {
      file.content = content;
      file.version++;
      file.isDirty = true;
      file.lastModified = new Date();
      
      this.editManager.updateFileContent(fileId, content);
      this.multiFileEditor.updateFileContent(fileId, content);
    }
  }

  // ============================================================================
  // AI EDIT REQUESTS
  // ============================================================================

  /**
   * Process an AI edit request
   */
  async processEditRequest(
    request: AIEditRequest,
    generateCode: (prompt: string, context?: CodeGenerationRequest['context'], options?: CodeGenerationRequest['options']) => Promise<CodeGenerationResponse>
  ): Promise<AIEditResponse> {
    const id = this.generateId();
    
    this.emit({
      type: 'request-started',
      payload: { id, request },
      timestamp: new Date()
    });
    
    try {
      let suggestions: AIEditSuggestion[] = [];
      let preview: EditPreview | undefined;
      
      switch (request.type) {
        case 'inline':
          suggestions = await this.processInlineEdit(request, generateCode);
          break;
        case 'file':
          suggestions = await this.processFileEdit(request, generateCode);
          break;
        case 'multi-file':
          suggestions = await this.processMultiFileEdit(request, generateCode);
          break;
        case 'refactor':
          suggestions = await this.processRefactor(request, generateCode);
          break;
        case 'generate':
          suggestions = await this.processGenerate(request, generateCode);
          break;
      }
      
      // Store suggestions in history
      this.suggestionHistory.push(...suggestions);
      
      // Create preview if requested
      if (request.options?.showPreview !== false && suggestions.length > 0) {
        preview = this.createPreview(suggestions);
      }
      
      // Auto-accept if configured
      if (request.options?.autoAccept && suggestions.length > 0) {
        for (const suggestion of suggestions) {
          await this.applySuggestion(suggestion);
        }
      }
      
      const response: AIEditResponse = {
        id,
        success: true,
        edits: suggestions,
        preview
      };
      
      this.emit({
        type: 'request-completed',
        payload: response,
        timestamp: new Date()
      });
      
      return response;
    } catch (error) {
      const response: AIEditResponse = {
        id,
        success: false,
        edits: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      
      this.emit({
        type: 'error',
        payload: { id, error: response.error },
        timestamp: new Date()
      });
      
      return response;
    }
  }

  /**
   * Process inline edit request
   */
  private async processInlineEdit(
    request: AIEditRequest,
    generateCode: (prompt: string, context?: CodeGenerationRequest['context'], options?: CodeGenerationRequest['options']) => Promise<CodeGenerationResponse>
  ): Promise<AIEditSuggestion[]> {
    const fileId = request.context?.fileId;
    if (!fileId) return [];
    
    const file = this.editorState.openFiles.get(fileId);
    if (!file) return [];
    
    const selection = request.context?.selection;
    const lines = file.content.split('\n');
    
    // Get selected code
    let oldContent = '';
    if (selection) {
      oldContent = lines.slice(selection.startLine - 1, selection.endLine).join('\n');
    }
    
    // Generate new code
    const response = await generateCode(
      request.prompt,
      {
        language: file.language,
        precedingCode: selection ? lines.slice(0, selection.startLine - 1).join('\n') : undefined,
        followingCode: selection ? lines.slice(selection.endLine).join('\n') : undefined
      },
      {
        model: request.options?.model,
        temperature: request.options?.temperature,
        maxTokens: request.options?.maxTokens
      }
    );
    
    // Extract code from response
    const newContent = this.extractCode(response.code, file.language);
    
    return [{
      id: this.generateId(),
      fileId,
      filePath: file.path,
      oldContent,
      newContent,
      description: request.prompt,
      confidence: 0.8,
      type: oldContent ? 'replace' : 'insert'
    }];
  }

  /**
   * Process file edit request
   */
  private async processFileEdit(
    request: AIEditRequest,
    generateCode: (prompt: string, context?: CodeGenerationRequest['context'], options?: CodeGenerationRequest['options']) => Promise<CodeGenerationResponse>
  ): Promise<AIEditSuggestion[]> {
    const fileId = request.context?.fileId;
    if (!fileId) return [];
    
    const file = this.editorState.openFiles.get(fileId);
    if (!file) return [];
    
    // Generate new file content
    const response = await generateCode(
      `Modify this ${file.language} file: ${request.prompt}\n\nCurrent content:\n\`\`\`${file.language}\n${file.content}\n\`\`\``,
      {
        language: file.language
      },
      {
        model: request.options?.model,
        temperature: request.options?.temperature,
        maxTokens: request.options?.maxTokens
      }
    );
    
    const newContent = this.extractCode(response.code, file.language);
    
    return [{
      id: this.generateId(),
      fileId,
      filePath: file.path,
      oldContent: file.content,
      newContent,
      description: request.prompt,
      confidence: 0.7,
      type: 'replace'
    }];
  }

  /**
   * Process multi-file edit request
   */
  private async processMultiFileEdit(
    request: AIEditRequest,
    generateCode: (prompt: string, context?: CodeGenerationRequest['context'], options?: CodeGenerationRequest['options']) => Promise<CodeGenerationResponse>
  ): Promise<AIEditSuggestion[]> {
    const suggestions: AIEditSuggestion[] = [];
    const relatedFiles = request.context?.relatedFiles ?? [];
    
    // Generate changes for each file
    for (const fileId of relatedFiles) {
      const file = this.editorState.openFiles.get(fileId);
      if (!file) continue;
      
      const response = await generateCode(
        `Apply the following change to this ${file.language} file: ${request.prompt}\n\nCurrent content:\n\`\`\`${file.language}\n${file.content}\n\`\`\``,
        {
          language: file.language
        },
        {
          model: request.options?.model,
          temperature: request.options?.temperature,
          maxTokens: request.options?.maxTokens
        }
      );
      
      const newContent = this.extractCode(response.code, file.language);
      
      suggestions.push({
        id: this.generateId(),
        fileId,
        filePath: file.path,
        oldContent: file.content,
        newContent,
        description: request.prompt,
        confidence: 0.6,
        type: 'replace'
      });
    }
    
    return suggestions;
  }

  /**
   * Process refactor request
   */
  private async processRefactor(
    request: AIEditRequest,
    generateCode: (prompt: string, context?: CodeGenerationRequest['context'], options?: CodeGenerationRequest['options']) => Promise<CodeGenerationResponse>
  ): Promise<AIEditSuggestion[]> {
    // Similar to multi-file edit but with refactoring-specific logic
    return this.processMultiFileEdit(request, generateCode);
  }

  /**
   * Process generate request
   */
  private async processGenerate(
    request: AIEditRequest,
    generateCode: (prompt: string, context?: CodeGenerationRequest['context'], options?: CodeGenerationRequest['options']) => Promise<CodeGenerationResponse>
  ): Promise<AIEditSuggestion[]> {
    const language = request.context?.language ?? 'typescript';
    const fileId = request.context?.fileId ?? this.generateId();
    const filePath = `generated.${this.getFileExtension(language)}`;
    
    const response = await generateCode(
      request.prompt,
      {
        language
      },
      {
        model: request.options?.model,
        temperature: request.options?.temperature,
        maxTokens: request.options?.maxTokens
      }
    );
    
    return [{
      id: this.generateId(),
      fileId,
      filePath,
      oldContent: '',
      newContent: response.code,
      description: request.prompt,
      confidence: 0.9,
      type: 'insert'
    }];
  }

  // ============================================================================
  // SUGGESTION MANAGEMENT
  // ============================================================================

  /**
   * Apply a suggestion
   */
  async applySuggestion(suggestion: AIEditSuggestion): Promise<boolean> {
    const file = this.editorState.openFiles.get(suggestion.fileId);
    if (!file) return false;
    
    // Create pending edit
    const edit = this.editManager.createPendingEdit(
      suggestion.fileId,
      suggestion.filePath,
      suggestion.oldContent,
      suggestion.newContent,
      {
        description: suggestion.description,
        source: 'ai'
      }
    );
    
    // Apply the edit
    const result = this.editManager.applyEdit(edit.id, file.content);
    
    if (result.success && result.result) {
      // Update file content
      this.updateFileContent(suggestion.fileId, result.result);
      
      // Track applied suggestion
      this.appliedSuggestions.set(suggestion.id, {
        id: this.generateId(),
        suggestionId: suggestion.id,
        timestamp: new Date(),
        fileId: suggestion.fileId,
        reverted: false
      });
      
      this.emit({
        type: 'suggestion-applied',
        payload: suggestion,
        timestamp: new Date()
      });
      
      return true;
    }
    
    return false;
  }

  /**
   * Apply multiple suggestions atomically
   */
  async applySuggestionsAtomically(suggestions: AIEditSuggestion[]): Promise<boolean> {
    const batch = this.editManager.createEditBatch(
      suggestions.map(s => ({
        fileId: s.fileId,
        filePath: s.filePath,
        oldContent: s.oldContent,
        newContent: s.newContent,
        description: s.description
      })),
      { atomic: true }
    );
    
    const results = this.editManager.applyBatch(
      batch.id,
      (fileId) => {
        const file = this.editorState.openFiles.get(fileId);
        return file?.content ?? '';
      }
    );
    
    // Update files with results
    for (const [fileId, result] of results) {
      if (result.success && result.result) {
        this.updateFileContent(fileId, result.result);
      }
    }
    
    return batch.status === 'applied';
  }

  /**
   * Reject a suggestion
   */
  rejectSuggestion(suggestionId: string): boolean {
    const suggestion = this.suggestionHistory.find(s => s.id === suggestionId);
    if (!suggestion) return false;
    
    this.emit({
      type: 'suggestion-rejected',
      payload: suggestion,
      timestamp: new Date()
    });
    
    return true;
  }

  /**
   * Revert an applied suggestion
   */
  revertSuggestion(suggestionId: string): boolean {
    const applied = this.appliedSuggestions.get(suggestionId);
    if (!applied || applied.reverted) return false;
    
    // Undo through edit manager
    const undoEntry = this.editManager.undo();
    if (!undoEntry) return false;
    
    applied.reverted = true;
    
    this.emit({
      type: 'suggestion-reverted',
      payload: { suggestionId },
      timestamp: new Date()
    });
    
    return true;
  }

  /**
   * Provide feedback on a suggestion
   */
  provideFeedback(suggestionId: string, feedback: 'helpful' | 'not-helpful' | 'incorrect'): void {
    const applied = this.appliedSuggestions.get(suggestionId);
    if (applied) {
      applied.feedback = feedback;
    }
  }

  /**
   * Get suggestion history
   */
  getSuggestionHistory(): AIEditSuggestion[] {
    return [...this.suggestionHistory];
  }

  /**
   * Get applied suggestions
   */
  getAppliedSuggestions(): AppliedSuggestion[] {
    return Array.from(this.appliedSuggestions.values());
  }

  // ============================================================================
  // PREVIEW MANAGEMENT
  // ============================================================================

  /**
   * Create a preview for suggestions
   */
  createPreview(suggestions: AIEditSuggestion[]): EditPreview {
    const diffs = suggestions.map(s => {
      const diff = this.diffEngine.generateDiff(s.oldContent, s.newContent, s.filePath);
      return { diff, fileId: s.fileId, filePath: s.filePath };
    });
    
    return this.previewManager.createPreviewFromDiffs(diffs);
  }

  /**
   * Get preview manager
   */
  getPreviewManager(): EditPreviewManager {
    return this.previewManager;
  }

  // ============================================================================
  // CONFLICT RESOLUTION
  // ============================================================================

  /**
   * Resolve a conflict
   */
  resolveConflict(
    editId: string,
    action: 'accept' | 'reject' | 'merge',
    mergedContent?: string
  ): boolean {
    const edit = this.editManager.getEdit(editId);
    if (!edit) return false;
    
    const file = this.editorState.openFiles.get(edit.fileId);
    if (!file) return false;
    
    const resolution: ConflictResolution = {
      editId,
      action,
      mergedContent
    };
    
    const result = this.editManager.resolveConflict(resolution, file.content);
    
    if (result.success && result.result) {
      this.updateFileContent(edit.fileId, result.result);
      return true;
    }
    
    return false;
  }

  // ============================================================================
  // EVENT HANDLING
  // ============================================================================

  /**
   * Subscribe to integration events
   */
  subscribe(listener: IntegrationEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Get edit manager
   */
  getEditManager(): EditManager {
    return this.editManager;
  }

  /**
   * Get multi-file editor
   */
  getMultiFileEditor(): MultiFileEditor {
    return this.multiFileEditor;
  }

  /**
   * Get diff engine
   */
  getDiffEngine(): DiffEngine {
    return this.diffEngine;
  }

  /**
   * Undo last edit
   */
  undo(): boolean {
    return this.editManager.undo() !== null;
  }

  /**
   * Redo last undone edit
   */
  redo(): boolean {
    return this.editManager.redo() !== null;
  }

  /**
   * Check if can undo
   */
  canUndo(): boolean {
    return this.editManager.canUndo();
  }

  /**
   * Check if can redo
   */
  canRedo(): boolean {
    return this.editManager.canRedo();
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  private extractCode(response: string, language: string): string {
    // Try to extract code from markdown code blocks
    const codeBlockRegex = new RegExp(`\`\`\`${language}?\\s*\\n([\\s\\S]*?)\\n\`\`\``, 'g');
    const match = codeBlockRegex.exec(response);
    
    if (match && match[1]) {
      return match[1];
    }
    
    // Try generic code block
    const genericRegex = /```\w*\n([\s\S]*?)\n```/g;
    const genericMatch = genericRegex.exec(response);
    
    if (genericMatch && genericMatch[1]) {
      return genericMatch[1];
    }
    
    // Return as-is if no code blocks found
    return response;
  }

  private getFileExtension(language: string): string {
    const extensions: Record<string, string> = {
      typescript: 'ts',
      javascript: 'js',
      typescriptreact: 'tsx',
      javascriptreact: 'jsx',
      python: 'py',
      rust: 'rs',
      go: 'go',
      java: 'java',
      c: 'c',
      cpp: 'cpp',
      csharp: 'cs',
      ruby: 'rb',
      php: 'php',
      swift: 'swift',
      kotlin: 'kt',
      scala: 'scala',
      html: 'html',
      css: 'css',
      json: 'json',
      yaml: 'yaml',
      markdown: 'md',
      sql: 'sql',
      shell: 'sh'
    };
    
    return extensions[language.toLowerCase()] ?? 'txt';
  }

  private emit(event: IntegrationEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('Integration event listener error:', error);
      }
    }
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create an AI editor integration instance
 */
export function createAIEditorIntegration(): AIEditorIntegration {
  return new AIEditorIntegration();
}

// Export singleton
export const aiEditorIntegration = new AIEditorIntegration();
