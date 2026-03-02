# Kyro AirLLM Service

Standalone Python service for running large LLMs (GLM, Qwen2.5-class) on 8GB VRAM using [AirLLM](https://github.com/lyogavin/airllm) layer-wise inference.

## Setup

```bash
pip install -r requirements.txt
```

## Run

```bash
python main.py
# or: uvicorn main:app --host 127.0.0.1 --port 8765
```

## Endpoints

- `GET /models` - List presets and VRAM requirements
- `POST /config/profile` - Set profile: `{"profile": "8gb"}` (4gb, 8gb, 16gb)
- `POST /models/install` - Download model: `{"model_id": "qwen2.5-coder-7b"}`
- `POST /chat` - Non-streaming completion
- `POST /chat/stream` - Streaming completion
- `GET /health` - Health check

## Presets (8GB VRAM)

| Preset | Model |
|--------|-------|
| glm-4-9b | THUDM/glm-4-9b-chat |
| qwen2.5-coder-7b | Qwen/Qwen2.5-Coder-7B-Instruct |
| qwen2.5-coder-32b | Qwen/Qwen2.5-Coder-32B-Instruct |
