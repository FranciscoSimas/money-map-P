/**
 * Credit Calculator Utilities
 * 
 * Formulas for calculating credit payments, interest, and amortization schedules
 */

export interface CreditCalculationInput {
  totalAmount: number;
  downPayment?: number;
  remainingAmount?: number;
  tanRate: number; // Taxa Anual Nominal (annual percentage)
  taegRate?: number; // Taxa Anual Efetiva Global (for reference)
  totalMonths: number;
}

export interface CreditCalculationResult {
  monthlyPayment: number;
  totalInterest: number;
  totalAmount: number;
  monthlyRate: number;
  schedule: AmortizationScheduleItem[];
}

export interface AmortizationScheduleItem {
  month: number;
  payment: number;
  principal: number;
  interest: number;
  remainingBalance: number;
}

export type AmortizationType = 'reduce_term' | 'reduce_payment';

export interface EarlyAmortizationScenario {
  month: number;
  amount: number;
  type?: AmortizationType; // 'reduce_term' = reduzir prazo, 'reduce_payment' = reduzir prestação
}

export interface EarlyAmortizationResult {
  newMonthlyPayment: number;
  newTotalMonths: number;
  interestSaved: number;
  monthsSaved: number;
  newSchedule: AmortizationScheduleItem[];
}

/**
 * Calculate monthly payment using PMT formula
 * PMT = PV * (r * (1 + r)^n) / ((1 + r)^n - 1)
 * 
 * @param principal - Capital em falta (valor total - entrada)
 * @param annualRate - Taxa anual (TAN) em percentagem (ex: 5.5 para 5.5%)
 * @param months - Número de meses
 */
export function calculateMonthlyPayment(
  principal: number,
  annualRate: number,
  months: number
): number {
  if (principal <= 0 || months <= 0) return 0;
  if (annualRate === 0) return principal / months;
  
  // Convert annual rate to monthly rate
  // TAN is already in percentage (e.g., 8.91 for 8.91%)
  const monthlyRate = annualRate / 100 / 12;
  
  // PMT formula: PMT = PV * (r * (1 + r)^n) / ((1 + r)^n - 1)
  const onePlusRate = 1 + monthlyRate;
  const power = Math.pow(onePlusRate, months);
  
  // Avoid division by zero
  if (power === 1) return principal / months;
  
  const numerator = monthlyRate * power;
  const denominator = power - 1;
  
  // Calculate with higher precision first
  // Use more precise calculation to avoid floating point errors
  const ratio = numerator / denominator;
  const result = principal * ratio;
  
  // Round to 2 decimal places (banking standard)
  // Use Math.round for proper rounding instead of toFixed
  return Math.round(result * 100) / 100;
}

/**
 * Calculate complete credit details from input
 */
export function calculateCredit(input: CreditCalculationInput): CreditCalculationResult {
  const principal = input.remainingAmount ?? (input.totalAmount - (input.downPayment || 0));
  
  // Calculate monthly payment using PMT formula
  const monthlyPayment = calculateMonthlyPayment(principal, input.tanRate, input.totalMonths);
  
  // Generate amortization schedule
  const schedule = generateAmortizationSchedule(principal, input.tanRate, input.totalMonths, monthlyPayment);
  
  // Calculate total interest from schedule
  const totalInterest = schedule.reduce((sum, item) => sum + item.interest, 0);
  const totalAmount = principal + totalInterest;
  const monthlyRate = input.tanRate / 12 / 100;
  
  return {
    monthlyPayment: Math.round(monthlyPayment * 100) / 100,
    totalInterest: Math.round(totalInterest * 100) / 100,
    totalAmount: Math.round(totalAmount * 100) / 100,
    monthlyRate,
    schedule,
  };
}

/**
 * Generate amortization schedule
 */
