/**
 * Settings Page
 *
 * User settings and preferences for the LOGOS application.
 * Includes learning preferences, notification settings, and appearance.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { GlassCard } from '../components/ui/GlassCard';
import { GlassButton } from '../components/ui/GlassButton';
import { GlassInput } from '../components/ui/GlassInput';
import type { UserSettings } from '../../shared/types';

interface SettingSection {
  title: string;
  description: string;
  children: React.ReactNode;
}

const Section: React.FC<SettingSection> = ({ title, description, children }) => (
  <GlassCard className="p-6">
    <div className="mb-4">
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="text-sm text-white/60">{description}</p>
    </div>
    <div className="space-y-4">{children}</div>
  </GlassCard>
);

interface ToggleProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

const Toggle: React.FC<ToggleProps> = ({
  label,
  description,
  checked,
  onChange,
  disabled = false,
}) => (
  <label
    className={`
      flex items-center justify-between rounded-lg p-3 transition-colors
      ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-white/5'}
    `}
  >
    <div>
      <span className="text-sm font-medium text-white">{label}</span>
      {description && (
        <p className="text-xs text-white/50">{description}</p>
      )}
    </div>
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`
        relative h-6 w-11 rounded-full transition-colors
        ${checked ? 'bg-blue-500' : 'bg-white/20'}
        ${disabled ? '' : 'cursor-pointer'}
      `}
    >
      <span
        className={`
          absolute top-1 h-4 w-4 rounded-full bg-white transition-transform
          ${checked ? 'translate-x-6' : 'translate-x-1'}
        `}
      />
    </button>
  </label>
);

interface SliderProps {
  label: string;
  description?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
  disabled?: boolean;
}

const Slider: React.FC<SliderProps> = ({
  label,
  description,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
  disabled = false,
}) => (
  <div className="rounded-lg p-3">
    <div className="mb-2 flex items-center justify-between">
      <div>
        <span className="text-sm font-medium text-white">{label}</span>
        {description && (
          <p className="text-xs text-white/50">{description}</p>
        )}
      </div>
      <span className="text-sm font-medium text-blue-400">
        {value}{unit}
      </span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      disabled={disabled}
      className={`
        w-full h-2 rounded-lg appearance-none cursor-pointer
        bg-white/20 accent-blue-500
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    />
    <div className="mt-1 flex justify-between text-xs text-white/40">
      <span>{min}{unit}</span>
      <span>{max}{unit}</span>
    </div>
  </div>
);

interface SelectProps {
  label: string;
  description?: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
}

const Select: React.FC<SelectProps> = ({
  label,
  description,
  value,
  options,
  onChange,
  disabled = false,
}) => (
  <div className="rounded-lg p-3">
    <div className="mb-2">
      <span className="text-sm font-medium text-white">{label}</span>
      {description && (
        <p className="text-xs text-white/50">{description}</p>
      )}
    </div>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={`
        w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2
        text-sm text-white outline-none transition-colors
        focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value} className="bg-gray-900">
          {opt.label}
        </option>
      ))}
    </select>
  </div>
);

export const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<UserSettings>({
    dailyGoalMinutes: 30,
    sessionLength: 20,
    notificationsEnabled: true,
    soundEnabled: true,
    theme: 'system',
    targetRetention: 0.9,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const loaded = await window.logos.profile.getSettings();
      setSettings(loaded);
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Update a setting
  const updateSetting = useCallback(<K extends keyof UserSettings>(
    key: K,
    value: UserSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
    setSaveMessage(null);
  }, []);

  // Save settings
  const saveSettings = async () => {
    setIsSaving(true);
    try {
      await window.logos.profile.updateSettings(settings);
      setHasChanges(false);
      setSaveMessage('Settings saved successfully');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      console.error('Failed to save settings:', err);
      setSaveMessage('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  // Reset to defaults
  const resetToDefaults = () => {
    setSettings({
      dailyGoalMinutes: 30,
      sessionLength: 20,
      notificationsEnabled: true,
      soundEnabled: true,
      theme: 'system',
      targetRetention: 0.9,
    });
    setHasChanges(true);
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
          <span className="text-white/60">Loading settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-white/60">Customize your learning experience</p>
        </div>
        <div className="flex items-center gap-3">
          {saveMessage && (
            <span
              className={`text-sm ${
                saveMessage.includes('success') ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {saveMessage}
            </span>
          )}
          <GlassButton
            onClick={saveSettings}
            disabled={!hasChanges || isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </GlassButton>
        </div>
      </div>

      {/* Learning Preferences */}
      <Section
        title="Learning Preferences"
        description="Configure your daily learning goals and session settings"
      >
        <Slider
          label="Daily Goal"
          description="Minutes of learning per day"
          value={settings.dailyGoalMinutes}
          min={5}
          max={120}
          step={5}
          unit=" min"
          onChange={(v) => updateSetting('dailyGoalMinutes', v)}
        />

        <Slider
          label="Session Length"
          description="Default duration for learning sessions"
          value={settings.sessionLength}
          min={5}
          max={60}
          step={5}
          unit=" min"
          onChange={(v) => updateSetting('sessionLength', v)}
        />

        <Slider
          label="Target Retention"
          description="Desired accuracy rate for mastered items"
          value={Math.round(settings.targetRetention * 100)}
          min={70}
          max={99}
          step={1}
          unit="%"
          onChange={(v) => updateSetting('targetRetention', v / 100)}
        />
      </Section>

      {/* Notifications */}
      <Section
        title="Notifications"
        description="Control how LOGOS reminds you to practice"
      >
        <Toggle
          label="Enable Notifications"
          description="Receive reminders when items are due for review"
          checked={settings.notificationsEnabled}
          onChange={(v) => updateSetting('notificationsEnabled', v)}
        />

        <Toggle
          label="Sound Effects"
          description="Play sounds for correct/incorrect answers"
          checked={settings.soundEnabled}
          onChange={(v) => updateSetting('soundEnabled', v)}
        />
      </Section>

      {/* Appearance */}
      <Section
        title="Appearance"
        description="Customize the look and feel of the application"
      >
        <Select
          label="Theme"
          description="Choose your preferred color scheme"
          value={settings.theme}
          options={[
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
            { value: 'system', label: 'System Default' },
          ]}
          onChange={(v) => updateSetting('theme', v as UserSettings['theme'])}
        />
      </Section>

      {/* Data Management */}
      <Section
        title="Data Management"
        description="Export, import, or reset your learning data"
      >
        <div className="flex flex-wrap gap-3">
          <GlassButton variant="ghost">
            Export Data
          </GlassButton>
          <GlassButton variant="ghost">
            Import Data
          </GlassButton>
          <GlassButton variant="ghost" className="text-red-400 hover:text-red-300">
            Reset Progress
          </GlassButton>
        </div>
      </Section>

      {/* About */}
      <Section
        title="About LOGOS"
        description="Application information and credits"
      >
        <div className="space-y-2 text-sm text-white/60">
          <p>
            <span className="text-white/80">Version:</span> 1.0.0
          </p>
          <p>
            <span className="text-white/80">Built with:</span> Electron, React, Prisma
          </p>
          <p className="mt-4 text-xs">
            LOGOS is an adaptive language learning system powered by spaced repetition,
            IRT-based difficulty estimation, and AI-assisted content generation.
          </p>
        </div>
      </Section>

      {/* Reset Button */}
      <div className="flex justify-end">
        <GlassButton
          variant="ghost"
          onClick={resetToDefaults}
          className="text-white/60 hover:text-white"
        >
          Reset to Defaults
        </GlassButton>
      </div>
    </div>
  );
};

export default SettingsPage;
