/**
 * Goal IPC Handlers
 *
 * Handles all goal-related IPC communication between renderer and main process.
 * Goals represent learning objectives with domain, modality, genre, and purpose specs.
 */

import { registerHandler, registerDynamicHandler, success, error, validateNonEmpty, validateUUID } from './contracts';
import { prisma } from '../db/client';
import type { GoalSpec, Domain, Modality } from '../../shared/types';
import {
  getRecommendedSources,
  getDefaultSourceIds,
  validateSourceSelection,
} from '../services/corpus-sources/filter';
import {
  getEnabledSources,
} from '../services/corpus-sources/registry';
import {
  populateVocabularyForGoal,
  getPopulationStatus,
  clearVocabulary,
  processUserUploads,
} from '../services/corpus-sources/corpus-pipeline.service';

// ============================================================================
// Type Guards and Validation
// ============================================================================

const VALID_DOMAINS: Domain[] = ['medical', 'legal', 'business', 'academic', 'general'];
const VALID_MODALITIES: Modality[] = ['reading', 'listening', 'writing', 'speaking'];

function isValidDomain(value: string): value is Domain {
  return VALID_DOMAINS.includes(value as Domain);
}

function isValidModality(value: string): value is Modality {
  return VALID_MODALITIES.includes(value as Modality);
}

function validateModalities(modalities: unknown): string | null {
  if (!Array.isArray(modalities) || modalities.length === 0) {
    return 'modality must be a non-empty array';
  }
  for (const mod of modalities) {
    if (!isValidModality(mod)) {
      return `Invalid modality: ${mod}. Valid options: ${VALID_MODALITIES.join(', ')}`;
    }
  }
  return null;
}

function validateDomain(domain: unknown): string | null {
  if (typeof domain !== 'string' || !isValidDomain(domain)) {
    return `Invalid domain. Valid options: ${VALID_DOMAINS.join(', ')}`;
  }
  return null;
}

// ============================================================================
// Handler Registration
// ============================================================================

/**
 * Register all goal-related IPC handlers.
 */
