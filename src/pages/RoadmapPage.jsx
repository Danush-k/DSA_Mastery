import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { Map, Search, X, ChevronRight, ChevronDown, ChevronUp, Check, StickyNote, Star } from 'lucide-react';
import useProgressStore from '../store/useProgressStore.js';
import useRevisionStore from '../store/useRevisionStore.js';
import useNotesStore from '../store/useNotesStore.js';
import useAllQuestions from '../hooks/useAllQuestions.js';
import topics from '../data/topics.js';
import patterns from '../data/patterns.js';
import roadmap from '../data/roadmap.js';
import { getTopicIcon, getPatternIcon, YoutubeLogo, LeetCodeLogo } from '../utils/helpers.jsx';
import NotesModal from '../components/modals/NotesModal.jsx';

const LEVEL_CONFIG = {
  Beginner:     { color: '#00b8a3', bg: 'rgba(0,184,163,0.1)',   border: 'rgba(0,184,163,0.25)',   label: 'Easy',   abbr: 'Easy'   },
  Intermediate: { color: '#ffc01e', bg: 'rgba(255,192,30,0.1)',  border: 'rgba(255,192,30,0.25)',  label: 'Medium', abbr: 'Medium' },
  Advanced:     { color: '#ff375f', bg: 'rgba(255,55,95,0.1)',   border: 'rgba(255,55,95,0.25)',   label: 'Hard',   abbr: 'Hard'   },
};

// Circular progress SVG
const CircleProgress = ({ pct = 0, size = 36, color = '#00b8a3', trackColor = 'rgba(255,255,255,0.08)' }) => {
  const r = (size - 4) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={trackColor} strokeWidth={3.5} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color}
        strokeWidth={3.5} strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.5s cubic-bezier(0.4,0,0.2,1)' }}
      />
    </svg>
  );
};

