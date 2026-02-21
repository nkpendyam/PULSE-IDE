/**
 * Kyro IDE Extension Loader
 * Loads extensions from manifest (package.json) and validates them
 */

import type { ExtensionRegistryEntry } from './extension-registry';
import type { Extension, ExtensionContributions } from './extension-manager';

// ============================================================================
// TYPES
// ============================================================================

export interface ExtensionManifest {
  /** Extension name */
  name: string;
  /** Publisher name */
  publisher: string;
  /** Version string (semver) */
  version: string;
  /** Display name */
  displayName?: string;
  /** Description */
  description?: string;
  /** Categories */
  categories?: string[];
  /** Keywords */
  keywords?: string[];
  /** Icon */
  icon?: string;
  /** README */
  readme?: string;
  /** Changelog */
  changelog?: string;
  /** License */
  license?: string;
  /** Repository */
  repository?: {
    type?: string;
    url: string;
    directory?: string;
  };
  /** Bugs */
  bugs?: {
    url: string;
  };
  /** Homepage */
  homepage?: string;
  /** Author */
  author?: string | {
    name: string;
    email?: string;
    url?: string;
  };
  /** Contributors */
  contributors?: Array<{
    name: string;
    email?: string;
    url?: string;
  }>;
  /** Main entry point */
  main?: string;
  /** Browser entry point */
  browser?: string;
  /** Activation events */
  activationEvents?: string[];
  /** Extension kind */
  extensionKind?: ('ui' | 'workspace')[];
  /** Engine requirements */
  engines: {
    vscode?: string;
    kyro?: string;
    [key: string]: string | undefined;
  };
  /** Dependencies */
  dependencies?: Record<string, string>;
  /** Dev dependencies */
  devDependencies?: Record<string, string>;
  /** Extension capabilities */
  capabilities?: {
    virtualWorkspaces?: boolean | { supported: boolean; description?: string };
    untrustedWorkspaces?: {
      supported: boolean | 'limited';
      description?: string;
      restrictedConfigurations?: string[];
    };
  };
  /** Contribution points */
  contributes?: ExtensionManifestContributions;
  /** Scripts */
  scripts?: Record<string, string>;
  /** Contributes for VS Code compatibility */
  extensionDependencies?: string[];
  /** Extension pack */
  extensionPack?: string[];
  /** Sponsor */
  sponsor?: {
    url: string;
  };
  /** Pricing */
  pricing?: 'Free' | 'Trial' | 'Paid';
  /** Preview */
  preview?: boolean;
  /** Deprecated */
  deprecated?: boolean | string | { 
    message?: string; 
    disallowInstall?: boolean;
    extension?: {
      id: string;
      displayName?: string;
    };
  };
  /** Custom properties */
  [key: string]: unknown;
}

