import { 
  CalculationParams, 
  CalculationResult, 
  CalculationInterval, 
  RateMode, 
  LPRTerm, 
  RepaymentAllocationItem,
  SettlementConfirmation,
  DeductionStrategy,
  DayCountConvention,
  DelayBaseMode
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

/**
 * 30/360 天数算法（同 Excel DAYS360 标准版，每月按30天/年360天，银行借据与司法精算表最常用标准）
 */
export function calculateDays360(startDateStr: string, endDateStr: string): number {
  if (startDateStr === endDateStr) return 0;
  const d1 = dayjs(startDateStr);
  const d2 = dayjs(endDateStr);
  let y1 = d1.year(), m1 = d1.month() + 1, day1 = d1.date();
  let y2 = d2.year(), m2 = d2.month() + 1, day2 = d2.date();

  if (day1 === 31) day1 = 30;
  if (day2 === 31 && day1 >= 30) day2 = 30;

  return (y2 - y1) * 360 + (m2 - m1) * 30 + (day2 - day1);
}

/**
 * 根据计息惯例计算两个日期之间的天数
 */
export function calculateIntervalDays(
  startDateStr: string,
  endDateStr: string,
  convention: DayCountConvention = '30_360'
): number {
  if (startDateStr === endDateStr) return 0;
  if (convention === '30_360') {
    return calculateDays360(startDateStr, endDateStr);
  }
  return dayjs(endDateStr).diff(dayjs(startDateStr), 'day');
}

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
   * 执行核心利息测算（严格遵循法释〔2014〕8号与民法典第561条）
   */
  public calculate(params: CalculationParams): CalculationResult {
    const {
      baseDate,
      endDate,
      principal,
      baseInterest = 0,
      basePenalty = 0,
      rateMode,
      lprTerm,
      lprBp = 0,
      lprFloatRatio = 0,
      fixedRate,
      penaltyMultiple = 1.5,
      compoundMode,
      delayInterestEnabled,
      delayBaseMode = 'PRINCIPAL_ONLY',
      executionDueDate,
      dayCountConvention = '30_360',
      deductionStrategy = 'LEGAL_EXPENSE_FIRST',
      litigationFee = 0,
      preservationFee = 0,
      repayments
    } = params;

    if (!baseDate || !endDate || dayjs(endDate).isBefore(dayjs(baseDate)) || dayjs(endDate).isSame(dayjs(baseDate))) {
      throw new Error('无效的日期范围');
    }

    const cleanPrincipal = roundToFen(principal);
    const cleanBaseInterest = roundToFen(baseInterest);
    const cleanBasePenalty = roundToFen(basePenalty);
    const cleanLitigationFee = roundToFen(litigationFee);
    const cleanPreservationFee = roundToFen(preservationFee);
    const cleanFixedFees = roundToFen(cleanLitigationFee + cleanPreservationFee);

    // 1. 筛选生效的判决后银行扣款/还款流水记录
    const activeRepayments = (repayments || []).filter(r => 
      r.selected !== false &&
      dayjs(r.date).isAfter(dayjs(baseDate)) &&
      (dayjs(r.date).isBefore(dayjs(endDate)) || dayjs(r.date).isSame(dayjs(endDate)))
    ).sort((a, b) => a.date.localeCompare(b.date));

    // 整理分段切分节点（含利率调整日、借款人还款日及履行期届满日）
    const dateCutPoints = new Set<string>([baseDate, endDate]);
    RATE_HISTORY.forEach(r => {
      if (dayjs(r.date).isAfter(dayjs(baseDate)) && dayjs(r.date).isBefore(dayjs(endDate))) {
        if (rateMode === 'LPR' && r.type === 'LPR') dateCutPoints.add(r.date);
        if (rateMode === 'BENCHMARK' && r.type === 'BENCHMARK') dateCutPoints.add(r.date);
      }
    });

    // 注入还款节点切分
    activeRepayments.forEach(r => {
      dateCutPoints.add(r.date);
    });

    // 注入履行期届满日切分（确保加倍迟延履行金精确从届满日起算）
    if (executionDueDate && dayjs(executionDueDate).isAfter(dayjs(baseDate)) && dayjs(executionDueDate).isBefore(dayjs(endDate))) {
      dateCutPoints.add(executionDueDate);
    }

    const sortedDates = Array.from(dateCutPoints).sort();
    const intervals: CalculationInterval[] = [];

    let totalPenalty = 0;
    let totalCompound = 0;
    let totalDelay = 0;
    let totalDays = 0;

    // 状态机变量追踪
    let currentPrincipal = cleanPrincipal;
    let currentFee = cleanFixedFees;
    let accumulatedInterest = roundToFen(cleanBaseInterest + cleanBasePenalty);
    let accumulatedDelay = 0;

    // 统计各类别累计冲减额
    let totalRepaid = 0;
    let totalRepaidPrincipal = 0;
    let totalRepaidFee = 0;
    let totalRepaidInterest = 0;
    let totalRepaidDelay = 0;
    let totalSurplus = 0;

    const allocations: RepaymentAllocationItem[] = [];

    // 聚合同一日期的还款明细流水列表
    const repaymentByDate = new Map<string, typeof activeRepayments>();
    activeRepayments.forEach(r => {
      const list = repaymentByDate.get(r.date) || [];
      list.push(r);
      repaymentByDate.set(r.date, list);
    });

    // 单笔还款执行 Waterfall 抵充引擎
    const executeWaterfallDeduction = (repList: typeof activeRepayments) => {
      let nodeRepaidTotal = 0;
      let nodeRepaidFee = 0;
      let nodeRepaidInterest = 0;
      let nodeRepaidPrincipal = 0;
      let nodeRepaidDelay = 0;

      for (const r of repList) {
        const amount = roundToFen(r.totalAmount || (r.principal + r.interest + r.penalty + r.compound) || 0);
        let rem = amount;
        let allocFee = 0;
        let allocInterest = 0;
        let allocPrincipal = 0;
        let allocDelay = 0;
        let surplus = 0;

        if (deductionStrategy === 'LEGAL_EXPENSE_FIRST') {
          // 选项 1：法定清偿顺序（《民法典》第561条及法释〔2014〕8号第四条）
          // 先费用及实现债权的费用 -> 再一般利息/罚息/复利 -> 最后本金 -> 加倍迟延履行利息
          // 1. 抵充诉讼费与保全费
          if (currentFee > 0 && rem > 0) {
            allocFee = roundToFen(Math.min(rem, currentFee));
            rem = roundToFen(rem - allocFee);
            currentFee = roundToFen(currentFee - allocFee);
          }
          // 2. 抵充利息、罚息、复利
          if (accumulatedInterest > 0 && rem > 0) {
            allocInterest = roundToFen(Math.min(rem, accumulatedInterest));
            rem = roundToFen(rem - allocInterest);
            accumulatedInterest = roundToFen(accumulatedInterest - allocInterest);
          }
          // 3. 抵充本金
          if (currentPrincipal > 0 && rem > 0) {
            allocPrincipal = roundToFen(Math.min(rem, currentPrincipal));
            rem = roundToFen(rem - allocPrincipal);
            currentPrincipal = roundToFen(currentPrincipal - allocPrincipal);
          }
          // 4. 抵充加倍迟延履行利息
          if (accumulatedDelay > 0 && rem > 0) {
            allocDelay = roundToFen(Math.min(rem, accumulatedDelay));
            rem = roundToFen(rem - allocDelay);
            accumulatedDelay = roundToFen(accumulatedDelay - allocDelay);
          }
          // 5. 超额清偿结余
          if (rem > 0) {
            surplus = rem;
          }
        } else {
          // 选项 2：商业优先冲本模式（协商重组场景）
          // 还款全额优先冲减尚欠本金 -> 罚息利息 -> 费用 -> 加倍迟延金
          // 1. 优先冲减本金
          if (currentPrincipal > 0 && rem > 0) {
            allocPrincipal = roundToFen(Math.min(rem, currentPrincipal));
            rem = roundToFen(rem - allocPrincipal);
            currentPrincipal = roundToFen(currentPrincipal - allocPrincipal);
          }
          // 2. 抵充利息、罚息与复利
          if (accumulatedInterest > 0 && rem > 0) {
            allocInterest = roundToFen(Math.min(rem, accumulatedInterest));
            rem = roundToFen(rem - allocInterest);
            accumulatedInterest = roundToFen(accumulatedInterest - allocInterest);
          }
          // 3. 抵充诉讼费与保全费
          if (currentFee > 0 && rem > 0) {
            allocFee = roundToFen(Math.min(rem, currentFee));
            rem = roundToFen(rem - allocFee);
            currentFee = roundToFen(currentFee - allocFee);
          }
          // 4. 抵充加倍迟延履行利息
          if (accumulatedDelay > 0 && rem > 0) {
            allocDelay = roundToFen(Math.min(rem, accumulatedDelay));
            rem = roundToFen(rem - allocDelay);
            accumulatedDelay = roundToFen(accumulatedDelay - allocDelay);
          }
          // 5. 超额清偿结余
          if (rem > 0) {
            surplus = rem;
          }
        }

        nodeRepaidTotal = roundToFen(nodeRepaidTotal + amount);
        nodeRepaidFee = roundToFen(nodeRepaidFee + allocFee);
        nodeRepaidInterest = roundToFen(nodeRepaidInterest + allocInterest);
        nodeRepaidPrincipal = roundToFen(nodeRepaidPrincipal + allocPrincipal);
        nodeRepaidDelay = roundToFen(nodeRepaidDelay + allocDelay);

        totalRepaid = roundToFen(totalRepaid + amount);
        totalRepaidFee = roundToFen(totalRepaidFee + allocFee);
        totalRepaidInterest = roundToFen(totalRepaidInterest + allocInterest);
        totalRepaidPrincipal = roundToFen(totalRepaidPrincipal + allocPrincipal);
        totalRepaidDelay = roundToFen(totalRepaidDelay + allocDelay);
        totalSurplus = roundToFen(totalSurplus + surplus);

        allocations.push({
          date: r.date,
          serialNo: r.serialNo,
          amount,
          allocatedFee: allocFee,
          allocatedInterest: allocInterest,
          allocatedPrincipal: allocPrincipal,
          allocatedDelay: allocDelay,
          surplusAmount: surplus
        });
      }

      return {
        nodeRepaidTotal,
        nodeRepaidFee,
        nodeRepaidInterest,
        nodeRepaidPrincipal,
        nodeRepaidDelay
      };
    };

    let delayTerminatedGlobal = false;

    // 逐段测算
    const yearDenominator = (dayCountConvention === 'ACT_365' ? 365 : 360);

    for (let i = 0; i < sortedDates.length - 1; i++) {
      const start = sortedDates[i];
      const end = sortedDates[i + 1];
      const days = calculateIntervalDays(start, end, dayCountConvention);
      totalDays += days;

      // 1. 如果当前节点起始点存在借款人还款事件，调用 Waterfall 抵充引擎冲减
      let repaymentNodeStats: {
        nodeRepaidTotal: number;
        nodeRepaidFee: number;
        nodeRepaidInterest: number;
        nodeRepaidPrincipal: number;
        nodeRepaidDelay: number;
      } | null = null;

      let eventDesc: string | undefined = undefined;

      if (repaymentByDate.has(start)) {
        const repList = repaymentByDate.get(start)!;
        repaymentNodeStats = executeWaterfallDeduction(repList);

        const descParts: string[] = [];
        if (repaymentNodeStats.nodeRepaidFee > 0) descParts.push(`冲费用￥${repaymentNodeStats.nodeRepaidFee.toFixed(2)}`);
        if (repaymentNodeStats.nodeRepaidInterest > 0) descParts.push(`冲欠息￥${repaymentNodeStats.nodeRepaidInterest.toFixed(2)}`);
        if (repaymentNodeStats.nodeRepaidPrincipal > 0) descParts.push(`冲本金￥${repaymentNodeStats.nodeRepaidPrincipal.toFixed(2)}`);
        if (repaymentNodeStats.nodeRepaidDelay > 0) descParts.push(`冲迟延金￥${repaymentNodeStats.nodeRepaidDelay.toFixed(2)}`);

        eventDesc = `还款抵扣 (共入账￥${repaymentNodeStats.nodeRepaidTotal.toFixed(2)}: ${descParts.join('，') || '全额冲抵'})`;
      } else if (i === 0) {
        eventDesc = '期初确认';
      } else if (executionDueDate && start === executionDueDate) {
        eventDesc = '履行期届满 (加倍金起算)';
      } else {
        eventDesc = '利率分段调整';
      }

      if (executionDueDate && start === executionDueDate && !eventDesc.includes('履行期届满')) {
        eventDesc += ' · 履行期届满';
      }

      // 2. 利率计算
      const baseRate = this.getHistoricalRate(start, rateMode, lprTerm, fixedRate);
      let actualContractRate = baseRate;
      if (rateMode === 'LPR') {
        actualContractRate = (baseRate + (lprBp / 100)) * (1 + lprFloatRatio / 100);
      }
      const penaltyRate = actualContractRate * penaltyMultiple;

      // 3. 罚息计算: 天数 / 年基准天数，按冲减后本金计算
      let periodPenalty = 0;
      if (currentPrincipal > 0) {
        periodPenalty = roundToFen(currentPrincipal * (penaltyRate / 100) * (days / yearDenominator));
      }

      // 4. 复利计算: 按约定对滚动未结清利息/罚息计收
      let periodCompound = 0;
      if (compoundMode !== 'NONE' && accumulatedInterest > 0) {
        let compoundBase = 0;
        if (compoundMode === 'INT_ONLY') {
          // 仅对利息计复利（若未严格区分罚复利，按当前滚存利息计收）
          compoundBase = accumulatedInterest;
        } else if (compoundMode === 'INT_AND_PENALTY') {
          compoundBase = accumulatedInterest;
        }
        periodCompound = roundToFen(compoundBase * (penaltyRate / 100) * (days / yearDenominator));
      }

      // 5. 迟延履行金合规化改造（严格遵循法释〔2014〕8号第一条）
      // 法释〔2014〕8号第一条：加倍部分债务利息=尚未清偿的生效法律文书确定的除一般债务利息之外的金钱债务×日万分之1.75×迟延履行期间
      // 模式 A（PRINCIPAL_ONLY）：仅以尚欠本金为基数（司法实践主流、律师底稿标准，对齐图一算法：本金清零即彻底终止迟延金）
      // 模式 B（PRINCIPAL_AND_FEES）：本金余额 + 判决确认的诉讼保全等固定费用余额（严格法释8号理论口径）
      const delayBase = (delayBaseMode === 'PRINCIPAL_AND_FEES')
        ? roundToFen(Math.max(0, currentPrincipal + currentFee))
        : roundToFen(Math.max(0, currentPrincipal));

      const isDelayTerminated = (delayBase <= 0);
      if (isDelayTerminated && currentPrincipal <= 0) {
        delayTerminatedGlobal = true;
      }

      let periodDelay = 0;
      if (delayInterestEnabled) {
        let isDelayEffective = true;
        if (executionDueDate) {
          isDelayEffective = dayjs(start).isAfter(dayjs(executionDueDate)) || dayjs(start).isSame(dayjs(executionDueDate));
        }

        if (isDelayEffective) {
          if (!isDelayTerminated) {
            // 基数未归零，按法定基数计收日万分之1.75
            periodDelay = roundToFen(delayBase * 0.000175 * days);
          } else {
            // 基数归零熔断机制：属于加倍迟延金计息基数的部分清零时，立即停止计提，增量置为 0
            periodDelay = 0;
            if (!eventDesc.includes('基数熔断')) {
              eventDesc += ' [迟延金基数归零熔断]';
            }
          }
        }
      }

      // 将本段产生的新罚息、新复利滚入累计池，迟延金滚入迟延金池
      accumulatedInterest = roundToFen(accumulatedInterest + periodPenalty + periodCompound);
      accumulatedDelay = roundToFen(accumulatedDelay + periodDelay);

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
        principal: roundToFen(currentPrincipal),
        interest: periodPenalty,
        compound: periodCompound,
        delay: periodDelay,
        subtotal,
        eventDesc,
        delayBase,
        isDelayTerminated,
        repaidTotal: repaymentNodeStats ? repaymentNodeStats.nodeRepaidTotal : undefined,
        repaidFee: repaymentNodeStats && repaymentNodeStats.nodeRepaidFee > 0 ? repaymentNodeStats.nodeRepaidFee : undefined,
        repaidInterest: repaymentNodeStats && repaymentNodeStats.nodeRepaidInterest > 0 ? repaymentNodeStats.nodeRepaidInterest : undefined,
        repaidPrincipal: repaymentNodeStats && repaymentNodeStats.nodeRepaidPrincipal > 0 ? repaymentNodeStats.nodeRepaidPrincipal : undefined,
        repaidDelay: repaymentNodeStats && repaymentNodeStats.nodeRepaidDelay > 0 ? repaymentNodeStats.nodeRepaidDelay : undefined,
        remainingPrincipal: roundToFen(currentPrincipal)
      });
    }

    // 检查截止日 (endDate) 是否有还款
    if (repaymentByDate.has(endDate)) {
      executeWaterfallDeduction(repaymentByDate.get(endDate)!);
    }

    // 结欠计算与总标的池
    const remainingPrincipal = roundToFen(Math.max(0, currentPrincipal));
    const remainingFee = roundToFen(Math.max(0, currentFee));
    const remainingInterest = roundToFen(Math.max(0, accumulatedInterest));
    const remainingDelay = roundToFen(Math.max(0, accumulatedDelay));

    // 债权执行标的总应计金额（生效裁判确认本金及费用 + 期初欠息 + 期间新产生罚复利与加倍迟延金）
    const totalDebt = roundToFen(
      cleanPrincipal +
      cleanLitigationFee +
      cleanPreservationFee +
      cleanBaseInterest +
      cleanBasePenalty +
      totalPenalty +
      totalCompound +
      totalDelay
    );

    // 扣减还款后的最终结欠债权净额（申请执行标的）
    const netDebt = roundToFen(remainingPrincipal + remainingFee + remainingInterest + remainingDelay);
    const isFullySettled = (netDebt === 0);

    const settlement: SettlementConfirmation = {
      deductionStrategy,
      principalTarget: cleanPrincipal,
      litigationFeeTarget: cleanLitigationFee,
      preservationFeeTarget: cleanPreservationFee,
      totalFixedDebtTarget: cleanFixedFees + cleanPrincipal,
      baseInterestTarget: cleanBaseInterest,
      basePenaltyTarget: cleanBasePenalty,
      newPenaltyTarget: totalPenalty,
      newCompoundTarget: totalCompound,
      delayInterestTarget: totalDelay,
      totalDebtTarget: totalDebt,
      totalRepaid,
      allocatedFeeTotal: totalRepaidFee,
      allocatedInterestTotal: totalRepaidInterest,
      allocatedPrincipalTotal: totalRepaidPrincipal,
      allocatedDelayTotal: totalRepaidDelay,
      surplusTotal: totalSurplus,
      remainingFee,
      remainingPrincipal,
      remainingInterest,
      remainingDelay,
      netDebtTotal: netDebt,
      isFullySettled,
      delayTerminated: delayTerminatedGlobal || (remainingPrincipal <= 0 && remainingFee <= 0),
      allocations
    };

    return {
      totalDays,
      principal: remainingPrincipal,
      newPenalty: totalPenalty,
      newCompound: totalCompound,
      delayInterest: totalDelay,
      totalDebt,
      totalRepaid,
      totalRepaidPrincipal,
      totalRepaidFee,
      totalRepaidInterest,
      totalRepaidDelay,
      netDebt,
      litigationFee: cleanLitigationFee,
      preservationFee: cleanPreservationFee,
      delayTerminated: settlement.delayTerminated,
      deductionStrategy,
      settlement,
      intervals
    };
  }
}
