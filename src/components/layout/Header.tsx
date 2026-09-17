import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Search, User, Wallet, Menu, X, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const mobileNavItems = [
  { name: 'Dashboard', href: '/' },
  { name: 'Este Mês', href: '/este-mes' },
  { name: 'Transações', href: '/transacoes' },
  { name: 'Simulação', href: '/simulacao' },
  { name: 'Crédito', href: '/credito' },
  { name: 'Poupança', href: '/poupanca' },
  { name: 'Definições', href: '/definicoes' },
];

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { signOut } = useAuth();
  const { data: profile } = useProfile();

  return (
    <>
      <header className="sticky top-0 z-40 h-16 bg-card/80 backdrop-blur-xl border-b border-border flex items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-3 lg:hidden">
          <div className="w-9 h-9 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
            <Wallet className="w-4 h-4 text-primary-foreground" />
          </div>
          <h1 className="font-display font-bold text-lg">FinPlanner</h1>
        </div>

        <div className="hidden lg:flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Pesquisar transações..."
              className="w-full h-10 pl-10 pr-4 rounded-lg bg-secondary border-0 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full" />
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="hidden lg:flex">
                <User className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <div className="px-2 py-1.5 text-sm font-medium">
                {profile?.name || 'Utilizador'}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => signOut()}>
                <LogOut className="w-4 h-4 mr-2" />
                Terminar Sessão
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </header>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden fixed top-16 left-0 right-0 bg-card border-b border-border z-30 overflow-hidden"
          >
            <nav className="p-4 space-y-1">
              {mobileNavItems.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-4 py-3 rounded-lg text-sm font-medium hover:bg-secondary transition-colors"
                >
                  {item.name}
                </NavLink>
              ))}
              <button
                onClick={() => signOut()}
                className="w-full text-left px-4 py-3 rounded-lg text-sm font-medium hover:bg-secondary transition-colors text-destructive"
              >
                Terminar Sessão
              </button>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
