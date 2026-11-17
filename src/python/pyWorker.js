/**
 * Web Worker that runs the player's Python with Pyodide.
 *
 * Python runs to completion here while a copy of the world is simulated, and every
 * timed robot action is recorded as an event (with a snapshot of the world).
 * The main thread then replays that Command Queue step by step with animation.
 * Running in a worker means an endless loop can be killed without freezing the page.
 */
import { performAction, ACTION_LIMIT, QUERY_LIMIT } from '../game/engine.js';

const PYODIDE_URL = 'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/';

const PRELUDE = `
import sys as _sys
import json as _json
import builtins as _builtins
import _game

def _line():
    f = _sys._getframe(1)
    while f is not None:
        if f.f_code.co_filename == "main.py":
            return f.f_lineno
        f = f.f_back
    return 0

def _act(name, arg=None):
    r = _json.loads(_game.act(name, _line(), arg))
    if "error" in r:
        raise RuntimeError(r["error"])
    return r["value"]

def move_up():
    """เดินขึ้น 1 ช่อง คืนค่า True ถ้าเดินได้"""
    return _act("move", "up")

def move_down():
    """เดินลง 1 ช่อง คืนค่า True ถ้าเดินได้"""
    return _act("move", "down")

def move_left():
    """เดินซ้าย 1 ช่อง คืนค่า True ถ้าเดินได้"""
    return _act("move", "left")

def move_right():
    """เดินขวา 1 ช่อง คืนค่า True ถ้าเดินได้"""
    return _act("move", "right")

def harvest():
    """เก็บเกี่ยวสิ่งที่อยู่ในช่องปัจจุบัน คืนค่า True ถ้าได้ของ"""
    return _act("harvest")

def plant():
    """ปลูกข้าวสาลีบนดิน (soil) คืนค่า True ถ้าปลูกได้"""
    return _act("plant")

def scan():
    """ดูข้อมูลช่องปัจจุบัน คืนค่า dict เช่น {'type': 'wheat', 'ripe': True, ...}"""
    return _act("scan")

def get_x():
    """พิกัด x ปัจจุบันของหุ่นยนต์ (0 = ซ้ายสุด)"""
    return _act("get_x")

def get_y():
    """พิกัด y ปัจจุบันของหุ่นยนต์ (0 = บนสุด)"""
    return _act("get_y")

def get_world_size():
    """ขนาดของแผนที่ (จำนวนช่องต่อด้าน)"""
    return _act("get_world_size")

def print(*args, **kwargs):
    _game.mark(_line())
    _builtins.print(*args, **kwargs)

_EXPORTS = {
    "move_up": move_up, "move_down": move_down,
    "move_left": move_left, "move_right": move_right,
    "harvest": harvest, "plant": plant, "scan": scan,
    "get_x": get_x, "get_y": get_y, "get_world_size": get_world_size,
    "print": print,
}

def _make_ns():
    ns = dict(_EXPORTS)
    ns["__name__"] = "__main__"
    return ns
`;

const ERROR_HINTS = {
  SyntaxError: 'ไวยากรณ์ผิด ตรวจวงเล็บ เครื่องหมายคำพูด และเครื่องหมาย : ท้าย if/for/while',
  IndentationError: 'ย่อหน้าไม่ถูกต้อง โค้ดในบล็อกเดียวกันต้องเว้นวรรคเท่ากัน (ปกติ 4 ช่อง)',
  NameError: 'ไม่รู้จักชื่อนี้ อาจสะกดผิด หรือยังไม่ได้สร้างตัวแปรก่อนใช้',
  TypeError: 'ใช้ข้อมูลผิดชนิด หรือเรียกฟังก์ชันด้วยจำนวนอาร์กิวเมนต์ไม่ถูก',
  KeyError: 'ไม่มี key นี้ใน dict ลอง print(scan()) ดูว่ามี key อะไรบ้าง',
  ZeroDivisionError: 'หารด้วยศูนย์ไม่ได้',
};

let pyodide = null;
let ctx = null; // state of the current run

function pushPrint(kind, text) {
  if (!ctx) return;
  ctx.events.push({ type: kind, text, line: ctx.printLine || ctx.lastLine });
}

const gameModule = {
  act(name, line, arg) {
    if (!ctx) return JSON.stringify({ error: 'ไม่มีการรันที่กำลังทำงาน' });
    ctx.lastLine = line;
    try {
      const probe = name === 'move' || name === 'harvest' || name === 'plant';
      if (probe && ctx.actions >= ACTION_LIMIT) {
        return JSON.stringify({
          error: `หุ่นยนต์ทำงานเกิน ${ACTION_LIMIT} คำสั่งแล้ว (อาจมีลูปไม่รู้จบ)`,
        });
      }
      if (!probe && ++ctx.queries > QUERY_LIMIT) {
        return JSON.stringify({ error: 'เรียก scan/get_x/get_y มากเกินไป (อาจมีลูปไม่รู้จบ)' });
      }
      const r = performAction(ctx.world, name, arg === undefined || arg === null ? undefined : arg);
      if (r.timed) {
        ctx.actions += 1;
        ctx.events.push({
          type: 'action',
          name,
          arg: arg ?? null,
          action: r.action,
          detail: r.detail ?? null,
          line,
          world: structuredClone(ctx.world),
        });
      }
      return JSON.stringify({ value: r.value });
    } catch (err) {
      return JSON.stringify({ error: String(err.message || err) });
    }
  },
  mark(line) {
    if (ctx) ctx.printLine = line;
  },
};

function formatError(err) {
  const msg = String((err && err.message) || err).trim();
  const lines = msg.split('\n');
  let line = null;
  const re = /File "main\.py", line (\d+)/g;
  let m;
  while ((m = re.exec(msg))) line = Number(m[1]);
  const last = lines[lines.length - 1] || msg;
  const errName = (last.match(/^(\w+(?:Error|Exception))/) || [])[1];
  return { text: last, line, hint: ERROR_HINTS[errName] || null };
}

async function init() {
  try {
    const mod = await import(/* @vite-ignore */ `${PYODIDE_URL}pyodide.mjs`);
    pyodide = await mod.loadPyodide({ indexURL: PYODIDE_URL });
    pyodide.setStdout({ batched: (t) => pushPrint('print', t) });
    pyodide.setStderr({ batched: (t) => pushPrint('stderr', t) });
    pyodide.setStdin({ error: true });
    pyodide.registerJsModule('_game', gameModule);
    pyodide.runPython(PRELUDE, { filename: 'prelude.py' });
    self.postMessage({ type: 'ready' });
  } catch (err) {
    self.postMessage({
      type: 'init-error',
      message: `โหลด Python ไม่สำเร็จ: ${err.message || err} (ต้องต่ออินเทอร์เน็ตเพื่อโหลด Pyodide)`,
    });
  }
}

const ready = init();

self.onmessage = async (e) => {
  const { type, id, code, world } = e.data;
  if (type !== 'run') return;
  await ready;
  if (!pyodide) return;

  ctx = { world, events: [], actions: 0, queries: 0, lastLine: 0, printLine: 0 };
  let error = null;
  const ns = pyodide.runPython('_make_ns()');
  try {
    await pyodide.runPythonAsync(code, { globals: ns, filename: 'main.py' });
  } catch (err) {
    error = formatError(err);
  } finally {
    ns.destroy();
  }
  if (error) ctx.events.push({ type: 'error', ...error });

  self.postMessage({
    type: 'result',
    id,
    events: ctx.events,
    error,
    actions: ctx.actions,
    finalWorld: ctx.world,
  });
  ctx = null;
};
