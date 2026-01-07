/**
 * CascadeDiagram Component
 *
 * 언어 처리 캐스케이드 다이어그램: PHON → MORPH → LEX → SYNT → PRAG
 * 병목 지점과 오류 흐름을 시각화.
 *
 * 철학적 프레임워크:
 * - 시각적 동형성: 언어학적 계층 구조를 순차적 흐름으로 표현
 * - 어포던스: 병목 지점이 시각적으로 "막힌" 느낌 전달
 * - 상태 투사: 오류율을 색상 강도로 실시간 반영
 * - 설계적 은폐: 복잡한 오류 분석 알고리즘은 숨기고 직관적 흐름만 표시
 */

import React from 'react';
import { motion } from 'framer-motion';
import {
  Volume2,
  Puzzle,
  BookOpen,
  Link,
  MessageCircle,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';

export interface ComponentData {
  component: 'phonology' | 'morphology' | 'lexical' | 'syntactic' | 'pragmatic';
  errorRate: number;      // 0-1 사이 오류율
  confidence: number;     // 0-1 사이 신뢰도
  itemCount: number;      // 분석된 항목 수
  isBottleneck?: boolean; // 병목 지점 여부
}

interface CascadeDiagramProps {
  data: ComponentData[];
  /** 추천 메시지 */
  recommendation?: string;
  /** 컴팩트 모드 */
  compact?: boolean;
  /** 컴포넌트 클릭 이벤트 */
  onComponentClick?: (component: ComponentData) => void;
}

// 컴포넌트 설정
const componentConfig: Record<
  ComponentData['component'],
  { label: string; shortLabel: string; icon: React.ReactNode; color: string }
> = {
  phonology: {
    label: 'Phonology',
    shortLabel: 'PHON',
    icon: <Volume2 size={18} />,
    color: 'var(--pro-phonology)',
  },
  morphology: {
    label: 'Morphology',
    shortLabel: 'MORPH',
    icon: <Puzzle size={18} />,
    color: 'var(--pro-morphology)',
  },
  lexical: {
    label: 'Lexical',
    shortLabel: 'LEX',
    icon: <BookOpen size={18} />,
    color: 'var(--pro-lexical)',
  },
  syntactic: {
    label: 'Syntax',
    shortLabel: 'SYNT',
    icon: <Link size={18} />,
    color: 'var(--pro-syntactic)',
  },
  pragmatic: {
    label: 'Pragmatics',
    shortLabel: 'PRAG',
    icon: <MessageCircle size={18} />,
    color: 'var(--pro-pragmatic)',
  },
};

// 오류율에 따른 색상
const getErrorColor = (errorRate: number): string => {
  if (errorRate < 0.1) return 'var(--pro-success)';
  if (errorRate < 0.25) return 'var(--pro-info)';
  if (errorRate < 0.4) return 'var(--pro-warning)';
  return 'var(--pro-error)';
};

// 오류율에 따른 상태 라벨
const getStatusLabel = (errorRate: number): string => {
  if (errorRate < 0.1) return 'Strong';
  if (errorRate < 0.25) return 'Good';
  if (errorRate < 0.4) return 'Needs Work';
  return 'Weak';
};

export const CascadeDiagram: React.FC<CascadeDiagramProps> = ({
  data,
  recommendation,
  compact = false,
  onComponentClick,
}) => {
  // 컴포넌트 순서 정렬
  const orderedComponents: ComponentData['component'][] = [
    'phonology',
    'morphology',
    'lexical',
    'syntactic',
    'pragmatic',
  ];

  const sortedData = orderedComponents.map(
    (comp) => data.find((d) => d.component === comp) ?? {
      component: comp,
      errorRate: 0,
      confidence: 0,
      itemCount: 0,
    }
  );

  // 주요 병목 찾기
  const primaryBottleneck = sortedData.find((d) => d.isBottleneck);

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        {sortedData.map((item, index) => {
          const config = componentConfig[item.component];

          return (
            <React.Fragment key={item.component}>
              <motion.button
                className="flex items-center gap-1 px-2 py-1 rounded-md"
                style={{
                  backgroundColor: item.isBottleneck
                    ? 'var(--pro-error-muted)'
                    : 'var(--pro-bg-tertiary)',
                  color: config.color,
                  border: item.isBottleneck
                    ? '1px solid var(--pro-error)'
                    : '1px solid transparent',
                }}
                onClick={() => onComponentClick?.(item)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                title={`${config.label}: ${(item.errorRate * 100).toFixed(0)}% error rate`}
              >
                {config.icon}
                {item.isBottleneck && (
                  <AlertTriangle size={12} style={{ color: 'var(--pro-error)' }} />
                )}
              </motion.button>
              {index < sortedData.length - 1 && (
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
          <h3 className="pro-card-title">Language Processing Cascade</h3>
          <p className="pro-card-subtitle">
            {primaryBottleneck
              ? `Primary bottleneck: ${componentConfig[primaryBottleneck.component].label}`
              : 'No significant bottlenecks detected'}
          </p>
        </div>
        {primaryBottleneck && (
          <div
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium"
            style={{
              backgroundColor: 'var(--pro-error-muted)',
              color: 'var(--pro-error)',
            }}
          >
            <AlertTriangle size={14} />
            Bottleneck
          </div>
        )}
      </div>

      {/* Cascade Flow */}
      <div className="flex items-stretch gap-2">
        {sortedData.map((item, index) => {
          const config = componentConfig[item.component];
          const errorColor = getErrorColor(item.errorRate);
          const statusLabel = getStatusLabel(item.errorRate);

          return (
            <React.Fragment key={item.component}>
              <motion.button
                className="flex-1 flex flex-col items-center p-4 rounded-lg transition-all"
                style={{
                  backgroundColor: item.isBottleneck
                    ? 'var(--pro-error-muted)'
                    : 'var(--pro-bg-tertiary)',
                  border: item.isBottleneck
                    ? '2px solid var(--pro-error)'
                    : '1px solid var(--pro-border-subtle)',
                }}
                onClick={() => onComponentClick?.(item)}
                whileHover={{
                  scale: 1.02,
                  backgroundColor: 'var(--pro-bg-hover)',
                }}
                whileTap={{ scale: 0.98 }}
              >
                {/* Icon */}
                <div
                  className="mb-2 p-2 rounded-lg"
                  style={{
                    backgroundColor: `${config.color}20`,
                    color: config.color,
                  }}
                >
                  {config.icon}
                </div>

                {/* Label */}
                <div
                  className="text-xs font-medium mb-1"
                  style={{ color: 'var(--pro-text-muted)' }}
                >
                  {config.shortLabel}
                </div>

                {/* Error Rate */}
                <div
                  className="text-lg font-bold tabular-nums"
                  style={{ color: errorColor }}
                >
                  {(item.errorRate * 100).toFixed(0)}%
                </div>

                {/* Status Label */}
                <div
                  className="text-xs mt-1"
                  style={{ color: errorColor }}
                >
                  {statusLabel}
                </div>

                {/* Item Count */}
                <div
                  className="text-xs mt-2"
                  style={{ color: 'var(--pro-text-muted)' }}
                >
                  {item.itemCount} items
                </div>

                {/* Bottleneck Indicator */}
                {item.isBottleneck && (
                  <motion.div
                    className="absolute -top-2 -right-2"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  >
                    <AlertTriangle
                      size={16}
                      style={{ color: 'var(--pro-error)' }}
                    />
                  </motion.div>
                )}
              </motion.button>

              {/* Connector Arrow */}
              {index < sortedData.length - 1 && (
                <div className="flex items-center">
                  <motion.div
                    className="flex items-center"
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <div
                      className="w-4 h-0.5"
                      style={{
                        backgroundColor: item.isBottleneck
                          ? 'var(--pro-error)'
                          : 'var(--pro-border-default)',
                      }}
                    />
                    <ChevronRight
                      size={16}
                      style={{
                        color: item.isBottleneck
                          ? 'var(--pro-error)'
                          : 'var(--pro-text-muted)',
                      }}
                    />
                  </motion.div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Recommendation */}
      {recommendation && (
        <div
          className="mt-4 p-3 rounded-lg text-sm"
          style={{
            backgroundColor: 'var(--pro-info-muted)',
            color: 'var(--pro-text-primary)',
            border: '1px solid var(--pro-info)40',
          }}
        >
          <strong style={{ color: 'var(--pro-info)' }}>Recommendation:</strong>{' '}
          {recommendation}
        </div>
      )}

      {/* Progress Flow Visualization */}
      <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--pro-border-subtle)' }}>
        <div className="h-2 rounded-full overflow-hidden flex" style={{ backgroundColor: 'var(--pro-bg-tertiary)' }}>
          {sortedData.map((item) => {
            const successRate = 1 - item.errorRate;
            const config = componentConfig[item.component];

            return (
              <motion.div
                key={item.component}
                className="h-full"
                style={{
                  backgroundColor: config.color,
                  flex: 1,
                  opacity: successRate,
                }}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            );
          })}
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-xs" style={{ color: 'var(--pro-text-muted)' }}>
            Input
          </span>
          <span className="text-xs" style={{ color: 'var(--pro-text-muted)' }}>
            Processing Flow
          </span>
          <span className="text-xs" style={{ color: 'var(--pro-text-muted)' }}>
            Output
          </span>
        </div>
      </div>
    </div>
  );
};

export default CascadeDiagram;
