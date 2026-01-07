/**
 * Real IPC Handler Test - 실제 IPC 핸들러 로직 테스트
 *
 * session:submit-response의 실제 로직을 그대로 복사해서
 * FSRS, IRT, Priority 계산이 실제로 작동하는지 검증
 */

import { PrismaClient } from '@prisma/client';
import { FSRS, createNewCard, responseToRating } from '../src/core/fsrs';
import { estimateThetaMLE } from '../src/core/irt';
import { computePriority, computeUrgency, DEFAULT_PRIORITY_WEIGHTS } from '../src/core/priority';

const prisma = new PrismaClient();
const fsrs = new FSRS();

async function main() {
  console.log('=== Real IPC Logic Test ===\n');

  // Setup
  const user = await prisma.user.create({
    data: { nativeLanguage: 'ko', targetLanguage: 'en' },
  });

  const goal = await prisma.goalSpec.create({
    data: {
      userId: user.id,
      domain: 'medical',
      modality: '["reading"]',
      genre: 'conversation',
      purpose: 'certification',
    },
  });

  // 10 words with varying IRT difficulty
  const words = [
    { content: 'diagnosis', difficulty: -0.5 },
    { content: 'prescription', difficulty: 0.0 },
    { content: 'symptom', difficulty: 0.5 },
    { content: 'treatment', difficulty: 1.0 },
    { content: 'medication', difficulty: -1.0 },
    { content: 'prognosis', difficulty: 1.5 },
    { content: 'chronic', difficulty: 0.2 },
    { content: 'acute', difficulty: 0.3 },
    { content: 'benign', difficulty: 0.8 },
    { content: 'malignant', difficulty: 1.2 },
  ];

  const objects = [];
  for (const w of words) {
    const obj = await prisma.languageObject.create({
      data: {
        goalId: goal.id,
        type: 'LEX',
        content: w.content,
        frequency: Math.random(),
        relationalDensity: Math.random(),
        contextualContribution: Math.random(),
        irtDifficulty: w.difficulty,
        irtDiscrimination: 1.0,
        priority: 0.5,
      },
    });
    objects.push(obj);
  }

  const session = await prisma.session.create({
    data: {
      userId: user.id,
      goalId: goal.id,
      mode: 'learning',
      startedAt: new Date(),
    },
  });

  console.log('Setup complete.\n');

  // 3 rounds of practice
  for (let round = 0; round < 3; round++) {
    console.log('--- Round ' + (round + 1) + ' ---');

    for (const obj of objects) {
      // IRT-based probability of correct response
      const userTheta = (await prisma.user.findUnique({ where: { id: user.id } }))?.thetaGlobal ?? 0;
      const probCorrect = 1 / (1 + Math.exp(-(userTheta - obj.irtDifficulty)));
      const correct = Math.random() < probCorrect;
      const cueLevel = correct ? 0 : 1;
      const responseTimeMs = Math.floor(Math.random() * 4000) + 1000;

      // === ACTUAL session:submit-response LOGIC ===

      let mastery = await prisma.masteryState.findUnique({
        where: { objectId: obj.id },
      });

      const now = new Date();
      const rating = responseToRating({ correct, cueLevel, responseTimeMs });

      if (!mastery) {
        const newCard = createNewCard();
        const updatedCard = fsrs.schedule(newCard, rating, now);

        mastery = await prisma.masteryState.create({
          data: {
            objectId: obj.id,
            stage: correct ? 1 : 0,
            fsrsStability: updatedCard.stability,
            fsrsDifficulty: updatedCard.difficulty,
            cueFreeAccuracy: cueLevel === 0 ? (correct ? 1 : 0) : 0,
            cueAssistedAccuracy: cueLevel > 0 ? (correct ? 1 : 0) : 0,
            exposureCount: 1,
            fsrsLastReview: now,
            nextReview: fsrs.nextReviewDate(updatedCard),
            fsrsReps: 1,
            fsrsLapses: correct ? 0 : 1,
          },
        });
      } else {
        const existingCard = {
          difficulty: mastery.fsrsDifficulty,
          stability: mastery.fsrsStability,
          lastReview: mastery.fsrsLastReview,
          reps: mastery.fsrsReps,
          lapses: mastery.fsrsLapses,
          state: mastery.fsrsReps === 0 ? 'new' as const : 'review' as const,
        };

        const updatedCard = fsrs.schedule(existingCard, rating, now);

        const weight = 1 / (mastery.exposureCount * 0.3 + 1);
        let newCueFreeAccuracy = mastery.cueFreeAccuracy;
        let newCueAssistedAccuracy = mastery.cueAssistedAccuracy;

        if (cueLevel === 0) {
          newCueFreeAccuracy = (1 - weight) * mastery.cueFreeAccuracy + weight * (correct ? 1 : 0);
        } else {
          newCueAssistedAccuracy = (1 - 0.2) * mastery.cueAssistedAccuracy + 0.2 * (correct ? 1 : 0);
        }

        const gap = newCueAssistedAccuracy - newCueFreeAccuracy;
        let newStage = mastery.stage;

        if (newCueFreeAccuracy >= 0.9 && updatedCard.stability > 30 && gap < 0.1) {
          newStage = 4;
        } else if (newCueFreeAccuracy >= 0.75 && updatedCard.stability > 7) {
          newStage = 3;
        } else if (newCueFreeAccuracy >= 0.6 || newCueAssistedAccuracy >= 0.8) {
          newStage = 2;
        } else if (newCueAssistedAccuracy >= 0.5) {
          newStage = 1;
        }

        mastery = await prisma.masteryState.update({
          where: { objectId: obj.id },
          data: {
            stage: newStage,
            fsrsStability: updatedCard.stability,
            fsrsDifficulty: updatedCard.difficulty,
            cueFreeAccuracy: newCueFreeAccuracy,
            cueAssistedAccuracy: newCueAssistedAccuracy,
            exposureCount: mastery.exposureCount + 1,
            fsrsLastReview: now,
            nextReview: fsrs.nextReviewDate(updatedCard),
            fsrsReps: updatedCard.reps,
            fsrsLapses: updatedCard.lapses,
          },
        });
      }

      await prisma.response.create({
        data: {
          sessionId: session.id,
          objectId: obj.id,
          correct,
          cueLevel,
          responseTimeMs,
          taskType: 'recall',
          taskFormat: 'mcq',
          modality: 'visual',
        },
      });

      console.log('  ' + obj.content + ': ' + (correct ? 'O' : 'X') + ' (stage=' + mastery.stage + ', stability=' + mastery.fsrsStability.toFixed(2) + ')');
    }

    // Update theta after each round
    const allResponses = await prisma.response.findMany({
      where: { sessionId: session.id },
      include: { object: true },
    });

    if (allResponses.length >= 10) {
      const items = allResponses.map(r => ({
        id: r.objectId,
        a: r.object.irtDiscrimination ?? 1.0,
        b: r.object.irtDifficulty,
      }));
      const responseArray = allResponses.map(r => r.correct);
      const estimate = estimateThetaMLE(responseArray, items);

      await prisma.user.update({
        where: { id: user.id },
        data: { thetaGlobal: estimate.theta },
      });

      console.log('  -> Theta updated: ' + estimate.theta.toFixed(3));
    }
  }

  // Recalculate priorities
  console.log('\n--- Priority Recalculation ---');
  const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });
  const userState = {
    theta: updatedUser?.thetaGlobal ?? 0,
    weights: DEFAULT_PRIORITY_WEIGHTS,
  };

  for (const obj of objects) {
    const mastery = await prisma.masteryState.findUnique({ where: { objectId: obj.id } });

    const langObj = {
      id: obj.id,
      content: obj.content,
      type: obj.type,
      frequency: obj.frequency,
      relationalDensity: obj.relationalDensity,
      contextualContribution: obj.contextualContribution,
      irtDifficulty: obj.irtDifficulty,
    };

    const basePriority = computePriority(langObj, userState);
    const urgency = mastery ? computeUrgency(mastery.nextReview, new Date()) : 0;
    const finalPriority = basePriority * (1 + urgency);

    await prisma.languageObject.update({
      where: { id: obj.id },
      data: { priority: finalPriority },
    });
  }

  // Final results
  console.log('\n=== FINAL RESULTS ===\n');

  const finalObjects = await prisma.languageObject.findMany({
    where: { goalId: goal.id },
    include: { masteryState: true },
    orderBy: { priority: 'desc' },
  });

  console.log('Word               | Stage | Stability | CueFree% | Priority');
  console.log('-------------------|-------|-----------|----------|----------');
  for (const obj of finalObjects) {
    const m = obj.masteryState;
    const stage = m?.stage ?? 0;
    const stability = (m?.fsrsStability ?? 0).toFixed(2).padStart(9);
    const cueFree = ((m?.cueFreeAccuracy ?? 0) * 100).toFixed(0).padStart(7);
    const priority = obj.priority.toFixed(3);
    console.log(obj.content.padEnd(18) + ' | ' + stage + '     | ' + stability + ' | ' + cueFree + '% | ' + priority);
  }

  const stageDistribution = [0, 0, 0, 0, 0];
  for (const obj of finalObjects) {
    stageDistribution[obj.masteryState?.stage ?? 0]++;
  }

  const totalResponses = await prisma.response.count({ where: { sessionId: session.id } });
  const correctResponses = await prisma.response.count({ where: { sessionId: session.id, correct: true } });

  console.log('\nStage distribution: [' + stageDistribution.join(', ') + ']');
  console.log('Final theta: ' + (updatedUser?.thetaGlobal ?? 0).toFixed(3));
  console.log('Total responses: ' + totalResponses);
  console.log('Accuracy: ' + (correctResponses / totalResponses * 100).toFixed(1) + '%');

  // Cleanup
  await prisma.response.deleteMany({ where: { sessionId: session.id } });
  await prisma.session.delete({ where: { id: session.id } });
  await prisma.masteryState.deleteMany({ where: { object: { goalId: goal.id } } });
  await prisma.languageObject.deleteMany({ where: { goalId: goal.id } });
  await prisma.goalSpec.delete({ where: { id: goal.id } });
  await prisma.user.delete({ where: { id: user.id } });

  console.log('\nTest complete and cleaned up');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
