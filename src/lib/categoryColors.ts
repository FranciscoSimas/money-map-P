// Lista de cores disponíveis para categorias (mínimo 25 cores)
export const CATEGORY_COLORS = [
  // Azuis
  'hsl(210, 70%, 55%)',   // Azul principal
  'hsl(200, 80%, 50%)',   // Azul claro
  'hsl(220, 60%, 45%)',   // Azul escuro
  'hsl(195, 75%, 60%)',   // Azul turquesa
  'hsl(230, 65%, 50%)',   // Azul índigo
  
  // Verdes
  'hsl(145, 60%, 42%)',   // Verde principal
  'hsl(150, 70%, 50%)',   // Verde claro
  'hsl(140, 55%, 38%)',   // Verde escuro
  'hsl(160, 65%, 45%)',   // Verde lima
  'hsl(130, 50%, 40%)',   // Verde musgo
  
  // Vermelhos/Laranjas
  'hsl(0, 70%, 50%)',     // Vermelho
  'hsl(10, 75%, 55%)',    // Laranja
  'hsl(20, 80%, 60%)',    // Laranja claro
  'hsl(350, 65%, 48%)',   // Vermelho rosa
  'hsl(15, 70%, 52%)',    // Coral
  
  // Roxos/Violetas
  'hsl(270, 60%, 50%)',   // Roxo
  'hsl(280, 65%, 55%)',   // Violeta
  'hsl(260, 55%, 45%)',   // Roxo escuro
  'hsl(290, 70%, 60%)',   // Lavanda
  'hsl(250, 60%, 48%)',   // Púrpura
  
  // Amarelos/Dourados
  'hsl(50, 90%, 50%)',    // Amarelo
  'hsl(45, 85%, 55%)',    // Amarelo claro
  'hsl(40, 80%, 48%)',    // Dourado
  'hsl(35, 75%, 52%)',    // Âmbar
  
  // Cinzas/Neutros
  'hsl(220, 15%, 50%)',   // Cinza azulado
  'hsl(200, 10%, 45%)',   // Cinza claro
  'hsl(240, 20%, 40%)',   // Cinza escuro
] as const;

export type CategoryColor = typeof CATEGORY_COLORS[number];

// Função para obter uma cor por índice (útil para atribuir cores automaticamente)
export function getColorByIndex(index: number): CategoryColor {
  return CATEGORY_COLORS[index % CATEGORY_COLORS.length];
}

// Função para obter uma cor aleatória
export function getRandomColor(): CategoryColor {
  return CATEGORY_COLORS[Math.floor(Math.random() * CATEGORY_COLORS.length)];
}
