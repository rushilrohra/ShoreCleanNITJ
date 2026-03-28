"""
SAMUDRA — FastAPI Inference Server  v2.0  (Gemini Scene Audit Edition)
=======================================================================
NEW in v2: POST /api/samudra/scene
    Dual-intelligence pipeline:
      1. Gemini 2.5 Flash  → spatial grounding, detects ALL waste items + bounding boxes
      2. ONNX model        → per-crop precision classification for every detected region
      Result: full forensic waste census of a beach scene from a single photograph.

All v1 endpoints (/upload, /live, /health, /reload) are UNCHANGED.

Install:
    pip install fastapi uvicorn onnxruntime opencv-python numpy python-multipart google-genai

Environment variables:
    SAMUDRA_MODEL_PATH=samudra_v3.onnx
    SAMUDRA_META_PATH=class_names_v3.json
    GEMINI_API_KEY=<your key>          ← required for /scene endpoint
    FRONTEND_URL=http://localhost:3000
    USE_CUDA=1                          ← optional GPU
    PORT=8001
"""

import asyncio
import base64
import json
import logging
import os
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
logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(levelname)-8s  %(message)s", datefmt="%H:%M:%S")
log = logging.getLogger("samudra")

# ─────────────────────────────────────────────────────────────────────────────
# onnxruntime
# ─────────────────────────────────────────────────────────────────────────────
try:
    import onnxruntime as ort
    ORT_IMPORT_ERROR = ""
except Exception as exc:
    ort = None
    ORT_IMPORT_ERROR = str(exc)
    log.warning("onnxruntime not available: %s", exc)

# ─────────────────────────────────────────────────────────────────────────────
# google-genai  (new unified SDK — NOT deprecated google-generativeai)
# ─────────────────────────────────────────────────────────────────────────────
try:
    from google import genai as _genai
    from google.genai import types as _gtypes
    GENAI_AVAILABLE = True
except ImportError:
    _genai = None
    _gtypes = None
    GENAI_AVAILABLE = False
    log.warning("google-genai not installed. /scene endpoint will be disabled.")

# ─────────────────────────────────────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────────────────────────────────────
MODEL_PATH    = Path(os.getenv("SAMUDRA_MODEL_PATH", "samudra_v3.onnx"))
META_PATH     = Path(os.getenv("SAMUDRA_META_PATH",  "class_names_v3.json"))
FRONTEND_URL  = os.getenv("FRONTEND_URL", "http://localhost:3000")
USE_CUDA      = os.getenv("USE_CUDA", "0").strip() == "1"
PORT          = int(os.getenv("PORT", "8001"))
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "AIzaSyAwlDPA7POc5ts3OqiXSjW6p-FySdutN0c")   # ← paste your key here as fallback
# GEMINI_API_KEY = "AIza..."                        # ← or hardcode directly

GEMINI_MODEL  = "gemini-2.5-flash"                 # best price/perf for spatial tasks

# ─────────────────────────────────────────────────────────────────────────────
# Taxonomy
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
    "Nirmalya_Floral":   "Aug–Oct (Ganesh Chaturthi, Durga Puja, Chhath Puja)",
    "PoP_Chemical":      "Sep–Oct (Post-Ganesh / Durga Visarjan)",
    "Firecracker_Waste": "Oct–Nov (Diwali, Dussehra) + Jan (Lohri)",
    "Thermocol_Pandal":  "Aug–Oct (Navratri, Durga Puja, Ganesh pandals)",
    "Kite_Waste":        "Jan–Feb (Makar Sankranti, Uttarayan)",
    "Holi_Color_Waste":  "Mar (Holi)",
}
SEASONAL_CLASSES = {
    "Nirmalya_Floral", "PoP_Chemical", "Firecracker_Waste",
    "Thermocol_Pandal", "Kite_Waste", "Holi_Color_Waste",
}
HAZARD_BGR = {
    "low":     (76,  175,  80),   # green
    "medium":  (0,   152, 255),   # orange
    "high":    (54,   67, 244),   # red
    "unknown": (150, 150, 150),
}

# ─────────────────────────────────────────────────────────────────────────────
# ━━━━━━━━━━━━━━━━━━━━━━━━━  THE GEMINI PROMPT  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# This is the core of the new feature. Every word is deliberate.
# ─────────────────────────────────────────────────────────────────────────────

