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
}

export interface CalculationResult {
  totalDays: number;
  principal: number;
  newPenalty: number;
  newCompound: number;
  delayInterest: number;
  totalDebt: number;
  intervals: CalculationInterval[];
}
