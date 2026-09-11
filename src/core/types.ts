export type RateType = 'LPR' | 'BENCHMARK';

export interface RateHistoryItem {
  date: string;
  type: RateType;
  r1: number;
  r5: number;
  remark: string;
}

export type RateMode = 'LPR' | 'BENCHMARK' | 'FIXED';
export type LPRTerm = '1Y' | '5Y';
export type CompoundMode = 'INT_ONLY' | 'INT_AND_PENALTY' | 'NONE';

/**
 * 银行扣款明细 / 还款流水记录（支持单笔参与/排除算息）
 */
export interface RepaymentRecord {
  /** 唯一标识或流水ID */
  id: string;
  /** 交易流水号 (如 BAT00030870602 / C120012630001U) */
  serialNo: string;
  /** 扣款/还款日期 (标准格式 YYYY-MM-DD) */
  date: string;
  /** 归还本金 (元) */
  principal: number;
  /** 归还利息 (元) */
  interest: number;
  /** 归还罚息 (元) */
  penalty: number;
  /** 归还复利 (元) */
  compound: number;
  /** 还款总额 (元) */
  totalAmount: number;
  /** 是否勾选参与本次算息冲减 (默认 true) */
  selected?: boolean;
  /** 备注说明 */
  remark?: string;
}

/**
 * 扣款回单基本信息 (借据抬头信息)
 */
export interface RepaymentReceiptMeta {
  loanReceiptNo?: string;     // 贷款借据号 (如 811032260373/001)
  loanType?: string;          // 贷款品种 (如 信用贷款-消费-非场景-互联网)
  loanOrg?: string;           // 贷款机构 (如 深圳高新区支行)
  repaymentMethod?: string;   // 还款方式 (如 到期还本定期还息)
  loanAmount?: number;        // 贷款金额 (如 258700.00)
  currency?: string;          // 币种 (如 人民币元)
  borrowerName?: string;      // 借款人名称 (如 秦*英)
  idType?: string;            // 证件种类 (如 居民身份证)
  idNumber?: string;          // 证件号码 (如 3****************2)
  loanStartDate?: string;     // 贷款起始日 (YYYY-MM-DD)
  loanDueDate?: string;       // 贷款到期日 (YYYY-MM-DD)
}

export interface CalculationParams {
  baseDate: string;
  endDate: string;
  principal: number;
  baseInterest: number;
  basePenalty: number;
  rateMode: RateMode;
  lprTerm: LPRTerm;
  lprBp: number;
  lprFloatRatio: number;
  fixedRate?: number;
  penaltyMultiple: number;
  compoundMode: CompoundMode;
  delayInterestEnabled: boolean;
  /** 参与算息的银行还款/扣款流水记录列表 */
  repayments?: RepaymentRecord[];
}

export interface CalculationInterval {
  start: string;
  end: string;
  days: number;
  baseRate: number;
  penaltyRate: number;
  principal: number;
  interest: number;
  compound: number;
  delay: number;
  subtotal: number;
  /** 当前分段触发事件说明 (如 'LPR浮动调息' | '借款人还款冲减' | '期初起算') */
  eventDesc?: string;
  /** 该节点冲减归还本金 (元) */
  repaidPrincipal?: number;
  /** 该节点冲减总还款 (元) */
  repaidTotal?: number;
}

export interface CalculationResult {
  totalDays: number;
  principal: number;
  newPenalty: number;
  newCompound: number;
  delayInterest: number;
  totalDebt: number;
  intervals: CalculationInterval[];
  /** 参与算息冲减的已还款总额 */
  totalRepaid: number;
  /** 累计冲减本金 */
  totalRepaidPrincipal: number;
  /** 扣减还款后的最终结欠债权净额 */
  netDebt: number;
}