GEMINI_SYSTEM_INSTRUCTION = """
You are SAMUDRA-VISION, an expert coastal waste detection AI built specifically for Indian beaches
and waterfronts. You have deep knowledge of Indian cultural waste patterns, festival cycles, and
the specific visual appearance of each waste type in a beach environment.

MISSION
Perform an exhaustive spatial waste census of the provided beach/coastal image.
Your job is to find and localize EVERY visible piece of waste — not to summarize the scene.

MANDATORY RULES — follow without exception
1. Detect ALL waste items. Scan every region of the image: foreground, background, waterline, dry sand, wet sand, rocks, vegetation edges.
2. Tight bounding boxes only. Boxes must hug the object — not enclose half the beach.
3. Use ONLY the 16 SAMUDRA classes listed below. Never invent a new class.
4. Do NOT classify: clean sand, water, rocks, sky, people, boats, birds, vegetation, or natural objects as waste.
5. For a dense cluster of identical items (e.g. a pile of flower petals), create ONE detection with an accurate item_count.
6. When in doubt between waste vs. non-waste, choose waste.
7. Return ONLY valid JSON. No markdown, no explanation, no preamble, no text outside the JSON array.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THE 16 SAMUDRA CLASSES — WITH PRECISE VISUAL SIGNATURES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

── GENERIC WASTE (year-round) ──

Plastic
  Bottles (clear / coloured PET), plastic bags, cling film, wrappers, straws, caps, lids,
  multilayer food packets, synthetic rope fragments, fishing net pieces (if synthetic),
  polythene sheets. Key visual cues: transparent or semi-transparent film, coloured labelling,
  crinkled texture, shiny non-metallic surfaces.

Metal
  Aluminium cans (cylindrical, pull-tab top), tin cans, crushed foil, bottle caps,
  wire coils, scrap metal pieces. Key cues: reflective metallic sheen, rust stains.

Glass
  Brown / green / clear glass bottles, broken shards, fragments. Key cues: glinting
  in sunlight, translucent with hard edges, sharp fragments partly buried in sand.

Paper_Cardboard
  Newspapers, flyers, pamphlets, food cartons, cardboard boxes, paper cups, tea cups,
  used posters. Key cues: fibrous texture, often discoloured / wet-flattened in sand.

Organic_Food
  Fruit peels (banana, mango, citrus), food scraps, non-ritual coconut shell halves,
  vegetable matter, rotten food lumps, tea bags. Do NOT classify ritual offerings here.

Ewaste
  Batteries (AA/AAA cylinders, rectangular 9V), discarded mobile phones or parts,
  circuit boards, coiled cables, earphones, USB drives. Key cues: circuit-board green,
  metallic + plastic composite.

Textile_Fabric
  Cloth rags, torn clothing, t-shirts, fishing net (textile type), synthetic rope,
  jute sacks, nylon string in large tangles. Key cues: woven/fibrous texture in non-ritual context.

Rubber_Leather
  Rubber flip-flops / chappals (very common on Indian beaches), tyre strips, rubber bands,
  leather belts / bags. Key cues: flat rubber sole shape, tread pattern, black rubbery material.

Hazardous
  Chemical drums or bottles (bleach, pesticide, industrial chemical labels),
  medical waste (syringes, IV bags, bandages), mystery dark-liquid containers,
  automotive fluid containers. Key cues: skull/hazard labels, unusual liquid residue.

Thermocol_Foam
  White expanded polystyrene (EPS) packaging blocks, foam cups, foam plates,
  small foam packing peanuts. These are SMALLER pieces used for product packaging —
  distinguish from large pandal-foam sheets (see Thermocol_Pandal below).

── INDIAN FESTIVAL WASTE (season-specific — PRIORITY detection) ──

Nirmalya_Floral                             [PEAK: Aug–Oct]
  VISUAL MARKERS:
  - Marigold garlands (orange/yellow), loose marigold petals scattered across sand — HIGH DENSITY clusters
  - Rose petals (red/pink), jasmine string garlands (white)
  - Lotus flowers or fragments
  - Wilted flower clusters (brown/dried, still recognizable as garlands)
  - Tulsi (basil) leaves scattered on sand
  - Banana leaf prasad plates (broad green/brown flat leaves, often with food remnants)
  - Clay diyas (small terracotta oil lamps, 5–8 cm, disc-shaped, burnt wick inside)
  - Red or yellow chunri/dupatta cloth pieces (small strips of offering fabric)
  - Coconut shell halves with sindoor (red/orange powder staining the inside)
  Festivals: Ganesh Chaturthi, Durga Puja, Chhath Puja, Navratri, Diwali puja

PoP_Chemical                                [PEAK: Sep–Oct]
  VISUAL MARKERS:
  - WHITE or LIGHT GREY plaster/gypsum fragments — irregular broken chunks, 3–20 cm
  - Broken idol pieces: white-painted clay/plaster torso, limbs, head fragments with paint (gold/red/blue/green paint traces)
  - Milky-white or pale grey liquid puddles / stains on wet sand near waterline
  - Chemical-stained sand patches (discoloured white/grey zones distinct from normal sand colour)
  - Fine white powder residue on sand surface
  Festivals: Ganesh Visarjan, Durga immersion (post-idol dissolution)

Firecracker_Waste                           [PEAK: Oct–Nov, Jan]
  VISUAL MARKERS:
  - RED or GREEN paper cylinders / tubes (1–6 cm diameter, 5–20 cm long) — classic firework casings
  - Cardboard cylinders with burnt ends
  - METALLIC FOIL STRIPS (silver / gold shimmer) — remnants of sparklers or crackers
  - Sparkler wire sticks (thin steel wire, 20–30 cm, with grey burnt residue at one end)
  - Grey/black ash patches on sand
  - Flower pot remnants (terracotta or cardboard, scorched)
  - Paper bomb / ladi phataka casings (small red paper squares linked in strips)
  Festivals: Diwali, Dussehra, Lohri, New Year celebrations

Thermocol_Pandal                            [PEAK: Aug–Oct]
  VISUAL MARKERS:
  - LARGE white polystyrene sheets (bigger than 30 cm) — structural pieces from temporary pandals
  - Thick foam blocks (10–50 cm), often with PAINT on them (gold, silver, red, green — decorative pandal colours)
  - Large foam panels with printed/painted designs
  - Structural white foam with rough broken edges (torn from a larger structure)
  DISTINGUISH from Thermocol_Foam: pandal foam is LARGE and PAINTED; packaging foam is SMALL and WHITE.
  Festivals: Navratri, Durga Puja, Ganesh Chaturthi pandal teardown

Kite_Waste                                  [PEAK: Jan–Feb]
  VISUAL MARKERS:
  - Kite paper: diamond or delta-shaped coloured paper (hot pink / green / yellow / blue / red) — may be intact or torn
  - Manja string / thread: thin string (may be cotton or synthetic), often in tangles on sand
  - Bamboo kite sticks: thin bamboo strips, 20–60 cm, sometimes still attached to kite paper
  - Coloured paper/plastic ribbon tails (long strips used as kite tails)
  - Torn kite fabric or foil pieces (metallic kites)
  Festivals: Makar Sankranti, Uttarayan (Gujarat/Rajasthan communities)

Holi_Color_Waste                            [PEAK: Mar]
  VISUAL MARKERS:
  - VIVID POWDER STAINS on sand: hot pink (gulal), bright green, yellow, deep red, blue, purple
  - Coloured water puddles or dried colour patches (distinct, saturated hues)
  - Torn or crumpled plastic colour pouches / packets (small sachets, often silver-lined inside)
  - Cloth or fabric with heavy colour staining in Holi colours
  - Balloon remnants with colour residue
  Festival: Holi

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT SCHEMA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Return a JSON array. Each element is one detected waste item or cluster:

[
  {
    "box_2d": [ymin, xmin, ymax, xmax],   // integers 0–1000, normalized coordinates
    "samudra_class": "<one of the 16 classes above>",
    "gemini_confidence": "high" | "medium" | "low",
    "visual_evidence": "<one concise sentence: what visual features led to this classification>",
    "is_festival_waste": true | false,
    "item_count": <integer, 1 for single items, higher for dense clusters>
  },
  ...
]

CRITICAL: box_2d coordinates are NORMALIZED to a 0–1000 scale:
  - ymin = top edge of bbox / image_height * 1000
  - xmin = left edge of bbox / image_width * 1000
  - ymax = bottom edge of bbox / image_height * 1000
  - xmax = right edge of bbox / image_width * 1000
Ensure ymin < ymax and xmin < xmax.
""".strip()

