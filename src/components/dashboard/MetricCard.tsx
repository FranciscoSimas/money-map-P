import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string;
  change?: number;
  icon: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'primary';
  delay?: number;
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

export function MetricCard({
  title,
  value,
  change,
  icon,
  variant = 'default',
  delay = 0,
}: MetricCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className={cn(
        'rounded-xl border p-5 shadow-card card-hover',
        variantStyles[variant]
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-3">
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
            {value}
          </p>
          {change !== undefined && (
            <div
              className={cn(
                'flex items-center gap-1 text-xs font-medium',
                change >= 0 ? 'text-success' : 'text-destructive',
                variant === 'primary' && 'text-primary-foreground/90'
              )}
            >
              {change >= 0 ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              <span>{Math.abs(change)}% este mês</span>
            </div>
          )}
        </div>
        <div className={cn('p-3 rounded-xl', iconBgStyles[variant])}>
          {icon}
        </div>
      </div>
    </motion.div>
  );
}
