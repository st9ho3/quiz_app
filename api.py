import os
import tempfile
import time
import re
import json
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pdf2image import convert_from_path
import pytesseract
from PIL import Image
from google import genai
from dotenv import load_dotenv

load_dotenv()

Image.MAX_IMAGE_PIXELS = None

app = FastAPI(title="PDF to JSON Quiz API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # React dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def chunk_text(text: str, min_words: int = 500, max_words: int = 800) -> list[str]:
    words = text.split()
    if not words:
        return []

    chunks: list[str] = []
    current: list[str] = []

    for word in words:
        current.append(word)
        count = len(current)

        if count >= min_words:
            ends_sentence = bool(re.search(r"[.!?;]$", word))
            if ends_sentence or count >= max_words:
                chunks.append(" ".join(current))
                current = []

    if current:
        chunks.append(" ".join(current))

    return chunks

def call_gemini(client, prompt: str, chunk: str, model_name: str):
    max_retries = 4
    for attempt in range(max_retries):
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=prompt + chunk,
            )
            return response.text.strip()
        except Exception as e:
            err_str = str(e)
            is_retryable = "429" in err_str or "503" in err_str
            if is_retryable and attempt < max_retries - 1:
                wait = 15 * (attempt + 1)
                time.sleep(wait)
            else:
                raise Exception(f"Gemini API Error: {err_str}")
    return None

CLEANING_PROMPT = (
    "You are an expert OCR post-processor for **Greek** text. "
    "You will receive a raw chunk of text extracted via Tesseract OCR "
    "from a scanned Greek-language PDF.\n\n"
    "Your task:\n"
    "1. Fix obvious OCR mis-readings (e.g. ρ→p, ν→v, ο→o, etc.).\n"
    "2. Correct typos and accent/diacritical errors.\n"
    "3. Repair broken or half-split words.\n"
    "4. Restore proper punctuation and spacing.\n"
    "5. Do NOT add, remove, or rephrase any content.\n"
    "6. Return ONLY the cleaned text.\n\n"
    "--- RAW OCR CHUNK ---\n"
)

EXTRACTION_PROMPT = (
    "You are an expert academic study-aid generator for Greek-language "
    "university course material.\n\n"
    "You will receive a cleaned chunk of text from a textbook.\n\n"
    "Your task:\n"
    "1. Extract the most important, testable facts, definitions, key terms, and concepts.\n"
    "2. Present each concept as a concise bullet point.\n"
    "3. Group related concepts under short headings when appropriate.\n"
    "4. Use the original Greek language.\n"
    "5. Return ONLY the extracted concepts.\n\n"
    "--- CLEANED TEXT CHUNK ---\n"
)

QUESTION_PROMPT = (
    "You are an expert exam question writer for Greek-language "
    "university courses.\n\n"
    "You will receive a list of extracted concepts/facts from a textbook chapter.\n\n"
    "Your task:\n"
    "1. Generate ONE multiple-choice question for each major concept.\n"
    "2. Each question must have exactly 4 options: A, B, C, D.\n"
    "3. Only ONE option is correct. The other 3 must be plausible distractors.\n"
    "4. Write all questions and options in Greek.\n"
    "5. Format:\n\n"
    "QUESTION: <question text>\n"
    "A) <option A>\n"
    "B) <option B>\n"
    "C) <option C>\n"
    "D) <option D>\n"
    "ANSWER: <letter>\n"
    "EXPLANATION: <brief explanation>\n"
    "---\n\n"
    "6. Return ONLY the questions in the exact format.\n\n"
    "--- EXTRACTED CONCEPTS ---\n"
)

JSON_PROMPT = (
    "You are a strict data formatter.\n"
    "Take the provided multiple-choice questions and format them strictly into a JSON array.\n"
    "[\n"
    "  {\n"
    '    "question": "1. <question text>",\n'
    '    "options": [\n'
    '      "Α. <option A text>",\n'
    '      "Β. <option B text>",\n'
    '      "Γ. <option C text>",\n'
    '      "Δ. <option D text>"\n'
    "    ],\n"
    '    "correct_answer": "Α. <option A text>"\n'
    "  }\n"
    "]\n\n"
    "Rules:\n"
    "1. Output ONLY valid JSON.\n"
    "2. Make sure the correct_answer string EXACTLY matches the text of the correct option.\n"
    "3. Do NOT add markdown code blocks (e.g. ```json). Just the raw JSON.\n\n"
    "--- QUESTIONS TEXT ---\n"
)


def sse_event(step: str, detail: str, chunk_index: int = 0, total_chunks: int = 0, questions_so_far: int = 0) -> str:
    """Format a Server-Sent Event."""
    payload = json.dumps({
        "step": step,
        "detail": detail,
        "chunkIndex": chunk_index,
        "totalChunks": total_chunks,
        "questionsSoFar": questions_so_far,
    })
    return f"data: {payload}\n\n"