GEMINI_USER_PROMPT = (
    "Perform a complete waste census on this Indian beach image. "
    "Detect every visible waste item and return the JSON array as specified. "
    "Be exhaustive — check the waterline, dry sand, wet sand, and any rocks or vegetation edges visible in the image."
)

# ─────────────────────────────────────────────────────────────────────────────
# ONNX Runtime
# ─────────────────────────────────────────────────────────────────────────────
class SamudraRuntime:
    def __init__(self) -> None:
        self.session = None
        self.input_name:  Optional[str] = None
        self.output_name: Optional[str] = None
        self.classes:     List[str]      = DEFAULT_CLASSES
        self.hazard:      Dict[str, str] = DEFAULT_HAZARD
        self.festival:    Dict[str, str] = DEFAULT_FESTIVAL
        self.disposal:    Dict[str, str] = {}
        self.img_size     = 224
        self.mean         = np.array([0.485, 0.456, 0.406], np.float32)
        self.std          = np.array([0.229, 0.224, 0.225], np.float32)
        self.load_error:  Optional[str]  = None

    def load(self) -> None:
        self.session    = None
        self.load_error = None

        if ort is None:
            self.load_error = f"onnxruntime not installed: {ORT_IMPORT_ERROR}"; return
        if not MODEL_PATH.exists():
            self.load_error = f"Model not found: {MODEL_PATH.resolve()}"; return

        if META_PATH.exists():
            try:
                with open(META_PATH, "r", encoding="utf-8") as fh:
                    meta = json.load(fh)
                self.classes   = meta.get("classes",         DEFAULT_CLASSES)
                self.hazard    = meta.get("hazard",          DEFAULT_HAZARD)
                self.festival  = meta.get("festival_season", DEFAULT_FESTIVAL)
                self.disposal  = meta.get("disposal",        {})
                self.img_size  = int(meta.get("img_size", 224))
                self.mean      = np.array(meta.get("imagenet_mean", [0.485, 0.456, 0.406]), np.float32)
                self.std       = np.array(meta.get("imagenet_std",  [0.229, 0.224, 0.225]), np.float32)
                log.info("Meta loaded: %d classes", len(self.classes))
            except Exception as exc:
                log.warning("Meta JSON unreadable, using defaults: %s", exc)

        providers = (["CUDAExecutionProvider"] if USE_CUDA else []) + ["CPUExecutionProvider"]
        try:
            self.session      = ort.InferenceSession(str(MODEL_PATH), providers=providers)
            self.input_name   = self.session.get_inputs()[0].name
            self.output_name  = self.session.get_outputs()[0].name
            log.info("ONNX ready: %s | %s", MODEL_PATH.name, self.session.get_inputs()[0].shape)
        except Exception as exc:
            self.session    = None
            self.load_error = f"ONNX load failed: {exc}"
            log.error(self.load_error)

    def ready(self) -> bool:
        return self.session is not None

    def _preprocess(self, frame_bgr: np.ndarray) -> np.ndarray:
        rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        rgb = cv2.resize(rgb, (self.img_size, self.img_size))
        x   = rgb.astype(np.float32) / 255.0
        x   = (x - self.mean) / self.std
        return x.transpose(2, 0, 1)[np.newaxis].astype(np.float32)

    def predict(self, frame_bgr: np.ndarray) -> Dict[str, Any]:
        if not self.ready():
            raise RuntimeError(self.load_error or "Model not ready")
        inp    = self._preprocess(frame_bgr)
        logits = self.session.run([self.output_name], {self.input_name: inp})[0][0]
        probs  = np.exp(logits - logits.max()); probs /= probs.sum()
        top5   = probs.argsort()[::-1][:5]
        cls    = self.classes[top5[0]]
        return {
            "class":       cls,
            "confidence":  float(probs[top5[0]]),
            "hazard":      self.hazard.get(cls, "unknown"),
            "festival":    self.festival.get(cls),
            "disposal":    self.disposal.get(cls, "Dispose appropriately"),
            "is_seasonal": cls in SEASONAL_CLASSES,
            "top5": [{"class": self.classes[int(i)], "confidence": float(probs[int(i)])} for i in top5],
        }


