import { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Event } from '../lib/supabase';
import { parseCommentToSegments } from '../lib/commentTagParsing';

function escapeHtml(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function tagInnerHtml(bg: string, text: string, label: string): string {
  return `<span class="inline-flex max-w-full whitespace-normal break-words rounded-md px-2 py-1 text-xs text-left" style="background-color:${escapeHtml(bg)};color:${escapeHtml(text)}">${escapeHtml(label)}</span>`;
}

function editorHtmlFromValue(
  newValue: string,
  event: Event,
  tagColors: CommentEditorProps['tagColors'],
  customPerformerTags: { slug: string; bg_color: string; text_color: string }[],
): string {
  const segments = parseCommentToSegments(newValue, event, tagColors, customPerformerTags);
  // Normal inline flow (not flex): contentEditable + display:flex breaks typing/caret.
  // Keep text whitespace. Put a real space between adjacent pills so innerText
  // does not glue city/region labels on save.
  const parts: string[] = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const prev = segments[i - 1];
    if (seg.type === 'tag' && seg.tag) {
      if (prev?.type === 'tag') parts.push(' ');
      const inner = tagInnerHtml(seg.tag.bg, seg.tag.text, seg.value);
      parts.push(
        `<span contenteditable="false" data-tag-pill class="mx-1 inline-flex max-w-full min-w-0 flex-wrap items-center gap-1 p-0 align-middle text-left text-xs not-italic font-normal select-none transition-colors hover:opacity-80">${inner}</span>`,
      );
    } else {
      parts.push(`<span>${escapeHtml(seg.value)}</span>`);
    }
  }
  return parts.join('');
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
      el.innerHTML = editorHtmlFromValue(newValue, event, tagColors, customPerformerTags) || '';
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
    if (!el || !event?.id) return;

    const readCursor = (): number => {
      const sel = window.getSelection();
      let cursorPos = value.length;
      if (sel && el.contains(sel.anchorNode)) {
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
      return Math.min(cursorPos, value.length);
    };

    const currentText = el.innerText || '';
    if (currentText !== value) {
      lastValueRef.current = value;
      syncFromValue(value, readCursor());
      return;
    }

    // Same plain text: only rebuild when tag pills are out of sync (match typed / pill deleted).
    const segments = parseCommentToSegments(value, event, tagColors, customPerformerTags);
    const tagCount = segments.filter((s) => s.type === 'tag').length;
    const pillCount = el.querySelectorAll('[data-tag-pill]').length;
    if (tagCount === pillCount) return;
    lastValueRef.current = value;
    syncFromValue(value, readCursor());
  }, [value, syncFromValue, event, tagColors, customPerformerTags]);

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
      className={`block w-full min-w-0 whitespace-pre-wrap break-words rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring [&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-muted-foreground ${className}`}
      style={{ minHeight: `${rows * 1.5}rem` }}
    />
  );
});

export default CommentEditor;
