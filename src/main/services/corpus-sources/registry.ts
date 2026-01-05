/**
 * Corpus Source Registry
 *
 * Defines available resource pools for vocabulary extraction.
 * Sources are categorized by type, domain, and modality for goal-based filtering.
 */

// =============================================================================
// Types
// =============================================================================

export type SourceType =
  | 'government'
  | 'academic'
  | 'media'
  | 'exam'
  | 'social'
  | 'encyclopedia'
  | 'corpus'
  | 'user_upload'
  | 'claude_generated';

export type AccessMethod = 'api' | 'scrape' | 'static' | 'claude' | 'upload';

export interface CorpusSource {
  id: string;
  name: string;
  description: string;
  type: SourceType;
  domains: string[];           // medical, legal, business, academic, general
  modalities: string[];        // reading, listening, writing, speaking
  benchmarks?: string[];       // CELBAN, IELTS, TOEFL, etc.
  accessMethod: AccessMethod;
  url?: string;
  apiConfig?: Record<string, unknown>;
  reliability: number;         // 0-1 trustworthiness score
  enabled: boolean;            // Whether this source is active
  priority: number;            // Higher = preferred when multiple sources match
}

// =============================================================================
// Source Registry
// =============================================================================

export const CORPUS_SOURCES: CorpusSource[] = [
  // =========================================================================
  // Government & Official Sources
  // =========================================================================
  {
    id: 'gov-health-canada',
    name: 'Health Canada',
    description: 'Official Canadian health information and regulations',
    type: 'government',
    domains: ['medical', 'health'],
    modalities: ['reading'],
    benchmarks: ['CELBAN'],
    accessMethod: 'scrape',
    url: 'https://www.canada.ca/en/health-canada.html',
    reliability: 0.95,
    enabled: true,
    priority: 90,
  },
  {
    id: 'gov-legal-canada',
    name: 'Justice Laws Canada',
    description: 'Canadian legal documents and regulations',
    type: 'government',
    domains: ['legal'],
    modalities: ['reading'],
    accessMethod: 'scrape',
    url: 'https://laws-lois.justice.gc.ca',
    reliability: 0.95,
    enabled: true,
    priority: 90,
  },
  {
    id: 'gov-immigration',
    name: 'Immigration Canada',
    description: 'Immigration documents and citizenship materials',
    type: 'government',
    domains: ['immigration', 'general'],
    modalities: ['reading'],
    benchmarks: ['IELTS', 'CELPIP'],
    accessMethod: 'scrape',
    url: 'https://www.canada.ca/en/immigration-refugees-citizenship.html',
    reliability: 0.95,
    enabled: true,
    priority: 85,
  },

  // =========================================================================
  // Academic & Research Sources
  // =========================================================================
  {
    id: 'pubmed',
    name: 'PubMed Central',
    description: 'Free full-text archive of biomedical and life sciences literature',
    type: 'academic',
    domains: ['medical', 'health', 'academic'],
    modalities: ['reading'],
    benchmarks: ['CELBAN'],
    accessMethod: 'api',
    url: 'https://www.ncbi.nlm.nih.gov/pmc/',
    apiConfig: { baseUrl: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/' },
    reliability: 0.95,
    enabled: true,
    priority: 85,
  },
  {
    id: 'arxiv',
    name: 'arXiv',
    description: 'Open-access archive for scholarly articles',
    type: 'academic',
    domains: ['academic', 'technology'],
    modalities: ['reading'],
    accessMethod: 'api',
    url: 'https://arxiv.org',
    reliability: 0.90,
    enabled: true,
    priority: 75,
  },

  // =========================================================================
  // Exam Banks & Practice Materials
  // =========================================================================
  {
    id: 'celban-samples',
    name: 'CELBAN Sample Tests',
    description: 'Official CELBAN practice materials and sample questions',
    type: 'exam',
    domains: ['medical', 'nursing'],
    modalities: ['reading', 'listening', 'writing', 'speaking'],
    benchmarks: ['CELBAN'],
    accessMethod: 'static',
    reliability: 1.0,
    enabled: true,
    priority: 100,
  },
  {
    id: 'ielts-practice',
    name: 'IELTS Practice Materials',
    description: 'IELTS preparation and practice tests',
    type: 'exam',
    domains: ['general', 'academic'],
    modalities: ['reading', 'listening', 'writing', 'speaking'],
    benchmarks: ['IELTS'],
    accessMethod: 'static',
    reliability: 0.95,
    enabled: true,
    priority: 100,
  },
  {
    id: 'toefl-practice',
    name: 'TOEFL Practice Materials',
    description: 'TOEFL iBT preparation materials',
    type: 'exam',
    domains: ['academic'],
    modalities: ['reading', 'listening', 'writing', 'speaking'],
    benchmarks: ['TOEFL'],
    accessMethod: 'static',
    reliability: 0.95,
    enabled: true,
    priority: 100,
  },

  // =========================================================================
  // Media & Entertainment
  // =========================================================================
  {
    id: 'movie-subtitles',
    name: 'OpenSubtitles Corpus',
    description: 'Movie and TV show subtitles for conversational language',
    type: 'media',
    domains: ['general', 'entertainment'],
    modalities: ['listening', 'speaking'],
    accessMethod: 'api',
    url: 'https://www.opensubtitles.org',
    reliability: 0.70,
    enabled: true,
    priority: 60,
  },
  {
    id: 'ted-transcripts',
    name: 'TED Talk Transcripts',
    description: 'Transcripts from TED talks covering diverse topics',
    type: 'media',
    domains: ['academic', 'general', 'technology', 'business'],
    modalities: ['listening', 'speaking'],
    accessMethod: 'scrape',
    url: 'https://www.ted.com/talks',
    reliability: 0.90,
    enabled: true,
    priority: 80,
  },
  {
    id: 'podcast-transcripts',
    name: 'Podcast Transcripts',
    description: 'Transcripts from popular educational podcasts',
    type: 'media',
    domains: ['general', 'academic'],
    modalities: ['listening'],
    accessMethod: 'scrape',
    reliability: 0.75,
    enabled: true,
    priority: 65,
  },

  // =========================================================================
  // Social & Community
  // =========================================================================
  {
    id: 'reddit-medical',
    name: 'Reddit Medical Communities',
    description: 'Discussions from medical and nursing subreddits',
    type: 'social',
    domains: ['medical', 'nursing'],
    modalities: ['reading', 'writing'],
    accessMethod: 'api',
    url: 'https://www.reddit.com',
    reliability: 0.60,
    enabled: true,
    priority: 50,
  },
  {
    id: 'stackexchange',
    name: 'StackExchange Network',
    description: 'Q&A communities for technical and academic topics',
    type: 'social',
    domains: ['academic', 'technology'],
    modalities: ['reading', 'writing'],
    accessMethod: 'api',
    url: 'https://stackexchange.com',
    reliability: 0.80,
    enabled: true,
    priority: 70,
  },

  // =========================================================================
  // Reference & Encyclopedia
  // =========================================================================
  {
    id: 'wikipedia',
    name: 'Wikipedia',
    description: 'Free encyclopedia covering all topics',
    type: 'encyclopedia',
    domains: ['*'], // Matches all domains
    modalities: ['reading'],
    accessMethod: 'api',
    url: 'https://en.wikipedia.org',
    apiConfig: { baseUrl: 'https://en.wikipedia.org/w/api.php' },
    reliability: 0.85,
    enabled: true,
    priority: 70,
  },
  {
    id: 'simple-wikipedia',
    name: 'Simple English Wikipedia',
    description: 'Wikipedia in simplified English for learners',
    type: 'encyclopedia',
    domains: ['*'],
    modalities: ['reading'],
    accessMethod: 'api',
    url: 'https://simple.wikipedia.org',
    apiConfig: { baseUrl: 'https://simple.wikipedia.org/w/api.php' },
    reliability: 0.85,
    enabled: true,
    priority: 75, // Slightly higher for learners
  },
  {
    id: 'wiktionary',
    name: 'Wiktionary',
    description: 'Free dictionary with definitions and usage examples',
    type: 'encyclopedia',
    domains: ['*'],
    modalities: ['reading'],
    accessMethod: 'api',
    url: 'https://en.wiktionary.org',
    reliability: 0.85,
    enabled: true,
    priority: 80,
  },

  // =========================================================================
  // Linguistic Corpora
  // =========================================================================
  {
    id: 'coca',
    name: 'COCA (Corpus of Contemporary American English)',
    description: 'Largest freely-available corpus of American English',
    type: 'corpus',
    domains: ['*'],
    modalities: ['reading', 'listening', 'writing', 'speaking'],
    accessMethod: 'api',
    url: 'https://www.english-corpora.org/coca/',
    reliability: 0.95,
    enabled: true,
    priority: 85,
  },
  {
    id: 'bnc',
    name: 'British National Corpus',
    description: '100 million word collection of British English',
    type: 'corpus',
    domains: ['*'],
    modalities: ['reading', 'listening', 'writing', 'speaking'],
    accessMethod: 'api',
    url: 'http://www.natcorp.ox.ac.uk/',
    reliability: 0.95,
    enabled: true,
    priority: 80,
  },

  // =========================================================================
  // Special Sources
  // =========================================================================
  {
    id: 'user-upload',
    name: 'User Uploaded Documents',
    description: 'Documents uploaded by the user',
    type: 'user_upload',
    domains: ['*'],
    modalities: ['reading'],
    accessMethod: 'upload',
    reliability: 0.80, // User-provided content
    enabled: true,
    priority: 95, // High priority - user's own materials
  },
  {
    id: 'claude-generated',
    name: 'Claude AI Generated Content',
    description: 'Vocabulary and examples generated by Claude AI',
    type: 'claude_generated',
    domains: ['*'],
    modalities: ['reading', 'writing'],
    accessMethod: 'claude',
    reliability: 0.85,
    enabled: true,
    priority: 60, // Fallback when other sources unavailable
  },
];

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get all enabled corpus sources.
 */
export function getEnabledSources(): CorpusSource[] {
  return CORPUS_SOURCES.filter((s) => s.enabled);
}

/**
 * Get a source by ID.
 */
export function getSourceById(id: string): CorpusSource | undefined {
  return CORPUS_SOURCES.find((s) => s.id === id);
}

/**
 * Get sources by type.
 */
export function getSourcesByType(type: SourceType): CorpusSource[] {
  return CORPUS_SOURCES.filter((s) => s.type === type && s.enabled);
}

/**
 * Get sources by domain.
 */
export function getSourcesByDomain(domain: string): CorpusSource[] {
  return CORPUS_SOURCES.filter(
    (s) => s.enabled && (s.domains.includes(domain) || s.domains.includes('*'))
  );
}

/**
 * Get sources by benchmark.
 */
export function getSourcesByBenchmark(benchmark: string): CorpusSource[] {
  return CORPUS_SOURCES.filter(
    (s) => s.enabled && s.benchmarks?.includes(benchmark)
  );
}

/**
 * Get sources by modality.
 */
export function getSourcesByModality(modality: string): CorpusSource[] {
  return CORPUS_SOURCES.filter(
    (s) => s.enabled && s.modalities.includes(modality)
  );
}
