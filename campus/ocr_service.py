# campus/ocr_service.py - OCR & Document Text Extraction Service
# ==============================================================
import os
import io
import re
import base64
import logging
from typing import Optional, Tuple
from PIL import Image

logger = logging.getLogger("ocr_service")

# Auto-detect Tesseract binary on Windows/Linux
TESSERACT_CANDIDATES = [
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    os.path.expanduser(r"~\AppData\Local\Programs\Tesseract-OCR\tesseract.exe"),
    "/usr/bin/tesseract",
    "/usr/local/bin/tesseract",
]

_tesseract_configured = False

def _configure_tesseract():
    global _tesseract_configured
    if _tesseract_configured:
        return
    try:
        import pytesseract
        for path in TESSERACT_CANDIDATES:
            if os.path.exists(path):
                pytesseract.pytesseract.tesseract_cmd = path
                logger.info(f"[OCR] Tesseract binary found at {path}")
                break
        _tesseract_configured = True
    except Exception as e:
        logger.warning(f"[OCR] Error configuring pytesseract: {e}")

def extract_text_from_file_bytes(file_bytes: bytes, filename: str = "") -> str:
    """
    Extract readable text from a document (PDF, PNG, JPG, JPEG, TIFF).
    Uses a hybrid approach:
      1. For PDFs: first attempts high-speed vector text extraction via pypdfium2.
         If pages contain scanned images or minimal text, renders pages to images and runs Tesseract OCR.
      2. For Images: directly invokes pytesseract OCR with preprocessing.
    """
    if not file_bytes:
        return ""

    _configure_tesseract()
    ext = (filename.rsplit(".", 1)[-1] if "." in filename else "").lower()
    
    extracted = []

    # 1. Handle PDF
    if ext == "pdf" or file_bytes.startswith(b"%PDF"):
        try:
            import pypdfium2
            doc = pypdfium2.PdfDocument(file_bytes)
            pdf_text = []
            needs_ocr_pages = []

            for idx, page in enumerate(doc):
                textpage = page.get_textpage()
                page_text = (textpage.get_text_range() or "").strip()
                if len(page_text) > 30:
                    pdf_text.append(page_text)
                else:
                    needs_ocr_pages.append((idx, page))

            # If vector extraction succeeded for the document, combine it
            if pdf_text and len(needs_ocr_pages) == 0:
                return "\n\n".join(pdf_text)
            
            # If some or all pages are scanned images, run OCR on those pages
            if needs_ocr_pages:
                try:
                    import pytesseract
                    for idx, page in needs_ocr_pages:
                        # Render page to bitmap at 200 DPI for OCR
                        bitmap = page.render(scale=2.0)
                        pil_img = bitmap.to_pil()
                        ocr_result = pytesseract.image_to_string(pil_img)
                        if ocr_result.strip():
                            pdf_text.append(ocr_result.strip())
                except Exception as ocr_err:
                    logger.info(f"[OCR] PDF image OCR fallback notice: {ocr_err}")

            if pdf_text:
                return "\n\n".join(pdf_text)
        except Exception as e:
            logger.warning(f"[OCR] Failed to parse PDF: {e}")

    # 2. Handle Images (PNG, JPG, TIFF, etc.)
    try:
        import pytesseract
        img = Image.open(io.BytesIO(file_bytes))
        # Convert RGBA to RGB if needed
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        ocr_text = pytesseract.image_to_string(img)
        return ocr_text.strip()
    except Exception as e:
        logger.info(f"[OCR] Image OCR pass notice: {e}")

    return ""

def extract_text_from_base64(data_uri_or_base64: str, filename: str = "") -> str:
    """Helper to decode data URI or raw base64 string and extract text."""
    if not data_uri_or_base64:
        return ""
    try:
        if "," in data_uri_or_base64:
            header, encoded = data_uri_or_base64.split(",", 1)
            raw_bytes = base64.b64decode(encoded)
        else:
            raw_bytes = base64.b64decode(data_uri_or_base64)
        return extract_text_from_file_bytes(raw_bytes, filename=filename)
    except Exception as e:
        logger.warning(f"[OCR] Base64 decode failed: {e}")
        return ""