@app.post("/upload-stream")
async def upload_pdf_stream(
    file: UploadFile = File(...),
    model_name: str = Form("gemini-3.1-flash-lite-preview"),
    ocr_lang: str = Form("ell")
):
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key or api_key == "your_gemini_api_key_here":
        raise HTTPException(status_code=400, detail="API Key is required in .env file")

    file_content = await file.read()
    file_filename = file.filename

    def generate():
        client = genai.Client(api_key=api_key)

        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_pdf:
            tmp_pdf.write(file_content)
            tmp_pdf_path = tmp_pdf.name

        try:
            # ── Step 1: OCR ──
            yield sse_event("ocr", "Converting PDF pages to images...")
            images = convert_from_path(tmp_pdf_path, dpi=300)
            total_pages = len(images)

            all_text_parts = []
            for idx, img in enumerate(images):
                yield sse_event("ocr", f"Extracting text from page {idx + 1}/{total_pages}...")
                page_text = pytesseract.image_to_string(img, lang=ocr_lang)
                all_text_parts.append(
                    f"{'=' * 60}\n  PAGE {idx + 1}\n{'=' * 60}\n\n{page_text.strip()}\n\n"
                )

            full_text = "\n".join(all_text_parts)
            clean_text = "\n\n".join(
                t.strip()
                for t in re.split(r"={60}\n  PAGE \d+\n={60}", full_text)
                if t.strip()
            )

            # ── Step 2: Chunking ──
            yield sse_event("chunking", "Splitting text into processable chunks...")
            chunks = chunk_text(clean_text)
            total_chunks = len(chunks)

            if not chunks:
                yield sse_event("error", "Could not extract any text from the PDF.")
                return

            yield sse_event("chunking", f"Created {total_chunks} text chunks", total_chunks=total_chunks)

            combined_json = []
            questions_so_far = 0

            for i, chunk in enumerate(chunks):
                ci = i + 1

                # ── Step 3: Cleaning ──
                yield sse_event("cleaning", f"Cleaning OCR errors in chunk {ci}/{total_chunks}...", ci, total_chunks, questions_so_far)
                cleaned = call_gemini(client, CLEANING_PROMPT, chunk, model_name)
                if not cleaned:
                    continue

                # ── Step 4: Concept Extraction ──
                yield sse_event("extracting", f"Extracting concepts from chunk {ci}/{total_chunks}...", ci, total_chunks, questions_so_far)
                concepts = call_gemini(client, EXTRACTION_PROMPT, cleaned, model_name)
                if not concepts:
                    continue

                # ── Step 5: Question Generation ──
                yield sse_event("questions", f"Generating questions from chunk {ci}/{total_chunks}...", ci, total_chunks, questions_so_far)
                questions = call_gemini(client, QUESTION_PROMPT, concepts, model_name)
                if not questions:
                    continue

                # ── Step 6: JSON Formatting ──
                yield sse_event("json", f"Formatting JSON for chunk {ci}/{total_chunks}...", ci, total_chunks, questions_so_far)
                json_str = call_gemini(client, JSON_PROMPT, questions, model_name)
                if not json_str:
                    continue

                # Clean JSON formatting if Gemini wrapped it in markdown
                clean_res = json_str.strip()
                if clean_res.startswith("```json"):
                    clean_res = clean_res[7:]
                if clean_res.startswith("```"):
                    clean_res = clean_res[3:]
                if clean_res.endswith("```"):
                    clean_res = clean_res[:-3]
                clean_res = clean_res.strip()

                try:
                    parsed = json.loads(clean_res)
                    if isinstance(parsed, list):
                        combined_json.extend(parsed)
                    else:
                        combined_json.append(parsed)
                    questions_so_far = len(combined_json)
                except json.JSONDecodeError as e:
                    print(f"Error parsing JSON: {e}\nContent: {clean_res}")

            # ── Save file ──
            if combined_json:
                base_name = file_filename if file_filename else "uploaded_pdf"
                cleaned_name = re.sub(r'[^\w\-_\. ]', '_', base_name)
                if "." in cleaned_name:
                    cleaned_name = cleaned_name.rsplit('.', 1)[0]
                if not cleaned_name:
                    cleaned_name = "generated_quiz"

                json_filename = f"{cleaned_name}_questions.json"
                current_dir = os.path.dirname(os.path.abspath(__file__))
                save_path = os.path.join(current_dir, "src", json_filename)

                try:
                    with open(save_path, "w", encoding="utf-8") as f:
                        json.dump(combined_json, f, ensure_ascii=False, indent=2)
                except Exception as e:
                    print(f"Failed to save JSON to {save_path}: {e}")

            # ── Final done event with full data ──
            yield sse_event("done", "Processing complete!", 0, total_chunks, len(combined_json))
            result_payload = json.dumps({"data": combined_json})
            yield f"data: {result_payload}\n\n"

        except Exception as e:
            yield sse_event("error", str(e))
        finally:
            if os.path.exists(tmp_pdf_path):
                os.remove(tmp_pdf_path)

    return StreamingResponse(generate(), media_type="text/event-stream")


# ── Saved-quiz library endpoints ──

QUIZZES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "src")
SAFE_NAME_RE = re.compile(r"^[\w\-. ]+_questions\.json$")


@app.get("/quizzes")
async def list_quizzes():
    """List all *_questions.json files in src/ with question count and mtime."""
    if not os.path.isdir(QUIZZES_DIR):
        return {"quizzes": []}

    items = []
    for name in os.listdir(QUIZZES_DIR):
        if not name.endswith("_questions.json"):
            continue
        path = os.path.join(QUIZZES_DIR, name)
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            count = len(data) if isinstance(data, list) else 0
            mtime = os.path.getmtime(path)
            items.append({
                "filename": name,
                "display_name": name.replace("_questions.json", "").replace("_", " "),
                "question_count": count,
                "modified_at": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(mtime)) + "Z",
                "_mtime": mtime,
            })
        except Exception:
            continue

    items.sort(key=lambda x: x["_mtime"], reverse=True)
    for it in items:
        it.pop("_mtime", None)
    return {"quizzes": items}


@app.get("/quizzes/{filename}")
async def get_quiz(filename: str):
    """Return the questions array for one saved quiz file."""
    if not SAFE_NAME_RE.match(filename):
        raise HTTPException(status_code=400, detail="Invalid filename")
    path = os.path.join(QUIZZES_DIR, filename)
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="Quiz not found")
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read quiz: {e}")
    return {"filename": filename, "questions": data}
