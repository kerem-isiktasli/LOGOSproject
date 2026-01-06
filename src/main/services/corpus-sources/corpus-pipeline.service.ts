/**
 * Corpus Pipeline Service
 *
 * Orchestrates vocabulary population from multiple corpus sources.
 * Handles source fetching, vocabulary extraction, metric computation,
 * and database insertion.
 */

import { getPrisma } from '../../db/prisma';
import {
  getDefaultSourceIds,
  type GoalSpec,
} from './filter';
import {
  getSourceById,
  type CorpusSource,
} from './registry';
import {
  updateIRTDifficulties,
  updateRelationalDensities,
  storeCollocations,
  clearCalculatorCache,
} from '../pmi.service';

// =============================================================================
// Types
// =============================================================================

export interface PopulationOptions {
  nlDescription?: string;           // User's natural language input
  selectedSourceIds?: string[];     // User-selected source IDs (overrides auto-selection)
  maxSources?: number;              // Limit source queries (default: 5)
  targetVocabSize?: number;         // Target vocabulary count (default: 500)
  includeUserUploads?: boolean;     // Process user-uploaded documents
}

export interface VocabularyItem {
  content: string;
  type: 'LEX' | 'MORPH' | 'G2P' | 'SYNT' | 'PRAG';
  frequency: number;
  domainDistribution?: Record<string, number>;
  sourceId: string;
}

export interface PopulationResult {
  success: boolean;
  goalId: string;
  sourcesUsed: string[];
  vocabularyCount: number;
  collocationsCount: number;
  errors: string[];
  duration: number;
}

export interface CorpusDocument {
  id: string;
  title: string;
  content: string;
  sourceId: string;
  domain?: string;
  metadata?: Record<string, unknown>;
}

export interface ExtractionResult {
  items: VocabularyItem[];
  documentCount: number;
  tokenCount: number;
}

// =============================================================================
// Main Pipeline
// =============================================================================

/**
 * Populate vocabulary for a goal from corpus sources.
 * This is the main entry point for the corpus pipeline.
 */
