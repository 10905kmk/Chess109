# 변형체스 기능 설계

**날짜**: 2026-06-09  
**상태**: 승인 대기

---

## 요약

Chess109에 변형체스 모드를 추가한다. 로비에 카드 1개를 추가하고 서브메뉴에서 변형과 플레이 방식을 선택한다. 변형 로직은 chessops 기반 어댑터 레이어로 추상화하여, 향후 새 변형을 쉽게 등록할 수 있는 플러그인 구조로 설계한다.

---

## 범위

### 포함
- 변형 4종: Chess960, 3-Check, King of the Hill, Antichess
- 플레이 방식 3종: 로컬 2인, AI 대전, 온라인 친선전(방 코드)
- 향후 변형 추가를 위한 확장 가능한 어댑터 구조
- 변형별 커스텀 UI 슬롯

### 제외
- 변형체스 랭크 매칭
- 기존 표준 체스 모드 변경

---

## 기술 스택 변경

| 구성요소 | 기존 | 변경 |
|---|---|---|
| 변형 게임 로직 | — | chessops (신규 추가) |
| 변형 AI 엔진 | — | Fairy-Stockfish WASM (신규 추가) |
| 표준 체스 로직 | chess.js | 유지 |
| 표준 AI 엔진 | stockfish npm | 유지 |

---

## 아키텍처

### 핵심 원칙

- 기존 표준 체스 코드(`useChessGame`, `gameManager.js`, `AiGamePage` 등)는 **완전 무손상**
- 변형 관련 코드는 `client/src/variants/`로 완전 분리
- 새 변형 추가 = 어댑터 1개 작성 + `variants/index.js` 한 줄 등록

---

## 변형 어댑터 인터페이스

라이브러리 지원 여부와 무관하게 모든 변형이 구현해야 하는 공통 인터페이스.

```js
interface VariantEngine {
  fen(): string                     // 현재 보드 FEN
  turn(): 'w' | 'b'
  legalMoves(square): Move[]        // 해당 칸의 합법 이동 목록
  applyMove(move): MoveResult       // 이동 적용 (캡처, 특수상황 포함)
  isGameOver(): boolean
  winner(): 'w' | 'b' | 'draw' | null
  clone(): VariantEngine            // 서버/AI 탐색용 복사
  extraState(): object              // 변형별 추가 상태 (checkCount 등)
}
```

- **chessops 지원 변형** → chessops `Position`을 이 인터페이스로 래핑
- **커스텀 변형** → 이 인터페이스를 직접 구현한 클래스 작성

---

## 변형 등록 (`variants/index.js`)

```js
export const VARIANTS = [
  {
    id: 'chess960',
    label: 'Chess960',
    description: '기물 시작 위치 무작위 배치',
    engine: Chess960Adapter,
    aiType: 'fairy-stockfish',
    uciVariant: 'chess960',
    BoardOverlay: null,
    StatusExtra: null,
  },
  {
    id: 'threecheck',
    label: '3체크',
    description: '체크를 3번 하면 승리',
    engine: ThreeCheckAdapter,
    aiType: 'fairy-stockfish',
    uciVariant: 'threecheck',
    BoardOverlay: null,
    StatusExtra: ThreeCheckStatus,  // 체크 횟수 표시 컴포넌트
  },
  {
    id: 'kingofthehill',
    label: 'King of the Hill',
    description: '킹을 중앙 4칸으로 이동하면 승리',
    engine: KothAdapter,
    aiType: 'fairy-stockfish',
    uciVariant: 'kingofthehill',
    BoardOverlay: KothCenterHighlight,  // 중앙 4칸 하이라이트 오버레이
    StatusExtra: null,
  },
  {
    id: 'antichess',
    label: '안티체스',
    description: '기물을 먼저 다 잃으면 승리',
    engine: AntichessAdapter,
    aiType: 'fairy-stockfish',
    uciVariant: 'antichess',
    BoardOverlay: null,
    StatusExtra: null,
  },
]
```

향후 변형 추가 시 이 배열에 항목 하나만 추가하면 된다.

