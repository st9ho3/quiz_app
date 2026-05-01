import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Cloud, BookOpen } from 'lucide-react';

export default function Shell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const onUpload = pathname === '/' || pathname === '/upload';
  const onQuiz = pathname.startsWith('/quiz') || pathname.startsWith('/results');
  const onLibrary = pathname.startsWith('/library');

  return (
    <>
      <header className="topbar">
        <div className="topbar-brand">
          <span className="topbar-brand-mark">
            <Cloud size={14} strokeWidth={1.6} />
          </span>
        </div>

        <nav className="topbar-nav" aria-label="Primary">
          <Link to="/upload" className={`topbar-nav-tab ${onUpload ? 'active' : ''}`}>
            Upload
          </Link>
          <Link to="/quiz" className={`topbar-nav-tab ${onQuiz ? 'active' : ''}`}>
            Quiz
          </Link>
        </nav>

        <div className="topbar-right">
          <Link to="/library" className={`btn btn-ghost btn-sm ${onLibrary ? 'btn-ghost-active' : ''}`}>
            <BookOpen size={14} strokeWidth={1.6} />
            Library
          </Link>
          <span className="avatar" aria-hidden>NK</span>
        </div>
      </header>
      <main>{children}</main>
    </>
  );
}
