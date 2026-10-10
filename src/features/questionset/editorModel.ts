export type QuestionType = 'MULTIPLE_CHOICE' | 'TRUE_FALSE';
export type ChoiceIndex = 0 | 1 | 2 | 3;

export interface DraftQuestion {
  id: string;
  content: string;
  type: QuestionType;
  choices: [string, string, string, string];
  correctChoice: ChoiceIndex;
  correctTruth: 0 | 1;
}

export function createQuestion(id: string): DraftQuestion {
  return { id, content: '', type: 'MULTIPLE_CHOICE', choices: ['', '', '', ''], correctChoice: 0, correctTruth: 0 };
}

export function moveQuestion(questions: DraftQuestion[], fromId: string, toId: string): DraftQuestion[] {
  const from = questions.findIndex(question => question.id === fromId);
  const to = questions.findIndex(question => question.id === toId);
  if (from < 0 || to < 0 || from === to) return questions;
  const reordered = [...questions];
  const [question] = reordered.splice(from, 1);
  reordered.splice(to, 0, question);
  return reordered;
}

export function validateDraft(title: string, seconds: string, questions: DraftQuestion[]): { message: string; questionId?: string } | null {
  if (!title.trim()) return { message: '세트 제목을 입력해주세요.' };
  const time = Number(seconds);
  if (!Number.isInteger(time) || time < 10 || time > 300) return { message: '제한시간은 10~300초 사이의 정수로 입력해주세요.' };
  for (const [index, question] of questions.entries()) {
    if (!question.content.trim()) return { message: `${index + 1}번 문제 내용을 입력해주세요.`, questionId: question.id };
    if (question.type === 'MULTIPLE_CHOICE' && question.choices.some(choice => !choice.trim())) {
      return { message: `${index + 1}번 문항의 선택지 4개를 모두 입력해주세요.`, questionId: question.id };
    }
  }
  return null;
}

const prompts = ['스택의 LIFO 특성을 가장 잘 설명한 것은?', '큐에서 dequeue 위치는?', '재귀 호출은 스택을 사용한다.', '원형 큐를 쓰는 이유는?', '스택 오버플로가 발생하는 조건은?'];
export const initialQuestions: DraftQuestion[] = prompts.map((content, index) => ({
  ...createQuestion(`question-${index + 1}`),
  content,
  type: index === 2 ? 'TRUE_FALSE' : 'MULTIPLE_CHOICE',
  choices: index === 0
    ? ['마지막에 넣은 값이 먼저 나온다', '먼저 넣은 값이 먼저 나온다', '우선순위가 높은 값이 먼저 나온다', '값이 무작위로 나온다']
    : ['앞쪽', '뒤쪽', '가운데', '무작위 위치'],
}));