function ConceptCard({ step, allQuestions, questionStatus, bookmarks, notes }) {
  const [open, setOpen] = useState(false);
  const [activeNotesQuestion, setActiveNotesQuestion] = useState(null);
  const [activeNotesConcept, setActiveNotesConcept] = useState(null);
  const pattern = patterns[step.patternId];
  const topic   = topics.find(t => t.id === step.topicId);
  const lc = LEVEL_CONFIG[step.level];
  const toggleStatus = useProgressStore((s) => s.toggleStatus);
  const toggleBookmark = useProgressStore((s) => s.toggleBookmark);
  const scheduleRevision = useRevisionStore((s) => s.scheduleRevision);
  const removeRevision = useRevisionStore((s) => s.removeRevision);

  const conceptNotesKey = `concept_${step.patternId}`;
  const conceptNote = notes[conceptNotesKey];
  const hasConceptNote = conceptNote && Object.entries(conceptNote).some(([k, v]) => v && v !== '' && k !== 'updatedAt');

  const handleCheckClick = (qId, isSolved) => {
    if (!isSolved) {
      toggleStatus(qId, 'solved');
      scheduleRevision(qId);
    } else {
      toggleStatus(qId, 'solved');
      removeRevision(qId);
    }
  };

  const conceptQs = useMemo(() =>
    allQuestions
      .filter(q => q.topic === step.topicId && q.pattern === step.patternId)
      .sort((a, b) => ({ Easy: 0, Medium: 1, Hard: 2 }[a.difficulty] - { Easy: 0, Medium: 1, Hard: 2 }[b.difficulty])),
    [allQuestions, step.topicId, step.patternId]
  );

  const solved = conceptQs.filter(q => questionStatus[q.id] === 'solved').length;
  const total  = conceptQs.length;
  const pct    = total ? Math.round((solved / total) * 100) : 0;
  const done   = total > 0 && solved === total;

  return (
    <div className="lc-concept-row" style={{ borderLeft: `3px solid ${done ? lc.color : 'transparent'}` }}>

      {/* ── Row header ── */}
      <div className="lc-concept-header" onClick={() => setOpen(o => !o)}>

        {/* Step circle */}
        <div className="lc-step-circle" style={{
          background: done ? lc.color : 'var(--bg-tertiary)',
          color: done ? '#fff' : 'var(--text-tertiary)',
          border: `1.5px solid ${done ? lc.color : 'var(--border-secondary)'}`,
        }}>
          {done
            ? <Check size={11} strokeWidth={3} />
            : <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700 }}>{step.step}</span>
          }
        </div>

        {/* Pattern icon + name */}
        <div className="lc-concept-icon-wrap" style={{ color: topic?.color || 'var(--accent-primary)' }}>
          {getPatternIcon(step.patternId, { size: 15 })}
        </div>

        <div className="lc-concept-info">
          <span className="lc-concept-name">{pattern?.name || step.patternId}</span>
          <span className="lc-concept-desc">{step.description}</span>
        </div>

        {/* Right cluster */}
        <div className="lc-concept-right">
          {/* Difficulty label */}
          <span className="lc-diff-pill" style={{ color: lc.color, background: lc.bg, border: `1px solid ${lc.border}` }}>
            {lc.abbr}
          </span>

          {/* Progress */}
          <div className="lc-progress-wrap">
            <div style={{ position: 'relative', width: 36, height: 36 }}>
              <CircleProgress pct={pct} size={36} color={done ? lc.color : 'var(--accent-primary)'} />
              <span style={{
                position: 'absolute', inset: 0, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                fontSize: 8, fontWeight: 800, fontFamily: 'var(--font-mono)',
                color: done ? lc.color : 'var(--text-secondary)',
              }}>{pct}%</span>
            </div>
            <span className="lc-progress-label">{solved}<span style={{ opacity: 0.45 }}>/{total}</span></span>
          </div>

          {/* YouTube button — official logo */}
          <a
            href={step.youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="lc-yt-btn"
            title="Watch Tutorial on YouTube"
          >
            <YoutubeLogo size={20} />
          </a>

          {/* Concept Notes Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActiveNotesConcept({
                patternId: step.patternId,
                patternName: pattern?.name || step.patternId,
                topicId: step.topicId,
                topicName: topic?.name || step.topicId,
              });
            }}
            className="lc-yt-btn"
            title="Concept Notes & Drive Uploads"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: hasConceptNote ? 'var(--accent-primary)' : 'var(--text-secondary)',
              opacity: hasConceptNote ? 1 : 0.6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              width: 28,
              height: 28,
              borderRadius: '50%',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-tertiary)';
              e.currentTarget.style.color = 'var(--accent-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'none';
              e.currentTarget.style.color = hasConceptNote ? 'var(--accent-primary)' : 'var(--text-secondary)';
            }}
          >
            <StickyNote size={15} />
          </button>

          {/* Chevron */}
          <span className="lc-chevron">{open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</span>
        </div>
      </div>

      {/* ── Problem list ── */}
      {open && (
        <div className="lc-problem-list">
          {/* Column header */}
          <div className="lc-prob-col-header">
            <span style={{ width: 28 }} />
            <span style={{ width: 50 }}>#</span>
            <span style={{ flex: 1 }}>Problem</span>
            <span style={{ width: 72, textAlign: 'center' }}>Difficulty</span>
            <span style={{ width: 36, textAlign: 'center' }}>Video</span>
            <span style={{ width: 36, textAlign: 'center' }}>LC</span>
            <span style={{ width: 36, textAlign: 'center' }}>Note</span>
            <span style={{ width: 36, textAlign: 'center' }}>Save</span>
          </div>

          {conceptQs.length === 0 ? (
            <div style={{ padding: '16px 16px', fontSize: 13, color: 'var(--text-tertiary)' }}>
              No problems mapped for this concept yet.
            </div>
          ) : (
            conceptQs.map((q, idx) => {
              const isSolved = questionStatus[q.id] === 'solved';
              const diffColor = q.difficulty === 'Easy' ? 'var(--easy)' : q.difficulty === 'Medium' ? 'var(--medium)' : 'var(--hard)';
              
              const isBookmarked = Array.isArray(bookmarks) ? bookmarks.includes(q.id) : false;
              const note = notes[q.id];
              const hasNote = note && Object.entries(note).some(([k, v]) => v && v !== '' && k !== 'updatedAt');

              return (
                <div
                  key={q.id}
                  className={`lc-prob-row ${isSolved ? 'lc-prob-solved' : ''} ${idx % 2 === 0 ? 'lc-prob-stripe' : ''}`}
                >
                  {/* Checkbox */}
                  <div 
                    className="lc-prob-check" 
                    style={{
                      border: `1.5px solid ${isSolved ? 'var(--success)' : 'var(--border-secondary)'}`,
                      background: isSolved ? 'var(--success)' : 'transparent',
                      cursor: 'pointer'
                    }}
                    onClick={() => handleCheckClick(q.id, isSolved)}
                  >
                    {isSolved && <Check size={9} strokeWidth={3} color="#fff" />}
                  </div>

                  {/* Number */}
                  <span className="lc-prob-num">{q.num}.</span>

                  {/* Title */}
                  <a href={q.url} target="_blank" rel="noopener noreferrer" className="lc-prob-title">
                    {q.title}
                  </a>

                  {/* Difficulty */}
                  <span className="lc-prob-diff" style={{ color: diffColor }}>{q.difficulty}</span>

                  {/* YouTube icon */}
                  <a
                    href={`https://www.youtube.com/results?search_query=striver+${encodeURIComponent(q.title)}+leetcode`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="lc-prob-icon-btn"
                    title="Search on YouTube"
                  >
                    <YoutubeLogo size={16} />
                  </a>

                  {/* LeetCode icon */}
                  <a
                    href={q.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="lc-prob-icon-btn"
                    title="Open on LeetCode"
                  >
                    <LeetCodeLogo size={14} />
                  </a>

                  {/* Notes icon */}
                  <button
                    onClick={() => setActiveNotesQuestion(q)}
                    className="lc-prob-icon-btn"
                    title={hasNote ? "Edit Notes" : "Add Notes"}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: hasNote ? 'var(--accent-primary)' : 'inherit',
                      opacity: hasNote ? 1 : 0.5
                    }}
                  >
                    <StickyNote size={14} />
                  </button>

                  {/* Bookmark icon */}
                  <button
                    onClick={() => toggleBookmark(q.id)}
                    className="lc-prob-icon-btn"
                    title={isBookmarked ? "Remove Bookmark" : "Bookmark Question"}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: isBookmarked ? 'var(--warning)' : 'inherit',
                      opacity: isBookmarked ? 1 : 0.5
                    }}
                  >
                    <Star size={14} fill={isBookmarked ? "currentColor" : "none"} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}
      {activeNotesQuestion && (
        <NotesModal 
          question={activeNotesQuestion} 
          onClose={() => setActiveNotesQuestion(null)} 
        />
      )}
      {activeNotesConcept && (
        <NotesModal 
          isConcept={true}
          concept={activeNotesConcept}
          onClose={() => setActiveNotesConcept(null)} 
        />
      )}
    </div>
  );
}

export default function RoadmapPage() {
  const activeProfileId = useProgressStore(s => s.activeProfileId);
  const questionStatus  = useProgressStore(useShallow(s => s.profiles[activeProfileId]?.questionStatus || {}));
  const bookmarks       = useProgressStore(useShallow(s => s.profiles[activeProfileId]?.bookmarks || []));
  const notes           = useNotesStore(useShallow(s => s.profiles[activeProfileId] || {}));
  const allQuestions    = useAllQuestions();

  const [filterLevel, setFilterLevel] = useState('All');
  const [filterTopic, setFilterTopic] = useState('All');
  const [searchQuery,  setSearchQuery] = useState('');

  const { completedConcepts, totalProblems, solvedProblems } = useMemo(() => {
    let completedConcepts = 0, totalProblems = 0, solvedProblems = 0;
    roadmap.forEach(step => {
      const qs     = allQuestions.filter(q => q.topic === step.topicId && q.pattern === step.patternId);
      const solved = qs.filter(q => questionStatus[q.id] === 'solved').length;
      if (qs.length > 0 && solved === qs.length) completedConcepts++;
      totalProblems  += qs.length;
      solvedProblems += solved;
    });
    return { completedConcepts, totalProblems, solvedProblems };
  }, [allQuestions, questionStatus]);

  const filteredSteps = useMemo(() =>
    roadmap.filter(step => {
      if (filterLevel !== 'All' && step.level !== filterLevel) return false;
      if (filterTopic !== 'All' && step.topicId !== filterTopic) return false;
      if (searchQuery.trim()) {
        const name = (patterns[step.patternId]?.name || step.patternId).toLowerCase();
        if (!name.includes(searchQuery.toLowerCase())) return false;
      }
      return true;
    }),
    [filterLevel, filterTopic, searchQuery]
  );

  const groupedByTopic = useMemo(() => {
    const order = topics.map(t => t.id);
    const map   = {};
    filteredSteps.forEach(step => {
      if (!map[step.topicId]) map[step.topicId] = [];
      map[step.topicId].push(step);
    });
    return order.filter(tid => map[tid]).map(tid => ({ topicId: tid, steps: map[tid] }));
  }, [filteredSteps]);

  const overallPct  = totalProblems ? Math.round((solvedProblems / totalProblems) * 100) : 0;
  const conceptPct  = Math.round((completedConcepts / roadmap.length) * 100);

  const uniqueTopics = useMemo(() => {
    const ids = [...new Set(roadmap.map(s => s.topicId))];
    return ids.map(id => topics.find(t => t.id === id)).filter(Boolean);
  }, []);

  const TABS = ['All', 'Beginner', 'Intermediate', 'Advanced'];
  const TAB_LABELS = { All: 'All', Beginner: 'Easy', Intermediate: 'Medium', Advanced: 'Hard' };

  return (
    <div className="page-content animate-fade-in">

      {/* ═══ LeetCode-style study plan hero ═══ */}
      <div className="lc-roadmap-hero">
        {/* Left — title block */}
        <div className="lc-hero-left">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div className="lc-hero-icon-wrap">
              <Map size={18} strokeWidth={2} />
            </div>
            <h2 className="lc-hero-title">DSA Study Plan — Beginner to Master</h2>
          </div>
          <p className="lc-hero-desc">
            59 concepts ordered for optimal learning. Watch the tutorial, then solve the problems — concept by concept.
          </p>

          {/* Stat row */}
          <div className="lc-hero-stats">
            <div className="lc-hero-stat">
              <span className="lc-hero-stat-val" style={{ color: 'var(--accent-primary)' }}>{roadmap.length}</span>
              <span className="lc-hero-stat-lbl">Concepts</span>
            </div>
            <div className="lc-hero-stat-divider" />
            <div className="lc-hero-stat">
              <span className="lc-hero-stat-val" style={{ color: 'var(--easy)' }}>{totalProblems}</span>
              <span className="lc-hero-stat-lbl">Problems</span>
            </div>
            <div className="lc-hero-stat-divider" />
            <div className="lc-hero-stat">
              <span className="lc-hero-stat-val" style={{ color: 'var(--medium)' }}>{completedConcepts}</span>
              <span className="lc-hero-stat-lbl">Completed</span>
            </div>
            <div className="lc-hero-stat-divider" />
            <div className="lc-hero-stat">
              <span className="lc-hero-stat-val" style={{ color: 'var(--hard)' }}>{solvedProblems}</span>
              <span className="lc-hero-stat-lbl">Solved</span>
            </div>
          </div>
        </div>

        {/* Right — dual progress rings */}
        <div className="lc-hero-rings">
          <div className="lc-ring-item">
            <div style={{ position: 'relative', width: 80, height: 80 }}>
              <CircleProgress pct={conceptPct} size={80} color="var(--accent-primary)" trackColor="var(--bg-tertiary)" />
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{conceptPct}%</span>
              </div>
            </div>
            <div className="lc-ring-label">
              <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 13 }}>{completedConcepts}<span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>/{roadmap.length}</span></span>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>concepts done</span>
            </div>
          </div>

          <div className="lc-ring-item">
            <div style={{ position: 'relative', width: 80, height: 80 }}>
              <CircleProgress pct={overallPct} size={80} color="var(--easy)" trackColor="var(--bg-tertiary)" />
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{overallPct}%</span>
              </div>
            </div>
            <div className="lc-ring-label">
              <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 13 }}>{solvedProblems}<span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>/{totalProblems}</span></span>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>problems solved</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ LeetCode-style tab + filter bar ═══ */}
      <div className="lc-filter-bar">
        {/* Tabs */}
        <div className="lc-tabs">
          {TABS.map(tab => (
            <button
              key={tab}
              className={`lc-tab ${filterLevel === tab ? 'lc-tab-active' : ''}`}
              style={filterLevel === tab && tab !== 'All' ? {
                color: LEVEL_CONFIG[tab]?.color,
                borderBottomColor: LEVEL_CONFIG[tab]?.color,
              } : {}}
              onClick={() => setFilterLevel(tab)}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        <div className="lc-filter-right">
          {/* Topic select */}
          <select
            value={filterTopic}
            onChange={e => setFilterTopic(e.target.value)}
            className="lc-select"
          >
            <option value="All">All Topics</option>
            {uniqueTopics.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>

          {/* Search */}
          <div className="lc-search-wrap">
            <Search size={13} className="lc-search-icon" />
            <input
              type="text"
              placeholder="Search concept..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="lc-search-input"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="lc-search-clear">
                <X size={12} />
              </button>
            )}
          </div>

          <span className="lc-count-badge">{filteredSteps.length} concept{filteredSteps.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* ═══ Topic sections ═══ */}
      {groupedByTopic.length === 0 ? (
        <div className="empty-state">
          <Map className="empty-state-icon" />
          <div className="empty-state-title">No concepts match</div>
          <div className="empty-state-desc">Try adjusting the level or topic filter.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {groupedByTopic.map(({ topicId, steps: topicSteps }, gi) => {
            const topic = topics.find(t => t.id === topicId);
            const topicSolved = topicSteps.reduce((acc, step) => {
              const qs = allQuestions.filter(q => q.topic === step.topicId && q.pattern === step.patternId);
              return acc + qs.filter(q => questionStatus[q.id] === 'solved').length;
            }, 0);
            const topicTotal = topicSteps.reduce((acc, step) =>
              acc + allQuestions.filter(q => q.topic === step.topicId && q.pattern === step.patternId).length, 0);
            const topicPct = topicTotal ? Math.round((topicSolved / topicTotal) * 100) : 0;

            return (
              <div key={topicId} className="lc-topic-section" style={{ marginTop: gi === 0 ? 0 : 24 }}>
                {/* Topic heading */}
                <div className="lc-topic-heading">
                  <div className="lc-topic-icon-box" style={{ background: `${topic?.color || 'var(--accent-primary)'}18`, color: topic?.color || 'var(--accent-primary)' }}>
                    {getTopicIcon(topicId, { size: 16 })}
                  </div>
                  <div style={{ flex: 1 }}>
                    <span className="lc-topic-name">{topic?.name || topicId}</span>
                    <span className="lc-topic-meta">{topicSteps.length} concept{topicSteps.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="lc-topic-progress-text">
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: topicPct === 100 ? 'var(--easy)' : 'var(--text-secondary)' }}>
                      {topicSolved}<span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>/{topicTotal}</span>
                    </span>
                  </div>
                  <Link to={`/topics/${topicId}`} className="lc-topic-link">
                    View all <ChevronRight size={13} />
                  </Link>
                </div>

                {/* Concept rows */}
                <div className="lc-concept-list">
                  {topicSteps.map(step => (
                    <ConceptCard
                      key={`${step.topicId}-${step.patternId}`}
                      step={step}
                      allQuestions={allQuestions}
                      questionStatus={questionStatus}
                      bookmarks={bookmarks}
                      notes={notes}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