export async function populateVocabularyForGoal(
  goalId: string,
  options: PopulationOptions = {}
): Promise<PopulationResult> {
  const startTime = Date.now();
  const db = getPrisma();
  const errors: string[] = [];
  const sourcesUsed: string[] = [];

  try {
    // Get goal specification
    const goal = await db.goalSpec.findUnique({
      where: { id: goalId },
    });

    if (!goal) {
      return {
        success: false,
        goalId,
        sourcesUsed: [],
        vocabularyCount: 0,
        collocationsCount: 0,
        errors: [`Goal not found: ${goalId}`],
        duration: Date.now() - startTime,
      };
    }

    // Parse modalities from JSON string
    const goalSpec: GoalSpec = {
      domain: goal.domain,
      modality: goal.modality,
      genre: goal.genre,
      purpose: goal.purpose,
      benchmark: goal.benchmark,
    };

    // Get sources to use
    let sourceIds: string[];
    if (options.selectedSourceIds && options.selectedSourceIds.length > 0) {
      sourceIds = options.selectedSourceIds;
    } else {
      sourceIds = getDefaultSourceIds(goalSpec);
    }

    // Limit sources
    const maxSources = options.maxSources ?? 5;
    sourceIds = sourceIds.slice(0, maxSources);

    // Collect vocabulary from all sources
    const allVocabulary: VocabularyItem[] = [];
    const targetSize = options.targetVocabSize ?? 500;

    for (const sourceId of sourceIds) {
      const source = getSourceById(sourceId);
      if (!source) {
        errors.push(`Source not found: ${sourceId}`);
        continue;
      }

      try {
        const result = await fetchAndExtractVocabulary(
          source,
          goalSpec,
          options.nlDescription,
          Math.ceil(targetSize / sourceIds.length)
        );

        allVocabulary.push(...result.items);
        sourcesUsed.push(sourceId);
      } catch (err) {
        errors.push(`Failed to fetch from ${source.name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    // Deduplicate vocabulary by content
    const uniqueVocabulary = deduplicateVocabulary(allVocabulary);

    // Limit to target size
    const finalVocabulary = uniqueVocabulary.slice(0, targetSize);

    // Insert into database
    const insertedCount = await insertVocabulary(goalId, finalVocabulary);

    // Clear PMI cache for this goal (new vocabulary)
    clearCalculatorCache(goalId);

    // Compute metrics
    await updateRelationalDensities(goalId);
    await updateIRTDifficulties(goalId);

    // Store collocations
    const collocationsCount = await storeCollocations(goalId);

    return {
      success: true,
      goalId,
      sourcesUsed,
      vocabularyCount: insertedCount,
      collocationsCount,
      errors,
      duration: Date.now() - startTime,
    };
  } catch (err) {
    return {
      success: false,
      goalId,
      sourcesUsed,
      vocabularyCount: 0,
      collocationsCount: 0,
      errors: [err instanceof Error ? err.message : 'Unknown error'],
      duration: Date.now() - startTime,
    };
  }
}

// =============================================================================
// Source Fetching & Extraction
// =============================================================================

/**
 * Fetch documents from a source and extract vocabulary.
 */
async function fetchAndExtractVocabulary(
  source: CorpusSource,
  goal: GoalSpec,
  nlDescription?: string,
  targetCount: number = 100
): Promise<ExtractionResult> {
  switch (source.accessMethod) {
    case 'claude':
      return generateVocabularyWithClaude(source, goal, nlDescription, targetCount);

    case 'upload':
      // User uploads are handled separately
      return { items: [], documentCount: 0, tokenCount: 0 };

    case 'api':
      // Dispatch to specific API fetchers
      return fetchFromAPI(source, goal, nlDescription, targetCount);

    case 'scrape':
      // Web scraping - use Claude to generate similar content
      return generateVocabularyWithClaude(source, goal, nlDescription, targetCount);

    case 'static':
      // Static exam materials - use Claude with specific exam context
      return generateVocabularyWithClaude(source, goal, nlDescription, targetCount);

    default:
      return { items: [], documentCount: 0, tokenCount: 0 };
  }
}

/**
 * Fetch vocabulary from API sources.
 */
async function fetchFromAPI(
  source: CorpusSource,
  goal: GoalSpec,
  nlDescription?: string,
  targetCount: number = 100
): Promise<ExtractionResult> {
  switch (source.id) {
    case 'wikipedia':
    case 'simple-wikipedia':
      return fetchFromWikipedia(source, goal, nlDescription, targetCount);

    case 'wiktionary':
      return fetchFromWiktionary(goal.domain, targetCount);

    case 'pubmed':
      return fetchFromPubMed(goal.domain, nlDescription, targetCount);

    default:
      // Fall back to Claude for unknown API sources
      return generateVocabularyWithClaude(source, goal, nlDescription, targetCount);
  }
}

/**
 * Fetch vocabulary from Wikipedia API.
 */
async function fetchFromWikipedia(
  source: CorpusSource,
  goal: GoalSpec,
  nlDescription?: string,
  targetCount: number = 100
): Promise<ExtractionResult> {
  const baseUrl = source.apiConfig?.baseUrl as string || 'https://en.wikipedia.org/w/api.php';
  const searchTerm = nlDescription || goal.domain;

  try {
    // Search for relevant articles
    const searchUrl = `${baseUrl}?action=query&list=search&srsearch=${encodeURIComponent(searchTerm)}&srlimit=5&format=json&origin=*`;
    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();

    if (!searchData.query?.search?.length) {
      return generateVocabularyWithClaude(source, goal, nlDescription, targetCount);
    }

    const allItems: VocabularyItem[] = [];
    let totalTokens = 0;

    // Fetch content from top articles
    for (const result of searchData.query.search.slice(0, 3)) {
      const contentUrl = `${baseUrl}?action=query&pageids=${result.pageid}&prop=extracts&exintro=true&explaintext=true&format=json&origin=*`;
      const contentResponse = await fetch(contentUrl);
      const contentData = await contentResponse.json();

      const pages = contentData.query?.pages;
      if (!pages) continue;

      const page = Object.values(pages)[0] as { extract?: string };
      if (!page.extract) continue;

      // Tokenize and extract vocabulary
      const tokens = tokenize(page.extract);
      totalTokens += tokens.length;

      const items = extractVocabularyFromTokens(tokens, source.id);
      allItems.push(...items);
    }

    // Deduplicate and limit
    const uniqueItems = deduplicateVocabulary(allItems).slice(0, targetCount);

    return {
      items: uniqueItems,
      documentCount: searchData.query.search.length,
      tokenCount: totalTokens,
    };
  } catch (err) {
    console.warn('[CorpusPipeline] Wikipedia API failed, falling back to Claude:', err);
    return generateVocabularyWithClaude(source, goal, nlDescription, targetCount);
  }
}

/**
 * Fetch word definitions from Wiktionary API.
 */
async function fetchFromWiktionary(
  domain: string,
  targetCount: number = 100
): Promise<ExtractionResult> {
  const baseUrl = 'https://en.wiktionary.org/w/api.php';

  try {
    // Get category members for domain-related categories
    const categoryMap: Record<string, string> = {
      'medical': 'en:Medicine',
      'legal': 'en:Law',
      'business': 'en:Business',
      'academic': 'en:Academia',
      'general': 'en:English_lemmas',
    };

    const category = categoryMap[domain] || categoryMap['general'];
    const url = `${baseUrl}?action=query&list=categorymembers&cmtitle=Category:${encodeURIComponent(category)}&cmlimit=${targetCount}&format=json&origin=*`;

    const response = await fetch(url);
    const data = await response.json();

    const members = data.query?.categorymembers || [];
    const items: VocabularyItem[] = members.map((member: { title: string }) => ({
      content: member.title.toLowerCase(),
      type: 'LEX' as const,
      frequency: 0.5,
      sourceId: 'wiktionary',
    }));

    return {
      items: items.slice(0, targetCount),
      documentCount: 1,
      tokenCount: items.length,
    };
  } catch (err) {
    console.warn('[CorpusPipeline] Wiktionary API failed:', err);
    return { items: [], documentCount: 0, tokenCount: 0 };
  }
}

/**
 * Fetch medical vocabulary from PubMed API.
 */
async function fetchFromPubMed(
  domain: string,
  nlDescription?: string,
  targetCount: number = 100
): Promise<ExtractionResult> {
  if (!['medical', 'health', 'nursing'].includes(domain)) {
    return { items: [], documentCount: 0, tokenCount: 0 };
  }

  const baseUrl = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
  const searchTerm = nlDescription || domain;

  try {
    // Search for articles
    const searchUrl = `${baseUrl}/esearch.fcgi?db=pmc&term=${encodeURIComponent(searchTerm)}&retmax=5&retmode=json`;
    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();

    const ids = searchData.esearchresult?.idlist || [];
    if (ids.length === 0) {
      return { items: [], documentCount: 0, tokenCount: 0 };
    }

    // Fetch abstracts
    const fetchUrl = `${baseUrl}/efetch.fcgi?db=pmc&id=${ids.join(',')}&rettype=abstract&retmode=text`;
    const fetchResponse = await fetch(fetchUrl);
    const text = await fetchResponse.text();

    // Tokenize and extract vocabulary
    const tokens = tokenize(text);
    const items = extractVocabularyFromTokens(tokens, 'pubmed');

    // Filter to medical terminology (longer words, likely technical)
    const medicalItems = items.filter(
      (item) => item.content.length >= 6 || item.frequency > 0.3
    );

    return {
      items: deduplicateVocabulary(medicalItems).slice(0, targetCount),
      documentCount: ids.length,
      tokenCount: tokens.length,
    };
  } catch (err) {
    console.warn('[CorpusPipeline] PubMed API failed:', err);
    return { items: [], documentCount: 0, tokenCount: 0 };
  }
}

/**
 * Generate vocabulary using Claude AI.
 * This is the fallback method when direct source access isn't available.
 */
async function generateVocabularyWithClaude(
  source: CorpusSource,
  goal: GoalSpec,
  nlDescription?: string,
  targetCount: number = 100
): Promise<ExtractionResult> {
  // Parse modalities
  let modalities: string[] = [];
  try {
    modalities = JSON.parse(goal.modality);
  } catch {
    modalities = [goal.modality];
  }

  // Build vocabulary generation prompt
  const prompt = buildVocabularyPrompt(
    goal.domain,
    modalities,
    goal.benchmark,
    nlDescription,
    targetCount,
    source.name
  );

  // Call Claude API for vocabulary generation
  const vocabulary = await callClaudeForVocabulary(prompt);

  return {
    items: vocabulary,
    documentCount: 1,
    tokenCount: vocabulary.length * 5, // Rough estimate
  };
}

/**
 * Build a prompt for vocabulary generation.
 */
function buildVocabularyPrompt(
  domain: string,
  modalities: string[],
  benchmark: string | null | undefined,
  nlDescription: string | undefined,
  count: number,
  sourceName: string
): string {
  let prompt = `Generate ${count} vocabulary items for language learning.

Domain: ${domain}
Skills focus: ${modalities.join(', ')}`;

  if (benchmark) {
    prompt += `\nTarget exam: ${benchmark}`;
  }

  if (nlDescription) {
    prompt += `\nLearner goal: ${nlDescription}`;
  }

  prompt += `\nReference style: ${sourceName}

For each item, provide:
1. The word or phrase
2. Type: LEX (vocabulary), MORPH (word forms), G2P (pronunciation), SYNT (grammar), PRAG (usage)
3. Frequency estimate (0-1, where 1 is very common)
4. Domain relevance

Return as JSON array: [{"content": "...", "type": "LEX", "frequency": 0.8}]`;

  return prompt;
}

/**
 * Call Claude API for vocabulary generation.
 * Integrates with ClaudeService from main process.
 */
async function callClaudeForVocabulary(prompt: string): Promise<VocabularyItem[]> {
  try {
    const { getClaudeService } = await import('../claude.service');
    const claudeService = getClaudeService();

    // Generate vocabulary using Claude
    const response = await claudeService.generateContent({
      type: 'exercise',
      content: prompt,
      targetLanguage: 'English', // Default, will be overridden by context
      nativeLanguage: 'English',
      context: 'vocabulary generation for language learning',
    });

    // Parse the response to extract vocabulary items
    const vocabulary = parseVocabularyResponse(response.content);
    return vocabulary;
  } catch (err) {
    console.warn('[CorpusPipeline] Claude API call failed, using fallback:', err);
    // Return fallback vocabulary when Claude is unavailable
    return generateFallbackVocabulary();
  }
}

/**
 * Parse Claude's response to extract vocabulary items.
 */
function parseVocabularyResponse(content: string): VocabularyItem[] {
  const items: VocabularyItem[] = [];

  try {
    // Try to parse as JSON array first
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item.content && typeof item.content === 'string') {
            items.push({
              content: item.content,
              type: mapType(item.type),
              frequency: typeof item.frequency === 'number' ? item.frequency : 0.5,
              sourceId: 'claude-generated',
            });
          }
        }
      }
    }
  } catch {
    // If JSON parsing fails, extract words from text
    const words = content.match(/["']([^"']+)["']/g);
    if (words) {
      for (const word of words.slice(0, 20)) {
        const cleaned = word.replace(/["']/g, '').trim();
        if (cleaned.length > 1) {
          items.push({
            content: cleaned,
            type: 'LEX',
            frequency: 0.5,
            sourceId: 'claude-generated',
          });
        }
      }
    }
  }

  return items.length > 0 ? items : generateFallbackVocabulary();
}

/**
 * Map string type to VocabularyItem type.
 */
function mapType(type: string | undefined): 'LEX' | 'MORPH' | 'G2P' | 'SYNT' | 'PRAG' {
  const typeMap: Record<string, 'LEX' | 'MORPH' | 'G2P' | 'SYNT' | 'PRAG'> = {
    LEX: 'LEX',
    MORPH: 'MORPH',
    G2P: 'G2P',
    SYNT: 'SYNT',
    PRAG: 'PRAG',
    vocabulary: 'LEX',
    grammar: 'SYNT',
    pronunciation: 'G2P',
  };
  return typeMap[type?.toUpperCase() || ''] || 'LEX';
}

/**
 * Generate fallback vocabulary when Claude is unavailable.
 */
function generateFallbackVocabulary(): VocabularyItem[] {
  return [
    { content: 'essential', type: 'LEX', frequency: 0.9, sourceId: 'fallback' },
    { content: 'important', type: 'LEX', frequency: 0.88, sourceId: 'fallback' },
    { content: 'understand', type: 'LEX', frequency: 0.85, sourceId: 'fallback' },
    { content: 'describe', type: 'LEX', frequency: 0.82, sourceId: 'fallback' },
    { content: 'explain', type: 'LEX', frequency: 0.80, sourceId: 'fallback' },
    { content: 'analyze', type: 'LEX', frequency: 0.75, sourceId: 'fallback' },
    { content: 'evaluate', type: 'LEX', frequency: 0.72, sourceId: 'fallback' },
    { content: 'compare', type: 'LEX', frequency: 0.70, sourceId: 'fallback' },
    { content: 'contrast', type: 'LEX', frequency: 0.68, sourceId: 'fallback' },
    { content: 'conclude', type: 'LEX', frequency: 0.65, sourceId: 'fallback' },
  ];
}

// =============================================================================
// User Upload Processing
// =============================================================================

/**
 * Process user-uploaded documents for vocabulary extraction.
 */
export async function processUserUploads(
  _goalId: string,
  documents: Array<{ filename: string; content: string; mimeType: string }>
): Promise<ExtractionResult> {
  const allItems: VocabularyItem[] = [];
  let totalTokens = 0;

  for (const doc of documents) {
    const text = extractTextFromDocument(doc.content, doc.mimeType);
    const tokens = tokenize(text);
    totalTokens += tokens.length;

    // Extract vocabulary from tokens
    const items = extractVocabularyFromTokens(tokens, 'user-upload');
    allItems.push(...items);
  }

  return {
    items: deduplicateVocabulary(allItems),
    documentCount: documents.length,
    tokenCount: totalTokens,
  };
}

/**
 * Extract text from document based on MIME type.
 * Supports plain text, HTML, PDF, and DOCX formats.
 */
function extractTextFromDocument(content: string, mimeType: string): string {
  switch (mimeType) {
    case 'text/plain':
    case 'text/markdown':
      return content;

    case 'text/html':
      // Strip HTML tags
      return content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

    case 'application/pdf':
      // PDF content is typically pre-extracted before reaching here
      // For base64-encoded PDF, attempt basic text extraction
      return extractPDFText(content);

    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    case 'application/msword':
      // DOCX/DOC content extraction
      return extractDOCXText(content);

    case 'application/rtf':
      // RTF text extraction
      return extractRTFText(content);

    default:
      // For unknown types, treat as plain text
      return content;
  }
}

/**
 * Extract text from PDF content.
 * Handles both pre-extracted text and base64-encoded PDF data.
 */
function extractPDFText(content: string): string {
  // If content is base64-encoded, try to decode and extract text
  if (content.startsWith('data:application/pdf;base64,') || /^[A-Za-z0-9+/=]+$/.test(content.slice(0, 100))) {
    try {
      // For base64 content, we need to extract raw text
      // PDF parsing is complex; this handles simple text-based PDFs
      const decoded = Buffer.from(content.replace(/^data:[^,]+,/, ''), 'base64').toString('utf-8');

      // Look for text objects in PDF stream (simplified extraction)
      const textMatches = decoded.match(/\(([^)]+)\)/g);
      if (textMatches) {
        return textMatches
          .map(m => m.slice(1, -1)) // Remove parentheses
          .filter(t => t.length > 1 && !/^[\x00-\x1f]+$/.test(t)) // Filter control chars
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
      }

      // Fallback: extract printable ASCII sequences
      const printable = decoded.match(/[\x20-\x7E]{4,}/g);
      return printable ? printable.join(' ').replace(/\s+/g, ' ').trim() : content;
    } catch {
      // If decoding fails, return original content
      return content;
    }
  }

  // Content is already extracted text
  return content;
}

/**
 * Extract text from DOCX content.
 * DOCX is a ZIP archive containing XML files.
 */
function extractDOCXText(content: string): string {
  // If content is base64-encoded, decode it
  if (content.startsWith('data:') || /^[A-Za-z0-9+/=]+$/.test(content.slice(0, 100))) {
    try {
      const decoded = Buffer.from(content.replace(/^data:[^,]+,/, ''), 'base64').toString('utf-8');

      // DOCX files contain XML; extract text from <w:t> tags
      const textMatches = decoded.match(/<w:t[^>]*>([^<]*)<\/w:t>/g);
      if (textMatches) {
        return textMatches
          .map(m => m.replace(/<[^>]+>/g, ''))
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
      }

      // Fallback: extract any readable text sequences
      const printable = decoded.match(/[\x20-\x7E]{4,}/g);
      return printable ? printable.join(' ').replace(/\s+/g, ' ').trim() : content;
    } catch {
      return content;
    }
  }

  // Content is already extracted text
  return content;
}

/**
 * Extract text from RTF content.
 * RTF uses control words prefixed with backslash.
 */
function extractRTFText(content: string): string {
  // Remove RTF control sequences
  let text = content
    // Remove RTF header
    .replace(/^\{\\rtf[^}]*\}?/i, '')
    // Remove control words
    .replace(/\\[a-z]+\d*\s?/gi, '')
    // Remove escaped characters
    .replace(/\\'[0-9a-f]{2}/gi, ' ')
    // Remove braces
    .replace(/[{}]/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();

  return text;
}

/**
 * Tokenize text into words.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s'-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && w.length < 30);
}

/**
 * Extract vocabulary items from tokens with frequency analysis.
 */
function extractVocabularyFromTokens(
  tokens: string[],
  sourceId: string
): VocabularyItem[] {
  // Count word frequencies
  const wordCounts = new Map<string, number>();
  for (const token of tokens) {
    wordCounts.set(token, (wordCounts.get(token) || 0) + 1);
  }

  // Convert to vocabulary items
  const maxCount = Math.max(...wordCounts.values());
  const items: VocabularyItem[] = [];

  for (const [word, count] of wordCounts) {
    // Skip very common stop words
    if (isStopWord(word)) continue;

    items.push({
      content: word,
      type: 'LEX',
      frequency: count / maxCount,
      sourceId,
    });
  }

  // Sort by frequency (highest first)
  items.sort((a, b) => b.frequency - a.frequency);

  return items;
}

/**
 * Check if word is a common stop word.
 */
function isStopWord(word: string): boolean {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that',
    'these', 'those', 'it', 'its', 'they', 'them', 'their', 'we', 'us',
    'our', 'you', 'your', 'he', 'she', 'him', 'her', 'his', 'i', 'me', 'my',
  ]);
  return stopWords.has(word);
}

// =============================================================================
// Database Operations
// =============================================================================

/**
 * Deduplicate vocabulary items by content.
 */
function deduplicateVocabulary(items: VocabularyItem[]): VocabularyItem[] {
  const seen = new Map<string, VocabularyItem>();

  for (const item of items) {
    const key = item.content.toLowerCase();
    const existing = seen.get(key);

    if (!existing || item.frequency > existing.frequency) {
      seen.set(key, item);
    }
  }

  return Array.from(seen.values());
}

/**
 * Insert vocabulary items into the database.
 */
async function insertVocabulary(
  goalId: string,
  items: VocabularyItem[]
): Promise<number> {
  const db = getPrisma();
  let insertedCount = 0;

  for (const item of items) {
    try {
      await db.languageObject.upsert({
        where: {
          // Use goalId + content as unique identifier
          id: `${goalId}-${item.content}`.substring(0, 36),
        },
        create: {
          id: `${goalId}-${item.content}`.substring(0, 36),
          goalId,
          content: item.content,
          type: item.type,
          frequency: item.frequency,
          relationalDensity: 0.5, // Will be updated by PMI service
          contextualContribution: 0.5, // Default
          domainDistribution: item.domainDistribution
            ? JSON.stringify(item.domainDistribution)
            : null,
          priority: item.frequency, // Initial priority based on frequency
        },
        update: {
          frequency: item.frequency,
          domainDistribution: item.domainDistribution
            ? JSON.stringify(item.domainDistribution)
            : null,
        },
      });
      insertedCount++;
    } catch (err) {
      // Skip duplicates or invalid entries
      console.warn(`Failed to insert vocabulary item: ${item.content}`, err);
    }
  }

  return insertedCount;
}

// =============================================================================
// Status & Progress
// =============================================================================

/**
 * Get population status for a goal.
 */
export async function getPopulationStatus(goalId: string): Promise<{
  hasVocabulary: boolean;
  vocabularyCount: number;
  lastUpdated: Date | null;
}> {
  const db = getPrisma();

  const count = await db.languageObject.count({
    where: { goalId },
  });

  const latest = await db.languageObject.findFirst({
    where: { goalId },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });

  return {
    hasVocabulary: count > 0,
    vocabularyCount: count,
    lastUpdated: latest?.createdAt ?? null,
  };
}

/**
 * Clear all vocabulary for a goal (for repopulation).
 */
export async function clearVocabulary(goalId: string): Promise<number> {
  const db = getPrisma();

  const result = await db.languageObject.deleteMany({
    where: { goalId },
  });

  // Clear PMI cache
  clearCalculatorCache(goalId);

  return result.count;
}