# ─────────────────────────────────────────────────────────────────────────────
# Gemini Scene Analyzer
# ─────────────────────────────────────────────────────────────────────────────
class GeminiSceneAnalyzer:
    """Wraps Gemini 2.5 Flash spatial grounding for multi-object waste detection."""

    def __init__(self) -> None:
        self._client = None

    def _get_client(self):
        if self._client is None:
            key = GEMINI_API_KEY
            if not key:
                raise RuntimeError(
                    "GEMINI_API_KEY is not set. Add it as an environment variable "
                    "or set the GEMINI_API_KEY constant in app.py."
                )
            if not GENAI_AVAILABLE:
                raise RuntimeError("google-genai is not installed. Run: pip install google-genai")
            self._client = _genai.Client(api_key=key)
        return self._client

    def detect(self, image_bgr: np.ndarray) -> List[Dict[str, Any]]:
        """
        Send image to Gemini 2.5 Flash with our precision prompt.
        Returns list of raw Gemini detections (before ONNX verification).
        """
        client = self._get_client()

        # Encode image as JPEG bytes for the API
        ok, buf = cv2.imencode(".jpg", image_bgr, [cv2.IMWRITE_JPEG_QUALITY, 92])
        if not ok:
            raise RuntimeError("Failed to encode image for Gemini API")
        img_bytes = buf.tobytes()

        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=[
                _gtypes.Part.from_bytes(data=img_bytes, mime_type="image/jpeg"),
                _gtypes.Part.from_text(text=GEMINI_USER_PROMPT),
            ],
            config=_gtypes.GenerateContentConfig(
                system_instruction=GEMINI_SYSTEM_INSTRUCTION,
                response_mime_type="application/json",
                temperature=0.2,        # low temp = consistent structured output
                max_output_tokens=4096,
            ),
        )

        raw_text = response.text.strip()

        # Strip markdown fences if Gemini adds them despite the instruction
        if raw_text.startswith("```"):
            raw_text = raw_text.split("\n", 1)[-1]
            raw_text = raw_text.rsplit("```", 1)[0].strip()

        detections = json.loads(raw_text)
        if not isinstance(detections, list):
            detections = detections.get("detections", detections.get("items", []))
        return detections


