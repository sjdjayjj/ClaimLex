import { 
  CalculationParams, 
  CalculationResult, 
  CalculationInterval, 
  RateMode, 
  LPRTerm, 
  CompoundMode 
} from './types';
import { RATE_HISTORY } from './rates';
import dayjs from 'dayjs';

/**
 * 严格四舍五入到分（保留两位小数）
 */
export const roundToFen = (num: number): number => {
  if (isNaN(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
};

export class InterestCalculator {
  /**
   * 获取特定日期的基础利率或LPR
   */
  private getHistoricalRate(dateStr: string, mode: RateMode, term: LPRTerm, fixedRate?: number): number {
    if (mode === 'FIXED') {
      return fixedRate || 0;
    }

    const filtered = RATE_HISTORY.filter(item => {
      if (mode === 'BENCHMARK') return item.type === 'BENCHMARK';
      return item.type === 'LPR';
    });

    // 找生效日期小于等于给定日期的最新一条
    for (const item of filtered) {
      if (dateStr >= item.date) {
        return term === '1Y' ? item.r1 : item.r5;
      }
    }
    
    // 若早于历史记录则取最早的一条
    const last = filtered[filtered.length - 1];
    return term === '1Y' ? last.r1 : last.r5;
  }

  /**
   * 执行核心利息测算
   */
  public calculate(params: CalculationParams): CalculationResult {
    const {
      baseDate,
      endDate,
      principal,
      baseInterest,
      basePenalty,
      rateMode,
      lprTerm,
      lprBp,
      lprFloatRatio,
      fixedRate,
      penaltyMultiple,
      compoundMode,
      delayInterestEnabled
    } = params;

    if (!baseDate || !endDate || dayjs(endDate).isBefore(dayjs(baseDate)) || dayjs(endDate).isSame(dayjs(baseDate))) {
      throw new Error('无效的日期范围');
    }

    // 整理分段切分节点
    const dateCutPoints = new Set<string>([baseDate, endDate]);
    RATE_HISTORY.forEach(r => {
      if (dayjs(r.date).isAfter(dayjs(baseDate)) && dayjs(r.date).isBefore(dayjs(endDate))) {
        if (rateMode === 'LPR' && r.type === 'LPR') dateCutPoints.add(r.date);
        if (rateMode === 'BENCHMARK' && r.type === 'BENCHMARK') dateCutPoints.add(r.date);
      }
    });

    const sortedDates = Array.from(dateCutPoints).sort();
    const intervals: CalculationInterval[] = [];

    let totalPenalty = 0;
    let totalCompound = 0;
    let totalDelay = 0;
    let totalDays = 0;

    // 当前滚动欠付利息（用于算复利）
    const rollingInterest = baseInterest;
    const rollingPenalty = basePenalty;

    for (let i = 0; i < sortedDates.length - 1; i++) {
      const start = sortedDates[i];
      const end = sortedDates[i + 1];
      const days = dayjs(end).diff(dayjs(start), 'day');
      totalDays += days;

      // 1. 获取该段基准利率
      const baseRate = this.getHistoricalRate(start, rateMode, lprTerm, fixedRate);

      // 2. 加点或浮动比
      let actualContractRate = baseRate;
      if (rateMode === 'LPR') {
        actualContractRate = (baseRate + (lprBp / 100)) * (1 + lprFloatRatio / 100);
      }

      // 3. 执行罚息年利率
      const penaltyRate = actualContractRate * penaltyMultiple;

      // 4. 利息/罚息计算: 实际天数 / 360，精确到分
      const periodPenalty = roundToFen(principal * (penaltyRate / 100) * (days / 360));

      // 5. 复利计算
      let compoundBase = 0;
      if (compoundMode === 'INT_ONLY') {
        compoundBase = rollingInterest;
      } else if (compoundMode === 'INT_AND_PENALTY') {
        compoundBase = rollingInterest + rollingPenalty;
      }

      let periodCompound = 0;
      if (compoundMode !== 'NONE') {
        periodCompound = roundToFen(compoundBase * (penaltyRate / 100) * (days / 360));
      }

      // 6. 迟延履行金计算：法定每日万分之1.75，精确到分
      let periodDelay = 0;
      if (delayInterestEnabled) {
        const executionBase = principal + baseInterest + basePenalty;
        periodDelay = roundToFen(executionBase * 0.000175 * days);
      }

      const subtotal = roundToFen(periodPenalty + periodCompound + periodDelay);

      totalPenalty = roundToFen(totalPenalty + periodPenalty);
      totalCompound = roundToFen(totalCompound + periodCompound);
      totalDelay = roundToFen(totalDelay + periodDelay);

      intervals.push({
        start,
        end,
        days,
        baseRate,
        penaltyRate,
        principal: roundToFen(principal),
        interest: periodPenalty,
        compound: periodCompound,
        delay: periodDelay,
        subtotal
      });
    }

    const totalDebt = roundToFen(principal + baseInterest + basePenalty + totalPenalty + totalCompound + totalDelay);

    return {
      totalDays,
      principal: roundToFen(principal),
      newPenalty: totalPenalty,
      newCompound: totalCompound,
      delayInterest: totalDelay,
      totalDebt,
      intervals
    };
  }
}
