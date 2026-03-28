"""
SAMUDRA inference server

Run:
  pip install fastapi uvicorn onnxruntime opencv-python numpy python-multipart
  uvicorn app:app --host 0.0.0.0 --port 8001 --reload

Environment variables (optional):
  SAMUDRA_MODEL_PATH=samudra_v3.onnx
  SAMUDRA_META_PATH=class_names_v3.json
  FRONTEND_URL=http://localhost:3000
"""

import base64
import json
import os
from io import BytesIO
from pathlib import Path
from typing import Any, Dict, List, Optional

import cv2
import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

try:
    import onnxruntime as ort
except Exception as exc:  # pragma: no cover
    ort = None
    ORT_IMPORT_ERROR = str(exc)
else:
    ORT_IMPORT_ERROR = ""


MODEL_PATH = Path(os.getenv("SAMUDRA_MODEL_PATH", "samudra_v3.onnx"))
META_PATH = Path(os.getenv("SAMUDRA_META_PATH", "class_names_v3.json"))
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")


DEFAULT_CLASSES = [
    "Plastic", "Metal", "Glass", "Paper_Cardboard",
    "Organic_Food", "Ewaste", "Textile_Fabric", "Rubber_Leather",
    "Hazardous", "Thermocol_Foam", "Nirmalya_Floral", "PoP_Chemical",
    "Firecracker_Waste", "Thermocol_Pandal", "Kite_Waste", "Holi_Color_Waste",
]

DEFAULT_HAZARD = {
    "Plastic": "medium", "Metal": "low", "Glass": "medium", "Paper_Cardboard": "low",
    "Organic_Food": "low", "Ewaste": "high", "Textile_Fabric": "low", "Rubber_Leather": "medium",
    "Hazardous": "high", "Thermocol_Foam": "medium", "Nirmalya_Floral": "low",
    "PoP_Chemical": "high", "Firecracker_Waste": "high", "Thermocol_Pandal": "medium",
    "Kite_Waste": "medium", "Holi_Color_Waste": "high",
}

SEASONAL_CLASSES = {
    "Nirmalya_Floral", "PoP_Chemical", "Firecracker_Waste",
    "Thermocol_Pandal", "Kite_Waste", "Holi_Color_Waste",
}


class LiveScanRequest(BaseModel):
    image_base64: str


