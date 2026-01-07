/**
 * FSRSCalendar Component
 *
 * FSRS 리뷰 일정을 GitHub 스타일 히트맵 캘린더로 시각화.
 *
 * 철학적 프레임워크:
 * - 시각적 동형성: 시간 흐름을 좌→우 격자로 표현
 * - 어포던스: 색상 농도가 학습량/리뷰 필요량을 직관적으로 전달
 * - 상태 투사: 오늘 날짜 강조, 미래 예측 표시
 * - 설계적 은폐: FSRS 알고리즘의 복잡한 retrievability 계산은 숨김
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Calendar } from 'lucide-react';

export interface DayData {
  date: string;           // YYYY-MM-DD
  reviewCount: number;    // 리뷰한 항목 수
  dueCount: number;       // 리뷰 예정 항목 수
  newCount?: number;      // 새로 학습한 항목 수
  accuracy?: number;      // 정답률 (0-1)
}

interface FSRSCalendarProps {
  data: DayData[];
  /** 표시할 주 수 (기본: 12주) */
  weeks?: number;
  /** 기준 날짜 (기본: 오늘) */
  baseDate?: Date;
  /** 날짜 클릭 이벤트 */
  onDayClick?: (day: DayData) => void;
  /** 컴팩트 모드 */
  compact?: boolean;
}

// 요일 라벨
const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// 색상 강도 계산 (0-4 레벨)
const getIntensityLevel = (count: number, maxCount: number): number => {
  if (count === 0) return 0;
  const ratio = count / maxCount;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
};

// 날짜 포맷팅
const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

// 월 이름 가져오기
const getMonthName = (date: Date): string => {
  return date.toLocaleDateString('en-US', { month: 'short' });
};

// 색상 팔레트
const intensityColors = {
  0: 'var(--pro-bg-tertiary)',
  1: '#1e3a5f',  // Light blue
  2: '#2563eb',  // Medium blue
  3: '#3b82f6',  // Blue
  4: '#60a5fa',  // Bright blue
};

const futureColors = {
  0: 'var(--pro-bg-tertiary)',
  1: '#3f2d1e',  // Light amber
  2: '#78350f',  // Medium amber
  3: '#b45309',  // Amber
  4: '#f59e0b',  // Bright amber
};

