/**
 * LOGOS Database Seed Script
 *
 * Creates initial data for testing and development.
 * Run with: npm run db:seed
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Sample medical vocabulary for CELBAN preparation
const MEDICAL_VOCABULARY = [
  { content: 'administer', frequency: 0.89, relational: 0.76, contextual: 0.82, difficulty: -0.5, definition: 'To give medication or treatment to a patient' },
  { content: 'assess', frequency: 0.91, relational: 0.68, contextual: 0.79, difficulty: -0.3, definition: 'To evaluate or judge the condition of a patient' },
  { content: 'contraindication', frequency: 0.67, relational: 0.45, contextual: 0.91, difficulty: 0.8, definition: 'A condition that makes a treatment inadvisable' },
  { content: 'bilateral', frequency: 0.58, relational: 0.52, contextual: 0.74, difficulty: 0.3, definition: 'Affecting both sides of the body' },
  { content: 'catheterize', frequency: 0.42, relational: 0.38, contextual: 0.85, difficulty: 0.6, definition: 'To insert a catheter into the body' },
  { content: 'auscultate', frequency: 0.35, relational: 0.41, contextual: 0.88, difficulty: 0.9, definition: 'To listen to internal body sounds with a stethoscope' },
  { content: 'prognosis', frequency: 0.71, relational: 0.55, contextual: 0.77, difficulty: 0.2, definition: 'The likely course of a disease or condition' },
  { content: 'symptom', frequency: 0.94, relational: 0.82, contextual: 0.71, difficulty: -0.7, definition: 'A physical or mental sign of a condition' },
  { content: 'diagnosis', frequency: 0.92, relational: 0.79, contextual: 0.83, difficulty: -0.4, definition: 'Identification of a disease from symptoms' },
  { content: 'prescription', frequency: 0.88, relational: 0.71, contextual: 0.76, difficulty: -0.2, definition: 'A written order for medication' },
  { content: 'triage', frequency: 0.65, relational: 0.48, contextual: 0.92, difficulty: 0.5, definition: 'Sorting patients by urgency of treatment' },
  { content: 'vital signs', frequency: 0.93, relational: 0.85, contextual: 0.69, difficulty: -0.6, definition: 'Basic body measurements like pulse and temperature' },
  { content: 'edema', frequency: 0.54, relational: 0.43, contextual: 0.81, difficulty: 0.4, definition: 'Swelling caused by fluid accumulation' },
  { content: 'hemorrhage', frequency: 0.48, relational: 0.39, contextual: 0.89, difficulty: 0.7, definition: 'Severe bleeding' },
  { content: 'anaphylaxis', frequency: 0.31, relational: 0.35, contextual: 0.95, difficulty: 1.2, definition: 'Severe allergic reaction' },
  { content: 'intubate', frequency: 0.38, relational: 0.42, contextual: 0.87, difficulty: 0.8, definition: 'To insert a tube into the airway' },
  { content: 'monitor', frequency: 0.95, relational: 0.88, contextual: 0.65, difficulty: -0.8, definition: 'To observe and track patient condition' },
  { content: 'discharge', frequency: 0.82, relational: 0.67, contextual: 0.72, difficulty: -0.1, definition: 'To release a patient from care' },
  { content: 'chronic', frequency: 0.79, relational: 0.61, contextual: 0.78, difficulty: 0.1, definition: 'Long-lasting or recurring condition' },
  { content: 'acute', frequency: 0.81, relational: 0.63, contextual: 0.80, difficulty: 0.0, definition: 'Sudden and severe condition' },
];

// Collocations (word pairs with PMI scores)
const COLLOCATIONS = [
  { word1: 'administer', word2: 'medication', pmi: 2.8, cooccurrence: 1250 },
  { word1: 'administer', word2: 'dosage', pmi: 2.5, cooccurrence: 890 },
  { word1: 'assess', word2: 'patient', pmi: 2.3, cooccurrence: 2100 },
  { word1: 'vital signs', word2: 'monitor', pmi: 3.2, cooccurrence: 1800 },
  { word1: 'bilateral', word2: 'edema', pmi: 2.1, cooccurrence: 450 },
  { word1: 'chronic', word2: 'symptom', pmi: 2.6, cooccurrence: 1800 },
  { word1: 'acute', word2: 'symptom', pmi: 2.4, cooccurrence: 920 },
];

async function main() {
  console.log('Starting LOGOS database seed...');

  // Create test user
  const user = await prisma.user.upsert({
    where: { id: 'test-user-1' },
    update: {},
    create: {
      id: 'test-user-1',
      nativeLanguage: 'pt-BR',
      targetLanguage: 'en-US',
      thetaGlobal: 0,
      thetaPhonology: 0,
      thetaMorphology: 0,
      thetaLexical: 0,
      thetaSyntactic: 0,
      thetaPragmatic: 0,
    },
  });
  console.log(`Created user: ${user.id}`);

  // Create CELBAN goal
  const goal = await prisma.goalSpec.upsert({
    where: { id: 'celban-goal-1' },
    update: {},
    create: {
      id: 'celban-goal-1',
      userId: user.id,
      domain: 'medical',
      modality: JSON.stringify(['reading', 'listening']),
      genre: 'professional',
      purpose: 'certification',
      benchmark: 'CELBAN',
      deadline: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000), // 4 months
      completionPercent: 0,
      isActive: true,
    },
  });
  console.log(`Created goal: ${goal.id}`);

  // Create language objects
  const objectMap = new Map();

  for (const vocab of MEDICAL_VOCABULARY) {
    const objId = `obj-${vocab.content.replace(/\s+/g, '-')}`;
    const priority = vocab.frequency * vocab.relational * vocab.contextual;

    const obj = await prisma.languageObject.upsert({
      where: { id: objId },
      update: {},
      create: {
        id: objId,
        goalId: goal.id,
        type: 'LEX',
        content: vocab.content,
        contentJson: JSON.stringify({ definition: vocab.definition }),
        frequency: vocab.frequency,
        relationalDensity: vocab.relational,
        contextualContribution: vocab.contextual,
        irtDifficulty: vocab.difficulty,
        irtDiscrimination: 1.0,
        priority: priority,
        domainDistribution: JSON.stringify({ medical: 0.9, general: 0.1 }),
        morphologicalScore: Math.random() * 0.5 + 0.3,
        phonologicalDifficulty: Math.random() * 0.4 + 0.2,
      },
    });
    objectMap.set(vocab.content, obj.id);

    // Create mastery state
    await prisma.masteryState.upsert({
      where: { objectId: obj.id },
      update: {},
      create: {
        objectId: obj.id,
        stage: 0,
        fsrsDifficulty: 5,
        fsrsStability: 0,
        fsrsReps: 0,
        fsrsLapses: 0,
        fsrsState: 'new',
        cueFreeAccuracy: 0,
        cueAssistedAccuracy: 0,
        exposureCount: 0,
        priority: priority,
      },
    });
  }
  console.log(`Created ${MEDICAL_VOCABULARY.length} language objects with mastery states`);

  // Create collocations
  let collocationCount = 0;
  for (const coll of COLLOCATIONS) {
    const word1Id = objectMap.get(coll.word1);
    const word2Id = objectMap.get(coll.word2);

    // Skip if either word doesn't exist in our vocabulary
    if (!word1Id || !word2Id) continue;

    await prisma.collocation.upsert({
      where: {
        word1Id_word2Id: { word1Id, word2Id }
      },
      update: {},
      create: {
        word1Id,
        word2Id,
        pmi: coll.pmi,
        npmi: coll.pmi / Math.log(coll.cooccurrence),
        cooccurrence: coll.cooccurrence,
        significance: coll.pmi > 2 ? 0.95 : 0.8,
      },
    });
    collocationCount++;
  }
  console.log(`Created ${collocationCount} collocations`);

  // Create a sample session
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      goalId: goal.id,
      mode: 'learning',
      itemsPracticed: 0,
      stageTransitions: 0,
      fluencyTaskCount: 0,
      versatilityTaskCount: 0,
    },
  });
  console.log(`Created sample session: ${session.id}`);

  // Create theta snapshot
  await prisma.thetaSnapshot.create({
    data: {
      sessionId: session.id,
      thetaGlobal: 0,
      thetaPhonology: 0,
      thetaMorphology: 0,
      thetaLexical: 0,
      thetaSyntactic: 0,
      thetaPragmatic: 0,
      seGlobal: 1.0,
    },
  });

  console.log('Seed completed successfully!');
  console.log(`
Summary:
- 1 User (Brazilian nurse preparing for CELBAN)
- 1 Goal (CELBAN certification, 4 months)
- ${MEDICAL_VOCABULARY.length} Language Objects (medical vocabulary)
- ${collocationCount} Collocations
- 1 Sample Session
  `);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
