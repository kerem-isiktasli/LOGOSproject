/**
 * Corpus Source Selector Component
 *
 * Allows users to select corpus sources for vocabulary population.
 * Shows recommended sources based on goal and allows custom selection.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { GlassCard } from '../ui/GlassCard';
import { GlassButton } from '../ui/GlassButton';
import { GlassBadge } from '../ui/GlassBadge';
import type { CorpusSourceInfo, RankedCorpusSource } from '../../../shared/types';

interface CorpusSourceSelectorProps {
  goalId: string;
  nlDescription?: string;
  onSourcesSelected: (sourceIds: string[]) => void;
  onPopulate: (sourceIds: string[]) => Promise<void>;
  disabled?: boolean;
}

interface SourceCategory {
  label: string;
  types: string[];
  icon: string;
}

const SOURCE_CATEGORIES: SourceCategory[] = [
  { label: 'Government & Official', types: ['government'], icon: '🏛️' },
  { label: 'Academic & Libraries', types: ['academic'], icon: '📚' },
  { label: 'Media & Social', types: ['media', 'social'], icon: '📱' },
  { label: 'Exam Preparation', types: ['exam'], icon: '📝' },
  { label: 'Encyclopedias', types: ['encyclopedia'], icon: '📖' },
  { label: 'Language Corpora', types: ['corpus'], icon: '🗃️' },
];

export const CorpusSourceSelector: React.FC<CorpusSourceSelectorProps> = ({
  goalId,
  nlDescription,
  onSourcesSelected,
  onPopulate,
  disabled = false,
}) => {
  const [allSources, setAllSources] = useState<CorpusSourceInfo[]>([]);
  const [recommended, setRecommended] = useState<RankedCorpusSource[]>([]);
  const [defaultIds, setDefaultIds] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isPopulating, setIsPopulating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  // Load sources on mount
  useEffect(() => {
    loadSources();
  }, [goalId, nlDescription]);

  const loadSources = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Load all available sources
      const sourcesResult = await window.logos.corpus.listSources();
      setAllSources(sourcesResult.sources);

      // Get recommendations for this goal
      const recResult = await window.logos.corpus.getRecommendedSources(
        goalId,
        nlDescription
      );
      setRecommended(recResult.recommended);
      setDefaultIds(recResult.defaultSourceIds);

      // Pre-select defaults
      setSelectedIds(new Set(recResult.defaultSourceIds));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sources');
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle source selection
  const toggleSource = useCallback((sourceId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(sourceId)) {
        next.delete(sourceId);
      } else {
        next.add(sourceId);
      }
      return next;
    });
  }, []);

  // Select all in category
  const selectCategory = useCallback((types: string[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      allSources
        .filter((s) => types.includes(s.type))
        .forEach((s) => next.add(s.id));
      return next;
    });
  }, [allSources]);

  // Deselect all in category
  const deselectCategory = useCallback((types: string[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      allSources
        .filter((s) => types.includes(s.type))
        .forEach((s) => next.delete(s.id));
      return next;
    });
  }, [allSources]);

  // Notify parent of selection changes
  useEffect(() => {
    onSourcesSelected(Array.from(selectedIds));
  }, [selectedIds, onSourcesSelected]);

  // Handle populate
  const handlePopulate = async () => {
    setIsPopulating(true);
    try {
      await onPopulate(Array.from(selectedIds));
    } finally {
      setIsPopulating(false);
    }
  };

  // Get sources by category
  const getSourcesByCategory = (types: string[]) => {
    return allSources.filter((s) => types.includes(s.type));
  };

  // Get recommendation score for a source
  const getRecommendationScore = (sourceId: string): number | null => {
    const rec = recommended.find((r) => r.source.id === sourceId);
    return rec ? rec.score : null;
  };

  // Get recommendation reasons
  const getRecommendationReasons = (sourceId: string): string[] => {
    const rec = recommended.find((r) => r.source.id === sourceId);
    return rec ? rec.reasons : [];
  };

  if (isLoading) {
    return (
      <GlassCard className="p-6">
        <div className="flex items-center justify-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
          <span className="text-white/60">Loading corpus sources...</span>
        </div>
      </GlassCard>
    );
  }

  if (error) {
    return (
      <GlassCard className="p-6">
        <div className="text-center">
          <p className="text-red-400">{error}</p>
          <GlassButton onClick={loadSources} className="mt-4">
            Retry
          </GlassButton>
        </div>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Corpus Sources</h3>
          <p className="text-sm text-white/60">
            Select sources for vocabulary extraction
          </p>
        </div>
        <div className="flex items-center gap-2">
          <GlassBadge variant="info">
            {selectedIds.size} selected
          </GlassBadge>
          <GlassButton
            onClick={() => setSelectedIds(new Set(defaultIds))}
            variant="ghost"
            size="sm"
            disabled={disabled}
          >
            Reset to Recommended
          </GlassButton>
        </div>
      </div>

      {/* Recommended Sources */}
      {recommended.length > 0 && (
        <GlassCard className="p-4">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-medium text-white">
            <span>⭐</span>
            <span>Recommended for Your Goal</span>
          </h4>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {recommended.slice(0, 6).map((rec) => (
              <button
                key={rec.source.id}
                onClick={() => toggleSource(rec.source.id)}
                disabled={disabled}
                className={`
                  flex items-start gap-3 rounded-lg border p-3 text-left transition-all
                  ${
                    selectedIds.has(rec.source.id)
                      ? 'border-blue-500/50 bg-blue-500/20'
                      : 'border-white/10 bg-white/5 hover:border-white/20'
                  }
                  ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
                `}
              >
                <div
                  className={`
                    mt-0.5 h-4 w-4 rounded border-2 transition-colors
                    ${
                      selectedIds.has(rec.source.id)
                        ? 'border-blue-500 bg-blue-500'
                        : 'border-white/30'
                    }
                  `}
                >
                  {selectedIds.has(rec.source.id) && (
                    <svg className="h-3 w-3 text-white" viewBox="0 0 12 12">
                      <path
                        fill="currentColor"
                        d="M10 3L4.5 8.5 2 6"
                        stroke="currentColor"
                        strokeWidth="2"
                        fill="none"
                      />
                    </svg>
                  )}
                </div>
                <div className="flex-1 overflow-hidden">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-white">
                      {rec.source.name}
                    </span>
                    <span className="shrink-0 text-xs text-green-400">
                      {Math.round(rec.score * 100)}%
                    </span>
                  </div>
                  {rec.reasons.length > 0 && (
                    <p className="mt-1 truncate text-xs text-white/50">
                      {rec.reasons[0]}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </GlassCard>
      )}

      {/* All Sources by Category */}
      <div className="space-y-2">
        {SOURCE_CATEGORIES.map((category) => {
          const sources = getSourcesByCategory(category.types);
          if (sources.length === 0) return null;

          const selectedInCategory = sources.filter((s) =>
            selectedIds.has(s.id)
          ).length;
          const isExpanded = expandedCategory === category.label;

          return (
            <GlassCard key={category.label} className="overflow-hidden">
              {/* Category Header */}
              <button
                onClick={() =>
                  setExpandedCategory(isExpanded ? null : category.label)
                }
                className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-white/5"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{category.icon}</span>
                  <span className="font-medium text-white">{category.label}</span>
                  <span className="text-sm text-white/50">
                    ({selectedInCategory}/{sources.length})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {!isExpanded && selectedInCategory > 0 && (
                    <GlassBadge variant="success" size="sm">
                      {selectedInCategory} selected
                    </GlassBadge>
                  )}
                  <svg
                    className={`h-5 w-5 text-white/50 transition-transform ${
                      isExpanded ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </button>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="border-t border-white/10 p-4">
                  {/* Quick Actions */}
                  <div className="mb-3 flex gap-2">
                    <GlassButton
                      onClick={() => selectCategory(category.types)}
                      variant="ghost"
                      size="sm"
                      disabled={disabled}
                    >
                      Select All
                    </GlassButton>
                    <GlassButton
                      onClick={() => deselectCategory(category.types)}
                      variant="ghost"
                      size="sm"
                      disabled={disabled}
                    >
                      Deselect All
                    </GlassButton>
                  </div>

                  {/* Sources Grid */}
                  <div className="grid gap-2 sm:grid-cols-2">
                    {sources.map((source) => {
                      const score = getRecommendationScore(source.id);
                      const reasons = getRecommendationReasons(source.id);

                      return (
                        <button
                          key={source.id}
                          onClick={() => toggleSource(source.id)}
                          disabled={disabled}
                          className={`
                            flex items-start gap-3 rounded-lg border p-3 text-left transition-all
                            ${
                              selectedIds.has(source.id)
                                ? 'border-blue-500/50 bg-blue-500/20'
                                : 'border-white/10 bg-white/5 hover:border-white/20'
                            }
                            ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
                          `}
                        >
                          <div
                            className={`
                              mt-0.5 h-4 w-4 rounded border-2 transition-colors
                              ${
                                selectedIds.has(source.id)
                                  ? 'border-blue-500 bg-blue-500'
                                  : 'border-white/30'
                              }
                            `}
                          >
                            {selectedIds.has(source.id) && (
                              <svg className="h-3 w-3 text-white" viewBox="0 0 12 12">
                                <path
                                  fill="currentColor"
                                  d="M10 3L4.5 8.5 2 6"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  fill="none"
                                />
                              </svg>
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-white">
                                {source.name}
                              </span>
                              {score !== null && (
                                <span className="text-xs text-green-400">
                                  {Math.round(score * 100)}%
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-xs text-white/50">
                              {source.description}
                            </p>
                            {reasons.length > 0 && (
                              <p className="mt-1 text-xs italic text-blue-300/70">
                                {reasons[0]}
                              </p>
                            )}
                            <div className="mt-2 flex flex-wrap gap-1">
                              {source.domains.slice(0, 3).map((domain) => (
                                <span
                                  key={domain}
                                  className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-white/60"
                                >
                                  {domain}
                                </span>
                              ))}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </GlassCard>
          );
        })}
      </div>

      {/* Populate Button */}
      <div className="flex justify-end pt-4">
        <GlassButton
          onClick={handlePopulate}
          disabled={disabled || selectedIds.size === 0 || isPopulating}
          className="min-w-[200px]"
        >
          {isPopulating ? (
            <span className="flex items-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
              Populating...
            </span>
          ) : (
            `Populate Vocabulary (${selectedIds.size} sources)`
          )}
        </GlassButton>
      </div>
    </div>
  );
};

export default CorpusSourceSelector;
