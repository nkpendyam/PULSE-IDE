/**
 * Kyro IDE Snippet Manager
 * VS Code-style snippets with tab stops, placeholders, and variables
 */

export interface Snippet {
  prefix: string;
  body: string[];
  description: string;
  scope?: string[];
}

export interface ParsedSnippet {
  text: string;
  tabStops: TabStop[];
  variables: Map<string, string>;
}

export interface TabStop {
  index: number;
  start: number;
  end: number;
  placeholder?: string;
  choices?: string[];
  isFinal: boolean;
}

export interface SnippetVariable {
  name: string;
  value: string | ((...args: string[]) => string);
}

// ============================================================================
// BUILT-IN VARIABLES
// ============================================================================

const builtinVariables: Map<string, SnippetVariable> = new Map([
  ['TM_FILENAME', { name: 'TM_FILENAME', value: () => 'file.ts' }],
  ['TM_FILENAME_BASE', { name: 'TM_FILENAME_BASE', value: () => 'file' }],
  ['TM_DIRECTORY', { name: 'TM_DIRECTORY', value: () => '/project/src' }],
  ['TM_FILEPATH', { name: 'TM_FILEPATH', value: () => '/project/src/file.ts' }],
  ['TM_LINE_INDEX', { name: 'TM_LINE_INDEX', value: () => '0' }],
  ['TM_LINE_NUMBER', { name: 'TM_LINE_NUMBER', value: () => '1' }],
  ['TM_SELECTED_TEXT', { name: 'TM_SELECTED_TEXT', value: () => '' }],
  ['CURRENT_YEAR', { name: 'CURRENT_YEAR', value: () => String(new Date().getFullYear()) }],
  ['CURRENT_YEAR_SHORT', { name: 'CURRENT_YEAR_SHORT', value: () => String(new Date().getFullYear()).slice(-2) }],
  ['CURRENT_MONTH', { name: 'CURRENT_MONTH', value: () => String(new Date().getMonth() + 1).padStart(2, '0') }],
  ['CURRENT_MONTH_NAME', { name: 'CURRENT_MONTH_NAME', value: () => new Date().toLocaleString('en', { month: 'long' }) }],
  ['CURRENT_MONTH_NAME_SHORT', { name: 'CURRENT_MONTH_NAME_SHORT', value: () => new Date().toLocaleString('en', { month: 'short' }) }],
  ['CURRENT_DATE', { name: 'CURRENT_DATE', value: () => String(new Date().getDate()).padStart(2, '0') }],
  ['CURRENT_DAY_NAME', { name: 'CURRENT_DAY_NAME', value: () => new Date().toLocaleString('en', { weekday: 'long' }) }],
  ['CURRENT_DAY_NAME_SHORT', { name: 'CURRENT_DAY_NAME_SHORT', value: () => new Date().toLocaleString('en', { weekday: 'short' }) }],
  ['CURRENT_HOUR', { name: 'CURRENT_HOUR', value: () => String(new Date().getHours()).padStart(2, '0') }],
  ['CURRENT_MINUTE', { name: 'CURRENT_MINUTE', value: () => String(new Date().getMinutes()).padStart(2, '0') }],
  ['CURRENT_SECOND', { name: 'CURRENT_SECOND', value: () => String(new Date().getSeconds()).padStart(2, '0') }],
  ['CURRENT_SECONDS_UNIX', { name: 'CURRENT_SECONDS_UNIX', value: () => String(Math.floor(Date.now() / 1000)) }],
  ['CURRENT_TIMEZONE_OFFSET', { name: 'CURRENT_TIMEZONE_OFFSET', value: () => new Date().getTimezoneOffset().toString() }],
  ['RANDOM', { name: 'RANDOM', value: () => Math.random().toString(36).substring(2, 8) }],
  ['RANDOM_HEX', { name: 'RANDOM_HEX', value: () => Math.random().toString(16).substring(2, 10) }],
  ['UUID', { name: 'UUID', value: () => crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); }) }],
  ['LINE_COMMENT', { name: 'LINE_COMMENT', value: () => '//' }],
  ['BLOCK_COMMENT_START', { name: 'BLOCK_COMMENT_START', value: () => '/*' }],
  ['BLOCK_COMMENT_END', { name: 'BLOCK_COMMENT_END', value: () => '*/' }],
]);

