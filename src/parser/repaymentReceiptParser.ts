import { RepaymentRecord, RepaymentReceiptMeta } from '../core/types';
import { roundToFen } from '../core/calculator';

/**
 * 扣款回单解析产物
 */
export interface RepaymentReceiptParseResult {
  meta: RepaymentReceiptMeta;
  records: RepaymentRecord[];
  totalRepaidSum: number;
  totalPrincipalSum: number;
  totalInterestSum: number;
  totalPenaltySum: number;
  totalCompoundSum: number;
}

/**
 * 标准化日期格式：支持 20181221 -> 2018-12-21，或者 2018/12/21 -> 2018-12-21
 */
export function normalizeDate(raw: string): string {
  if (!raw) return '';
  const trimmed = raw.trim().replace(/[年月]/g, '-').replace(/日/g, '');
  // 8位连续数字: 20181221
  if (/^\d{8}$/.test(trimmed)) {
    return `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`;
  }
  // 已经是 2018-12-21
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(trimmed)) {
    const parts = trimmed.split('-');
    const y = parts[0];
    const m = parts[1].padStart(2, '0');
    const d = parts[2].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return trimmed;
}

/**
 * 提取文本中的金额
 */
export function parseAmount(val: any): number {
  if (typeof val === 'number') return roundToFen(val);
  if (!val || typeof val !== 'string') return 0;
  const clean = val.replace(/[¥￥,\s]/g, '').trim();
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : roundToFen(num);
}

/**
 * 本地高性能规则抽取器：从 PDF 提取出的纯文本/表格中解析银行扣款明细与借据回单
 */
export function parseRepaymentReceiptFromText(text: string): RepaymentReceiptParseResult {
  const meta: RepaymentReceiptMeta = {};
  const records: RepaymentRecord[] = [];

  // 1. 抽取借据抬头信息
  const receiptNoMatch = text.match(/贷款借据号\s*[:：|]?\s*([0-9A-Za-z\/\-_]+)/);
  if (receiptNoMatch) meta.loanReceiptNo = receiptNoMatch[1].trim();

  const loanTypeMatch = text.match(/贷款品种\s*[:：|]?\s*([^\n|]+)/);
  if (loanTypeMatch) meta.loanType = loanTypeMatch[1].trim();

  const loanOrgMatch = text.match(/贷款机构\s*[:：|]?\s*([^\n|]+)/);
  if (loanOrgMatch) meta.loanOrg = loanOrgMatch[1].trim();

  const repaymentMethodMatch = text.match(/还款方式\s*[:：|]?\s*([^\n|]+)/);
  if (repaymentMethodMatch) meta.repaymentMethod = repaymentMethodMatch[1].trim();

  const loanAmountMatch = text.match(/贷款金额\s*[:：|]?\s*([0-9,.]+)/);
  if (loanAmountMatch) meta.loanAmount = parseAmount(loanAmountMatch[1]);

  const currencyMatch = text.match(/币种\s*[:：|]?\s*([^\n|]+)/);
  if (currencyMatch) meta.currency = currencyMatch[1].trim();

  const borrowerMatch = text.match(/借款人名称\s*[:：|]?\s*([^\n|\s]+)/);
  if (borrowerMatch) meta.borrowerName = borrowerMatch[1].trim();

  const idTypeMatch = text.match(/证件种类\s*[:：|]?\s*([^\n|]+)/);
  if (idTypeMatch) meta.idType = idTypeMatch[1].trim();

  const idNumberMatch = text.match(/证件号码\s*[:：|]?\s*([0-9A-Za-z*]+)/);
  if (idNumberMatch) meta.idNumber = idNumberMatch[1].trim();

  const startDateMatch = text.match(/贷款起始日\s*[:：|]?\s*([0-9\-\/]+)/);
  if (startDateMatch) meta.loanStartDate = normalizeDate(startDateMatch[1]);

  const dueDateMatch = text.match(/贷款到期日\s*[:：|]?\s*([0-9\-\/]+)/);
  if (dueDateMatch) meta.loanDueDate = normalizeDate(dueDateMatch[1]);

  // 2. 逐行探测流水明细
  // 典型格式:
  // BAT00030870602  20181221  0.00  567.56  0.00  0.00  567.56
  // 或 Markdown 表格: | BAT00030870602 | 20181221 | 0.00 | 567.56 | 0.00 | 0.00 | 567.56 |
  const lines = text.split(/\r?\n/);
  let recordIndex = 1;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.includes('交易流水号') || trimmed.includes('归还本金')) {
      continue;
    }

    // 过滤合计行
    if (/^合计[:：]?/i.test(trimmed)) {
      continue;
    }

    // 匹配包含流水号、日期和5个金额项的行
    // 流水号通常以字母开头或由字母数字组成(如 BAT00030870602, J0000001523735, C120012630001U)
    const tokenRegex = /([A-Za-z0-9_\-]+)\s+(\d{8}|\d{4}-\d{1,2}-\d{1,2})\s+([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)/;
    const match = trimmed.match(tokenRegex);

    if (match) {
      const serialNo = match[1];
      const date = normalizeDate(match[2]);
      const principal = parseAmount(match[3]);
      const interest = parseAmount(match[4]);
      const penalty = parseAmount(match[5]);
      const compound = parseAmount(match[6]);
      const totalAmount = parseAmount(match[7]);

      records.push({
        id: String(recordIndex++),
        serialNo,
        date,
        principal,
        interest,
        penalty,
        compound,
        totalAmount,
        selected: true,
      });
      continue;
    }

    // Markdown 表格格式支持: | BAT... | 20181221 | 0.00 | ... |
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const cells = trimmed.split('|').map(c => c.trim()).filter(c => c.length > 0);
      if (cells.length >= 7) {
        const potentialDate = cells[1];
        if (/^\d{8}$|^\d{4}-\d{1,2}-\d{1,2}$/.test(potentialDate)) {
          const serialNo = cells[0];
          const date = normalizeDate(potentialDate);
          const principal = parseAmount(cells[2]);
          const interest = parseAmount(cells[3]);
          const penalty = parseAmount(cells[4]);
          const compound = parseAmount(cells[5]);
          const totalAmount = parseAmount(cells[6]);

          records.push({
            id: String(recordIndex++),
            serialNo,
            date,
            principal,
            interest,
            penalty,
            compound,
            totalAmount,
            selected: true,
          });
        }
      }
    }
  }

  // 排序流水记录（按日期升序）
  records.sort((a, b) => a.date.localeCompare(b.date));

  const totalRepaidSum = roundToFen(records.reduce((sum, r) => sum + r.totalAmount, 0));
  const totalPrincipalSum = roundToFen(records.reduce((sum, r) => sum + r.principal, 0));
  const totalInterestSum = roundToFen(records.reduce((sum, r) => sum + r.interest, 0));
  const totalPenaltySum = roundToFen(records.reduce((sum, r) => sum + r.penalty, 0));
  const totalCompoundSum = roundToFen(records.reduce((sum, r) => sum + r.compound, 0));

  return {
    meta,
    records,
    totalRepaidSum,
    totalPrincipalSum,
    totalInterestSum,
    totalPenaltySum,
    totalCompoundSum,
  };
}

