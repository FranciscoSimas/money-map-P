/**
 * Calculadora de salário líquido baseada no simulador do Santander
 * https://www.santander.pt/salto/simulador-de-salario-liquido
 */

export interface SalaryCalculationInput {
  baseSalary: number; // Salário bruto mensal
  socialSecurityRate?: number; // Taxa de segurança social (padrão 11%)
  hasFoodAllowance: boolean;
  foodAllowanceValue: number;
  foodAllowanceType: 'card' | 'cash';
  foodAllowanceDays?: number; // Dias trabalhados por mês (padrão 22)
  // Duodécimos: 'none' | '50_one' | '50_both_or_one_full' | 'both'
  duodecimosType?: 'none' | '50_one' | '50_both_or_one_full' | 'both';
  has13thMonth: boolean;
  has14thMonth: boolean;
  // Outros rendimentos (opcional)
  otherIncomeExempt?: number; // Rendimentos isentos
  otherIncomeIRSOnly?: number; // Rendimentos sujeitos apenas a IRS
  otherIncomeIRSandSS?: number; // Rendimentos sujeitos a IRS e SS
  // Dados pessoais para cálculo de IRS
  fiscalResidence?: 'continental' | 'azores' | 'madeira'; // Padrão: continental
  maritalStatus?: 'single' | 'married_single' | 'married_joint'; // Padrão: single
  dependents?: number; // Padrão: 0
  hasDisability?: boolean; // Padrão: false
  dependentsWithDisability?: number; // Padrão: 0
  hasIRSJovem?: boolean; // Padrão: false
  irsJovemYear?: 1 | 2 | 3; // 1 = 100%, 2-4 = 75%, 5-7 = 50%
}

export interface SalaryCalculationResult {
  // Rendimentos
  grossSalary: number;
  foodAllowanceGross: number;
  duodecimosGross: number;
  otherIncomeGross: number;
  totalGross: number;
  
  // Descontos
  socialSecurity: number;
  irsRetention: number;
  totalDeductions: number;
  
  // Líquidos
  netSalary: number;
  foodAllowanceNet: number;
  duodecimosNet: number;
  totalNet: number;
  
  // Percentagens
  retentionRate: number;
  
  // Detalhes
  monthlyNet: number;
  annualNet: number;
  // Subsídios (quando não tem duodécimos)
  vacationSubsidyNet?: number;
  christmasSubsidyNet?: number;
}

/**
 * Calcula a retenção na fonte de IRS baseada nas tabelas oficiais
 * Tabelas de retenção na fonte 2025/2026 - Portugal Continental
 * Baseado nas tabelas oficiais do Portal das Finanças
 */
function calculateIRSRetention(
  grossSalary: number,
  maritalStatus: 'single' | 'married_single' | 'married_joint' = 'single',
  dependents: number = 0,
  hasIRSJovem: boolean = false,
  irsJovemYear?: 1 | 2 | 3
): number {
  // Se tem IRS Jovem, aplicar isenção
  if (hasIRSJovem && irsJovemYear) {
    if (irsJovemYear === 1) {
      return 0; // 100% isenção no 1º ano
    }
    // Para anos 2-4 (75% isenção) e 5-7 (50% isenção), calculamos depois
  }

  // Tabelas de retenção na fonte 2025/2026 (valores mensais)
  // Solteiro, sem dependentes
  if (maritalStatus === 'single' && dependents === 0) {
    if (grossSalary <= 920) return 0;
    if (grossSalary <= 1000) return grossSalary * 0.01; // ~1%
    if (grossSalary <= 1200) return grossSalary * 0.02; // ~2%
    if (grossSalary <= 1500) return grossSalary * 0.045; // ~4.5%
    if (grossSalary <= 2000) return grossSalary * 0.075; // ~7.5%
    if (grossSalary <= 2500) return grossSalary * 0.11; // ~11%
    if (grossSalary <= 3000) return grossSalary * 0.135; // ~13.5%
    if (grossSalary <= 4000) return grossSalary * 0.16; // ~16%
    if (grossSalary <= 5000) return grossSalary * 0.19; // ~19%
    return grossSalary * 0.22; // ~22% para salários superiores
  }

  // Casado, único titular, sem dependentes
  if (maritalStatus === 'married_single' && dependents === 0) {
    if (grossSalary <= 920) return 0;
    if (grossSalary <= 1200) return grossSalary * 0.01; // ~1%
    if (grossSalary <= 1500) return grossSalary * 0.03; // ~3%
    if (grossSalary <= 2000) return grossSalary * 0.06; // ~6%
    if (grossSalary <= 2500) return grossSalary * 0.09; // ~9%
    if (grossSalary <= 3000) return grossSalary * 0.115; // ~11.5%
    if (grossSalary <= 4000) return grossSalary * 0.14; // ~14%
    if (grossSalary <= 5000) return grossSalary * 0.17; // ~17%
    return grossSalary * 0.20; // ~20%
  }

  // Casado, dois titulares, sem dependentes
  if (maritalStatus === 'married_joint' && dependents === 0) {
    if (grossSalary <= 920) return 0;
    if (grossSalary <= 1500) return grossSalary * 0.01; // ~1%
    if (grossSalary <= 2000) return grossSalary * 0.04; // ~4%
    if (grossSalary <= 2500) return grossSalary * 0.07; // ~7%
    if (grossSalary <= 3000) return grossSalary * 0.095; // ~9.5%
    if (grossSalary <= 4000) return grossSalary * 0.12; // ~12%
    if (grossSalary <= 5000) return grossSalary * 0.15; // ~15%
    return grossSalary * 0.18; // ~18%
  }

  // Com dependentes - reduzir retenção
  // Cada dependente reduz aproximadamente 0.5-1% da retenção
  const baseRetention = calculateIRSRetention(grossSalary, maritalStatus, 0, hasIRSJovem, irsJovemYear);
  const dependentReduction = dependents * (grossSalary * 0.005); // ~0.5% por dependente
  return Math.max(0, baseRetention - dependentReduction);
}

