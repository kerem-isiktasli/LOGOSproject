/**
 * OnboardingWizard
 *
 * Multi-step wizard for new users to set up their first learning goal.
 * Guides users through language selection, domain choice, and goal setting.
 */

import React, { useState, useCallback } from 'react';
import { GlassCard, GlassButton, GlassInput, GlassProgress } from '../ui';

// =============================================================================
// Types
// =============================================================================

interface OnboardingData {
  nativeLanguage: string;
  targetLanguage: string;
  domain: string;
  modality: string[];
  purpose: string;
  benchmark?: string;
  deadline?: string;
  dailyTime: number;
}

interface OnboardingWizardProps {
  onComplete: (data: OnboardingData) => Promise<void>;
  onSkip?: () => void;
}

type Step = 'welcome' | 'native' | 'target' | 'domain' | 'purpose' | 'schedule' | 'confirm';

// =============================================================================
// Constants
// =============================================================================

const LANGUAGES = [
  { code: 'en-US', name: 'English (US)', flag: '🇺🇸' },
  { code: 'en-GB', name: 'English (UK)', flag: '🇬🇧' },
  { code: 'es-ES', name: 'Spanish (Spain)', flag: '🇪🇸' },
  { code: 'es-MX', name: 'Spanish (Mexico)', flag: '🇲🇽' },
  { code: 'pt-BR', name: 'Portuguese (Brazil)', flag: '🇧🇷' },
  { code: 'pt-PT', name: 'Portuguese (Portugal)', flag: '🇵🇹' },
  { code: 'fr-FR', name: 'French', flag: '🇫🇷' },
  { code: 'de-DE', name: 'German', flag: '🇩🇪' },
  { code: 'it-IT', name: 'Italian', flag: '🇮🇹' },
  { code: 'ja-JP', name: 'Japanese', flag: '🇯🇵' },
  { code: 'ko-KR', name: 'Korean', flag: '🇰🇷' },
  { code: 'zh-CN', name: 'Chinese (Simplified)', flag: '🇨🇳' },
  { code: 'ar-SA', name: 'Arabic', flag: '🇸🇦' },
  { code: 'ru-RU', name: 'Russian', flag: '🇷🇺' },
];

const DOMAINS = [
  { id: 'general', name: 'General', icon: '🌍', description: 'Everyday communication and common situations' },
  { id: 'medical', name: 'Medical/Healthcare', icon: '🏥', description: 'Healthcare terminology and patient communication' },
  { id: 'business', name: 'Business', icon: '💼', description: 'Professional settings, meetings, and commerce' },
  { id: 'legal', name: 'Legal', icon: '⚖️', description: 'Legal terminology and formal documentation' },
  { id: 'academic', name: 'Academic', icon: '🎓', description: 'University studies and research' },
  { id: 'technology', name: 'Technology', icon: '💻', description: 'Software, IT, and technical discussions' },
  { id: 'travel', name: 'Travel', icon: '✈️', description: 'Navigation, hotels, and tourist situations' },
];

const PURPOSES = [
  { id: 'certification', name: 'Certification Exam', icon: '📜', description: 'Prepare for a specific test (CELBAN, IELTS, TOEFL, etc.)' },
  { id: 'professional', name: 'Professional Development', icon: '📈', description: 'Improve language skills for work' },
  { id: 'academic', name: 'Academic Studies', icon: '📚', description: 'Prepare for university or research' },
  { id: 'immigration', name: 'Immigration', icon: '🛂', description: 'Meet language requirements for visa/residency' },
  { id: 'personal', name: 'Personal Growth', icon: '🌱', description: 'Learn for fun, travel, or cultural connection' },
];

const MODALITIES = [
  { id: 'reading', name: 'Reading', icon: '📖' },
  { id: 'writing', name: 'Writing', icon: '✍️' },
  { id: 'listening', name: 'Listening', icon: '👂' },
  { id: 'speaking', name: 'Speaking', icon: '🗣️' },
];

