import { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Event } from '../lib/supabase';
import { parseCommentToSegments } from '../lib/commentTagParsing';

function escapeHtml(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

interface CommentEditorProps {
  value: string;
  onChange: (value: string) => void;
  event: Event;
  tagColors?: {
    producer_bg_color?: string;
    producer_text_color?: string;
    designer_bg_color?: string;
    designer_text_color?: string;
    model_bg_color?: string;
    model_text_color?: string;
    hair_makeup_bg_color?: string;
    hair_makeup_text_color?: string;
    city_bg_color?: string;
    city_text_color?: string;
    season_bg_color?: string;
    season_text_color?: string;
    header_tags_bg_color?: string;
    header_tags_text_color?: string;
    footer_tags_bg_color?: string;
    footer_tags_text_color?: string;
    optional_tags_bg_color?: string;
    optional_tags_text_color?: string;
  };
  customPerformerTags?: { slug: string; bg_color: string; text_color: string }[];
  placeholder?: string;
  className?: string;
  rows?: number;
}

export type CommentEditorRef = { insertAtCursor: (text: string) => void; focus: () => void };

const CommentEditor = forwardRef<CommentEditorRef, CommentEditorProps>(function CommentEditor(
  {
    value,
    onChange,
    event,
    tagColors,
    customPerformerTags = [],
    placeholder = 'Share your thoughts...',
    className = '',
    rows = 4
  },
  ref
) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastValueRef = useRef<string>(value);

  const syncFromValue = useCallback(
    (newValue: string, cursorPos?: number) => {
      const el = editorRef.current;
      if (!el || !event?.id) return;
      const segments = parseCommentToSegments(newValue, event, tagColors, customPerformerTags);
      const html = segments
        .map((seg) => {
          if (seg.type === 'tag' && seg.tag) {
            const inner = `<span class="inline-flex max-w-full whitespace-normal break-words rounded-md px-2 py-1 text-xs text-left" style="background-color:${escapeHtml(seg.tag.bg)};color:${escapeHtml(seg.tag.text)}">${escapeHtml(seg.value)}</span>`;
            return `<span contenteditable="false" data-tag-pill class="inline-flex max-w-full min-w-0 flex-wrap items-center gap-1 p-0 text-left text-xs not-italic font-normal mx-0.5 select-none transition-colors hover:opacity-80">${inner}</span>`;
          }
          return escapeHtml(seg.value);
        })
        .join('');
      el.innerHTML = html || '';
      if (cursorPos !== undefined && newValue.length > 0) {
        requestAnimationFrame(() => {
          const sel = window.getSelection();
          if (!sel) return;
          let offset = 0;
          const walk = (node: Node): boolean => {
            if (node.nodeType === Node.TEXT_NODE) {
              const len = (node.textContent || '').length;
              if (offset + len >= cursorPos) {
                const range = document.createRange();
                range.setStart(node, Math.min(cursorPos - offset, len));
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
                return true;
              }
              offset += len;
            } else {
              for (let i = 0; i < node.childNodes.length; i++) {
                if (walk(node.childNodes[i])) return true;
              }
            }
            return false;
          };
          walk(el);
        });
      }
    },
    [event, tagColors, customPerformerTags]
  );

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const currentText = el.innerText || '';
    if (currentText !== value) {
      lastValueRef.current = value;
      const sel = window.getSelection();
      let cursorPos = value.length;
      if (sel && el.contains(sel?.anchorNode)) {
        try {
          const range = sel.getRangeAt(0);
          const pre = document.createRange();
          pre.selectNodeContents(el);
          pre.setEnd(range.startContainer, range.startOffset);
          cursorPos = (pre.toString() || '').length;
        } catch {
          cursorPos = value.length;
        }
      }
      syncFromValue(value, Math.min(cursorPos, value.length));
    }
  }, [value, syncFromValue]);

  const handleInput = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const text = el.innerText || '';
    if (text !== lastValueRef.current) {
      lastValueRef.current = text;
      onChange(text);
    }
  }, [onChange]);

  const insertAtCursor = useCallback(
    (text: string) => {
      const el = editorRef.current;
      if (!el) return;
      el.focus();
      const before = lastValueRef.current;
      const sel = window.getSelection();
      let start = before.length;
      if (sel && el.contains(sel.anchorNode)) {
        try {
          const range = sel.getRangeAt(0);
          const pre = document.createRange();
          pre.selectNodeContents(el);
          pre.setEnd(range.startContainer, range.startOffset);
          start = (pre.toString() || '').length;
        } catch {
          start = before.length;
        }
      }
      const after = before.slice(start);
      const beforePart = before.slice(0, start);
      const insert = (beforePart && !/[\s,]$/.test(beforePart) ? ' ' : '') + text + (after && !/^[\s,]/.test(after) ? ' ' : '');
      const newValue = beforePart + insert + after;
      lastValueRef.current = newValue;
      onChange(newValue);
      syncFromValue(newValue, Math.min(start + insert.length, newValue.length));
    },
    [onChange, syncFromValue]
  );

  useImperativeHandle(ref, () => ({
    insertAtCursor,
    focus: () => editorRef.current?.focus()
  }));

  return (
    <div
      ref={editorRef}
      contentEditable
      suppressContentEditableWarning
      onInput={handleInput}
      data-placeholder={placeholder}
      className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-700 [&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-gray-400 ${className}`}
      style={{ minHeight: `${rows * 1.5}rem` }}
    />
  );
});

export default CommentEditor;
