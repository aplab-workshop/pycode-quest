import React, { useCallback, useEffect, useState } from 'react';
import { usePythonRunner } from './python/usePythonRunner.js';
import { useCommandQueue, SPEEDS } from './game/useCommandQueue.js';
import { allLevels, findLevel, chapters, API_REFERENCE } from './game/levels.js';
import GameWorld3D from './components/GameWorld3D.jsx';
import ResourceBar from './components/ResourceBar.jsx';
import CodeEditor from './components/CodeEditor.jsx';
import ConsolePanel from './components/ConsolePanel.jsx';
import LevelMenu from './components/LevelMenu.jsx';

const PROGRESS_KEY = 'pcq-progress';
const codeKey = (id) => `pcq-code-${id}`;

function loadProgress() {
  try {
    const p = JSON.parse(localStorage.getItem(PROGRESS_KEY));
    if (p && Array.isArray(p.completed)) return p;
  } catch {
    /* ignore */
  }
  return { completed: [], current: allLevels[0].id };
}

export default function App() {
  const runner = usePythonRunner();
  const [progress, setProgress] = useState(loadProgress);
  const level = findLevel(progress.current);
  const [code, setCode] = useState(() => localStorage.getItem(codeKey(level.id)) ?? level.starterCode);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [showApi, setShowApi] = useState(false);

  const game = useCommandQueue({ level, runner });
  const chapter = chapters.find((c) => c.id === level.chapterId);
  const levelIndex = allLevels.findIndex((l) => l.id === level.id);
  const nextLevel = allLevels[levelIndex + 1];

  useEffect(() => {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  }, [progress]);

  // Mark level complete
  useEffect(() => {
    if (game.verdict?.pass) {
      setProgress((p) => (p.completed.includes(level.id) ? p : { ...p, completed: [...p.completed, level.id] }));
    }
  }, [game.verdict, level.id]);

  const isUnlocked = useCallback(
    (id) => {
      const i = allLevels.findIndex((l) => l.id === id);
      return i === 0 || id === '2-1' || id === '3-1' || progress.completed.includes(allLevels[i - 1].id) || progress.completed.includes(id);
    },
    [progress.completed]
  );

  function selectLevel(id) {
    const lvl = findLevel(id);
    setProgress((p) => ({ ...p, current: id }));
    setCode(localStorage.getItem(codeKey(id)) ?? lvl.starterCode);
    setShowHint(false);
    setMenuOpen(false);
  }

  function handleCodeChange(value) {
    setCode(value);
    localStorage.setItem(codeKey(level.id), value);
    game.invalidate();
  }

  function resetCode() {
    if (!window.confirm('คืนโค้ดเริ่มต้นของด่านนี้? โค้ดที่เขียนไว้จะหายไป')) return;
    localStorage.removeItem(codeKey(level.id));
    setCode(level.starterCode);
    game.reset();
  }

  const pyReady = runner.status === 'ready';
  const busy = game.mode === 'compiling' || game.mode === 'running';
  const canRun = pyReady && game.mode !== 'compiling' && game.mode !== 'running';

  return (
    <div className="app">
      {/* ---------------- Left: game world ---------------- */}
      <section className="pane left">
        <header className="top">
          <button className="menu-btn" onClick={() => setMenuOpen(true)}>
            ☰ บทเรียน
          </button>
          <div className="level-title">
            <span className="eyebrow">APLAB · PYCODE QUEST</span>
            <strong>
              ด่าน {level.id}: {level.title}
            </strong>
            <small>{chapter?.title}</small>
          </div>
        </header>

        <ResourceBar world={game.world} />

        <div className="world-area">
          <GameWorld3D world={game.world} fx={game.fx} speedMs={SPEEDS[game.speed]} />
          {game.verdict && (
            <div className={`verdict ${game.verdict.pass ? 'pass' : 'fail'}`}>
              <div>
                <strong>{game.verdict.pass ? '🎉 ผ่านด่าน!' : '❌ ยังไม่ผ่าน'}</strong>
                <span>{game.verdict.message}</span>
              </div>
              {game.verdict.pass && nextLevel && (
                <button className="btn primary" onClick={() => selectLevel(nextLevel.id)}>
                  ด่านถัดไป ▶
                </button>
              )}
              {game.verdict.pass && !nextLevel && <span className="badge">จบทุกด่านที่เปิดให้เล่นแล้ว!</span>}
            </div>
          )}
        </div>

        <div className="mission">
          <p className="story">{level.story}</p>
          <ul className="objectives">
            {level.objectives.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ul>
          <div className="mission-foot">
            <span className="concepts">
              {level.concepts.map((c) => (
                <code key={c}>{c}</code>
              ))}
            </span>
            <button className="link" onClick={() => setShowHint((s) => !s)}>
              {showHint ? 'ซ่อนคำใบ้' : '💡 คำใบ้'}
            </button>
          </div>
          {showHint && <p className="hint">{level.hint}</p>}
        </div>
      </section>

      {/* ---------------- Right: code ---------------- */}
      <section className="pane right">
        <div className="controls">
          <button className="btn run" onClick={() => game.run(code)} disabled={!canRun}>
            ▶ {game.mode === 'paused' ? 'Continue' : 'Run'}
          </button>
          <button
            className="btn"
            onClick={() => game.step(code)}
            disabled={!pyReady || game.mode === 'compiling'}
            title="ทำงานทีละคำสั่ง"
          >
            {game.mode === 'running' ? '⏸ Pause' : '⏭ Step'}
          </button>
          <button className="btn stop" onClick={game.stop} disabled={!busy && game.mode !== 'paused'}>
            ■ Stop
          </button>
          <button className="btn" onClick={game.reset} title="คืนแผนที่สู่สภาพเริ่มต้น">
            ↺ Reset
          </button>

          <div className="speed" role="group" aria-label="ความเร็ว">
            {Object.keys(SPEEDS).map((s) => (
              <button
                key={s}
                className={Number(s) === game.speed ? 'on' : ''}
                onClick={() => game.setSpeed(Number(s))}
              >
                {s}x
              </button>
            ))}
          </div>

          <span className={`py-status ${runner.status}`}>
            {runner.status === 'loading' && '⏳ กำลังโหลด Python'}
            {runner.status === 'ready' &&
              (game.mode === 'compiling'
                ? '⚙ กำลังคำนวณ'
                : game.mode === 'running'
                  ? `● ทำงาน ${game.progress.index}/${game.progress.total}`
                  : game.mode === 'paused'
                    ? `⏸ หยุดชั่วคราว ${game.progress.index}/${game.progress.total}`
                    : '● Python พร้อม')}
            {runner.status === 'error' && '✕ Python ไม่พร้อม'}
          </span>
        </div>

        {runner.status === 'error' && <div className="banner">{runner.loadError}</div>}

        <div className="editor-box">
          <div className="panel-title">
            <span>main.py</span>
            <span className="panel-actions">
              <button className="tiny" onClick={() => setShowApi((s) => !s)}>
                📘 คำสั่งหุ่นยนต์
              </button>
              <button className="tiny" onClick={resetCode}>
                คืนโค้ดเริ่มต้น
              </button>
            </span>
          </div>
          {showApi && (
            <div className="api-ref">
              {API_REFERENCE.map((a) => (
                <div key={a.sig}>
                  <code>{a.sig}</code>
                  <span>{a.desc}</span>
                </div>
              ))}
            </div>
          )}
          <div className="editor-host">
            <CodeEditor
              value={code}
              onChange={handleCodeChange}
              execLine={game.execLine}
              onRunShortcut={() => canRun && game.run(code)}
              readOnly={busy}
            />
          </div>
        </div>

        <ConsolePanel lines={game.consoleLines} onClear={game.clearConsole} />
      </section>

      {menuOpen && (
        <LevelMenu
          currentId={level.id}
          completed={progress.completed}
          isUnlocked={isUnlocked}
          onSelect={selectLevel}
          onClose={() => setMenuOpen(false)}
        />
      )}
    </div>
  );
}
