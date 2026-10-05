// 두벌식 자판 기준으로 한글을 같은 자리의 영문 키로 변환 (예: "한" → "gks")

const HANGUL_BASE = 0xac00;
const HANGUL_LAST = 0xd7a3;
const JAMO_BASE = 0x3131;

// 초성 19자
const CHOSEONG = [
  "r", "R", "s", "e", "E", "f", "a", "q", "Q", "t",
  "T", "d", "w", "W", "c", "z", "x", "v", "g",
];

// 중성 21자
const JUNGSEONG = [
  "k", "o", "i", "O", "j", "p", "u", "P", "h", "hk",
  "ho", "hl", "y", "n", "nj", "np", "nl", "b", "m", "ml",
  "l",
];

// 종성 28자 (첫 칸은 받침 없음)
const JONGSEONG = [
  "", "r", "R", "rt", "s", "sw", "sg", "e", "f", "fr",
  "fa", "fq", "ft", "fx", "fv", "fg", "a", "q", "qt", "t",
  "T", "d", "w", "c", "z", "x", "v", "g",
];

// 호환용 자모 ㄱ(U+3131) ~ ㅣ(U+3163)
const JAMO = [
  "r", "R", "rt", "s", "sw", "sg", "e", "E", "f", "fr",
  "fa", "fq", "ft", "fx", "fv", "fg", "a", "q", "Q", "qt",
  "t", "T", "d", "w", "W", "c", "z", "x", "v", "g",
  "k", "o", "i", "O", "j", "p", "u", "P", "h", "hk",
  "ho", "hl", "y", "n", "nj", "np", "nl", "b", "m", "ml",
  "l",
];

export function hangulToQwerty(text: string): string {
  let result = "";

  for (const char of text) {
    const code = char.charCodeAt(0);

    if (code >= HANGUL_BASE && code <= HANGUL_LAST) {
      const offset = code - HANGUL_BASE;
      result +=
        CHOSEONG[Math.floor(offset / 588)] +
        JUNGSEONG[Math.floor((offset % 588) / 28)] +
        JONGSEONG[offset % 28];
    } else if (code >= JAMO_BASE && code < JAMO_BASE + JAMO.length) {
      result += JAMO[code - JAMO_BASE];
    } else {
      result += char;
    }
  }

  return result;
}
