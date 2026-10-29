import './QuizSetEditor.css'
import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { Question, QuestionSet } from '../dashboard-types'
import { labels } from '../dashboard-quiz'
import { Icon } from '../components/Icon'

function newQuestion(): Question {
  return {
    id: crypto.randomUUID(),
    title: '새 문항',
    prompt: '',
    type: 'multiple',
    options: ['', '', '', ''],
    answer: 0,
  }
}

export function QuizSetEditor({
  sets,
  onSave,
}: {
  sets: QuestionSet[]
  onSave: (set: QuestionSet) => void
}) {
  const { setId } = useParams()
  const navigate = useNavigate()
  const existing = sets.find((set) => set.id === setId)
  const [draft, setDraft] = useState<QuestionSet>(() =>
    existing
      ? structuredClone(existing)
      : {
          id: crypto.randomUUID(),
          name: '',
          seconds: 15,
          isPublic: false,
          questions: [newQuestion()],
        },
  )
  const [selectedId, setSelectedId] = useState(draft.questions[0].id)
  const [error, setError] = useState('')
  const dragId = useRef<string | null>(null)
  const selectedIndex = Math.max(
    0,
    draft.questions.findIndex((question) => question.id === selectedId),
  )
  const question = draft.questions[selectedIndex]
  const update = (patch: Partial<Question>) =>
    setDraft((current) => ({
      ...current,
      questions: current.questions.map((item) =>
        item.id === question.id ? { ...item, ...patch } : item,
      ),
    }))
  if (!existing && setId !== 'new')
    return (
      <main className="quiz-set-editor__not-found">
        <h1 className="quiz-set-editor__not-found-title">문제 세트를 찾을 수 없습니다.</h1>
        <Link className="quiz-set-editor__back-button" to="/professor/sets">
          목록으로 돌아가기
        </Link>
      </main>
    )
  const save = () => {
    if (!draft.name.trim()) {
      setError('세트 이름을 입력해 주세요.')
      return
    }
    if (!Number.isInteger(draft.seconds) || draft.seconds < 10 || draft.seconds > 300) {
      setError('문제당 시간을 10~300초 사이의 정수로 입력해 주세요.')
      return
    }
    const incomplete = draft.questions.findIndex(
      (item) => !item.prompt.trim() || item.options.some((option) => !option.trim()),
    )
    if (incomplete !== -1) {
      setSelectedId(draft.questions[incomplete].id)
      setError(`${incomplete + 1}번 문항의 문제 내용과 모든 선택지를 입력해 주세요.`)
      return
    }
    onSave({
      ...draft,
      name: draft.name.trim(),
      questions: draft.questions.map((item) => ({
        ...item,
        prompt: item.prompt.trim(),
        title: item.title.trim() || item.prompt.trim(),
        options: item.options.map((option) => option.trim()),
      })),
    })
    navigate('/professor/sets')
  }
  return (
    <main className="quiz-set-editor">
      <div className="quiz-set-editor__toolbar">
        <input
          aria-label="세트 이름"
          maxLength={100}
          placeholder="새 세트 이름"
          value={draft.name}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          className="quiz-set-editor__name-input"
        />
        <label className="quiz-set-editor__duration-label">
          <Icon screen="editor" name="imgFrame2" />
          문제당 시간
          <input
            aria-label="문제당 시간(초)"
            type="number"
            min={10}
            max={300}
            value={draft.seconds}
            onChange={(event) => setDraft({ ...draft, seconds: Number(event.target.value) })}
            className="quiz-set-editor__duration-input"
          />
          <span className="quiz-set-editor__duration-help">초 · 모든 문항에 적용 · 10~300초</span>
        </label>
        <div className="quiz-set-editor__actions">
          <button
            type="button"
            onClick={() => setDraft({ ...draft, isPublic: !draft.isPublic })}
            className="quiz-set-editor__visibility-button"
          >
            {draft.isPublic ? '비공개 전환' : '공개 전환'}
          </button>
          <button type="button" onClick={save} className="quiz-set-editor__save-button">
            저장
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="quiz-set-editor__error">
          {error}
        </p>
      )}
      <div className="quiz-set-editor__layout">
        <aside className="quiz-set-editor__sidebar">
          <h2 className="quiz-set-editor__sidebar-title">문항 (드래그로 순서 변경)</h2>
          {draft.questions.map((item, index) => (
            <div
              key={item.id}
              draggable
              onDragStart={(event) => {
                dragId.current = item.id
                event.dataTransfer.effectAllowed = 'move'
                event.dataTransfer.setData('text/plain', item.id)
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault()
                const source = draft.questions.findIndex((entry) => entry.id === dragId.current)
                if (source < 0 || source === index) return
                const questions = [...draft.questions]
                questions.splice(index, 0, questions.splice(source, 1)[0])
                setDraft({ ...draft, questions })
                dragId.current = null
              }}
            >
              <button
                type="button"
                onClick={() => setSelectedId(item.id)}
                aria-pressed={selectedId === item.id}
                className={`quiz-set-editor__question-button ${selectedId === item.id ? 'quiz-set-editor__question-button--selected' : 'quiz-set-editor__question-button--default'}`}
              >
                <Icon screen="editor" name={selectedId === item.id ? 'imgFrame3' : 'imgFrame4'} />
                <span
                  className={`quiz-set-editor__question-number ${selectedId === item.id ? 'quiz-set-editor__question-number--selected' : 'quiz-set-editor__question-number--default'}`}
                >
                  {index + 1}
                </span>
                <span className="quiz-set-editor__question-name">{item.title || '새 문항'}</span>
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => {
              const item = newQuestion()
              setDraft({ ...draft, questions: [...draft.questions, item] })
              setSelectedId(item.id)
              setError('')
            }}
            className="quiz-set-editor__add-button"
          >
            <Icon screen="editor" name="imgFrame5" />
            문항 추가
          </button>
          <p className="quiz-set-editor__reorder-help">
            순서 변경: 선택한 문항을{' '}
            <button
              type="button"
              className="quiz-set-editor__reorder-button"
              disabled={selectedIndex === 0}
              onClick={() => {
                const questions = [...draft.questions]
                ;[questions[selectedIndex - 1], questions[selectedIndex]] = [
                  questions[selectedIndex],
                  questions[selectedIndex - 1],
                ]
                setDraft({ ...draft, questions })
              }}
            >
              위로
            </button>{' '}
            ·{' '}
            <button
              type="button"
              className="quiz-set-editor__reorder-button"
              disabled={selectedIndex === draft.questions.length - 1}
              onClick={() => {
                const questions = [...draft.questions]
                ;[questions[selectedIndex + 1], questions[selectedIndex]] = [
                  questions[selectedIndex],
                  questions[selectedIndex + 1],
                ]
                setDraft({ ...draft, questions })
              }}
            >
              아래로
            </button>
          </p>
        </aside>
        <section className="quiz-set-editor__question-panel">
          <h2 className="quiz-set-editor__question-title">{selectedIndex + 1}번 문항 편집</h2>
          <label htmlFor="question-prompt" className="quiz-set-editor__prompt-label">
            문제 내용
          </label>
          <textarea
            id="question-prompt"
            value={question.prompt}
            maxLength={500}
            onChange={(event) => update({ prompt: event.target.value, title: event.target.value })}
            placeholder="문제 내용을 입력하세요"
            className="quiz-set-editor__prompt-input"
          />
          <div className="quiz-set-editor__type-row">
            <span className="quiz-set-editor__type-label">유형</span>
            <div className="quiz-set-editor__type-switch">
              {(['multiple', 'ox'] as const).map((type) => (
                <button
                  type="button"
                  key={type}
                  aria-pressed={question.type === type}
                  onClick={() => {
                    if (type !== question.type)
                      update({
                        type,
                        options: type === 'ox' ? ['O', 'X'] : ['', '', '', ''],
                        answer: 0,
                      })
                  }}
                  className={`quiz-set-editor__type-button ${question.type === type ? 'quiz-set-editor__type-button--selected' : 'quiz-set-editor__type-button--default'}`}
                >
                  {type === 'multiple' ? '4지선다' : 'OX'}
                </button>
              ))}
            </div>
          </div>
          <fieldset className="quiz-set-editor__options-fieldset">
            <legend className="quiz-set-editor__options-legend">선택지 (정답 라디오로 선택)</legend>
            <div className="quiz-set-editor__options">
              {question.options.map((option, index) => (
                <div
                  key={`${question.id}-${question.type}-${index}`}
                  className="quiz-set-editor__option-row"
                >
                  <input
                    aria-label={`선택지 ${index + 1}을 정답으로 설정`}
                    type="radio"
                    name="correct-answer"
                    checked={question.answer === index}
                    onChange={() => update({ answer: index })}
                    className="quiz-set-editor__answer-radio"
                  />
                  <span className="quiz-set-editor__option-number" data-option-index={index}>
                    {question.type === 'ox' ? option : labels[index]}
                  </span>
                  <input
                    aria-label={`선택지 ${index + 1} 내용`}
                    readOnly={question.type === 'ox'}
                    value={option}
                    maxLength={200}
                    placeholder={`선택지 ${index + 1}`}
                    onChange={(event) =>
                      update({
                        options: question.options.map((value, optionIndex) =>
                          optionIndex === index ? event.target.value : value,
                        ),
                      })
                    }
                    className={`quiz-set-editor__option-input ${question.answer === index ? 'quiz-set-editor__option-input--correct' : ''}`}
                  />
                </div>
              ))}
            </div>
          </fieldset>
        </section>
      </div>
    </main>
  )
}
