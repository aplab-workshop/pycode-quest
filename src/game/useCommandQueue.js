import { useCallback, useEffect, useRef, useState } from 'react';
import { createWorld } from './engine.js';

export const SPEEDS = { 1: 400, 2: 200, 5: 80 }; // ms per robot action

/**
 * Command Queue player.
 * Python is compiled (run in the worker) into a list of events; this hook replays the events
 * one by one on a timer so the robot moves cell by cell.
 *
 * mode: idle | compiling | running | paused | done
 */
export function useCommandQueue({ level, runner }) {
  const [world, setWorld] = useState(() => createWorld(level));
  const [consoleLines, setConsoleLines] = useState([]);
  const [execLine, setExecLine] = useState(null); // { line, kind: 'exec' | 'error' }
  const [mode, setMode] = useState('idle');
  const [speed, setSpeed] = useState(1);
  const [fx, setFx] = useState(null); // last animated action, for effects
  const [verdict, setVerdict] = useState(null);
  const [progress, setProgress] = useState({ index: 0, total: 0 });

  const queueRef = useRef(null); // { events, index, error, actions, output: [] }
  const timerRef = useRef(null);
  const speedRef = useRef(speed);
  const levelRef = useRef(level);
  const modeRef = useRef(mode);
  speedRef.current = speed;
  levelRef.current = level;

  const setModeBoth = (m) => {
    modeRef.current = m;
    setMode(m);
  };

  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  const log = useCallback((kind, text) => {
    setConsoleLines((lines) => {
      const next = [...lines, { kind, text, id: lines.length ? lines[lines.length - 1].id + 1 : 1 }];
      return next.length > 500 ? next.slice(-500) : next;
    });
  }, []);

  const reset = useCallback(() => {
    clearTimer();
    runner.cancel();
    queueRef.current = null;
    setWorld(createWorld(levelRef.current));
    setConsoleLines([]);
    setExecLine(null);
    setFx(null);
    setVerdict(null);
    setProgress({ index: 0, total: 0 });
    setModeBoth('idle');
  }, [runner]);

  // New level -> fresh world
  useEffect(() => {
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level.id]);

  useEffect(() => () => clearTimer(), []);

  const finish = useCallback(() => {
    clearTimer();
    const q = queueRef.current;
    setModeBoth('done');
    if (!q) return;
    if (q.error) {
      setVerdict({ pass: false, message: 'โค้ดหยุดทำงานเพราะมีข้อผิดพลาด แก้แล้วลองรันใหม่' });
      return;
    }
    setExecLine(null);
    log('system', `■ จบการทำงาน: ใช้ ${q.actions} คำสั่ง (${q.finalWorld.tick} จังหวะ)`);
    const lvl = levelRef.current;
    const result = lvl.check({
      world: q.finalWorld,
      output: q.output,
      initialWorld: createWorld(lvl),
    });
    setVerdict(result);
  }, [log]);

  /** Process events until one timed action has been shown. Returns false when the queue ends. */
  const advance = useCallback(() => {
    const q = queueRef.current;
    if (!q) return false;
    while (q.index < q.events.length) {
      const ev = q.events[q.index++];
      setProgress({ index: q.index, total: q.events.length });
      if (ev.type === 'print' || ev.type === 'stderr') {
        q.output.push(ev.text);
        log(ev.type === 'print' ? 'out' : 'err', ev.text);
        if (ev.line) setExecLine({ line: ev.line, kind: 'exec' });
        continue;
      }
      if (ev.type === 'error') {
        log('err', ev.text + (ev.line ? `  (บรรทัด ${ev.line})` : ''));
        if (ev.hint) log('hint', `💡 ${ev.hint}`);
        setExecLine(ev.line ? { line: ev.line, kind: 'error' } : null);
        continue;
      }
      if (ev.type === 'action') {
        setWorld(ev.world);
        setExecLine({ line: ev.line, kind: 'exec' });
        setFx({ id: q.index, action: ev.action, detail: ev.detail, x: ev.world.robot.x, y: ev.world.robot.y });
        if (ev.action === 'bump') log('warn', `⚠ บรรทัด ${ev.line}: เดินไม่ได้ (${ev.detail})`);
        return true;
      }
    }
    return false;
  }, [log]);

  const tick = useCallback(() => {
    const moved = advance();
    if (!moved) {
      finish();
      return;
    }
    timerRef.current = setTimeout(tick, SPEEDS[speedRef.current]);
  }, [advance, finish]);

  /** Run the player's code in the worker and load the resulting queue. */
  const compile = useCallback(
    async (code) => {
      clearTimer();
      const lvl = levelRef.current;
      const fresh = createWorld(lvl);
      setWorld(fresh);
      setConsoleLines([]);
      setExecLine(null);
      setFx(null);
      setVerdict(null);
      setModeBoth('compiling');
      log('system', '▶ กำลังประมวลผลโค้ด Python...');
      const result = await runner.run(code, fresh);
      if (result.cancelled || modeRef.current !== 'compiling') return false;
      queueRef.current = {
        events: result.events,
        index: 0,
        error: result.error,
        actions: result.actions,
        finalWorld: result.finalWorld || fresh,
        output: [],
      };
      setProgress({ index: 0, total: result.events.length });
      log('system', `▶ เริ่มทำงาน: คิวคำสั่ง ${result.actions} รายการ`);
      return true;
    },
    [runner, log]
  );

  const run = useCallback(
    async (code) => {
      if (modeRef.current === 'paused' && queueRef.current) {
        setModeBoth('running');
        tick();
        return;
      }
      if (modeRef.current === 'compiling' || modeRef.current === 'running') return;
      const ok = await compile(code);
      if (!ok) return;
      setModeBoth('running');
      tick();
    },
    [compile, tick]
  );

  const step = useCallback(
    async (code) => {
      if (modeRef.current === 'running') {
        clearTimer();
        setModeBoth('paused');
        return;
      }
      if (modeRef.current === 'compiling') return;
      if (modeRef.current !== 'paused' || !queueRef.current) {
        const ok = await compile(code);
        if (!ok) return;
      }
      setModeBoth('paused');
      if (!advance()) finish();
    },
    [compile, advance, finish]
  );

  const stop = useCallback(() => {
    clearTimer();
    runner.cancel();
    if (modeRef.current === 'idle' || modeRef.current === 'done') return;
    log('system', '■ หยุดโดยผู้เล่น');
    queueRef.current = null;
    setExecLine(null);
    setModeBoth('idle');
  }, [runner, log]);

  /** Code edited while paused: the queued commands no longer match the code. */
  const invalidate = useCallback(() => {
    if (modeRef.current === 'paused') {
      queueRef.current = null;
      setExecLine(null);
      setModeBoth('idle');
    }
  }, []);

  return {
    world,
    consoleLines,
    execLine,
    mode,
    speed,
    setSpeed,
    fx,
    verdict,
    progress,
    run,
    step,
    stop,
    reset,
    invalidate,
    clearConsole: () => setConsoleLines([]),
  };
}
