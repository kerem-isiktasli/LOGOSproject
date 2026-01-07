/**
 * Algorithm Validation Test
 *
 * 실제 예상값과 비교해서 알고리즘이 "맞게" 작동하는지 검증
 */

import { FSRS, createNewCard, responseToRating, DEFAULT_WEIGHTS } from '../src/core/fsrs';
import { estimateThetaMLE, probability1PL, probability2PL } from '../src/core/irt';
import { computePriority, computeUrgency, DEFAULT_PRIORITY_WEIGHTS } from '../src/core/priority';

console.log('=== Algorithm Validation ===\n');

let passed = 0;
let failed = 0;

function test(name: string, condition: boolean, expected: string, actual: string) {
  if (condition) {
    console.log(`✓ ${name}`);
    passed++;
  } else {
    console.log(`✗ ${name}`);
    console.log(`  Expected: ${expected}`);
    console.log(`  Actual: ${actual}`);
    failed++;
  }
}

// =============================================================================
// 1. IRT Probability Functions
// =============================================================================
console.log('--- IRT Probability ---\n');

// 1PL: P(correct) = 1 / (1 + exp(-(theta - b)))
// When theta = b, P = 0.5
const p1 = probability1PL(0, 0);
test('1PL: theta=0, b=0 → P=0.5',
  Math.abs(p1 - 0.5) < 0.001,
  '0.5',
  p1.toFixed(4)
);

// When theta > b, P > 0.5
const p2 = probability1PL(1, 0);
test('1PL: theta=1, b=0 → P>0.5 (약 0.73)',
  p2 > 0.5 && p2 < 0.8,
  '~0.73',
  p2.toFixed(4)
);

// When theta < b, P < 0.5
const p3 = probability1PL(-1, 0);
test('1PL: theta=-1, b=0 → P<0.5 (약 0.27)',
  p3 < 0.5 && p3 > 0.2,
  '~0.27',
  p3.toFixed(4)
);

// 2PL: Higher discrimination = steeper curve
const p4_low_a = probability2PL(0.5, { b: 0, a: 0.5 });
const p4_high_a = probability2PL(0.5, { b: 0, a: 2.0 });
test('2PL: Higher discrimination → more extreme P',
  p4_high_a > p4_low_a,
  'P(a=2.0) > P(a=0.5)',
  `P(a=2.0)=${p4_high_a.toFixed(3)}, P(a=0.5)=${p4_low_a.toFixed(3)}`
);

// =============================================================================
// 2. IRT Theta Estimation (MLE)
// =============================================================================
console.log('\n--- IRT Theta Estimation ---\n');

// All correct → positive theta
const items1 = [
  { id: '1', a: 1, b: 0 },
  { id: '2', a: 1, b: 0 },
  { id: '3', a: 1, b: 0 },
];
const est1 = estimateThetaMLE([true, true, true], items1);
test('All correct (b=0) → positive theta',
  est1.theta > 0,
  'theta > 0',
  `theta=${est1.theta.toFixed(3)}`
);

// All incorrect → negative theta
const est2 = estimateThetaMLE([false, false, false], items1);
test('All incorrect (b=0) → negative theta',
  est2.theta < 0,
  'theta < 0',
  `theta=${est2.theta.toFixed(3)}`
);

// Mixed responses on items with varying difficulty
const items2 = [
  { id: 'easy', a: 1, b: -1 },
  { id: 'medium', a: 1, b: 0 },
  { id: 'hard', a: 1, b: 1 },
];
// Easy correct, medium correct, hard incorrect → theta between 0 and 1
const est3 = estimateThetaMLE([true, true, false], items2);
test('Easy+Medium correct, Hard incorrect → theta ≈ 0.5',
  est3.theta > 0 && est3.theta < 1.5,
  '0 < theta < 1.5',
  `theta=${est3.theta.toFixed(3)}`
);

// =============================================================================
// 3. FSRS Scheduling
// =============================================================================
console.log('\n--- FSRS Scheduling ---\n');

const fsrs = new FSRS();

// Initial stability depends on rating
const card1 = fsrs.schedule(createNewCard(), 1, new Date()); // Again
const card3 = fsrs.schedule(createNewCard(), 3, new Date()); // Good
const card4 = fsrs.schedule(createNewCard(), 4, new Date()); // Easy

test('Initial stability: Again < Good < Easy',
  card1.stability < card3.stability && card3.stability < card4.stability,
  'S(Again) < S(Good) < S(Easy)',
  `S(Again)=${card1.stability.toFixed(2)}, S(Good)=${card3.stability.toFixed(2)}, S(Easy)=${card4.stability.toFixed(2)}`
);

// Verify against FSRS-4 formula: S0 = w[rating-1]
test('Initial stability matches w[rating-1]',
  Math.abs(card1.stability - DEFAULT_WEIGHTS[0]) < 0.01 &&
  Math.abs(card3.stability - DEFAULT_WEIGHTS[2]) < 0.01 &&
  Math.abs(card4.stability - DEFAULT_WEIGHTS[3]) < 0.01,
  `w[0]=${DEFAULT_WEIGHTS[0]}, w[2]=${DEFAULT_WEIGHTS[2]}, w[3]=${DEFAULT_WEIGHTS[3]}`,
  `S(1)=${card1.stability}, S(3)=${card3.stability}, S(4)=${card4.stability}`
);

