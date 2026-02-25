//! Smart Selection - AST-based expand/shrink selection
//!
//! Based on tree-sitter incremental selection from nvim-treesitter

use tree_sitter::{Node, Tree, TreeCursor};
use std::collections::HashSet;

/// Smart selection manager
pub struct SmartSelection {
    selection_history: Vec<SelectionRange>,
    current_index: usize,
}

#[derive(Debug, Clone, Copy)]
pub struct SelectionRange {
    pub start_byte: usize,
    pub end_byte: usize,
    pub start_position: (usize, usize),
    pub end_position: (usize, usize),
    pub node_kind: String,
}

impl SmartSelection {
    pub fn new() -> Self {
        Self {
            selection_history: Vec::new(),
            current_index: 0,
        }
    }
    
    /// Initialize selection from cursor position
    pub fn init(&mut self, tree: &Tree, source: &[u8], row: usize, column: usize) -> Option<SelectionRange> {
        let root = tree.root_node();
        
        // Find the smallest node containing the cursor
        let mut cursor = root.walk();
        let mut smallest_node: Option<Node> = None;
        
        self.walk_to_position(&mut cursor, row, column, &mut smallest_node);
        
        if let Some(node) = smallest_node {
            let range = node_to_range(node, source);
            self.selection_history = vec![range];
            self.current_index = 0;
            return Some(range);
        }
        
        None
    }
    
    /// Expand selection to parent node
    pub fn expand(&mut self, tree: &Tree) -> Option<SelectionRange> {
        if self.selection_history.is_empty() {
            return None;
        }
        
        let root = tree.root_node();
        let current = self.selection_history.last()?;
        
        // Find current node
        if let Some(node) = self.find_node_at_range(&root, current.start_byte, current.end_byte) {
            // Get parent that is larger than current
            let mut parent = node.parent();
            while let Some(p) = parent {
                let parent_range = node_to_range(p, &[]);
                if parent_range.start_byte < current.start_byte || 
                   parent_range.end_byte > current.end_byte {
                    self.selection_history.push(parent_range);
                    self.current_index = self.selection_history.len() - 1;
                    return Some(parent_range);
                }
                parent = p.parent();
            }
        }
        
        None
    }
    
    /// Shrink selection to child node
    pub fn shrink(&mut self) -> Option<SelectionRange> {
        if self.selection_history.len() <= 1 {
            return None;
        }
        
        self.selection_history.pop();
        self.current_index = self.selection_history.len() - 1;
        self.selection_history.last().copied()
    }
    
    /// Get current selection
    pub fn current(&self) -> Option<&SelectionRange> {
        self.selection_history.get(self.current_index)
    }
    
    /// Clear selection history
    pub fn clear(&mut self) {
        self.selection_history.clear();
        self.current_index = 0;
    }
    
    fn walk_to_position<'a>(
        &self,
        cursor: &mut TreeCursor<'a>,
        row: usize,
        column: usize,
        smallest_node: &mut Option<Node<'a>>,
    ) {
        loop {
            let node = cursor.node();
            let start = node.start_position();
            let end = node.end_position();
            
            // Check if cursor is within this node
            let is_within = (start.row < row || (start.row == row && start.column <= column))
                && (end.row > row || (end.row == row && end.column >= column));
            
            if is_within {
                *smallest_node = Some(node);
                
                // Try to go deeper
                if cursor.goto_first_child() {
                    continue;
                }
            }
            
            // Move to next sibling or up
            if !cursor.goto_next_sibling() {
                if !cursor.goto_parent() {
                    break;
                }
            }
        }
    }
    
    fn find_node_at_range<'a>(&self, root: &Node<'a>, start_byte: usize, end_byte: usize) -> Option<Node<'a>> {
        let mut cursor = root.walk();
        let mut result: Option<Node> = None;
        
        loop {
            let node = cursor.node();
            let node_start = node.start_byte();
            let node_end = node.end_byte();
            
            if node_start == start_byte && node_end == end_byte {
                result = Some(node);
            }
            
            if node_start <= start_byte && node_end >= end_byte {
                // Potential match, go deeper
                if cursor.goto_first_child() {
                    continue;
                }
            }
            
            if !cursor.goto_next_sibling() {
                if !cursor.goto_parent() {
                    break;
                }
            }
        }
        
        result
    }
}

