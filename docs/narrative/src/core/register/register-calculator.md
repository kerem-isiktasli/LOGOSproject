# register-calculator.ts — Register Appropriateness Analysis Engine

## Why This Exists

Language learners often struggle with **register mismatch**: using casual slang in a business email, or overly formal language with friends. This calculator provides the computational backbone to detect and score such mismatches. It answers questions like "Is this word appropriate for academic writing?" or "What register does this text belong to?"

The module enables LOGOS to give learners feedback on pragmatic appropriateness, not just grammatical correctness. A sentence can be grammatically perfect yet socially awkward; this calculator catches that.

## Key Concepts

- **RegisterFitResult**: The output of analyzing a single word against a target register. Contains an appropriateness score (0-1), component breakdowns (formality fit, genre fit, collocation fit, frequency fit), reasoning, and suggested alternatives when fit is poor.

- **WordRegisterDistribution**: Maps a word to its probability of belonging to each register. Reveals whether a word is register-specific (e.g., "herein" is strongly legal) or register-neutral (e.g., "the" works everywhere).

- **RegisterTransferAnalysis**: Analyzes what happens when vocabulary moves between registers. Identifies transferable words, words needing adaptation, and words to avoid. Critical for teaching learners to "code-switch."

- **TextRegisterAnalysis**: Whole-text analysis that detects the dominant register, identifies violations (words that don't fit the detected register), and measures consistency.

- **Formality Estimation**: Heuristic system that estimates word formality based on morphological features (length, suffixes like "-tion"/"-ment", contractions).

## Design Decisions

- **Multi-Component Scoring**: The 100-point scoring system breaks into four components:
  - Formality fit (0-40 points): Does word formality match register formality?
  - Genre fit (0-25 points): Is this word typical or common in this register?
  - Collocation fit (0-20 points): Does the word have register-specific collocations?
  - Frequency fit (0-15 points): How often does this word appear in this register?

  This decomposition allows nuanced feedback ("Your word choice is formally appropriate but genre-atypical").

- **Threshold at 0.5**: Words scoring below 50% appropriateness are flagged as inappropriate. This balanced threshold catches clear mismatches while tolerating borderline cases.

- **Caching Strategy**: `wordRegisterCache` memoizes distribution calculations because the same words appear repeatedly during text analysis. Cache is explicitly clearable for long-running sessions.

- **Heuristic Formality Estimation**: Rather than requiring a complete lexical database, formality is estimated from word features (length, morphology). This is imperfect but scales without external dependencies.

- **Class + Factory Functions**: Provides both `RegisterCalculator` class for stateful usage and `createRegisterCalculator()` factory plus standalone functions (`computeRegisterAppropriatenessScore`, `detectTextRegister`) for convenience.

## Integration Points

- **Direct Dependencies**:
  - `register-profile.ts`: Provides `REGISTER_PROFILES`, `findClosestRegister()`, `calculateFormalityDistance()`
  - `../types`: Imports `LanguageObject` type (though currently unused in visible code)

- **Consumers**:
  - Content generation systems: Verify generated content matches target register
  - Assessment modules: Score learner output for pragmatic competence
  - Writing assistance tools: Suggest register-appropriate alternatives
  - Text analysis features: Detect and report register of input text

- **System Role**: This is the **computational engine** of the register subsystem. Where `register-profile.ts` provides static data, this module provides dynamic analysis.
