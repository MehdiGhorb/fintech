/** Deterministic valuation models. The LLM interprets these; it never computes them. */

export interface DcfInput {
  /** Most recent trailing free cash flow, in currency units. */
  baseFreeCashFlow: number;
  sharesOutstanding: number;
  netDebt: number;
  /** Growth rate for each explicit forecast year, e.g. [0.25, 0.2, 0.15, 0.12, 0.1]. */
  growthPath: number[];
  discountRate: number;
  terminalGrowth: number;
}

export interface DcfResult {
  enterpriseValue: number;
  equityValue: number;
  fairValuePerShare: number;
  presentValueExplicit: number;
  presentValueTerminal: number;
  terminalShare: number;
  projectedCashFlows: Array<{ year: number; cashFlow: number; discounted: number }>;
  assumptions: DcfInput;
}

export function discountedCashFlow(input: DcfInput): DcfResult | null {
  const { baseFreeCashFlow, sharesOutstanding, netDebt, growthPath, discountRate, terminalGrowth } = input;
  if (!(sharesOutstanding > 0) || !(discountRate > terminalGrowth)) return null;

  const projected: Array<{ year: number; cashFlow: number; discounted: number }> = [];
  let cashFlow = baseFreeCashFlow;
  let pvExplicit = 0;

  growthPath.forEach((growth, i) => {
    cashFlow *= 1 + growth;
    const discounted = cashFlow / (1 + discountRate) ** (i + 1);
    pvExplicit += discounted;
    projected.push({ year: i + 1, cashFlow, discounted });
  });

  const terminalValue = (cashFlow * (1 + terminalGrowth)) / (discountRate - terminalGrowth);
  const pvTerminal = terminalValue / (1 + discountRate) ** growthPath.length;
  const enterpriseValue = pvExplicit + pvTerminal;
  const equityValue = enterpriseValue - netDebt;

  return {
    enterpriseValue,
    equityValue,
    fairValuePerShare: equityValue / sharesOutstanding,
    presentValueExplicit: pvExplicit,
    presentValueTerminal: pvTerminal,
    terminalShare: enterpriseValue ? pvTerminal / enterpriseValue : NaN,
    projectedCashFlows: projected,
    assumptions: input,
  };
}

/**
 * Solves for the free cash flow growth the current price already implies. This
 * reframes "is it expensive?" as "what would have to be true?", which is far
 * more useful than a single fair-value point estimate.
 */
export function reverseDcfGrowth(params: {
  marketCap: number;
  baseFreeCashFlow: number;
  netDebt: number;
  discountRate: number;
  terminalGrowth: number;
  years?: number;
}): { impliedAnnualGrowth: number; converged: boolean } {
  const { marketCap, baseFreeCashFlow, netDebt, discountRate, terminalGrowth } = params;
  const years = params.years ?? 10;
  const targetEnterprise = marketCap + netDebt;
  if (!(baseFreeCashFlow > 0) || !(targetEnterprise > 0) || discountRate <= terminalGrowth) {
    return { impliedAnnualGrowth: NaN, converged: false };
  }

  const value = (growth: number) => {
    let cf = baseFreeCashFlow;
    let pv = 0;
    for (let i = 1; i <= years; i++) {
      cf *= 1 + growth;
      pv += cf / (1 + discountRate) ** i;
    }
    const tv = (cf * (1 + terminalGrowth)) / (discountRate - terminalGrowth);
    return pv + tv / (1 + discountRate) ** years;
  };

  let lo = -0.4;
  let hi = 1.5;
  for (let i = 0; i < 90; i++) {
    const mid = (lo + hi) / 2;
    if (value(mid) < targetEnterprise) lo = mid;
    else hi = mid;
  }
  const growth = (lo + hi) / 2;
  return { impliedAnnualGrowth: growth, converged: Math.abs(value(growth) / targetEnterprise - 1) < 0.02 };
}

/**
 * Capital Asset Pricing Model cost of equity. Used as the DCF discount rate when
 * we have a beta, so the rate reflects the asset's actual risk rather than a
 * round number.
 */
export function costOfEquity(riskFreeRate: number, beta: number, equityRiskPremium = 0.045): number {
  return riskFreeRate + beta * equityRiskPremium;
}

export interface MultiplesInput {
  /** Trailing and forward per-share earnings. */
  epsTtm?: number | null;
  epsForward?: number | null;
  freeCashFlowPerShare?: number | null;
  bookValuePerShare?: number | null;
  salesPerShare?: number | null;
  /** Peer or historical multiples to apply. */
  peerPe?: number | null;
  historicalPe?: number | null;
  peerEvSales?: number | null;
}

