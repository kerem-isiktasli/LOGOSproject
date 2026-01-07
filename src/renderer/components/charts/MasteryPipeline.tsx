/**
 * MasteryPipeline Component
 *
 * 5단계 마스터리 파이프라인 시각화.
 * Unknown → Recognition → Recall → Production → Automatic
 *
 * 철학적 프레임워크:
 * - 시각적 동형성: 선형적 학습 진행을 수평 흐름으로 표현
 * - 어포던스: 각 단계가 "용기"처럼 단어를 담는 메타포
 * - 상태 투사: 단계 전환 시 애니메이션으로 성취감 전달
 * - 설계적 은폐: FSRS 알고리즘 복잡성은 숨기고 직관적 단계만 표시
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CircleDashed,
  CircleDot,
  Circle,
  CheckCircle,
  ChevronRight,
} from 'lucide-react';

export interface MasteryStageCount {
  unknown: number;      // Stage 0
  recognition: number;  // Stage 1
  recall: number;       // Stage 2
  production: number;   // Stage 3
  automatic: number;    // Stage 4
}

interface MasteryPipelineProps {
  data: MasteryStageCount;
  /** 이전 데이터 (변화 표시용) */
  previousData?: MasteryStageCount;
  /** 전체 단어 수 */
  total?: number;
  /** 컴팩트 모드 */
  compact?: boolean;
  /** 클릭 이벤트 */
  onStageClick?: (stage: keyof MasteryStageCount) => void;
}

interface StageConfig {
  key: keyof MasteryStageCount;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  description: string;
}

const stageConfigs: StageConfig[] = [
  {
    key: 'unknown',
    label: 'Unknown',
    shortLabel: 'UNK',
    icon: <CircleDashed size={16} />,
    color: 'var(--pro-stage-0)',
    bgColor: 'var(--pro-stage-0)33',
    description: 'Not yet studied',
  },
  {
    key: 'recognition',
    label: 'Recognition',
    shortLabel: 'REC',
    icon: <CircleDot size={16} />,
    color: 'var(--pro-stage-1)',
    bgColor: 'var(--pro-stage-1)33',
    description: 'Can recognize when seen',
  },
  {
    key: 'recall',
    label: 'Recall',
    shortLabel: 'RCL',
    icon: <Circle size={16} />,
    color: 'var(--pro-stage-2)',
    bgColor: 'var(--pro-stage-2)33',
    description: 'Can recall with effort',
  },
  {
    key: 'production',
    label: 'Production',
    shortLabel: 'PRD',
    icon: <Circle size={16} strokeWidth={3} />,
    color: 'var(--pro-stage-3)',
    bgColor: 'var(--pro-stage-3)33',
    description: 'Can produce actively',
  },
  {
    key: 'automatic',
    label: 'Automatic',
    shortLabel: 'AUT',
    icon: <CheckCircle size={16} />,
    color: 'var(--pro-stage-4)',
    bgColor: 'var(--pro-stage-4)33',
    description: 'Fluent, automatic recall',
  },
];

// 퍼센트 계산
const calculatePercentage = (count: number, total: number): number => {
  if (total === 0) return 0;
  return (count / total) * 100;
};

// 변화량 계산
const calculateChange = (
  current: number,
  previous: number | undefined
): number | null => {
  if (previous === undefined) return null;
  return current - previous;
};

