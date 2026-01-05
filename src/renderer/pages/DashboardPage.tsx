/**
 * DashboardPage
 *
 * Main landing page showing progress overview and quick actions.
 * Integrates ProgressDashboard and NetworkGraph visualizations.
 */

import React, { useState, useMemo } from 'react';
import { useApp } from '../context';
import { useProgress, useMasteryStats, useBottlenecks, useObjects } from '../hooks';
import { ProgressDashboard, NetworkGraphCard } from '../components/analytics';
import type { GraphNode, GraphEdge } from '../components/analytics';
import { GlassCard, GlassButton, Logo } from '../components/ui';

interface DashboardPageProps {
  onNavigateToSession?: () => void;
  onNavigateToGoals?: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onNavigateToSession,
  onNavigateToGoals,
}) => {
  const { activeGoal, activeGoalId, goalsLoading } = useApp();
  const { data: progress, loading: progressLoading } = useProgress(activeGoalId);
  const { data: masteryStats } = useMasteryStats(activeGoalId);
  const { data: bottlenecks } = useBottlenecks(activeGoalId);
  const { data: objects, loading: objectsLoading, refetch: refetchObjects } = useObjects(activeGoalId);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  // Build network graph data from language objects
  const { graphNodes, graphEdges } = useMemo(() => {
    const objectsArray = Array.isArray(objects) ? objects : [];
    if (objectsArray.length === 0) {
      return { graphNodes: [], graphEdges: [] };
    }

    // Create nodes from objects
    const nodes: GraphNode[] = objectsArray.slice(0, 30).map((obj: any) => ({
      id: obj.id,
      label: obj.content,
      type: obj.type === 'MWE' ? 'phrase' : 'word',
      masteryStage: obj.masteryState?.stage ?? 0,
      component: obj.componentType,
    }));

    // Build edges from collocations (if available) or connect high-priority items
    const edges: GraphEdge[] = [];

    // Connect items based on shared properties (simplified network)
    for (let i = 0; i < nodes.length && edges.length < 50; i++) {
      for (let j = i + 1; j < nodes.length && edges.length < 50; j++) {
        const node1 = nodes[i];
        const node2 = nodes[j];

        // Connect items with same component or similar mastery
        if (node1.component && node1.component === node2.component) {
          edges.push({
            source: node1.id,
            target: node2.id,
            type: 'semantic',
            weight: 0.5,
          });
        } else if (Math.abs(node1.masteryStage - node2.masteryStage) <= 1 && Math.random() < 0.2) {
          edges.push({
            source: node1.id,
            target: node2.id,
            type: 'collocation',
            weight: 0.3,
          });
        }
      }
    }

    return { graphNodes: nodes, graphEdges: edges };
  }, [objects]);

  // Loading state
  if (goalsLoading || progressLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-pulse text-4xl mb-4">📚</div>
          <p className="text-muted">Loading your progress...</p>
        </div>
      </div>
    );
  }

  // No goal selected
  if (!activeGoal) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6">
        <div className="text-center">
          <Logo size="xl" className="mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Welcome to LOGOS</h1>
          <p className="text-muted max-w-md">
            Start your language learning journey by creating a goal.
            Define what you want to learn and we'll guide you there.
          </p>
        </div>
        {onNavigateToGoals && (
          <GlassButton variant="primary" size="lg" onClick={onNavigateToGoals}>
            Create Your First Goal
          </GlassButton>
        )}
      </div>
    );
  }

  // Build progress data for dashboard with safe type guards
  const progressObj = progress && typeof progress === 'object' ? progress as any : null;
  const masteryObj = masteryStats && typeof masteryStats === 'object' ? masteryStats as any : null;

  const progressData = {
    overallProgress: progressObj?.overallProgress ?? progressObj?.total ?? 0,
    totalItems: progressObj?.totalItems ?? progressObj?.mastered ?? 0,
    masteryDistribution: masteryObj?.distribution ?? [0, 0, 0, 0, 0] as [number, number, number, number, number],
    dueCount: progressObj?.dueCount ?? progressObj?.learning ?? 0,
    streak: progressObj?.streak ?? 0,
    totalStudyTime: progressObj?.totalStudyTime ?? 0,
    averageAccuracy: progressObj?.averageAccuracy ?? progressObj?.accuracy ?? 0,
    cueFreeAccuracy: progressObj?.cueFreeAccuracy ?? 0,
  };

  // Build bottleneck data with safe type guards
  const bottlenecksObj = bottlenecks && typeof bottlenecks === 'object' ? bottlenecks as any : null;
  const bottlenecksList = bottlenecksObj?.bottlenecks ?? (Array.isArray(bottlenecks) ? bottlenecks : []);

  const bottleneckData = bottlenecksList.length > 0 ? {
    primaryBottleneck: bottlenecksList[0].component,
    confidence: bottlenecksList[0].confidence ?? 0.5,
    evidence: bottlenecksList.map((b: any) => ({
      component: b.component,
      errorRate: b.errorRate,
      totalErrors: b.totalErrors,
    })),
    recommendation: bottlenecksList[0].recommendation || 'Focus on this area to improve.',
  } : undefined;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <ProgressDashboard
        goal={{
          id: activeGoal.id,
          name: activeGoal.name,
          targetLanguage: activeGoal.targetLanguage,
        }}
        progress={progressData}
        bottleneck={bottleneckData}
        onStartSession={onNavigateToSession}
      />

      {/* Vocabulary Network */}
      <div className="mt-6">
        <NetworkGraphCard
          title="Vocabulary Network"
          nodes={graphNodes}
          edges={graphEdges}
          selectedNode={selectedNode}
          onNodeClick={(nodeId) => setSelectedNode(nodeId === selectedNode ? null : nodeId)}
          onRefresh={refetchObjects}
          loading={objectsLoading}
          width={700}
          height={350}
          enablePhysics={true}
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-4 mt-6">
        <GlassCard className="p-4 text-center cursor-pointer hover:scale-[1.02] transition-transform" onClick={onNavigateToSession}>
          <span className="text-2xl">📝</span>
          <p className="font-medium mt-2">Practice</p>
          <p className="text-xs text-muted">Start a learning session</p>
        </GlassCard>
        <GlassCard className="p-4 text-center cursor-pointer hover:scale-[1.02] transition-transform" onClick={onNavigateToGoals}>
          <span className="text-2xl">🎯</span>
          <p className="font-medium mt-2">Goals</p>
          <p className="text-xs text-muted">Manage learning goals</p>
        </GlassCard>
        <GlassCard className="p-4 text-center cursor-pointer hover:scale-[1.02] transition-transform">
          <span className="text-2xl">📊</span>
          <p className="font-medium mt-2">Analytics</p>
          <p className="text-xs text-muted">Detailed statistics</p>
        </GlassCard>
      </div>
    </div>
  );
};

export default DashboardPage;