export const FSRSCalendar: React.FC<FSRSCalendarProps> = ({
  data,
  weeks = 12,
  baseDate = new Date(),
  onDayClick,
  compact = false,
}) => {
  // 데이터를 Map으로 변환
  const dataMap = useMemo(() => {
    return new Map(data.map((d) => [d.date, d]));
  }, [data]);

  // 캘린더 그리드 생성
  const calendarGrid = useMemo(() => {
    const grid: (DayData | null)[][] = [];
    const today = new Date(baseDate);
    today.setHours(0, 0, 0, 0);

    // 시작 날짜 계산 (weeks 전 일요일)
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - (weeks * 7) + 1);
    startDate.setDate(startDate.getDate() - startDate.getDay()); // 일요일로 조정

    // 최대값 계산
    let maxReviewCount = 1;
    let maxDueCount = 1;
    data.forEach((d) => {
      if (d.reviewCount > maxReviewCount) maxReviewCount = d.reviewCount;
      if (d.dueCount > maxDueCount) maxDueCount = d.dueCount;
    });

    // 주별로 그리드 생성
    for (let week = 0; week < weeks + 1; week++) {
      const weekData: (DayData | null)[] = [];

      for (let day = 0; day < 7; day++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + week * 7 + day);
        const dateStr = formatDate(currentDate);

        const dayData = dataMap.get(dateStr);
        const isPast = currentDate < today;
        const isToday = dateStr === formatDate(today);
        const isFuture = currentDate > today;

        weekData.push({
          date: dateStr,
          reviewCount: dayData?.reviewCount ?? 0,
          dueCount: dayData?.dueCount ?? 0,
          newCount: dayData?.newCount,
          accuracy: dayData?.accuracy,
          // @ts-ignore - adding metadata
          _isPast: isPast,
          _isToday: isToday,
          _isFuture: isFuture,
          _maxReviewCount: maxReviewCount,
          _maxDueCount: maxDueCount,
        } as DayData);
      }

      grid.push(weekData);
    }

    return grid;
  }, [data, weeks, baseDate, dataMap]);

  // 월 라벨 위치 계산
  const monthLabels = useMemo(() => {
    const labels: { month: string; weekIndex: number }[] = [];
    let lastMonth = -1;

    calendarGrid.forEach((week, weekIndex) => {
      const firstDay = new Date(week[0]?.date ?? '');
      const month = firstDay.getMonth();

      if (month !== lastMonth) {
        labels.push({
          month: getMonthName(firstDay),
          weekIndex,
        });
        lastMonth = month;
      }
    });

    return labels;
  }, [calendarGrid]);

  // 총 통계 계산
  const stats = useMemo(() => {
    let totalReviews = 0;
    let totalDue = 0;
    let daysStudied = 0;

    data.forEach((d) => {
      totalReviews += d.reviewCount;
      totalDue += d.dueCount;
      if (d.reviewCount > 0) daysStudied++;
    });

    return { totalReviews, totalDue, daysStudied };
  }, [data]);

  const cellSize = compact ? 10 : 14;
  const cellGap = compact ? 2 : 3;

  return (
    <div className="pro-card">
      <div className="pro-card-header">
        <div className="flex items-center gap-2">
          <Calendar size={18} style={{ color: 'var(--pro-info)' }} />
          <div>
            <h3 className="pro-card-title">Review Activity</h3>
            <p className="pro-card-subtitle">
              {stats.totalReviews.toLocaleString()} reviews over {stats.daysStudied} days
            </p>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="overflow-x-auto">
        <div className="inline-flex flex-col gap-1">
          {/* Month Labels */}
          <div className="flex" style={{ marginLeft: compact ? 20 : 30 }}>
            {monthLabels.map((label, index) => (
              <div
                key={index}
                className="text-xs"
                style={{
                  color: 'var(--pro-text-muted)',
                  marginLeft: label.weekIndex * (cellSize + cellGap),
                  position: index === 0 ? 'relative' : 'absolute',
                }}
              >
                {label.month}
              </div>
            ))}
          </div>

          {/* Grid with Day Labels */}
          <div className="flex gap-1">
            {/* Day Labels */}
            {!compact && (
              <div className="flex flex-col gap-0.5" style={{ width: 24 }}>
                {dayLabels.map((day, index) => (
                  <div
                    key={day}
                    className="text-xs flex items-center"
                    style={{
                      height: cellSize + cellGap,
                      color: 'var(--pro-text-muted)',
                      visibility: index % 2 === 1 ? 'visible' : 'hidden',
                    }}
                  >
                    {day.slice(0, 1)}
                  </div>
                ))}
              </div>
            )}

            {/* Week Columns */}
            <div className="flex gap-0.5">
              {calendarGrid.map((week, weekIndex) => (
                <div key={weekIndex} className="flex flex-col gap-0.5">
                  {week.map((day, dayIndex) => {
                    if (!day) return <div key={dayIndex} style={{ width: cellSize, height: cellSize }} />;

                    // @ts-ignore - accessing metadata
                    const isPast = day._isPast;
                    // @ts-ignore
                    const isToday = day._isToday;
                    // @ts-ignore
                    const isFuture = day._isFuture;
                    // @ts-ignore
                    const maxCount = isPast ? day._maxReviewCount : day._maxDueCount;

                    const count = isPast ? day.reviewCount : day.dueCount;
                    const level = getIntensityLevel(count, maxCount);
                    const colors = isPast ? intensityColors : futureColors;

                    return (
                      <motion.button
                        key={day.date}
                        className="rounded-sm transition-all"
                        style={{
                          width: cellSize,
                          height: cellSize,
                          backgroundColor: colors[level as keyof typeof colors],
                          border: isToday ? '2px solid var(--pro-info)' : 'none',
                          boxSizing: 'border-box',
                        }}
                        onClick={() => onDayClick?.(day)}
                        whileHover={{ scale: 1.3 }}
                        title={`${day.date}: ${isPast ? `${day.reviewCount} reviewed` : `${day.dueCount} due`}`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t" style={{ borderColor: 'var(--pro-border-subtle)' }}>
        <div className="flex items-center gap-4">
          {/* Past Legend */}
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: 'var(--pro-text-muted)' }}>
              Past:
            </span>
            <div className="flex items-center gap-0.5">
              <span className="text-xs" style={{ color: 'var(--pro-text-muted)' }}>Less</span>
              {[0, 1, 2, 3, 4].map((level) => (
                <div
                  key={level}
                  className="rounded-sm"
                  style={{
                    width: 10,
                    height: 10,
                    backgroundColor: intensityColors[level as keyof typeof intensityColors],
                  }}
                />
              ))}
              <span className="text-xs" style={{ color: 'var(--pro-text-muted)' }}>More</span>
            </div>
          </div>

          {/* Future Legend */}
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: 'var(--pro-text-muted)' }}>
              Due:
            </span>
            <div className="flex items-center gap-0.5">
              <span className="text-xs" style={{ color: 'var(--pro-text-muted)' }}>Few</span>
              {[0, 1, 2, 3, 4].map((level) => (
                <div
                  key={level}
                  className="rounded-sm"
                  style={{
                    width: 10,
                    height: 10,
                    backgroundColor: futureColors[level as keyof typeof futureColors],
                  }}
                />
              ))}
              <span className="text-xs" style={{ color: 'var(--pro-text-muted)' }}>Many</span>
            </div>
          </div>
        </div>

        {/* Today indicator */}
        <div className="flex items-center gap-2">
          <div
            className="rounded-sm"
            style={{
              width: 10,
              height: 10,
              border: '2px solid var(--pro-info)',
            }}
          />
          <span className="text-xs" style={{ color: 'var(--pro-text-muted)' }}>Today</span>
        </div>
      </div>
    </div>
  );
};

export default FSRSCalendar;