export function registerGoalHandlers(): void {
  // Create a new goal
  registerHandler('goal:create', async (_event, request) => {
    const { domain, modality, genre, purpose, benchmark, deadline } = request as {
      domain: string;
      modality: string[];
      genre: string;
      purpose: string;
      benchmark?: string;
      deadline?: string;
    };

    // Validate required fields
    const domainError = validateDomain(domain);
    if (domainError) return error(domainError);

    const modalityError = validateModalities(modality);
    if (modalityError) return error(modalityError);

    const genreError = validateNonEmpty(genre, 'genre');
    if (genreError) return error(genreError);

    const purposeError = validateNonEmpty(purpose, 'purpose');
    if (purposeError) return error(purposeError);

    try {
      // Get or create default user (temporary until auth is implemented)
      let user = await prisma.user.findFirst();
      if (!user) {
        user = await prisma.user.create({
          data: {
            nativeLanguage: 'en',
            targetLanguage: 'en',
          },
        });
      }

      const goal = await prisma.goalSpec.create({
        data: {
          domain: domain.toLowerCase(),
          modality: JSON.stringify(modality.map((m: string) => m.toLowerCase())),
          genre: genre.trim(),
          purpose: purpose.trim(),
          benchmark: benchmark?.trim() || null,
          deadline: deadline ? new Date(deadline) : null,
          completionPercent: 0,
          isActive: true,
          userId: user.id,
        },
      });

      return success(mapGoalToResponse(goal));
    } catch (err) {
      console.error('Failed to create goal:', err);
      return error('Failed to create goal');
    }
  });

  // Get a single goal by ID
  registerHandler('goal:get', async (_event, request) => {
    const { id } = request as { id: string };

    const idError = validateUUID(id, 'id');
    if (idError) return error(idError);

    try {
      const goal = await prisma.goalSpec.findUnique({
        where: { id },
        include: {
          _count: {
            select: { languageObjects: true, sessions: true },
          },
        },
      });

      if (!goal) {
        return error('Goal not found');
      }

      return success(mapGoalToResponse(goal));
    } catch (err) {
      console.error('Failed to get goal:', err);
      return error('Failed to get goal');
    }
  });

  // List all goals
  registerHandler('goal:list', async (_event, request) => {
    const { activeOnly, limit, offset } = (request as {
      activeOnly?: boolean;
      limit?: number;
      offset?: number;
    }) || {};

    try {
      const where = activeOnly ? { isActive: true } : {};

      const [goals, total] = await Promise.all([
        prisma.goalSpec.findMany({
          where,
          include: {
            _count: {
              select: { languageObjects: true, sessions: true },
            },
          },
          orderBy: { updatedAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        prisma.goalSpec.count({ where }),
      ]);

      return success({
        goals: goals.map(mapGoalToResponse),
        total,
      });
    } catch (err) {
      console.error('Failed to list goals:', err);
      return error('Failed to list goals');
    }
  });

  // Update a goal
  registerHandler('goal:update', async (_event, request) => {
    const { id, updates } = request as {
      id: string;
      updates: {
        domain?: string;
        modality?: string[];
        genre?: string;
        purpose?: string;
        benchmark?: string;
        deadline?: string;
      };
    };

    const idError = validateUUID(id, 'id');
    if (idError) return error(idError);

    // Build update data, only including provided fields
    const updateData: Record<string, unknown> = {};

    if (updates.domain !== undefined) {
      const domainError = validateDomain(updates.domain);
      if (domainError) return error(domainError);
      updateData.domain = updates.domain.toLowerCase();
    }

    if (updates.modality !== undefined) {
      const modalityError = validateModalities(updates.modality);
      if (modalityError) return error(modalityError);
      updateData.modality = JSON.stringify(updates.modality.map((m) => m.toLowerCase()));
    }

    if (updates.genre !== undefined) {
      const genreError = validateNonEmpty(updates.genre, 'genre');
      if (genreError) return error(genreError);
      updateData.genre = updates.genre.trim();
    }

    if (updates.purpose !== undefined) {
      const purposeError = validateNonEmpty(updates.purpose, 'purpose');
      if (purposeError) return error(purposeError);
      updateData.purpose = updates.purpose.trim();
    }

    if (updates.benchmark !== undefined) {
      updateData.benchmark = updates.benchmark?.trim() || null;
    }

    if (updates.deadline !== undefined) {
      updateData.deadline = updates.deadline ? new Date(updates.deadline) : null;
    }

    if (Object.keys(updateData).length === 0) {
      return error('No fields to update');
    }

    try {
      const goal = await prisma.goalSpec.update({
        where: { id },
        data: updateData,
      });

      return success(mapGoalToResponse(goal));
    } catch (err) {
      console.error('Failed to update goal:', err);
      return error('Failed to update goal');
    }
  });

  // Delete a goal
  registerHandler('goal:delete', async (_event, request) => {
    const { id } = request as { id: string };

    const idError = validateUUID(id, 'id');
    if (idError) return error(idError);

    try {
      await prisma.goalSpec.delete({
        where: { id },
      });

      return success({ deleted: true });
    } catch (err) {
      console.error('Failed to delete goal:', err);
      return error('Failed to delete goal');
    }
  });

  // Set goal active status
  registerHandler('goal:set-active', async (_event, request) => {
    const { id, active } = request as { id: string; active: boolean };

    const idError = validateUUID(id, 'id');
    if (idError) return error(idError);

    if (typeof active !== 'boolean') {
      return error('active must be a boolean');
    }

    try {
      const goal = await prisma.goalSpec.update({
        where: { id },
        data: { isActive: active },
      });

      return success(mapGoalToResponse(goal));
    } catch (err) {
      console.error('Failed to set goal active status:', err);
      return error('Failed to set goal active status');
    }
  });

  // ==========================================================================
  // Corpus Source Handlers
  // ==========================================================================

  // Get all available corpus sources
  registerDynamicHandler('goal:list-sources', async () => {
    try {
      const sources = getEnabledSources();
      return success({
        sources: sources.map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          type: s.type,
          domains: s.domains,
          modalities: s.modalities,
          benchmarks: s.benchmarks || [],
          reliability: s.reliability,
          priority: s.priority,
        })),
      });
    } catch (err) {
      console.error('Failed to list corpus sources:', err);
      return error('Failed to list corpus sources');
    }
  });

  // Get recommended corpus sources for a goal
  registerDynamicHandler('goal:get-recommended-sources', async (_event, request) => {
    const { goalId, nlDescription } = request as {
      goalId: string;
      nlDescription?: string;
    };

    const idError = validateUUID(goalId, 'goalId');
    if (idError) return error(idError);

    try {
      const goal = await prisma.goalSpec.findUnique({
        where: { id: goalId },
      });

      if (!goal) {
        return error('Goal not found');
      }

      const goalSpec = {
        domain: goal.domain,
        modality: goal.modality,
        genre: goal.genre,
        purpose: goal.purpose,
        benchmark: goal.benchmark,
      };

      const rankedSources = getRecommendedSources(goalSpec, nlDescription);
      const defaultIds = getDefaultSourceIds(goalSpec);

      return success({
        recommended: rankedSources.map((rs) => ({
          source: {
            id: rs.source.id,
            name: rs.source.name,
            description: rs.source.description,
            type: rs.source.type,
            domains: rs.source.domains,
            modalities: rs.source.modalities,
            benchmarks: rs.source.benchmarks || [],
            reliability: rs.source.reliability,
          },
          score: rs.score,
          reasons: rs.matchReasons,
        })),
        defaultSourceIds: defaultIds,
      });
    } catch (err) {
      console.error('Failed to get recommended sources:', err);
      return error('Failed to get recommended sources');
    }
  });

  // Populate vocabulary for a goal from corpus sources
  registerDynamicHandler('goal:populate-vocabulary', async (_event, request) => {
    const {
      goalId,
      nlDescription,
      selectedSourceIds,
      maxSources,
      targetVocabSize,
    } = request as {
      goalId: string;
      nlDescription?: string;
      selectedSourceIds?: string[];
      maxSources?: number;
      targetVocabSize?: number;
    };

    const idError = validateUUID(goalId, 'goalId');
    if (idError) return error(idError);

    try {
      // Get goal for validation if source IDs are provided
      if (selectedSourceIds && selectedSourceIds.length > 0) {
        const goal = await prisma.goalSpec.findUnique({
          where: { id: goalId },
        });

        if (goal) {
          const goalSpec = {
            domain: goal.domain,
            modality: goal.modality,
            genre: goal.genre,
            purpose: goal.purpose,
            benchmark: goal.benchmark,
          };
          const validation = validateSourceSelection(goalSpec, selectedSourceIds);
          if (validation.warnings.length > 0) {
            console.warn('Source selection warnings:', validation.warnings);
          }
        }
      }

      const result = await populateVocabularyForGoal(goalId, {
        nlDescription,
        selectedSourceIds,
        maxSources,
        targetVocabSize,
      });

      return success({
        success: result.success,
        goalId: result.goalId,
        sourcesUsed: result.sourcesUsed,
        vocabularyCount: result.vocabularyCount,
        collocationsCount: result.collocationsCount,
        errors: result.errors,
        duration: result.duration,
      });
    } catch (err) {
      console.error('Failed to populate vocabulary:', err);
      return error('Failed to populate vocabulary');
    }
  });

  // Get vocabulary population status for a goal
  registerDynamicHandler('goal:get-population-status', async (_event, request) => {
    const { goalId } = request as { goalId: string };

    const idError = validateUUID(goalId, 'goalId');
    if (idError) return error(idError);

    try {
      const status = await getPopulationStatus(goalId);
      return success(status);
    } catch (err) {
      console.error('Failed to get population status:', err);
      return error('Failed to get population status');
    }
  });

  // Clear vocabulary for a goal (for repopulation)
  registerDynamicHandler('goal:clear-vocabulary', async (_event, request) => {
    const { goalId } = request as { goalId: string };

    const idError = validateUUID(goalId, 'goalId');
    if (idError) return error(idError);

    try {
      const deletedCount = await clearVocabulary(goalId);
      return success({
        cleared: true,
        deletedCount,
      });
    } catch (err) {
      console.error('Failed to clear vocabulary:', err);
      return error('Failed to clear vocabulary');
    }
  });

  // Process user-uploaded documents for vocabulary extraction
  registerDynamicHandler('goal:upload-corpus', async (_event, request) => {
    const { goalId, documents } = request as {
      goalId: string;
      documents: Array<{
        filename: string;
        content: string;
        mimeType: string;
      }>;
    };

    const idError = validateUUID(goalId, 'goalId');
    if (idError) return error(idError);

    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      return error('documents must be a non-empty array');
    }

    // Validate documents
    for (const doc of documents) {
      if (!doc.filename || typeof doc.filename !== 'string') {
        return error('Each document must have a filename');
      }
      if (!doc.content || typeof doc.content !== 'string') {
        return error('Each document must have content');
      }
      if (!doc.mimeType || typeof doc.mimeType !== 'string') {
        return error('Each document must have a mimeType');
      }
    }

    try {
      // Check goal exists
      const goal = await prisma.goalSpec.findUnique({
        where: { id: goalId },
      });

      if (!goal) {
        return error('Goal not found');
      }

      // Process uploads
      const result = await processUserUploads(goalId, documents);

      // Insert extracted vocabulary
      const db = prisma;
      let insertedCount = 0;

      for (const item of result.items) {
        try {
          await db.languageObject.upsert({
            where: {
              id: `${goalId}-${item.content}`.substring(0, 36),
            },
            create: {
              id: `${goalId}-${item.content}`.substring(0, 36),
              goalId,
              content: item.content,
              type: item.type,
              frequency: item.frequency,
              relationalDensity: 0.5,
              contextualContribution: 0.5,
              priority: item.frequency,
            },
            update: {
              frequency: item.frequency,
            },
          });
          insertedCount++;
        } catch {
          // Skip duplicates
        }
      }

      return success({
        documentsProcessed: result.documentCount,
        tokensExtracted: result.tokenCount,
        vocabularyInserted: insertedCount,
      });
    } catch (err) {
      console.error('Failed to process user uploads:', err);
      return error('Failed to process user uploads');
    }
  });
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Map Prisma goal to GoalSpec response type.
 */
