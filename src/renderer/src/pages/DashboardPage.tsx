import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { GoalSpec } from '../../../shared/types';
import { isMvpMode } from '../../../shared/mvp-config';

export default function DashboardPage() {
    const navigate = useNavigate();
    const [goals, setGoals] = useState<GoalSpec[]>([]);
    const [activeGoal, setActiveGoal] = useState<GoalSpec | null>(null);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        vocabularyCoverage: 0,
        averageMasteryStage: 0,
        wordsReady: 0,
    });
    const [recentSessions, setRecentSessions] = useState<any[]>([]);

    useEffect(() => {
        loadDashboard();
    }, []);

    const loadDashboard = async () => {
        try {
            // Load user's goals
            const goalsList = await window.logos.goal.list(false);
            setGoals(goalsList);

            if (goalsList.length > 0) {
                const goal = goalsList[0]; // Get first active goal
                setActiveGoal(goal);

                // Load vocabulary stats
                const objects = await window.logos.object.list(goal.id, { limit: 1000 });
                const totalObjects = objects.length;
                const masteredObjects = objects.filter((obj: any) => obj.masteryState?.stage >= 3).length;
                const coverage = totalObjects > 0 ? (masteredObjects / totalObjects) * 100 : 0;

                // Calculate average mastery
                let totalStage = 0;
                let count = 0;
                for (const obj of objects) {
                    if (obj.masteryState) {
                        totalStage += obj.masteryState.stage;
                        count++;
                    }
                }
                const avgStage = count > 0 ? totalStage / count : 0;

                // Count words ready for review
                const queue = await window.logos.queue.build(goal.id, { sessionSize: 100 });
                const readyCount = queue.length;

                setStats({
                    vocabularyCoverage: Math.round(coverage),
                    averageMasteryStage: parseFloat(avgStage.toFixed(1)),
                    wordsReady: readyCount,
                });

                // Load recent sessions (MVP: limit to 5)
                const sessions = await window.logos.session.getHistory(goal.id, {
                    limit: isMvpMode() ? 5 : 20,
                });
                setRecentSessions(sessions);
            }
        } catch (error) {
            console.error('Failed to load dashboard:', error);
        } finally {
            setLoading(false);
        }
    };

    const startSession = () => {
        if (activeGoal) {
            navigate(`/session/${activeGoal.id}`);
        }
    };

    if (loading) {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100vh',
                color: 'var(--color-text-secondary)',
            }}>
                <div className="spinner" style={{ width: '40px', height: '40px' }} />
                <span style={{ marginLeft: 'var(--spacing-md)' }}>Loading your progress...</span>
            </div>
        );
    }

    if (!activeGoal) {
        return (
            <div className="container" style={{ paddingTop: 'var(--spacing-2xl)' }}>
                <div className="card text-center">
                    <h2>Welcome to LOGOS!</h2>
                    <p className="text-secondary">
                        You don't have any active learning goals yet. Complete the onboarding to get started.
                    </p>
                    <button className="btn btn-primary" onClick={() => navigate('/onboarding')}>
                        Create Your First Goal
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', paddingBottom: 'var(--spacing-2xl)' }}>
            {/* Header */}
            <header style={{
                backgroundColor: 'var(--color-surface)',
                borderBottom: '1px solid var(--color-border)',
                padding: 'var(--spacing-lg) 0',
                marginBottom: 'var(--spacing-2xl)',
            }}>
                <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '1.5rem' }}>
                            {activeGoal.domain.charAt(0).toUpperCase() + activeGoal.domain.slice(1)} Learning
                        </h1>
                        {activeGoal.benchmark && (
                            <p className="text-secondary" style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem' }}>
                                Preparing for: {activeGoal.benchmark}
                            </p>
                        )}
                    </div>
                    <button className="btn btn-secondary" onClick={() => navigate('/settings')}>
                        ⚙️ Settings
                    </button>
                </div>
            </header>

            <div className="container">
                {/* Key Metrics */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 'var(--spacing-lg)', marginBottom: 'var(--spacing-2xl)' }}>
                    <div className="card">
                        <div className="text-secondary" style={{ fontSize: '0.875rem', marginBottom: 'var(--spacing-sm)' }}>
                            Vocabulary Coverage
                        </div>
                        <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                            {stats.vocabularyCoverage}%
                        </div>
                        <div className="progress-bar" style={{ marginTop: 'var(--spacing-md)' }}>
                            <div className="progress-bar-fill" style={{ width: `${stats.vocabularyCoverage}%` }} />
                        </div>
                    </div>

                    <div className="card">
                        <div className="text-secondary" style={{ fontSize: '0.875rem', marginBottom: 'var(--spacing-sm)' }}>
                            Average Mastery Stage
                        </div>
                        <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--color-success)' }}>
                            {stats.averageMasteryStage}
                        </div>
                        <div className="text-secondary" style={{ fontSize: '0.75rem', marginTop: 'var(--spacing-sm)' }}>
                            out of 4.0 (Automatic)
                        </div>
                    </div>

                    <div className="card">
                        <div className="text-secondary" style={{ fontSize: '0.875rem', marginBottom: 'var(--spacing-sm)' }}>
                            Ready for Review
                        </div>
                        <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--color-warning)' }}>
                            {stats.wordsReady}
                        </div>
                        <div className="text-secondary" style={{ fontSize: '0.75rem', marginTop: 'var(--spacing-sm)' }}>
                            words waiting
                        </div>
                    </div>
                </div>

                {/* Start Session Button */}
                <div style={{ textAlign: 'center', marginBottom: 'var(--spacing-2xl)' }}>
                    <button
                        className="btn btn-primary"
                        onClick={startSession}
                        disabled={stats.wordsReady === 0}
                        style={{ fontSize: '1.25rem', padding: 'var(--spacing-lg) var(--spacing-2xl)' }}
                    >
                        {stats.wordsReady > 0 ? '🎯 Start Today\'s Session' : '✅ All Caught Up!'}
                    </button>
                    {stats.wordsReady > 0 && (
                        <p className="text-secondary" style={{ marginTop: 'var(--spacing-md)', fontSize: '0.875rem' }}>
                            Recommended session: 20-30 minutes
                        </p>
                    )}
                </div>

                {/* Recent Progress */}
                <div className="card">
                    <h3 style={{ marginBottom: 'var(--spacing-lg)' }}>Recent Progress</h3>
                    {recentSessions.length === 0 ? (
                        <p className="text-secondary text-center">
                            No sessions yet. Start your first session to begin learning!
                        </p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                            {recentSessions.map((session: any, index: number) => {
                                const date = new Date(session.startedAt);
                                const accuracy = session.correctCount > 0
                                    ? Math.round((session.correctCount / session.responseCount) * 100)
                                    : 0;

                                return (
                                    <div
                                        key={session.id}
                                        style={{
                                            padding: 'var(--spacing-md)',
                                            backgroundColor: 'var(--color-bg)',
                                            borderRadius: 'var(--radius-md)',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                        }}
                                    >
                                        <div>
                                            <div style={{ fontWeight: 500 }}>
                                                {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                            </div>
                                            <div className="text-secondary" style={{ fontSize: '0.875rem' }}>
                                                {session.itemsPracticed} words practiced
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div className={`badge ${accuracy >= 80 ? 'badge-success' : accuracy >= 60 ? 'badge-warning' : 'badge-error'}`}>
                                                {accuracy}% accuracy
                                            </div>
                                            {session.stageTransitions > 0 && (
                                                <div className="text-secondary" style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                                                    +{session.stageTransitions} advanced
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