// ============================================================================
// BUILT-IN SNIPPETS
// ============================================================================

const builtInSnippets: Map<string, Snippet[]> = new Map([
  ['typescript', [
    { prefix: 'log', body: ['console.log($1);'], description: 'Console log' },
    { prefix: 'logv', body: ['console.log(\'$1:\', $1);'], description: 'Console log with variable name' },
    { prefix: 'clg', body: ['console.log($1);'], description: 'Console log (short)' },
    { prefix: 'clo', body: ['console.log({ $1 });'], description: 'Console log object' },
    { prefix: 'clt', body: ['console.time(\'$1\');', '$2', 'console.timeEnd(\'$1\');'], description: 'Console time' },
    { prefix: 'imp', body: ['import { $2 } from \'$1\';'], description: 'Import statement' },
    { prefix: 'imd', body: ['import $2 from \'$1\';'], description: 'Import default' },
    { prefix: 'ima', body: ['import * as $2 from \'$1\';'], description: 'Import all' },
    { prefix: 'exp', body: ['export $1'], description: 'Export' },
    { prefix: 'exd', body: ['export default $1;'], description: 'Export default' },
    { prefix: 'enf', body: ['export const $1 = ($2) => {', '  $3', '};'], description: 'Export named function' },
    { prefix: 'edf', body: ['export default ($1) => {', '  $2', '};'], description: 'Export default function' },
    { prefix: 'func', body: ['function $1($2) {', '  $3', '}'], description: 'Function declaration' },
    { prefix: 'af', body: ['const $1 = ($2) => {', '  $3', '};'], description: 'Arrow function' },
    { prefix: 'afn', body: ['const $1 = async ($2) => {', '  $3', '};'], description: 'Async arrow function' },
    { prefix: 'asf', body: ['async function $1($2) {', '  $3', '}'], description: 'Async function' },
    { prefix: 'try', body: ['try {', '  $1', '} catch (error) {', '  console.error(error);', '}'], description: 'Try-catch' },
    { prefix: 'trya', body: ['try {', '  $1', '} catch (error) {', '  console.error(error);', '} finally {', '  $2', '}'], description: 'Try-catch-finally' },
    { prefix: 'if', body: ['if ($1) {', '  $2', '}'], description: 'If statement' },
    { prefix: 'ife', body: ['if ($1) {', '  $2', '} else {', '  $3', '}'], description: 'If-else statement' },
    { prefix: 'ei', body: ['else if ($1) {', '  $2', '}'], description: 'Else if' },
    { prefix: 'sw', body: ['switch ($1) {', '  case $2:', '    $3', '    break;', '  default:', '    $4', '}'], description: 'Switch statement' },
    { prefix: 'case', body: ['case $1:', '  $2', '  break;'], description: 'Case clause' },
    { prefix: 'for', body: ['for (let ${1:i} = 0; ${1:i} < ${2:array}.length; ${1:i}++) {', '  $3', '}'], description: 'For loop' },
    { prefix: 'forof', body: ['for (const ${1:item} of ${2:array}) {', '  $3', '}'], description: 'For...of loop' },
    { prefix: 'forin', body: ['for (const ${1:key} in ${2:object}) {', '  $3', '}'], description: 'For...in loop' },
    { prefix: 'foreach', body: ['${1:array}.forEach((${2:item}) => {', '  $3', '});'], description: 'ForEach' },
    { prefix: 'map', body: ['${1:array}.map((${2:item}) => {', '  $3', '});'], description: 'Map' },
    { prefix: 'filter', body: ['${1:array}.filter((${2:item}) => $3);'], description: 'Filter' },
    { prefix: 'reduce', body: ['${1:array}.reduce((${2:acc}, ${3:cur}) => {', '  $4', '}, ${5:initial});'], description: 'Reduce' },
    { prefix: 'find', body: ['${1:array}.find((${2:item}) => $3);'], description: 'Find' },
    { prefix: 'while', body: ['while ($1) {', '  $2', '}'], description: 'While loop' },
    { prefix: 'class', body: ['class $1 {', '  constructor($2) {', '    $3', '  }', '}', ''], description: 'Class' },
    { prefix: 'classi', body: ['class $1 implements $2 {', '  constructor($3) {', '    $4', '  }', '}', ''], description: 'Class implements' },
    { prefix: 'classe', body: ['class $1 extends $2 {', '  constructor($3) {', '    super($4);', '    $5', '  }', '}', ''], description: 'Class extends' },
    { prefix: 'int', body: ['interface $1 {', '  $2', '}'], description: 'Interface' },
    { prefix: 'type', body: ['type $1 = $2;'], description: 'Type alias' },
    { prefix: 'enum', body: ['enum $1 {', '  $2', '}'], description: 'Enum' },
    { prefix: 'desc', body: ['describe(\'$1\', () => {', '  $2', '});'], description: 'Describe block' },
    { prefix: 'it', body: ['it(\'$1\', () => {', '  $2', '});'], description: 'It block' },
    { prefix: 'ita', body: ['it(\'$1\', async () => {', '  $2', '});'], description: 'Async it block' },
    { prefix: 'bef', body: ['beforeEach(() => {', '  $1', '});'], description: 'Before each' },
    { prefix: 'aft', body: ['afterEach(() => {', '  $1', '});'], description: 'After each' },
    { prefix: 'expect', body: ['expect($1).$2;'], description: 'Expect' },
    { prefix: 'to', body: ['expect($1).toBe($2);'], description: 'To be' },
    { prefix: 'toe', body: ['expect($1).toEqual($2);'], description: 'To equal' },
    { prefix: 'usestate', body: ['const [$1, set${1/(.*)/${1:/capitalize}/}] = useState<$2>($3);'], description: 'useState hook' },
    { prefix: 'useeffect', body: ['useEffect(() => {', '  $1', '', '  return () => {', '    $2', '  };', '}, [$3]);'], description: 'useEffect hook' },
    { prefix: 'usecallback', body: ['const $1 = useCallback(($2) => {', '  $3', '}, [$4]);'], description: 'useCallback hook' },
    { prefix: 'usememo', body: ['const $1 = useMemo(() => {', '  return $2;', '}, [$3]);'], description: 'useMemo hook' },
    { prefix: 'useref', body: ['const $1 = useRef<$2>($3);'], description: 'useRef hook' },
    { prefix: 'usecontext', body: ['const $1 = useContext($2Context);'], description: 'useContext hook' },
    { prefix: 'ctx', body: ['const $1Context = createContext<$2 | undefined>(undefined);'], description: 'createContext' },
    { prefix: 'rfc', body: ['import React from \'react\';', '', 'interface $1Props {', '  $2', '}', '', 'export const $1: React.FC<$1Props> = ($3) => {', '  return (', '    <div>', '      $4', '    </div>', '  );', '};'], description: 'React functional component' },
    { prefix: 'rfce', body: ['import React from \'react\';', '', 'export const $1 = () => {', '  return (', '    <div>', '      $2', '    </div>', '  );', '};'], description: 'React functional component (export)' },
  ]],
  ['python', [
    { prefix: 'imp', body: ['import $1'], description: 'Import' },
    { prefix: 'fim', body: ['from $1 import $2'], description: 'From import' },
    { prefix: 'def', body: ['def $1($2):', '    $3'], description: 'Function definition' },
    { prefix: 'daf', body: ['async def $1($2):', '    $3'], description: 'Async function' },
    { prefix: 'cla', body: ['class $1:', '    def __init__(self$2):', '        $3'], description: 'Class' },
    { prefix: 'clai', body: ['class $1($2):', '    def __init__(self$3):', '        $4'], description: 'Class inherits' },
    { prefix: 'if', body: ['if $1:', '    $2'], description: 'If' },
    { prefix: 'ife', body: ['if $1:', '    $2', 'else:', '    $3'], description: 'If-else' },
    { prefix: 'elif', body: ['elif $1:', '    $2'], description: 'Elif' },
    { prefix: 'for', body: ['for ${1:item} in ${2:items}:', '    $3'], description: 'For loop' },
    { prefix: 'fore', body: ['for ${1:index}, ${2:item} in enumerate(${3:items}):', '    $4'], description: 'For enumerate' },
    { prefix: 'wh', body: ['while $1:', '    $2'], description: 'While' },
    { prefix: 'try', body: ['try:', '    $1', 'except $2 as e:', '    print(e)'], description: 'Try-except' },
    { prefix: 'tryf', body: ['try:', '    $1', 'except $2 as e:', '    print(e)', 'finally:', '    $3'], description: 'Try-except-finally' },
    { prefix: 'with', body: ['with $1 as $2:', '    $3'], description: 'With statement' },
    { prefix: 'prop', body: ['@property', 'def $1(self):', '    return self._$1', '', '@$1.setter', 'def $1(self, value):', '    self._$1 = value'], description: 'Property' },
    { prefix: 'main', body: ['if __name__ == \'__main__\':', '    $1'], description: 'Main block' },
    { prefix: 'lam', body: ['lambda $1: $2'], description: 'Lambda' },
    { prefix: 'print', body: ['print($1)'], description: 'Print' },
    { prefix: 'pp', body: ['pprint($1)'], description: 'Pretty print' },
    { prefix: 'assert', body: ['assert $1, "$2"'], description: 'Assert' },
  ]],
  ['rust', [
    { prefix: 'fn', body: ['fn $1($2) {', '    $3', '}'], description: 'Function' },
    { prefix: 'pfn', body: ['pub fn $1($2) {', '    $3', '}'], description: 'Public function' },
    { prefix: 'afn', body: ['async fn $1($2) {', '    $3', '}'], description: 'Async function' },
    { prefix: 'main', body: ['fn main() {', '    $1', '}'], description: 'Main function' },
    { prefix: 'struct', body: ['struct $1 {', '    $2', '}'], description: 'Struct' },
    { prefix: 'pstruct', body: ['pub struct $1 {', '    $2', '}'], description: 'Public struct' },
    { prefix: 'enum', body: ['enum $1 {', '    $2', '}'], description: 'Enum' },
    { prefix: 'impl', body: ['impl $1 {', '    $2', '}'], description: 'Impl block' },
    { prefix: 'implt', body: ['impl $1 for $2 {', '    $3', '}'], description: 'Impl trait' },
    { prefix: 'trait', body: ['trait $1 {', '    $2', '}'], description: 'Trait' },
    { prefix: 'let', body: ['let $1 = $2;'], description: 'Let binding' },
    { prefix: 'letm', body: ['let mut $1 = $2;'], description: 'Mutable let' },
    { prefix: 'match', body: ['match $1 {', '    $2 => $3,', '    _ => $4,', '}'], description: 'Match' },
    { prefix: 'if', body: ['if $1 {', '    $2', '}'], description: 'If' },
    { prefix: 'ife', body: ['if $1 {', '    $2', '} else {', '    $3', '}'], description: 'If-else' },
    { prefix: 'loop', body: ['loop {', '    $1', '}'], description: 'Loop' },
    { prefix: 'for', body: ['for ${1:i} in ${2:0..10} {', '    $3', '}'], description: 'For loop' },
    { prefix: 'while', body: ['while $1 {', '    $2', '}'], description: 'While' },
    { prefix: 'println', body: ['println!("$1");'], description: 'Println' },
    { prefix: 'format', body: ['format!("$1", $2)'], description: 'Format' },
    { prefix: 'vec', body: ['vec![$1]'], description: 'Vec macro' },
    { prefix: 'panic', body: ['panic!("$1");'], description: 'Panic' },
    { prefix: 'unwrap', body: ['.unwrap()'], description: 'Unwrap' },
    { prefix: 'expect', body: ['.expect("$1")'], description: 'Expect' },
    { prefix: 'ok', body: ['Ok($1)'], description: 'Ok' },
    { prefix: 'err', body: ['Err($1)'], description: 'Err' },
    { prefix: 'some', body: ['Some($1)'], description: 'Some' },
    { prefix: 'none', body: ['None'], description: 'None' },
    { prefix: 'mod', body: ['mod $1 {', '    $2', '}'], description: 'Module' },
    { prefix: 'use', body: ['use $1;'], description: 'Use' },
    { prefix: 'test', body: ['#[test]', 'fn $1() {', '    $2', '}'], description: 'Test function' },
  ]],
  ['go', [
    { prefix: 'pkg', body: ['package $1'], description: 'Package' },
    { prefix: 'imp', body: ['import "$1"'], description: 'Import' },
    { prefix: 'impd', body: ['import (', '    "$1"', ')'], description: 'Import multiple' },
    { prefix: 'func', body: ['func $1($2) $3 {', '    $4', '}'], description: 'Function' },
    { prefix: 'funcm', body: ['func ($1 $2) $3($4) $5 {', '    $6', '}'], description: 'Method' },
    { prefix: 'main', body: ['func main() {', '    $1', '}'], description: 'Main function' },
    { prefix: 'struct', body: ['type $1 struct {', '    $2', '}'], description: 'Struct' },
    { prefix: 'interface', body: ['type $1 interface {', '    $2', '}'], description: 'Interface' },
    { prefix: 'var', body: ['var $1 $2'], description: 'Variable' },
    { prefix: 'vars', body: ['var $1 = $2'], description: 'Variable short' },
    { prefix: 'const', body: ['const $1 $2 = $3'], description: 'Constant' },
    { prefix: 'for', body: ['for ${1:i} := 0; ${1:i} < ${2:10}; ${1:i}++ {', '    $3', '}'], description: 'For loop' },
    { prefix: 'forr', body: ['for ${1:index}, ${2:value} := range ${3:slice} {', '    $4', '}'], description: 'For range' },
    { prefix: 'if', body: ['if $1 {', '    $2', '}'], description: 'If' },
    { prefix: 'ife', body: ['if $1 {', '    $2', '} else {', '    $3', '}'], description: 'If-else' },
    { prefix: 'switch', body: ['switch $1 {', 'case $2:', '    $3', 'default:', '    $4', '}'], description: 'Switch' },
    { prefix: 'case', body: ['case $1:', '    $2'], description: 'Case' },
    { prefix: 'defer', body: ['defer $1'], description: 'Defer' },
    { prefix: 'go', body: ['go $1'], description: 'Goroutine' },
    { prefix: 'goroutine', body: ['go func($1) {', '    $2', '}($3)'], description: 'Anonymous goroutine' },
    { prefix: 'select', body: ['select {', 'case $1:', '    $2', 'default:', '    $3', '}'], description: 'Select' },
    { prefix: 'print', body: ['fmt.Println($1)'], description: 'Print' },
    { prefix: 'printf', body: ['fmt.Printf("$1", $2)'], description: 'Printf' },
    { prefix: 'sprint', body: ['fmt.Sprintf("$1", $2)'], description: 'Sprintf' },
    { prefix: 'err', body: ['if err != nil {', '    $1', '}'], description: 'Error check' },
    { prefix: 'errr', body: ['return nil, err'], description: 'Return error' },
    { prefix: 'test', body: ['func Test$1(t *testing.T) {', '    $2', '}'], description: 'Test function' },
  ]],
]);

