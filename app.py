"""
SAMUDRA — FastAPI Inference Server  (Fixed)
============================================
Install once:
    pip install fastapi uvicorn onnxruntime opencv-python numpy python-multipart

Run:
    python app.py                          # uses defaults
    uvicorn app:app --host 0.0.0.0 --port 8001 --reload

Environment variables (all optional):
    SAMUDRA_MODEL_PATH=samudra_v3.onnx
    SAMUDRA_META_PATH=class_names_v3.json
    FRONTEND_URL=http://localhost:3000     # primary allowed CORS origin
    USE_CUDA=1                             # set to 1 to prefer GPU via ONNX Runtime
    PORT=8001                              # port for the __main__ runner

Endpoints:
    GET  /                              → server info + links
    GET  /api/samudra/health            → model status
    POST /api/samudra/upload            → classify an uploaded image file
    POST /api/samudra/live              → classify a base64-encoded frame
    POST /api/samudra/reload            → hot-reload the ONNX model
"""

import asyncio
import base64
import json
import logging
import os
from io import BytesIO
from pathlib import Path
from typing import Any, Dict, List, Optional

import cv2
import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

# ─────────────────────────────────────────────────────────────────────────────
# Logging
# ─────────────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("samudra")

# ─────────────────────────────────────────────────────────────────────────────
# Optional onnxruntime import  (BUG-FIX: capture ImportError gracefully)
# ─────────────────────────────────────────────────────────────────────────────
try:
    import onnxruntime as ort
    ORT_IMPORT_ERROR = ""
except Exception as exc:          # pragma: no cover
    ort = None                    # type: ignore[assignment]
    ORT_IMPORT_ERROR = str(exc)
    log.warning("onnxruntime not available: %s", exc)

# ─────────────────────────────────────────────────────────────────────────────
# Config from environment
# ─────────────────────────────────────────────────────────────────────────────
MODEL_PATH   = Path(os.getenv("SAMUDRA_MODEL_PATH", "samudra_v3.onnx"))
META_PATH    = Path(os.getenv("SAMUDRA_META_PATH",  "class_names_v3.json"))
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
USE_CUDA     = os.getenv("USE_CUDA", "0").strip() == "1"   # BUG-FIX #7: GPU opt-in
PORT         = int(os.getenv("PORT", "8001"))

# ─────────────────────────────────────────────────────────────────────────────
# Default taxonomy (used when meta JSON is absent)
# ─────────────────────────────────────────────────────────────────────────────
DEFAULT_CLASSES = [
    "Plastic", "Metal", "Glass", "Paper_Cardboard",
    "Organic_Food", "Ewaste", "Textile_Fabric", "Rubber_Leather",
    "Hazardous", "Thermocol_Foam", "Nirmalya_Floral", "PoP_Chemical",
    "Firecracker_Waste", "Thermocol_Pandal", "Kite_Waste", "Holi_Color_Waste",
]

DEFAULT_HAZARD: Dict[str, str] = {
    "Plastic": "medium", "Metal": "low", "Glass": "medium",
    "Paper_Cardboard": "low", "Organic_Food": "low", "Ewaste": "high",
    "Textile_Fabric": "low", "Rubber_Leather": "medium", "Hazardous": "high",
    "Thermocol_Foam": "medium", "Nirmalya_Floral": "low", "PoP_Chemical": "high",
    "Firecracker_Waste": "high", "Thermocol_Pandal": "medium",
    "Kite_Waste": "medium", "Holi_Color_Waste": "high",
}

DEFAULT_FESTIVAL: Dict[str, str] = {
    "Nirmalya_Floral":   "Aug-Oct (Ganesh Chaturthi, Durga Puja, Chhath)",
    "PoP_Chemical":      "Aug-Oct (Ganesh/Durga immersion)",
    "Firecracker_Waste": "Oct-Nov (Diwali, Dussehra) + Jan (Lohri)",
    "Thermocol_Pandal":  "Aug-Oct (Navratri, Durga Puja, Ganesh pandals)",
    "Kite_Waste":        "Jan-Feb (Makar Sankranti, Uttarayan)",
    "Holi_Color_Waste":  "Mar (Holi)",
}

SEASONAL_CLASSES = {
    "Nirmalya_Floral", "PoP_Chemical", "Firecracker_Waste",
    "Thermocol_Pandal", "Kite_Waste", "Holi_Color_Waste",
}

