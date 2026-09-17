# 💰 Money Map

**Last update:** 17/09/2026

Web app for personal finance — expenses, income, savings and investments in one place.

## 📖 About

I built this app to keep track of my money without spreadsheets. It covers the current month, transactions, savings, credit, investments and simple simulations. Login and data live on Supabase. There is also an experimental receipt OCR feature (optional Gemini API key).

## ✨ Main Features

- 🔐 Auth (Supabase)
- 📊 Monthly dashboard
- 💳 Transactions
- 🏦 Savings, credit and investments
- 🧮 Simple simulations
- 🧾 Experimental receipt OCR (Gemini)

## 🛠️ Technologies Used

### Frontend
- React 18
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui

### Backend
- Supabase (Auth + PostgreSQL)
- Vercel (deploy)
- Gemini API (optional, OCR)

## 📁 Project Structure

```
money-map-P/
├── public/           # Static assets
├── src/
│   ├── components/   # UI and feature components
│   ├── hooks/        # Custom hooks
│   ├── integrations/ # Supabase client
│   ├── pages/        # App pages
│   ├── App.tsx
│   └── main.tsx
├── supabase/         # DB migrations / config
├── .env.example
└── package.json
```

## 🤝 Contributing

This is a personal project. Suggestions are welcome, but I am not looking for active contributors right now.

## 📄 License

Personal and educational use.

## 🔗 Links

- **Repository:** https://github.com/FranciscoSimas/money-map-P
