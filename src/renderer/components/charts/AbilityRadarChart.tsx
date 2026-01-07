/**
 * AbilityRadarChart Component
 *
 * IRT theta 값을 5개 언어 컴포넌트로 시각화하는 레이더 차트.
 *
 * 철학적 프레임워크:
 * - 시각적 동형성: 5개 축이 언어학적 계층 구조를 반영
 * - 상태 투사: θ 값 변화가 실시간으로 면적 변화로 표현
 * - 설계적 은폐: 복잡한 IRT 수학은 숨기고 직관적 "능력 프로필"로 추상화
 */

import React, { useMemo } from 'react';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { Volume2, Puzzle, BookOpen, Link, MessageCircle } from 'lucide-react';

export interface AbilityData {
  phonology: number;    // θ_PHON
  morphology: number;   // θ_MORPH
  lexical: number;      // θ_LEX
  syntactic: number;    // θ_SYNT
  pragmatic: number;    // θ_PRAG
}

interface AbilityRadarChartProps {
  data: AbilityData;
  /** 이전 데이터 (변화 표시용) */
  previousData?: AbilityData;
  /** 차트 크기 */
  size?: 'sm' | 'md' | 'lg';
  /** 라벨 표시 여부 */
  showLabels?: boolean;
  /** 애니메이션 여부 */
  animated?: boolean;
}

// θ 값을 0-100 스케일로 변환 (θ는 보통 -3 ~ +3 범위)
const thetaToPercent = (theta: number): number => {
  // θ = 0 → 50%, θ = 3 → 100%, θ = -3 → 0%
  return Math.max(0, Math.min(100, ((theta + 3) / 6) * 100));
};

// CEFR 레벨 추정 (θ 기반)
const thetaToCEFR = (theta: number): string => {
  if (theta < -2) return 'A1';
  if (theta < -1) return 'A2';
  if (theta < 0) return 'B1';
  if (theta < 1) return 'B2';
  if (theta < 2) return 'C1';
  return 'C2';
};

const componentLabels: Record<keyof AbilityData, { label: string; icon: React.ReactNode; color: string }> = {
  phonology: { label: 'Phonology', icon: <Volume2 size={14} />, color: '#06b6d4' },
  morphology: { label: 'Morphology', icon: <Puzzle size={14} />, color: '#8b5cf6' },
  lexical: { label: 'Lexical', icon: <BookOpen size={14} />, color: '#f59e0b' },
  syntactic: { label: 'Syntax', icon: <Link size={14} />, color: '#ef4444' },
  pragmatic: { label: 'Pragmatics', icon: <MessageCircle size={14} />, color: '#22c55e' },
};

const sizeConfig = {
  sm: { width: 200, height: 200, fontSize: 10 },
  md: { width: 300, height: 300, fontSize: 12 },
  lg: { width: 400, height: 400, fontSize: 14 },
};

// Custom Tooltip
const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;
  const component = data.component as keyof AbilityData;
  const config = componentLabels[component];
  const theta = data.rawTheta;
  const cefr = thetaToCEFR(theta);

  return (
    <div className="pro-tooltip">
      <div className="flex items-center gap-2 mb-1">
        <span style={{ color: config.color }}>{config.icon}</span>
        <span className="font-semibold">{config.label}</span>
      </div>
      <div className="text-xs text-secondary">
        <div>θ = {theta.toFixed(2)}</div>
        <div>CEFR: {cefr}</div>
      </div>
    </div>
  );
};

export const AbilityRadarChart: React.FC<AbilityRadarChartProps> = ({
  data,
  previousData,
  size = 'md',
  showLabels = true,
  animated = true,
}) => {
  const config = sizeConfig[size];

  // 차트 데이터 변환
  const chartData = useMemo(() => {
    const components: (keyof AbilityData)[] = ['phonology', 'morphology', 'lexical', 'syntactic', 'pragmatic'];

    return components.map((component) => ({
      component,
      label: componentLabels[component].label,
      value: thetaToPercent(data[component]),
      rawTheta: data[component],
      previous: previousData ? thetaToPercent(previousData[component]) : undefined,
    }));
  }, [data, previousData]);

  // 전체 평균 θ 계산
  const averageTheta = useMemo(() => {
    const sum = Object.values(data).reduce((a, b) => a + b, 0);
    return sum / Object.values(data).length;
  }, [data]);

  return (
    <div className="pro-card">
      <div className="pro-card-header">
        <div>
          <h3 className="pro-card-title">Ability Profile</h3>
          <p className="pro-card-subtitle">
            Overall: θ = {averageTheta.toFixed(2)} ({thetaToCEFR(averageTheta)})
          </p>
        </div>
      </div>

      <div className="flex justify-center">
        <ResponsiveContainer width={config.width} height={config.height}>
          <RadarChart data={chartData} cx="50%" cy="50%" outerRadius="70%">
            <PolarGrid
              stroke="#27272a"
              strokeDasharray="3 3"
            />
            <PolarAngleAxis
              dataKey="label"
              tick={{
                fill: '#a1a1aa',
                fontSize: config.fontSize,
              }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={false}
              axisLine={false}
            />

            {/* 이전 데이터 (배경) */}
            {previousData && (
              <Radar
                name="Previous"
                dataKey="previous"
                stroke="#3f3f46"
                fill="#3f3f46"
                fillOpacity={0.2}
                strokeWidth={1}
                dot={false}
              />
            )}

            {/* 현재 데이터 */}
            <Radar
              name="Current"
              dataKey="value"
              stroke="#3b82f6"
              fill="#3b82f6"
              fillOpacity={0.3}
              strokeWidth={2}
              dot={{
                r: 4,
                fill: '#3b82f6',
                stroke: '#0a0a0b',
                strokeWidth: 2,
              }}
              isAnimationActive={animated}
              animationDuration={500}
              animationEasing="ease-out"
            />

            <Tooltip content={<CustomTooltip />} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* 컴포넌트별 상세 */}
      {showLabels && (
        <div className="grid grid-cols-5 gap-2 mt-4 pt-4 border-t border-[var(--pro-border-subtle)]">
          {Object.entries(componentLabels).map(([key, config]) => {
            const theta = data[key as keyof AbilityData];
            const change = previousData
              ? theta - previousData[key as keyof AbilityData]
              : null;

            return (
              <div key={key} className="text-center">
                <div
                  className="flex items-center justify-center gap-1 mb-1"
                  style={{ color: config.color }}
                >
                  {config.icon}
                </div>
                <div className="text-xs font-semibold text-primary">
                  {theta.toFixed(1)}
                </div>
                {change !== null && change !== 0 && (
                  <div
                    className={`text-xs ${change > 0 ? 'text-success' : 'text-error'}`}
                  >
                    {change > 0 ? '+' : ''}{change.toFixed(2)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AbilityRadarChart;
