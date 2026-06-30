"use client";

import { useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { html } from "@codemirror/lang-html";
import { syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";

interface Props {
  value: string;
  onChange: (value: string) => void;
  height?: string;
  placeholder?: string;
}

export default function CodeMirrorEditor({
  value,
  onChange,
  height = "400px",
  placeholder,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChange(update.state.doc.toString());
      }
    });

    const extensions = [
      lineNumbers(),
      html(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      EditorView.lineWrapping,
      updateListener,
    ];

    if (placeholder) {
      extensions.push(
        EditorView.theme({
          "& .cm-placeholder": {
            color: "#9CA3AF",
            fontStyle: "italic",
          },
        })
      );
    }

    const state = EditorState.create({
      doc: value,
      extensions,
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    if (placeholder) {
      view.dom.setAttribute("data-placeholder", placeholder);
    }

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Only mount once; value changes come through the view directly
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external value changes back into the editor
  useEffect(() => {
    if (!viewRef.current) return;
    const current = viewRef.current.state.doc.toString();
    if (value !== current) {
      viewRef.current.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
    }
  }, [value]);

  return (
    <div
      ref={containerRef}
      style={{
        height,
        border: "1px solid #D1D5DB",
        borderRadius: "6px",
        overflow: "auto",
      }}
    />
  );
}
