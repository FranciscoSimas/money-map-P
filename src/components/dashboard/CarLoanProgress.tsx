import { motion } from 'framer-motion';
import { Car, TrendingDown } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import { useMemo } from 'react';

export function CarLoanProgress() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const { data: credits, isLoading } = useQuery({
    queryKey: ['credits', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('credits')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });
  
  // Get the first active credit (or car credit if available)
  const loanData = useMemo(() => {
    if (!credits || credits.length === 0) return null;
    
    const carCredit = credits.find(c => c.credit_type === 'car');
    const firstCredit = carCredit || credits[0];
    
    const paidAmount = firstCredit.total_amount - firstCredit.remaining_amount;
    const progress = (paidAmount / firstCredit.total_amount) * 100;
    
    // Calculate remaining months
    const startDate = new Date(firstCredit.start_date);
    const now = new Date();
    const monthsElapsed = (now.getFullYear() - startDate.getFullYear()) * 12 + 
      (now.getMonth() - startDate.getMonth());
    const remainingMonths = Math.max(0, (firstCredit.total_months || 0) - monthsElapsed);
    
    return {
      id: firstCredit.id,
      name: firstCredit.name,
      totalLoan: firstCredit.total_amount,
      paidAmount,
      remaining: firstCredit.remaining_amount,
      monthlyPayment: firstCredit.monthly_payment,
      remainingMonths,
      interestRate: firstCredit.interest_rate || 0,
      progress,
      creditType: firstCredit.credit_type,
    };
  }, [credits]);
  
  if (isLoading) {
    return (
      <div className="bg-card rounded-xl border p-5 shadow-card">
        <Skeleton className="h-6 w-48 mb-6" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  
  if (!loanData) {
    return (
      <div className="bg-card rounded-xl border p-5 shadow-card">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-xl bg-primary/10">
            <Car className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-lg">Créditos</h3>
            <p className="text-sm text-muted-foreground">Ainda não tens créditos registados</p>
          </div>
        </div>
        <button 
          onClick={() => navigate('/credito')}
          className="w-full px-4 py-2.5 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
        >
          Adicionar Crédito
        </button>
      </div>
    );
  }
  
  const progress = loanData.progress;
  const remaining = loanData.remaining;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.4 }}
      className="bg-card rounded-xl border p-5 shadow-card"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-xl bg-primary/10">
          <Car className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-display font-semibold text-lg">{loanData.name}</h3>
          <p className="text-sm text-muted-foreground">
            {loanData.remainingMonths} meses restantes
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Progresso</span>
            <span className="text-sm font-semibold text-primary">{progress.toFixed(1)}%</span>
          </div>
          <div className="h-3 bg-secondary rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 1, delay: 0.5, ease: 'easeOut' }}
              className="h-full bg-gradient-primary rounded-full"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Capital Amortizado</p>
            <p className="font-display font-bold text-success text-lg">
              €{loanData.paidAmount.toLocaleString('pt-PT')}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Valor Restante</p>
            <p className="font-display font-bold text-foreground text-lg">
              €{remaining.toLocaleString('pt-PT')}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Prestação Mensal</p>
            <p className="font-display font-semibold text-foreground">
              €{loanData.monthlyPayment.toLocaleString('pt-PT')}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Taxa de Juro</p>
            <p className="font-display font-semibold text-foreground">
              {loanData.interestRate}%
            </p>
          </div>
        </div>

        <button 
          onClick={() => navigate('/credito')}
          className="w-full mt-2 px-4 py-2.5 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors flex items-center justify-center gap-2"
        >
          <TrendingDown className="w-4 h-4" />
          Ver Detalhes
        </button>
      </div>
    </motion.div>
  );
}
