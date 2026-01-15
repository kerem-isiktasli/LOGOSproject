import { useNavigate } from 'react-router-dom';

export default function SettingsPage() {
    const navigate = useNavigate();

    return (
        <div style={{ minHeight: '100vh', paddingBottom: 'var(--spacing-2xl)' }}>
            <header style={{
                backgroundColor: 'var(--color-surface)',
                borderBottom: '1px solid var(--color-border)',
                padding: 'var(--spacing-lg) 0',
                marginBottom: 'var(--spacing-2xl)',
            }}>
                <div className="container">
                    <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Settings</h1>
                </div>
            </header>

            <div className="container" style={{ maxWidth: '800px' }}>
                <div className="card">
                    <h3>Application Settings</h3>
                    <p className="text-secondary">
                        Settings functionality coming soon. For now, you can manage your learning goals from the dashboard.
                    </p>
                    <button className="btn btn-primary" onClick={() => navigate('/')}>
                        ← Back to Dashboard
                    </button>
                </div>
            </div>
        </div>
    );
}
