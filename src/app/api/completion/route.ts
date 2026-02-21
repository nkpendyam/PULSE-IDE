/**
 * AI Inline Completion API Route
 * 
 * Provides AI-powered code completions for the Monaco editor.
 * Currently uses mock data for demo, designed for future Ollama integration.
 */

import { NextRequest, NextResponse } from 'next/server';

// Types
interface CompletionRequest {
  prefix: string;
  suffix: string;
  language: string;
  fileUri: string;
  line: number;
  column: number;
  maxTokens?: number;
  temperature?: number;
  model?: string;
}

interface CompletionSuggestion {
  text: string;
  displayText?: string;
  isMultiLine: boolean;
  confidence: number;
  source: string;
}

interface CompletionResponse {
  completions: CompletionSuggestion[];
  latency: number;
  model: string;
  cached: boolean;
}

// Mock completion patterns by language
const COMPLETION_PATTERNS: Record<string, Array<{ pattern: RegExp; completion: string; confidence: number }>> = {
  typescript: [
    { pattern: /console\.$/, completion: 'log($1);', confidence: 0.95 },
    { pattern: /return\s*$/, completion: '$1;', confidence: 0.8 },
    { pattern: /async\s+\w+\s*\([^)]*\)\s*$/, completion: '{\n  $1\n}', confidence: 0.9 },
    { pattern: /function\s+\w+\s*\([^)]*\)\s*$/, completion: '{\n  $1\n}', confidence: 0.9 },
    { pattern: /const\s+\w+\s*=\s*\($/, completion: ') => {\n  $1\n};', confidence: 0.85 },
    { pattern: /if\s*$/, completion: ' ($1) {\n  $2\n}', confidence: 0.9 },
    { pattern: /else\s*$/, completion: ' {\n  $1\n}', confidence: 0.9 },
    { pattern: /try\s*$/, completion: ' {\n  $1\n} catch (error) {\n  $2\n}', confidence: 0.95 },
    { pattern: /import\s*$/, completion: "{ $1 } from '$2';", confidence: 0.85 },
    { pattern: /export\s*$/, completion: 'const $1 = $2;', confidence: 0.8 },
    { pattern: /interface\s+\w+\s*$/, completion: '{\n  $1: $2;\n}', confidence: 0.9 },
    { pattern: /type\s+\w+\s*=\s*$/, completion: '$1;', confidence: 0.85 },
    { pattern: /const\s+\[\w+,\s*set\w+\]\s*=\s*useState$/, completion: '<$1>($2);', confidence: 0.9 },
    { pattern: /useEffect\s*\(\s*\(\)\s*=>\s*$/, completion: '{\n  $1\n}, [$2]);', confidence: 0.9 },
    { pattern: /\.then\(\s*\(/, completion: ') => {\n  $1\n})', confidence: 0.85 },
    { pattern: /\.catch\(\s*\(/, completion: 'error) => {\n  $1\n})', confidence: 0.85 },
    { pattern: /\.map\(\s*\(/, completion: '$1) => $2)', confidence: 0.9 },
    { pattern: /\.filter\(\s*\(/, completion: '$1) => $2)', confidence: 0.9 },
    { pattern: /\.forEach\(\s*\(/, completion: '$1) => {\n  $2\n})', confidence: 0.9 },
    { pattern: /class\s+\w+\s*$/, completion: '{\n  $1\n}', confidence: 0.9 },
    { pattern: /constructor\s*\([^)]*\)\s*$/, completion: '{\n  $1\n}', confidence: 0.9 },
  ],
  javascript: [
    { pattern: /console\.$/, completion: 'log($1);', confidence: 0.95 },
    { pattern: /return\s*$/, completion: '$1;', confidence: 0.8 },
    { pattern: /function\s+\w+\s*\([^)]*\)\s*$/, completion: '{\n  $1\n}', confidence: 0.9 },
    { pattern: /const\s+\w+\s*=\s*\($/, completion: ') => {\n  $1\n};', confidence: 0.85 },
    { pattern: /if\s*$/, completion: ' ($1) {\n  $2\n}', confidence: 0.9 },
    { pattern: /try\s*$/, completion: ' {\n  $1\n} catch (error) {\n  $2\n}', confidence: 0.95 },
    { pattern: /import\s*$/, completion: "$1 from '$2';", confidence: 0.85 },
    { pattern: /export\s+default\s*$/, completion: '$1;', confidence: 0.85 },
    { pattern: /document\.getElementById\($/, completion: "'$1')", confidence: 0.9 },
    { pattern: /addEventListener\($/, completion: "'$1', ($2) => {\n  $3\n})", confidence: 0.85 },
  ],
  python: [
    { pattern: /print\s*\($/, completion: '$1)', confidence: 0.95 },
    { pattern: /return\s*$/, completion: '$1', confidence: 0.8 },
    { pattern: /def\s+\w+\s*\([^)]*\)\s*$/, completion: ':', confidence: 0.95 },
    { pattern: /class\s+\w+\s*$/, completion: ':', confidence: 0.95 },
    { pattern: /if\s+.*\s*$/, completion: ':', confidence: 0.9 },
    { pattern: /for\s+\w+\s+in\s+.*\s*$/, completion: ':', confidence: 0.9 },
    { pattern: /while\s+.*\s*$/, completion: ':', confidence: 0.9 },
    { pattern: /try\s*$/, completion: ':\n    $1\nexcept Exception as e:\n    $2', confidence: 0.9 },
    { pattern: /with\s+open\($/, completion: "'$1', 'r') as f:\n    $2", confidence: 0.9 },
    { pattern: /async\s+def\s+\w+\s*\([^)]*\)\s*$/, completion: ':', confidence: 0.95 },
    { pattern: /lambda\s*$/, completion: '$1: $2', confidence: 0.85 },
    { pattern: /from\s+[\w.]+\s+import\s*$/, completion: '$1', confidence: 0.85 },
  ],
  json: [
    { pattern: /"[\w]+"\s*:\s*$/, completion: '"$1"', confidence: 0.8 },
    { pattern: /"[\w]+"\s*:\s*\[$/, completion: '\n    $1\n  ]', confidence: 0.85 },
    { pattern: /"[\w]+"\s*:\s*\{$/, completion: '\n    "$1": $2\n  }', confidence: 0.85 },
  ],
};

// Common completions for any language
const COMMON_COMPLETIONS: CompletionSuggestion[] = [
  { text: '// TODO: $1', isMultiLine: false, confidence: 0.5, source: 'common' },
  { text: '// FIXME: $1', isMultiLine: false, confidence: 0.5, source: 'common' },
];

/**
 * Generate completions based on the request context
 */
function generateCompletions(request: CompletionRequest): CompletionSuggestion[] {
  const completions: CompletionSuggestion[] = [];
  const patterns = COMPLETION_PATTERNS[request.language] || [];
  const lastLine = request.prefix.split('\n').pop() || '';
  
  // Match patterns
  for (const { pattern, completion, confidence } of patterns) {
    if (pattern.test(lastLine)) {
      completions.push({
        text: completion,
        isMultiLine: completion.includes('\n'),
        confidence,
        source: 'pattern',
      });
    }
  }

  // Add context-aware completions
  const contextCompletions = getContextCompletions(request);
  completions.push(...contextCompletions);

  // Add common completions if we don't have many matches
  if (completions.length < 3) {
    completions.push(...COMMON_COMPLETIONS);
  }

  // Sort by confidence and limit
  return completions
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);
}

/**
 * Generate context-aware completions
 */
function getContextCompletions(request: CompletionRequest): CompletionSuggestion[] {
  const completions: CompletionSuggestion[] = [];
  const lastLine = request.prefix.split('\n').pop() || '';
  const trimmedLastLine = lastLine.trim();
  const previousLines = request.prefix.split('\n').slice(-5);

  // React hooks context
  if (request.language === 'typescript' || request.language === 'javascript') {
    // useState pattern
    if (trimmedLastLine.includes('useState') && !trimmedLastLine.includes('<')) {
      completions.push({
        text: '<$1>($2)',
        isMultiLine: false,
        confidence: 0.9,
        source: 'react-hooks',
      });
    }

    // useEffect pattern
    if (trimmedLastLine.includes('useEffect') && !trimmedLastLine.includes('[')) {
      completions.push({
        text: '(() => {\n  $1\n}, [$2]);',
        isMultiLine: true,
        confidence: 0.9,
        source: 'react-hooks',
      });
    }

    // Async function context
    if (previousLines.some(line => line.includes('async'))) {
      if (trimmedLastLine.endsWith('await')) {
        completions.push({
          text: ' $1',
          isMultiLine: false,
          confidence: 0.85,
          source: 'async-context',
        });
      }
    }

    // Import context
    if (trimmedLastLine.startsWith('import') && !trimmedLastLine.includes('from')) {
      completions.push({
        text: " from '$1';",
        isMultiLine: false,
        confidence: 0.95,
        source: 'import-context',
      });
    }

    // Function return type
    if (trimmedLastLine.match(/^function\s+\w+\s*\([^)]*\)/) && !trimmedLastLine.includes(':')) {
      completions.push({
        text: ': $1 {\n  $2\n}',
        isMultiLine: true,
        confidence: 0.8,
        source: 'type-annotation',
      });
    }
  }

  // Python context
  if (request.language === 'python') {
    // Class inheritance
    if (trimmedLastLine.startsWith('class ') && !trimmedLastLine.includes('(')) {
      completions.push({
        text: '($1):',
        isMultiLine: false,
        confidence: 0.85,
        source: 'python-class',
      });
    }

    // Method definition in class
    if (previousLines.some(line => line.trim().startsWith('class '))) {
      if (trimmedLastLine === 'def') {
        completions.push({
          text: ' $1(self, $2):',
          isMultiLine: false,
          confidence: 0.9,
          source: 'python-method',
        });
      }
    }

    // f-string context
    if (trimmedLastLine.includes('f"') && !trimmedLastLine.includes('}')) {
      completions.push({
        text: '{$1}"',
        isMultiLine: false,
        confidence: 0.85,
        source: 'f-string',
      });
    }
  }

  // JSON context
  if (request.language === 'json') {
    const openBraces = (request.prefix.match(/{/g) || []).length;
    const closeBraces = (request.prefix.match(/}/g) || []).length;
    
    if (openBraces > closeBraces && trimmedLastLine.endsWith(',')) {
      completions.push({
        text: '"$1": $2',
        isMultiLine: false,
        confidence: 0.8,
        source: 'json-key',
      });
    }
  }

  return completions;
}

/**
 * Simulate AI model response (for future Ollama integration)
 */
async function simulateAICompletion(
  request: CompletionRequest
): Promise<CompletionSuggestion[]> {
  // Simulate network latency
  await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

  // For now, return pattern-based completions
  // In production, this would call Ollama or another AI backend
  return generateCompletions(request);
}

/**
 * POST /api/completion
 * Get AI inline completions for code
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body: CompletionRequest = await request.json();
    
    // Validate request
    if (!body.prefix || !body.language) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields: prefix, language' 
        },
        { status: 400 }
      );
    }

    // Get completions
    const completions = await simulateAICompletion(body);

    const response: CompletionResponse = {
      completions,
      latency: Date.now() - startTime,
      model: body.model || 'mock-provider',
      cached: false,
    };

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Completion API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/completion
 * Get completion API status and available models
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  switch (action) {
    case 'models':
      return NextResponse.json({
        success: true,
        data: {
          models: [
            { id: 'mock-provider', name: 'Mock Provider (Demo)', type: 'local' },
            { id: 'llama3.2', name: 'Llama 3.2', type: 'local', provider: 'ollama' },
            { id: 'codellama', name: 'Code Llama', type: 'local', provider: 'ollama' },
            { id: 'deepseek-coder', name: 'DeepSeek Coder', type: 'local', provider: 'ollama' },
            { id: 'mistral', name: 'Mistral', type: 'local', provider: 'ollama' },
          ],
          default: 'mock-provider',
        },
      });

    case 'status':
      return NextResponse.json({
        success: true,
        data: {
          status: 'available',
          provider: 'mock',
          supportedLanguages: Object.keys(COMPLETION_PATTERNS),
          features: [
            'inline-completions',
            'multi-line-suggestions',
            'context-aware',
            'pattern-matching',
          ],
        },
      });

    default:
      return NextResponse.json({
        success: true,
        data: {
          name: 'Kyro IDE Inline Completion API',
          version: '1.0.0',
          description: 'AI-powered code completions for Monaco editor',
          endpoints: {
            'POST /api/completion': 'Get inline completions',
            'GET /api/completion?action=models': 'List available models',
            'GET /api/completion?action=status': 'Get API status',
          },
        },
      });
  }
}
