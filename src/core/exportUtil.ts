import * as XLSX from 'xlsx';
import { CalculationResult, RepaymentRecord } from './types';

export function exportToExcel(result: CalculationResult, meta?: { caseNo?: string; defendant?: string; plaintiff?: string; repayments?: RepaymentRecord[]; executionDueDate?: string }) {
  const title = meta?.caseNo ? `债权本息测算报告（${meta.caseNo}）` : '债权本息测算报告';
  
  const summaryData = [
    [title],
    ['原告 / 债权人', meta?.plaintiff || '未指定', '被告 / 债务人', meta?.defendant || '未指定'],
    ['项目', '数值', '备注说明', ''],
    ['计息天数', `${result.totalDays} 天`, '实际天数算头不算尾', ''],
    ['基准日本金余额', Number(result.principal.toFixed(2)), '最新剩余计息本金', ''],
    ['新发生利息/罚息', Number(result.newPenalty.toFixed(2)), '按浮动/固定利率计付', ''],
    ['新发生复利', Number(result.newCompound.toFixed(2)), '滚动按月计收复利', ''],
    ['加倍迟延履行金', Number(result.delayInterest.toFixed(2)), meta?.executionDueDate ? `自届满日(${meta.executionDueDate})起算(日万分之1.75)` : '依照民诉法日万分之一点七五', ''],
    ['应计债权总额(未扣还款)', Number(result.totalDebt.toFixed(2)), '本金+各衍生息费总额', ''],
    ['判决后已冲减还款总额', Number((result.totalRepaid || 0).toFixed(2)), '选定参与算息的银行扣款还款', ''],
    ['扣减还款后结欠债权净额', Number(((result.netDebt !== undefined ? result.netDebt : result.totalDebt)).toFixed(2)), '最终应清偿/申请执行金额', ''],
    [],
    ['分段计息明细清单（按调息周期与还款切点切割）'],
    ['序号', '起息日期', '止息日期', '天数', '基准利率', '罚息利率', '计息本金', '利息/罚息', '复利', '迟延履行金', '冲减还款', '小计', '事件说明']
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
    interval.repaidTotal ? Number(interval.repaidTotal.toFixed(2)) : 0,
    Number(interval.subtotal.toFixed(2)),
    interval.eventDesc || '-'
  ]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([...summaryData, ...detailData]);
  XLSX.utils.book_append_sheet(wb, ws, "债权清算明细");

  // 如果有银行扣款流水，追加一个独立的“扣款回单明细”Sheet
  if (meta?.repayments && meta.repayments.length > 0) {
    const repaymentSheetData = [
      ['个人贷款扣款回单 / 还款流水明细表'],
      ['序号', '交易流水号', '扣款日期', '归还本金(元)', '归还利息(元)', '归还罚息(元)', '归还复利(元)', '还款总额(元)', '参与算息状态', '说明'],
      ...meta.repayments.map((r, idx) => [
        idx + 1,
        r.serialNo,
        r.date,
        Number(r.principal.toFixed(2)),
        Number(r.interest.toFixed(2)),
        Number(r.penalty.toFixed(2)),
        Number(r.compound.toFixed(2)),
        Number(r.totalAmount.toFixed(2)),
        r.selected !== false ? '已参与冲减' : '未参与',
        r.remark || ''
      ])
    ];
    const wsRepayment = XLSX.utils.aoa_to_sheet(repaymentSheetData);
    XLSX.utils.book_append_sheet(wb, wsRepayment, "银行扣款流水");
  }
  
  const safeName = meta?.defendant ? `_${meta.defendant}` : '';
  const safeCase = meta?.caseNo ? `_${meta.caseNo.replace(/[\(\)（）\/\\]/g, '_')}` : '';
  XLSX.writeFile(wb, `债权清算报告${safeName}${safeCase}_${new Date().toISOString().split('T')[0]}.xlsx`);
}