export interface ExtensionManifestContributions {
  /** Commands */
  commands?: Array<{
    command: string;
    title: string;
    category?: string;
    icon?: string | { light: string; dark: string };
    enablement?: string;
    when?: string;
  }>;
  /** Menus */
  menus?: Record<string, Array<{
    command?: string;
    group?: string;
    when?: string;
    submenu?: string;
    alt?: string;
  }>>;
  /** Submenus */
  submenus?: Array<{
    id: string;
    label: string;
    icon?: string | { light: string; dark: string };
  }>;
  /** Keybindings */
  keybindings?: Array<{
    command: string;
    key: string;
    mac?: string;
    linux?: string;
    win?: string;
    when?: string;
    args?: unknown;
  }>;
  /** Languages */
  languages?: Array<{
    id: string;
    extensions?: string[];
    aliases?: string[];
    filenames?: string[];
    filenamePatterns?: string[];
    firstLine?: string;
    configuration?: string;
    icon?: { light: string; dark: string };
  }>;
  /** Grammars */
  grammars?: Array<{
    language?: string;
    scopeName: string;
    path: string;
    embeddedLanguages?: Record<string, string>;
    tokenTypes?: Record<string, string>;
    injectTo?: string[];
    unbalancedBracketScopes?: string[];
    balancedBracketScopes?: string[];
  }>;
  /** Debuggers */
  debuggers?: Array<{
    type: string;
    label: string;
    program?: string;
    runtime?: string;
    runtimeArgs?: string[];
    variables?: Record<string, string>;
    configurationAttributes?: Record<string, {
      type: 'object';
      properties?: Record<string, unknown>;
      required?: string[];
    }>;
    initialConfigurations?: unknown[];
    configurationSnippets?: Array<{
      label: string;
      description?: string;
      body: Record<string, unknown>;
    }>;
    languages?: string[];
    adapterExecutableCommand?: string;
  }>;
  /** Themes */
  themes?: Array<{
    id?: string;
    label: string;
    uiTheme?: 'vs' | 'vs-dark' | 'hc-black' | 'hc-light';
    path: string;
  }>;
  /** Icon themes */
  iconThemes?: Array<{
    id: string;
    label: string;
    path: string;
  }>;
  /** Product icon themes */
  productIconThemes?: Array<{
    id: string;
    label: string;
    path: string;
  }>;
  /** Snippets */
  snippets?: Array<{
    language: string;
    path: string;
  }>;
  /** Configuration */
  configuration?: {
    id?: string;
    title?: string;
    order?: number;
    properties?: Record<string, {
      type: string;
      default?: unknown;
      description?: string;
      enum?: string[];
      enumDescriptions?: string[];
      minimum?: number;
      maximum?: number;
      minLength?: number;
      maxLength?: number;
      pattern?: string;
      patternErrorMessage?: string;
      deprecationMessage?: string;
      editPresentation?: 'singlelineText' | 'multilineText' | 'boolean' | 'number' | 'complex';
      markdownDescription?: string;
      scope?: 'application' | 'machine' | 'window' | 'resource' | 'language-overridable' | 'machine-overridable';
      order?: number;
    }>;
  } | Record<string, {
    title: string;
    properties: Record<string, unknown>;
  }>;
  /** Views */
  views?: Record<string, Array<{
    id: string;
    name: string;
    when?: string;
    icon?: string;
    contextualTitle?: string;
    visibility?: 'visible' | 'hidden' | 'collapsed';
    type?: 'tree' | 'webview';
  }>>;
  /** Views containers */
  viewsContainers?: {
    activitybar?: Array<{
      id: string;
      title: string;
      icon: string;
      when?: string;
    }>;
    panel?: Array<{
      id: string;
      title: string;
      icon: string;
      when?: string;
    }>;
  };
  /** Custom editors */
  customEditors?: Array<{
    viewType: string;
    displayName: string;
    selector: Array<{
      filenamePattern?: string;
    }>;
    priority?: 'default' | 'option';
  }>;
  /** Webviews */
  webviews?: Array<{
    viewType: string;
    displayName: string;
    contexts?: string[];
  }>;
  /** Walkthroughs */
  walkthroughs?: Array<{
    id: string;
    title: string;
    description?: string;
    steps: Array<{
      id: string;
      title: string;
      description: string;
      media: {
        image?: string;
        markdown?: string;
        altText: string;
        path?: string;
      };
      completionEvents?: string[];
    }>;
  }>;
  /** Language model providers */
  chatParticipants?: Array<{
    id: string;
    name: string;
    description?: string;
    isDefault?: boolean;
    commands?: Array<{
      name: string;
      description: string;
    }>;
  }>;
  /** Terminal */
  terminal?: {
    profiles?: Array<{
      id: string;
      title: string;
      icon?: string;
    }>;
  };
  /** Resource label formatters */
  resourceLabelFormatters?: Array<{
    scheme: string;
    authority?: string;
    path?: string;
    query?: string;
    format: string;
    needsAccountId?: boolean;
  }>;
  /** Problem matchers */
  problemMatchers?: unknown[];
  /** Problem patterns */
  problemPatterns?: unknown[];
  /** Task definitions */
  taskDefinitions?: Array<{
    type: string;
    required?: string[];
    properties?: Record<string, unknown>;
  }>;
  /** Output channels */
  outputChannels?: Array<{
    id: string;
    label: string;
  }>;
}

