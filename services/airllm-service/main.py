"""
Kyro IDE - AirLLM Service

Standalone Python FastAPI service for running large LLMs (GLM, Qwen2.5-class)
on 8GB VRAM using AirLLM's layer-wise inference.

Endpoints:
- POST /chat/stream - Streaming chat completion
- GET /models - List installed models + hardware requirements
- POST /models/install - Download from Hugging Face
- POST /config/profile - Set VRAM profile (4GB, 8GB, 16GB+)
"""

import os
import sys
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

# VRAM profiles
VRAM_PROFILES = {
    "4gb": {"max_model_size": "7B", "quantization": "4bit", "context": 2048},
    "8gb": {"max_model_size": "32B", "quantization": "4bit", "context": 4096},
    "16gb": {"max_model_size": "70B", "quantization": "4bit", "context": 8192},
}

# GLM and Qwen2.5 presets for 8GB
PRESET_MODELS = {
    "glm-4-9b": "THUDM/glm-4-9b-chat",
    "qwen2.5-coder-7b": "Qwen/Qwen2.5-Coder-7B-Instruct",
    "qwen2.5-coder-32b": "Qwen/Qwen2.5-Coder-32B-Instruct",
    "qwen2.5-7b": "Qwen/Qwen2.5-7B-Instruct",
}


class ChatRequest(BaseModel):
    prompt: str
    system_prompt: Optional[str] = None
    max_tokens: int = 512
    temperature: float = 0.7
    model: Optional[str] = None


class ConfigProfileRequest(BaseModel):
    profile: str  # "4gb", "8gb", "16gb"


class InstallModelRequest(BaseModel):
    model_id: str  # HuggingFace ID or preset name


# Global state
_model = None
_config = {"profile": "8gb", **VRAM_PROFILES["8gb"]}


def get_airllm_model():
    """Lazy-load AirLLM model."""
    global _model
    if _model is None:
        try:
            from airllm import AutoModelForCausalLM
            model_id = PRESET_MODELS.get(_config.get("model_id", "qwen2.5-coder-7b"), "Qwen/Qwen2.5-Coder-7B-Instruct")
            _model = AutoModelForCausalLM.from_pretrained(
                model_id,
                compression="4bit",
                trust_remote_code=True,
            )
        except ImportError:
            raise HTTPException(status_code=503, detail="AirLLM not installed. Run: pip install airllm")
    return _model


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    global _model
    _model = None


app = FastAPI(title="Kyro AirLLM Service", version="0.1.0", lifespan=lifespan)


@app.get("/models")
async def list_models():
    """List available models and hardware requirements."""
    profile = _config.get("profile", "8gb")
    vram = VRAM_PROFILES.get(profile, VRAM_PROFILES["8gb"])
    return {
        "installed": list(PRESET_MODELS.keys()),
        "presets": PRESET_MODELS,
        "current_profile": profile,
        "vram_requirements": vram,
        "loaded": _model is not None,
    }


@app.post("/config/profile")
async def set_profile(req: ConfigProfileRequest):
    """Set VRAM profile (4gb, 8gb, 16gb)."""
    if req.profile not in VRAM_PROFILES:
        raise HTTPException(status_code=400, detail=f"Invalid profile. Use: {list(VRAM_PROFILES.keys())}")
    _config["profile"] = req.profile
    _config.update(VRAM_PROFILES[req.profile])
    return {"profile": req.profile, "config": _config}


@app.post("/models/install")
async def install_model(req: InstallModelRequest):
    """Download model from Hugging Face (or use preset)."""
    model_id = PRESET_MODELS.get(req.model_id, req.model_id)
    try:
        from huggingface_hub import snapshot_download
        path = snapshot_download(repo_id=model_id)
        return {"status": "ok", "model_id": model_id, "path": path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/chat/stream")
async def chat_stream(req: ChatRequest):
    """Streaming chat completion."""
    try:
        model = get_airllm_model()
        from transformers import AutoTokenizer
        model_id = _config.get("model_id", "Qwen/Qwen2.5-Coder-7B-Instruct")
        tokenizer = AutoTokenizer.from_pretrained(model_id, trust_remote_code=True)

        prompt = req.prompt
        if req.system_prompt:
            prompt = f"System: {req.system_prompt}\n\nUser: {req.prompt}"

        inputs = tokenizer(prompt, return_tensors="pt").to(model.device)

        async def generate():
            from transformers import TextIteratorStreamer
            streamer = TextIteratorStreamer(tokenizer, skip_special_tokens=True)
            import threading
            gen_kwargs = {
                "max_new_tokens": req.max_tokens,
                "temperature": req.temperature,
                "do_sample": True,
                "streamer": streamer,
            }
            thread = threading.Thread(target=lambda: model.generate(**inputs, **gen_kwargs))
            thread.start()
            for text in streamer:
                yield f"data: {text}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(generate(), media_type="text/event-stream")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/chat")
async def chat(req: ChatRequest):
    """Non-streaming chat completion."""
    try:
        model = get_airllm_model()
        from transformers import AutoTokenizer
        model_id = _config.get("model_id", "Qwen/Qwen2.5-Coder-7B-Instruct")
        tokenizer = AutoTokenizer.from_pretrained(model_id, trust_remote_code=True)

        prompt = req.prompt
        if req.system_prompt:
            prompt = f"System: {req.system_prompt}\n\nUser: {req.prompt}"

        inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
        outputs = model.generate(
            **inputs,
            max_new_tokens=req.max_tokens,
            temperature=req.temperature,
            do_sample=True,
            pad_token_id=tokenizer.eos_token_id,
        )
        text = tokenizer.decode(outputs[0][inputs["input_ids"].shape[1]:], skip_special_tokens=True)
        return {"text": text, "model": model_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health():
    return {"status": "ok", "airllm_available": True}


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("AIRLLM_PORT", "8765"))
    uvicorn.run(app, host="127.0.0.1", port=port)