# ─────────────────────────────────────────────────────────────────────────────
# SAMUDRA Runtime
# ─────────────────────────────────────────────────────────────────────────────
class SamudraRuntime:
    def __init__(self) -> None:
        self.session      = None
        self.input_name:  Optional[str] = None
        self.output_name: Optional[str] = None
        self.classes:     List[str]     = DEFAULT_CLASSES
        self.hazard:      Dict[str, str] = DEFAULT_HAZARD
        self.festival:    Dict[str, str] = DEFAULT_FESTIVAL
        self.disposal:    Dict[str, str] = {}
        self.img_size     = 224
        self.mean         = np.array([0.485, 0.456, 0.406], np.float32)
        self.std          = np.array([0.229, 0.224, 0.225], np.float32)
        self.load_error:  Optional[str]  = None

    # ── BUG-FIX #1 + #2: reset state first, wrap InferenceSession ────────────
    def load(self) -> None:
        # Reset so reload() always starts clean
        self.session     = None
        self.load_error  = None

        if ort is None:
            self.load_error = f"onnxruntime not installed: {ORT_IMPORT_ERROR}"
            log.error(self.load_error)
            return

        if not MODEL_PATH.exists():
            self.load_error = f"Model file not found: {MODEL_PATH.resolve()}"
            log.error(self.load_error)
            return

        # Load metadata (optional — fall back to defaults silently)
        if META_PATH.exists():
            try:
                with open(META_PATH, "r", encoding="utf-8") as fh:
                    meta = json.load(fh)
                self.classes   = meta.get("classes",         DEFAULT_CLASSES)
                self.hazard    = meta.get("hazard",          DEFAULT_HAZARD)
                self.festival  = meta.get("festival_season", DEFAULT_FESTIVAL)
                self.disposal  = meta.get("disposal",        {})
                self.img_size  = int(meta.get("img_size",    224))
                self.mean      = np.array(meta.get("imagenet_mean", [0.485, 0.456, 0.406]), np.float32)
                self.std       = np.array(meta.get("imagenet_std",  [0.229, 0.224, 0.225]), np.float32)
                log.info("Metadata loaded from %s  (%d classes)", META_PATH, len(self.classes))
            except Exception as exc:
                log.warning("Could not read metadata JSON, using defaults: %s", exc)
        else:
            log.warning("Metadata JSON not found (%s), using defaults.", META_PATH)

        # BUG-FIX #7: GPU opt-in via USE_CUDA env var
        providers = []
        if USE_CUDA:
            providers.append("CUDAExecutionProvider")
        providers.append("CPUExecutionProvider")

        # BUG-FIX #2: wrap session creation so a corrupt/wrong model doesn't crash startup
        try:
            self.session      = ort.InferenceSession(str(MODEL_PATH), providers=providers)
            self.input_name   = self.session.get_inputs()[0].name
            self.output_name  = self.session.get_outputs()[0].name
            log.info(
                "ONNX model loaded: %s  |  in=%s %s  out=%s %s",
                MODEL_PATH.name,
                self.input_name,  self.session.get_inputs()[0].shape,
                self.output_name, self.session.get_outputs()[0].shape,
            )
        except Exception as exc:
            self.session    = None
            self.load_error = f"Failed to load ONNX model: {exc}"
            log.error(self.load_error)

    def ready(self) -> bool:
        return self.session is not None and self.load_error is None

    # ── Preprocessing (identical to deploy script) ────────────────────────────
    def _preprocess(self, frame_bgr: np.ndarray) -> np.ndarray:
        rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        rgb = cv2.resize(rgb, (self.img_size, self.img_size))
        x   = rgb.astype(np.float32) / 255.0
        x   = (x - self.mean) / self.std
        x   = x.transpose(2, 0, 1)[np.newaxis]
        return x.astype(np.float32)

    def predict(self, frame_bgr: np.ndarray) -> Dict[str, Any]:
        if not self.ready():
            raise RuntimeError(self.load_error or "Model runtime is not ready")

        inp    = self._preprocess(frame_bgr)
        logits = self.session.run([self.output_name], {self.input_name: inp})[0][0]

        exp_scores = np.exp(logits - logits.max())
        probs      = exp_scores / exp_scores.sum()

        top5_idx   = probs.argsort()[::-1][:5]
        top1_idx   = int(top5_idx[0])
        top1_class = self.classes[top1_idx]
        top1_conf  = float(probs[top1_idx])

        return {
            "class":       top1_class,
            "confidence":  top1_conf,
            "hazard":      self.hazard.get(top1_class, "unknown"),
            "festival":    self.festival.get(top1_class),
            "disposal":    self.disposal.get(top1_class, "Dispose appropriately"),
            "is_seasonal": top1_class in SEASONAL_CLASSES,
            "top5": [
                {"class": self.classes[int(i)], "confidence": float(probs[int(i)])}
                for i in top5_idx
            ],
        }


# ─────────────────────────────────────────────────────────────────────────────
# App + middleware
# ─────────────────────────────────────────────────────────────────────────────
runtime = SamudraRuntime()

app = FastAPI(
    title="SAMUDRA Inference API",
    description="Indian Beach Waste Classification — 16-class taxonomy with seasonal festival detection",
    version="1.1.0",
)

