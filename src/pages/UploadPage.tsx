import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload as UploadIcon, FileText, Check, ArrowRight, Layers } from 'lucide-react';

const API_BASE = 'http://localhost:8000';

type StageKey = 'parsing' | 'cleaning' | 'extracting' | 'building';

const STAGES: { key: StageKey; num: string; title: string; meta: string }[] = [
  { key: 'parsing',    num: '01', title: 'Parsing PDF',          meta: 'reading pages, extracting text' },
  { key: 'cleaning',   num: '02', title: 'Cleaning text',        meta: 'fixing OCR errors and typos' },
  { key: 'extracting', num: '03', title: 'Extracting questions', meta: 'identifying Q/A patterns' },
  { key: 'building',   num: '04', title: 'Building quiz set',    meta: 'finalizing JSON' },
];

const STEP_TO_STAGE: Record<string, StageKey> = {
  ocr: 'parsing',
  chunking: 'cleaning',
  cleaning: 'cleaning',
  extracting: 'extracting',
  questions: 'extracting',
  json: 'building',
};

interface RecentItem {
  filename: string;
  display_name: string;
  question_count: number;
  modified_at: string;
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const day = 86400_000;
  const hour = 3600_000;
  const minute = 60_000;
  if (diff < hour) return `${Math.max(1, Math.round(diff / minute))}m ago`;
  if (diff < day) return `${Math.round(diff / hour)}h ago`;
  return `${Math.round(diff / day)}d ago`;
}

