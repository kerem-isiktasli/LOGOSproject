# content-validator.ts — Quality assurance for generated learning content

## Why This Exists

Generated content, whether from templates or AI, can contain errors, inappropriate material, or pedagogically misaligned tasks. Presenting low-quality content to learners damages trust and learning outcomes. This module implements a multi-dimensional validation system that scores content across linguistic, pedagogical, technical, and safety categories before it reaches learners. It acts as a quality gate that prevents substandard content from entering the learning experience.

## Key Concepts

- **ContentQualityValidator class**: The main validation engine that runs a battery of checks against generated content and produces a comprehensive ValidationResult with scores, tier assignment, and improvement suggestions.

- **ValidationResult**: The complete validation output containing overall pass/fail status, a 0-100 quality score, achieved quality tier, individual check results, actionable suggestions, and validation timestamp.

- **ValidationCheck**: A single quality check with name, category, pass/fail status, weighted score, and descriptive message. Checks are grouped into categories for aggregate scoring.

- **ValidationCategory**: Four dimensions of quality assessment:
  - `linguistic`: Word count, sentence structure, grammar, vocabulary level appropriateness
  - `pedagogical`: Intent alignment, expected responses presence, instructions quality, cognitive load, scaffolding availability
  - `technical`: Non-empty content, valid structure, spec ID matching
  - `safety`: Content appropriateness, PII detection

- **ValidatorConfig**: Configuration options including minimum overall score, per-category minimums, strict mode toggle, target language, and native language for interference detection.

- **LinguisticBenchmark**: Reference data for vocabulary ranges by CEFR level, sentence complexity targets, and readability score ranges that ground linguistic checks in empirical standards.

## Design Decisions

**Weighted scoring system**: Each check has a weight (0-1) that determines its contribution to overall and category scores. This allows fine-tuning of validation priorities (e.g., safety checks are weighted heavily at 0.3 for content safety).

**Safety as a hard gate**: Safety category minimum is set to 100 by default, meaning any safety failure blocks validation regardless of other scores. This reflects the non-negotiable nature of content safety.

**Tier determination from score**: Quality tier mapping is automatic (90+ = premium, 70+ = standard, below = fallback) with safety failures forcing fallback tier. This simplifies downstream quality-based decisions.

**Suggestion generation**: Failed checks generate human-readable improvement suggestions, enabling feedback loops for content improvement rather than just pass/fail verdicts.

**Simplified linguistic checks**: Grammar and vocabulary checks use heuristics (double spaces, capitalization, word length averages) rather than full NLP. This trades some accuracy for performance and dependency simplicity, with a note that production systems should use proper NLP libraries.

**Basic safety patterns**: Safety checks use regex patterns for obvious inappropriate content and PII (phone numbers, emails, SSN patterns). This provides baseline protection while acknowledging that production systems need content moderation APIs.

**Cognitive load verification**: The validator checks that content cognitive load aligns with the pedagogical intent's expected load, catching mismatches between intent and execution.

## Integration Points

**Depends on:**
- `./content-spec`: Imports GeneratedContent, ContentSpec, and ContentQualityTier for the contract between generation and validation
- `../types`: Imports ComponentType for knowledge component classification
- `./pedagogical-intent`: Imports PEDAGOGICAL_INTENTS to verify content aligns with the educational purpose

**Consumed by:**
- Content generation pipeline: ContentGenerator can call validation after generation for quality assurance
- Quality gates: Higher-level orchestrators use validation results to decide whether to present content or regenerate
- Content curation tools: Human reviewers use validation suggestions to improve content libraries
- Analytics: Validation scores feed into content quality metrics and dashboards

**Data flow:**
```
GeneratedContent + ContentSpec
     |
     v
ContentQualityValidator.validate()
     |
     +---> runLinguisticChecks() ---> word count, grammar, vocabulary
     +---> runPedagogicalChecks() ---> intent, responses, scaffolding
     +---> runTechnicalChecks() ---> structure, spec match
     +---> runSafetyChecks() ---> content safety, PII
     |
     v
Aggregate scores by category
     |
     v
Determine validity against thresholds
     |
     v
Assign quality tier
     |
     v
Generate improvement suggestions
     |
     v
ValidationResult (score, tier, checks, suggestions)
```
