/**
 * LOGOS MVP Configuration
 * 
 * This file controls which features are enabled in MVP vs Full mode.
 * Set LOGOS_MODE=mvp in .env to enable simplified mode.
 */

export type LogosMode = 'mvp' | 'full';

export interface MvpFeatures {
  // Core MVP features (always enabled)
  goalSelection: boolean;
  corpusAnalysis: boolean;
  basicLearningSession: boolean;
  basicDashboard: boolean;
  
  // Advanced features (hidden in MVP)
  multiComponentTracking: boolean;
  networkVisualization: boolean;
  advancedAnalytics: boolean;
  g2pTracking: boolean;
  multiCurriculum: boolean;
  pragmaticTracking: boolean;
  morphologyTracking: boolean;
  syntacticTracking: boolean;
}

export interface MvpUiConfig {
  showAdvancedMetrics: boolean;
  showNetworkGraph: boolean;
  dashboardMetricsLimit: number;
  sessionHistoryLimit: number;
  showComponentBreakdown: boolean;
  showBottleneckAnalysis: boolean;
}

export interface MvpAlgorithmConfig {
  // All algorithms stay active, just hide their outputs
  irt: boolean;
  fsrs: boolean;
  pmi: boolean;
  priority: boolean;
  bottleneck: boolean;
}

export interface MvpConfig {
  mode: LogosMode;
  features: MvpFeatures;
  ui: MvpUiConfig;
  algorithms: MvpAlgorithmConfig;
}

// Get mode from environment variable, default to 'mvp'
const getMode = (): LogosMode => {
  const mode = process.env.LOGOS_MODE?.toLowerCase();
  return mode === 'full' ? 'full' : 'mvp';
};

const mode = getMode();

// MVP Configuration
export const MVP_CONFIG: MvpConfig = {
  mode,
  features: {
    // Core MVP features (always enabled)
    goalSelection: true,
    corpusAnalysis: true,
    basicLearningSession: true,
    basicDashboard: true,
    
    // Advanced features (enabled only in full mode)
    multiComponentTracking: mode === 'full',
    networkVisualization: mode === 'full',
    advancedAnalytics: mode === 'full',
    g2pTracking: mode === 'full',
    multiCurriculum: mode === 'full',
    pragmaticTracking: mode === 'full',
    morphologyTracking: mode === 'full',
    syntacticTracking: mode === 'full',
  },
  ui: {
    showAdvancedMetrics: mode === 'full',
    showNetworkGraph: mode === 'full',
    dashboardMetricsLimit: mode === 'mvp' ? 3 : 10,
    sessionHistoryLimit: mode === 'mvp' ? 5 : 20,
    showComponentBreakdown: mode === 'full',
    showBottleneckAnalysis: mode === 'full',
  },
  algorithms: {
    // All algorithms stay active in both modes
    irt: true,
    fsrs: true,
    pmi: true,
    priority: true,
    bottleneck: true,
  }
};

// Helper function to check if a feature is enabled
export const isFeatureEnabled = (feature: keyof MvpFeatures): boolean => {
  return MVP_CONFIG.features[feature];
};

// Helper to check if we're in MVP mode
export const isMvpMode = (): boolean => {
  return MVP_CONFIG.mode === 'mvp';
};

// Helper to check if we're in full mode
export const isFullMode = (): boolean => {
  return MVP_CONFIG.mode === 'full';
};

// Export for testing
export const __TEST__ = {
  getMode,
};
