/**
 * Vocabulary Page
 *
 * Comprehensive vocabulary browser with detailed word information,
 * component analysis, and learning progress visualization.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { GlassCard } from '../components/ui/GlassCard';
import { GlassButton } from '../components/ui/GlassButton';
import { GlassBadge } from '../components/ui/GlassBadge';
import { GlassProgress } from '../components/ui/GlassProgress';

interface VocabularyPageProps {
  goalId?: string;
  onNavigateBack?: () => void;
}

interface LanguageObjectDetail {
  id: string;
  content: string;
  type: string;
  frequency: number;
  relationalDensity: number;
  morphologicalScore: number | null;
  phonologicalDifficulty: number | null;
  syntacticComplexity: number | null;
  pragmaticScore: number | null;
  domainDistribution: string | null;
  priority: number;
  irtDifficulty: number;
  masteryState: {
    stage: number;
    cueFreeAccuracy: number;
    cueAssistedAccuracy: number;
    exposureCount: number;
    nextReview: string | null;
  } | null;
  collocations: Array<{
    word: string;
    pmi: number;
    npmi: number;
  }>;
}

interface VocabularyStats {
  total: number;
  byType: Record<string, number>;
  byStage: Record<number, number>;
  averageFrequency: number;
  averagePriority: number;
}

const COMPONENT_LABELS: Record<string, { name: string; icon: string; color: string }> = {
  LEX: { name: 'Lexical', icon: '📚', color: 'bg-green-500' },
  MORPH: { name: 'Morphology', icon: '🔤', color: 'bg-blue-500' },
  G2P: { name: 'Phonology', icon: '🔊', color: 'bg-purple-500' },
  SYNT: { name: 'Syntax', icon: '📝', color: 'bg-yellow-500' },
  PRAG: { name: 'Pragmatics', icon: '💬', color: 'bg-orange-500' },
};

const STAGE_LABELS = ['Unknown', 'Recognition', 'Recall', 'Controlled', 'Automatic'];

export const VocabularyPage: React.FC<VocabularyPageProps> = ({ goalId, onNavigateBack }) => {
  const [objects, setObjects] = useState<LanguageObjectDetail[]>([]);
  const [selectedObject, setSelectedObject] = useState<LanguageObjectDetail | null>(null);
  const [stats, setStats] = useState<VocabularyStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [stageFilter, setStageFilter] = useState<number | 'all'>('all');
  const [sortBy, setSortBy] = useState<'priority' | 'frequency' | 'content'>('priority');

  // Load vocabulary data
  useEffect(() => {
    if (goalId) {
      loadVocabulary();
    }
  }, [goalId]);

  const loadVocabulary = async () => {
    if (!goalId) return;

    setIsLoading(true);
    try {
      // Load language objects using object.list API
      const result = await window.logos.object.list(goalId, {
        limit: 500,
      });

      // Handle both array and object response formats
      const objectList = Array.isArray(result) ? result : (result as any).objects || [];
      setObjects(objectList);

      // Calculate stats
      const byType: Record<string, number> = {};
      const byStage: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
      let totalFreq = 0;
      let totalPriority = 0;

      objectList.forEach((obj: LanguageObjectDetail) => {
        byType[obj.type] = (byType[obj.type] || 0) + 1;
        const stage = obj.masteryState?.stage ?? 0;
        byStage[stage] = (byStage[stage] || 0) + 1;
        totalFreq += obj.frequency;
        totalPriority += obj.priority;
      });

      setStats({
        total: objectList.length,
        byType,
        byStage,
        averageFrequency: objectList.length > 0 ? totalFreq / objectList.length : 0,
        averagePriority: objectList.length > 0 ? totalPriority / objectList.length : 0,
      });
    } catch (err) {
      console.error('Failed to load vocabulary:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter and sort objects
  const filteredObjects = objects
    .filter((obj) => {
      if (searchTerm && !obj.content.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      if (typeFilter !== 'all' && obj.type !== typeFilter) {
        return false;
      }
      if (stageFilter !== 'all') {
        const stage = obj.masteryState?.stage ?? 0;
        if (stage !== stageFilter) {
          return false;
        }
      }
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'priority':
          return b.priority - a.priority;
        case 'frequency':
          return b.frequency - a.frequency;
        case 'content':
          return a.content.localeCompare(b.content);
        default:
          return 0;
      }
    });

  // Render z(w) vector visualization
  const renderZVector = (obj: LanguageObjectDetail) => {
    const dimensions = [
      { label: 'Frequency', value: obj.frequency, color: 'bg-blue-500' },
      { label: 'Relational', value: obj.relationalDensity, color: 'bg-green-500' },
      { label: 'Morphological', value: obj.morphologicalScore ?? 0.5, color: 'bg-purple-500' },
      { label: 'Phonological', value: obj.phonologicalDifficulty ?? 0.5, color: 'bg-yellow-500' },
      { label: 'Syntactic', value: obj.syntacticComplexity ?? 0.5, color: 'bg-orange-500' },
      { label: 'Pragmatic', value: obj.pragmaticScore ?? 0.5, color: 'bg-pink-500' },
    ];

    return (
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-white/80">z(w) Vector</h4>
        {dimensions.map((dim) => (
          <div key={dim.label} className="flex items-center gap-2">
            <span className="w-24 text-xs text-white/60">{dim.label}</span>
            <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full ${dim.color} transition-all`}
                style={{ width: `${dim.value * 100}%` }}
              />
            </div>
            <span className="w-10 text-xs text-white/60 text-right">
              {(dim.value * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    );
  };

  if (!goalId) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6">
        <GlassCard className="max-w-md p-8 text-center">
          <h2 className="mb-2 text-xl font-semibold text-white">No Goal Selected</h2>
          <p className="mb-4 text-white/60">
            Select a learning goal to browse vocabulary.
          </p>
          {onNavigateBack && (
            <GlassButton onClick={onNavigateBack}>Go Back</GlassButton>
          )}
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Main vocabulary list */}
      <div className="flex-1 space-y-4 p-6 overflow-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Vocabulary</h1>
            <p className="text-white/60">
              {stats ? `${stats.total} items` : 'Loading...'}
            </p>
          </div>

          {/* Search */}
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white outline-none placeholder:text-white/40"
            />
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white outline-none"
          >
            <option value="all" className="bg-gray-900">All Types</option>
            {Object.entries(COMPONENT_LABELS).map(([code, info]) => (
              <option key={code} value={code} className="bg-gray-900">
                {info.icon} {info.name}
              </option>
            ))}
          </select>

          <select
            value={stageFilter === 'all' ? 'all' : stageFilter}
            onChange={(e) => setStageFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white outline-none"
          >
            <option value="all" className="bg-gray-900">All Stages</option>
            {STAGE_LABELS.map((label, stage) => (
              <option key={stage} value={stage} className="bg-gray-900">
                Stage {stage}: {label}
              </option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white outline-none"
          >
            <option value="priority" className="bg-gray-900">Sort by Priority</option>
            <option value="frequency" className="bg-gray-900">Sort by Frequency</option>
            <option value="content" className="bg-gray-900">Sort Alphabetically</option>
          </select>
        </div>

        {/* Stats Summary */}
        {stats && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {Object.entries(COMPONENT_LABELS).map(([code, info]) => (
              <GlassCard key={code} className="p-3">
                <div className="flex items-center gap-2">
                  <span>{info.icon}</span>
                  <span className="text-sm text-white/60">{info.name}</span>
                </div>
                <div className="mt-1 text-xl font-bold text-white">
                  {stats.byType[code] || 0}
                </div>
              </GlassCard>
            ))}
          </div>
        )}

        {/* Vocabulary List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
              <span className="text-white/60">Loading vocabulary...</span>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredObjects.map((obj) => {
              const componentInfo = COMPONENT_LABELS[obj.type] || {
                name: obj.type,
                icon: '?',
                color: 'bg-gray-500',
              };
              const stage = obj.masteryState?.stage ?? 0;

              return (
                <GlassCard
                  key={obj.id}
                  className={`p-4 cursor-pointer transition-colors hover:bg-white/10 ${
                    selectedObject?.id === obj.id ? 'ring-2 ring-blue-500' : ''
                  }`}
                  onClick={() => setSelectedObject(obj)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-lg ${componentInfo.color}`}
                      >
                        <span>{componentInfo.icon}</span>
                      </div>
                      <div>
                        <div className="font-medium text-white">{obj.content}</div>
                        <div className="text-xs text-white/40">
                          {componentInfo.name} | Stage {stage}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-sm text-white/60">Priority</div>
                        <div className="font-medium text-white">
                          {(obj.priority * 100).toFixed(0)}%
                        </div>
                      </div>
                      <GlassBadge
                        variant={stage >= 3 ? 'success' : stage >= 1 ? 'warning' : 'info'}
                      >
                        {STAGE_LABELS[stage]}
                      </GlassBadge>
                    </div>
                  </div>
                </GlassCard>
              );
            })}

            {filteredObjects.length === 0 && (
              <div className="py-8 text-center text-white/40">
                No vocabulary items found matching your filters.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Detail Panel */}
      {selectedObject && (
        <div className="w-96 border-l border-white/10 bg-white/5 p-6 overflow-auto">
          <div className="space-y-6">
            {/* Header */}
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">{selectedObject.content}</h2>
                <button
                  onClick={() => setSelectedObject(null)}
                  className="text-white/40 hover:text-white"
                >
                  ✕
                </button>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <GlassBadge>
                  {COMPONENT_LABELS[selectedObject.type]?.name || selectedObject.type}
                </GlassBadge>
                <GlassBadge variant="info">
                  Stage {selectedObject.masteryState?.stage ?? 0}
                </GlassBadge>
              </div>
            </div>

            {/* z(w) Vector */}
            <GlassCard className="p-4">
              {renderZVector(selectedObject)}
            </GlassCard>

            {/* Mastery State */}
            {selectedObject.masteryState && (
              <GlassCard className="p-4">
                <h4 className="text-sm font-medium text-white/80 mb-3">Mastery State</h4>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs text-white/60 mb-1">
                      <span>Cue-Free Accuracy</span>
                      <span>{(selectedObject.masteryState.cueFreeAccuracy * 100).toFixed(0)}%</span>
                    </div>
                    <GlassProgress
                      value={selectedObject.masteryState.cueFreeAccuracy * 100}
                      max={100}
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-white/60 mb-1">
                      <span>Cue-Assisted Accuracy</span>
                      <span>{(selectedObject.masteryState.cueAssistedAccuracy * 100).toFixed(0)}%</span>
                    </div>
                    <GlassProgress
                      value={selectedObject.masteryState.cueAssistedAccuracy * 100}
                      max={100}
                    />
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/60">Exposures</span>
                    <span className="text-white">{selectedObject.masteryState.exposureCount}</span>
                  </div>
                  {selectedObject.masteryState.nextReview && (
                    <div className="flex justify-between text-sm">
                      <span className="text-white/60">Next Review</span>
                      <span className="text-white">
                        {new Date(selectedObject.masteryState.nextReview).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </GlassCard>
            )}

            {/* IRT Parameters */}
            <GlassCard className="p-4">
              <h4 className="text-sm font-medium text-white/80 mb-3">IRT Parameters</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-white/40">Difficulty (b)</div>
                  <div className="text-lg font-bold text-white">
                    {selectedObject.irtDifficulty.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-white/40">Priority</div>
                  <div className="text-lg font-bold text-white">
                    {(selectedObject.priority * 100).toFixed(0)}%
                  </div>
                </div>
              </div>
            </GlassCard>

            {/* Collocations */}
            {selectedObject.collocations && selectedObject.collocations.length > 0 && (
              <GlassCard className="p-4">
                <h4 className="text-sm font-medium text-white/80 mb-3">Collocations</h4>
                <div className="space-y-2">
                  {selectedObject.collocations.slice(0, 10).map((coll, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="text-white">{coll.word}</span>
                      <div className="text-xs text-white/40">
                        PMI: {coll.pmi.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default VocabularyPage;