export const MasteryPipeline: React.FC<MasteryPipelineProps> = ({
  data,
  previousData,
  total: providedTotal,
  compact = false,
  onStageClick,
}) => {
  // 전체 단어 수 계산
  const total = providedTotal ?? Object.values(data).reduce((a, b) => a + b, 0);

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        {stageConfigs.map((stage, index) => {
          const count = data[stage.key];
          const percentage = calculatePercentage(count, total);

          return (
            <React.Fragment key={stage.key}>
              <motion.button
                className="flex items-center gap-1 px-2 py-1 rounded-md transition-colors"
                style={{
                  backgroundColor: count > 0 ? stage.bgColor : 'transparent',
                  color: stage.color,
                }}
                onClick={() => onStageClick?.(stage.key)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                title={`${stage.label}: ${count} (${percentage.toFixed(1)}%)`}
              >
                {stage.icon}
                <span className="text-xs font-semibold tabular-nums">
                  {count}
                </span>
              </motion.button>
              {index < stageConfigs.length - 1 && (
                <ChevronRight size={12} className="text-muted" />
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  }

  return (
    <div className="pro-card">
      <div className="pro-card-header">
        <div>
          <h3 className="pro-card-title">Mastery Pipeline</h3>
          <p className="pro-card-subtitle">
            {total.toLocaleString()} words tracked
          </p>
        </div>
      </div>

      {/* Pipeline Visualization */}
      <div className="flex items-stretch gap-2 mb-4">
        {stageConfigs.map((stage, index) => {
          const count = data[stage.key];
          const change = calculateChange(
            count,
            previousData?.[stage.key]
          );

          return (
            <React.Fragment key={stage.key}>
              <motion.button
                className="flex-1 flex flex-col items-center p-3 rounded-lg transition-all cursor-pointer"
                style={{
                  backgroundColor: 'var(--pro-bg-tertiary)',
                  borderWidth: 1,
                  borderStyle: 'solid',
                  borderColor: count > 0 ? stage.color : 'var(--pro-border-subtle)',
                }}
                onClick={() => onStageClick?.(stage.key)}
                whileHover={{
                  backgroundColor: 'var(--pro-bg-hover)',
                  scale: 1.02,
                }}
                whileTap={{ scale: 0.98 }}
              >
                {/* Icon */}
                <div
                  className="mb-2"
                  style={{ color: stage.color }}
                >
                  {stage.icon}
                </div>

                {/* Count */}
                <motion.div
                  className="text-xl font-bold tabular-nums"
                  style={{ color: 'var(--pro-text-primary)' }}
                  key={count}
                  initial={{ scale: 1.2, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                >
                  {count.toLocaleString()}
                </motion.div>

                {/* Label */}
                <div
                  className="text-xs mt-1"
                  style={{ color: 'var(--pro-text-muted)' }}
                >
                  {stage.shortLabel}
                </div>

                {/* Change Indicator */}
                <AnimatePresence>
                  {change !== null && change !== 0 && (
                    <motion.div
                      className={`text-xs font-medium mt-1 ${
                        change > 0 ? 'text-success' : 'text-error'
                      }`}
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 5 }}
                    >
                      {change > 0 ? '+' : ''}{change}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>

              {/* Connector */}
              {index < stageConfigs.length - 1 && (
                <div className="flex items-center">
                  <div
                    className="w-4 h-0.5"
                    style={{ backgroundColor: 'var(--pro-border-default)' }}
                  />
                  <ChevronRight
                    size={14}
                    style={{ color: 'var(--pro-text-muted)' }}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Progress Bar */}
      <div className="h-2 rounded-full overflow-hidden flex" style={{ backgroundColor: 'var(--pro-bg-tertiary)' }}>
        {stageConfigs.map((stage) => {
          const percentage = calculatePercentage(data[stage.key], total);
          if (percentage === 0) return null;

          return (
            <motion.div
              key={stage.key}
              className="h-full"
              style={{ backgroundColor: stage.color }}
              initial={{ width: 0 }}
              animate={{ width: `${percentage}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              title={`${stage.label}: ${percentage.toFixed(1)}%`}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-5 gap-2 mt-4 pt-4 border-t" style={{ borderColor: 'var(--pro-border-subtle)' }}>
        {stageConfigs.map((stage) => {
          const percentage = calculatePercentage(data[stage.key], total);

          return (
            <div key={stage.key} className="text-center">
              <div
                className="text-xs font-medium"
                style={{ color: stage.color }}
              >
                {percentage.toFixed(0)}%
              </div>
              <div
                className="text-xs mt-0.5"
                style={{ color: 'var(--pro-text-muted)' }}
              >
                {stage.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MasteryPipeline;
