import { useRef, useState } from 'react';
import { Button } from '../../../shared/components/Button';
import type { DraftQuestion } from '../editorModel';

// The repository's JS rule treats TypeScript callback parameter names as variables.
/* eslint-disable no-unused-vars */
interface Props {
  questions: DraftQuestion[];
  selectedId: string;
  onSelect(id: string): void;
  onAdd(): void;
  onMove(fromId: string, toId: string): void;
}
/* eslint-enable no-unused-vars */

export function QuestionSidebar({ questions, selectedId, onSelect, onAdd, onMove }: Props) {
  const draggedId = useRef<string | null>(null);
  const touchDrag = useRef<{ fromId: string; toId: string } | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  return (
    <aside aria-label="문항 목록" className="rounded-card border border-border bg-muted/40 p-4 shadow-surface lg:min-h-[609px]">
      <h2 className="mb-3 px-1 text-xs font-semibold text-text-muted">문항 (드래그로 순서 변경)</h2>
      <p id="reorder-help" className="sr-only">문항을 선택하거나 드래그하세요. 키보드는 Alt와 위·아래 방향키로 순서를 변경할 수 있습니다.</p>
      <ol className="space-y-2">
        {questions.map((question, index) => {
          const selected = selectedId === question.id;
          return (
            <li key={question.id}>
              <button
                type="button"
                data-question-id={question.id}
                draggable
                aria-current={selected ? 'true' : undefined}
                aria-describedby="reorder-help"
                onClick={() => onSelect(question.id)}
                onDragStart={event => {
                  draggedId.current = question.id;
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('text/plain', question.id);
                }}
                onDragOver={event => { if (draggedId.current) { event.preventDefault(); setOverId(question.id); } }}
                onDrop={event => {
                  event.preventDefault();
                  if (draggedId.current) onMove(draggedId.current, question.id);
                  draggedId.current = null;
                  setOverId(null);
                }}
                onDragEnd={() => { draggedId.current = null; setOverId(null); }}
                onKeyDown={event => {
                  if (!event.altKey || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
                  event.preventDefault();
                  const neighbor = questions[index + (event.key === 'ArrowUp' ? -1 : 1)];
                  if (neighbor) onMove(question.id, neighbor.id);
                }}
                className={`flex w-full items-center gap-2.5 rounded-control border px-3 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${selected ? 'border-brand bg-brand text-surface shadow-brand' : 'border-border bg-surface text-text shadow-surface'} ${overId === question.id ? 'outline-2 outline-offset-2 outline-brand' : ''}`}
              >
                <span
                  aria-hidden="true"
                  className="touch-none cursor-grab text-sm"
                  onPointerDown={event => {
                    if (event.pointerType === 'mouse') return;
                    event.currentTarget.setPointerCapture(event.pointerId);
                    touchDrag.current = { fromId: question.id, toId: question.id };
                  }}
                  onPointerMove={event => {
                    if (!touchDrag.current) return;
                    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-question-id]');
                    if (target?.dataset.questionId) {
                      touchDrag.current.toId = target.dataset.questionId;
                      setOverId(target.dataset.questionId);
                    }
                  }}
                  onPointerUp={() => {
                    if (touchDrag.current) onMove(touchDrag.current.fromId, touchDrag.current.toId);
                    touchDrag.current = null;
                    setOverId(null);
                  }}
                  onPointerCancel={() => { touchDrag.current = null; setOverId(null); }}
                >⠿</span>
                <span className={`flex size-6 shrink-0 items-center justify-center rounded-bubble-tail text-xs font-bold ${selected ? 'bg-surface/20' : 'bg-brand-subtle text-brand'}`}>{index + 1}</span>
                <span className="min-w-0 truncate text-sm font-medium">{question.content || '새 문항'}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <Button type="button" variant="outline" fullWidth onClick={onAdd} className="mt-3 border-2! border-dashed border-brand/30! bg-transparent! text-brand! shadow-none!">＋ 문항 추가</Button>
    </aside>
  );
}
