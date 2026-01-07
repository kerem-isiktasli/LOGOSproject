/**
 * Real E2E Test - 실제로 DB에 데이터 넣고 전체 플로우 테스트
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== LOGOS Real E2E Test ===\n');

  // 1. 유저 생성
  console.log('1. Creating user...');
  const user = await prisma.user.create({
    data: {
      nativeLanguage: 'ko',
      targetLanguage: 'en',
    },
  });
  console.log(`   ✓ User created: ${user.id}`);

  // 2. Goal 생성
  console.log('\n2. Creating goal...');
  const goal = await prisma.goalSpec.create({
    data: {
      userId: user.id,
      domain: 'medical',
      modality: '["reading", "listening"]',
      genre: 'conversation',
      purpose: 'certification',
      benchmark: 'CELBAN',
    },
  });
  console.log(`   ✓ Goal created: ${goal.id}`);

  // 3. Language Objects 생성 (어휘)
  console.log('\n3. Creating language objects...');
  const words = ['diagnosis', 'prescription', 'symptom', 'treatment', 'medication'];
  const objects = [];

  for (const word of words) {
    const obj = await prisma.languageObject.create({
      data: {
        goalId: goal.id,
        type: 'LEX',
        content: word,
        frequency: Math.random(),
        relationalDensity: Math.random(),
        contextualContribution: Math.random(),
        irtDifficulty: Math.random() * 2 - 1, // -1 to 1
        priority: Math.random(),
      },
    });
    objects.push(obj);
    console.log(`   ✓ Created: ${word} (id: ${obj.id.substring(0, 8)}...)`);
  }

  // 4. Session 시작
  console.log('\n4. Starting session...');
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      goalId: goal.id,
      mode: 'learning',
      startedAt: new Date(),
    },
  });
  console.log(`   ✓ Session started: ${session.id}`);

  // 5. 응답 제출 및 마스터리 업데이트 시뮬레이션
  console.log('\n5. Submitting responses...');

  for (let i = 0; i < objects.length; i++) {
    const obj = objects[i];
    const correct = Math.random() > 0.3; // 70% 정답률

    // Response 생성
    await prisma.response.create({
      data: {
        sessionId: session.id,
        objectId: obj.id,
        correct,
        cueLevel: correct ? 0 : 1,
        responseTimeMs: Math.floor(Math.random() * 5000) + 1000,
        taskType: 'recall',
        taskFormat: 'mcq',
        modality: 'visual',
      },
    });

    // MasteryState 생성/업데이트
    const existingMastery = await prisma.masteryState.findUnique({
      where: { objectId: obj.id },
    });

    if (!existingMastery) {
      await prisma.masteryState.create({
        data: {
          objectId: obj.id,
          stage: correct ? 1 : 0,
          fsrsStability: 1.0,
          fsrsDifficulty: 5.0,
          cueFreeAccuracy: correct ? 1 : 0,
          cueAssistedAccuracy: 0,
          exposureCount: 1,
          fsrsLastReview: new Date(),
          nextReview: new Date(Date.now() + 24 * 60 * 60 * 1000),
          fsrsReps: 1,
          fsrsLapses: correct ? 0 : 1,
        },
      });
    }

    console.log(`   ${correct ? '✓' : '✗'} ${obj.content}: ${correct ? 'correct' : 'incorrect'}`);
  }

  // 6. 세션 종료
  console.log('\n6. Ending session...');
  await prisma.session.update({
    where: { id: session.id },
    data: { endedAt: new Date() },
  });
  console.log('   ✓ Session ended');

  // 7. 결과 확인
  console.log('\n7. Verifying results...');

  const responses = await prisma.response.findMany({
    where: { sessionId: session.id },
  });
  console.log(`   Total responses: ${responses.length}`);
  console.log(`   Correct: ${responses.filter(r => r.correct).length}`);

  const masteryStates = await prisma.masteryState.findMany({
    where: {
      object: { goalId: goal.id },
    },
  });
  console.log(`   Mastery states created: ${masteryStates.length}`);

  const stageDistribution = [0, 0, 0, 0, 0];
  for (const m of masteryStates) {
    stageDistribution[m.stage]++;
  }
  console.log(`   Stage distribution: ${stageDistribution}`);

  // 8. Priority 확인
  console.log('\n8. Checking priorities...');
  const objectsWithPriority = await prisma.languageObject.findMany({
    where: { goalId: goal.id },
    orderBy: { priority: 'desc' },
  });
  for (const obj of objectsWithPriority) {
    console.log(`   ${obj.content}: priority=${obj.priority.toFixed(3)}`);
  }

  console.log('\n=== E2E Test Complete ===');
  console.log('\nSummary:');
  console.log(`- User created: ✓`);
  console.log(`- Goal created: ✓`);
  console.log(`- Objects created: ${objects.length}`);
  console.log(`- Session completed: ✓`);
  console.log(`- Responses recorded: ${responses.length}`);
  console.log(`- Mastery states: ${masteryStates.length}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
