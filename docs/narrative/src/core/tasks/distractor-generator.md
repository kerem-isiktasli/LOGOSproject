# distractor-generator.ts — Plausible Wrong Answers for MCQs

## Why This Exists

Multiple-choice questions are only effective if the wrong options (distractors) are believably wrong. Random incorrect answers let learners eliminate by guessing; well-crafted distractors force genuine knowledge retrieval. This module generates plausible but incorrect options using linguistic relationships (phonological similarity, semantic relatedness, morphological variants, L1 interference patterns) rather than random selection.

The pedagogical insight: if a learner picks a distractor, the *type* of distractor they chose reveals what they misunderstand, enabling targeted feedback.

## Key Concepts

- **DistractorStrategy**: Seven generation approaches ordered by pedagogical value:
  - `phonological_similar` — words that sound alike ("affect/effect")
  - `orthographic_similar` — words spelled similarly (Levenshtein distance)
  - `semantic_related` — same conceptual field ("chair/table")
  - `morphological_variant` — different forms of same root ("run/running")
  - `common_confusion` — known L1 interference patterns
  - `random_same_pos` — fallback using part-of-speech matching
  - `translation_false_friend` — cognates with different meanings across languages

- **Plausibility Score (0-1)**: How likely a learner might choose this distractor. Higher scores make harder questions. The system targets difficulty by tuning this threshold.

- **DistractorConfig**: Controls generation behavior including count, minimum plausibility, preferred strategies, L1 for interference patterns, and words to exclude (prevents duplicates).

- **False Friends Database**: Built-in dictionary mapping English words to misleading cognates in Spanish, Portuguese, French, German, Italian, Japanese, and Mandarin. Example: "library" maps to Spanish "libreria" which actually means "bookstore."

## Design Decisions

**Strategy Ordering Over Random Selection**: The generator tries strategies in preference order rather than randomly mixing. Semantic and morphological distractors teach more than phonological ones, so they come first.

**Fallback Chain**: If preferred strategies cannot produce enough distractors (sparse vocabulary, no semantic groups loaded), the system falls back gracefully: first to random same-POS words, then to length-similar words, finally to synthetic letter-substitution variants.

**Quality Score Calculation**: Combines average plausibility, strategy diversity (using multiple strategies is better), and meeting the target count. This helps task generators assess whether the distractor set is pedagogically sound.

**L1-Specific Confusion Pairs**: Rather than generic wrong answers, the system knows that Spanish speakers confuse "make/do" and Mandarin speakers confuse "he/she" (no gendered pronouns in Mandarin). This converts common errors into learning opportunities.

**Explanation Field**: Every distractor includes a human-readable explanation of why it is wrong. This powers the feedback system when learners select incorrect answers.

## Integration Points

- **LanguageObject** (`src/core/types.ts`): Target items come from the unified language object model with their frequency, domain distribution, and phonological difficulty metadata.

- **ComponentType** (`src/core/types.ts`): The `componentFocus` config parameter aligns distractors with the linguistic component being tested (phonological distractors for pronunciation tasks, morphological for conjugation tasks).

- **Task Generation Pipeline**: The constraint solver (`task-constraint-solver.ts`) selects target objects; this module generates their distractors. Tasks requiring distractors (`needsDistractors: true` in `traditional-task-types.ts`) invoke this module.

- **Vocabulary Loading**: Requires pre-loaded vocabulary via `loadVocabulary()` for corpus-based strategies. Semantic groups and morphological families can be loaded separately for richer distractor generation.

- **Feedback System**: The `explanation` field on each distractor integrates with learner feedback rendering to explain *why* their choice was wrong.
