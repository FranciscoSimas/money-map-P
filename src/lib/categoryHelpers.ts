/**
 * Helper functions to identify special category types
 */

/**
 * Check if a category is a savings category
 */
export function isSavingsCategory(categoryName: string): boolean {
  const name = categoryName.toLowerCase();
  return name.includes('poupança') || name.includes('poupanca') || name.includes('savings');
}

/**
 * Check if a category is an investment category
 * Note: Crypto is NOT considered an investment - it's treated as a regular expense
 */
export function isInvestmentCategory(categoryName: string): boolean {
  const name = categoryName.toLowerCase();
  return name.includes('ações') || name.includes('acoes') || 
         name.includes('etf') || 
         name.includes('investimento') || name.includes('invest') ||
         name.includes('ppr') ||
         name.includes('stocks');
}

/**
 * Check if a transaction should affect total balance
 * Savings and investments don't affect total balance, only bank balance
 */
export function shouldAffectTotalBalance(categoryName: string): boolean {
  return !isSavingsCategory(categoryName) && !isInvestmentCategory(categoryName);
}

/**
 * Poupança líquida do mês = depósitos - retiradas, mas nunca abaixo de zero.
 * Se retirar mais do que depositou no mês, o excesso vem de poupança antiga
 * e não deve reduzir o movimento mensal abaixo de zero.
 */
export function netMonthlySavingsAmount(deposits: number, withdrawals: number): number {
  if (deposits <= 0) return 0;
  return Math.max(0, deposits - Math.min(withdrawals, deposits));
}
