import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import Transacoes from "./pages/Transacoes";
import Simulacao from "./pages/Simulacao";
import Credito from "./pages/Credito";
import Poupanca from "./pages/Poupanca";
import Investimentos from "./pages/Investimentos";
import Definicoes from "./pages/Definicoes";
import EsteMes from "./pages/EsteMes";
import Experimental from "./pages/Experimental";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/onboarding" element={
              <ProtectedRoute>
                <Onboarding />
              </ProtectedRoute>
            } />
            <Route path="/" element={
              <ProtectedRoute>
                <Index />
              </ProtectedRoute>
            } />
            <Route path="/transacoes" element={
              <ProtectedRoute>
                <Transacoes />
              </ProtectedRoute>
            } />
            <Route path="/este-mes" element={
              <ProtectedRoute>
                <EsteMes />
              </ProtectedRoute>
            } />
            <Route path="/simulacao" element={
              <ProtectedRoute>
                <Simulacao />
              </ProtectedRoute>
            } />
            <Route path="/credito" element={
              <ProtectedRoute>
                <Credito />
              </ProtectedRoute>
            } />
            <Route path="/poupanca" element={
              <ProtectedRoute>
                <Poupanca />
              </ProtectedRoute>
            } />
            <Route path="/investimentos" element={
              <ProtectedRoute>
                <Investimentos />
              </ProtectedRoute>
            } />
            <Route path="/definicoes" element={
              <ProtectedRoute>
                <Definicoes />
              </ProtectedRoute>
            } />
            <Route path="/experimental" element={
              <ProtectedRoute>
                <Experimental />
              </ProtectedRoute>
            } />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