// ============================================================================
// SNIPPET MANAGER
// ============================================================================

export class SnippetManager {
  private snippets: Map<string, Snippet[]> = new Map(builtInSnippets);
  private userSnippets: Map<string, Snippet[]> = new Map();
  private variables: Map<string, SnippetVariable> = new Map(builtinVariables);

  /**
   * Get snippets for a language
   */
  getSnippets(language: string): Snippet[] {
    const builtIn = this.snippets.get(language) || [];
    const user = this.userSnippets.get(language) || [];
    return [...builtIn, ...user];
  }

  /**
   * Get snippet by prefix
   */
  getSnippet(language: string, prefix: string): Snippet | undefined {
    const snippets = this.getSnippets(language);
    return snippets.find(s => s.prefix === prefix);
  }

  /**
   * Add user snippet
   */
  addUserSnippet(language: string, snippet: Snippet): void {
    if (!this.userSnippets.has(language)) {
      this.userSnippets.set(language, []);
    }
    this.userSnippets.get(language)!.push(snippet);
  }

  /**
   * Set user snippets for a language
   */
  setUserSnippets(language: string, snippets: Snippet[]): void {
    this.userSnippets.set(language, snippets);
  }

  /**
   * Parse snippet body with tab stops and variables
   */
  parseSnippet(body: string[], context: Record<string, string> = {}): ParsedSnippet {
    const text = body.join('\n');
    const tabStops: TabStop[] = [];
    const variables = new Map<string, string>();

    let result = text;
    let offset = 0;

    // Process variables first: ${VAR} or ${VAR:default} or ${VAR|choices|}
    const varPattern = /\$\{([A-Za-z_][A-Za-z0-9_]*)(?::([^}]*))?\}/g;
    let varMatch;
    while ((varMatch = varPattern.exec(text)) !== null) {
      const varName = varMatch[1];
      const defaultVal = varMatch[2] || '';
      const varDef = this.variables.get(varName);
      const contextVal = context[varName];
      
      let value: string;
      if (contextVal) {
        value = contextVal;
      } else if (varDef) {
        value = typeof varDef.value === 'function' ? varDef.value() : varDef.value;
      } else {
        value = defaultVal;
      }

      variables.set(varName, value);
      result = result.replace(varMatch[0], value);
    }

