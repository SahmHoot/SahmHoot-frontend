import type { ChatMessage, QuizQuestion, QuizSet } from '../types/student.types'

// UI previews only. Replace these fixtures with room/quiz responses when APIs are available.
const question = (
  id: string, title: string, options: string[], correctAnswer: number,
): QuizQuestion => ({ id, title, options, correctAnswer, duration: 15, correctRate: 61, responseCount: 28 })

export const reviewSets: QuizSet[] = [
  {
    id: 'stack-queue', title: '3주차 스택·큐 확인문제', subject: '자료구조',
    questions: [
      question('stack-1', '스택에서 데이터를 추가하는 연산은?', ['push', 'pop', 'dequeue', 'peek'], 0),
      question('queue-1', '큐에서 dequeue가 일어나는 위치는?', ['front (앞쪽)', 'rear (뒤쪽)', '가운데', '위치와 무관하다'], 0),
      question('stack-2', '스택의 LIFO 특성을 가장 잘 설명한 것은?', ['마지막에 넣은 값이 먼저 나온다', '먼저 넣은 값이 먼저 나온다', '우선순위가 높은 값이 먼저 나온다', '값이 무작위로 나온다'], 0),
      question('queue-2', '큐의 FIFO 특성을 가장 잘 설명한 것은?', ['먼저 넣은 값이 먼저 나온다', '마지막에 넣은 값이 먼저 나온다', '큰 값이 먼저 나온다', '작은 값이 먼저 나온다'], 0),
      question('stack-3', '재귀 함수 호출을 관리할 때 사용하는 자료구조는?', ['큐', '배열', '스택', '해시 테이블'], 2),
    ],
  },
  {
    id: 'complexity', title: '1주차 복잡도 개념 점검', subject: '자료구조',
    questions: [
      question('complexity-1', '배열의 인덱스로 원소에 접근할 때 시간 복잡도는?', ['O(1)', 'O(n)', 'O(n²)', 'O(log n)'], 0),
      question('complexity-2', '정렬된 배열에서 이진 탐색의 시간 복잡도는?', ['O(n²)', 'O(log n)', 'O(n)', 'O(1)'], 1),
      question('complexity-3', '원소 n개를 한 번씩 방문할 때 시간 복잡도는?', ['O(1)', 'O(log n)', 'O(n)', 'O(n²)'], 2),
      question('complexity-4', 'n번 반복하는 반복문이 이중으로 중첩되면?', ['O(n)', 'O(log n)', 'O(1)', 'O(n²)'], 3),
      question('complexity-5', '입력 크기와 관계없이 일정한 시간에 끝나는 연산은?', ['상수 시간', '선형 시간', '제곱 시간', '지수 시간'], 0),
      question('complexity-6', '추가로 사용하는 메모리의 크기를 나타내는 것은?', ['시간 복잡도', '공간 복잡도', '정렬 순서', '탐색 깊이'], 1),
    ],
  },
]

export const roomQuiz = reviewSets[0]
export const classTitle = '자료구조 3주차'
export const optionLabels = ['①', '②', '③', '④']

export function initialMessages(nickname: string): ChatMessage[] {
  return [
    { id: 'message-1', nickname, mine: true, role: 'student', text: '오늘 범위가 스택까지인가요?' },
    { id: 'message-2', nickname: '강현민 교수', role: 'professor', text: '네, 큐는 다음 주에 합니다', reply: `${nickname}: 오늘 범위가 스택까지...` },
    { id: 'message-3', nickname: '부지런한 수박', role: 'student', text: '재귀랑 스택 관계가 아직 헷갈려요' },
    { id: 'message-4', nickname: '느긋한 참외', role: 'student', text: '저도요 ㅠㅠ' },
    { id: 'message-5', nickname: '강현민 교수', role: 'professor', text: '그러면 예제 하나 더 보고 갈게요. 42쪽 펴세요' },
    { id: 'message-6', nickname: '용감한 자두', role: 'student', text: '넵' },
  ]
}