export interface ExtensionLoadResult {
  success: boolean;
  extension?: Extension;
  registryEntry?: ExtensionRegistryEntry;
  errors: string[];
  warnings: string[];
}

export interface ExtensionValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ============================================================================
// EXTENSION LOADER
// ============================================================================

class ExtensionLoader {
  private supportedEngines = ['kyro', 'vscode'];
  private requiredFields = ['name', 'publisher', 'version', 'engines'];

  /**
   * Load extension from manifest
   */
  async loadFromManifest(manifest: ExtensionManifest, installPath?: string): Promise<ExtensionLoadResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate manifest
    const validation = this.validateManifest(manifest);
    if (!validation.valid) {
      return {
        success: false,
        errors: validation.errors,
        warnings: validation.warnings,
      };
    }

    // Check for deprecation warnings
    if (manifest.deprecated) {
      const message = typeof manifest.deprecated === 'string' 
        ? manifest.deprecated 
        : (manifest.deprecated as { message?: string })?.message || 'This extension is deprecated';
      warnings.push(`Deprecated: ${message}`);
    }

    // Convert manifest to extension
    const extension: Extension = this.manifestToExtension(manifest);
    
    // Create registry entry
    const registryEntry: ExtensionRegistryEntry = this.manifestToRegistryEntry(manifest, installPath);

