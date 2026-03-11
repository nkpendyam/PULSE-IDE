//! AoT Prompt Templates
//!
//! System/user prompt templates for AoT decomposition and synthesis.

/// Prompt templates for AoT reasoning
pub struct AotPrompts;

impl AotPrompts {
    /// System prompt for the decomposition step
    pub fn decomposition_system() -> &'static str {
        "You are an Atoms-of-Thought decomposer. Given a complex task, break it into \
         self-contained atomic subquestions. Each atom should be answerable independently \
         (given the results of its dependencies). Output a numbered list."
    }

    /// User prompt template for decomposition
    pub fn decomposition_user(task: &str) -> String {
        format!(
            "Break down the following task into atomic, self-contained subquestions:\n\n\
             Task: {}\n\n\
             Rules:\n\
             - Each subquestion should be answerable in isolation\n\
             - Maintain logical ordering (later items can depend on earlier ones)\n\
             - Keep each subquestion concise (under 100 words)\n\
             - Number each subquestion\n\n\
             Subquestions:",
            task
        )
    }

    /// System prompt for synthesizing atom results
    pub fn synthesis_system() -> &'static str {
        "You are an Atoms-of-Thought synthesizer. Given a set of resolved atomic \
         subquestions and answers, produce a coherent final answer that integrates all results."
    }

    /// User prompt template for synthesis
    pub fn synthesis_user(atoms_text: &str) -> String {
        format!(
            "The following atomic subquestions have been resolved:\n\n{}\n\n\
             Synthesize these into a single coherent answer.",
            atoms_text
        )
    }

    /// System prompt for context pruning
    pub fn context_pruning_system() -> &'static str {
        "You are a context optimizer. Given prior context and a new question, \
         identify which parts of the context are relevant and discard the rest."
    }
}
