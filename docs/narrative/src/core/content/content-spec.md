# content-spec.ts — Specification contract for content generation requests

## Why This Exists

Content generation requires a precise contract between the component requesting content and the component generating it. Without a formal specification, generators would need to make assumptions about difficulty, context, and quality requirements. This module defines ContentSpec as the comprehensive request format that captures all constraints and requirements upfront, enabling generators to produce appropriately targeted content without back-and-forth negotiation.

## Key Concepts

- **ContentSpec**: The central interface that fully describes a content generation request. It bundles target vocabulary, pedagogical intent, phase, task type, modality, difficulty constraints, scaffolding configuration, context requirements, quality preferences, and generation constraints into a single coherent specification.

- **ContentSourceType**: An enumeration of content origins (cached, template, ai_generated, corpus, user_created) that enables source attribution and quality reasoning.

- **ContentQualityTier**: A three-level quality classification (premium, standard, fallback) that sets expectations for content sophistication and enables quality-based filtering.

- **RegisterLevel & ContentGenre**: Stylistic constraints that ensure generated content matches the formality (formal/neutral/informal/colloquial) and genre (academic/conversational/technical/etc.) appropriate for the learning context.

- **GeneratedContent**: The output counterpart to ContentSpec, containing the actual content text, instructions, expected responses, distractors, hints, and rich metadata about the generation process.

- **ContentMetadata**: Observability data attached to generated content including word count, estimated difficulty, cognitive load, completion time estimates, and cache hit status.

- **Factory functions**: Convenience constructors (createContentSpec, createIntroductionSpec, createProductionSpec, createComprehensionSpec, createFluencySpec) that produce well-configured specs for common learning scenarios.

## Design Decisions

**Separation of concerns via nested interfaces**: Rather than a flat structure with dozens of properties, ContentSpec uses nested interfaces (ContentContextSpec, ContentQualitySpec, GenerationConstraints, DifficultyConstraints, ScaffoldingConfig) to group related concerns. This improves readability and allows partial updates.

**CEFR-aligned vocabulary levels**: The vocabularyLevel constraint uses standard CEFR levels (A1-C2) rather than custom difficulty scales. This aligns with international language learning standards and enables interoperability with external content sources.

**Spec validation as a separate function**: The `validateContentSpec()` function is decoupled from construction, allowing specs to be built incrementally and validated before submission. This supports dynamic spec assembly in complex workflows.

**Content-meets-spec verification**: The `contentMeetsSpec()` function provides post-generation verification that output satisfies input requirements. This enables quality gates and retry logic when content falls short.

**Complexity estimation**: The `estimateGenerationComplexity()` function provides a 0-1 complexity score based on object count, intent, context requirements, and constraint tightness. This enables generators to select appropriate strategies and set realistic timeouts.

**Sensible defaults via factory functions**: The factory functions encode pedagogical best practices (e.g., introductions get high scaffolding and instructional genre; fluency drills get zero scaffolding and tight timeouts) so callers don't need deep domain expertise.

## Integration Points

**Depends on:**
- `../types`: Imports ComponentType, TaskType, TaskModality, and LanguageObject for core domain types
- `./pedagogical-intent`: Imports PedagogicalIntent, DifficultyConstraints, ScaffoldingConfig, and LearningPhase types that describe the educational purpose

**Consumed by:**
- `./content-generator`: ContentSpec is the primary input to ContentGenerator.generate()
- `./content-validator`: ContentQualityValidator.validate() uses ContentSpec to verify generated content meets requirements
- Task selection logic: Upstream components construct ContentSpecs based on learner state and learning objectives
- Caching layer: Cache keys are derived from ContentSpec properties for content reuse

**Data flow:**
```
Learning state + objectives
     |
     v
Factory function or manual construction
     |
     v
ContentSpec (complete request)
     |
     +---> validateContentSpec() ---> validation errors
     |
     v
ContentGenerator.generate(spec)
     |
     v
GeneratedContent
     |
     +---> contentMeetsSpec(content, spec) ---> compliance check
```
