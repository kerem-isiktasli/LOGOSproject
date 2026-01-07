/**
 * GoalsPage
 *
 * Goal management page for creating and viewing learning goals.
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../context';
import { useGoals, useCreateGoal, useDeleteGoal } from '../hooks';
import { GoalCard, CreateGoalForm, type CreateGoalFormData } from '../components/goal';
import { GlassCard, GlassButton } from '../components/ui';

interface GoalsPageProps {
  onNavigateBack?: () => void;
  onSelectGoal?: (goalId: string) => void;
}

export const GoalsPage: React.FC<GoalsPageProps> = ({
  onNavigateBack,
  onSelectGoal,
}) => {
  const { activeGoalId, setActiveGoal, refreshGoals } = useApp();
  const { data: goals, loading: goalsLoading } = useGoals();
  const { createGoal, loading: creating } = useCreateGoal();
  const { deleteGoal } = useDeleteGoal();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);

  // Set portal container after mount
  useEffect(() => {
    setPortalContainer(document.body);
  }, []);

  // Handle goal creation - accepts CreateGoalFormData from the form
  const handleCreateGoal = async (data: CreateGoalFormData) => {
    try {
      // Pass data directly to API (domain, modality, genre, purpose are required)
      const goalData = {
        domain: data.domain,
        modality: data.modality,
        genre: data.genre,
        purpose: data.purpose,
        benchmark: data.benchmark,
        deadline: data.deadline,
      };

      const newGoal = await createGoal(goalData);
      setShowCreateForm(false);
      refreshGoals();

      // Auto-select the new goal
      if (newGoal?.id) {
        setActiveGoal(newGoal.id);
        onSelectGoal?.(newGoal.id);
      }
    } catch (error) {
      console.error('Failed to create goal:', error);
    }
  };

  // Handle goal selection
  const handleSelectGoal = (goalId: string) => {
    setActiveGoal(goalId);
    onSelectGoal?.(goalId);
  };

  // Handle goal deletion
  const handleDeleteGoal = async (goalId: string) => {
    if (!confirm('Are you sure you want to delete this goal? All progress will be lost.')) {
      return;
    }

    try {
      await deleteGoal(goalId);
      refreshGoals();

      // Clear active goal if deleted
      if (activeGoalId === goalId) {
        setActiveGoal(null);
      }
    } catch (error) {
      console.error('Failed to delete goal:', error);
    }
  };

  // Loading state
  if (goalsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-pulse text-4xl mb-4">🎯</div>
          <p className="text-muted">Loading goals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Learning Goals</h1>
          <p className="text-muted">Manage your language learning objectives</p>
        </div>
        <div className="flex gap-3">
          {onNavigateBack && (
            <GlassButton variant="ghost" onClick={onNavigateBack}>
              ← Back
            </GlassButton>
          )}
          <GlassButton variant="primary" onClick={() => setShowCreateForm(true)}>
            + New Goal
          </GlassButton>
        </div>
      </div>

      {/* Create Form Modal - Using Portal to render at body level */}
      {showCreateForm && portalContainer && createPortal(
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            zIndex: 9999,
          }}
          onClick={(e) => e.target === e.currentTarget && setShowCreateForm(false)}
        >
          <div
            style={{
              maxWidth: '32rem',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              backgroundColor: '#1e293b',
              borderRadius: '0.75rem',
              padding: '1.5rem',
            }}
          >
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'white', marginBottom: '1rem' }}>
              Create New Goal
            </h2>
            <CreateGoalForm
              onSubmit={handleCreateGoal}
              onCancel={() => setShowCreateForm(false)}
              loading={creating}
            />
          </div>
        </div>,
        portalContainer
      )}

      {/* Goals List */}
      {goals && goals.length > 0 ? (
        <div className="grid gap-4">
          {goals.map((goal: any) => (
            <GoalCard
              key={goal.id}
              goal={{
                id: goal.id,
                name: goal.name,
                targetLanguage: goal.targetLanguage,
                nativeLanguage: goal.nativeLanguage,
                description: goal.description,
                progress: goal.progress || 0,
                itemCount: goal.itemCount || 0,
                streak: goal.streak || 0,
                isActive: goal.id === activeGoalId,
              }}
              onSelect={() => handleSelectGoal(goal.id)}
              onDelete={() => handleDeleteGoal(goal.id)}
            />
          ))}
        </div>
      ) : (
        <GlassCard className="p-12 text-center">
          <div className="text-6xl mb-4">🌟</div>
          <h2 className="text-xl font-bold mb-2">No Goals Yet</h2>
          <p className="text-muted mb-6 max-w-md mx-auto">
            Create your first learning goal to start your journey.
            Define the language you want to learn and we'll help you get there.
          </p>
          <GlassButton variant="primary" size="lg" onClick={() => setShowCreateForm(true)}>
            Create Your First Goal
          </GlassButton>
        </GlassCard>
      )}

      {/* Tips Section */}
      {goals && goals.length > 0 && (
        <GlassCard className="mt-6 p-4" variant="info">
          <h3 className="font-medium mb-2">💡 Tips</h3>
          <ul className="text-sm text-muted space-y-1">
            <li>• Focus on one goal at a time for better results</li>
            <li>• Review items daily to maintain your streak</li>
            <li>• Add diverse content to cover all language components</li>
          </ul>
        </GlassCard>
      )}
    </div>
  );
};

export default GoalsPage;