# ─────────────────────────────────────────────────────────────────────────────
# Scene Audit: fuse Gemini bboxes + ONNX per-crop classification
# ─────────────────────────────────────────────────────────────────────────────
def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))

def run_scene_audit(
    image_bgr: np.ndarray,
    gemini_detections: List[Dict],
    onnx: SamudraRuntime,
) -> Dict[str, Any]:
    """
    For each Gemini detection:
      1. Convert normalized [0-1000] bbox → pixel coords
      2. Crop the region
      3. Run ONNX on the crop → verified class
      4. Merge Gemini spatial context + ONNX classification
    Also builds annotated image and scene-level statistics.
    """
    h, w = image_bgr.shape[:2]
    annotated = image_bgr.copy()
    objects   = []

    for idx, det in enumerate(gemini_detections):
        box = det.get("box_2d") or det.get("bounding_box") or det.get("bbox", [])
        if len(box) != 4:
            continue

        # Gemini format: [ymin, xmin, ymax, xmax] normalized 0–1000
        ymin_n, xmin_n, ymax_n, xmax_n = [float(b) for b in box]

        px_ymin = int(_clamp(ymin_n / 1000 * h, 0, h - 1))
        px_xmin = int(_clamp(xmin_n / 1000 * w, 0, w - 1))
        px_ymax = int(_clamp(ymax_n / 1000 * h, 0, h))
        px_xmax = int(_clamp(xmax_n / 1000 * w, 0, w))

        # Skip degenerate boxes
        if px_ymax - px_ymin < 8 or px_xmax - px_xmin < 8:
            continue

        crop = image_bgr[px_ymin:px_ymax, px_xmin:px_xmax]

        # ONNX precision classification of the crop
        try:
            onnx_result = onnx.predict(crop) if onnx.ready() else None
        except Exception as e:
            log.warning("ONNX crop inference failed for item %d: %s", idx, e)
            onnx_result = None

        # Resolve final class: ONNX if available, fallback to Gemini suggestion
        gemini_cls   = det.get("samudra_class") or det.get("class", "Plastic")
        if onnx_result:
            final_cls  = onnx_result["class"]
            final_conf = onnx_result["confidence"]
            top5       = onnx_result["top5"]
        else:
            final_cls  = gemini_cls
            final_conf = 0.0
            top5       = []

        hazard      = onnx.hazard.get(final_cls, DEFAULT_HAZARD.get(final_cls, "unknown"))
        festival    = onnx.festival.get(final_cls, DEFAULT_FESTIVAL.get(final_cls))
        is_seasonal = final_cls in SEASONAL_CLASSES
        hcol        = HAZARD_BGR.get(hazard, HAZARD_BGR["unknown"])

        item_count  = int(det.get("item_count", 1))

        # ── Draw bounding box on annotated image ──────────────────────────
        cv2.rectangle(annotated, (px_xmin, px_ymin), (px_xmax, px_ymax), hcol, 2)

        # Label background + text
        label     = f"#{idx+1} {final_cls.replace('_',' ')}"
        conf_text = f"{final_conf*100:.0f}%" if final_conf > 0 else "(Gemini)"
        tag       = f"{label}  {conf_text}"
        (tw, th), _ = cv2.getTextSize(tag, cv2.FONT_HERSHEY_SIMPLEX, 0.48, 1)
        lbl_y     = max(px_ymin - 4, th + 4)
        cv2.rectangle(annotated, (px_xmin, lbl_y - th - 4), (px_xmin + tw + 6, lbl_y + 2), hcol, -1)
        cv2.putText(annotated, tag, (px_xmin + 3, lbl_y - 1),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.48, (255, 255, 255), 1, cv2.LINE_AA)

        # Seasonal badge
        if is_seasonal:
            badge = "FESTIVAL"
            (bw, bh), _ = cv2.getTextSize(badge, cv2.FONT_HERSHEY_SIMPLEX, 0.38, 1)
            bx = px_xmax - bw - 10
            by = px_ymin + 4
            cv2.rectangle(annotated, (bx - 2, by), (bx + bw + 2, by + bh + 4), (32, 176, 255), -1)
            cv2.putText(annotated, badge, (bx, by + bh + 1),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.38, (10, 14, 20), 1, cv2.LINE_AA)

        objects.append({
            "item_id":         idx + 1,
            "bbox_pixels":     {"xmin": px_xmin, "ymin": px_ymin, "xmax": px_xmax, "ymax": px_ymax},
            "bbox_normalized": {"xmin": xmin_n, "ymin": ymin_n, "xmax": xmax_n, "ymax": ymax_n},
            "class":           final_cls,
            "confidence":      round(final_conf, 4),
            "hazard":          hazard,
            "festival":        festival,
            "is_seasonal":     is_seasonal,
            "item_count":      item_count,
            "top5":            top5,
            "gemini_hint":     gemini_cls,
            "gemini_confidence": det.get("gemini_confidence", "unknown"),
            "visual_evidence": det.get("visual_evidence", ""),
            "disposal":        onnx.disposal.get(final_cls, "Dispose appropriately"),
        })

    # ── Scene-level stats ─────────────────────────────────────────────────
    total_items = sum(o["item_count"] for o in objects)
    class_counts: Dict[str, int] = {}
    hazard_dist:  Dict[str, int] = {"low": 0, "medium": 0, "high": 0, "unknown": 0}
    festival_types: List[str]    = []

    for o in objects:
        class_counts[o["class"]] = class_counts.get(o["class"], 0) + o["item_count"]
        hazard_dist[o["hazard"]] = hazard_dist.get(o["hazard"], 0) + o["item_count"]
        if o["festival"] and o["festival"] not in festival_types:
            festival_types.append(o["festival"])

    dominant_class = max(class_counts, key=class_counts.get) if class_counts else None

    # Waste density: bboxes as fraction of image area
    bbox_area_total = sum(
        (o["bbox_pixels"]["xmax"] - o["bbox_pixels"]["xmin"]) *
        (o["bbox_pixels"]["ymax"] - o["bbox_pixels"]["ymin"])
        for o in objects
    )
    img_area        = h * w
    waste_coverage_pct = round(bbox_area_total / img_area * 100, 2) if img_area > 0 else 0.0

    # Draw scene stats bar at top of annotated image
    bar_h = 48
    overlay = annotated.copy()
    cv2.rectangle(overlay, (0, 0), (w, bar_h), (10, 14, 20), -1)
    cv2.addWeighted(overlay, 0.75, annotated, 0.25, 0, annotated)
    summary = (f"SAMUDRA SCENE AUDIT  |  {len(objects)} objects  |  "
               f"{total_items} items  |  waste coverage: {waste_coverage_pct}%  |  "
               f"dominant: {(dominant_class or 'none').replace('_',' ')}")
    cv2.putText(annotated, summary, (10, 30),
                cv2.FONT_HERSHEY_SIMPLEX, 0.52, (220, 220, 220), 1, cv2.LINE_AA)

    # Encode annotated image as base64 JPEG
    _, enc_buf = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 88])
    annotated_b64 = base64.b64encode(enc_buf.tobytes()).decode()

    return {
        "objects":          objects,
        "scene_stats": {
            "total_objects":       len(objects),
            "total_item_count":    total_items,
            "dominant_class":      dominant_class,
            "class_distribution":  class_counts,
            "hazard_distribution": hazard_dist,
            "festival_types_detected": festival_types,
            "waste_coverage_pct":  waste_coverage_pct,
            "onnx_verified":       onnx.ready(),
        },
        "annotated_image_b64": annotated_b64,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Singletons
# ─────────────────────────────────────────────────────────────────────────────
runtime = SamudraRuntime()
gemini  = GeminiSceneAnalyzer()

app = FastAPI(
    title="SAMUDRA Inference API v2",
    description=(
        "Indian Beach Waste Classifier — 16-class taxonomy + "
        "Gemini 2.5 Flash dual-intelligence scene audit"
    ),
    version="2.0.0",
)

_cors_origins = [
    FRONTEND_URL,
    "http://localhost:3000", "http://127.0.0.1:3000",
    "http://localhost:5173", "http://127.0.0.1:5173",
    "http://localhost:8080", "http://localhost:5500", "http://127.0.0.1:5500",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────────────────────────────────────
# Startup
# ─────────────────────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup_event() -> None:
    log.info("=" * 55)
    log.info("🌊  SAMUDRA v2 — Dual-Intelligence Server")
    log.info("    ONNX  : %s", MODEL_PATH)
    log.info("    Gemini: %s  (key set: %s)", GEMINI_MODEL, bool(GEMINI_API_KEY))
    log.info("=" * 55)
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, runtime.load)
    log.info("✅  ONNX model ready" if runtime.ready() else f"⚠️  ONNX NOT ready: {runtime.load_error}")


# ─────────────────────────────────────────────────────────────────────────────
# Pydantic models
# ─────────────────────────────────────────────────────────────────────────────
class LiveScanRequest(BaseModel):
    image_base64: str


class SceneRequest(BaseModel):
    image_base64: str
    min_gemini_confidence: str = "low"   # "low" | "medium" | "high" — filter detections


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────
def _bytes_to_frame(raw: bytes) -> np.ndarray:
    frame = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
    if frame is None:
        raise HTTPException(status_code=400, detail="Could not decode image — unsupported format or corrupt file")
    return frame

def _b64_to_frame(b64: str) -> np.ndarray:
    b64 = b64.strip()
    if b64.startswith("data:"):
        try:
            b64 = b64.split(",", 1)[1]
        except IndexError:
            raise HTTPException(status_code=400, detail="Malformed data URL")
    try:
        raw = base64.b64decode(b64)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid base64: {exc}")
    return _bytes_to_frame(raw)


# ─────────────────────────────────────────────────────────────────────────────
# ── V1 Endpoints (unchanged) ──────────────────────────────────────────────
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/", include_in_schema=False)
async def root():
    return RedirectResponse(url="/docs")


@app.get("/api/samudra/health")
async def health() -> Dict[str, Any]:
    return {
        "status":        "ok" if runtime.ready() else "error",
        "model_loaded":  runtime.ready(),
        "model_path":    str(MODEL_PATH.resolve()),
        "gemini_ready":  bool(GEMINI_API_KEY) and GENAI_AVAILABLE,
        "gemini_model":  GEMINI_MODEL,
        "num_classes":   len(runtime.classes),
        "classes":       runtime.classes,
        "error":         runtime.load_error,
    }


@app.post("/api/samudra/upload")
async def predict_upload(file: UploadFile = File(...)) -> Dict[str, Any]:
    if not runtime.ready():
        raise HTTPException(status_code=503, detail=runtime.load_error or "Model not loaded")
    raw   = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")
    frame  = _bytes_to_frame(raw)
    loop   = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, runtime.predict, frame)
    return {"success": True, "source": "upload", **result}