class SamudraRuntime:
    def __init__(self) -> None:
        self.session = None
        self.input_name = None
        self.output_name = None
        self.classes: List[str] = DEFAULT_CLASSES
        self.hazard: Dict[str, str] = DEFAULT_HAZARD
        self.festival: Dict[str, str] = {}
        self.disposal: Dict[str, str] = {}
        self.img_size = 224
        self.mean = np.array([0.485, 0.456, 0.406], np.float32)
        self.std = np.array([0.229, 0.224, 0.225], np.float32)
        self.load_error: Optional[str] = None

    def load(self) -> None:
        if ort is None:
            self.load_error = f"onnxruntime import failed: {ORT_IMPORT_ERROR}"
            return

        if not MODEL_PATH.exists():
            self.load_error = f"Model not found: {MODEL_PATH}"
            return

        if META_PATH.exists():
            with open(META_PATH, "r", encoding="utf-8") as handle:
                meta = json.load(handle)
            self.classes = meta.get("classes", DEFAULT_CLASSES)
            self.hazard = meta.get("hazard", DEFAULT_HAZARD)
            self.festival = meta.get("festival_season", {})
            self.disposal = meta.get("disposal", {})
            self.img_size = int(meta.get("img_size", 224))
            self.mean = np.array(meta.get("imagenet_mean", [0.485, 0.456, 0.406]), np.float32)
            self.std = np.array(meta.get("imagenet_std", [0.229, 0.224, 0.225]), np.float32)

        self.session = ort.InferenceSession(
            str(MODEL_PATH),
            providers=["CUDAExecutionProvider", "CPUExecutionProvider"],
        )
        self.input_name = self.session.get_inputs()[0].name
        self.output_name = self.session.get_outputs()[0].name
        self.load_error = None

    def ready(self) -> bool:
        return self.session is not None and self.load_error is None

    def _preprocess(self, frame_bgr: np.ndarray) -> np.ndarray:
        rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        rgb = cv2.resize(rgb, (self.img_size, self.img_size))
        x = rgb.astype(np.float32) / 255.0
        x = (x - self.mean) / self.std
        x = x.transpose(2, 0, 1)[np.newaxis]
        return x.astype(np.float32)

    def predict(self, frame_bgr: np.ndarray) -> Dict[str, Any]:
        if not self.ready():
            raise RuntimeError(self.load_error or "Model runtime is not ready")

        inp = self._preprocess(frame_bgr)
        logits = self.session.run([self.output_name], {self.input_name: inp})[0][0]
        exp_scores = np.exp(logits - logits.max())
        probs = exp_scores / exp_scores.sum()

        top5_idx = probs.argsort()[::-1][:5]
        top1_idx = int(top5_idx[0])
        top1_class = self.classes[top1_idx]
        top1_conf = float(probs[top1_idx])

        return {
            "class": top1_class,
            "confidence": top1_conf,
            "hazard": self.hazard.get(top1_class, "unknown"),
            "festival": self.festival.get(top1_class),
            "disposal": self.disposal.get(top1_class, "Dispose appropriately"),
            "is_seasonal": top1_class in SEASONAL_CLASSES,
            "top5": [
                {"class": self.classes[int(i)], "confidence": float(probs[int(i)])}
                for i in top5_idx
            ],
        }


runtime = SamudraRuntime()
runtime.load()

app = FastAPI(title="SAMUDRA Inference API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/samudra/health")
def health() -> Dict[str, Any]:
    return {
        "status": "ok" if runtime.ready() else "error",
        "model_loaded": runtime.ready(),
        "model_path": str(MODEL_PATH),
        "meta_path": str(META_PATH),
        "error": runtime.load_error,
    }


@app.post("/api/samudra/upload")
async def predict_upload(file: UploadFile = File(...)) -> Dict[str, Any]:
    if not runtime.ready():
        raise HTTPException(status_code=503, detail=runtime.load_error or "Model not loaded")

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Please upload a valid image file")

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    np_img = np.frombuffer(raw, np.uint8)
    frame = cv2.imdecode(np_img, cv2.IMREAD_COLOR)
    if frame is None:
        raise HTTPException(status_code=400, detail="Could not decode image")

    result = runtime.predict(frame)
    return {"success": True, "source": "upload", **result}


@app.post("/api/samudra/live")
def predict_live(payload: LiveScanRequest) -> Dict[str, Any]:
    if not runtime.ready():
        raise HTTPException(status_code=503, detail=runtime.load_error or "Model not loaded")

    image_base64 = payload.image_base64.strip()
    if not image_base64:
        raise HTTPException(status_code=400, detail="image_base64 is required")

    if image_base64.startswith("data:"):
        try:
            image_base64 = image_base64.split(",", 1)[1]
        except Exception as exc:
            raise HTTPException(status_code=400, detail="Invalid data URL payload") from exc

    try:
        raw = base64.b64decode(image_base64)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid base64 image") from exc

    np_img = np.frombuffer(raw, np.uint8)
    frame = cv2.imdecode(np_img, cv2.IMREAD_COLOR)
    if frame is None:
        raise HTTPException(status_code=400, detail="Could not decode frame")

    result = runtime.predict(frame)
    return {"success": True, "source": "live", **result}


@app.post("/api/samudra/reload")
def reload_model() -> Dict[str, Any]:
    runtime.load()
    if not runtime.ready():
        raise HTTPException(status_code=500, detail=runtime.load_error or "Reload failed")
    return {"success": True, "message": "Model reloaded"}