# BUG-FIX #3: CORS — accept all origins in dev; restrict via FRONTEND_URL in prod
_cors_origins = [
    FRONTEND_URL,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",   # Vite
    "http://127.0.0.1:5173",
    "http://localhost:8080",   # Vue CLI / others
    "http://localhost:5500",   # VS Code Live Server
    "http://127.0.0.1:5500",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────────────────────────────────────
# Startup event — load model when server boots
# ─────────────────────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup_event() -> None:
    log.info("=" * 55)
    log.info("🌊  SAMUDRA Inference Server starting up")
    log.info("    Model  : %s", MODEL_PATH)
    log.info("    Meta   : %s", META_PATH)
    log.info("    GPU    : %s", "enabled" if USE_CUDA else "CPU only")
    log.info("=" * 55)
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, runtime.load)
    if runtime.ready():
        log.info("✅  Model ready — %d classes", len(runtime.classes))
    else:
        log.warning("⚠️   Model NOT loaded: %s", runtime.load_error)


# ─────────────────────────────────────────────────────────────────────────────
# Pydantic models
# ─────────────────────────────────────────────────────────────────────────────
class LiveScanRequest(BaseModel):
    image_base64: str   # raw base64 OR data URL  (data:image/jpeg;base64,...)


# ─────────────────────────────────────────────────────────────────────────────
# Helper: decode raw bytes → OpenCV BGR frame
# ─────────────────────────────────────────────────────────────────────────────
def _bytes_to_frame(raw: bytes) -> np.ndarray:
    np_img = np.frombuffer(raw, np.uint8)
    frame  = cv2.imdecode(np_img, cv2.IMREAD_COLOR)
    if frame is None:
        raise HTTPException(status_code=400, detail="Could not decode image — unsupported format or corrupt file")
    return frame


# ─────────────────────────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────────────────────────

# BUG-FIX #6: Root endpoint
@app.get("/", include_in_schema=False)
async def root():
    return RedirectResponse(url="/docs")


@app.get("/api/samudra/health")
async def health() -> Dict[str, Any]:
    """Returns model load status and basic metadata."""
    return {
        "status":       "ok" if runtime.ready() else "error",
        "model_loaded": runtime.ready(),
        "model_path":   str(MODEL_PATH.resolve()),
        "meta_path":    str(META_PATH.resolve()),
        "num_classes":  len(runtime.classes),
        "classes":      runtime.classes,
        "error":        runtime.load_error,
    }


@app.post("/api/samudra/upload")
async def predict_upload(file: UploadFile = File(...)) -> Dict[str, Any]:
    """
    Classify a waste image uploaded as multipart/form-data.
    Accepts JPEG, PNG, BMP, WEBP.
    """
    if not runtime.ready():
        raise HTTPException(status_code=503, detail=runtime.load_error or "Model not loaded")

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    # BUG-FIX #9: don't block on content_type — let cv2.imdecode decide validity
    frame  = _bytes_to_frame(raw)
    loop   = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, runtime.predict, frame)
    return {"success": True, "source": "upload", **result}


# BUG-FIX #4: was sync def — now async with run_in_executor so inference
#              doesn't block the FastAPI event loop
@app.post("/api/samudra/live")
async def predict_live(payload: LiveScanRequest) -> Dict[str, Any]:
    """
    Classify a single webcam frame sent as base64.
    Accepts raw base64 string or a full data URL (data:image/jpeg;base64,...).
    """
    if not runtime.ready():
        raise HTTPException(status_code=503, detail=runtime.load_error or "Model not loaded")

    b64 = payload.image_base64.strip()
    if not b64:
        raise HTTPException(status_code=400, detail="image_base64 field is empty")

    # Strip data URL prefix if present
    if b64.startswith("data:"):
        try:
            b64 = b64.split(",", 1)[1]
        except IndexError:
            raise HTTPException(status_code=400, detail="Malformed data URL — missing comma separator")

    try:
        raw = base64.b64decode(b64)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid base64 payload: {exc}") from exc

    frame  = _bytes_to_frame(raw)
    loop   = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, runtime.predict, frame)
    return {"success": True, "source": "live", **result}


# BUG-FIX #5: wrap runtime.load() in try/except so unexpected exceptions
#              return a structured 500 instead of crashing the worker
@app.post("/api/samudra/reload")
async def reload_model() -> Dict[str, Any]:
    """Hot-reload the ONNX model and metadata from disk (no server restart needed)."""
    try:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, runtime.load)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error during reload: {exc}",
        ) from exc

    if not runtime.ready():
        raise HTTPException(
            status_code=500,
            detail=runtime.load_error or "Reload failed — unknown error",
        )
    return {"success": True, "message": "Model reloaded successfully", "num_classes": len(runtime.classes)}


# ─────────────────────────────────────────────────────────────────────────────
# BUG-FIX #8: __main__ runner — python app.py just works
# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    print("=" * 55)
    print("🌊  SAMUDRA — Starting server")
    print(f"    http://localhost:{PORT}")
    print(f"    http://localhost:{PORT}/docs   ← interactive API")
    print("=" * 55)
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=PORT,
        reload=True,            # auto-reload on code changes
        log_level="info",
    )