---

## AI 전략

각 변형의 `aiType`에 따라 AI 동작이 결정된다.

| aiType | 동작 |
|---|---|
| `'fairy-stockfish'` | Fairy-Stockfish WASM + `setoption UCI_Variant` |
| `'minimax'` | 어댑터 `legalMoves` / `applyMove` / `winner` 기반 깊이 3~4 미니맥스 |
| `null` | AI 모드 버튼 비활성화 ("AI 미지원" 툴팁 표시) |

**Fairy-Stockfish 초기화:**
```js
engine.postMessage(`setoption name UCI_Variant value ${uciVariant}`)
// Chess960 추가 옵션
if (uciVariant === 'chess960') engine.postMessage('setoption name UCI_Chess960 value true')
```

Fairy-Stockfish WASM 파일은 `client/public/fairy-stockfish.wasm`으로 포함한다 (CDN 미사용, 오프라인 지원).

---

## UI 플로우

```
로비
 └─ "변형체스" 카드 (보라색, ♞ 아이콘)
     └─ /variant → VariantSelectPage
          ├─ 1단계: 변형 선택 카드 (Chess960 / 3체크 / KOTH / 안티체스)
          └─ 2단계: 플레이 방식 선택 (로컬 / AI / 친선전)
               └─ AI가 null인 변형은 AI 버튼 비활성화
```

---

## 라우트

```
/variant                           → VariantSelectPage
/variant/:variantId/local          → VariantLocalPage
/variant/:variantId/ai             → VariantAiPage
/variant/:variantId/online         → VariantOnlinePage
/variant/:variantId/online/:roomId → VariantOnlinePage
```

---

## 파일 구조

```
client/src/
├── variants/
│   ├── index.js                   # 변형 등록 목록
│   ├── useVariantGame.js          # chessops 기반 게임 훅
│   ├── useFairyStockfish.js       # Fairy-Stockfish WASM 훅
│   ├── minimax.js                 # 폴백 미니맥스 AI
│   └── adapters/
│       ├── Chess960Adapter.js
│       ├── ThreeCheckAdapter.js
│       ├── KothAdapter.js
│       └── AntichessAdapter.js
├── pages/
│   ├── VariantSelectPage.jsx
│   ├── VariantLocalPage.jsx
│   ├── VariantAiPage.jsx
│   └── VariantOnlinePage.jsx
└── App.jsx                        # 라우트 4개 추가

server/src/
├── variantGameManager.js          # chessops 기반 방 관리
└── index.js                       # variant 소켓 이벤트 추가
```

---

## 커스텀 UI 슬롯

변형별 추가 UI는 두 슬롯을 통해 기본 페이지 수정 없이 주입된다.

- **`BoardOverlay`**: 보드 옆 또는 위에 렌더링 (예: KOTH 중앙 칸 하이라이트, Crazyhouse 손패)
- **`StatusExtra`**: GameStatus 컴포넌트 아래 추가 정보 (예: 3체크 카운터)

```jsx
// VariantLocalPage.jsx (예시)
const variant = VARIANTS.find(v => v.id === variantId)
...
{variant.BoardOverlay && <variant.BoardOverlay engine={engine} />}
{variant.StatusExtra && <variant.StatusExtra engine={engine} extraState={extraState} />}
```

슬롯이 `null`이면 아무것도 렌더링하지 않는다.

---

## 서버 (온라인 친선전)

기존 `gameManager.js`는 건드리지 않는다. `variantGameManager.js`를 별도로 추가한다.

**소켓 이벤트 (기존과 분리):**
```
variant:create  { token, variantId, preferredColor }
variant:join    { roomId, token }
variant:move    { roomId, from, to, promotion }
variant:reset   { roomId }
```

서버도 `chessops`를 설치하여 어댑터 기반 이동 유효성 검증을 서버 사이드에서 수행한다.

---

## 의존성 추가

**client:**
```
chessops
(Fairy-Stockfish WASM → public/ 폴더에 직접 포함)
```

**server:**
```
chessops
```
