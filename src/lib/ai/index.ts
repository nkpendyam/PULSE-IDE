/**
 * Kyro IDE - AI Multi-File Editing System
 * 
 * A comprehensive system for AI-powered multi-file editing with:
 * - Diff generation and patch application
 * - Edit management with atomic operations and undo/redo
 * - Multi-file coordination with import/reference updates
 * - Preview and selective change acceptance
 * - AI service integration for code generation
 * 
 * Similar to how Continue.dev handles multi-file edits with Monaco's edit operations API.
 */

// ============================================================================
// DIFF ENGINE
// ============================================================================

export {
  DiffEngine,
  diffEngine,
  createDiffEngine,
  quickDiff,
  quickPatch,
  type DiffLine,
  type DiffHunk,
  type FileDiff,
  type PatchResult,
  type ConflictInfo,
  type EditOperation,
  type LineRange
} from './diff-engine';

// ============================================================================
// EDIT MANAGER
// ============================================================================

export {
  EditManager,
  editManager,
  createEditManager,
  type EditStatus,
  type PendingEdit,
  type EditBatch,
  type FileSnapshot,
  type UndoStackEntry,
  type EditManagerConfig,
  type ConflictResolution,
  type EditEvent,
  type EditEventListener
} from './edit-manager';

// ============================================================================
// MULTI-FILE EDITOR
// ============================================================================

export {
  MultiFileEditor,
  multiFileEditor,
  createMultiFileEditor,
  type FileInfo,
  type FileRelationship,
  type MultiFileEdit,
  type FileEdit,
  type RenameOperation,
  type ImportUpdate,
  type ReferenceUpdate,
  type EditContext,
  type MultiFileEditResult
} from './multi-file-editor';

// ============================================================================
// EDIT PREVIEW
// ============================================================================

export {
  EditPreviewManager,
  editPreviewManager,
  createEditPreviewManager,
  type PreviewLine,
  type PreviewHunk,
  type PreviewFile,
  type EditPreview,
  type ChangeDecision,
  type PreviewOptions,
  type PreviewEventType,
  type PreviewEvent,
  type PreviewEventListener
} from './edit-preview';

// ============================================================================
// AI EDITOR INTEGRATION
// ============================================================================

export {
  AIEditorIntegration,
  aiEditorIntegration,
  createAIEditorIntegration,
  type AIEditRequest,
  type AIEditOptions,
  type AIEditResponse,
  type AIEditSuggestion,
  type CodeGenerationRequest,
  type CodeGenerationResponse,
  type AppliedSuggestion,
  type EditorState,
  type IntegrationEventType,
  type IntegrationEvent,
  type IntegrationEventListener
} from './ai-editor-integration';

// ============================================================================
// CONVENIENCE RE-EXPORTS
// ============================================================================

/**
 * Create a complete AI editing system
 */
export function createAIEditingSystem() {
  const diffEngine = createDiffEngine();
  const editManager = createEditManager();
  const multiFileEditor = createMultiFileEditor();
  const previewManager = createEditPreviewManager();
  const integration = createAIEditorIntegration();
  
  return {
    diffEngine,
    editManager,
    multiFileEditor,
    previewManager,
    integration
  };
}
