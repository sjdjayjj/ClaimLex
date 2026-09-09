import { RateHistoryItem } from './types';

export const RATE_HISTORY: RateHistoryItem[] = [
  { date: "2024-07-22", type: "LPR", r1: 3.35, r5: 3.85, remark: "LPR降息" },
  { date: "2024-02-20", type: "LPR", r1: 3.45, r5: 3.95, remark: "5年期LPR大幅下调25BP" },
  { date: "2023-08-21", type: "LPR", r1: 3.45, r5: 4.20, remark: "1年期LPR下调10BP" },
  { date: "2023-06-20", type: "LPR", r1: 3.55, r5: 4.20, remark: "双品种各下调10BP" },
  { date: "2022-08-22", type: "LPR", r1: 3.65, r5: 4.30, remark: "LPR下调" },
  { date: "2022-05-20", type: "LPR", r1: 3.70, r5: 4.45, remark: "5年期LPR下调15BP" },
  { date: "2022-01-20", type: "LPR", r1: 3.70, r5: 4.60, remark: "LPR下调" },
  { date: "2021-12-20", type: "LPR", r1: 3.80, r5: 4.65, remark: "1年期LPR下调5BP" },
  { date: "2020-04-20", type: "LPR", r1: 3.85, r5: 4.65, remark: "新冠疫情期间LPR" },
  { date: "2019-08-20", type: "LPR", r1: 4.25, r5: 4.85, remark: "央行LPR改革首次报价" },
  { date: "2015-10-24", type: "BENCHMARK", r1: 4.35, r5: 4.90, remark: "央行存贷款基准利率最后一次调整" },
  { date: "2015-08-26", type: "BENCHMARK", r1: 4.60, r5: 5.15, remark: "央行双降" },
  { date: "2015-06-28", type: "BENCHMARK", r1: 4.85, r5: 5.40, remark: "央行双降" },
  { date: "2015-05-11", type: "BENCHMARK", r1: 5.10, r5: 5.65, remark: "降息" },
  { date: "2015-03-01", type: "BENCHMARK", r1: 5.35, r5: 5.90, remark: "降息" },
  { date: "2014-11-22", type: "BENCHMARK", r1: 5.60, r5: 6.15, remark: "降息" },
  { date: "2012-07-06", type: "BENCHMARK", r1: 6.00, r5: 6.55, remark: "基准利率" },
  { date: "2012-06-08", type: "BENCHMARK", r1: 6.31, r5: 6.80, remark: "基准利率" },
  { date: "2011-07-07", type: "BENCHMARK", r1: 6.56, r5: 7.05, remark: "加息周期高点" },
  { date: "2010-10-20", type: "BENCHMARK", r1: 5.56, r5: 6.14, remark: "基准利率" },
  { date: "2008-12-23", type: "BENCHMARK", r1: 5.31, r5: 5.94, remark: "次贷危机稳增长降息" },
  { date: "2007-12-21", type: "BENCHMARK", r1: 7.47, r5: 7.83, remark: "高通胀防过热加息" },
  { date: "2004-10-29", type: "BENCHMARK", r1: 5.58, r5: 6.12, remark: "基准利率微调" },
  { date: "2002-02-21", type: "BENCHMARK", r1: 5.31, r5: 5.76, remark: "十五规划初期基准利率" }
];
