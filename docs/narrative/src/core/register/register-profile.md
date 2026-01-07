# register-profile.ts — Register Type Definitions and Static Data Library

## Why This Exists

Before analyzing register appropriateness, the system needs a vocabulary of what registers exist and what characterizes each one. This file defines that foundational knowledge: what is "academic formal"? What makes legal language different from casual chat? What linguistic features distinguish a business email from a social media post?

This is the **knowledge base** that makes register-aware language learning possible. Without these definitions, the calculator would have nothing to calculate against.

## Key Concepts

- **Genre**: Categorical classification of text types (13 defined). Examples: `academic_article`, `business_email`, `casual_conversation`, `legal_document`. A single register may span multiple genres.

- **PragmaticFunction**: What the language is trying to accomplish (17 defined). Examples: `informing`, `requesting`, `persuading`, `hedging`. Registers favor different pragmatic functions.

- **FormalityLevel**: Five-tier categorical scale mapping to numeric ranges:
  - `frozen` (0.9-1.0): Legal, liturgical, ceremonial
  - `formal` (0.7-0.9): Academic, professional writing
  - `consultative` (0.5-0.7): Professional conversation
  - `casual` (0.3-0.5): Friends, colleagues
  - `intimate` (0.0-0.3): Close family, partners

- **CollocationPattern**: Word pairs that frequently co-occur within a register. Includes relationship type (verb+noun, adj+noun, etc.), statistical strength (PMI score), and register-specificity score.

- **RegisterProfile**: The complete definition of a register containing:
  - Identity (id, name, description)
  - Formality (level and numeric value)
  - Genre associations
  - Typical vocabulary
  - Collocations
  - Pragmatic functions
  - Quantified linguistic features
  - Example contexts
  - Common L1-specific errors (optional)

- **RegisterFeatures**: Numeric characterization of a register's linguistic patterns:
  - `avgSentenceLength`: Academic = 25 words; social media = 6 words
  - `passiveVoiceRate`: Legal = 45%; casual = 5%
  - `contractionRate`: Social media = 85%; legal = 0%
  - `technicalTermDensity`: Medical = 35%; casual = 2%
  - Plus: pronoun density, hedging frequency, discourse markers, modal verbs, complex sentences, nominalization rate

- **DomainStructure**: Groups registers by professional/contextual domain. Contains:
  - Core vocabulary for the domain
  - Transition paths showing how learners can move between domains
  - CEFR level range covered

## Design Decisions

- **8 Pre-built Registers**: Covers the most common English language learning needs:
  - `academic_formal`: Research papers, journals
  - `business_formal`: Reports, proposals, official correspondence
  - `legal_frozen`: Contracts, statutes
  - `professional_consultative`: Workplace conversations
  - `medical_professional`: Healthcare communication
  - `casual_conversation`: Everyday speech with friends
  - `social_media_informal`: Twitter, Instagram, texting
  - `news_journalistic`: News reports, press releases

- **4 Pre-built Domains**: General, Academic, Business, Medical. Each specifies:
  - Which registers belong to it
  - Core vocabulary to master
  - Transition paths to adjacent domains (e.g., Medical to Academic shares research vocabulary)

- **Numeric Formality**: Beyond categorical levels, each register has a precise 0-1 formality value. This enables mathematical distance calculations between registers.

- **L1-Specific Error Tracking**: The optional `commonErrors` field captures typical mistakes by speakers of specific first languages. Currently defined for Chinese and Spanish speakers in academic register.

- **Domain Transitions**: `DomainTransition` objects model how vocabulary transfers between domains. The `transferCoefficient` (0-1) indicates how easily skills transfer; `bridgeWords` identifies vocabulary that helps learners cross domain boundaries.

- **Pure Data + Helper Functions**: The file provides both raw data exports (`REGISTER_PROFILES`, `DOMAIN_STRUCTURES`) and convenience functions for common queries (`getRegistersByFormality`, `findClosestRegister`, `isTypicalForRegister`).

## Integration Points

- **Direct Dependencies**:
  - `../types`: Imports `ComponentType` (type definition)

- **Consumers**:
  - `register-calculator.ts`: Uses profiles, constants, and helper functions for all calculations
  - Content generation: Selects target register and retrieves its characteristics
  - Assessment: Looks up register features for scoring
  - UI components: May display register names and descriptions to learners

- **System Role**: This is the **static knowledge layer** of the register subsystem. It defines WHAT registers are; `register-calculator.ts` uses this data to analyze HOW well content matches them.

- **Extensibility Points**:
  - Add new registers by extending `REGISTER_PROFILES` object
  - Add new domains by extending `DOMAIN_STRUCTURES` object
  - Add new genres/pragmatic functions by extending the type unions
