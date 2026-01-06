/**
 * Analytics Page
 *
 * Comprehensive learning analytics with progress tracking,
 * bottleneck detection, and mastery visualization.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { GlassCard } from '../components/ui/GlassCard';
import { GlassButton } from '../components/ui/GlassButton';
import { GlassBadge } from '../components/ui/GlassBadge';
import { GlassProgress } from '../components/ui/GlassProgress';
import { ProgressDashboard } from '../components/analytics/ProgressDashboard';
import { NetworkGraph } from '../components/analytics/NetworkGraph';

interface AnalyticsPageProps {
  goalId?: string;
}

interface ComponentBottleneck {
  component: string;
  errorRate: number;
  totalErrors: number;
  recentErrors: number;
  trend: number;
  recommendation: string;
  confidence: number;
}

interface ProgressStats {
  total: number;
  mastered: number;
  learning: number;
  accuracy: number;
  streak: number;
}

interface MasteryDistribution {
  0: number;
  1: number;
  2: number;
  3: number;
  4: number;
}

const COMPONENT_LABELS: Record<string, { name: string; icon: string; color: string }> = {
  PHON: { name: 'Phonology', icon: '🔊', color: 'bg-purple-500' },
  MORPH: { name: 'Morphology', icon: '🔤', color: 'bg-blue-500' },
  LEX: { name: 'Lexical', icon: '📚', color: 'bg-green-500' },
  SYNT: { name: 'Syntax', icon: '📝', color: 'bg-yellow-500' },
  PRAG: { name: 'Pragmatics', icon: '💬', color: 'bg-orange-500' },
};

const STAGE_LABELS = ['Unknown', 'Recognition', 'Recall', 'Controlled', 'Automatic'];

export const AnalyticsPage: React.FC<AnalyticsPageProps> = ({ goalId }) => {
  const [activeGoalId, setActiveGoalId] = useState<string | null>(goalId || null);
  const [goals, setGoals] = useState<Array<{ id: string; domain: string; purpose: string }>>([]);
  const [progress, setProgress] = useState<ProgressStats | null>(null);
  const [bottlenecks, setBottlenecks] = useState<ComponentBottleneck[]>([]);
  const [masteryDist, setMasteryDist] = useState<MasteryDistribution | null>(null);
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month' | 'all'>('week');
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'bottlenecks' | 'network'>('overview');

  // Load goals on mount
  useEffect(() => {
    loadGoals();
  }, []);

  // Load analytics when goal or time range changes
  useEffect(() => {
    if (activeGoalId) {
      loadAnalytics();
    }
  }, [activeGoalId, timeRange]);

  const loadGoals = async () => {
    try {
      const result = await window.logos.goal.list(false);
      const goalList = Array.isArray(result) ? result : (result as any).goals || [];
      setGoals(goalList);
      if (!activeGoalId && goalList.length > 0) {
        setActiveGoalId(goalList[0].id);
      }
    } catch (err) {
      console.error('Failed to load goals:', err);
    }
  };

  const loadAnalytics = async () => {
    if (!activeGoalId) return;

    setIsLoading(true);
    try {
      // Load progress stats
      const progressData = await window.logos.analytics.getProgress(activeGoalId, timeRange);
      setProgress(progressData);

      // Load bottlenecks
      const bottleneckData = await window.logos.claude.getBottlenecks(activeGoalId, 5);
      setBottlenecks(bottleneckData.bottlenecks || []);

      // Load mastery distribution
      const masteryData = await window.logos.mastery.getStats(activeGoalId);
      setMasteryDist(masteryData.distribution as MasteryDistribution);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate mastery percentage
  const getMasteryPercentage = () => {
    if (!masteryDist) return 0;
    const total = Object.values(masteryDist).reduce((a, b) => a + b, 0);
    if (total === 0) return 0;
    const mastered = (masteryDist[3] || 0) + (masteryDist[4] || 0);
    return Math.round((mastered / total) * 100);
  };

  if (goals.length === 0 && !isLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6">
        <GlassCard className="max-w-md p-8 text-center">
          <h2 className="mb-2 text-xl font-semibold text-white">No Goals Yet</h2>
          <p className="mb-4 text-white/60">
            Create a learning goal to start tracking your progress.
          </p>
          <GlassButton onClick={() => window.location.hash = '#/goals'}>
            Create Goal
          </GlassButton>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <p className="text-white/60">Track your learning progress and identify areas for improvement</p>
        </div>

        {/* Goal Selector */}
        <div className="flex items-center gap-3">
          <select
            value={activeGoalId || ''}
            onChange={(e) => setActiveGoalId(e.target.value)}
            className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white outline-none"
          >
            {goals.map((goal) => (
              <option key={goal.id} value={goal.id} className="bg-gray-900">
                {goal.domain} - {goal.purpose}
              </option>
            ))}
          </select>

          {/* Time Range */}
          <div className="flex rounded-lg border border-white/20 bg-white/5">
            {(['day', 'week', 'month', 'all'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 text-sm capitalize transition-colors ${
                  timeRange === range
                    ? 'bg-blue-500/30 text-blue-300'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-white/10 pb-2">
        {[
          { key: 'overview', label: 'Overview', icon: '📊' },
          { key: 'bottlenecks', label: 'Bottlenecks', icon: '🎯' },
          { key: 'network', label: 'Network', icon: '🕸️' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={`flex items-center gap-2 rounded-t-lg px-4 py-2 text-sm transition-colors ${
              activeTab === tab.key
                ? 'bg-white/10 text-white'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
            <span className="text-white/60">Loading analytics...</span>
          </div>
        </div>
      ) : (
        <>
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Quick Stats */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <GlassCard className="p-4">
                  <div className="text-sm text-white/60">Items Learned</div>
                  <div className="mt-1 text-3xl font-bold text-white">
                    {progress?.mastered || 0}
                  </div>
                  <div className="mt-1 text-xs text-white/40">
                    of {progress?.total || 0} total
                  </div>
                </GlassCard>

                <GlassCard className="p-4">
                  <div className="text-sm text-white/60">Accuracy</div>
                  <div className="mt-1 text-3xl font-bold text-green-400">
                    {Math.round((progress?.accuracy || 0) * 100)}%
                  </div>
                  <div className="mt-1 text-xs text-white/40">
                    Overall accuracy rate
                  </div>
                </GlassCard>

                <GlassCard className="p-4">
                  <div className="text-sm text-white/60">Streak</div>
                  <div className="mt-1 text-3xl font-bold text-orange-400">
                    {progress?.streak || 0}
                  </div>
                  <div className="mt-1 text-xs text-white/40">
                    Days in a row
                  </div>
                </GlassCard>

                <GlassCard className="p-4">
                  <div className="text-sm text-white/60">Mastery</div>
                  <div className="mt-1 text-3xl font-bold text-blue-400">
                    {getMasteryPercentage()}%
                  </div>
                  <div className="mt-1 text-xs text-white/40">
                    Stage 3-4 items
                  </div>
                </GlassCard>
              </div>

              {/* Mastery Distribution */}
              {masteryDist && (
                <GlassCard className="p-6">
                  <h3 className="mb-4 text-lg font-semibold text-white">
                    Mastery Distribution
                  </h3>
                  <div className="space-y-3">
                    {STAGE_LABELS.map((label, stage) => {
                      const count = masteryDist[stage as keyof MasteryDistribution] || 0;
                      const total = Object.values(masteryDist).reduce((a, b) => a + b, 0);
                      const percent = total > 0 ? (count / total) * 100 : 0;

                      return (
                        <div key={stage} className="flex items-center gap-4">
                          <div className="w-24 text-sm text-white/60">
                            Stage {stage}
                          </div>
                          <div className="flex-1">
                            <GlassProgress value={percent} max={100} />
                          </div>
                          <div className="w-20 text-right text-sm">
                            <span className="text-white">{count}</span>
                            <span className="text-white/40"> ({Math.round(percent)}%)</span>
                          </div>
                          <div className="w-24 text-xs text-white/40">
                            {label}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </GlassCard>
              )}

              {/* Progress Dashboard */}
              {activeGoalId && (
                <ProgressDashboard goalId={activeGoalId} />
              )}
            </div>
          )}

          {/* Bottlenecks Tab */}
          {activeTab === 'bottlenecks' && (
            <div className="space-y-6">
              {/* Primary Bottleneck */}
              {bottlenecks.length > 0 && (
                <GlassCard className="border-l-4 border-l-red-500 p-6">
                  <div className="flex items-start gap-4">
                    <div className="text-4xl">
                      {COMPONENT_LABELS[bottlenecks[0].component]?.icon || '❓'}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-white">
                          Primary Bottleneck: {COMPONENT_LABELS[bottlenecks[0].component]?.name || bottlenecks[0].component}
                        </h3>
                        <GlassBadge variant="danger">
                          {Math.round(bottlenecks[0].errorRate * 100)}% error rate
                        </GlassBadge>
                      </div>
                      <p className="mt-2 text-white/60">
                        {bottlenecks[0].recommendation}
                      </p>
                      <div className="mt-3 flex items-center gap-4 text-sm text-white/40">
                        <span>Total errors: {bottlenecks[0].totalErrors}</span>
                        <span>Recent: {bottlenecks[0].recentErrors}</span>
                        <span>Confidence: {Math.round(bottlenecks[0].confidence * 100)}%</span>
                      </div>
                    </div>
                  </div>
                </GlassCard>
              )}

              {/* All Components */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(COMPONENT_LABELS).map(([code, info]) => {
                  const bottleneck = bottlenecks.find((b) => b.component === code);
                  const errorRate = bottleneck?.errorRate || 0;

                  return (
                    <GlassCard key={code} className="p-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-lg ${info.color}`}
                        >
                          <span className="text-xl">{info.icon}</span>
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-white">{info.name}</div>
                          <div className="text-sm text-white/60">{code}</div>
                        </div>
                        <div className="text-right">
                          <div
                            className={`text-lg font-bold ${
                              errorRate > 0.3
                                ? 'text-red-400'
                                : errorRate > 0.15
                                ? 'text-yellow-400'
                                : 'text-green-400'
                            }`}
                          >
                            {Math.round(errorRate * 100)}%
                          </div>
                          <div className="text-xs text-white/40">error rate</div>
                        </div>
                      </div>

                      {bottleneck && (
                        <div className="mt-3 border-t border-white/10 pt-3">
                          <p className="text-xs text-white/50">
                            {bottleneck.recommendation}
                          </p>
                          <div className="mt-2 flex items-center gap-2">
                            <span
                              className={`text-xs ${
                                bottleneck.trend > 0
                                  ? 'text-red-400'
                                  : bottleneck.trend < 0
                                  ? 'text-green-400'
                                  : 'text-white/40'
                              }`}
                            >
                              {bottleneck.trend > 0 ? '↑' : bottleneck.trend < 0 ? '↓' : '→'}
                              {' '}
                              {bottleneck.trend > 0 ? 'Increasing' : bottleneck.trend < 0 ? 'Improving' : 'Stable'}
                            </span>
                          </div>
                        </div>
                      )}
                    </GlassCard>
                  );
                })}
              </div>

              {bottlenecks.length === 0 && (
                <GlassCard className="p-8 text-center">
                  <div className="text-4xl">✨</div>
                  <h3 className="mt-2 text-lg font-semibold text-white">
                    No Bottlenecks Detected
                  </h3>
                  <p className="mt-1 text-white/60">
                    Keep practicing to generate bottleneck analysis data.
                  </p>
                </GlassCard>
              )}
            </div>
          )}

          {/* Network Tab */}
          {activeTab === 'network' && activeGoalId && (
            <div className="h-[600px]">
              <NetworkGraph goalId={activeGoalId} />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AnalyticsPage;