@app.post("/api/samudra/live")
async def predict_live(payload: LiveScanRequest) -> Dict[str, Any]:
    if not runtime.ready():
        raise HTTPException(status_code=503, detail=runtime.load_error or "Model not loaded")
    frame  = _b64_to_frame(payload.image_base64)
    loop   = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, runtime.predict, frame)
    return {"success": True, "source": "live", **result}


@app.post("/api/samudra/reload")
async def reload_model() -> Dict[str, Any]:
    try:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, runtime.load)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {exc}")
    if not runtime.ready():
        raise HTTPException(status_code=500, detail=runtime.load_error or "Reload failed")
    return {"success": True, "message": "Model reloaded", "num_classes": len(runtime.classes)}


# ─────────────────────────────────────────────────────────────────────────────
# ── V2 Endpoint: Dual-Intelligence Scene Audit ────────────────────────────
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/api/samudra/scene")
async def scene_audit(payload: SceneRequest) -> Dict[str, Any]:
    """
    Dual-intelligence scene audit (NEW in v2).

    Pipeline:
      1. Gemini 2.5 Flash spatial grounding → detects ALL waste items with bounding boxes
      2. ONNX model precision-classifies each detected region crop
      3. Returns: per-object results + scene stats + annotated image (base64 JPEG)

    Input JSON:
      {
        "image_base64": "<base64 or data URL>",
        "min_gemini_confidence": "low"   // optional filter: "low"|"medium"|"high"
      }
    """
    if not GENAI_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="google-genai SDK not installed. Run: pip install google-genai"
        )
    if not GEMINI_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="GEMINI_API_KEY is not configured on the server."
        )

    frame = _b64_to_frame(payload.image_base64)
    loop  = asyncio.get_event_loop()

    # Step 1: Gemini spatial grounding (network-bound, run in executor)
    try:
        gemini_detections = await loop.run_in_executor(None, gemini.detect, frame)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Gemini returned malformed JSON: {exc}. "
                   "Try a clearer image or retry."
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Gemini API error: {exc}")

    if not gemini_detections:
        return {
            "success":    True,
            "source":     "scene",
            "objects":    [],
            "scene_stats": {
                "total_objects": 0, "total_item_count": 0,
                "dominant_class": None, "class_distribution": {},
                "hazard_distribution": {"low":0,"medium":0,"high":0,"unknown":0},
                "festival_types_detected": [], "waste_coverage_pct": 0.0,
                "onnx_verified": runtime.ready(),
            },
            "annotated_image_b64": None,
            "message": "Gemini found no waste items in this image.",
        }

    # Optional: filter by Gemini confidence
    conf_rank = {"low": 0, "medium": 1, "high": 2}
    min_rank  = conf_rank.get(payload.min_gemini_confidence, 0)
    gemini_detections = [
        d for d in gemini_detections
        if conf_rank.get(d.get("gemini_confidence", "low"), 0) >= min_rank
    ]

    # Step 2: ONNX per-crop + scene fusion (CPU-bound)
    audit = await loop.run_in_executor(
        None, run_scene_audit, frame, gemini_detections, runtime
    )

    return {
        "success": True,
        "source":  "scene",
        **audit,
    }


# ─────────────────────────────────────────────────────────────────────────────
# __main__
# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    print("=" * 60)
    print("🌊  SAMUDRA v2 — Dual-Intelligence Scene Audit")
    print(f"    http://localhost:{PORT}/docs")
    print(f"    Gemini API key set: {bool(GEMINI_API_KEY)}")
    print("=" * 60)
    uvicorn.run("app:app", host="0.0.0.0", port=PORT, reload=True, log_level="info")