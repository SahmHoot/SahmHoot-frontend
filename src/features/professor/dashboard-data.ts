import type { ChatMessage, Question, QuestionSet, Room } from './dashboard-types'

export const demoRoom: Room = {
  name: '자료구조 3주차',
  code: '482193',
  participants: 32,
  active: true,
}

const stackQuestions: Question[] = [
  {
    id: 'stack-lifo',
    title: '스택의 LIFO 특성은?',
    type: 'multiple',
    answer: 0,
    prompt: '스택의 LIFO 특성을 가장 잘 설명한 것은?',
    options: [
      '마지막에 넣은 값이 먼저 나온다',
      '먼저 넣은 값이 먼저 나온다',
      '우선순위가 높은 값이 먼저 나온다',
      '값이 무작위로 나온다',
    ],
  },
  {
    id: 'queue-dequeue',
    title: '큐에서 dequeue 위치는?',
    type: 'multiple',
    answer: 1,
    prompt: '큐에서 dequeue 연산은 어느 위치의 원소를 제거하나요?',
    options: ['맨 뒤(rear)', '맨 앞(front)', '가운데', '임의의 위치'],
  },
  {
    id: 'recursion-stack',
    title: '재귀 호출과 스택의 관계',
    type: 'ox',
    answer: 0,
    prompt: '재귀 호출의 실행 정보는 호출 스택에 저장된다.',
    options: ['O', 'X'],
  },
  {
    id: 'circular-queue',
    title: '원형 큐를 쓰는 이유',
    type: 'multiple',
    answer: 2,
    prompt: '원형 큐를 사용하는 주된 이유는 무엇인가요?',
    options: [
      '정렬 속도를 높이기 위해',
      '재귀 호출을 없애기 위해',
      '배열의 빈 공간을 다시 사용하기 위해',
      '모든 원소를 동시에 꺼내기 위해',
    ],
  },
  {
    id: 'stack-overflow',
    title: '스택 오버플로 발생 조건',
    type: 'multiple',
    answer: 0,
    prompt: '스택 오버플로는 언제 발생하나요?',
    options: [
      '스택의 용량을 넘어 원소를 넣을 때',
      '빈 스택에서 원소를 꺼낼 때',
      '스택을 조회할 때',
      '원소의 값을 변경할 때',
    ],
  },
]

export const demoSets: QuestionSet[] = [
  {
    id: 'week-3',
    name: '3주차 스택·큐 확인문제',
    seconds: 15,
    isPublic: true,
    questions: stackQuestions,
  },
  {
    id: 'week-2',
    name: '2주차 배열·연결리스트',
    seconds: 10,
    isPublic: false,
    questions: [
      {
        id: 'array-access',
        title: '배열의 인덱스 접근',
        prompt: '배열에서 인덱스로 원소에 접근하는 시간 복잡도는?',
        type: 'multiple',
        answer: 0,
        options: ['O(1)', 'O(n)', 'O(n²)', 'O(log n)'],
      },
      {
        id: 'linked-memory',
        title: '연결리스트의 메모리',
        prompt: '연결리스트의 노드는 반드시 연속된 메모리에 저장된다.',
        type: 'ox',
        answer: 1,
        options: ['O', 'X'],
      },
      {
        id: 'linked-head',
        title: '리스트의 첫 노드',
        prompt: '연결리스트의 첫 노드를 가리키는 포인터는?',
        type: 'multiple',
        answer: 1,
        options: ['rear', 'head', 'size', 'index'],
      },
      {
        id: 'array-insert',
        title: '배열 중간 삽입',
        prompt: '배열 중간에 원소를 삽입하면 뒤쪽 원소의 이동이 필요하다.',
        type: 'ox',
        answer: 0,
        options: ['O', 'X'],
      },
    ],
  },
  {
    id: 'week-1',
    name: '1주차 복잡도 개념 점검',
    seconds: 15,
    isPublic: true,
    questions: Array.from({ length: 6 }, (_, index) => ({
      id: `complexity-${index}`,
      title: `${index + 1}번 시간 복잡도`,
      prompt: [
        '입력 크기와 관계없이 일정한 시간이 걸리는 연산은 O(1)이다.',
        'O(n) 알고리즘의 실행 시간은 입력 크기에 비례한다.',
        '이진 탐색은 정렬된 데이터에서 사용할 수 있다.',
        '중첩된 반복문은 언제나 O(1)이다.',
        '시간 복잡도는 입력 크기에 따른 연산 수의 변화를 나타낸다.',
        'O(n²)은 큰 입력에서 O(n)보다 항상 효율적이다.',
      ][index],
      type: 'ox',
      answer: [0, 0, 0, 1, 0, 1][index],
      options: ['O', 'X'],
    })),
  },
]

export const demoMessages: ChatMessage[] = [
  { id: 'message-1', author: '조용한 판다몽', text: '오늘 범위가 스택까지인가요?' },
  {
    id: 'message-2',
    author: '강현민 교수',
    text: '네, 큐는 다음 주에 합니다',
    professor: true,
    reply: '조용한 판다몽: 오늘 범위가 스택까지...',
  },
  { id: 'message-3', author: '부지런한 수박', text: '재귀랑 스택 관계가 아직 헷갈려요' },
  { id: 'message-4', author: '느긋한 참외', text: '저도요 ㅠㅠ' },
  {
    id: 'message-5',
    author: '강현민 교수',
    text: '그러면 예제 하나 더 보고 갈게요. 42쪽 펴세요',
    professor: true,
  },
  { id: 'message-6', author: '용감한 자두', text: '넵' },
]
