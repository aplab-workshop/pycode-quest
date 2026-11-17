import { useCallback, useEffect, useRef, useState } from 'react';

const RUN_TIMEOUT_MS = 10000;

/**
 * Owns the Pyodide worker.
 * run(code, world) -> Promise<{ events, error, actions, finalWorld, cancelled? }>
 * cancel() kills a run that is still computing (e.g. `while True: pass`) and restarts the worker.
 */
export function usePythonRunner() {
  const workerRef = useRef(null);
  const pendingRef = useRef(new Map());
  const nextId = useRef(1);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [loadError, setLoadError] = useState(null);

  const settleAll = useCallback((result) => {
    for (const { resolve, timer } of pendingRef.current.values()) {
      clearTimeout(timer);
      resolve(result);
    }
    pendingRef.current.clear();
  }, []);

  const spawn = useCallback(() => {
    workerRef.current?.terminate();
    setStatus('loading');
    const worker = new Worker(new URL('./pyWorker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const msg = e.data;
      if (msg.type === 'ready') setStatus('ready');
      else if (msg.type === 'init-error') {
        setLoadError(msg.message);
        setStatus('error');
      } else if (msg.type === 'result') {
        const p = pendingRef.current.get(msg.id);
        if (p) {
          clearTimeout(p.timer);
          pendingRef.current.delete(msg.id);
          p.resolve(msg);
        }
      }
    };
    worker.onerror = (e) => {
      setLoadError(e.message || 'Python worker error');
      setStatus('error');
    };
    workerRef.current = worker;
  }, []);

  useEffect(() => {
    spawn();
    return () => workerRef.current?.terminate();
  }, [spawn]);

  const run = useCallback(
    (code, world) =>
      new Promise((resolve) => {
        const id = nextId.current++;
        const timer = setTimeout(() => {
          pendingRef.current.delete(id);
          spawn(); // the only way to stop a stuck Python loop
          const error = {
            text: `TimeoutError: โค้ดคำนวณนานเกิน ${RUN_TIMEOUT_MS / 1000} วินาที`,
            line: null,
            hint: 'น่าจะมีลูปที่ไม่มีวันจบ เช่น while True ที่ไม่มี break และไม่สั่งหุ่นยนต์ทำงาน',
          };
          resolve({ events: [{ type: 'error', ...error }], actions: 0, error });
        }, RUN_TIMEOUT_MS);
        pendingRef.current.set(id, { resolve, timer });
        workerRef.current.postMessage({ type: 'run', id, code, world });
      }),
    [spawn]
  );

  const cancel = useCallback(() => {
    if (pendingRef.current.size === 0) return;
    settleAll({ cancelled: true, events: [], error: null });
    spawn();
  }, [settleAll, spawn]);

  return { status, loadError, run, cancel };
}
