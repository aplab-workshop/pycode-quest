import React from 'react';
import { chapters } from '../game/levels.js';

export default function LevelMenu({ currentId, completed, isUnlocked, onSelect, onClose }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="menu" onClick={(e) => e.stopPropagation()}>
        <div className="menu-head">
          <h2>เลือกบทเรียน</h2>
          <button className="tiny" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="chapters">
          {chapters.map((ch) => {
            const done = ch.levels.filter((l) => completed.includes(l.id)).length;
            return (
              <section key={ch.id} className={`chapter ${ch.comingSoon ? 'soon' : ''}`}>
                <div className="chapter-head">
                  <h3>{ch.title}</h3>
                  {ch.comingSoon ? (
                    <span className="badge">🔒 เร็ว ๆ นี้</span>
                  ) : (
                    <span className="badge">
                      {done}/{ch.levels.length} ด่าน
                    </span>
                  )}
                </div>
                <p>{ch.description}</p>
                {!ch.comingSoon && (
                  <div className="level-list">
                    {ch.levels.map((l, i) => {
                      const unlocked = isUnlocked(l.id);
                      const isDone = completed.includes(l.id);
                      return (
                        <button
                          key={l.id}
                          className={`level-btn ${l.id === currentId ? 'active' : ''} ${isDone ? 'done' : ''}`}
                          disabled={!unlocked}
                          onClick={() => onSelect(l.id)}
                          title={unlocked ? l.title : 'ผ่านด่านก่อนหน้าก่อน'}
                        >
                          <span className="lv-num">{isDone ? '✓' : unlocked ? i + 1 : '🔒'}</span>
                          <span>{l.title}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
