import * as XLSX from 'xlsx-js-style';
import type { CellStyle } from 'xlsx-js-style';
import { CalculationResult, RepaymentRecord } from './types';
import { roundToFen } from './calculator';

/* ============================================================
   「法院蓝」制式证据清单导出
   - 制式配色：法院深蓝 #1F4E79 / 制式蓝 #2E5B9F / 浅蓝 #DCE6F1
   - 全表细边框、标题通栏、表头白字、正文宋体、金额千分位
   - 分 Sheet 制式化：测算总览 / 分段计息明细 / 执行款分配与结清确认表 / 还款抵充分配流水 / 银行扣款流水
   ============================================================ */

// ---------- 制式配色与字体 ----------
const FONT_HEI = '黑体';
const FONT_SONG = '宋体';
const C = {
  deep: '1F4E79',    // 法院深蓝（标题、强调行）
  mid: '2E5B9F',     // 制式蓝（表头）
  light: 'DCE6F1',   // 浅蓝（标签、合计）
  zebra: 'F2F7FC',   // 斑马纹
  panel: 'EAF1F8',   // 章节条
  border: '95B3D7',  // 蓝灰边框
  ink: '1F2937',     // 正文墨色
  gray: '595959',    // 副标题灰
  red: 'C00000',     // 强调红
};

const thin = { style: 'thin', color: { rgb: C.border } } as const;
const borderAll = { top: thin, bottom: thin, left: thin, right: thin };
const mediumTop = {
  top: { style: 'medium' as const, color: { rgb: C.mid } },
  bottom: thin, left: thin, right: thin,
};