export default function UploadPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [modelName, setModelName] = useState('gemini-3.1-flash-lite-preview');

  const [processing, setProcessing] = useState(false);
  const [stageIdx, setStageIdx] = useState(-1);
  const [stageProgress, setStageProgress] = useState(0);
  const [stageDetail, setStageDetail] = useState<Record<StageKey, string>>({
    parsing: '', cleaning: '', extracting: '', building: '',
  });
  const [chunkInfo, setChunkInfo] = useState<{ index: number; total: number }>({ index: 0, total: 0 });
  const [questionsSoFar, setQuestionsSoFar] = useState(0);
  const [done, setDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resultData, setResultData] = useState<any[] | null>(null);

  const [recent, setRecent] = useState<RecentItem[]>([]);

  useEffect(() => {
    try {
      const cached = localStorage.getItem('quizzes:recent');
      if (cached) setRecent(JSON.parse(cached));
    } catch {}

    fetch(`${API_BASE}/quizzes`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data: { quizzes: RecentItem[] }) => {
        setRecent(data.quizzes);
        try { localStorage.setItem('quizzes:recent', JSON.stringify(data.quizzes)); } catch {}
      })
      .catch(() => {});
  }, []);

  const acceptFile = (f: File) => {
    if (f.type !== 'application/pdf') {
      setErrorMsg('Please choose a PDF file.');
      return;
    }
    setFile(f);
    setErrorMsg(null);
    setDone(false);
    setResultData(null);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) acceptFile(e.dataTransfer.files[0]);
  };

  const onSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) acceptFile(e.target.files[0]);
  };

  const reset = () => {
    setFile(null);
    setProcessing(false);
    setStageIdx(-1);
    setStageProgress(0);
    setStageDetail({ parsing: '', cleaning: '', extracting: '', building: '' });
    setChunkInfo({ index: 0, total: 0 });
    setQuestionsSoFar(0);
    setDone(false);
    setErrorMsg(null);
    setResultData(null);
  };

  const onSseEvent = (payload: any, accum: { data: any[] | null }) => {
    if (payload && Array.isArray(payload.data)) {
      accum.data = payload.data;
      return;
    }

    const step: string | undefined = payload?.step;
    if (!step) return;

    if (step === 'error') throw new Error(payload.detail || 'Processing error');
    if (step === 'done') {
      setStageIdx(4);
      setStageProgress(100);
      setDone(true);
      return;
    }

    const stageKey = STEP_TO_STAGE[step];
    if (!stageKey) return;

    const newIdx = STAGES.findIndex((s) => s.key === stageKey);

    setStageIdx((prev) => {
      if (newIdx > prev) {
        setStageProgress(stageKey === 'parsing' ? 5 : 0);
        return newIdx;
      }
      return prev;
    });

    setStageDetail((prev) => ({ ...prev, [stageKey]: payload.detail || '' }));

    const total = payload.totalChunks || 0;
    const ci = payload.chunkIndex || 0;
    if (total > 0 && ci > 0) setChunkInfo({ index: ci, total });

    if (typeof payload.questionsSoFar === 'number') setQuestionsSoFar(payload.questionsSoFar);

    if (stageKey === 'parsing') {
      const m = /page\s+(\d+)\s*\/\s*(\d+)/i.exec(payload.detail || '');
      if (m) {
        const cur = parseInt(m[1], 10);
        const tot = parseInt(m[2], 10);
        setStageProgress(Math.min(100, Math.round((cur / tot) * 100)));
      } else {
        setStageProgress((p) => Math.max(p, 5));
      }
    } else if (total > 0 && ci > 0) {
      setStageProgress(Math.round((ci / total) * 100));
    }
  };

  const startProcessing = async () => {
    if (!file) return;
    setProcessing(true);
    setStageIdx(0);
    setStageProgress(5);
    setStageDetail({ parsing: '', cleaning: '', extracting: '', building: '' });
    setQuestionsSoFar(0);
    setDone(false);
    setErrorMsg(null);
    setResultData(null);

    const fd = new FormData();
    fd.append('file', file);
    fd.append('model_name', modelName);

    try {
      const res = await fetch(`${API_BASE}/upload-stream`, { method: 'POST', body: fd });
      if (!res.ok || !res.body) throw new Error(`Server returned ${res.status}: ${res.statusText}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      const accum: { data: any[] | null } = { data: null };
      let buf = '';

      while (true) {
        const { done: rdDone, value } = await reader.read();
        if (rdDone) break;
        buf += decoder.decode(value, { stream: true });
        let sep;
        while ((sep = buf.indexOf('\n\n')) !== -1) {
          const raw = buf.slice(0, sep);
          buf = buf.slice(sep + 2);
          const lines = raw.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trimStart());
          if (!lines.length) continue;
          try {
            onSseEvent(JSON.parse(lines.join('\n')), accum);
          } catch (err) {
            console.warn('Bad SSE chunk', err);
          }
        }
      }

      if (!accum.data) throw new Error('Stream ended without a result payload.');
      setResultData(accum.data);
      setDone(true);
      setStageIdx(4);
      setStageProgress(100);

      fetch(`${API_BASE}/quizzes`)
        .then((r) => r.json())
        .then((data: { quizzes: RecentItem[] }) => {
          setRecent(data.quizzes);
          try { localStorage.setItem('quizzes:recent', JSON.stringify(data.quizzes)); } catch {}
        }).catch(() => {});
    } catch (err: any) {
      setErrorMsg(err?.message || 'Upload failed.');
      setProcessing(false);
    }
  };

  const startQuizFromResult = () => {
    if (resultData) {
      navigate('/quiz', { state: { questions: resultData, source: file?.name } });
    }
  };

  const openRecent = async (item: RecentItem) => {
    try {
      const res = await fetch(`${API_BASE}/quizzes/${encodeURIComponent(item.filename)}`);
      if (!res.ok) throw new Error('Failed to load quiz');
      const data = await res.json();
      navigate('/quiz', { state: { questions: data.questions, source: item.display_name } });
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not open recent quiz.');
    }
  };

  return (
    <div className="upload-screen">
      <style>{UPLOAD_CSS}</style>

      <div className="upload-hero fade-up" style={{ animationDelay: '0.05s' }}>
        <div className="eyebrow coral">NEW QUIZ · PDF SOURCE</div>
        <h1 className="upload-heading">
          Drop a study PDF, get a <em className="italic-coral">quiz</em> back.
        </h1>
        <p className="upload-sub">
          Upload a text-based PDF and we’ll turn it into a single-choice quiz you can take right away.
        </p>
      </div>

      <section className="card upload-card fade-up" style={{ animationDelay: '0.12s' }}>
        {!file ? (
          <div
            className={`dropzone ${dragActive ? 'active' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={onSelect}
              style={{ display: 'none' }}
            />
            <div className="drop-icon">
              <UploadIcon size={20} strokeWidth={1.6} />
            </div>
            <p className="drop-line">
              Drop your PDF here, or <span className="browse-link">browse</span>
            </p>
            <p className="drop-hint">PDFs up to 25 MB · text-based documents work best</p>
          </div>
        ) : (
          <div className="file-row">
            <div className="file-icon">
              <FileText size={18} strokeWidth={1.6} />
            </div>
            <div className="file-meta">
              <div className="file-name">{file.name}</div>
              <div className="file-sub mono">
                {(file.size / 1024 / 1024).toFixed(2)} MB · {file.type || 'application/pdf'}
              </div>
            </div>
            <div className={`status-pill ${done ? 'ready' : processing ? 'processing' : 'pending'}`}>
              {done ? (
                <>
                  <Check size={12} strokeWidth={2} /> Ready
                </>
              ) : processing ? (
                <>
                  <span className="dot pulse" /> Processing
                </>
              ) : (
                <>Selected</>
              )}
            </div>
          </div>
        )}

        {file && !processing && !done && (
          <div className="upload-controls">
            <label className="ctrl-group">
              <span className="eyebrow">Model</span>
              <select value={modelName} onChange={(e) => setModelName(e.target.value)} className="model-select">
                <option value="gemini-3.1-flash-lite-preview">gemini-3.1-flash-lite-preview</option>
                <option value="gemma-3-27b-it">gemma-3-27b-it</option>
                <option value="gemma-3n-e4b-it">gemma-3n-e4b-it</option>
              </select>
            </label>
            <div className="ctrl-actions">
              <button className="btn btn-ghost" onClick={reset} type="button">Choose another</button>
              <button className="btn btn-primary" onClick={startProcessing} type="button">
                Start processing <ArrowRight size={14} strokeWidth={1.8} />
              </button>
            </div>
          </div>
        )}

        {file && (processing || done) && (
          <div className="pipeline">
            <div className="pipeline-head">
              <span className="pipeline-title">Processing</span>
              <span className="eyebrow">step {Math.min(stageIdx + 1, STAGES.length)} / {STAGES.length}</span>
            </div>

            <div className="pipeline-stages">
              <div className="pipeline-rail" aria-hidden />
              {STAGES.map((s, i) => {
                const state = i < stageIdx ? 'done' : i === stageIdx ? 'active' : 'pending';
                const detail = stageDetail[s.key];
                const showChunk =
                  state === 'active' &&
                  chunkInfo.total > 0 &&
                  (s.key === 'cleaning' || s.key === 'extracting' || s.key === 'building');
                return (
                  <div key={s.key} className={`pipeline-row ${state}`}>
                    <div className="pipeline-icon">
                      {state === 'done' ? (
                        <Check size={13} strokeWidth={2.2} />
                      ) : state === 'active' ? (
                        <span className="active-dot" />
                      ) : (
                        <span className="num mono">{s.num}</span>
                      )}
                    </div>
                    <div className="pipeline-body">
                      <div className="pipeline-label">{s.title}</div>
                      <div className="pipeline-meta">
                        {showChunk
                          ? `chunk ${chunkInfo.index} / ${chunkInfo.total} · ${detail || s.meta}`
                          : detail || s.meta}
                      </div>
                      {state === 'active' && (
                        <div className="pipeline-bar">
                          <div className="pipeline-bar-fill" style={{ width: `${stageProgress}%` }} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {done && resultData && (
              <div className="generated-line">
                <Check size={12} strokeWidth={2.2} /> generated {resultData.length} questions
              </div>
            )}
            {!done && questionsSoFar > 0 && (
              <div className="generated-line muted">{questionsSoFar} questions so far…</div>
            )}
            {errorMsg && <div className="err-line">{errorMsg}</div>}
          </div>
        )}

        {done && resultData && (
          <div className="done-card">
            <div className="done-check">
              <Check size={16} strokeWidth={2.4} />
            </div>
            <div className="done-text">
              <div className="done-title">Quiz set ready</div>
              <div className="done-sub">{resultData.length} questions · saved to your library</div>
            </div>
            <div className="done-actions">
              <button className="btn btn-ghost btn-sm" onClick={reset} type="button">Upload another</button>
              <button className="btn btn-primary btn-sm" onClick={startQuizFromResult} type="button">
                Start quiz <ArrowRight size={13} strokeWidth={1.8} />
              </button>
            </div>
          </div>
        )}
      </section>

      {!file && recent.length > 0 && (
        <section className="recent fade-up" style={{ animationDelay: '0.25s' }}>
          <div className="recent-head">
            <span className="recent-title">Recent</span>
            <span className="eyebrow">SAVED QUIZZES</span>
          </div>
          <ul className="recent-list">
            {recent.map((r) => (
              <li key={r.filename} className="recent-row">
                <div className="recent-icon">
                  <Layers size={15} strokeWidth={1.6} />
                </div>
                <div className="recent-meta">
                  <div className="recent-name">{r.display_name}</div>
                  <div className="recent-sub mono">
                    {r.question_count} questions · {formatRelative(r.modified_at)}
                  </div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => openRecent(r)} type="button">Open</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {errorMsg && !processing && !done && !file && (
        <div className="err-toast">{errorMsg}</div>
      )}
    </div>
  );
}

const UPLOAD_CSS = `
.upload-screen { max-width: 720px; margin: 0 auto; padding: 64px 28px 80px; display: flex; flex-direction: column; gap: 28px; }

.upload-hero { display: flex; flex-direction: column; gap: 14px; }
.upload-heading { font-family: var(--font-serif); font-size: 38px; line-height: 1.1; letter-spacing: -0.025em; color: var(--ink); margin: 4px 0 0; font-weight: 400; }
.italic-coral { font-style: italic; color: var(--coral); }
.upload-sub { font-size: 15px; color: var(--muted); max-width: 540px; line-height: 1.55; }

.upload-card { padding: 14px; }
.dropzone {
  border: 1.5px dashed var(--border-strong);
  background: var(--surface-2);
  border-radius: var(--r-md);
  padding: 48px 28px;
  display: flex; flex-direction: column; align-items: center; gap: 10px;
  cursor: pointer; transition: all 0.18s ease;
}
.dropzone.active { border-color: var(--peach-deep); background: var(--peach-soft); }
.drop-icon {
  width: 44px; height: 44px; border-radius: var(--r-md);
  background: var(--surface); border: 1px solid var(--border);
  display: inline-flex; align-items: center; justify-content: center; color: var(--ink-2);
}
.drop-line { font-size: 14px; color: var(--ink); font-weight: 500; }
.browse-link { color: var(--coral); text-decoration: underline; text-underline-offset: 3px; }
.drop-hint { font-size: 12.5px; color: var(--muted); }

.file-row {
  display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 12px;
  padding: 10px 14px;
}
.file-icon {
  width: 36px; height: 36px; border-radius: var(--r-sm);
  background: var(--peach-soft); color: var(--coral);
  display: inline-flex; align-items: center; justify-content: center;
}
.file-name { font-size: 13.5px; font-weight: 500; color: var(--ink); }
.file-sub { font-size: 11.5px; color: var(--muted); margin-top: 2px; }
.status-pill {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 5px 10px; border-radius: var(--r-pill);
  font-size: 11.5px; font-weight: 500;
}
.status-pill.processing { background: var(--peach-soft); color: var(--coral); }
.status-pill.processing .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--coral); }
.status-pill.processing .dot.pulse { animation: pulseDot 1s ease-in-out infinite; }
.status-pill.ready { background: var(--correct-soft); color: var(--correct); }
.status-pill.pending { background: var(--surface-2); color: var(--muted); border: 1px solid var(--border); }

.upload-controls {
  border-top: 1px solid var(--border);
  margin-top: 10px;
  padding: 16px 14px 4px;
  display: flex; align-items: end; gap: 16px; flex-wrap: wrap;
}
.ctrl-group { display: flex; flex-direction: column; gap: 6px; flex: 1; min-width: 220px; }
.model-select {
  height: 36px; padding: 0 10px; border-radius: var(--r-sm);
  background: var(--surface); border: 1px solid var(--border);
  font-size: 13px; color: var(--ink);
}
.ctrl-actions { display: flex; gap: 8px; }

.pipeline {
  background: var(--surface-2);
  border-top: 1px solid var(--border);
  margin: 10px -14px -14px;
  padding: 20px 22px 22px;
  border-radius: 0 0 calc(var(--r-lg) - 1px) calc(var(--r-lg) - 1px);
}
.pipeline-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 18px; }
.pipeline-title { font-size: 13px; font-weight: 500; color: var(--ink); }

.pipeline-stages { position: relative; display: flex; flex-direction: column; gap: 18px; }
.pipeline-rail {
  position: absolute; left: 13px; top: 26px; bottom: 26px;
  width: 1px; background: var(--border);
}
.pipeline-row { position: relative; display: grid; grid-template-columns: 26px 1fr; gap: 12px; align-items: start; }
.pipeline-icon {
  width: 26px; height: 26px; border-radius: 50%;
  background: var(--surface); border: 1px solid var(--border);
  display: inline-flex; align-items: center; justify-content: center;
  z-index: 1; color: var(--muted);
}
.pipeline-row.active .pipeline-icon { border-color: var(--peach-deep); background: var(--peach-soft); }
.pipeline-row.active .active-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--coral); animation: pulseDot 1.4s ease-in-out infinite; }
.pipeline-row.done .pipeline-icon { background: var(--ink); border-color: var(--ink); color: var(--bg); }
.pipeline-row .num { font-size: 10px; color: var(--muted); }

.pipeline-label { font-size: 13.5px; color: var(--ink); font-weight: 500; }
.pipeline-row.pending .pipeline-label { color: var(--muted); }
.pipeline-meta { font-size: 12px; color: var(--muted); margin-top: 2px; line-height: 1.5; }

.pipeline-bar { width: 100%; max-width: 420px; height: 3px; background: var(--border-faint); border-radius: 2px; margin-top: 8px; overflow: hidden; }
.pipeline-bar-fill { height: 100%; background: linear-gradient(90deg, var(--peach), var(--coral)); transition: width 0.4s cubic-bezier(0.2, 0.8, 0.2, 1); }

.generated-line { margin-top: 16px; font-size: 12.5px; color: var(--correct); display: inline-flex; align-items: center; gap: 6px; }
.generated-line.muted { color: var(--muted); }
.err-line { margin-top: 14px; font-size: 12.5px; color: var(--coral); }

.done-card {
  margin: 14px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  padding: 16px 18px;
  display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 14px;
}
.done-check {
  width: 32px; height: 32px; border-radius: 50%;
  background: var(--correct-soft); color: var(--correct);
  display: inline-flex; align-items: center; justify-content: center;
}
.done-title { font-size: 14px; font-weight: 500; color: var(--ink); }
.done-sub { font-size: 12.5px; color: var(--muted); margin-top: 2px; }
.done-actions { display: flex; gap: 8px; }

.recent { display: flex; flex-direction: column; gap: 10px; }
.recent-head { display: flex; justify-content: space-between; align-items: baseline; }
.recent-title { font-size: 13px; font-weight: 500; color: var(--ink); }
.recent-list { list-style: none; display: flex; flex-direction: column; gap: 8px; padding: 0; margin: 0; }
.recent-row {
  display: grid; grid-template-columns: 30px 1fr auto; align-items: center; gap: 12px;
  padding: 12px 14px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  transition: border-color 0.15s ease;
}
.recent-row:hover { border-color: var(--border-strong); }
.recent-icon {
  width: 30px; height: 30px; border-radius: var(--r-sm);
  background: var(--surface-2); border: 1px solid var(--border-faint);
  display: inline-flex; align-items: center; justify-content: center; color: var(--muted);
}
.recent-name { font-size: 13.5px; font-weight: 500; color: var(--ink); }
.recent-sub { font-size: 11.5px; color: var(--muted); margin-top: 2px; }

.err-toast {
  margin-top: 8px; padding: 10px 14px;
  background: var(--coral-soft); color: var(--coral);
  border-radius: var(--r-sm); font-size: 13px;
}
`;