    // Simple variables: $VAR
    const simpleVarPattern = /\$([A-Z_][A-Z0-9_]*)/g;
    let simpleVarMatch;
    while ((simpleVarMatch = simpleVarPattern.exec(result)) !== null) {
      const varName = simpleVarMatch[1];
      const varDef = this.variables.get(varName);
      const contextVal = context[varName];
      
      let value: string;
      if (contextVal) {
        value = contextVal;
      } else if (varDef) {
        value = typeof varDef.value === 'function' ? varDef.value() : varDef.value;
      } else {
        value = varName;
      }

      variables.set(varName, value);
      result = result.replace(simpleVarMatch[0], value);
    }

    // Process tab stops: $1, ${1}, ${1:placeholder}, ${1|a,b,c|}
    const tabPattern = /\$(\{?(\d+)(?::([^}]*))?\}?)/g;
    let tabIndex = 0;
    let tabMatch;

    while ((tabMatch = tabPattern.exec(result)) !== null) {
      const index = parseInt(tabMatch[2]);
      const placeholder = tabMatch[3];
      const isFinal = index === 0;

      const startPos = tabMatch.index + offset;
      const endPos = startPos + (placeholder?.length || 0);

      tabStops.push({
        index: isFinal ? Infinity : index,
        start: startPos,
        end: endPos,
        placeholder,
        isFinal,
      });

      // Replace with placeholder or empty string
      const replacement = placeholder || '';
      result = result.slice(0, tabMatch.index) + replacement + result.slice(tabMatch.index + tabMatch[0].length);
      offset += replacement.length - tabMatch[0].length;
    }

    // Sort tab stops by index
    tabStops.sort((a, b) => a.index - b.index);

    return { text: result, tabStops, variables };
  }

  /**
   * Get snippet completions for a prefix
   */
  getCompletions(language: string, prefix: string): Snippet[] {
    const snippets = this.getSnippets(language);
    const lowerPrefix = prefix.toLowerCase();
    return snippets.filter(s => 
      s.prefix.toLowerCase().startsWith(lowerPrefix) ||
      s.description.toLowerCase().includes(lowerPrefix)
    );
  }

  /**
   * Register custom variable
   */
  registerVariable(name: string, value: string | ((...args: string[]) => string)): void {
    this.variables.set(name, { name, value });
  }

  /**
   * Export user snippets as JSON
   */
  exportUserSnippets(): Record<string, Snippet[]> {
    return Object.fromEntries(this.userSnippets);
  }

  /**
   * Import user snippets from JSON
   */
  importUserSnippets(snippets: Record<string, Snippet[]>): void {
    for (const [lang, snips] of Object.entries(snippets)) {
      this.setUserSnippets(lang, snips);
    }
  }
}

// Singleton
export const snippetManager = new SnippetManager();