    return {
      success: true,
      extension,
      registryEntry,
      errors,
      warnings,
    };
  }

  /**
   * Load extension from path
   */
  async loadFromPath(path: string): Promise<ExtensionLoadResult> {
    try {
      // In a browser/Next.js context, we would need to use an API
      // For now, we'll simulate this by expecting the manifest to be provided
      const manifestPath = `${path}/package.json`;
      
      // This would normally be an API call or file system read
      // For now, return an error indicating this needs to be implemented
      return {
        success: false,
        errors: [`Cannot load extension from path in browser environment. Path: ${manifestPath}`],
        warnings: [],
      };
    } catch (error) {
      return {
        success: false,
        errors: [`Failed to load extension from path: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings: [],
      };
    }
  }

  /**
   * Load extension from JSON string
   */
  async loadFromJson(json: string, installPath?: string): Promise<ExtensionLoadResult> {
    try {
      const manifest: ExtensionManifest = JSON.parse(json);
      return this.loadFromManifest(manifest, installPath);
    } catch (error) {
      return {
        success: false,
        errors: [`Failed to parse extension manifest: ${error instanceof Error ? error.message : 'Invalid JSON'}`],
        warnings: [],
      };
    }
  }

  /**
   * Validate extension manifest
   */
  validateManifest(manifest: ExtensionManifest): ExtensionValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required fields
    for (const field of this.requiredFields) {
      if (!(field in manifest)) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    // Validate name
    if (manifest.name) {
      if (!this.isValidExtensionName(manifest.name)) {
        errors.push(`Invalid extension name: ${manifest.name}. Name must consist of lowercase letters, numbers, and hyphens only.`);
      }
    }

    // Validate publisher
    if (manifest.publisher) {
      if (!this.isValidPublisherName(manifest.publisher)) {
        errors.push(`Invalid publisher name: ${manifest.publisher}. Publisher must consist of lowercase letters, numbers, and hyphens only.`);
      }
    }

    // Validate version
    if (manifest.version) {
      if (!this.isValidSemVer(manifest.version)) {
        errors.push(`Invalid version: ${manifest.version}. Version must be valid semver.`);
      }
    }

    // Validate engines
    if (manifest.engines) {
      const hasSupportedEngine = this.supportedEngines.some(engine => engine in manifest.engines);
      if (!hasSupportedEngine) {
        errors.push(`No supported engine found. Must specify one of: ${this.supportedEngines.join(', ')}`);
      }

      // Validate engine version
      for (const [engine, version] of Object.entries(manifest.engines)) {
        if (version && !this.isValidEngineVersion(version)) {
          warnings.push(`Engine version constraint "${version}" for "${engine}" may not be valid.`);
        }
      }
    }

    // Validate main entry point
    if (manifest.main && !manifest.browser) {
      // Main entry point exists but no browser entry point
      warnings.push('Extension has a "main" field but no "browser" field. Browser environments may not load this extension.');
    }

    // Validate activation events
    if (manifest.activationEvents) {
      for (const event of manifest.activationEvents) {
        if (!this.isValidActivationEvent(event)) {
          warnings.push(`Potentially invalid activation event: ${event}`);
        }
      }
    }

    // Validate contributions
    if (manifest.contributes) {
      const contribValidation = this.validateContributions(manifest.contributes);
      errors.push(...contribValidation.errors);
      warnings.push(...contribValidation.warnings);
    }

    // Check for missing display name
    if (!manifest.displayName) {
      warnings.push('Missing "displayName" field. This may affect how the extension appears in the marketplace.');
    }

    // Check for missing description
    if (!manifest.description) {
      warnings.push('Missing "description" field. This may affect marketplace visibility.');
    }

    // Check for missing icon
    if (!manifest.icon) {
      warnings.push('Missing "icon" field. Extension will use a default icon.');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate contribution points
   */
  private validateContributions(contributes: ExtensionManifestContributions): ExtensionValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate commands
    if (contributes.commands) {
      for (const cmd of contributes.commands) {
        if (!cmd.command) {
          errors.push('Command contribution missing "command" field');
        }
        if (!cmd.title) {
          errors.push(`Command "${cmd.command || 'unknown'}" missing "title" field`);
        }
      }
    }

    // Validate keybindings
    if (contributes.keybindings) {
      for (const kb of contributes.keybindings) {
        if (!kb.command) {
          errors.push('Keybinding contribution missing "command" field');
        }
        if (!kb.key && !kb.mac && !kb.linux && !kb.win) {
          errors.push(`Keybinding for "${kb.command || 'unknown'}" has no key defined`);
        }
      }
    }

    // Validate languages
    if (contributes.languages) {
      for (const lang of contributes.languages) {
        if (!lang.id) {
          errors.push('Language contribution missing "id" field');
        }
        if (!lang.extensions && !lang.filenames && !lang.filenamePatterns) {
          warnings.push(`Language "${lang.id || 'unknown'}" has no file extensions or patterns defined`);
        }
      }
    }

    // Validate debuggers
    if (contributes.debuggers) {
      for (const dbg of contributes.debuggers) {
        if (!dbg.type) {
          errors.push('Debugger contribution missing "type" field');
        }
        if (!dbg.label) {
          errors.push(`Debugger "${dbg.type || 'unknown'}" missing "label" field`);
        }
      }
    }

    // Validate themes
    if (contributes.themes) {
      for (const theme of contributes.themes) {
        if (!theme.label) {
          errors.push('Theme contribution missing "label" field');
        }
        if (!theme.path) {
          errors.push(`Theme "${theme.label || 'unknown'}" missing "path" field`);
        }
      }
    }

    // Validate snippets
    if (contributes.snippets) {
      for (const snippet of contributes.snippets) {
        if (!snippet.language) {
          errors.push('Snippet contribution missing "language" field');
        }
        if (!snippet.path) {
          errors.push('Snippet contribution missing "path" field');
        }
      }
    }

    // Validate configuration
    if (contributes.configuration) {
      const config = 'properties' in contributes.configuration 
        ? contributes.configuration 
        : null;
      
      if (config && config.properties) {
        for (const [key, prop] of Object.entries(config.properties)) {
          if (!prop.type) {
            warnings.push(`Configuration property "${key}" missing "type" field`);
          }
          if (!prop.description && !prop.markdownDescription) {
            warnings.push(`Configuration property "${key}" missing description`);
          }
        }
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Convert manifest to extension format
   */
  private manifestToExtension(manifest: ExtensionManifest): Extension {
    return {
      id: `${manifest.publisher}.${manifest.name}`,
      name: manifest.name,
      version: manifest.version,
      publisher: manifest.publisher,
      displayName: manifest.displayName || manifest.name,
      description: manifest.description || '',
      categories: manifest.categories || [],
      keywords: manifest.keywords,
      activationEvents: manifest.activationEvents,
      main: manifest.main || manifest.browser,
      contributes: this.convertContributions(manifest.contributes),
      enabled: true,
      installed: true,
    };
  }

  /**
   * Convert manifest contributions to extension contributions
   */
  private convertContributions(contributes?: ExtensionManifestContributions): ExtensionContributions | undefined {
    if (!contributes) return undefined;

    return {
      commands: contributes.commands?.map(cmd => ({
        command: cmd.command,
        title: cmd.title,
        category: cmd.category,
        icon: typeof cmd.icon === 'string' ? cmd.icon : undefined,
        when: cmd.when,
      })),
      menus: contributes.menus ? Object.entries(contributes.menus).map(([id, items]) => ({
        id,
        items: items.map(item => ({
          command: item.command,
          group: item.group,
          when: item.when,
        })),
      })) : undefined,
      keybindings: contributes.keybindings?.map(kb => ({
        command: kb.command,
        key: kb.key,
        mac: kb.mac,
        linux: kb.linux,
        win: kb.win,
        when: kb.when,
      })),
      languages: contributes.languages?.map(lang => ({
        id: lang.id,
        extensions: lang.extensions || [],
        aliases: lang.aliases,
        filenames: lang.filenames,
        configuration: lang.configuration,
      })),
      debuggers: contributes.debuggers?.map(dbg => ({
        type: dbg.type,
        label: dbg.label,
        program: dbg.program,
        runtime: dbg.runtime,
        configurationAttributes: dbg.configurationAttributes,
        initialConfigurations: dbg.initialConfigurations,
      })),
      themes: contributes.themes?.map(theme => ({
        id: theme.id,
        label: theme.label,
        uiTheme: theme.uiTheme || 'vs-dark',
        path: theme.path,
      })),
      icons: contributes.iconThemes?.map(icon => ({
        id: icon.id,
        label: icon.label,
        path: icon.path,
      })),
      snippets: contributes.snippets?.map(snippet => ({
        language: snippet.language,
        path: snippet.path,
      })),
      configuration: contributes.configuration && 'properties' in contributes.configuration
        ? {
            title: contributes.configuration.title || 'Extension Settings',
            properties: contributes.configuration.properties || {},
          }
        : undefined,
    };
  }

  /**
   * Convert manifest to registry entry
   */
  private manifestToRegistryEntry(manifest: ExtensionManifest, installPath?: string): ExtensionRegistryEntry {
    return {
      id: `${manifest.publisher}.${manifest.name}`,
      name: manifest.name,
      publisher: manifest.publisher,
      version: manifest.version,
      displayName: manifest.displayName || manifest.name,
      description: manifest.description || '',
      categories: manifest.categories || [],
      keywords: manifest.keywords || [],
      icon: manifest.icon,
      readme: manifest.readme,
      changelog: manifest.changelog,
      license: typeof manifest.license === 'string' ? manifest.license : undefined,
      repository: manifest.repository,
      bugs: manifest.bugs,
      homepage: manifest.homepage,
      author: typeof manifest.author === 'string' 
        ? { name: manifest.author }
        : manifest.author,
      contributors: manifest.contributors,
      main: manifest.main || manifest.browser,
      browser: manifest.browser,
      activationEvents: manifest.activationEvents || [],
      extensionKind: manifest.extensionKind,
      engines: {
        kyro: manifest.engines.kyro || manifest.engines.vscode || '*',
        vscode: manifest.engines.vscode,
      },
      dependencies: manifest.dependencies ? Object.keys(manifest.dependencies) : undefined,
      devDependencies: manifest.devDependencies ? Object.keys(manifest.devDependencies) : undefined,
      capabilities: manifest.capabilities ? {
        virtualWorkspaces: typeof manifest.capabilities.virtualWorkspaces === 'boolean' 
          ? manifest.capabilities.virtualWorkspaces 
          : manifest.capabilities.virtualWorkspaces?.supported ?? true,
        untrustedWorkspaces: manifest.capabilities.untrustedWorkspaces,
      } : undefined,
      contributes: this.convertContributions(manifest.contributes),
      installed: true,
      enabled: true,
      installPath,
      installSource: 'local',
      installedAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Validate extension name
   */
  private isValidExtensionName(name: string): boolean {
    return /^[a-z0-9][a-z0-9-]*$/.test(name);
  }

  /**
   * Validate publisher name
   */
  private isValidPublisherName(publisher: string): boolean {
    return /^[a-z0-9][a-z0-9-]*$/.test(publisher);
  }

  /**
   * Validate semver version
   */
  private isValidSemVer(version: string): boolean {
    return /^(\d+\.\d+\.\d+)(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/.test(version);
  }

  /**
   * Validate engine version constraint
   */
  private isValidEngineVersion(version: string): boolean {
    // Support various version constraints like ^1.0.0, >=1.0.0, *, etc.
    return /^[\^~>=<]*\d+\.\d+\.\d+$|^[\^~>=<]*\d+\.\d+$|^\*$|^\d+$/.test(version);
  }

  /**
   * Validate activation event
   */
  private isValidActivationEvent(event: string): boolean {
    const validPatterns = [
      /^onLanguage:[a-zA-Z0-9-+]+$/,
      /^onCommand:[a-zA-Z0-9._-]+$/,
      /^workspaceContains:[*.[\]a-zA-Z0-9_-]+$/,
      /^onFileSystem:[a-zA-Z0-9_-]+$/,
      /^onView:[a-zA-Z0-9._-]+$/,
      /^onUri:[a-zA-Z0-9._/-]+$/,
      /^onWebviewPanel:[a-zA-Z0-9._-]+$/,
      /^onCustomEditor:[a-zA-Z0-9._-]+$/,
      /^onStartupFinished$/,
      /^\*$/,
    ];

    return validPatterns.some(pattern => pattern.test(event));
  }

  /**
   * Create extension ID from publisher and name
   */
  createExtensionId(publisher: string, name: string): string {
    return `${publisher}.${name}`;
  }

  /**
   * Parse extension ID to publisher and name
   */
  parseExtensionId(id: string): { publisher: string; name: string } | null {
    const parts = id.split('.');
    if (parts.length !== 2) return null;
    return { publisher: parts[0], name: parts[1] };
  }

  /**
   * Check if extension is compatible with current IDE version
   */
  isCompatible(manifest: ExtensionManifest, ideVersion: string): boolean {
    const engineVersion = manifest.engines.kyro || manifest.engines.vscode;
    if (!engineVersion || engineVersion === '*') return true;

    // Simple version comparison
    // In production, would use proper semver comparison
    const constraint = engineVersion.replace(/[\^~]/, '');
    return this.compareVersions(ideVersion, constraint) >= 0;
  }

  /**
   * Compare two semver versions
   */
  private compareVersions(a: string, b: string): number {
    const partsA = a.split('.').map(Number);
    const partsB = b.split('.').map(Number);

    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
      const partA = partsA[i] || 0;
      const partB = partsB[i] || 0;
      if (partA > partB) return 1;
      if (partA < partB) return -1;
    }
    return 0;
  }
}

// Singleton instance
export const extensionLoader = new ExtensionLoader();

// Export class for testing
export { ExtensionLoader };
