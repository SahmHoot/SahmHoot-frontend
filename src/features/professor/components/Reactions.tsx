import './Reactions.css'

export function Reactions({ participants }: { participants: number }) {
  return (
    <section className="professor-reactions">
      <div className="professor-reactions__header">
        <h2 className="professor-reactions__title">학생 반응 (최근 1분)</h2>
        <span className="professor-reactions__participants">접속 {participants}명</span>
      </div>
      <ul className="professor-reactions__list">
        {[
          { emoji: '👍', count: participants ? 12 : 0, width: participants ? 75 : 0 },
          { emoji: '❓', count: participants ? 5 : 0, width: participants ? 38 : 0 },
          { emoji: '😄', count: participants ? 3 : 0, width: participants ? 20 : 0 },
          { emoji: '👏', count: participants ? 2 : 0, width: participants ? 13 : 0 },
        ].map((item) => (
          <li key={item.emoji}>
            <div className="professor-reactions__item">
              <span
                className="professor-reactions__emoji"
                aria-label={item.emoji === '❓' ? '질문' : undefined}
              >
                {item.emoji}
              </span>
              <span className="professor-reactions__track">
                <span
                  className={`professor-reactions__fill ${item.emoji === '❓' ? 'professor-reactions__fill--question' : 'professor-reactions__fill--default'}`}
                  style={{ width: `${item.width}%` }}
                />
              </span>
              <strong className="professor-reactions__count">{item.count}</strong>
            </div>
            {item.emoji === '❓' && item.count > 0 && (
              <p className="professor-reactions__question-help">질문 많음 강조</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
