import { ReactNode, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExpandedExpensesCardProps {
  title: string;
  totalValue: string;
  icon: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'primary';
  delay?: number;
  expensesTotal: string;
  savingsTotal: string;
  investmentsTotal: string;
}

const variantStyles = {
  default: 'bg-card',
  success: 'bg-card border-success/20',
  warning: 'bg-card border-warning/20',
  primary: 'bg-gradient-primary text-primary-foreground',
};

const iconBgStyles = {
  default: 'bg-secondary text-foreground',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  primary: 'bg-primary-foreground/20 text-primary-foreground',
};

export function ExpandedExpensesCard({
  title,
  totalValue,
  icon,
  variant = 'default',
  delay = 0,
  expensesTotal,
  savingsTotal,
  investmentsTotal,
}: ExpandedExpensesCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className={cn(
        'rounded-xl border p-5 shadow-card card-hover overflow-hidden',
        variantStyles[variant]
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-3 flex-1">
          <p
            className={cn(
              'text-sm font-medium',
              variant === 'primary' ? 'text-primary-foreground/80' : 'text-muted-foreground'
            )}
          >
            {title}
          </p>
          <p
            className={cn(
              'text-2xl lg:text-3xl font-display font-bold tracking-tight',
              variant === 'primary' ? 'text-primary-foreground' : 'text-foreground'
            )}
          >
            {totalValue}
          </p>
        </div>
        <div className={cn('p-3 rounded-xl', iconBgStyles[variant])}>
          {icon}
        </div>
      </div>

      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'mt-4 w-full flex items-center justify-between text-sm font-medium transition-colors',
          variant === 'primary' ? 'text-primary-foreground/80 hover:text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <span>Ver detalhes</span>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="mt-4 pt-4 border-t space-y-3">
              <div className="flex justify-between items-center">
                <span className={cn(
                  'text-sm',
                  variant === 'primary' ? 'text-primary-foreground/80' : 'text-muted-foreground'
                )}>
                  Despesas Totais
                </span>
                <span className={cn(
                  'font-semibold',
                  variant === 'primary' ? 'text-primary-foreground' : 'text-foreground'
                )}>
                  {expensesTotal}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className={cn(
                  'text-sm',
                  variant === 'primary' ? 'text-primary-foreground/80' : 'text-muted-foreground'
                )}>
                  Poupança Total
                </span>
                <span className={cn(
                  'font-semibold',
                  variant === 'primary' ? 'text-primary-foreground' : 'text-foreground'
                )}>
                  {savingsTotal}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className={cn(
                  'text-sm',
                  variant === 'primary' ? 'text-primary-foreground/80' : 'text-muted-foreground'
                )}>
                  Investimento Total
                </span>
                <span className={cn(
                  'font-semibold',
                  variant === 'primary' ? 'text-primary-foreground' : 'text-foreground'
                )}>
                  {investmentsTotal}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