export interface MultiplesResult {
  estimates: Array<{ basis: string; multiple: number; impliedPrice: number }>;
  low: number;
  median: number;
  high: number;
}

export function multiplesValuation(input: MultiplesInput): MultiplesResult | null {
  const estimates: Array<{ basis: string; multiple: number; impliedPrice: number }> = [];
  const push = (basis: string, per: number | null | undefined, multiple: number | null | undefined) => {
    if (per && multiple && per > 0 && multiple > 0) {
      estimates.push({ basis, multiple, impliedPrice: per * multiple });
    }
  };
  push('Trailing EPS × peer P/E', input.epsTtm, input.peerPe);
  push('Trailing EPS × 5y average P/E', input.epsTtm, input.historicalPe);
  push('Forward EPS × peer P/E', input.epsForward, input.peerPe);
  push('Forward EPS × 5y average P/E', input.epsForward, input.historicalPe);
  push('Sales per share × peer EV/Sales', input.salesPerShare, input.peerEvSales);

  if (!estimates.length) return null;
  const prices = estimates.map((e) => e.impliedPrice).sort((a, b) => a - b);
  return {
    estimates,
    low: prices[0],
    median: prices[Math.floor(prices.length / 2)],
    high: prices[prices.length - 1],
  };
}

/** Sustainable growth implied by returns and reinvestment, as a DCF sanity check. */
export function sustainableGrowth(returnOnEquity: number, payoutRatio: number): number {
  return returnOnEquity * (1 - Math.max(0, Math.min(1, payoutRatio)));
}

/**
 * Piotroski-style quality signals recomputed from raw statements. Each flag is a
 * yes/no test on fundamental improvement; the score summarises balance-sheet and
 * profitability direction.
 */
export function qualityFlags(current: {
  netIncome?: number | null;
  operatingCashFlow?: number | null;
  totalAssets?: number | null;
  priorTotalAssets?: number | null;
  priorNetIncome?: number | null;
  grossMargin?: number | null;
  priorGrossMargin?: number | null;
  longTermDebt?: number | null;
  priorLongTermDebt?: number | null;
  currentRatio?: number | null;
  priorCurrentRatio?: number | null;
  sharesOutstanding?: number | null;
  priorSharesOutstanding?: number | null;
}): { score: number; maxScore: number; flags: Array<{ test: string; pass: boolean | null; detail: string }> } {
  const flags: Array<{ test: string; pass: boolean | null; detail: string }> = [];
  const add = (test: string, pass: boolean | null, detail: string) => flags.push({ test, pass, detail });

  const roa =
    current.netIncome != null && current.totalAssets ? current.netIncome / current.totalAssets : null;
  const priorRoa =
    current.priorNetIncome != null && current.priorTotalAssets
      ? current.priorNetIncome / current.priorTotalAssets
      : null;

  add('Positive net income', current.netIncome != null ? current.netIncome > 0 : null, 'Profitable on an accounting basis');
  add(
    'Positive operating cash flow',
    current.operatingCashFlow != null ? current.operatingCashFlow > 0 : null,
    'Cash generation, not just accruals',
  );
  add('Return on assets improving', roa != null && priorRoa != null ? roa > priorRoa : null, 'Asset productivity trend');
  add(
    'Cash flow exceeds net income',
    current.operatingCashFlow != null && current.netIncome != null
      ? current.operatingCashFlow > current.netIncome
      : null,
    'Earnings quality: low accruals is a good sign',
  );
  add(
    'Leverage not rising',
    current.longTermDebt != null && current.priorLongTermDebt != null
      ? current.longTermDebt <= current.priorLongTermDebt
      : null,
    'Long-term debt direction',
  );
  add(
    'Liquidity improving',
    current.currentRatio != null && current.priorCurrentRatio != null
      ? current.currentRatio > current.priorCurrentRatio
      : null,
    'Current ratio direction',
  );
  add(
    'No shareholder dilution',
    current.sharesOutstanding != null && current.priorSharesOutstanding != null
      ? current.sharesOutstanding <= current.priorSharesOutstanding * 1.005
      : null,
    'Share count flat or shrinking',
  );
  add(
    'Gross margin expanding',
    current.grossMargin != null && current.priorGrossMargin != null
      ? current.grossMargin > current.priorGrossMargin
      : null,
    'Pricing power and mix',
  );

  const scored = flags.filter((f) => f.pass !== null);
  return { score: scored.filter((f) => f.pass).length, maxScore: scored.length, flags };
}