// After successful review, stability should increase
const now = new Date();
const reviewedCard = fsrs.schedule(createNewCard(), 3, now);
const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
const afterReview = fsrs.schedule(reviewedCard, 3, tomorrow);

test('After Good review, stability increases',
  afterReview.stability > reviewedCard.stability,
  'S_new > S_old',
  `S_old=${reviewedCard.stability.toFixed(2)}, S_new=${afterReview.stability.toFixed(2)}`
);

// After lapse (Again), stability should decrease
const afterLapse = fsrs.schedule(reviewedCard, 1, tomorrow);
test('After lapse (Again), stability decreases',
  afterLapse.stability < reviewedCard.stability,
  'S_lapse < S_old',
  `S_old=${reviewedCard.stability.toFixed(2)}, S_lapse=${afterLapse.stability.toFixed(2)}`
);

// Retrievability decay
const cardForRetrieval = fsrs.schedule(createNewCard(), 3, now);
const r_now = fsrs.retrievability(cardForRetrieval, now);
const oneDay = new Date(now.getTime() + 24 * 60 * 60 * 1000);
const r_1day = fsrs.retrievability(cardForRetrieval, oneDay);
const oneWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
const r_1week = fsrs.retrievability(cardForRetrieval, oneWeek);

test('Retrievability decays over time: R(now) > R(1day) > R(1week)',
  r_now > r_1day && r_1day > r_1week,
  'R(now) > R(1day) > R(1week)',
  `R(now)=${r_now.toFixed(3)}, R(1day)=${r_1day.toFixed(3)}, R(1week)=${r_1week.toFixed(3)}`
);

// =============================================================================
// 4. Priority Calculation
// =============================================================================
console.log('\n--- Priority Calculation ---\n');

const userState = {
  theta: 0,
  weights: DEFAULT_PRIORITY_WEIGHTS,
};

// Higher frequency → higher priority (more useful word)
const lowFreq = computePriority({ id: '1', content: 'test', type: 'LEX', frequency: 0.2, relationalDensity: 0.5, contextualContribution: 0.5, irtDifficulty: 0 }, userState);
const highFreq = computePriority({ id: '2', content: 'test', type: 'LEX', frequency: 0.8, relationalDensity: 0.5, contextualContribution: 0.5, irtDifficulty: 0 }, userState);

test('Higher frequency → higher priority',
  highFreq > lowFreq,
  'P(freq=0.8) > P(freq=0.2)',
  `P(freq=0.2)=${lowFreq.toFixed(3)}, P(freq=0.8)=${highFreq.toFixed(3)}`
);

// Difficulty near theta → higher priority (optimal challenge)
const easyItem = computePriority({ id: '1', content: 'test', type: 'LEX', frequency: 0.5, relationalDensity: 0.5, contextualContribution: 0.5, irtDifficulty: -2 }, userState);
const matchedItem = computePriority({ id: '2', content: 'test', type: 'LEX', frequency: 0.5, relationalDensity: 0.5, contextualContribution: 0.5, irtDifficulty: 0 }, userState);
const hardItem = computePriority({ id: '3', content: 'test', type: 'LEX', frequency: 0.5, relationalDensity: 0.5, contextualContribution: 0.5, irtDifficulty: 2 }, userState);

test('Difficulty matched to theta → highest priority',
  matchedItem >= easyItem && matchedItem >= hardItem,
  'P(b=theta) >= P(b far from theta)',
  `P(b=-2)=${easyItem.toFixed(3)}, P(b=0)=${matchedItem.toFixed(3)}, P(b=2)=${hardItem.toFixed(3)}`
);

// Urgency: overdue items have higher urgency
const pastDue = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 1 week ago
const futureDue = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 1 week from now

const urgencyPast = computeUrgency(pastDue, new Date());
const urgencyFuture = computeUrgency(futureDue, new Date());

test('Overdue items have higher urgency',
  urgencyPast > urgencyFuture,
  'U(overdue) > U(future)',
  `U(overdue)=${urgencyPast.toFixed(3)}, U(future)=${urgencyFuture.toFixed(3)}`
);

// =============================================================================
// 5. Rating Conversion
// =============================================================================
console.log('\n--- Rating Conversion ---\n');

const r1 = responseToRating({ correct: false, cueLevel: 0, responseTimeMs: 3000 });
test('Incorrect → Rating 1 (Again)',
  r1 === 1,
  '1',
  String(r1)
);

const r2 = responseToRating({ correct: true, cueLevel: 2, responseTimeMs: 3000 });
test('Correct with cue → Rating 2 (Hard)',
  r2 === 2,
  '2',
  String(r2)
);

const r3 = responseToRating({ correct: true, cueLevel: 0, responseTimeMs: 6000 });
test('Correct, cue-free, slow → Rating 3 (Good)',
  r3 === 3,
  '3',
  String(r3)
);

const r4 = responseToRating({ correct: true, cueLevel: 0, responseTimeMs: 2000 });
test('Correct, cue-free, fast → Rating 4 (Easy)',
  r4 === 4,
  '4',
  String(r4)
);

// =============================================================================
// Summary
// =============================================================================
console.log('\n=== Summary ===\n');
console.log(`Passed: ${passed}/${passed + failed}`);
console.log(`Failed: ${failed}/${passed + failed}`);

if (failed > 0) {
  console.log('\n⚠️  Some tests failed - algorithms may have issues');
  process.exit(1);
} else {
  console.log('\n✓ All algorithms validated correctly');
}
