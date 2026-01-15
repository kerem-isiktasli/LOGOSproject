import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { GoalSpec } from '../../../shared/types';

interface OnboardingPageProps {
    onComplete: () => void;
}

export default function OnboardingPage({ onComplete }: OnboardingPageProps) {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        nativeLanguage: 'en',
        targetLanguage: 'en',
        domain: '',
        modality: [] as string[],
        purpose: '',
        benchmark: '',
        deadline: '',
        dailyTime: 30,
    });

    const domains = [
        { value: 'medicine', label: 'Medicine & Healthcare' },
        { value: 'business', label: 'Business & Finance' },
        { value: 'law', label: 'Law & Legal' },
        { value: 'technology', label: 'Technology & IT' },
        { value: 'academic', label: 'Academic & Research' },
        { value: 'everyday', label: 'Everyday Conversation' },
    ];

    const modalities = [
        { value: 'reading', label: '📖 Reading' },
        { value: 'writing', label: '✍️ Writing' },
        { value: 'listening', label: '🎧 Listening' },
        { value: 'speaking', label: '🗣️ Speaking' },
    ];

    const purposes = [
        { value: 'certification', label: 'Certification/Test (IELTS, TOEFL, etc.)' },
        { value: 'professional', label: 'Professional Work' },
        { value: 'academic', label: 'Academic Study' },
        { value: 'travel', label: 'Travel' },
        { value: 'personal', label: 'Personal Interest' },
    ];

    const handleModalityToggle = (value: string) => {
        setFormData(prev => ({
            ...prev,
            modality: prev.modality.includes(value)
                ? prev.modality.filter(m => m !== value)
                : [...prev.modality, value]
        }));
    };

    const handleComplete = async () => {
        if (formData.modality.length === 0) {
            setError('Please select at least one learning modality');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // Create user and goal through onboarding
            await window.logos.onboarding.complete({
                ...formData,
                modality: formData.modality,
            });

            onComplete();
            navigate('/');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to complete onboarding');
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        }}>
            <div className="card" style={{ maxWidth: '600px', width: '100%' }}>
                <div style={{ marginBottom: '2rem' }}>
                    <h1 style={{ color: 'var(--color-primary)', marginBottom: '0.5rem' }}>
                        Welcome to LOGOS
                    </h1>
                    <p className="text-secondary" style={{ fontSize: '1.125rem' }}>
                        Let's personalize your language learning journey
                    </p>
                </div>

                {error && (
                    <div style={{
                        padding: 'var(--spacing-md)',
                        backgroundColor: '#fee2e2',
                        color: '#991b1b',
                        borderRadius: 'var(--radius-md)',
                        marginBottom: 'var(--spacing-lg)',
                    }}>
                        {error}
                    </div>
                )}

                {step === 1 && (
                    <div>
                        <h3>What domain do you want to learn for?</h3>
                        <p className="text-secondary" style={{ fontSize: '0.875rem', marginBottom: 'var(--spacing-lg)' }}>
                            This helps us find the most relevant content for you
                        </p>

                        <div style={{ display: 'grid', gap: 'var(--spacing-md)' }}>
                            {domains.map(domain => (
                                <button
                                    key={domain.value}
                                    className={`card ${formData.domain === domain.value ? 'btn-primary' : ''}`}
                                    style={{
                                        padding: 'var(--spacing-lg)',
                                        textAlign: 'left',
                                        border: '2px solid',
                                        borderColor: formData.domain === domain.value ? 'var(--color-primary)' : 'var(--color-border)',
                                        backgroundColor: formData.domain === domain.value ? 'var(--color-primary)' : 'var(--color-surface)',
                                        color: formData.domain === domain.value ? 'white' : 'var(--color-text)',
                                    }}
                                    onClick={() => setFormData({ ...formData, domain: domain.value })}
                                >
                                    <div style={{ fontWeight: 600 }}>{domain.label}</div>
                                </button>
                            ))}
                        </div>

                        <div style={{ marginTop: 'var(--spacing-xl)', display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                                className="btn btn-primary"
                                disabled={!formData.domain}
                                onClick={() => setStep(2)}
                            >
                                Continue →
                            </button>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div>
                        <h3>Which skills do you want to practice?</h3>
                        <p className="text-secondary" style={{ fontSize: '0.875rem', marginBottom: 'var(--spacing-lg)' }}>
                            Select all that apply
                        </p>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--spacing-md)' }}>
                            {modalities.map(modality => (
                                <button
                                    key={modality.value}
                                    className={`card ${formData.modality.includes(modality.value) ? 'btn-primary' : ''}`}
                                    style={{
                                        padding: 'var(--spacing-lg)',
                                        textAlign: 'center',
                                        border: '2px solid',
                                        borderColor: formData.modality.includes(modality.value) ? 'var(--color-primary)' : 'var(--color-border)',
                                        backgroundColor: formData.modality.includes(modality.value) ? 'var(--color-primary)' : 'var(--color-surface)',
                                        color: formData.modality.includes(modality.value) ? 'white' : 'var(--color-text)',
                                    }}
                                    onClick={() => handleModalityToggle(modality.value)}
                                >
                                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
                                        {modality.label.match(/[\p{Emoji}]/u)?.[0]}
                                    </div>
                                    <div style={{ fontWeight: 600 }}>
                                        {modality.label.replace(/[\p{Emoji}\s]/gu, '')}
                                    </div>
                                </button>
                            ))}
                        </div>

                        <div style={{ marginTop: 'var(--spacing-xl)', display: 'flex', justifyContent: 'space-between' }}>
                            <button className="btn btn-secondary" onClick={() => setStep(1)}>
                                ← Back
                            </button>
                            <button
                                className="btn btn-primary"
                                disabled={formData.modality.length === 0}
                                onClick={() => setStep(3)}
                            >
                                Continue →
                            </button>
                        </div>
                    </div>
                )}

                {step === 3 && (
                    <div>
                        <h3>What's your goal?</h3>
                        <p className="text-secondary" style={{ fontSize: '0.875rem', marginBottom: 'var(--spacing-lg)' }}>
                            This helps us understand your learning objectives
                        </p>

                        <div style={{ display: 'grid', gap: 'var(--spacing-md)' }}>
                            {purposes.map(purpose => (
                                <button
                                    key={purpose.value}
                                    className={`card ${formData.purpose === purpose.value ? 'btn-primary' : ''}`}
                                    style={{
                                        padding: 'var(--spacing-lg)',
                                        textAlign: 'left',
                                        border: '2px solid',
                                        borderColor: formData.purpose === purpose.value ? 'var(--color-primary)' : 'var(--color-border)',
                                        backgroundColor: formData.purpose === purpose.value ? 'var(--color-primary)' : 'var(--color-surface)',
                                        color: formData.purpose === purpose.value ? 'white' : 'var(--color-text)',
                                    }}
                                    onClick={() => setFormData({ ...formData, purpose: purpose.value })}
                                >
                                    <div style={{ fontWeight: 600 }}>{purpose.label}</div>
                                </button>
                            ))}
                        </div>

                        {formData.purpose === 'certification' && (
                            <div style={{ marginTop: 'var(--spacing-lg)' }}>
                                <label style={{ display: 'block', marginBottom: 'var(--spacing-sm)', fontWeight: 500 }}>
                                    Specific test/certification (optional)
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g., IELTS, TOEFL, CELBAN"
                                    value={formData.benchmark}
                                    onChange={(e) => setFormData({ ...formData, benchmark: e.target.value })}
                                />
                            </div>
                        )}

                        <div style={{ marginTop: 'var(--spacing-lg)' }}>
                            <label style={{ display: 'block', marginBottom: 'var(--spacing-sm)', fontWeight: 500 }}>
                                Target deadline (optional)
                            </label>
                            <input
                                type="date"
                                value={formData.deadline}
                                onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                            />
                        </div>

                        <div style={{ marginTop: 'var(--spacing-lg)' }}>
                            <label style={{ display: 'block', marginBottom: 'var(--spacing-sm)', fontWeight: 500 }}>
                                Daily study time: {formData.dailyTime} minutes
                            </label>
                            <input
                                type="range"
                                min="10"
                                max="120"
                                step="10"
                                value={formData.dailyTime}
                                onChange={(e) => setFormData({ ...formData, dailyTime: parseInt(e.target.value) })}
                            />
                        </div>

                        <div style={{ marginTop: 'var(--spacing-xl)', display: 'flex', justifyContent: 'space-between' }}>
                            <button className="btn btn-secondary" onClick={() => setStep(2)}>
                                ← Back
                            </button>
                            <button
                                className="btn btn-primary"
                                disabled={loading || !formData.purpose}
                                onClick={handleComplete}
                            >
                                {loading ? <span className="spinner" /> : 'Complete Setup →'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Progress indicator */}
                <div style={{ marginTop: 'var(--spacing-2xl)', display: 'flex', justifyContent: 'center', gap: 'var(--spacing-sm)' }}>
                    {[1, 2, 3].map(i => (
                        <div
                            key={i}
                            style={{
                                width: '40px',
                                height: '4px',
                                borderRadius: '2px',
                                backgroundColor: i <= step ? 'var(--color-primary)' : 'var(--color-border)',
                                transition: 'background-color 0.3s',
                            }}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