// =============================================================================
// Component
// =============================================================================

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  onComplete,
  onSkip,
}) => {
  const [step, setStep] = useState<Step>('welcome');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<OnboardingData>({
    nativeLanguage: '',
    targetLanguage: '',
    domain: 'general',
    modality: ['reading', 'listening'],
    purpose: 'personal',
    dailyTime: 15,
  });

  // Step navigation
  const steps: Step[] = ['welcome', 'native', 'target', 'domain', 'purpose', 'schedule', 'confirm'];
  const currentIndex = steps.indexOf(step);
  const progress = (currentIndex / (steps.length - 1)) * 100;

  const goNext = useCallback(() => {
    const nextIndex = currentIndex + 1;
    if (nextIndex < steps.length) {
      setStep(steps[nextIndex]);
    }
  }, [currentIndex, steps]);

  const goBack = useCallback(() => {
    const prevIndex = currentIndex - 1;
    if (prevIndex >= 0) {
      setStep(steps[prevIndex]);
    }
  }, [currentIndex, steps]);

  // Update data
  const updateData = useCallback((updates: Partial<OnboardingData>) => {
    setData(prev => ({ ...prev, ...updates }));
  }, []);

  // Toggle modality
  const toggleModality = useCallback((modality: string) => {
    setData(prev => {
      const current = prev.modality;
      if (current.includes(modality)) {
        return { ...prev, modality: current.filter(m => m !== modality) };
      } else {
        return { ...prev, modality: [...current, modality] };
      }
    });
  }, []);

  // Handle completion
  const handleComplete = async () => {
    setLoading(true);
    try {
      await onComplete(data);
    } catch (error) {
      console.error('Onboarding failed:', error);
    } finally {
      setLoading(false);
    }
  };

  // Render step content
  const renderStep = () => {
    switch (step) {
      case 'welcome':
        return (
          <div className="text-center py-8">
            <div className="text-6xl mb-6">🎯</div>
            <h1 className="text-3xl font-bold mb-4">Welcome to LOGOS</h1>
            <p className="text-lg text-muted mb-8 max-w-md mx-auto">
              The intelligent language learning system that adapts to your goals
              and teaches exactly what you need, when you need it.
            </p>
            <div className="space-y-4 max-w-sm mx-auto text-left">
              <div className="flex items-start gap-3">
                <span className="text-2xl">📊</span>
                <div>
                  <div className="font-medium">Goal-Driven Learning</div>
                  <div className="text-sm text-muted">We start with your objective and work backwards</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-2xl">🧠</span>
                <div>
                  <div className="font-medium">Adaptive Difficulty</div>
                  <div className="text-sm text-muted">Content adjusts to your level in real-time</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-2xl">📈</span>
                <div>
                  <div className="font-medium">5-Stage Mastery</div>
                  <div className="text-sm text-muted">From recognition to automatic fluency</div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'native':
        return (
          <div className="py-6">
            <h2 className="text-2xl font-bold mb-2 text-center">What's your native language?</h2>
            <p className="text-muted mb-6 text-center">
              This helps us understand potential transfer patterns and common challenges.
            </p>
            <div className="grid grid-cols-2 gap-3 max-w-lg mx-auto">
              {LANGUAGES.map(lang => (
                <button
                  key={lang.code}
                  onClick={() => updateData({ nativeLanguage: lang.code })}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    data.nativeLanguage === lang.code
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <span className="text-2xl mr-2">{lang.flag}</span>
                  <span className="font-medium">{lang.name}</span>
                </button>
              ))}
            </div>
          </div>
        );

      case 'target':
        return (
          <div className="py-6">
            <h2 className="text-2xl font-bold mb-2 text-center">Which language do you want to learn?</h2>
            <p className="text-muted mb-6 text-center">
              Select your target language. We'll build a personalized curriculum for you.
            </p>
            <div className="grid grid-cols-2 gap-3 max-w-lg mx-auto">
              {LANGUAGES.filter(l => l.code !== data.nativeLanguage).map(lang => (
                <button
                  key={lang.code}
                  onClick={() => updateData({ targetLanguage: lang.code })}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    data.targetLanguage === lang.code
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <span className="text-2xl mr-2">{lang.flag}</span>
                  <span className="font-medium">{lang.name}</span>
                </button>
              ))}
            </div>
          </div>
        );

      case 'domain':
        return (
          <div className="py-6">
            <h2 className="text-2xl font-bold mb-2 text-center">What's your focus area?</h2>
            <p className="text-muted mb-6 text-center">
              We'll prioritize vocabulary and patterns relevant to your domain.
            </p>
            <div className="grid gap-3 max-w-lg mx-auto">
              {DOMAINS.map(domain => (
                <button
                  key={domain.id}
                  onClick={() => updateData({ domain: domain.id })}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    data.domain === domain.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{domain.icon}</span>
                    <div>
                      <div className="font-medium">{domain.name}</div>
                      <div className="text-sm text-muted">{domain.description}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );

      case 'purpose':
        return (
          <div className="py-6">
            <h2 className="text-2xl font-bold mb-2 text-center">What's your purpose?</h2>
            <p className="text-muted mb-6 text-center">
              This helps us set the right pace and targets.
            </p>
            <div className="grid gap-3 max-w-lg mx-auto mb-8">
              {PURPOSES.map(purpose => (
                <button
                  key={purpose.id}
                  onClick={() => updateData({ purpose: purpose.id })}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    data.purpose === purpose.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{purpose.icon}</span>
                    <div>
                      <div className="font-medium">{purpose.name}</div>
                      <div className="text-sm text-muted">{purpose.description}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <h3 className="font-medium mb-3 text-center">Which skills do you want to focus on?</h3>
            <div className="flex justify-center gap-3">
              {MODALITIES.map(mod => (
                <button
                  key={mod.id}
                  onClick={() => toggleModality(mod.id)}
                  className={`px-4 py-2 rounded-lg border-2 transition-all ${
                    data.modality.includes(mod.id)
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <span className="mr-2">{mod.icon}</span>
                  {mod.name}
                </button>
              ))}
            </div>
          </div>
        );

      case 'schedule':
        return (
          <div className="py-6">
            <h2 className="text-2xl font-bold mb-2 text-center">Set your schedule</h2>
            <p className="text-muted mb-6 text-center">
              Consistency beats intensity. Even 10 minutes daily creates lasting progress.
            </p>
            <div className="max-w-sm mx-auto space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Daily study time: {data.dailyTime} minutes
                </label>
                <input
                  type="range"
                  min="5"
                  max="60"
                  step="5"
                  value={data.dailyTime}
                  onChange={e => updateData({ dailyTime: parseInt(e.target.value) })}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted mt-1">
                  <span>5 min</span>
                  <span>30 min</span>
                  <span>60 min</span>
                </div>
              </div>

              {data.purpose === 'certification' && (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Target exam (optional)
                  </label>
                  <GlassInput
                    placeholder="e.g., CELBAN, IELTS, TOEFL"
                    value={data.benchmark || ''}
                    onChange={e => updateData({ benchmark: e.target.value })}
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2">
                  Target deadline (optional)
                </label>
                <GlassInput
                  type="date"
                  value={data.deadline || ''}
                  onChange={e => updateData({ deadline: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>
          </div>
        );

      case 'confirm':
        const nativeLang = LANGUAGES.find(l => l.code === data.nativeLanguage);
        const targetLang = LANGUAGES.find(l => l.code === data.targetLanguage);
        const domain = DOMAINS.find(d => d.id === data.domain);
        const purpose = PURPOSES.find(p => p.id === data.purpose);

        return (
          <div className="py-6">
            <h2 className="text-2xl font-bold mb-2 text-center">Ready to start!</h2>
            <p className="text-muted mb-6 text-center">
              Here's your personalized learning plan.
            </p>
            <GlassCard className="max-w-md mx-auto p-6 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted">Learning</span>
                <span className="font-medium">
                  {targetLang?.flag} {targetLang?.name}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted">Native language</span>
                <span className="font-medium">
                  {nativeLang?.flag} {nativeLang?.name}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted">Focus area</span>
                <span className="font-medium">{domain?.icon} {domain?.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted">Purpose</span>
                <span className="font-medium">{purpose?.icon} {purpose?.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted">Skills</span>
                <span className="font-medium">
                  {data.modality.map(m => MODALITIES.find(mod => mod.id === m)?.icon).join(' ')}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted">Daily commitment</span>
                <span className="font-medium">{data.dailyTime} minutes</span>
              </div>
              {data.benchmark && (
                <div className="flex justify-between items-center">
                  <span className="text-muted">Target exam</span>
                  <span className="font-medium">{data.benchmark}</span>
                </div>
              )}
              {data.deadline && (
                <div className="flex justify-between items-center">
                  <span className="text-muted">Deadline</span>
                  <span className="font-medium">{new Date(data.deadline).toLocaleDateString()}</span>
                </div>
              )}
            </GlassCard>
          </div>
        );

      default:
        return null;
    }
  };

  // Validation for each step
  const canProceed = () => {
    switch (step) {
      case 'welcome':
        return true;
      case 'native':
        return !!data.nativeLanguage;
      case 'target':
        return !!data.targetLanguage;
      case 'domain':
        return !!data.domain;
      case 'purpose':
        return !!data.purpose && data.modality.length > 0;
      case 'schedule':
        return data.dailyTime >= 5;
      case 'confirm':
        return true;
      default:
        return false;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        {/* Progress bar */}
        {step !== 'welcome' && (
          <div className="mb-6">
            <GlassProgress value={progress} max={100} className="h-2" />
            <div className="flex justify-between text-xs text-muted mt-2">
              <span>Step {currentIndex} of {steps.length - 1}</span>
              <span>{Math.round(progress)}% complete</span>
            </div>
          </div>
        )}

        {/* Content */}
        <GlassCard className="p-8">
          {renderStep()}

          {/* Navigation */}
          <div className="flex justify-between mt-8 pt-6 border-t border-border">
            <div>
              {step !== 'welcome' && (
                <GlassButton variant="ghost" onClick={goBack}>
                  ← Back
                </GlassButton>
              )}
            </div>
            <div className="flex gap-3">
              {onSkip && step === 'welcome' && (
                <GlassButton variant="ghost" onClick={onSkip}>
                  Skip for now
                </GlassButton>
              )}
              {step === 'confirm' ? (
                <GlassButton
                  variant="primary"
                  onClick={handleComplete}
                  disabled={loading}
                >
                  {loading ? 'Creating...' : 'Start Learning →'}
                </GlassButton>
              ) : (
                <GlassButton
                  variant="primary"
                  onClick={goNext}
                  disabled={!canProceed()}
                >
                  Continue →
                </GlassButton>
              )}
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
};

export default OnboardingWizard;
