import { useRef, useState } from 'react';
import { Header, HeaderUserInfo } from '../shared/components/Header';
import { Button } from '../shared/components/Button';
import { Input } from '../shared/components/Input';
import { Badge } from '../shared/components/Badge';
import { QuestionSidebar } from '../features/questionset/components/QuestionSidebar';
import { QuestionEditor } from '../features/questionset/components/QuestionEditor';
import { createQuestion, initialQuestions, moveQuestion, validateDraft } from '../features/questionset/editorModel';
import type { DraftQuestion } from '../features/questionset/editorModel';

export default function QuestionSetEditorPage() {
  const [title, setTitle] = useState('3주차 스택·큐 확인문제');
  const [isPublic, setIsPublic] = useState(false);
  const [seconds, setSeconds] = useState('15');
  const [questions, setQuestions] = useState<DraftQuestion[]>(() => structuredClone(initialQuestions));
  const [selectedId, setSelectedId] = useState(initialQuestions[0].id);
  const [message, setMessage] = useState('');
  const [hasError, setHasError] = useState(false);
  const nextId = useRef(initialQuestions.length + 1);
  const savedDraft = useRef<string | null>(null);
  const selected = questions.find(question => question.id === selectedId)!;
  const snapshot = JSON.stringify({ title, isPublic, seconds, questions });
  const clearNotice = () => { setMessage(''); setHasError(false); };

  function updateQuestion(patch: Partial<DraftQuestion>) {
    clearNotice();
    setQuestions(previous => previous.map(question => question.id === selectedId ? { ...question, ...patch } : question));
  }

  function save() {
    const error = validateDraft(title, seconds, questions);
    if (error) {
      setHasError(true);
      setMessage(error.message);
      if (error.questionId) setSelectedId(error.questionId);
      return;
    }
    savedDraft.current = snapshot;
    setHasError(false);
    setMessage('현재 화면의 더미 데이터를 저장했습니다. 새로고침하면 초기화됩니다.');
  }

  return (
    <div className="min-h-screen bg-page font-sans text-text">
      <Header user={<HeaderUserInfo displayName="강현민 교수" />} />
      <main className="mx-auto max-w-[1280px] px-4 py-6 md:px-8 md:py-8">
        <form noValidate onSubmit={event => { event.preventDefault(); save(); }}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0 flex-1 basis-64">
              <label htmlFor="set-title" className="sr-only">세트 제목</label>
              <input id="set-title" value={title} onChange={event => { clearNotice(); setTitle(event.target.value); }} className="w-full rounded-compact bg-transparent text-2xl font-black tracking-[-0.6px] focus-visible:outline-2 focus-visible:outline-brand" />
            </div>
            <div className="flex flex-wrap items-center gap-3 rounded-control bg-surface px-4 py-2 shadow-surface">
              <label htmlFor="set-time" className="text-sm font-semibold">문제당 시간</label>
              <Input id="set-time" type="number" min={10} max={300} step={1} value={seconds} onChange={event => { clearNotice(); setSeconds(event.target.value); }} className="h-8! max-w-20 rounded-compact! border-brand/30! bg-brand-soft! px-3! py-1! text-brand! shadow-none!" aria-describedby="set-time-help" />
              <span id="set-time-help" className="text-xs text-text-muted">세트의 모든 문항에 적용 · 10~300초</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={isPublic ? 'public' : 'private'}>{isPublic ? '공개' : '비공개'}</Badge>
              <Button type="button" variant="outline" size="lg" aria-pressed={isPublic} onClick={() => { clearNotice(); setIsPublic(value => !value); }}>{isPublic ? '비공개 전환' : '공개 전환'}</Button>
              <Button type="submit" size="lg">저장</Button>
            </div>
          </div>
          {message && <p role={hasError ? 'alert' : 'status'} className={`mt-4 text-sm ${hasError ? 'text-danger' : 'text-text-muted'}`}>{message}</p>}
          {savedDraft.current !== null && savedDraft.current !== snapshot && <p className="mt-2 text-xs text-text-muted">저장하지 않은 변경사항이 있습니다.</p>}
          <div className="mt-6 grid items-start gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
            <QuestionSidebar
              questions={questions}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onAdd={() => {
                clearNotice();
                const question = createQuestion(`question-${nextId.current++}`);
                setQuestions(previous => [...previous, question]);
                setSelectedId(question.id);
              }}
              onMove={(fromId, toId) => {
                clearNotice();
                setQuestions(previous => moveQuestion(previous, fromId, toId));
                setMessage('문항 순서를 변경했습니다.');
              }}
            />
            <QuestionEditor
              key={selectedId}
              question={selected}
              number={questions.findIndex(question => question.id === selectedId) + 1}
              seconds={seconds}
              onSecondsChange={value => { clearNotice(); setSeconds(value); }}
              onChange={updateQuestion}
            />
          </div>
        </form>
      </main>
    </div>
  );
}
