import "./QuizQuestion.css";
import { useServerCountdown } from "../../quiz/hooks/useServerCountdown";
import type { ProfessorQuizState } from "../../quiz/professorQuizReducer";
import { choiceLabel } from "../dashboard-quiz";
import { Icon } from "./Icon";

/** 남은 시간 문구. 0초가 돼도 자기 시계로 넘어가지 않고 서버의 마감 메시지를 기다린다(06 4절). */
function timerText(
  quiz: Extract<ProfessorQuizState, { phase: "question" | "between" }>,
  seconds: number,
) {
  if (quiz.phase === "between") {
    return `${quiz.isLast ? "결과까지" : "다음 문제까지"} ${seconds}초`;
  }
  if (seconds === 0) return "마감 중";
  return `남은 시간 ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function QuizQuestion({
  quiz,
  participants,
  onStop,
}: {
  quiz: Extract<ProfessorQuizState, { phase: "question" | "between" }>;
  participants: number;
  onStop: () => void;
}) {
  const seconds = useServerCountdown(
    quiz.phase === "between" ? quiz.nextOpensAt : quiz.closesAt,
    quiz.clockOffsetMs,
  );
  const responseCount = quiz.answeredCount;
  return (
    <>
      <section className="quiz-question">
        <div className="quiz-question__progress-track">
          <div
            className="quiz-question__progress-fill"
            style={{
              width: `${(quiz.questionNo / quiz.totalQuestions) * 100}%`,
            }}
          />
        </div>
        <div className="quiz-question__content">
          <div className="quiz-question__toolbar">
            <p role="timer" className="quiz-question__timer">
              <Icon screen="quiz" name="imgFrame3" />
              {quiz.questionNo} / {quiz.totalQuestions} 문항 ·{" "}
              {timerText(quiz, seconds)}
            </p>
            <button
              type="button"
              onClick={onStop}
              className="quiz-question__stop-button"
            >
              퀴즈 중단
            </button>
          </div>
          <h2 className="quiz-question__title">{quiz.content}</h2>
          <ul className="quiz-question__options">
            {quiz.choices.map((choice, index) => (
              <li key={choice.id} className="quiz-question__option">
                <span
                  className="quiz-question__option-number"
                  data-option-index={index}
                >
                  {choiceLabel(choice)}
                </span>
                <span className="quiz-question__option-text">
                  {choice.content}
                </span>
              </li>
            ))}
          </ul>
          <p className="quiz-question__answer-help">(정답 표시 없음)</p>
        </div>
      </section>
      <section className="quiz-question__responses">
        <div className="quiz-question__response-header">
          <p className="quiz-question__response-count">
            응답 <span className="quiz-question__count">{responseCount}명</span>{" "}
            <span className="quiz-question__participants">
              / 접속 {participants}명
            </span>
          </p>
          <span className="quiz-question__response-label">
            점수·순위 없음 — 이해도 확인용
          </span>
        </div>
        <div className="quiz-question__response-track">
          <div
            className="quiz-question__response-fill"
            style={{
              width: `${participants ? Math.min((responseCount / participants) * 100, 100) : 0}%`,
            }}
          />
        </div>
        <p className="quiz-question__response-help">
          정답·분포는 퀴즈가 끝난 뒤 결과 화면에서 · 문항 마감 후 3초 뒤 다음
          문항으로 이동합니다.
        </p>
      </section>
    </>
  );
}
