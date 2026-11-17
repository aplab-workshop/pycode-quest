import React, { useEffect, useRef } from 'react';

export default function ConsolePanel({ lines, onClear }) {
  const bodyRef = useRef(null);
  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  return (
    <div className="console">
      <div className="panel-title">
        <span>Console</span>
        <button className="tiny" onClick={onClear}>
          ล้าง
        </button>
      </div>
      <div className="console-body" ref={bodyRef}>
        {lines.length === 0 && <div className="c-system">ผลลัพธ์จาก print() จะแสดงที่นี่</div>}
        {lines.map((l) => (
          <div key={l.id} className={`c-${l.kind}`}>
            {l.text}
          </div>
        ))}
      </div>
    </div>
  );
}