function mapGoalToResponse(goal: {
  id: string;
  domain: string;
  modality: string;
  genre: string;
  purpose: string;
  benchmark: string | null;
  deadline: Date | null;
  completionPercent: number;
  isActive: boolean;
  userId: string;
  _count?: { languageObjects: number; sessions: number };
}): GoalSpec {
  // Parse modality from JSON string
  let parsedModality: Modality[];
  try {
    parsedModality = JSON.parse(goal.modality) as Modality[];
  } catch {
    parsedModality = [goal.modality as Modality];
  }

  return {
    id: goal.id,
    domain: goal.domain as Domain,
    modality: parsedModality,
    genre: goal.genre,
    purpose: goal.purpose,
    benchmark: goal.benchmark || undefined,
    deadline: goal.deadline || undefined,
    completionPercent: goal.completionPercent,
    isActive: goal.isActive,
    userId: goal.userId,
  };
}

/**
 * Unregister all goal handlers (for cleanup/testing).
 */
export function unregisterGoalHandlers(): void {
  const { unregisterHandler } = require('./contracts') as { unregisterHandler: (channel: string) => void };
  unregisterHandler('goal:create');
  unregisterHandler('goal:get');
  unregisterHandler('goal:list');
  unregisterHandler('goal:update');
  unregisterHandler('goal:delete');
  unregisterHandler('goal:set-active');
  // Corpus source handlers
  unregisterHandler('goal:list-sources');
  unregisterHandler('goal:get-recommended-sources');
  unregisterHandler('goal:populate-vocabulary');
  unregisterHandler('goal:get-population-status');
  unregisterHandler('goal:clear-vocabulary');
  unregisterHandler('goal:upload-corpus');
}
