import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import DashboardPage from './pages/DashboardPage';
import SessionPage from './pages/SessionPage';
import OnboardingPage from './pages/OnboardingPage';
import SettingsPage from './pages/SettingsPage';

function App() {
    const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        checkOnboardingStatus();
    }, []);

    const checkOnboardingStatus = async () => {
        try {
            const status = await window.logos.onboarding.checkStatus();
            setNeedsOnboarding(status.needsOnboarding);
        } catch (error) {
            console.error('Failed to check onboarding status:', error);
            // If check fails, assume onboarding needed
            setNeedsOnboarding(true);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100vh',
                backgroundColor: '#f8fafc',
                color: '#64748b',
                fontFamily: 'system-ui, -apple-system, sans-serif'
            }}>
                Loading LOGOS...
            </div>
        );
    }

    return (
        <Router>
            <Routes>
                {needsOnboarding ? (
                    <>
                        <Route path="/onboarding" element={<OnboardingPage onComplete={() => setNeedsOnboarding(false)} />} />
                        <Route path="*" element={<Navigate to="/onboarding" replace />} />
                    </>
                ) : (
                    <>
                        <Route path="/" element={<DashboardPage />} />
                        <Route path="/session/:goalId" element={<SessionPage />} />
                        <Route path="/settings" element={<SettingsPage />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </>
                )}
            </Routes>
        </Router>
    );
}

export default App;
