'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AlignCenter, AlignLeft, AlignRight, Bold, Eraser, Indent, Italic,
  Link, List, ListOrdered, Outdent, Paperclip, Redo2, Strikethrough,
  Underline, Undo2,
} from 'lucide-react';
import { sanitizeRichText } from '@/lib/sanitize-rich-text';

type RichTextEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  mediaFiles?: File[];
  onMediaChange?: (files: File[]) => void;
  mediaError?: string;
};

const iconButton = 'rounded-md p-1.5 text-slate-600 transition hover:bg-white hover:text-slate-950 disabled:opacity-40';

export function RichTextEditor({ value, onChange, placeholder = 'Start typing…', disabled = false, mediaFiles = [], onMediaChange, mediaError }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const editor = editorRef.current;
    if (editor && editor.innerHTML !== value) editor.innerHTML = sanitizeRichText(value);
  }, [value]);

  function command(name: string, argument?: string) {
    const editor = editorRef.current;
    if (!editor || disabled) return;
    editor.focus();
    document.execCommand(name, false, argument);
    onChange(sanitizeRichText(editor.innerHTML));
  }

  function chooseLink() {
    const url = window.prompt('Enter a link URL (https://…)');
    if (!url) return;
    const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    command('createLink', normalized);
  }

  const tools = [
    ['Bold', Bold, 'bold'], ['Italic', Italic, 'italic'], ['Underline', Underline, 'underline'],
    ['Strikethrough', Strikethrough, 'strikeThrough'], ['Bulleted list', List, 'insertUnorderedList'],
    ['Numbered list', ListOrdered, 'insertOrderedList'], ['Align left', AlignLeft, 'justifyLeft'],
    ['Align center', AlignCenter, 'justifyCenter'], ['Align right', AlignRight, 'justifyRight'],
    ['Decrease indent', Outdent, 'outdent'], ['Increase indent', Indent, 'indent'],
    ['Undo', Undo2, 'undo'], ['Redo', Redo2, 'redo'], ['Clear formatting', Eraser, 'removeFormat'],
  ] as const;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm focus-within:border-orange-400 focus-within:ring-2 focus-within:ring-orange-100">
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 px-2 py-1.5">
        <select aria-label="Text style" disabled={disabled} defaultValue="p" onChange={(event) => command('formatBlock', event.target.value)} className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700">
          <option value="p">Normal</option><option value="h1">Heading 1</option><option value="h2">Heading 2</option><option value="h3">Heading 3</option><option value="blockquote">Quote</option>
        </select>
        <select aria-label="Font" disabled={disabled} defaultValue="Arial" onChange={(event) => command('fontName', event.target.value)} className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700">
          <option>Arial</option><option>Calibri</option><option>Georgia</option><option>Tahoma</option><option>Times New Roman</option><option>Verdana</option>
        </select>
        <select aria-label="Font size" disabled={disabled} defaultValue="3" onChange={(event) => command('fontSize', event.target.value)} className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700">
          <option value="1">10</option><option value="2">12</option><option value="3">14</option><option value="4">18</option><option value="5">24</option><option value="6">32</option>
        </select>
        <label title="Text color" className="flex h-8 items-center gap-1 rounded-md px-1.5 text-xs text-slate-600 hover:bg-white">A<input aria-label="Text color" type="color" disabled={disabled} className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0" onChange={(event) => command('foreColor', event.target.value)} /></label>
        <span className="mx-1 h-6 w-px bg-slate-200" />
        {tools.map(([label, Icon, name]) => <button key={label} type="button" title={label} aria-label={label} disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={() => command(name)} className={iconButton}><Icon className="h-4 w-4" /></button>)}
        <button type="button" title="Insert link" aria-label="Insert link" disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={chooseLink} className={iconButton}><Link className="h-4 w-4" /></button>
      </div>
      <div ref={editorRef} contentEditable={!disabled} suppressContentEditableWarning role="textbox" aria-multiline="true" aria-label={placeholder} data-placeholder={placeholder}
        onPaste={(event) => { event.preventDefault(); const html = event.clipboardData.getData('text/html'); document.execCommand(html ? 'insertHTML' : 'insertText', false, html ? sanitizeRichText(html) : event.clipboardData.getData('text/plain')); onChange(sanitizeRichText(event.currentTarget.innerHTML)); }}
        onInput={(event) => onChange(sanitizeRichText(event.currentTarget.innerHTML))}
        className="rich-text-editor min-h-32 px-4 py-3 text-sm leading-6 text-slate-700 outline-none empty:before:pointer-events-none empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)] [&_blockquote]:border-l-4 [&_blockquote]:border-slate-300 [&_blockquote]:pl-3 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:text-xl [&_h2]:font-bold [&_h3]:text-lg [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6" />
      {onMediaChange && (
        <div className="border-t border-slate-200 bg-slate-50 px-3 py-2.5">
          <label title="Attach images or videos" aria-label="Attach images or videos" className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-orange-300 hover:bg-orange-50 hover:text-orange-600">
            <Paperclip className="h-4 w-4" aria-hidden="true" />
            <input type="file" accept="image/*,video/*" multiple disabled={disabled} className="sr-only" onChange={(event) => {
              const files = Array.from(event.currentTarget.files ?? []);
              onMediaChange(files);
              event.currentTarget.value = '';
            }} />
          </label>
          {mediaFiles.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{mediaFiles.map((file, index) => <span key={`${file.name}-${file.lastModified}`} className="inline-flex max-w-52 items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600"><span className="truncate">{file.name}</span><button type="button" aria-label={`Remove ${file.name}`} onClick={() => onMediaChange(mediaFiles.filter((_, itemIndex) => itemIndex !== index))} className="font-bold text-slate-400 hover:text-rose-600">×</button></span>)}</div>}
          {mediaError && <p className="mt-1.5 text-xs text-rose-600">{mediaError}</p>}
        </div>
      )}
    </div>
  );
}

export function RichTextContent({ value, className = '' }: { value?: string | null; className?: string }) {
  const [html, setHtml] = useState('');
  useEffect(() => setHtml(sanitizeRichText(value ?? '')), [value]);
  return <div className={`rich-text-content [&_a]:text-blue-600 [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-slate-300 [&_blockquote]:pl-3 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:text-xl [&_h2]:font-bold [&_h3]:text-lg [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6 ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