impl Default for SmartSelection {
    fn default() -> Self {
        Self::new()
    }
}

fn node_to_range(node: Node, _source: &[u8]) -> SelectionRange {
    let start = node.start_position();
    let end = node.end_position();
    
    SelectionRange {
        start_byte: node.start_byte(),
        end_byte: node.end_byte(),
        start_position: (start.row, start.column),
        end_position: (end.row, end.column),
        node_kind: node.kind().to_string(),
    }
}

/// Language-specific selection targets
pub struct SelectionTargets {
    /// Node types to prefer when expanding
    preferred_types: HashSet<String>,
    /// Node types to skip when expanding
    skip_types: HashSet<String>,
}

impl SelectionTargets {
    pub fn for_language(language: &str) -> Self {
        let (preferred, skip) = match language {
            "rust" => (
                vec!["function_item", "struct_item", "enum_item", "impl_item", "trait_item", 
                     "match_expression", "if_expression", "loop_expression", "for_expression",
                     "while_expression", "block", "let_declaration", "parameters"],
                vec!["line_comment", "block_comment", "string_content", "char_literal"]
            ),
            "typescript" | "javascript" => (
                vec!["function_declaration", "function_expression", "arrow_function",
                     "class_declaration", "method_definition", "if_statement", "for_statement",
                     "while_statement", "switch_statement", "try_statement", "block",
                     "object", "array", "call_expression", "arguments"],
                vec!["comment", "template_string_content", "regex_pattern"]
            ),
            "python" => (
                vec!["function_definition", "class_definition", "if_statement", "for_statement",
                     "while_statement", "try_statement", "with_statement", "block", 
                     "list", "dictionary", "tuple", "argument_list"],
                vec!["comment", "string_content"]
            ),
            "go" => (
                vec!["function_declaration", "method_declaration", "type_declaration",
                     "if_statement", "for_statement", "switch_statement", "block",
                     "call_expression", "argument_list", "struct_type"],
                vec!["comment", "raw_string_literal_content"]
            ),
            _ => (
                vec!["function", "class", "method", "if_statement", "for_statement",
                     "while_statement", "block", "call_expression"],
                vec!["comment", "string"]
            ),
        };
        
        Self {
            preferred_types: preferred.into_iter().map(String::from).collect(),
            skip_types: skip.into_iter().map(String::from).collect(),
        }
    }
    
    pub fn is_preferred(&self, kind: &str) -> bool {
        self.preferred_types.contains(kind)
    }
    
    pub fn should_skip(&self, kind: &str) -> bool {
        self.skip_types.contains(kind)
    }
}

/// Expand selection to specific target types
pub fn expand_to_target(tree: &Tree, source: &[u8], row: usize, column: usize, target: &str) -> Option<SelectionRange> {
    let root = tree.root_node();
    let mut cursor = root.walk();
    
    // Walk to position
    loop {
        let node = cursor.node();
        let start = node.start_position();
        let end = node.end_position();
        
        let is_within = (start.row < row || (start.row == row && start.column <= column))
            && (end.row > row || (end.row == row && end.column >= column));
        
        if is_within && node.kind() == target {
            return Some(node_to_range(node, source));
        }
        
        if cursor.goto_first_child() {
            continue;
        }
        
        if !cursor.goto_next_sibling() {
            if !cursor.goto_parent() {
                break;
            }
        }
    }
    
    None
}

/// Expand to function
pub fn expand_to_function(tree: &Tree, source: &[u8], row: usize, column: usize) -> Option<SelectionRange> {
    let targets = ["function_item", "function_declaration", "function_definition", 
                   "method_definition", "method_declaration"];
    
    for target in targets {
        if let Some(range) = expand_to_target(tree, source, row, column, target) {
            return Some(range);
        }
    }
    None
}

/// Expand to class/struct
pub fn expand_to_class(tree: &Tree, source: &[u8], row: usize, column: usize) -> Option<SelectionRange> {
    let targets = ["struct_item", "class_declaration", "class_definition",
                   "enum_item", "interface_declaration", "trait_item"];
    
    for target in targets {
        if let Some(range) = expand_to_target(tree, source, row, column, target) {
            return Some(range);
        }
    }
    None
}