export function generateAmortizationSchedule(
  principal: number,
  annualRate: number,
  totalMonths: number,
  monthlyPayment: number
): AmortizationScheduleItem[] {
  const schedule: AmortizationScheduleItem[] = [];
  let balance = principal;
  const monthlyRate = annualRate / 100 / 12;
  
  for (let month = 1; month <= totalMonths && balance > 0.01; month++) {
    const interest = balance * monthlyRate;
    const principalPayment = Math.min(monthlyPayment - interest, balance);
    balance = Math.max(0, balance - principalPayment);
    
    schedule.push({
      month,
      payment: Math.round(monthlyPayment * 100) / 100,
      principal: Math.round(principalPayment * 100) / 100,
      interest: Math.round(interest * 100) / 100,
      remainingBalance: Math.round(balance * 100) / 100,
    });
  }
  
  return schedule;
}

/**
 * Calculate number of months needed to pay off a principal with a given monthly payment
 * Inverse of PMT formula: n = -log(1 - (PV * r) / PMT) / log(1 + r)
 */
function calculateMonthsNeeded(
  principal: number,
  monthlyPayment: number,
  monthlyRate: number
): number {
  if (principal <= 0 || monthlyPayment <= 0) return 0;
  if (monthlyRate === 0) return Math.ceil(principal / monthlyPayment);
  
  const ratio = (principal * monthlyRate) / monthlyPayment;
  if (ratio >= 1) return Infinity; // Payment too small, will never pay off
  
  const months = -Math.log(1 - ratio) / Math.log(1 + monthlyRate);
  return Math.ceil(months);
}

/**
 * Calculate early amortization scenarios - REDUCE TERM (reduzir prazo)
 * After each early payment, recalculates how many months are needed with the same payment
 * The key: after early payment, we recalculate the remaining months needed, but we continue
 * with the SAME monthly payment until the balance is paid off
 */
function calculateEarlyAmortizationReduceTerm(
  currentPrincipal: number,
  currentAnnualRate: number,
  currentMonthlyPayment: number,
  currentRemainingMonths: number,
  scenarios: EarlyAmortizationScenario[]
): EarlyAmortizationResult {
  const sortedScenarios = [...scenarios].sort((a, b) => a.month - b.month);
  const monthlyRate = currentAnnualRate / 100 / 12;
  
  // Generate original schedule for comparison
  const originalSchedule = generateAmortizationSchedule(
    currentPrincipal,
    currentAnnualRate,
    currentRemainingMonths,
    currentMonthlyPayment
  );
  const originalTotalInterest = originalSchedule.reduce((sum, item) => sum + item.interest, 0);
  
  let balance = currentPrincipal;
  let month = 0;
  let scenarioIndex = 0;
  const newSchedule: AmortizationScheduleItem[] = [];
  
  // Simulate month by month until balance is paid off
  while (balance > 0.01 && month < currentRemainingMonths + 200) {
    month++;
    
    // Check if there's an early payment this month (BEFORE the regular payment)
    const scenario = sortedScenarios[scenarioIndex];
    let earlyPaymentThisMonth = 0;
    
    if (scenario && scenario.month === month) {
      earlyPaymentThisMonth = Math.min(scenario.amount, balance);
      balance = Math.max(0, balance - earlyPaymentThisMonth);
      scenarioIndex++;
      
      // If balance is paid off with early payment only
      if (balance <= 0.01) {
        newSchedule.push({
          month,
          payment: Math.round(earlyPaymentThisMonth * 100) / 100,
          principal: Math.round(earlyPaymentThisMonth * 100) / 100,
          interest: 0,
          remainingBalance: 0,
        });
        break;
      }
    }
    
    // Calculate regular monthly payment (same payment amount, applied to reduced balance)
    const interest = balance * monthlyRate;
    const principalPayment = Math.min(currentMonthlyPayment - interest, balance);
    const totalPayment = currentMonthlyPayment + earlyPaymentThisMonth;
    
    balance = Math.max(0, balance - principalPayment);
    
    newSchedule.push({
      month,
      payment: Math.round(totalPayment * 100) / 100,
      principal: Math.round((principalPayment + earlyPaymentThisMonth) * 100) / 100,
      interest: Math.round(interest * 100) / 100,
      remainingBalance: Math.round(balance * 100) / 100,
    });
    
    // If balance is paid off, break
    if (balance <= 0.01) break;
  }
  
  const newTotalInterest = newSchedule.reduce((sum, item) => sum + item.interest, 0);
  const interestSaved = originalTotalInterest - newTotalInterest;
  const monthsSaved = currentRemainingMonths - newSchedule.length;
  
  return {
    newMonthlyPayment: Math.round(currentMonthlyPayment * 100) / 100,
    newTotalMonths: newSchedule.length,
    interestSaved: Math.round(interestSaved * 100) / 100,
    monthsSaved: Math.max(0, monthsSaved),
    newSchedule,
  };
}