/**
 * Calcula o salário líquido completo
 */
export function calculateNetSalary(input: SalaryCalculationInput): SalaryCalculationResult {
  const socialSecurityRate = input.socialSecurityRate ?? 0.11; // 11% padrão
  const foodAllowanceDays = input.foodAllowanceDays ?? 22; // 22 dias padrão
  const fiscalResidence = input.fiscalResidence ?? 'continental';
  const maritalStatus = input.maritalStatus ?? 'single';
  const dependents = input.dependents ?? 0;
  
  // 1. Calcular rendimentos brutos
  const grossSalary = input.baseSalary;
  const foodAllowanceGross = input.hasFoodAllowance 
    ? input.foodAllowanceValue * foodAllowanceDays 
    : 0;
  
  // Calcular primeiro o salário líquido base (sem duodécimos ainda)
  // Base para SS: salário base + subsídio alimentação em dinheiro + outros rendimentos sujeitos a SS
  const baseForSS = grossSalary + 
    (input.hasFoodAllowance && input.foodAllowanceType === 'cash' ? foodAllowanceGross : 0) + 
    (input.otherIncomeIRSandSS || 0);
  
  // Segurança Social (11% sobre a base)
  const baseSS = baseForSS * socialSecurityRate;
  
  // Base para IRS: salário base + outros rendimentos sujeitos a IRS
  const baseForIRS = grossSalary + (input.otherIncomeIRSOnly || 0) + (input.otherIncomeIRSandSS || 0);
  
  // Ajustar por incapacidade
  const adjustedDependents = (input.dependents || 0) + (input.hasDisability ? 1 : 0) + (input.dependentsWithDisability || 0);
  
  // IRS - Retenção na fonte
  let baseIRS = calculateIRSRetention(
    baseForIRS,
    input.maritalStatus || 'single',
    adjustedDependents,
    input.hasIRSJovem || false,
    input.irsJovemYear
  );
  
  // Aplicar IRS Jovem se aplicável
  if (input.hasIRSJovem && input.irsJovemYear) {
    if (input.irsJovemYear === 1) {
      baseIRS = 0; // 100% isenção
    } else if (input.irsJovemYear === 2) {
      baseIRS = baseIRS * 0.25; // 75% isenção
    } else if (input.irsJovemYear === 3) {
      baseIRS = baseIRS * 0.50; // 50% isenção
    }
  }
  
  // Salário líquido base (sem duodécimos)
  const baseNetSalary = grossSalary - baseSS - baseIRS;
  
  // Calcular duodécimos: baseado no SALÁRIO LÍQUIDO, não no bruto!
  // Duodécimos = (Subsídio Férias Líquido + Subsídio Natal Líquido) / 12
  // Cada subsídio líquido = salário líquido base
  let duodecimosNet = 0;
  const hasDuodecimos = input.duodecimosType !== 'none' && input.duodecimosType !== undefined;
  
  if (hasDuodecimos) {
    // Calcular quantos subsídios tem (13º e/ou 14º mês)
    const numSubsidios = (input.has13thMonth ? 1 : 0) + (input.has14thMonth ? 1 : 0);
    // Duodécimos = (salário líquido * número de subsídios) / 12
    duodecimosNet = (baseNetSalary * numSubsidios) / 12;
  }
  
  // Outros rendimentos (seguindo simulador Santander)
  const otherIncomeExempt = input.otherIncomeExempt || 0; // Isentos (não tributados)
  const otherIncomeIRSOnly = input.otherIncomeIRSOnly || 0; // Apenas IRS
  const otherIncomeIRSandSS = input.otherIncomeIRSandSS || 0; // IRS + SS
  
  // Calcular descontos para outros rendimentos
  const otherIncomeIRSandSS_SS = otherIncomeIRSandSS * socialSecurityRate;
  const otherIncomeIRSandSS_IRS = baseForIRS > 0 && (grossSalary + otherIncomeIRSandSS) > 0
    ? (baseIRS * (otherIncomeIRSandSS / baseForIRS))
    : 0;
  const otherIncomeIRSOnly_IRS = baseForIRS > 0 && (grossSalary + otherIncomeIRSOnly) > 0
    ? (baseIRS * (otherIncomeIRSOnly / baseForIRS))
    : 0;
  
  const otherIncomeNet = otherIncomeExempt + // Isentos
    (otherIncomeIRSOnly - otherIncomeIRSOnly_IRS) + // Apenas IRS
    (otherIncomeIRSandSS - otherIncomeIRSandSS_SS - otherIncomeIRSandSS_IRS); // IRS + SS
  
  // Total de descontos
  const socialSecurity = baseSS + otherIncomeIRSandSS_SS;
  const irsRetention = baseIRS + otherIncomeIRSOnly_IRS + otherIncomeIRSandSS_IRS;
  const totalDeductions = socialSecurity + irsRetention;
  
  // Salário líquido base (já calculado acima)
  const netSalary = baseNetSalary;
  
  // Subsídio de alimentação
  // Em cartão: não tributado (valor total)
  // Em dinheiro: tributado apenas em SS (não IRS) - já descontado acima no baseSS
  const foodAllowanceNet = input.hasFoodAllowance
    ? input.foodAllowanceType === 'card'
      ? foodAllowanceGross // Não tributado
      : foodAllowanceGross - (foodAllowanceGross * socialSecurityRate) // Apenas SS
    : 0;
  
  // Total líquido mensal
  // Se tem duodécimos: salário líquido + duodécimos + subsídio alimentação + outros rendimentos
  // Se não tem: salário líquido + subsídio alimentação + outros rendimentos
  const monthlyNet = netSalary + duodecimosNet + foodAllowanceNet + otherIncomeNet;
  
  // 4. Calcular subsídios de férias e natal (quando NÃO tem duodécimos)
  // Se tem duodécimos, os subsídios já estão incluídos nos duodécimos mensais
  let vacationSubsidyNet = 0;
  let christmasSubsidyNet = 0;
  
  if (!hasDuodecimos) {
    // Não tem duodécimos - subsídios pagos integralmente (14 salários por ano)
    // Cada subsídio = salário líquido base (já calculado)
    if (input.has14thMonth) {
      vacationSubsidyNet = baseNetSalary;
    }
    if (input.has13thMonth) {
      christmasSubsidyNet = baseNetSalary;
    }
  }
  
  // Total líquido anual
  let annualNet = monthlyNet * 12;
  
  // Se não tem duodécimos, adicionar os subsídios pagos separadamente (14 salários)
  if (!hasDuodecimos) {
    annualNet += vacationSubsidyNet + christmasSubsidyNet;
  }
  // Se tem duodécimos, tudo já está incluído no monthlyNet * 12
  
  // Total bruto anual
  // Base mensal bruta: salário + subsídio alimentação em dinheiro + outros rendimentos sujeitos a SS
  const monthlyGrossBase = grossSalary + 
    (input.hasFoodAllowance && input.foodAllowanceType === 'cash' ? foodAllowanceGross : 0) + 
    otherIncomeIRSandSS;
  
  let totalGross = monthlyGrossBase * 12;
  
  // Se não tem duodécimos, adicionar subsídios brutos pagos separadamente
  if (!hasDuodecimos) {
    totalGross += (input.has13thMonth ? grossSalary : 0) + (input.has14thMonth ? grossSalary : 0);
  }
  // Se tem duodécimos, já está incluído (os duodécimos são líquidos, não brutos)
  
  // Adicionar outros rendimentos isentos e sujeitos apenas a IRS ao total bruto (para referência)
  totalGross += otherIncomeExempt + otherIncomeIRSOnly;
  
  const retentionRate = baseForIRS > 0 ? (irsRetention / baseForIRS) * 100 : 0;
  
  return {
    grossSalary,
    foodAllowanceGross,
    duodecimosGross: 0, // Duodécimos são líquidos, não brutos
    otherIncomeGross: otherIncomeExempt + otherIncomeIRSOnly + otherIncomeIRSandSS,
    totalGross,
    socialSecurity,
    irsRetention,
    totalDeductions,
    netSalary,
    foodAllowanceNet,
    duodecimosNet,
    totalNet: annualNet,
    retentionRate,
    monthlyNet,
    annualNet,
    // Informações adicionais
    vacationSubsidyNet,
    christmasSubsidyNet,
  };
}