const STYLES: Record<string, CellStyle> = {
  // 通栏主标题：深蓝底白字黑体
  title: {
    font: { name: FONT_HEI, sz: 16, bold: true, color: { rgb: 'FFFFFF' } },
    fill: { patternType: 'solid', fgColor: { rgb: C.deep } },
    alignment: { horizontal: 'center', vertical: 'center' },
  },
  // 副标题：浅蓝底灰字
  subtitle: {
    font: { name: FONT_SONG, sz: 10, color: { rgb: C.gray } },
    fill: { patternType: 'solid', fgColor: { rgb: C.light } },
    alignment: { horizontal: 'center', vertical: 'center' },
  },
  // 章节条
  section: {
    font: { name: FONT_HEI, sz: 11, bold: true, color: { rgb: C.deep } },
    fill: { patternType: 'solid', fgColor: { rgb: C.panel } },
    alignment: { horizontal: 'left', vertical: 'center' },
  },
  // 表头：制式蓝底白字
  header: {
    font: { name: FONT_HEI, sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
    fill: { patternType: 'solid', fgColor: { rgb: C.mid } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: borderAll,
  },
  // 标签格：浅蓝底加粗
  label: {
    font: { name: FONT_HEI, sz: 10, bold: true, color: { rgb: C.deep } },
    fill: { patternType: 'solid', fgColor: { rgb: C.light } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: borderAll,
  },
  // 正文：白底宋体
  text: {
    font: { name: FONT_SONG, sz: 10, color: { rgb: C.ink } },
    alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
    border: borderAll,
  },
  // 正文：居中
  textC: {
    font: { name: FONT_SONG, sz: 10, color: { rgb: C.ink } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: borderAll,
  },
  // 斑马纹正文
  textZebra: {
    font: { name: FONT_SONG, sz: 10, color: { rgb: C.ink } },
    fill: { patternType: 'solid', fgColor: { rgb: C.zebra } },
    alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
    border: borderAll,
  },
  textCZebra: {
    font: { name: FONT_SONG, sz: 10, color: { rgb: C.ink } },
    fill: { patternType: 'solid', fgColor: { rgb: C.zebra } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: borderAll,
  },
  // 金额：千分位右对齐
  money: {
    font: { name: FONT_SONG, sz: 10, color: { rgb: C.ink } },
    alignment: { horizontal: 'right', vertical: 'center' },
    border: borderAll,
    numFmt: '#,##0.00',
  },
  moneyZebra: {
    font: { name: FONT_SONG, sz: 10, color: { rgb: C.ink } },
    fill: { patternType: 'solid', fgColor: { rgb: C.zebra } },
    alignment: { horizontal: 'right', vertical: 'center' },
    border: borderAll,
    numFmt: '#,##0.00',
  },
  // 整数（序号/天数）
  int: {
    font: { name: FONT_SONG, sz: 10, color: { rgb: C.ink } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: borderAll,
    numFmt: '0',
  },
  intZebra: {
    font: { name: FONT_SONG, sz: 10, color: { rgb: C.ink } },
    fill: { patternType: 'solid', fgColor: { rgb: C.zebra } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: borderAll,
    numFmt: '0',
  },
  // 合计行：浅蓝底加粗 + 上中边框
  totalLabel: {
    font: { name: FONT_HEI, sz: 10, bold: true, color: { rgb: C.deep } },
    fill: { patternType: 'solid', fgColor: { rgb: C.light } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: mediumTop,
  },
  totalText: {
    font: { name: FONT_HEI, sz: 10, bold: true, color: { rgb: C.deep } },
    fill: { patternType: 'solid', fgColor: { rgb: C.light } },
    alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
    border: mediumTop,
  },
  totalMoney: {
    font: { name: FONT_HEI, sz: 10, bold: true, color: { rgb: C.deep } },
    fill: { patternType: 'solid', fgColor: { rgb: C.light } },
    alignment: { horizontal: 'right', vertical: 'center' },
    border: mediumTop,
    numFmt: '#,##0.00',
  },
  // 强调行（最终执行净额）：深蓝底白字，金额红色加粗
  finalLabel: {
    font: { name: FONT_HEI, sz: 10.5, bold: true, color: { rgb: 'FFFFFF' } },
    fill: { patternType: 'solid', fgColor: { rgb: C.deep } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: borderAll,
  },
  finalText: {
    font: { name: FONT_SONG, sz: 10, color: { rgb: 'FFFFFF' } },
    fill: { patternType: 'solid', fgColor: { rgb: C.deep } },
    alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
    border: borderAll,
  },
  finalMoney: {
    font: { name: FONT_HEI, sz: 11, bold: true, color: { rgb: 'FFD966' } },
    fill: { patternType: 'solid', fgColor: { rgb: C.deep } },
    alignment: { horizontal: 'right', vertical: 'center' },
    border: borderAll,
    numFmt: '#,##0.00',
  },
};

// 单元格定义：值 + 样式名（缺省为 text）
type Cell = { v: string | number; s?: string } | string | number | null;

interface SheetDraft {
  rows: Cell[][];
  merges: XLSX.Range[];
  heights: (number | undefined)[];
  cols: { wch: number }[];
}

function newDraft(cols: { wch: number }[]): SheetDraft {
  return { rows: [], merges: [], heights: [], cols };
}

function addRow(draft: SheetDraft, cells: Cell[], height?: number): number {
  draft.rows.push(cells);
  draft.heights.push(height);
  return draft.rows.length - 1;
}

/** 添加通栏合并行 */
function addMergedRow(draft: SheetDraft, v: string | number, s: string, spanTo: number, height?: number): number {
  const ri = addRow(draft, [{ v, s }]);
  draft.merges.push({ s: { r: ri, c: 0 }, e: { r: ri, c: spanTo } });
  return ri;
}

function spacer(draft: SheetDraft, height = 8): void {
  addRow(draft, [null], height);
}

function buildSheet(draft: SheetDraft): XLSX.WorkSheet {
  const aoa = draft.rows.map(row => row.map(c => (c !== null && typeof c === 'object' ? c.v : c)));
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  draft.rows.forEach((row, ri) => {
    row.forEach((cell, ci) => {
      if (cell !== null && typeof cell === 'object' && cell.s && STYLES[cell.s]) {
        const addr = XLSX.utils.encode_cell({ r: ri, c: ci });
        ws[addr] = { ...ws[addr], s: STYLES[cell.s] };
      }
    });
  });

  ws['!cols'] = draft.cols;
  ws['!rows'] = draft.heights.map(h => (h !== undefined ? { hpt: h } : {}));
  if (draft.merges.length) ws['!merges'] = draft.merges;
  return ws;
}

const money = (v: number): Cell => ({ v: Number(v.toFixed(2)), s: 'money' });
const int = (v: number): Cell => ({ v, s: 'int' });
const date = (v: string): Cell => ({ v, s: 'textC' });

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

  const today = new Date().toISOString().split('T')[0];
  const s = result.settlement;

  /* ---------------- Sheet 1：测算总览 ---------------- */
  const ws1 = newDraft([{ wch: 26 }, { wch: 20 }, { wch: 62 }]);

  addMergedRow(ws1, title, 'title', 2, 34);
  addMergedRow(ws1, '法院制式证据清单 · 依据《民法典》第561条、法释〔2014〕8号及执行解释编制', 'subtitle', 2, 18);
  spacer(ws1);

  addRow(ws1, [{ v: '案号', s: 'label' }, { v: meta?.caseNo || '未指定', s: 'textC' }, ''], 20);
  addRow(ws1, [{ v: '出具日期', s: 'label' }, { v: today, s: 'textC' }, ''], 20);
  addRow(ws1, [{ v: '申请执行人（原告）', s: 'label' }, { v: meta?.plaintiff || '未指定', s: 'textC' }, ''], 20);
  addRow(ws1, [{ v: '被执行人（被告）', s: 'label' }, { v: meta?.defendant || '未指定', s: 'textC' }, ''], 20);
  const riStrategy = addRow(ws1, [{ v: '还款抵扣策略', s: 'label' }, { v: strategyName, s: 'text' }, ''], 22);
  ws1.merges.push({ s: { r: riStrategy, c: 1 }, e: { r: riStrategy, c: 2 } });
  const riDelay = addRow(ws1, [{ v: '迟延履行金口径', s: 'label' }, { v: delayNote, s: 'text' }, ''], 22);
  ws1.merges.push({ s: { r: riDelay, c: 1 }, e: { r: riDelay, c: 2 } });
  spacer(ws1);

  addMergedRow(ws1, '一、债权测算总览', 'section', 2, 22);
  addRow(ws1, [
    { v: '项目', s: 'header' },
    { v: '数值（元 / 天）', s: 'header' },
    { v: '备注说明', s: 'header' },
  ], 22);

  const overview: Array<[string, string | number, boolean, string]> = [
    ['计息天数', `${result.totalDays} 天`, false, '实际天数算头不算尾'],
    ['判决确认本金', Number(result.settlement.principalTarget.toFixed(2)), true, '生效法律文书确认本金'],
    ['判决确认案件受理费', Number(result.litigationFee.toFixed(2)), true, '并入执行款清偿标的池'],
    ['判决确认保全费/执行费', Number(result.preservationFee.toFixed(2)), true, '并入执行款清偿标的池'],
    ['最新尚欠本金余额', Number(result.principal.toFixed(2)), true, result.totalRepaidPrincipal > 0 ? `已冲减本金 ￥${result.totalRepaidPrincipal.toFixed(2)}` : '未清偿本金'],
    ['新发生利息/罚息', Number(result.newPenalty.toFixed(2)), true, '按浮动/固定利率分段计付'],
    ['新发生复利', Number(result.newCompound.toFixed(2)), true, '滚动计收复利'],
    ['加倍迟延履行金', Number(result.delayInterest.toFixed(2)), true, delayNote],
    ['债权应计总额(未扣还款)', Number(result.totalDebt.toFixed(2)), true, '本金+费用+各项衍生息费总额'],
    ['判决后已冲减还款总额', Number((result.totalRepaid || 0).toFixed(2)), true, '选定参与算息的扣款还款'],
    ['扣减还款后结欠净额', Number(result.netDebt.toFixed(2)), true, result.settlement.isFullySettled ? '债权已全额结清 (￥0.00)' : '最终应清偿/申请执行标的净额'],
  ];
  overview.forEach(([label, val, isMoney, remark], idx) => {
    const zebra = idx % 2 === 1;
    addRow(ws1, [
      { v: label, s: zebra ? 'textCZebra' : 'textC' },
      isMoney ? { v: val as number, s: zebra ? 'moneyZebra' : 'money' } : { v: val, s: zebra ? 'textCZebra' : 'textC' },
      { v: remark, s: zebra ? 'textZebra' : 'text' },
    ], 20);
  });
  // 结欠净额强调行
  const lastOverview = ws1.rows.length - 1;
  ['totalLabel', 'totalMoney', 'totalText'].forEach((st, ci) => {
    const addr = XLSX.utils.encode_cell({ r: lastOverview, c: ci });
    if (ws1[addr]) ws1[addr] = { ...ws1[addr], s: STYLES[st] };
  });
  ws1.merges.push({ s: { r: lastOverview, c: 2 }, e: { r: lastOverview, c: 2 } });

  // 分协议号测算明细（同一被告多笔贷款分账独立计息）
  if (result.perAgreement && result.perAgreement.length > 0) {
    spacer(ws1);
    addMergedRow(ws1, '二、分协议号测算明细（同一被告名下多笔贷款分账独立计息）', 'section', 2, 22);
    addRow(ws1, [
      { v: '贷款协议号', s: 'header' },
      { v: '结欠净额（元）', s: 'header' },
      { v: '分项明细', s: 'header' },
    ], 22);
    result.perAgreement.forEach((a, idx) => {
      const zebra = idx % 2 === 1;
      addRow(ws1, [
        { v: a.agreementNo, s: zebra ? 'textCZebra' : 'textC' },
        { v: Number(a.netDebt.toFixed(2)), s: zebra ? 'moneyZebra' : 'money' },
        {
          v: `本金￥${a.principalTarget.toFixed(2)}｜暂计利息￥${a.baseInterest.toFixed(2)}｜暂计罚息￥${a.basePenalty.toFixed(2)}｜新罚息￥${a.newPenalty.toFixed(2)}｜新复利￥${a.newCompound.toFixed(2)}｜迟延金￥${a.delayInterest.toFixed(2)}｜已冲减￥${a.totalRepaid.toFixed(2)}`,
          s: zebra ? 'textZebra' : 'text',
        },
      ], 20);
    });
    const aggNetDebt = result.perAgreement.reduce((sum, a) => sum + a.netDebt, 0);
    const aggPrincipal = result.perAgreement.reduce((sum, a) => sum + a.principalTarget, 0);
    addRow(ws1, [
      { v: '协议合计', s: 'totalLabel' },
      { v: Number(roundToFen(aggNetDebt).toFixed(2)), s: 'totalMoney' },
      { v: `本金合计￥${roundToFen(aggPrincipal).toFixed(2)}；各协议分项之和与上方「债权测算总览」一致`, s: 'totalText' },
    ], 22);
  }

  /* ---------------- Sheet 2：分段计息明细 ---------------- */
  const ws2 = newDraft([
    { wch: 6 }, { wch: 11 }, { wch: 11 }, { wch: 7 }, { wch: 9.5 }, { wch: 10.5 },
    { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
    { wch: 11 }, { wch: 11 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 30 },
  ]);

  addMergedRow(ws2, '分段计息明细清单（按调息周期与还款切点切割）', 'title', 18, 32);
  addMergedRow(ws2, '单位：元 · 天数算头不算尾 · 利率为年化展示 · 迟延金基数为法释〔2014〕8号口径', 'subtitle', 18, 18);
  spacer(ws2);

  const detailHeader = [
    '序号', '起息日期', '止息日期', '天数', '基准利率', '罚息利率', '计息本金',
    '迟延金基数(法释8号)', '利息/罚息', '复利', '迟延履行金', '冲减总额',
    '抵充费用', '抵充欠息', '抵充本金', '抵充迟延金', '期末本金结余', '区间小计', '事件说明',
  ];
  addRow(ws2, detailHeader.map(h => ({ v: h, s: 'header' })), 30);

  const renderIntervalRow = (interval: CalculationResult['intervals'][number], idx: number) => {
    const zebra = idx % 2 === 1;
    const tS = zebra ? 'textCZebra' : 'textC';
    const tL = zebra ? 'textZebra' : 'text';
    const mS = zebra ? 'moneyZebra' : 'money';
    const iS = zebra ? 'intZebra' : 'int';
    addRow(ws2, [
      int(idx + 1) as Cell,
      date(interval.start),
      date(interval.end),
      { v: interval.days, s: iS },
      { v: `${interval.baseRate.toFixed(2)}%`, s: tS },
      { v: `${interval.penaltyRate.toFixed(4)}%`, s: tS },
      { v: Number(interval.principal.toFixed(2)), s: mS },
      { v: Number((interval.delayBase || 0).toFixed(2)), s: mS },
      { v: Number(interval.interest.toFixed(2)), s: mS },
      { v: Number(interval.compound.toFixed(2)), s: mS },
      { v: Number(interval.delay.toFixed(2)), s: mS },
      { v: interval.repaidTotal ? Number(interval.repaidTotal.toFixed(2)) : 0, s: mS },
      { v: interval.repaidFee ? Number(interval.repaidFee.toFixed(2)) : 0, s: mS },
      { v: interval.repaidInterest ? Number(interval.repaidInterest.toFixed(2)) : 0, s: mS },
      { v: interval.repaidPrincipal ? Number(interval.repaidPrincipal.toFixed(2)) : 0, s: mS },
      { v: interval.repaidDelay ? Number(interval.repaidDelay.toFixed(2)) : 0, s: mS },
      { v: Number((interval.remainingPrincipal !== undefined ? interval.remainingPrincipal : interval.principal).toFixed(2)), s: mS },
      { v: Number(interval.subtotal.toFixed(2)), s: mS },
      { v: interval.eventDesc || '-', s: tL },
    ], 20);
  };

  // 分协议小计行（列结构与合计行一致）
  const addAgreementSubtotal = (agreementNo: string, ivs: CalculationResult['intervals']) => {
    const sumOf = (pick: (iv: CalculationResult['intervals'][number]) => number) =>
      ivs.reduce((acc, iv) => acc + (pick(iv) || 0), 0);
    const ri = addRow(ws2, [
      { v: `小计 ${agreementNo}`, s: 'totalLabel' }, { v: '—', s: 'totalLabel' }, { v: '—', s: 'totalLabel' },
      { v: sumOf(iv => iv.days), s: 'totalLabel' },
      { v: '—', s: 'totalLabel' }, { v: '—', s: 'totalLabel' },
      { v: '—', s: 'totalLabel' }, { v: '—', s: 'totalLabel' },
      { v: Number(roundToFen(sumOf(iv => iv.interest)).toFixed(2)), s: 'totalMoney' },
      { v: Number(roundToFen(sumOf(iv => iv.compound)).toFixed(2)), s: 'totalMoney' },
      { v: Number(roundToFen(sumOf(iv => iv.delay)).toFixed(2)), s: 'totalMoney' },
      { v: Number(roundToFen(sumOf(iv => iv.repaidTotal)).toFixed(2)), s: 'totalMoney' },
      { v: Number(roundToFen(sumOf(iv => iv.repaidFee)).toFixed(2)), s: 'totalMoney' },
      { v: Number(roundToFen(sumOf(iv => iv.repaidInterest)).toFixed(2)), s: 'totalMoney' },
      { v: Number(roundToFen(sumOf(iv => iv.repaidPrincipal)).toFixed(2)), s: 'totalMoney' },
      { v: Number(roundToFen(sumOf(iv => iv.repaidDelay)).toFixed(2)), s: 'totalMoney' },
      { v: '—', s: 'totalLabel' },
      { v: Number(roundToFen(sumOf(iv => iv.subtotal)).toFixed(2)), s: 'totalMoney' },
      { v: `共 ${ivs.length} 个计息区间`, s: 'totalText' },
    ], 22);
    ws2.merges.push({ s: { r: ri, c: 0 }, e: { r: ri, c: 2 } });
  };

  // 多协议案件：按协议号分组渲染（列结构不变，仅插入协议分组标题与小计行）
  if (result.perAgreement && result.perAgreement.length > 0) {
    let globalIdx = 0;
    result.perAgreement.forEach((agg) => {
      const ivs = result.intervals.filter(iv => iv.agreementNo === agg.agreementNo);
      addMergedRow(ws2, `协议号 ${agg.agreementNo} （本金￥${agg.principalTarget.toFixed(2)} · 结欠净额￥${agg.netDebt.toFixed(2)}）`, 'section', 18, 22);
      ivs.forEach((interval) => { renderIntervalRow(interval, globalIdx++); });
      addAgreementSubtotal(agg.agreementNo, ivs);
      spacer(ws2);
    });
  } else {
    result.intervals.forEach((interval, idx) => renderIntervalRow(interval, idx));
  }

  // 合计行
  const sumOf = (pick: (iv: CalculationResult['intervals'][number]) => number) =>
    result.intervals.reduce((acc, iv) => acc + (pick(iv) || 0), 0);
  const totalRi = addRow(ws2, [
    { v: '合计', s: 'totalLabel' }, { v: '—', s: 'totalLabel' }, { v: '—', s: 'totalLabel' },
    { v: sumOf(iv => iv.days), s: 'totalLabel' },
    { v: '—', s: 'totalLabel' }, { v: '—', s: 'totalLabel' },
    { v: '—', s: 'totalLabel' }, { v: '—', s: 'totalLabel' },
    { v: Number(sumOf(iv => iv.interest).toFixed(2)), s: 'totalMoney' },
    { v: Number(sumOf(iv => iv.compound).toFixed(2)), s: 'totalMoney' },
    { v: Number(sumOf(iv => iv.delay).toFixed(2)), s: 'totalMoney' },
    { v: Number(sumOf(iv => iv.repaidTotal).toFixed(2)), s: 'totalMoney' },
    { v: Number(sumOf(iv => iv.repaidFee).toFixed(2)), s: 'totalMoney' },
    { v: Number(sumOf(iv => iv.repaidInterest).toFixed(2)), s: 'totalMoney' },
    { v: Number(sumOf(iv => iv.repaidPrincipal).toFixed(2)), s: 'totalMoney' },
    { v: Number(sumOf(iv => iv.repaidDelay).toFixed(2)), s: 'totalMoney' },
    { v: '—', s: 'totalLabel' },
    { v: Number(sumOf(iv => iv.subtotal).toFixed(2)), s: 'totalMoney' },
    { v: `共 ${result.intervals.length} 个计息区间`, s: 'totalText' },
  ], 22);
  ws2.merges.push({ s: { r: totalRi, c: 0 }, e: { r: totalRi, c: 2 } });

  /* ---------------- Sheet 3：执行款分配与结清确认表 ---------------- */
  const ws3 = newDraft([{ wch: 30 }, { wch: 18 }, { wch: 36 }, { wch: 40 }]);

  addMergedRow(ws3, '执行款分配与结清确认表', 'title', 3, 34);
  addMergedRow(ws3, '【法院执行及对账司法证据】执行款分配与结清确认', 'subtitle', 3, 18);
  spacer(ws3);

  addRow(ws3, [
    { v: '案号', s: 'label' }, { v: meta?.caseNo || '未指定', s: 'textC' },
    { v: '出具日期', s: 'label' }, { v: today, s: 'textC' },
  ], 20);
  addRow(ws3, [
    { v: '申请执行人(原告)', s: 'label' }, { v: meta?.plaintiff || '未指定', s: 'textC' },
    { v: '被执行人(被告)', s: 'label' }, { v: meta?.defendant || '未指定', s: 'textC' },
  ], 20);
  const riStrategy3 = addRow(ws3, [
    { v: '清偿顺序抵扣策略', s: 'label' }, { v: strategyName, s: 'text' }, { v: '', s: 'text' }, { v: '', s: 'text' },
  ], 22);
  ws3.merges.push({ s: { r: riStrategy3, c: 1 }, e: { r: riStrategy3, c: 3 } });
  spacer(ws3);

  // 一、执行标的清算池
  addMergedRow(ws3, '一、执行标的清算池（生效文书及孳息汇总）', 'section', 3, 22);
  addRow(ws3, [
    { v: '标的类别', s: 'header' }, { v: '确认金额（元）', s: 'header' },
    { v: '法定清偿顺序', s: 'header' }, { v: '说明', s: 'header' },
  ], 24);
  const poolRows: Array<[string, number, string, string]> = [
    ['生效裁判确定的借款本金', s.principalTarget, '先清偿费用欠息后冲本 (或约定优先冲本)', '除一般债务利息外的法定金钱债务基数'],
    ['生效裁判确定的案件受理费', s.litigationFeeTarget, '第 1 顺位 (费用及实现债权费用)', '法定优先受偿金钱债务'],
    ['生效裁判确定的保全费/执行费', s.preservationFeeTarget, '第 1 顺位 (费用及实现债权费用)', '法定优先受偿金钱债务'],
    ['基准日前历史欠息及罚息', s.baseInterestTarget + s.basePenaltyTarget, '第 2 顺位 (一般债务利息/罚息)', '判决主文确定的基准日前息费'],
    ['裁判后新发生利息/罚息', s.newPenaltyTarget, '第 2 顺位 (一般债务利息/罚息)', '按裁判利率分段持续计付'],
    ['裁判后新发生复利', s.newCompoundTarget, '第 2 顺位 (一般债务利息/罚息)', '按约定月度复利计提'],
    ['加倍迟延履行期间债务利息', s.delayInterestTarget, '末位清偿 (全部金钱债务清偿后再清偿)', delayNote],
    ['债权应计总标的 (未扣减还款)', s.totalDebtTarget, '-', '以上各项本金、息费与诉讼费用合计'],
  ];
  poolRows.forEach(([label, val, order, note], idx) => {
    const zebra = idx % 2 === 1;
    addRow(ws3, [
      { v: label, s: zebra ? 'textZebra' : 'text' },
      { v: Number(val.toFixed(2)), s: zebra ? 'moneyZebra' : 'money' },
      { v: order, s: zebra ? 'textZebra' : 'text' },
      { v: note, s: zebra ? 'textZebra' : 'text' },
    ], 20);
  });
  spacer(ws3);

  // 二、还款抵充与冲销分配汇总
  addMergedRow(ws3, '二、还款抵充与冲销分配汇总', 'section', 3, 22);
  addRow(ws3, [
    { v: '抵扣流向类别', s: 'header' }, { v: '累计抵充金额（元）', s: 'header' },
    { v: '占还款总额比例', s: 'header' }, { v: '结清状态', s: 'header' },
  ], 24);
  const pctOf = (v: number) => (s.totalRepaid > 0 ? `${((v / s.totalRepaid) * 100).toFixed(1)}%` : '0%');
  const allocRows: Array<[string, number, string, string]> = [
    ['累计抵充诉讼与保全费用', s.allocatedFeeTotal, pctOf(s.allocatedFeeTotal), s.remainingFee === 0 ? '已全部结清' : `尚欠￥${s.remainingFee.toFixed(2)}`],
    ['累计抵充利息/罚息/复利', s.allocatedInterestTotal, pctOf(s.allocatedInterestTotal), s.remainingInterest === 0 ? '已全部结清' : `尚欠￥${s.remainingInterest.toFixed(2)}`],
    ['累计抵充借款本金', s.allocatedPrincipalTotal, pctOf(s.allocatedPrincipalTotal), s.remainingPrincipal === 0 ? '本金已清零(迟延金熔断)' : `尚欠￥${s.remainingPrincipal.toFixed(2)}`],
    ['累计抵充加倍迟延履行金', s.allocatedDelayTotal, pctOf(s.allocatedDelayTotal), s.remainingDelay === 0 ? '已全部结清' : `尚欠￥${s.remainingDelay.toFixed(2)}`],
    ['累计还款入账总额', s.totalRepaid, '100.0%', s.surplusTotal > 0 ? `存在超额结余￥${s.surplusTotal.toFixed(2)}` : '无溢缴'],
  ];
  allocRows.forEach(([label, val, pct, status], idx) => {
    const zebra = idx % 2 === 1;
    addRow(ws3, [
      { v: label, s: zebra ? 'textZebra' : 'text' },
      { v: Number(val.toFixed(2)), s: zebra ? 'moneyZebra' : 'money' },
      { v: pct, s: zebra ? 'textCZebra' : 'textC' },
      { v: status, s: zebra ? 'textZebra' : 'text' },
    ], 20);
  });
  spacer(ws3);

  // 三、最终执行结欠净额确认
  addMergedRow(ws3, '三、最终执行结欠净额确认', 'section', 3, 22);
  addRow(ws3, [
    { v: '项目', s: 'header' }, { v: '金额（元）', s: 'header' },
    { v: '法律依据', s: 'header' }, { v: '执行处置建议', s: 'header' },
  ], 24);
  const netRows: Array<[string, number, string, string]> = [
    ['尚欠借款本金净额', s.remainingPrincipal, '民事判决书主文第一项', s.remainingPrincipal === 0 ? '本金结清，基数归零熔断' : '继续作为罚息基数强制执行'],
    ['尚欠诉讼与保全费净额', s.remainingFee, '民事判决书主文/交费通知', s.remainingFee === 0 ? '费用已受偿' : '优先受偿'],
    ['尚欠利息/罚息/复利净额', s.remainingInterest, '民事判决书主文第二项', s.remainingInterest === 0 ? '一般债务利息结清' : '强制执行'],
    ['尚欠加倍迟延履行金净额', s.remainingDelay, '法释〔2014〕8号/民事诉讼法第264条', s.delayTerminated ? '基数清零已熔断终止计提' : '按实际履行天数计提'],
  ];
  netRows.forEach(([label, val, legal, advice], idx) => {
    const zebra = idx % 2 === 1;
    addRow(ws3, [
      { v: label, s: zebra ? 'textZebra' : 'text' },
      { v: Number(val.toFixed(2)), s: zebra ? 'moneyZebra' : 'money' },
      { v: legal, s: zebra ? 'textZebra' : 'text' },
      { v: advice, s: zebra ? 'textZebra' : 'text' },
    ], 20);
  });
  // 最终净额强调行（深蓝底）
  addRow(ws3, [
    { v: '最终应清偿 / 申请执行总净额', s: 'finalLabel' },
    { v: Number(s.netDebtTotal.toFixed(2)), s: 'finalMoney' },
    { v: '《中华人民共和国民事诉讼法》', s: 'finalText' },
    { v: s.isFullySettled ? '【全案执行完毕结清】' : '【向执行法院申请立案/扣划标的】', s: 'finalText' },
  ], 24);

  /* ---------------- Sheet 4：还款抵充分配流水 ---------------- */
  const ws4 = newDraft([
    { wch: 6 }, { wch: 12 }, { wch: 24 }, { wch: 16 }, { wch: 14 },
    { wch: 15 }, { wch: 14 }, { wch: 16 }, { wch: 14 },
  ]);
  addMergedRow(ws4, '单笔还款抵充分配流水明细清单', 'title', 8, 32);
  addMergedRow(ws4, '按法定/约定清偿顺序逐笔展示每期还款的抵充分配去向', 'subtitle', 8, 18);
  spacer(ws4);
  addRow(ws4, [
    '序号', '还款日期', '交易流水号', '还款入账金额（元）', '抵充费用（元）',
    '抵充利息罚息（元）', '抵充借款本金（元）', '抵充迟延履行金（元）', '超额溢缴款（元）',
  ].map(h => ({ v: h, s: 'header' }) as Cell), 30);

  const renderAllocationRow = (item: typeof s.allocations[number], idx: number) => {
    const zebra = idx % 2 === 1;
    const tS: string = zebra ? 'textCZebra' : 'textC';
    const mS: string = zebra ? 'moneyZebra' : 'money';
    addRow(ws4, [
      int(idx + 1) as Cell,
      date(item.date),
      { v: item.serialNo || '-', s: tS },
      { v: Number(item.amount.toFixed(2)), s: mS },
      { v: Number(item.allocatedFee.toFixed(2)), s: mS },
      { v: Number(item.allocatedInterest.toFixed(2)), s: mS },
      { v: Number(item.allocatedPrincipal.toFixed(2)), s: mS },
      { v: Number(item.allocatedDelay.toFixed(2)), s: mS },
      { v: Number(item.surplusAmount.toFixed(2)), s: mS },
    ], 20);
  };

  // 多协议案件：抵充分配流水按协议号分组展示（列结构不变）
  if (s.allocations.some(a => a.agreementNo)) {
    const groups = new Map<string, typeof s.allocations>();
    s.allocations.forEach(item => {
      const key = item.agreementNo || '未匹配协议号';
      const list = groups.get(key) || [];
      list.push(item);
      groups.set(key, list);
    });
    let globalIdx = 0;
    groups.forEach((list, key) => {
      const groupTotal = list.reduce((sum, a) => sum + a.amount, 0);
      addMergedRow(ws4, `协议号 ${key} （共 ${list.length} 笔 · 入账￥${roundToFen(groupTotal).toFixed(2)}）`, 'section', 8, 22);
      list.forEach(item => { renderAllocationRow(item, globalIdx++); });
      spacer(ws4);
    });
  } else {
    s.allocations.forEach((item, idx) => renderAllocationRow(item, idx));
  }

  /* ---------------- Sheet 5：银行扣款流水（如有） ---------------- */
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildSheet(ws1), '测算总览');
  XLSX.utils.book_append_sheet(wb, buildSheet(ws2), '分段计息明细');
  XLSX.utils.book_append_sheet(wb, buildSheet(ws3), '执行款分配与结清确认表');
  XLSX.utils.book_append_sheet(wb, buildSheet(ws4), '还款抵充分配流水');

  if (meta?.repayments && meta.repayments.length > 0) {
    const ws5 = newDraft([
      { wch: 6 }, { wch: 24 }, { wch: 12 }, { wch: 14 }, { wch: 12 },
      { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 22 },
    ]);
    addMergedRow(ws5, '个人贷款扣款回单 / 还款流水明细表', 'title', 9, 32);
    addMergedRow(ws5, '银行原始扣款流水 · 勾选状态决定其是否参与算息冲减', 'subtitle', 9, 18);
    spacer(ws5);
    addRow(ws5, [
      '序号', '交易流水号', '扣款日期', '归还本金(元)', '归还利息(元)',
      '归还罚息(元)', '归还复利(元)', '还款总额(元)', '参与算息状态', '说明',
    ].map(h => ({ v: h, s: 'header' }) as Cell), 30);

    const renderRepaymentRow = (r: RepaymentRecord, idx: number) => {
      const zebra = idx % 2 === 1;
      const tS: string = zebra ? 'textCZebra' : 'textC';
      const mS: string = zebra ? 'moneyZebra' : 'money';
      addRow(ws5, [
        int(idx + 1) as Cell,
        { v: r.serialNo, s: tS },
        date(r.date),
        { v: Number(r.principal.toFixed(2)), s: mS },
        { v: Number(r.interest.toFixed(2)), s: mS },
        { v: Number(r.penalty.toFixed(2)), s: mS },
        { v: Number(r.compound.toFixed(2)), s: mS },
        { v: Number(r.totalAmount.toFixed(2)), s: mS },
        { v: r.selected !== false ? '已参与冲减' : '未参与', s: tS },
        { v: r.remark || '', s: zebra ? 'textZebra' : 'text' },
      ], 20);
    };

    // 多协议案件：扣款流水按协议号分组展示，并输出各协议小计（列结构不变）
    if (meta.repayments.some(r => r.agreementNo)) {
      const groups = new Map<string, RepaymentRecord[]>();
      meta.repayments.forEach(r => {
        const key = r.agreementNo || '未匹配协议号';
        const list = groups.get(key) || [];
        list.push(r);
        groups.set(key, list);
      });
      let globalIdx = 0;
      groups.forEach((list, key) => {
        const sumBy = (pick: (r: RepaymentRecord) => number) =>
          roundToFen(list.reduce((sum, r) => sum + pick(r), 0));
        addMergedRow(ws5, `协议号 ${key} （共 ${list.length} 笔 · 累计还款￥${sumBy(r => r.totalAmount).toFixed(2)}）`, 'section', 9, 22);
        list.forEach(r => { renderRepaymentRow(r, globalIdx++); });
        addRow(ws5, [
          { v: '小计', s: 'totalLabel' }, { v: '—', s: 'totalLabel' }, { v: '—', s: 'totalLabel' },
          { v: sumBy(r => r.principal), s: 'totalMoney' },
          { v: sumBy(r => r.interest), s: 'totalMoney' },
          { v: sumBy(r => r.penalty), s: 'totalMoney' },
          { v: sumBy(r => r.compound), s: 'totalMoney' },
          { v: sumBy(r => r.totalAmount), s: 'totalMoney' },
          { v: '—', s: 'totalLabel' },
          { v: `共 ${list.length} 笔流水`, s: 'totalText' },
        ], 22);
        spacer(ws5);
      });
    } else {
      meta.repayments.forEach((r, idx) => renderRepaymentRow(r, idx));
    }
    XLSX.utils.book_append_sheet(wb, buildSheet(ws5), '银行扣款流水');
  }

  const safeName = meta?.defendant ? `_${meta.defendant}` : '';
  const safeCase = meta?.caseNo ? `_${meta.caseNo.replace(/[()（）/\\]/g, '_')}` : '';
  XLSX.writeFile(wb, `司法级执行款清算证据清单${safeName}${safeCase}_${today}.xlsx`);
}
