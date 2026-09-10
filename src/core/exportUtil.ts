import { CalculationResult } from './types';
import * as XLSX from 'xlsx';

export function exportToExcel(
  result: CalculationResult,
  meta?: { caseNo?: string; defendant?: string; plaintiff?: string }
) {
  const title = meta?.caseNo
    ? `债权清算证据清单 - ${meta.caseNo}${meta.defendant ? ` (${meta.defendant})` : ''}`
    : '债权清算证据清单';

  const summaryData = [
    [title],
    ['原告 / 债权人', meta?.plaintiff || '未指定', '被告 / 债务人', meta?.defendant || '未指定'],
    ['项目', '数值', '备注说明', ''],
    ['计息天数', `${result.totalDays} 天`, '实际天数算头不算尾', ''],
    ['基准日本金余额', Number(result.principal.toFixed(2)), '基准日确认本金', ''],
    ['新发生利息/罚息', Number(result.newPenalty.toFixed(2)), '按浮动/固定利率计付', ''],
    ['新发生复利', Number(result.newCompound.toFixed(2)), '滚动按月计收复利', ''],
    ['加倍迟延履行金', Number(result.delayInterest.toFixed(2)), '依照民诉法日万分之一点七五', ''],
    ['债权本息合计', Number(result.totalDebt.toFixed(2)), '截止清算终止日', ''],
    [],
    ['分段计息明细清单（按调息周期切割）'],
    ['序号', '起息日期', '止息日期', '天数', '基准利率', '罚息利率', '计息本金', '利息/罚息', '复利', '迟延履行金', '小计']
  ];

  const detailData = result.intervals.map((interval, idx) => [
    idx + 1,
    interval.start,
    interval.end,
    interval.days,
    `${interval.baseRate.toFixed(2)}%`,
    `${interval.penaltyRate.toFixed(4)}%`,
    Number(interval.principal.toFixed(2)),
    Number(interval.interest.toFixed(2)),
    Number(interval.compound.toFixed(2)),
    Number(interval.delay.toFixed(2)),
    Number(interval.subtotal.toFixed(2))
  ]);

  const ws = XLSX.utils.aoa_to_sheet([...summaryData, ...detailData]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "债权清算明细");
  
  const safeName = meta?.defendant ? `_${meta.defendant}` : '';
  const safeCase = meta?.caseNo ? `_${meta.caseNo.replace(/[\(\)（）\/\\]/g, '_')}` : '';
  XLSX.writeFile(wb, `债权清算报告${safeName}${safeCase}_${new Date().toISOString().split('T')[0]}.xlsx`);
}
