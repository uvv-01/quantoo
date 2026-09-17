"use client";

/**
 * Python code editor for the quantum workspace.
 *
 * Thin wrapper around CodeMirror providing syntax highlighting, line
 * numbers, indentation, and bracket matching. The editor is intentionally
 * minimal; error display and run controls live in the workspace shell.
 */

import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { EditorView } from "@codemirror/view";

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  /** Height in pixels for the editor area. */
  height?: number;
  readOnly?: boolean;
  ariaLabel: string;
}

export function CodeEditor({
  value,
  onChange,
  height = 420,
  readOnly = false,
  ariaLabel,
}: CodeEditorProps) {
  return (
    <div
      className="overflow-hidden rounded-md border bg-[#0b1120] text-sm"
      role="group"
      aria-label={ariaLabel}
    >
      <CodeMirror
        value={value}
        height={`${height}px`}
        theme="dark"
        extensions={[python(), EditorView.lineWrapping]}
        editable={!readOnly}
        basicSetup={{
          lineNumbers: true,
          foldGutter: false,
          autocompletion: false,
          bracketMatching: true,
          closeBrackets: true,
          indentOnInput: true,
          tabSize: 4,
        }}
        onChange={onChange}
        aria-label={ariaLabel}
      />
    </div>
  );
}
