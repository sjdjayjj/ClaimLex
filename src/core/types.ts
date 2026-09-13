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
 * 还款抵扣策略 / 清偿顺序
 * LEGAL_EXPENSE_FIRST: 法定清偿顺序（《民法典》第561条及法释〔2014〕8号第四条：费用及实现债权费用 -> 利息/罚息/复利 -> 本金 -> 加倍迟延履行利息）
 * COMMERCIAL_PRINCIPAL_FIRST: 商业优先冲本模式（协商重组场景：还款全额优先冲减尚欠本金 -> 罚息利息 -> 费用 -> 加倍迟延金）
 */
export type DeductionStrategy = 'LEGAL_EXPENSE_FIRST' | 'COMMERCIAL_PRINCIPAL_FIRST';

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
  /** 履行期届满日（YYYY-MM-DD，生效法律文书履行期届满之日起算加倍迟延履行金，依据送达回证手工填入） */
  executionDueDate?: string;
  /** 还款抵扣策略（清偿顺序，默认 LEGAL_EXPENSE_FIRST 法定清偿顺序） */
  deductionStrategy?: DeductionStrategy;
  /** 判决确认案件受理费 (元) */
  litigationFee?: number;
  /** 判决确认保全费/执行费 (元) */
  preservationFee?: number;
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
  /** 该节点加倍迟延金计息基数 (依据法释〔2014〕8号仅限尚未清偿的本金及固定费用，利息不作为基数) */
  delayBase?: number;
  /** 该节点加倍迟延金是否已触发归零熔断终止计提 */
  isDelayTerminated?: boolean;
  /** 该节点冲减总还款 (元) */
  repaidTotal?: number;
  /** 该节点抵充诉讼/保全费 (元) */
  repaidFee?: number;
  /** 该节点抵充利息/罚息/复利 (元) */
  repaidInterest?: number;
  /** 该节点抵充借款本金 (元) */
  repaidPrincipal?: number;
  /** 该节点抵充加倍迟延履行金 (元) */
  repaidDelay?: number;
  /** 该节点冲减后尚欠本金余额 (元) */
  remainingPrincipal?: number;
}

/**
 * 单笔还款流水抵充分配明细项
 */
export interface RepaymentAllocationItem {
  date: string;
  serialNo?: string;
  amount: number;
  allocatedFee: number;
  allocatedInterest: number;
  allocatedPrincipal: number;
  allocatedDelay: number;
  surplusAmount: number;
}

/**
 * 《执行款分配与结清确认表》核心数据结构
 */
export interface SettlementConfirmation {
  deductionStrategy: DeductionStrategy;

  // 1. 生效裁判确认金钱债务（总标的池）
  principalTarget: number;           // 确定的借款本金
  litigationFeeTarget: number;       // 案件受理费
  preservationFeeTarget: number;     // 保全费/执行费
  totalFixedDebtTarget: number;      // 迟延金法定初始计息基数 (本金+固定费用)
  baseInterestTarget: number;        // 基准日前欠付利息
  basePenaltyTarget: number;         // 基准日前欠付罚息/复利

  // 2. 裁判后新计提息费
  newPenaltyTarget: number;          // 裁判后新发生利息/罚息
  newCompoundTarget: number;         // 裁判后新发生复利
  delayInterestTarget: number;       // 加倍迟延履行期间利息
  totalDebtTarget: number;           // 债权执行标的应计总额 (本金+息费+费用)

  // 3. 执行款冲减清偿总计
  totalRepaid: number;               // 累计参与冲减还款总额
  allocatedFeeTotal: number;         // 累计抵充诉讼/保全费用
  allocatedInterestTotal: number;    // 累计抵充利息/罚息/复利
  allocatedPrincipalTotal: number;   // 累计抵充借款本金
  allocatedDelayTotal: number;       // 累计抵充加倍迟延履行金
  surplusTotal: number;              // 累计结清溢缴款

  // 4. 执行清偿结算净额
  remainingFee: number;              // 尚欠诉讼/保全费用
  remainingPrincipal: number;        // 尚欠借款本金
  remainingInterest: number;         // 尚欠利息/罚复利
  remainingDelay: number;            // 尚欠加倍迟延履行金
  netDebtTotal: number;              // 最终结欠债权净额（申请执行标的）
  isFullySettled: boolean;           // 是否已全额清偿结清
  delayTerminated: boolean;          // 加倍迟延金是否已触发基数清零熔断

  // 5. 单笔流水抵充分配记录
  allocations: RepaymentAllocationItem[];
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
  /** 累计冲减费用 */
  totalRepaidFee: number;
  /** 累计冲减利息罚息 */
  totalRepaidInterest: number;
  /** 累计冲减迟延履行金 */
  totalRepaidDelay: number;
  /** 扣减还款后的最终结欠债权净额 */
  netDebt: number;
  /** 判决确认案件受理费 */
  litigationFee: number;
  /** 判决确认保全费/执行费 */
  preservationFee: number;
  /** 迟延金计息基数是否已熔断停止 */
  delayTerminated: boolean;
  /** 还款抵扣策略 */
  deductionStrategy: DeductionStrategy;
  /** 完整的《执行款分配与结清确认表》 */
  settlement: SettlementConfirmation;
}