/**
 * Calculate early amortization scenarios - REDUCE PAYMENT (reduzir prestação)
 * After each early payment, recalculates the new monthly payment for the remaining term
 * The key: after early payment, we recalculate the monthly payment for the NEW balance
 * and the REMAINING months, keeping the same total term
 */
function calculateEarlyAmortizationReducePayment(
  currentPrincipal: number,
  currentAnnualRate: number,
  currentMonthlyPayment: number,
  currentRemainingMonths: number,
  scenarios: EarlyAmortizationScenario[]
): EarlyAmortizationResult {
  const sortedScenarios = [...scenarios].sort((a, b) => a.month - b.month);
  const monthlyRate = currentAnnualRate / 100 / 12;
  
  // Generate original schedule for comparison
  const originalSchedule = generateAmortizationSchedule(
    currentPrincipal,
    currentAnnualRate,
    currentRemainingMonths,
    currentMonthlyPayment
  );
  const originalTotalInterest = originalSchedule.reduce((sum, item) => sum + item.interest, 0);
  
  let balance = currentPrincipal;
  let month = 0;
  let scenarioIndex = 0;
  const newSchedule: AmortizationScheduleItem[] = [];
  let currentMonthlyPaymentAfterLastAmortization = currentMonthlyPayment;
  
  // Simulate month by month until we reach the original term
  while (month < currentRemainingMonths && balance > 0.01) {
    month++;
    const monthsRemaining = currentRemainingMonths - month; // Months left from this point
    
    // Check if there's an early payment this month (BEFORE the regular payment)
    const scenario = sortedScenarios[scenarioIndex];
    let earlyPaymentThisMonth = 0;
    
    if (scenario && scenario.month === month) {
      earlyPaymentThisMonth = Math.min(scenario.amount, balance);
      balance = Math.max(0, balance - earlyPaymentThisMonth);
      scenarioIndex++;
      
      // Recalculate new monthly payment for the remaining months
      // After this month, we have 'monthsRemaining' months left to pay 'balance'
      if (balance > 0.01 && monthsRemaining > 0) {
        currentMonthlyPaymentAfterLastAmortization = calculateMonthlyPayment(
          balance,
          currentAnnualRate,
          monthsRemaining
        );
      }
      
      // If balance is paid off with early payment only
      if (balance <= 0.01) {
        newSchedule.push({
          month,
          payment: Math.round(earlyPaymentThisMonth * 100) / 100,
          principal: Math.round(earlyPaymentThisMonth * 100) / 100,
          interest: 0,
          remainingBalance: 0,
        });
        // Fill remaining months with 0 payments
        for (let m = month + 1; m <= currentRemainingMonths; m++) {
          newSchedule.push({
            month: m,
            payment: 0,
            principal: 0,
            interest: 0,
            remainingBalance: 0,
          });
        }
        break;
      }
    }
    
    // Calculate regular monthly payment (using recalculated payment if amortization happened)
    const interest = balance * monthlyRate;
    const principalPayment = Math.min(currentMonthlyPaymentAfterLastAmortization - interest, balance);
    const totalPayment = currentMonthlyPaymentAfterLastAmortization + earlyPaymentThisMonth;
    
    balance = Math.max(0, balance - principalPayment);
    
    newSchedule.push({
      month,
      payment: Math.round(totalPayment * 100) / 100,
      principal: Math.round((principalPayment + earlyPaymentThisMonth) * 100) / 100,
      interest: Math.round(interest * 100) / 100,
      remainingBalance: Math.round(balance * 100) / 100,
    });
    
    // If balance is paid off before the term ends, fill remaining months with 0
    if (balance <= 0.01 && month < currentRemainingMonths) {
      for (let m = month + 1; m <= currentRemainingMonths; m++) {
        newSchedule.push({
          month: m,
          payment: 0,
          principal: 0,
          interest: 0,
          remainingBalance: 0,
        });
      }
      break;
    }
  }
  
  const newTotalInterest = newSchedule.reduce((sum, item) => sum + item.interest, 0);
  const interestSaved = originalTotalInterest - newTotalInterest;
  
  // Find the last month with a regular payment (excluding early payments)
  // The new monthly payment is the regular payment after the last amortization
  let finalRegularPayment = currentMonthlyPaymentAfterLastAmortization;
  
  // If no amortization happened, use original payment
  if (sortedScenarios.length === 0 || sortedScenarios.every(s => s.amount === 0)) {
    finalRegularPayment = currentMonthlyPayment;
  }
  
  return {
    newMonthlyPayment: Math.round(finalRegularPayment * 100) / 100,
    newTotalMonths: currentRemainingMonths, // Prazo mantém-se igual
    interestSaved: Math.round(interestSaved * 100) / 100,
    monthsSaved: 0, // Não reduz meses, reduz prestação
    newSchedule,
  };
}

