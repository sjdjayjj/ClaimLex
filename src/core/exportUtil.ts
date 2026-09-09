import { CalculationResult } from './types';
import * as XLSX from 'xlsx';

export function exportToExcel(result: CalculationResult) {
  const summaryData = [
    ['债权清算汇总表'],
    ['项目', '数值'],
    ['计息天数', `${result.totalDays} 天`],
    ['基准日本金余额', result.principal],
    ['新发生利息/罚息', result.newPenalty],
    ['新发生复利', result.newCompound],
    ['迟延履行金', result.delayInterest],
    ['债权本息合计', result.totalDebt],
    [],
    ['分段计息明细清单'],
    ['序号', '起息日期', '止息日期', '天数', '基准利率', '罚息利率', '计息本金', '利息/罚息', '复利', '迟延履行金', '小计']
  ];

  const detailData = result.intervals.map((interval, idx) => [
    idx + 1,
    interval.start,
    interval.end,
    interval.days,
    `${interval.baseRate.toFixed(2)}%`,
    `${interval.penaltyRate.toFixed(4)}%`,
    interval.principal,
    interval.interest,
    interval.compound,
    interval.delay,
    interval.subtotal
  ]);

  const ws = XLSX.utils.aoa_to_sheet([...summaryData, ...detailData]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "债权清算明细");
  
  XLSX.writeFile(wb, `债权清算报告_${new Date().toISOString().split('T')[0]}.xlsx`);
}
