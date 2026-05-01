import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Layers, ArrowRight, FileText, RefreshCw } from 'lucide-react';

const API_BASE = 'http://localhost:8000';

interface QuizItem {
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

const DOT_PALETTE = ['#E89968', '#7DA083', '#A89BB8', '#8AA9BD', '#C66952', '#C9A24A', '#8FA572', '#C58794'];

export default function LibraryPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<QuizItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const cached = localStorage.getItem('quizzes:recent');
      if (cached) setItems(JSON.parse(cached));
    } catch {}

    fetch(`${API_BASE}/quizzes`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data: { quizzes: QuizItem[] }) => {
        setItems(data.quizzes);
        try { localStorage.setItem('quizzes:recent', JSON.stringify(data.quizzes)); } catch {}
      })
      .catch(() => setErrorMsg('Could not reach the backend. Showing cached list (if any).'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const open = async (item: QuizItem) => {
    setOpeningId(item.filename);
    try {
      const res = await fetch(`${API_BASE}/quizzes/${encodeURIComponent(item.filename)}`);
      if (!res.ok) throw new Error('Failed to load quiz');
      const data = await res.json();
      navigate('/quiz', { state: { questions: data.questions, source: item.display_name } });
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not open this quiz.');
      setOpeningId(null);
    }
  };

  return (
    <div className="library-screen">
      <style>{LIB_CSS}</style>

      <header className="lib-header fade-up">
        <div>
          <div className="eyebrow coral">QUIZ LIBRARY · {items.length} {items.length === 1 ? 'SET' : 'SETS'}</div>
          <h1 className="lib-heading">Pick a saved quiz to take.</h1>
          <p className="lib-sub">All quizzes you’ve generated from PDFs live here. Tap one to start a session.</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={load} disabled={loading} type="button">
          <RefreshCw size={13} strokeWidth={1.8} className={loading ? 'spinner' : ''} />
          Refresh
        </button>
      </header>

      {errorMsg && <div className="lib-err">{errorMsg}</div>}

      {!loading && items.length === 0 && (
        <div className="card lib-empty">
          <div className="empty-icon"><FileText size={20} strokeWidth={1.6} /></div>
          <h2 className="empty-title">Your library is empty</h2>
          <p className="empty-sub">Upload a PDF to generate your first quiz set.</p>
          <Link to="/upload" className="btn btn-primary btn-sm">
            Upload a PDF <ArrowRight size={13} strokeWidth={1.8} />
          </Link>
        </div>
      )}

      {items.length > 0 && (
        <div className="lib-grid">
          {items.map((it, i) => {
            const dot = DOT_PALETTE[i % DOT_PALETTE.length];
            const opening = openingId === it.filename;
            return (
              <article
                key={it.filename}
                className="lib-card fade-up"
                style={{ animationDelay: `${0.06 + i * 0.03}s` }}
              >
                <header className="lc-head">
                  <span className="lc-dot" style={{ background: dot }} />
                  <span className="lc-name">{it.display_name}</span>
                </header>
                <div className="lc-icon">
                  <Layers size={16} strokeWidth={1.6} />
                </div>
                <div className="lc-meta mono">
                  {it.question_count} questions · {formatRelative(it.modified_at)}
                </div>
                <button
                  className="btn btn-primary btn-sm lc-cta"
                  onClick={() => open(it)}
                  disabled={opening}
                  type="button"
                >
                  {opening ? 'Opening…' : <>Start session <ArrowRight size={13} strokeWidth={1.8} /></>}
                </button>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

const LIB_CSS = `
.library-screen { max-width: 980px; margin: 0 auto; padding: 56px 28px 80px; display: flex; flex-direction: column; gap: 22px; }

.lib-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; }
.lib-heading { font-family: var(--font-serif); font-size: 36px; font-weight: 400; letter-spacing: -0.022em; line-height: 1.1; margin: 6px 0 8px; color: var(--ink); }
.lib-sub { font-size: 15px; color: var(--muted); max-width: 540px; line-height: 1.55; }

.lib-err {
  padding: 10px 14px; background: var(--coral-soft); color: var(--coral);
  border-radius: var(--r-sm); font-size: 13px;
}

.lib-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}
.lib-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  padding: 18px 16px;
  min-height: 138px;
  display: grid;
  grid-template-rows: auto 1fr auto auto;
  gap: 8px;
  transition: border-color 0.15s ease, transform 0.15s ease;
}
.lib-card:hover { border-color: var(--border-strong); }
.lc-head { display: flex; align-items: center; gap: 8px; }
.lc-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.lc-name { font-size: 14.5px; font-weight: 500; color: var(--ink); line-height: 1.3; word-break: break-word; }
.lc-icon { color: var(--muted-2); }
.lc-meta { font-size: 11.5px; color: var(--muted); }
.lc-cta { justify-self: end; }

.lib-empty { padding: 48px 36px; display: flex; flex-direction: column; align-items: center; gap: 14px; text-align: center; }
.empty-icon { width: 44px; height: 44px; border-radius: var(--r-md); background: var(--peach-soft); color: var(--coral); display: inline-flex; align-items: center; justify-content: center; }
.empty-title { font-family: var(--font-serif); font-size: 26px; font-weight: 400; letter-spacing: -0.02em; }
.empty-sub { font-size: 14px; color: var(--muted); margin-bottom: 6px; }
`;
