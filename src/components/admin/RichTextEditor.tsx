import { useEffect, useRef } from 'react';
import Icon from '@/components/ui/icon';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
}

interface ToolButton {
  cmd: string;
  arg?: string;
  icon: string;
  title: string;
}

const BUTTONS: ToolButton[] = [
  { cmd: 'formatBlock', arg: 'H1', icon: 'Heading1', title: 'Заголовок 1' },
  { cmd: 'formatBlock', arg: 'H2', icon: 'Heading2', title: 'Заголовок 2' },
  { cmd: 'formatBlock', arg: 'P', icon: 'Pilcrow', title: 'Обычный текст' },
  { cmd: 'bold', icon: 'Bold', title: 'Жирный' },
  { cmd: 'italic', icon: 'Italic', title: 'Курсив' },
  { cmd: 'underline', icon: 'Underline', title: 'Подчёркнутый' },
  { cmd: 'insertUnorderedList', icon: 'List', title: 'Маркированный список' },
  { cmd: 'insertOrderedList', icon: 'ListOrdered', title: 'Нумерованный список' },
  { cmd: 'justifyLeft', icon: 'AlignLeft', title: 'По левому краю' },
  { cmd: 'justifyCenter', icon: 'AlignCenter', title: 'По центру' },
  { cmd: 'removeFormat', icon: 'Eraser', title: 'Очистить формат' },
];

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const POINT_RE = /(?=\s\d+(?:\.\d+)*\.?\s)/g;

const formatPointsToTextHtml = (rawText: string): string => {
  const text = rawText.replace(/\u00a0/g, ' ');
  const lines = text.split(/\r?\n/);
  const out: string[] = [];

  for (const line of lines) {
    const parts = (' ' + line)
      .split(POINT_RE)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    if (parts.length === 0) continue;
    for (const part of parts) {
      out.push(`<p>${escapeHtml(part)}</p>`);
    }
  }

  return out.join('');
};

const formatPointsToHtml = (rawHtml: string): string => {
  const tmp = document.createElement('div');
  tmp.innerHTML = rawHtml;
  const text = (tmp.textContent || '').replace(/\u00a0/g, ' ');
  return formatPointsToTextHtml(text);
};

const RichTextEditor = ({ value, onChange }: RichTextEditorProps) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value || '';
    }
     
  }, [value]);

  const exec = (btn: ToolButton) => {
    ref.current?.focus();
    document.execCommand(btn.cmd, false, btn.arg);
    if (ref.current) onChange(ref.current.innerHTML);
  };

  const handleInput = () => {
    if (ref.current) onChange(ref.current.innerHTML);
  };

  const handleFormatPoints = () => {
    if (!ref.current) return;
    const formatted = formatPointsToHtml(ref.current.innerHTML);
    ref.current.innerHTML = formatted;
    onChange(formatted);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;
    e.preventDefault();
    const formatted = formatPointsToTextHtml(text);
    document.execCommand('insertHTML', false, formatted);
    if (ref.current) onChange(ref.current.innerHTML);
  };

  return (
    <div className="border rounded-lg overflow-hidden bg-white">
      <div className="flex flex-wrap gap-1 p-2 border-b bg-gray-50 sticky top-0 z-10">
        {BUTTONS.map((b, i) => (
          <button
            key={i}
            type="button"
            title={b.title}
            onMouseDown={(e) => {
              e.preventDefault();
              exec(b);
            }}
            className="h-8 w-8 flex items-center justify-center rounded hover:bg-gray-200 text-gray-700 transition-colors"
          >
            <Icon name={b.icon} size={16} fallback="Type" />
          </button>
        ))}
        <div className="w-px bg-gray-300 mx-1 self-stretch" />
        <button
          type="button"
          title="Разбить пункты 1.1, 1.2 по строкам"
          onMouseDown={(e) => {
            e.preventDefault();
            handleFormatPoints();
          }}
          className="h-8 px-2 flex items-center gap-1 rounded hover:bg-gray-200 text-gray-700 transition-colors text-xs font-medium"
        >
          <Icon name="ListTree" size={16} fallback="List" />
          Пункты
        </button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onPaste={handlePaste}
        className="min-h-[320px] max-h-[55vh] overflow-y-auto p-4 text-black prose prose-sm max-w-none focus:outline-none"
      />
    </div>
  );
};

export default RichTextEditor;