/**
 * Calculate early amortization scenarios
 * Supports both reducing term (reduzir prazo) and reducing payment (reduzir prestação)
 */
export function calculateEarlyAmortization(
  currentPrincipal: number,
  currentAnnualRate: number,
  currentMonthlyPayment: number,
  currentRemainingMonths: number,
  scenarios: EarlyAmortizationScenario[]
): EarlyAmortizationResult {
  if (!scenarios || scenarios.length === 0) {
    // No scenarios, return original
    const originalSchedule = generateAmortizationSchedule(
      currentPrincipal,
      currentAnnualRate,
      currentRemainingMonths,
      currentMonthlyPayment
    );
    return {
      newMonthlyPayment: currentMonthlyPayment,
      newTotalMonths: currentRemainingMonths,
      interestSaved: 0,
      monthsSaved: 0,
      newSchedule: originalSchedule,
    };
  }
  
  // Check if all scenarios have the same type, or default to reduce_term
  const firstType = scenarios[0]?.type || 'reduce_term';
  const allSameType = scenarios.every(s => (s.type || 'reduce_term') === firstType);
  
  if (!allSameType) {
    // Mixed types - use reduce_term as default (can be enhanced later to handle mixed)
    return calculateEarlyAmortizationReduceTerm(
      currentPrincipal,
      currentAnnualRate,
      currentMonthlyPayment,
      currentRemainingMonths,
      scenarios
    );
  }
  
  // All same type - use appropriate function
  if (firstType === 'reduce_payment') {
    return calculateEarlyAmortizationReducePayment(
      currentPrincipal,
      currentAnnualRate,
      currentMonthlyPayment,
      currentRemainingMonths,
      scenarios
    );
  } else {
    // Default: reduce_term
    return calculateEarlyAmortizationReduceTerm(
      currentPrincipal,
      currentAnnualRate,
      currentMonthlyPayment,
      currentRemainingMonths,
      scenarios
    );
  }
}

/**
 * Calculate remaining amount from total and down payment
 */
export function calculateRemainingAmount(totalAmount: number, downPayment: number = 0): number {
  return Math.max(0, totalAmount - downPayment);
}

/**
 * Calculate total months from start and end date
 */
export function calculateTotalMonths(startDate: Date, endDate: Date): number {
  const months = (endDate.getFullYear() - startDate.getFullYear()) * 12 +
    (endDate.getMonth() - startDate.getMonth());
  return Math.max(1, months);
}