/**
 * 银行扣款回单样本数据（对应用户提供的深圳高新区支行 秦某 个人贷款扣款回单，已脱敏）
 */
export const SAMPLE_REPAYMENT_RECEIPT: RepaymentReceiptParseResult = {
  meta: {
    loanReceiptNo: '811032260373/001',
    loanType: '信用贷款-消费-非场景-互联网',
    loanOrg: '深圳高新区支行',
    repaymentMethod: '到期还本定期还息',
    loanAmount: 258700.00,
    currency: '人民币元',
    borrowerName: '秦某',
    idType: '居民身份证',
    idNumber: '3****************2',
    loanStartDate: '2018-12-10',
    loanDueDate: '2019-12-10',
  },
  records: [
    { id: '1', serialNo: 'BAT00030870602', date: '2018-12-21', principal: 0.00, interest: 567.56, penalty: 0.00, compound: 0.00, totalAmount: 567.56, selected: false, remark: '判决日前正常付息' },
    { id: '2', serialNo: 'BAT00027904395', date: '2019-01-21', principal: 0.00, interest: 1547.89, penalty: 0.00, compound: 0.00, totalAmount: 1547.89, selected: false, remark: '判决日前正常付息' },
    { id: '3', serialNo: 'BAT00029632205', date: '2019-02-21', principal: 0.00, interest: 1547.89, penalty: 0.00, compound: 0.00, totalAmount: 1547.89, selected: false, remark: '判决日前正常付息' },
    { id: '4', serialNo: 'BAT00030548983', date: '2019-03-21', principal: 0.00, interest: 1547.89, penalty: 0.00, compound: 0.00, totalAmount: 1547.89, selected: false, remark: '判决日前正常付息' },
    { id: '5', serialNo: 'BAT00028429828', date: '2019-04-21', principal: 0.00, interest: 1547.89, penalty: 0.00, compound: 0.00, totalAmount: 1547.89, selected: false, remark: '判决日前正常付息' },
    { id: '6', serialNo: 'BAT00029270619', date: '2019-05-21', principal: 0.00, interest: 1547.89, penalty: 0.00, compound: 0.00, totalAmount: 1547.89, selected: false, remark: '判决日前正常付息' },
    { id: '7', serialNo: 'BAT00032402426', date: '2019-06-21', principal: 0.00, interest: 1547.89, penalty: 0.00, compound: 0.00, totalAmount: 1547.89, selected: false, remark: '判决日前正常付息' },
    { id: '8', serialNo: 'BAT00029743273', date: '2019-07-21', principal: 0.00, interest: 1547.89, penalty: 0.00, compound: 0.00, totalAmount: 1547.89, selected: false, remark: '判决日前正常付息' },
    { id: '9', serialNo: 'BAT00184071122', date: '2019-08-21', principal: 0.00, interest: 1547.89, penalty: 0.00, compound: 0.00, totalAmount: 1547.89, selected: false, remark: '判决日前正常付息' },
    { id: '10', serialNo: 'J0000001523735', date: '2019-09-21', principal: 0.00, interest: 1547.89, penalty: 0.00, compound: 0.00, totalAmount: 1547.89, selected: false, remark: '判决日前正常付息' },
    { id: '11', serialNo: 'BAT00033447858', date: '2019-10-21', principal: 0.00, interest: 1547.89, penalty: 0.00, compound: 0.00, totalAmount: 1547.89, selected: false, remark: '判决日前正常付息' },
    { id: '12', serialNo: 'BAT00033156756', date: '2019-11-21', principal: 0.00, interest: 1547.89, penalty: 0.00, compound: 0.00, totalAmount: 1547.89, selected: false, remark: '判决日前正常付息' },
    { id: '13', serialNo: 'BAT00143676003', date: '2019-12-10', principal: 2419.69, interest: 980.33, penalty: 0.00, compound: 0.00, totalAmount: 3400.02, selected: false, remark: '到期日部分偿还本息' },
    { id: '14', serialNo: 'BAT00042471063', date: '2019-12-21', principal: 0.00, interest: 0.00, penalty: 1.51, compound: 0.00, totalAmount: 1.51, selected: true, remark: '逾期后扣收罚息' },
    { id: '15', serialNo: 'J0000006592920', date: '2020-01-19', principal: 504.31, interest: 0.00, penalty: 2988.64, compound: 7.05, totalAmount: 3500.00, selected: true, remark: '扣收本息与罚复利' },
    { id: '16', serialNo: 'BAT00147460014', date: '2020-01-22', principal: 1000.00, interest: 0.00, penalty: 0.00, compound: 0.00, totalAmount: 1000.00, selected: true, remark: '冲减本金' },
    { id: '17', serialNo: 'J0000008168282', date: '2020-01-22', principal: 51770.39, interest: 0.00, penalty: 229.56, compound: 0.05, totalAmount: 52000.00, selected: true, remark: '大额冲减本金与罚息' },
    { id: '18', serialNo: 'J0000003207633', date: '2020-03-10', principal: 17074.83, interest: 0.00, penalty: 2915.16, compound: 10.01, totalAmount: 20000.00, selected: true, remark: '分期还款冲减' },
    { id: '19', serialNo: 'J0000011522918', date: '2020-03-26', principal: 30109.09, interest: 0.00, penalty: 889.99, compound: 0.92, totalAmount: 31000.00, selected: true, remark: '分期还款冲减' },
    { id: '20', serialNo: 'J0000011707458', date: '2020-03-26', principal: 8500.00, interest: 0.00, penalty: 0.00, compound: 0.00, totalAmount: 8500.00, selected: true, remark: '提前归还本金' },
    { id: '21', serialNo: 'C120012630001U', date: '2025-05-22', principal: 147321.69, interest: 0.00, penalty: 8125.96, compound: 0.00, totalAmount: 155447.65, selected: true, remark: '执行阶段大额回款' },
  ],
  totalRepaidSum: 292443.53,
  totalPrincipalSum: 258700.00,
  totalInterestSum: 18574.68,
  totalPenaltySum: 15150.82,
  totalCompoundSum: 18.03,
};
