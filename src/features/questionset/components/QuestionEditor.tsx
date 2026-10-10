import { Card } from '../../../shared/components/Card';
import { Input } from '../../../shared/components/Input';
import type { ChoiceIndex, DraftQuestion, QuestionType } from '../editorModel';

// The repository's JS rule treats TypeScript callback parameter names as variables.
/* eslint-disable no-unused-vars */
interface Props {
  question: DraftQuestion;
  number: number;
  seconds: string;
  onSecondsChange(value: string): void;
  onChange(patch: Partial<DraftQuestion>): void;
}
/* eslint-enable no-unused-vars */

const optionColors = ['bg-brand', 'bg-[#0ea5e9]', 'bg-[#14b8a6]', 'bg-[#7c5cff]'];
const markers = ['①', '②', '③', '④'];

export function QuestionEditor({ question, number, seconds, onSecondsChange, onChange }: Props) {
  const options = question.type === 'MULTIPLE_CHOICE' ? question.choices : ['O', 'X'];
  const answer = question.type === 'MULTIPLE_CHOICE' ? question.correctChoice : question.correctTruth;
  return (
    <Card className="min-w-0 space-y-5 lg:min-h-[609px]">
      <h2 className="text-base font-bold">{number}번 문항 편집</h2>
      <div className="space-y-2">
        <label htmlFor={`content-${question.id}`} className="text-xs font-semibold text-text-muted">문제 내용</label>
        <textarea
          id={`content-${question.id}`}
          value={question.content}
          onChange={event => onChange({ content: event.target.value })}
          placeholder="문제 내용을 입력해주세요"
          className="block min-h-28 w-full resize-y rounded-card border border-border-input bg-muted/40 px-5 py-10 text-center text-base font-semibold focus-visible:outline-2 focus-visible:outline-brand"
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold text-text-muted">유형</span>
        <div role="group" aria-label="문제 유형" className="inline-flex rounded-control bg-muted p-1">
          {([['MULTIPLE_CHOICE', '4지선다'], ['TRUE_FALSE', 'OX']] as const).map(([type, label]) => (
            <button key={type} type="button" aria-pressed={question.type === type} onClick={() => onChange({ type: type as QuestionType })} className={`h-8 rounded-compact px-5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-brand ${question.type === type ? 'bg-surface text-brand shadow-surface' : 'text-text-muted'}`}>{label}</button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="editor-time" className="text-xs font-semibold text-text-muted">제한시간</label>
        <Input id="editor-time" type="number" min={10} max={300} step={1} value={seconds} onChange={event => onSecondsChange(event.target.value)} className="max-w-24" aria-describedby="editor-time-help" />
        <span id="editor-time-help" className="text-xs text-text-muted">초 · 세트의 모든 문항에 적용</span>
      </div>
      <fieldset className="space-y-3">
        <legend className="mb-3 text-xs font-semibold text-text-muted">선택지 (정답 라디오로 선택)</legend>
        {options.map((option, index) => (
          <div key={index} className="flex min-w-0 items-center gap-3">
            <input
              type="radio"
              name={`answer-${question.id}`}
              aria-label={`${index + 1}번 선택지를 정답으로 선택`}
              checked={answer === index}
              onChange={() => onChange(question.type === 'MULTIPLE_CHOICE' ? { correctChoice: index as ChoiceIndex } : { correctTruth: index as 0 | 1 })}
              className="size-5 shrink-0 accent-brand focus-visible:outline-2 focus-visible:outline-brand"
            />
            <span aria-hidden="true" className={`flex size-7 shrink-0 items-center justify-center rounded-compact text-xs font-bold text-surface ${optionColors[index]}`}>{question.type === 'TRUE_FALSE' ? option : markers[index]}</span>
            <Input
              aria-label={`${index + 1}번 선택지`}
              value={option}
              readOnly={question.type === 'TRUE_FALSE'}
              onChange={event => {
                const choices: DraftQuestion['choices'] = [...question.choices];
                choices[index] = event.target.value;
                onChange({ choices });
              }}
              className={`h-12! text-center shadow-none! ${answer === index ? 'border-brand! bg-brand-soft! font-semibold! text-brand-strong!' : ''}`}
            />
          </div>
        ))}
      </fieldset>
    </Card>
  );
}
