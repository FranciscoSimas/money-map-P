import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  ArrowUpDown,
  TrendingUp,
  CreditCard,
  PiggyBank,
  Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Este Mês', href: '/este-mes', icon: Calendar },
  { name: 'Transações', href: '/transacoes', icon: ArrowUpDown },
  { name: 'Simulação', href: '/simulacao', icon: TrendingUp },
  { name: 'Crédito', href: '/credito', icon: CreditCard },
  { name: 'Poupança', href: '/poupanca', icon: PiggyBank },
  { name: 'Investimentos', href: '/investimentos', icon: TrendingUp },
];

export function MobileNav() {
  const location = useLocation();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-lg border-t border-border z-50 safe-area-inset-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <NavLink
              key={item.name}
              to={item.href}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all relative',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="mobileActiveTab"
                  className="absolute -top-0.5 w-8 h-1 bg-gradient-primary rounded-full"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.name}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
