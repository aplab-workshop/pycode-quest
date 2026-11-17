import React, { useEffect, useMemo, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { python, pythonLanguage } from '@codemirror/lang-python';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView, Decoration, keymap } from '@codemirror/view';
import { StateField, StateEffect, Prec } from '@codemirror/state';
import { completeFromList } from '@codemirror/autocomplete';

// Highlight of the line the robot is currently executing (or the error line)
const setExecLine = StateEffect.define();
const execLineField = StateField.define({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes);
    for (const e of tr.effects) {
      if (!e.is(setExecLine)) continue;
      const v = e.value;
      if (!v || !v.line || v.line > tr.state.doc.lines) {
        deco = Decoration.none;
      } else {
        const line = tr.state.doc.line(v.line);
        deco = Decoration.set([
          Decoration.line({ class: v.kind === 'error' ? 'cm-error-line' : 'cm-exec-line' }).range(line.from),
        ]);
      }
    }
    return deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});

const gameCompletions = pythonLanguage.data.of({
  autocomplete: completeFromList(
    [
      ['move_up()', 'เดินขึ้น'],
      ['move_down()', 'เดินลง'],
      ['move_left()', 'เดินซ้าย'],
      ['move_right()', 'เดินขวา'],
      ['harvest()', 'เก็บเกี่ยว'],
      ['plant()', 'ปลูกข้าว'],
      ['scan()', 'ดูข้อมูลช่อง'],
      ['get_x()', 'พิกัด x'],
      ['get_y()', 'พิกัด y'],
      ['get_world_size()', 'ขนาดแผนที่'],
    ].map(([label, detail]) => ({ label, detail, type: 'function', apply: label }))
  ),
});

const theme = EditorView.theme({
  '&': { height: '100%', fontSize: '15px' },
  '.cm-scroller': { fontFamily: "Consolas, 'Cascadia Code', monospace", lineHeight: '1.55' },
  '.cm-exec-line': { backgroundColor: 'rgba(250, 204, 21, 0.18)', boxShadow: 'inset 3px 0 0 #facc15' },
  '.cm-error-line': { backgroundColor: 'rgba(248, 113, 113, 0.22)', boxShadow: 'inset 3px 0 0 #f87171' },
});

export default function CodeEditor({ value, onChange, execLine, onRunShortcut, readOnly }) {
  const viewRef = useRef(null);
  const runRef = useRef(onRunShortcut);
  runRef.current = onRunShortcut;

  const extensions = useMemo(
    () => [
      python(),
      gameCompletions,
      execLineField,
      theme,
      Prec.highest(
        keymap.of([
          {
            key: 'Mod-Enter',
            run: () => {
              runRef.current?.();
              return true;
            },
          },
        ])
      ),
    ],
    []
  );

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: setExecLine.of(execLine) });
    if (execLine?.line && execLine.line <= view.state.doc.lines) {
      const pos = view.state.doc.line(execLine.line).from;
      view.dispatch({ effects: EditorView.scrollIntoView(pos, { y: 'nearest' }) });
    }
  }, [execLine]);

  return (
    <CodeMirror
      className="code-editor"
      value={value}
      height="100%"
      theme={oneDark}
      extensions={extensions}
      onChange={onChange}
      readOnly={readOnly}
      onCreateEditor={(view) => {
        viewRef.current = view;
      }}
      basicSetup={{ tabSize: 4, indentOnInput: true, foldGutter: false }}
    />
  );
}
