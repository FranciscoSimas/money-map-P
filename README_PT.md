# **Último update:** 08/07/2026

# 💰 Money Map

App web de finanças pessoais — despesas, receitas, poupança e investimentos num só sítio.

## 📖 Sobre

Fiz esta app para acompanhar o dinheiro sem folhas de cálculo. Cobre o mês actual, transações, poupança, crédito, investimentos e simulações simples. O login e os dados ficam no Supabase. Há também OCR experimental de recibos (chave Gemini opcional).

## ✨ Funcionalidades Principais

- 🔐 Autenticação (Supabase)
- 📊 Dashboard do mês
- 💳 Transações
- 🏦 Poupança, crédito e investimentos
- 🧮 Simulações simples
- 🧾 OCR experimental de recibos (Gemini)

## 🛠️ Tecnologias Utilizadas

### Frontend
- React 18
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui

### Backend
- Supabase (Auth + PostgreSQL)
- Vercel (deploy)
- Gemini API (opcional, OCR)

## 📁 Estrutura do Projeto

```
money-map-P/
├── public/           # Ficheiros estáticos
├── src/
│   ├── components/   # Componentes UI e da app
│   ├── hooks/        # Hooks personalizados
│   ├── integrations/ # Cliente Supabase
│   ├── pages/        # Páginas da app
│   ├── App.tsx
│   └── main.tsx
├── supabase/         # Migrações / config da BD
├── .env.example
└── package.json
```

## 🤝 Contribuir

Este é um projeto pessoal. Sugestões são bem-vindas, mas neste momento não estou à procura de contribuidores ativos.

## 📄 Licença

Uso pessoal e educacional.

## 🔗 Links

- **Repositório:** https://github.com/FranciscoSimas/money-map-P
