import * as XLSX from 'xlsx';
import { CalculationResult, RepaymentRecord } from './types';

export function exportToExcel(
  result: CalculationResult, 
  meta?: { 
    caseNo?: string; 
    defendant?: string; 
    plaintiff?: string; 
    repayments?: RepaymentRecord[]; 
    executionDueDate?: string;
  }
) {
  const title = meta?.caseNo ? `债权本息测算报告（${meta.caseNo}）` : '债权本息测算报告';
  const strategyName = result.deductionStrategy === 'COMMERCIAL_PRINCIPAL_FIRST'
    ? '商业优先冲本模式 (本金→罚息利息→费用→迟延金)'
    : '法定清偿顺序 (民法典561条/执行解释: 费用→利息罚息→本金→迟延金)';

  const delayNote = result.delayTerminated 
    ? '【已触发基数归零熔断】依据法释〔2014〕8号第一条，本金及固定费用清偿完毕后不再计提加倍迟延利息'
    : (meta?.executionDueDate ? `自届满日(${meta.executionDueDate})起算(日万分之1.75)` : '依据法释〔2014〕8号日万分之1.75');

  const summaryData = [
    [title],
    ['原告 / 申请执行人', meta?.plaintiff || '未指定', '被告 / 被执行人', meta?.defendant || '未指定'],
    ['还款抵扣策略', strategyName, '案号', meta?.caseNo || '未指定'],
    ['项目', '数值 (元/天)', '备注说明', ''],
    ['计息天数', `${result.totalDays} 天`, '实际天数算头不算尾', ''],
    ['判决确认本金', Number((result.settlement.principalTarget).toFixed(2)), '生效法律文书确认本金', ''],
    ['判决确认案件受理费', Number(result.litigationFee.toFixed(2)), '并入执行款清偿标的池', ''],
    ['判决确认保全费/执行费', Number(result.preservationFee.toFixed(2)), '并入执行款清偿标的池', ''],
    ['最新尚欠本金余额', Number(result.principal.toFixed(2)), result.totalRepaidPrincipal > 0 ? `已冲减本金 ￥${result.totalRepaidPrincipal.toFixed(2)}` : '未清偿本金', ''],
    ['新发生利息/罚息', Number(result.newPenalty.toFixed(2)), '按浮动/固定利率分段计付', ''],
    ['新发生复利', Number(result.newCompound.toFixed(2)), '滚动计收复利', ''],
    ['加倍迟延履行金', Number(result.delayInterest.toFixed(2)), delayNote, ''],
    ['债权应计总额(未扣还款)', Number(result.totalDebt.toFixed(2)), '本金+费用+各项衍生息费总额', ''],
    ['判决后已冲减还款总额', Number((result.totalRepaid || 0).toFixed(2)), '选定参与算息的扣款还款', ''],
    ['扣减还款后结欠净额', Number(result.netDebt.toFixed(2)), result.settlement.isFullySettled ? '债权已全额结清 (￥0.00)' : '最终应清偿/申请执行标的净额', ''],
    [],
    ['分段计息明细清单（按调息周期与还款切点切割）'],
    [
      '序号', 
      '起息日期', 
      '止息日期', 
      '天数', 
      '基准利率', 
      '罚息利率', 
      '计息本金', 
      '迟延金基数(法释8号)', 
      '利息/罚息', 
      '复利', 
      '迟延履行金', 
      '冲减总额', 
      '抵充费用', 
      '抵充欠息', 
      '抵充本金', 
      '抵充迟延金', 
      '期末本金结余', 
      '区间小计', 
      '事件说明'
    ]
  ];

  const detailData = result.intervals.map((interval, idx) => [
    idx + 1,
    interval.start,
    interval.end,
    interval.days,
    `${interval.baseRate.toFixed(2)}%`,
    `${interval.penaltyRate.toFixed(4)}%`,
    Number(interval.principal.toFixed(2)),
    Number((interval.delayBase || 0).toFixed(2)),
    Number(interval.interest.toFixed(2)),
    Number(interval.compound.toFixed(2)),
    Number(interval.delay.toFixed(2)),
    interval.repaidTotal ? Number(interval.repaidTotal.toFixed(2)) : 0,
    interval.repaidFee ? Number(interval.repaidFee.toFixed(2)) : 0,
    interval.repaidInterest ? Number(interval.repaidInterest.toFixed(2)) : 0,
    interval.repaidPrincipal ? Number(interval.repaidPrincipal.toFixed(2)) : 0,
    interval.repaidDelay ? Number(interval.repaidDelay.toFixed(2)) : 0,
    Number((interval.remainingPrincipal !== undefined ? interval.remainingPrincipal : interval.principal).toFixed(2)),
    Number(interval.subtotal.toFixed(2)),
    interval.eventDesc || '-'
  ]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([...summaryData, ...detailData]);
  XLSX.utils.book_append_sheet(wb, ws, "债权清算明细");

  // 生成《执行款分配与结清确认表》独立 Sheet
  const s = result.settlement;
  const settlementSheetData = [
    ['【法院执行及对账司法证据】执行款分配与结清确认表'],
    ['案号', meta?.caseNo || '未指定', '出具日期', new Date().toISOString().split('T')[0]],
    ['申请执行人(原告)', meta?.plaintiff || '未指定', '被执行人(被告)', meta?.defendant || '未指定'],
    ['清偿顺序抵扣策略', strategyName],
    [],
    ['一、执行标的清算池 (生效文书及孳息汇总)'],
    ['标的类别', '确认金额 (元)', '法定清偿顺序', '说明'],
    ['生效裁判确定的借款本金', Number(s.principalTarget.toFixed(2)), '先清偿费用欠息后冲本 (或约定优先冲本)', '除一般债务利息外的法定金钱债务基数'],
    ['生效裁判确定的案件受理费', Number(s.litigationFeeTarget.toFixed(2)), '第 1 顺位 (费用及实现债权费用)', '法定优先受偿金钱债务'],
    ['生效裁判确定的保全费/执行费', Number(s.preservationFeeTarget.toFixed(2)), '第 1 顺位 (费用及实现债权费用)', '法定优先受偿金钱债务'],
    ['基准日前历史欠息及罚息', Number((s.baseInterestTarget + s.basePenaltyTarget).toFixed(2)), '第 2 顺位 (一般债务利息/罚息)', '判决主文确定的基准日前息费'],
    ['裁判后新发生利息/罚息', Number(s.newPenaltyTarget.toFixed(2)), '第 2 顺位 (一般债务利息/罚息)', '按裁判利率分段持续计付'],
    ['裁判后新发生复利', Number(s.newCompoundTarget.toFixed(2)), '第 2 顺位 (一般债务利息/罚息)', '按约定月度复利计提'],
    ['加倍迟延履行期间债务利息', Number(s.delayInterestTarget.toFixed(2)), '末位清偿 (全部金钱债务清偿后再清偿)', delayNote],
    ['债权应计总标的 (未扣减还款)', Number(s.totalDebtTarget.toFixed(2)), '-', '以上各项本金、息费与诉讼费用合计'],
    [],
    ['二、还款抵充与冲销分配'],
    ['抵扣流向类别', '累计抵充金额 (元)', '占还款总额比例', '结清状态'],
    ['累计抵充诉讼与保全费用', Number(s.allocatedFeeTotal.toFixed(2)), s.totalRepaid > 0 ? `${((s.allocatedFeeTotal / s.totalRepaid) * 100).toFixed(1)}%` : '0%', s.remainingFee === 0 ? '已全部结清' : `尚欠￥${s.remainingFee.toFixed(2)}`],
    ['累计抵充利息/罚息/复利', Number(s.allocatedInterestTotal.toFixed(2)), s.totalRepaid > 0 ? `${((s.allocatedInterestTotal / s.totalRepaid) * 100).toFixed(1)}%` : '0%', s.remainingInterest === 0 ? '已全部结清' : `尚欠￥${s.remainingInterest.toFixed(2)}`],
    ['累计抵充借款本金', Number(s.allocatedPrincipalTotal.toFixed(2)), s.totalRepaid > 0 ? `${((s.allocatedPrincipalTotal / s.totalRepaid) * 100).toFixed(1)}%` : '0%', s.remainingPrincipal === 0 ? '本金已清零(迟延金熔断)' : `尚欠￥${s.remainingPrincipal.toFixed(2)}`],
    ['累计抵充加倍迟延履行金', Number(s.allocatedDelayTotal.toFixed(2)), s.totalRepaid > 0 ? `${((s.allocatedDelayTotal / s.totalRepaid) * 100).toFixed(1)}%` : '0%', s.remainingDelay === 0 ? '已全部结清' : `尚欠￥${s.remainingDelay.toFixed(2)}`],
    ['累计还款入账总额', Number(s.totalRepaid.toFixed(2)), '100.0%', s.surplusTotal > 0 ? `存在超额结余￥${s.surplusTotal.toFixed(2)}` : '无溢缴'],
    [],
    ['三、最终执行结欠净额确认'],
    ['项目', '金额 (元)', '法律依据', '执行处置建议'],
    ['尚欠借款本金净额', Number(s.remainingPrincipal.toFixed(2)), '民事判决书主文第一项', s.remainingPrincipal === 0 ? '本金结清，基数归零熔断' : '继续作为罚息基数强制执行'],
    ['尚欠诉讼与保全费净额', Number(s.remainingFee.toFixed(2)), '民事判决书主文/交费通知', s.remainingFee === 0 ? '费用已受偿' : '优先受偿'],
    ['尚欠利息/罚息/复利净额', Number(s.remainingInterest.toFixed(2)), '民事判决书主文第二项', s.remainingInterest === 0 ? '一般债务利息结清' : '强制执行'],
    ['尚欠加倍迟延履行金净额', Number(s.remainingDelay.toFixed(2)), '法释〔2014〕8号/民事诉讼法第264条', s.delayTerminated ? '基数清零已熔断终止计提' : '按实际履行天数计提'],
    ['最终应清偿 / 申请执行总净额', Number(s.netDebtTotal.toFixed(2)), '《中华人民共和国民事诉讼法》', s.isFullySettled ? '【全案执行完毕结清】' : '【向执行法院申请立案/扣划标的】'],
    [],
    ['四、单笔还款抵充分配流水明细清单'],
    ['序号', '还款日期', '交易流水号', '还款入账金额 (元)', '抵充费用 (元)', '抵充利息罚息 (元)', '抵充借款本金 (元)', '抵充迟延履行金 (元)', '超额溢缴款 (元)']
  ];

  s.allocations.forEach((item, idx) => {
    settlementSheetData.push([
      idx + 1,
      item.date,
      item.serialNo || '-',
      Number(item.amount.toFixed(2)),
      Number(item.allocatedFee.toFixed(2)),
      Number(item.allocatedInterest.toFixed(2)),
      Number(item.allocatedPrincipal.toFixed(2)),
      Number(item.allocatedDelay.toFixed(2)),
      Number(item.surplusAmount.toFixed(2))
    ] as any);
  });

  const wsSettlement = XLSX.utils.aoa_to_sheet(settlementSheetData);
  XLSX.utils.book_append_sheet(wb, wsSettlement, "执行款分配与结清确认表");

  // 如果有银行扣款流水，保留独立的“扣款回单明细”Sheet
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
  const safeCase = meta?.caseNo ? `_${meta.caseNo.replace(/[\u0028\u0029\uFF08\uFF09\u002F\\]/g, '_')}` : '';
  XLSX.writeFile(wb, `司法级执行款清算证据清单${safeName}${safeCase}_${new Date().toISOString().split('T')[0]}.xlsx`);
}
