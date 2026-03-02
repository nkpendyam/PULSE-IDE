# Kyro Ollama Integration

Kyro IDE uses Ollama directly via its HTTP API (`http://localhost:11434`). No separate adapter service is required.

## Setup

1. Install Ollama: https://ollama.ai
2. Run `ollama serve` (or start the Ollama app)
3. Pull models: `ollama pull qwen2.5-coder:7b`

## Kyro Backend Detection

The IDE's `detect_ai_backends` command checks for Ollama and uses it for chat, completion, and code tasks when available. Priority: AirLLM > Ollama > LM Studio > vLLM > PicoClaw > fallback.
