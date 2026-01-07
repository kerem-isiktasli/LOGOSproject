# index.ts — Central Export Point for Register Module

## Why This Exists

The register module exists to model **pragmatic competence** in language learning: the ability to use appropriate language for specific social contexts. This index file consolidates all register-related types, profiles, and calculators into a single import point, making it easy for other parts of LOGOS to access domain/register functionality without knowing the internal file structure.

This directly implements Gap 4.2 from the project's GAPS-AND-CONNECTIONS.md specification, addressing the need for domain and register structure in the language learning system.

## Key Concepts

- **Register**: A variety of language used in a particular social setting (e.g., academic formal, casual conversation, legal frozen)
- **RegisterProfile**: Complete definition of a register including formality level, typical words, collocations, and linguistic features
- **DomainStructure**: A collection of registers grouped by professional or contextual domain (e.g., Medical English, Business English)
- **RegisterCalculator**: Engine that computes how well words and phrases fit within specific registers
- **FormalityLevel**: Categorical scale from "frozen" (most formal) to "intimate" (least formal)

## Design Decisions

- **Barrel Export Pattern**: Uses `export { ... } from './file'` pattern to create a clean public API while hiding internal implementation details
- **Split Responsibility**: Types and static data live in `register-profile.ts`, while computational logic lives in `register-calculator.ts`
- **Type-First Exports**: Types are exported alongside their runtime counterparts, enabling strong TypeScript support for consumers
- **No Re-transformation**: Exports pass through unchanged; no additional processing or wrapping occurs here

## Integration Points

- **Consumers**: Any module needing register awareness imports from this index:
  - Content generation services (to match output register to context)
  - Assessment engines (to evaluate learner pragmatic competence)
  - Vocabulary modules (to tag words with register appropriateness)

- **Upstream Dependencies**:
  - `register-profile.ts`: Provides all type definitions, static register data, and query functions
  - `register-calculator.ts`: Provides computational analysis capabilities

- **System Role**: Acts as the **facade** for the register subsystem within the broader `core/` algorithmic layer
