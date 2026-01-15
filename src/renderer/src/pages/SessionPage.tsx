import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Task, TaskContent } from '../../../shared/types';

export default function SessionPage() {
    const { goalId } = useParams<{ goalId: string }>();
    const navigate = useNavigate();
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [currentTask, setCurrentTask] = useState<Task | null>(null);
    const [taskIndex, setTaskIndex] = useState(0);
    const [totalTasks, setTotalTasks] = useState(20);
    const [userAnswer, setUserAnswer] = useState('');
    const [showFeedback, setShowFeedback] = useState(false);
    const [isCorrect, setIsCorrect] = useState(false);
    const [startTime, setStartTime] = useState(Date.now());
    const [sessionStats, setSessionStats] = useState({
        correct: 0,
        total: 0,
    });

    useEffect(() => {
        if (goalId) {
            initSession();
        }
    }, [goalId]);

    const initSession = async () => {
        try {
            // Start a new session
            const session = await window.logos.session.start(goalId!, 'learning', 20);
            setSessionId(session.sessionId);

            // Load first task
            await loadNextTask();
        } catch (error) {
            console.error('Failed to start session:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadNextTask = async () => {
        try {
            // Get next item from queue
            const queueItem = await window.logos.queue.getNext(goalId!, []);

            if (!queueItem) {
                // No more tasks - end session
                endSession();
                return;
            }

            // Try to generate task from Claude
            try {
                const taskContent: TaskContent = await window.logos.claude.generateContent(
                    'exercise',
                    queueItem.objectId,
                    {
                        taskType: queueItem.stage === 0 ? 'recognition' : queueItem.stage === 1 ? 'recall' : 'production',
                        masteryStage: queueItem.stage,
                    }
                );

                const task: Task = {
                    id: Math.random().toString(),
                    spec: {
                        objectId: queueItem.objectId,
                        targetContent: queueItem.content,
                        targetStage: queueItem.stage,
                        taskType: queueItem.stage === 0 ? 'recognition' : queueItem.stage === 1 ? 'recall_free' : 'production',
                        taskFormat: 'mcq',
                        modality: 'visual',
                        domain: 'general',
                        userTheta: 0,
                    },
                    content: taskContent,
                    generatedAt: new Date(),
                    expiresAt: new Date(Date.now() + 86400000),
                };

                setCurrentTask(task);
            } catch (err) {
                // Fallback to simple task
                const fallbackContent: TaskContent = {
                    prompt: `What does "${queueItem.content}" mean?`,
                    correctAnswer: queueItem.content,
                    distractors: ['Option A', 'Option B', 'Option C'],
                    hints: [],
                    context: '',
                    explanation: `This is a learning task for: ${queueItem.content}`,
                };

                setCurrentTask({
                    id: Math.random().toString(),
                    spec: {
                        objectId: queueItem.objectId,
                        targetContent: queueItem.content,
                        targetStage: 0,
                        taskType: 'recognition',
                        taskFormat: 'mcq',
                        modality: 'visual',
                        domain: 'general',
                        userTheta: 0,
                    },
                    content: fallbackContent,
                    generatedAt: new Date(),
                    expiresAt: new Date(Date.now() + 86400000),
                });
            }

            setUserAnswer('');
            setShowFeedback(false);
            setStartTime(Date.now());
        } catch (error) {
            console.error('Failed to load task:', error);
        }
    };

    const submitAnswer = () => {
        if (!currentTask || !sessionId) return;

        const correct = userAnswer.toLowerCase().trim() === currentTask.content.correctAnswer.toLowerCase().trim();
        setIsCorrect(correct);
        setShowFeedback(true);

        // Record response
        const responseTime = Date.now() - startTime;
        window.logos.session.recordResponse({
            sessionId,
            objectId: currentTask.spec.objectId,
            correct,
            cueLevel: 0,
            responseTimeMs: responseTime,
            errorComponents: correct ? undefined : ['LEX'],
        });

        setSessionStats(prev => ({
            correct: prev.correct + (correct ? 1 : 0),
            total: prev.total + 1,
        }));
    };

    const nextTask = () => {
        if (taskIndex + 1 >= totalTasks) {
            endSession();
        } else {
            setTaskIndex(taskIndex + 1);
            loadNextTask();
        }
    };

    const endSession = async () => {
        if (sessionId) {
            await window.logos.session.end(sessionId);
        }
        navigate('/');
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
                <div className="spinner" style={{ width: '40px', height: '40px' }} />
                <span style={{ marginLeft: 'var(--spacing-md)' }}>Preparing your session...</span>
            </div>
        );
    }

    if (!currentTask) {
        return (
            <div className="container" style={{ paddingTop: 'var(--spacing-2xl)' }}>
                <div className="card text-center">
                    <h2>No tasks available</h2>
                    <p className="text-secondary">Check back later or create more learning content.</p>
                    <button className="btn btn-primary" onClick={() => navigate('/')}>
                        Return to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    const accuracy = sessionStats.total > 0
        ? Math.round((sessionStats.correct / sessionStats.total) * 100)
        : 0;

    // Prepare options for MCQ (combine correct answer with distractors)
    const options = currentTask.content.distractors.length > 0
        ? [currentTask.content.correctAnswer, ...currentTask.content.distractors].sort(() => Math.random() - 0.5)
        : [];

    return (
        <div style={{ minHeight: '100vh', paddingBottom: 'var(--spacing-2xl)' }}>
            {/* Progress Header */}
            <header style={{
                backgroundColor: 'var(--color-surface)',
                borderBottom: '1px solid var(--color-border)',
                padding: 'var(--spacing-lg) 0',
                marginBottom: 'var(--spacing-2xl)',
            }}>
                <div className="container">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Learning Session</h2>
                            <p className="text-secondary" style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem' }}>
                                {taskIndex + 1} of {totalTasks} • {accuracy}% accuracy
                            </p>
                        </div>
                        <button className="btn btn-secondary" onClick={endSession}>
                            End Session
                        </button>
                    </div>
                    <div className="progress-bar">
                        <div className="progress-bar-fill" style={{ width: `${((taskIndex + 1) / totalTasks) * 100}%` }} />
                    </div>
                </div>
            </header>

            <div className="container" style={{ maxWidth: '800px' }}>
                <div className="card" style={{ padding: 'var(--spacing-2xl)' }}>
                    {/* Task Content */}
                    <div style={{ marginBottom: 'var(--spacing-2xl)' }}>
                        <div className="text-secondary" style={{ fontSize: '0.875rem', marginBottom: 'var(--spacing-sm)' }}>
                            {currentTask.spec.taskType.replace('_', ' ')}
                        </div>
                        <h3 style={{ fontSize: '1.5rem', marginBottom: 'var(--spacing-lg)' }}>
                            {currentTask.content.prompt}
                        </h3>

                        {/* Multiple Choice Options */}
                        {options.length > 0 && !showFeedback && (
                            <div style={{ display: 'grid', gap: 'var(--spacing-md)' }}>
                                {options.map((option, index) => (
                                    <button
                                        key={index}
                                        className={`card ${userAnswer === option ? 'btn-primary' : ''}`}
                                        style={{
                                            padding: 'var(--spacing-lg)',
                                            textAlign: 'left',
                                            border: '2px solid',
                                            borderColor: userAnswer === option ? 'var(--color-primary)' : 'var(--color-border)',
                                            backgroundColor: userAnswer === option ? 'var(--color-primary)' : 'var(--color-surface)',
                                            color: userAnswer === option ? 'white' : 'var(--color-text)',
                                        }}
                                        onClick={() => setUserAnswer(option)}
                                    >
                                        {option}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Free Text Input */}
                        {options.length === 0 && !showFeedback && (
                            <div>
                                <input
                                    type="text"
                                    value={userAnswer}
                                    onChange={(e) => setUserAnswer(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && userAnswer && submitAnswer()}
                                    placeholder="Type your answer..."
                                    autoFocus
                                    style={{ fontSize: '1.125rem', padding: 'var(--spacing-lg)' }}
                                />
                            </div>
                        )}

                        {/* Feedback */}
                        {showFeedback && (
                            <div
                                style={{
                                    padding: 'var(--spacing-xl)',
                                    borderRadius: 'var(--radius-lg)',
                                    backgroundColor: isCorrect ? '#d1fae5' : '#fee2e2',
                                    border: `2px solid ${isCorrect ? 'var(--color-success)' : 'var(--color-error)'}`,
                                }}
                            >
                                <div style={{
                                    fontSize: '1.5rem',
                                    marginBottom: 'var(--spacing-md)',
                                    color: isCorrect ? 'var(--color-success)' : 'var(--color-error)',
                                    fontWeight: 600,
                                }}>
                                    {isCorrect ? '✓ Correct!' : '✗ Incorrect'}
                                </div>
                                {!isCorrect && (
                                    <div>
                                        <div className="text-secondary" style={{ fontSize: '0.875rem' }}>
                                            Correct answer:
                                        </div>
                                        <div style={{ fontSize: '1.125rem', fontWeight: 500 }}>
                                            {currentTask.content.correctAnswer}
                                        </div>
                                    </div>
                                )}
                                {currentTask.content.explanation && (
                                    <div style={{ marginTop: 'var(--spacing-md)', fontSize: '0.875rem' }}>
                                        <div className="text-secondary">Explanation:</div>
                                        <div>{currentTask.content.explanation}</div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--spacing-md)' }}>
                        {!showFeedback ? (
                            <button
                                className="btn btn-primary"
                                onClick={submitAnswer}
                                disabled={!userAnswer}
                                style={{ minWidth: '200px' }}
                            >
                                Submit Answer
                            </button>
                        ) : (
                            <button
                                className="btn btn-primary"
                                onClick={nextTask}
                                style={{ minWidth: '200px' }}
                            >
                                {taskIndex + 1 >= totalTasks ? 'Complete Session' : 'Next Question →'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
