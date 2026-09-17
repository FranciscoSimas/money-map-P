import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Upload, X, Loader2, CheckCircle2, AlertCircle, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createWorker } from 'tesseract.js';
import { useExpenseCategories } from '@/hooks/useCategories';
import { useCreateTransaction } from '@/hooks/useTransactions';
import { toast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface ReceiptItem {
  quantity: number;
  description: string;
  vatRate?: number;
  price: number;
  // Categorias semânticas sugeridas pelo Gemini (opcionais)
  mainCategory?: string | null;
  subCategory?: string | null;
}

interface ReceiptData {
  total: number | null;
  date: string | null;
  time: string | null;
  store: string | null;
  companyName: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  nif: string | null;
  items: ReceiptItem[];
  vatSummary: Array<{
    rate: number;
    base: number;
    vat: number;
    total: number;
  }>;
  paymentMethod: string | null;
  rawText: string;
  confidence: number;
  processingTime: number;
}

type ProcessingMethod = 'tesseract' | 'gemini';

export function ReceiptOCR() {
  // Suportar múltiplas imagens (recibos com várias páginas)
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [extractedText, setExtractedText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processingPhase, setProcessingPhase] = useState<string>('');
  const [parsedData, setParsedData] = useState<ReceiptData | null>(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split('T')[0]);
  const [editableTotal, setEditableTotal] = useState<string>('');
  const [editableStore, setEditableStore] = useState<string>('');
  const [processingMethod, setProcessingMethod] = useState<ProcessingMethod>('tesseract');
  const [receiptId, setReceiptId] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: expenseCategories } = useExpenseCategories();
  const createTransaction = useCreateTransaction();
  const { user } = useAuth();

  const handleImageSelect = (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const validImages = fileArray.filter((file) => file.type.startsWith('image/'));

    if (validImages.length === 0) {
      toast({
        title: 'Erro',
        description: 'Por favor, seleciona pelo menos um ficheiro de imagem.',
        variant: 'destructive',
      });
      return;
    }

    setImages(validImages);
    setImagePreviews([]);

    validImages.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setImagePreviews((prev) => [...prev, result]);
      };
      reader.readAsDataURL(file);
    });

    setExtractedText('');
    setParsedData(null);
  };

  const readFileAsBase64 = (imageFile: File): Promise<string> => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        // Remover o prefixo data:image;base64,
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(imageFile);
    });
  };

  const processReceiptWithGemini = async (imageFiles: File[]): Promise<ReceiptData> => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    
    if (!apiKey) {
      throw new Error('Chave API do Gemini não configurada. Adiciona VITE_GEMINI_API_KEY no .env ou configura abaixo.');
    }

    if (!imageFiles || imageFiles.length === 0) {
      throw new Error('Nenhuma imagem disponível para processar.');
    }

    // Converter todas as imagens para base64
    const base64Images = await Promise.all(
      imageFiles.map((file) => readFileAsBase64(file))
    );

    // Prompt para análise do recibo
    const prompt = `Analisa esta imagem de um recibo ou fatura português e extrai os seguintes dados em formato JSON,
com especial foco em categorizar inteligentemente cada item (por exemplo, separar despesas de supermercado em Carne, Bebidas, Padaria, Limpeza e Higiene, etc.,
e despesas de restauração em Prato, Bebida, Sobremesa, etc.):

{
  "total": número (montante total a pagar),
  "date": "YYYY-MM-DD" (data do recibo),
  "time": "HH:MM" (hora, se disponível),
  "store": "nome do estabelecimento",
  "companyName": "nome da empresa (se diferente do store)",
  "address": "morada completa",
  "postalCode": "código postal",
  "city": "cidade",
  "nif": "número de identificação fiscal (9 dígitos)",
  "items": [
    {
      "quantity": número,
      "description": "descrição do item",
      "vatRate": número (percentagem de IVA, opcional),
      "price": número (preço UNITÁRIO do item, não o total),
      "mainCategory": "categoria principal do gasto (ex: 'Supermercado', 'Alimentação - Restauração', 'Compras', 'Serviços', 'Transportes')",
      "subCategory": "subcategoria mais específica (ex: 'Carne', 'Bebidas', 'Padaria', 'Limpeza e Higiene', 'Restauração - Prato', 'Restauração - Bebida', 'Restauração - Sobremesa', 'Roupa', 'Jogos', 'Utensílios', 'Equipamentos tecnológicos')"
    }
  ],
  "vatSummary": [
    {
      "rate": número (percentagem),
      "base": número (base),
      "vat": número (IVA),
      "total": número (total)
    }
  ],
  "paymentMethod": "método de pagamento (se visível)"
}

IMPORTANTE:
- Extrai TODOS os itens individuais do recibo
- O campo "store" deve ser o nome do estabelecimento (ex: "OHYO SUSHI | LOUNGE")
- NÃO traduzas nomes de ruas, endereços ou estabelecimentos - mantém no idioma original
- O campo "price" nos items deve ser o PREÇO UNITÁRIO (preço por unidade), não o total. Se no recibo diz "2x Item €8.00", o price deve ser 4.00, não 8.00
- Para cada item, tenta sempre atribuir uma "mainCategory" geral (por exemplo: 'Supermercado', 'Alimentação - Restauração', 'Compras', 'Saúde', 'Transportes', 'Serviços') adequada ao contexto do estabelecimento
- Dentro de "Supermercado", utiliza subcategorias como: 'Carne', 'Peixaria', 'Bebidas', 'Padaria', 'Fruta e Legumes', 'Limpeza e Higiene', 'Congelados', etc.
- Dentro de "Alimentação - Restauração", utiliza subcategorias como: 'Restauração - Prato', 'Restauração - Bebida', 'Restauração - Sobremesa', 'Entrada', etc.
- Dentro de "Compras", utiliza subcategorias como: 'Roupa', 'Calçado', 'Jogos', 'Utensílios', 'Equipamentos tecnológicos', 'Acessórios', etc.
- Se tiveres dúvidas, escolhe a melhor categoria possível com base na descrição, mas nunca inventes categorias completamente aleatórias
- Se não encontrares algum campo, usa null
- Os valores monetários devem ser números (sem € ou símbolos)
- A data deve estar no formato YYYY-MM-DD exatamente como aparece no recibo
- Retorna APENAS o JSON, sem texto adicional`;

    const requestBody = {
      contents: [
        {
          parts: [
            { text: prompt },
            // Enviar todas as páginas do recibo como imagens separadas
            ...imageFiles.map((file, index) => ({
              inline_data: {
                mime_type: file.type,
                data: base64Images[index],
              },
            })),
          ],
        },
      ],
    };

    // Primeiro, tentar listar modelos disponíveis para encontrar um que funcione
    let availableModel: { version: string; model: string } | null = null;
    
    try {
      // Tentar listar modelos disponíveis
      const listResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
      );
      
      if (listResponse.ok) {
        const listData = await listResponse.json();
        const models = listData.models || [];
        
        // Procurar por modelos que suportam generateContent e imagens
        for (const model of models) {
          const modelName = model.name?.replace('models/', '') || '';
          const supportsGenerateContent = model.supportedGenerationMethods?.includes('generateContent');
          const supportsImages = model.inputTokenLimit > 0; // Modelos que suportam imagens geralmente têm inputTokenLimit
          
          if (supportsGenerateContent && supportsImages && modelName) {
            // Tentar v1beta primeiro
            availableModel = { version: 'v1beta', model: modelName };
            break;
          }
        }
      }
    } catch (error) {
      console.warn('Não foi possível listar modelos disponíveis:', error);
    }

    // Se não encontrou através de ListModels, tentar modelos conhecidos
    // Baseado nas estatísticas do utilizador, v1 e v1beta estão a funcionar
    const modelsToTry = availableModel 
      ? [availableModel]
      : [
          // Tentar primeiro os modelos mais comuns que funcionam
          { version: 'v1beta', model: 'gemini-pro' },
          { version: 'v1', model: 'gemini-pro' },
          { version: 'v1beta', model: 'gemini-1.5-pro' },
          { version: 'v1', model: 'gemini-1.5-pro' },
          { version: 'v1beta', model: 'gemini-1.5-flash' },
          { version: 'v1', model: 'gemini-1.5-flash' },
        ];

    let lastError: Error | null = null;

    for (const { version, model } of modelsToTry) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          }
        );

        if (response.ok) {
          // Sucesso! Processar resposta
          const data = await response.json();
          const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
          
          // Extrair JSON da resposta (pode ter texto antes/depois)
          const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            throw new Error('Resposta da API não contém JSON válido');
          }

          const receiptJson = JSON.parse(jsonMatch[0]);
          
          // Converter para formato ReceiptData
          const receiptData: ReceiptData = {
            total: receiptJson.total || null,
            date: receiptJson.date || null,
            time: receiptJson.time || null,
            store: receiptJson.store || null,
            companyName: receiptJson.companyName || null,
            address: receiptJson.address || null,
            postalCode: receiptJson.postalCode || null,
            city: receiptJson.city || null,
            nif: receiptJson.nif || null,
            items: (receiptJson.items || []).map((item: any) => ({
              quantity: item.quantity,
              description: item.description,
              vatRate: item.vatRate,
              price: item.price,
              mainCategory: item.mainCategory ?? item.category_main ?? null,
              subCategory: item.subCategory ?? item.category_sub ?? null,
            })),
            vatSummary: receiptJson.vatSummary || [],
            paymentMethod: receiptJson.paymentMethod || null,
            rawText: textResponse,
            confidence: 0.95,
            processingTime: 0,
          };

          return receiptData;
        } else {
          // Se não for 404, pode ser outro erro (quota, etc)
          const errorData = await response.json().catch(() => ({}));
          if (response.status !== 404) {
            throw new Error(errorData.error?.message || `Erro na API: ${response.statusText}`);
          }
          // Se for 404, continuar para o próximo modelo
          lastError = new Error(`Modelo ${model} não disponível na versão ${version}`);
        }
      } catch (error) {
        // Se não for erro de modelo não encontrado, lançar imediatamente
        if (error instanceof Error && !error.message.includes('not found') && !error.message.includes('not supported')) {
          throw error;
        }
        lastError = error instanceof Error ? error : new Error('Erro desconhecido');
      }
    }

    // Se nenhum modelo funcionou, sugerir usar Tesseract ou verificar permissões
    const errorMsg = 'Nenhum modelo do Gemini está disponível com esta chave API. ' +
      'Possíveis causas: 1. A chave API não tem permissões para usar modelos do Gemini. ' +
      '2. Os modelos podem ter nomes diferentes ou requerer ativação. ' +
      '3. Tenta usar o método Tesseract.js (Local) em vez do Gemini. ' +
      `Último erro: ${lastError?.message || 'Desconhecido'}`;
    throw new Error(errorMsg);
  };

  const processReceipt = async () => {
    if (!images || images.length === 0) return;

    setIsProcessing(true);
    setProgress(0);
    setProcessingPhase('A verificar se o recibo já foi processado...');
    setExtractedText('');

    try {
      // Primeiro, tentar reutilizar um recibo já existente com as mesmas imagens
      if (user?.id) {
        setProgress(5);
        // Calcular fingerprint local das imagens (mesmo algoritmo de computeHash/buildImageFingerprint)
        const key = images
          .map((f) => `${f.name}|${f.size}|${f.lastModified}`)
          .join('||');

        if (key) {
          let hash = 0;
          for (let i = 0; i < key.length; i++) {
            const chr = key.charCodeAt(i);
            hash = (hash << 5) - hash + chr;
            hash |= 0;
          }
          const imageFingerprint = hash.toString(16);

          setProgress(10);
          setProcessingPhase('A procurar recibo existente na base de dados...');
          const { data: existing, error: existingError } = await supabase
            .from('receipts')
            .select('id, parsed_json')
            .eq('user_id', user.id)
            .eq('image_fingerprint', imageFingerprint)
            .maybeSingle();

          if (!existingError && existing?.parsed_json) {
            const fromDb = existing.parsed_json as ReceiptData;

            setProcessingPhase('Recibo encontrado! A carregar dados...');
            setProgress(90);
            
            setParsedData(fromDb);
            setEditableTotal(fromDb.total ? fromDb.total.toFixed(2) : '');
            setEditableStore(fromDb.store || fromDb.companyName || '');
            setTransactionDate(fromDb.date || new Date().toISOString().split('T')[0]);
            setReceiptId(existing.id as string);
            setExtractedText(fromDb.rawText || 'Recibo carregado do histórico');
            
            setProgress(100);
            setProcessingPhase('Recibo carregado com sucesso!');
            
            toast({
              title: 'Recibo encontrado',
              description: 'Este recibo já foi processado anteriormente. Dados carregados do histórico.',
            });
            
            setIsProcessing(false);
            return;
          }
        }
      }

      let parsed: ReceiptData;

      if (processingMethod === 'gemini') {
        setProgress(15);
        setProcessingPhase('A preparar imagens para análise...');
        
        setProgress(25);
        setProcessingPhase('A enviar para Google Gemini...');
        
        setProgress(40);
        setProcessingPhase('A processar com IA (isto pode demorar alguns segundos)...');
        
        // Simular progresso gradual enquanto processa
        const progressInterval = setInterval(() => {
          setProgress((prev) => {
            if (prev < 75) {
              return prev + 2; // Incrementar gradualmente até 75%
            }
            return prev;
          });
        }, 200); // Atualizar a cada 200ms
        
        try {
          parsed = await processReceiptWithGemini(images);
        } finally {
          clearInterval(progressInterval);
        }
        
        setProgress(80);
        setProcessingPhase('A extrair dados do recibo...');
        
        // Simular processamento de extração
        await new Promise(resolve => setTimeout(resolve, 300));
        
        setProgress(90);
        setProcessingPhase('A guardar recibo na base de dados...');
        
        setExtractedText(parsed.rawText || 'Processado com Google Gemini');
      } else {
        // Método Tesseract (original)
        setProgress(10);
        setProcessingPhase('A inicializar OCR (Tesseract.js)...');
        
        const worker = await createWorker('por', 1, {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              const progressValue = 20 + Math.round(m.progress * 60);
              setProgress(progressValue);
              setProcessingPhase(`A reconhecer texto... ${Math.round(m.progress * 100)}%`);
            }
          },
        });

        setProgress(30);
        setProcessingPhase('A processar imagens...');

        // Reconhecer texto em todas as imagens e juntar tudo
        let fullText = '';
        for (let i = 0; i < images.length; i++) {
          setProcessingPhase(`A processar imagem ${i + 1} de ${images.length}...`);
          const img = images[i];
          const { data } = await worker.recognize(img);
          fullText += (fullText ? '\n\n' : '') + data.text;
        }

        setExtractedText(fullText);

        setProgress(80);
        setProcessingPhase('A extrair dados do texto...');
        parsed = parseReceiptText(fullText);
        
        await worker.terminate();
        setProgress(90);
        setProcessingPhase('A guardar recibo na base de dados...');
      }

      setParsedData(parsed);
      
      // Preencher campos editáveis com valores extraídos
      setEditableTotal(parsed.total ? parsed.total.toFixed(2) : '');
      setEditableStore(parsed.store || parsed.companyName || '');
      setTransactionDate(parsed.date || new Date().toISOString().split('T')[0]);

      // Guardar recibo e imagens na base de dados (se autenticado)
      await saveReceipt(parsed);
      
      setProgress(100);
      setProcessingPhase('Processamento concluído!');

    } catch (error: any) {
      console.error('Erro ao processar recibo:', error);
      setProcessingPhase('Erro ao processar recibo');
      toast({
        title: 'Erro',
        description: error.message || 'Ocorreu um erro ao processar o recibo. Tenta novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
      // Manter o progresso em 100% por um momento antes de limpar
      setTimeout(() => {
        setProgress(0);
        setProcessingPhase('');
      }, 1000);
    }
  };

  const parseReceiptText = (text: string): ReceiptData => {
    const startTime = Date.now();
    let total: number | null = null;
    let date: string | null = null;
    let time: string | null = null;
    let store: string | null = null;
    let companyName: string | null = null;
    let address: string | null = null;
    let postalCode: string | null = null;
    let city: string | null = null;
    let nif: string | null = null;
    let paymentMethod: string | null = null;
    const items: ReceiptItem[] = [];
    const vatSummary: Array<{ rate: number; base: number; vat: number; total: number }> = [];

    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const textLower = text.toLowerCase();
    const fullText = text;

    // ===== EXTRAIR MONTANTE TOTAL =====
    // Procurar por padrões específicos de total
    const totalPatterns = [
      // "TOTAL: 45.67", "Total €45,67", "TOTAL 45.67€", "TOTAL A PAGAR: 45.67"
      /total[:\s]+(?:a\s+pagar[:\s]+)?(?:€\s*)?([\d\s,]+\.?\d*)\s*€?/i,
      /(?:€\s*)?([\d\s,]+\.?\d*)\s*€?\s*total/i,
      // "A PAGAR: 45.67"
      /(?:a\s+pagar|a\s+pagar[:\s]+)(?:€\s*)?([\d\s,]+\.?\d*)\s*€?/i,
      // "TOTAL GERAL: 45.67"
      /total\s+geral[:\s]+(?:€\s*)?([\d\s,]+\.?\d*)\s*€?/i,
    ];

    for (const pattern of totalPatterns) {
      const matches = text.matchAll(new RegExp(pattern, 'gi'));
      for (const match of matches) {
        const valueStr = match[1].replace(/\s/g, '').replace(',', '.');
        const value = parseFloat(valueStr);
        if (value > 0 && value < 100000 && (!total || value > total)) {
          total = value;
        }
      }
    }

    // Se não encontrou com padrões, procurar números grandes no final do texto
    // (geralmente o total aparece no final)
    if (!total) {
      const lastLines = lines.slice(-5); // Últimas 5 linhas
      const numbers = lastLines.join(' ').match(/[\d\s,]+\.?\d*/g);
      if (numbers) {
        const values = numbers
          .map(n => parseFloat(n.replace(/\s/g, '').replace(',', '.')))
          .filter(v => v > 0 && v < 100000 && v > 1); // Filtrar valores muito pequenos
        if (values.length > 0) {
          // O maior valor nas últimas linhas geralmente é o total
          total = Math.max(...values);
        }
      }
    }

    // ===== EXTRAIR DATA =====
    // Procurar por padrões de data em várias posições
    const datePatterns = [
      // DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
      /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/g,
      // YYYY/MM/DD
      /(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/g,
    ];

    const foundDates: Array<{ date: string; position: number }> = [];

    for (const pattern of datePatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        const dateStr = match[1];
        const parts = dateStr.split(/[\/\-\.]/);
        
        if (parts.length === 3) {
          let day: number, month: number, year: number;
          
          // Formato DD/MM/YYYY
          if (parts[0].length <= 2 && parts[1].length <= 2 && parts[2].length === 4) {
            day = parseInt(parts[0]);
            month = parseInt(parts[1]);
            year = parseInt(parts[2]);
          }
          // Formato YYYY/MM/DD
          else if (parts[0].length === 4 && parts[1].length <= 2 && parts[2].length <= 2) {
            year = parseInt(parts[0]);
            month = parseInt(parts[1]);
            day = parseInt(parts[2]);
          }
          // Formato DD/MM/YY (2 dígitos no ano)
          else if (parts[0].length <= 2 && parts[1].length <= 2 && parts[2].length === 2) {
            day = parseInt(parts[0]);
            month = parseInt(parts[1]);
            const yearShort = parseInt(parts[2]);
            year = yearShort < 50 ? 2000 + yearShort : 1900 + yearShort;
          }
          else {
            continue;
          }

          // Validar data
          if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 2000 && year <= 2100) {
            const dateObj = new Date(year, month - 1, day);
            if (dateObj.getDate() === day && dateObj.getMonth() === month - 1) {
              const position = match.index || 0;
              foundDates.push({
                date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
                position,
              });
            }
          }
        }
      }
    }

    // Escolher a data mais provável (geralmente aparece no início do recibo)
    if (foundDates.length > 0) {
      // Priorizar datas no início do texto (primeiro terço)
      const textLength = text.length;
      const earlyDates = foundDates.filter(d => d.position < textLength / 3);
      if (earlyDates.length > 0) {
        date = earlyDates[0].date;
      } else {
        date = foundDates[0].date;
      }
    }

    // Se não encontrou, usar data atual
    if (!date) {
      date = new Date().toISOString().split('T')[0];
    }

    // ===== EXTRAIR ESTABELECIMENTO =====
    // Procurar nas primeiras linhas (geralmente é onde está o nome)
    const firstLines = lines.slice(0, 5);
    
    // Nomes comuns de estabelecimentos portugueses
    const storeNames = [
      'continente', 'pingo doce', 'auchan', 'el corte inglés', 'leroy merlin',
      'fnac', 'worten', 'media markt', 'deco', 'jumbo', 'minipreço', 'lidl',
      'aldi', 'auchan', 'e.leclerc', 'modelo', 'pingo doce', 'recheio',
    ];

    for (const line of firstLines) {
      const lineLower = line.toLowerCase();
      
      // Procurar por nomes conhecidos
      for (const storeName of storeNames) {
        if (lineLower.includes(storeName)) {
          store = line.substring(0, 50).trim();
          break;
        }
      }
      
      if (store) break;
      
      // Se a linha parece ser um nome de estabelecimento (muitas maiúsculas, sem números)
      if (line.length > 3 && line.length < 50 && !line.match(/^\d+/) && line.match(/^[A-ZÁÉÍÓÚÇ\s&]+$/)) {
        store = line.trim();
        break;
      }
    }

    // Se não encontrou, usar primeira linha não vazia
    if (!store && lines.length > 0) {
      const firstLine = lines[0];
      // Filtrar linhas que parecem ser cabeçalhos/endereços
      if (firstLine.length > 3 && firstLine.length < 100 && !firstLine.match(/^\d+$/)) {
        store = firstLine.substring(0, 50).trim();
      }
    }

    // ===== EXTRAIR NIF =====
    const nifPattern = /nif[:\s]*(\d{9})/i;
    const nifMatch = text.match(nifPattern);
    if (nifMatch) {
      nif = nifMatch[1];
    }

    // Se encontrou NIF mas não encontrou estabelecimento, procurar nome próximo ao NIF
    if (nif && !store) {
      const nifIndex = text.indexOf(nif);
      const beforeNif = text.substring(Math.max(0, nifIndex - 100), nifIndex);
      const linesBeforeNif = beforeNif.split('\n').filter(l => l.trim().length > 0);
      if (linesBeforeNif.length > 0) {
        const lastLine = linesBeforeNif[linesBeforeNif.length - 1];
        if (lastLine.length > 3 && lastLine.length < 100) {
          store = lastLine.trim().substring(0, 50);
        }
      }
    }

    // Procurar estabelecimento em linhas com caracteres especiais (ex: "OHYO SUSHI | LOUNGE |")
    if (!store) {
      for (const line of lines) {
        // Linhas com pipes, traços, ou muitas maiúsculas geralmente são nomes de estabelecimentos
        if ((line.includes('|') || (line.includes('-') && line.match(/[A-Z]/))) && 
            line.length > 5 && line.length < 80) {
          const cleaned = line.replace(/[|]/g, '').trim();
          // Se tem pipes, geralmente é o nome comercial
          if (line.includes('|')) {
            store = cleaned.substring(0, 50);
            break;
          }
        }
      }
    }

    // Procurar nome da empresa (geralmente aparece antes do NIF)
    if (nif) {
      const nifIndex = text.indexOf(nif);
      const beforeNif = text.substring(Math.max(0, nifIndex - 200), nifIndex);
      const linesBeforeNif = beforeNif.split('\n').filter(l => l.trim().length > 0);
      
      // Procurar por padrões de nome de empresa (LDA, SA, etc.)
      for (let i = linesBeforeNif.length - 1; i >= 0; i--) {
        const line = linesBeforeNif[i];
        if (line.match(/\b(LDA|SA|LTD|UNIPESSOAL|E\.I\.|E\.I\.R\.L\.)\b/i)) {
          companyName = line.trim().substring(0, 100);
          break;
        }
      }
      
      // Se não encontrou, usar linha antes do NIF
      if (!companyName && linesBeforeNif.length > 0) {
        const lastLine = linesBeforeNif[linesBeforeNif.length - 1];
        if (lastLine.length > 5 && lastLine.length < 100 && !lastLine.match(/^\d/)) {
          companyName = lastLine.trim();
        }
      }
    }

    // ===== EXTRAIR HORA =====
    const timePattern = /(\d{1,2}):(\d{2})/;
    const timeMatch = text.match(timePattern);
    if (timeMatch) {
      time = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
    }

    // ===== EXTRAIR MORADA E CÓDIGO POSTAL =====
    // Procurar por padrões de código postal português (4 dígitos)
    const postalCodePattern = /\b(\d{4}(?:[-\s]?\d{3})?)\b/;
    const postalMatch = text.match(postalCodePattern);
    if (postalMatch) {
      postalCode = postalMatch[1].replace(/\s/g, '');
    }

    // Procurar por padrões de morada (R., Rua, Av., Avenida, etc.)
    const addressPatterns = [
      /(?:r\.|rua|avenida|av\.|travessa|trav\.)\s+([A-ZÁÉÍÓÚÇ][A-ZÁÉÍÓÚÇa-záéíóúç\s,]+?)(?:\s+\d+)?/i,
    ];
    for (const pattern of addressPatterns) {
      const match = text.match(pattern);
      if (match) {
        address = match[0].trim().substring(0, 100);
        break;
      }
    }

    // Procurar cidade (geralmente após código postal ou em linhas específicas)
    const cityPatterns = [
      /\b([A-ZÁÉÍÓÚÇ][a-záéíóúç]+(?:\s+[A-ZÁÉÍÓÚÇ][a-záéíóúç]+)*)\b/,
    ];
    // Procurar em linhas que não parecem ser itens ou totais
    for (const line of lines.slice(0, 10)) {
      if (line.length > 3 && line.length < 50 && !line.match(/^\d/) && 
          !line.toLowerCase().match(/(total|nif|iva|cliente|data)/)) {
        const cityMatch = line.match(/^([A-ZÁÉÍÓÚÇ][a-záéíóúç]+(?:\s+[A-ZÁÉÍÓÚÇ][a-záéíóúç]+)*)$/);
        if (cityMatch && !city) {
          city = cityMatch[1];
        }
      }
    }

    // ===== EXTRAIR MÉTODO DE PAGAMENTO =====
    const paymentPatterns = [
      /(?:pagamento|forma|método)[:\s]+([A-ZÁÉÍÓÚÇa-záéíóúç\s]+)/i,
      /(?:cd|cartão|dinheiro|multibanco|mbway|paypal)/i,
    ];
    for (const pattern of paymentPatterns) {
      const match = text.match(pattern);
      if (match) {
        paymentMethod = match[1] || match[0];
        break;
      }
    }

    // ===== EXTRAIR ITENS DO RECIBO =====
    // Estratégia: identificar a secção de itens (geralmente entre cabeçalho e totais)
    let itemsSectionStart = -1;
    let itemsSectionEnd = -1;
    
    // Procurar por palavras-chave que indicam início da secção de itens
    const itemsStartKeywords = ['quant', 'descri', 'item', 'produto', 'artigo'];
    const itemsEndKeywords = ['total', 'resumo', 'iva', 'tva'];
    
    for (let i = 0; i < lines.length; i++) {
      const lineLower = lines[i].toLowerCase();
      if (itemsSectionStart === -1) {
        for (const keyword of itemsStartKeywords) {
          if (lineLower.includes(keyword) && lineLower.match(/\d/)) {
            itemsSectionStart = i + 1; // Começar na linha seguinte
            break;
          }
        }
      }
      if (itemsSectionStart !== -1 && itemsSectionEnd === -1) {
        for (const keyword of itemsEndKeywords) {
          if (lineLower.includes(keyword) && lineLower.match(/total|resumo/i)) {
            itemsSectionEnd = i;
            break;
          }
        }
      }
    }

    // Se não encontrou secção, usar heurística: itens geralmente estão no meio do recibo
    if (itemsSectionStart === -1) {
      itemsSectionStart = Math.floor(lines.length * 0.2); // 20% do início
      itemsSectionEnd = Math.floor(lines.length * 0.8); // 80% do início
    }

    const itemsLines = itemsSectionEnd > itemsSectionStart 
      ? lines.slice(itemsSectionStart, itemsSectionEnd)
      : lines.slice(itemsSectionStart);

    // Padrões melhorados para extrair itens
    for (const line of itemsLines) {
      // Padrão: "quantidade descrição [IVA%] preço"
      // Exemplos:
      // "1,00 30pec.Combinados sus — 9 38,00"
      // "1,00 Agua 75c] &) 2,00"
      // "2,00 Sopa Miso 9 8,00"
      
      const itemPatterns = [
        // "1,00 Descrição — 9 38,00" (com IVA no meio)
        /^(\d+[,.]?\d*)\s+(.+?)\s+[—\-]\s*(\d+)%\s+([\d,]+\.?\d*)\s*€?$/i,
        // "1,00 Descrição 9 38,00" (IVA sem símbolo)
        /^(\d+[,.]?\d*)\s+(.+?)\s+(\d+)%\s+([\d,]+\.?\d*)\s*€?$/i,
        // "1,00 Descrição 38,00" (sem IVA visível)
        /^(\d+[,.]?\d*)\s+(.+?)\s+([\d,]+\.?\d*)\s*€?$/i,
        // "1,00 Descrição — 38,00" (com traço)
        /^(\d+[,.]?\d*)\s+(.+?)\s+[—\-]\s+([\d,]+\.?\d*)\s*€?$/i,
      ];

      for (const pattern of itemPatterns) {
        const match = line.match(pattern);
        if (match) {
          const quantity = parseFloat(match[1].replace(',', '.'));
          let description = match[2].trim();
          let vatRate: number | undefined;
          let price: number;

          // Se o padrão tem IVA
          if (match.length === 5) {
            vatRate = parseInt(match[3]);
            price = parseFloat(match[4].replace(',', '.'));
          } else {
            price = parseFloat(match[3].replace(',', '.'));
          }

          // Limpar descrição (remover caracteres estranhos do OCR)
          description = description
            .replace(/[^\w\sÁÉÍÓÚÇáéíóúç.,\-]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

          // Validar
          if (quantity > 0 && quantity < 1000 && price > 0 && price < 10000 && description.length > 2) {
            // Filtrar linhas que são claramente não-itens
            const descLower = description.toLowerCase();
            const excludePatterns = [
              /^(total|nif|iva|resumo|cliente|data|gerente|quant|descri)/i,
              /^[\d\s,€.]+$/,
              /^[A-Z\s]+$/, // Apenas maiúsculas (geralmente cabeçalhos)
            ];

            let isExcluded = false;
            for (const excludePattern of excludePatterns) {
              if (descLower.match(excludePattern)) {
                isExcluded = true;
                break;
              }
            }

            if (!isExcluded) {
              items.push({
                quantity,
                description: description.substring(0, 100),
                vatRate,
                price,
              });
              break;
            }
          }
        }
      }
    }

    // ===== EXTRAIR RESUMO DE IVA =====
    // Procurar por secção de resumo de IVA
    const vatSummaryPattern = /(\d+(?:[,.]\d+)?)%\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)/gi;
    const vatMatches = text.matchAll(vatSummaryPattern);
    for (const match of vatMatches) {
      const rate = parseFloat(match[1].replace(',', '.'));
      const base = parseFloat(match[2].replace(',', '.'));
      const vat = parseFloat(match[3].replace(',', '.'));
      const total = parseFloat(match[4].replace(',', '.'));
      
      if (rate > 0 && rate < 30 && base > 0 && vat > 0 && total > 0) {
        vatSummary.push({ rate, base, vat, total });
      }
    }

    const processingTime = Date.now() - startTime;
    const confidence = total ? (total > 0 ? 0.85 : 0.5) : 0.3;

    return {
      total,
      date,
      time,
      store,
      companyName,
      address,
      postalCode,
      city,
      nif,
      items,
      vatSummary,
      paymentMethod,
      rawText: text,
      confidence,
      processingTime,
    };
  };

  // ===== Helpers para guardar recibos na base de dados =====

  const computeHash = (input: string): string => {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const chr = input.charCodeAt(i);
      hash = (hash << 5) - hash + chr;
      hash |= 0; // Convert to 32bit integer
    }
    return hash.toString(16);
  };

  const buildImageFingerprint = (files: File[]): string | null => {
    if (!files || files.length === 0) return null;
    const key = files
      .map((f) => `${f.name}|${f.size}|${f.lastModified}`)
      .join('||');
    return computeHash(key);
  };

  const buildContentFingerprint = (receipt: ReceiptData): string | null => {
    if (!receipt.date && !receipt.total && !receipt.nif && !receipt.store) {
      return null;
    }

    const normStore = (receipt.store || '').trim().toUpperCase();
    const main = `${receipt.date || ''}|${receipt.total || 0}|${receipt.nif || ''}|${normStore}`;
    const itemsPart = (receipt.items || [])
      .slice(0, 5)
      .map((item) => {
        const desc = (item.description || '').trim().toUpperCase();
        return `${item.quantity}x${desc}:${item.price}`;
      })
      .join('|');

    return computeHash(`${main}|${itemsPart}`);
  };

  // Normalizar nome do estabelecimento para usar como nome de pasta
  const normalizeStoreName = (storeName: string | null): string => {
    if (!storeName) return 'Sem Estabelecimento';
    
    // Remover caracteres especiais e normalizar
    return storeName
      .trim()
      .replace(/[<>:"/\\|?*]/g, '') // Remover caracteres inválidos para nomes de pasta
      .replace(/\s+/g, ' ') // Normalizar espaços múltiplos
      .trim();
  };

  // Gerar nome do ficheiro: "DD-MM-YYYY.ext" (sem nome do estabelecimento, já está na pasta)
  const generateFileName = (storeName: string | null, date: string | null, index: number, ext: string): string => {
    let dateStr = '';
    
    if (date) {
      try {
        const d = new Date(date);
        // Usar hífens em vez de barras para evitar criar pastas
        dateStr = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
      } catch (e) {
        // Se a data não for válida, usar data atual
        const now = new Date();
        dateStr = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
      }
    } else {
      // Se não houver data, usar data atual
      const now = new Date();
      dateStr = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
    }
    
    // Se houver múltiplas páginas, adicionar número antes da extensão
    const pageSuffix = images.length > 1 ? `-pagina-${index + 1}` : '';
    
    return `${dateStr}${pageSuffix}.${ext}`;
  };

  const saveReceipt = async (receipt: ReceiptData): Promise<string | null> => {
    if (!user?.id) return null;

    try {
      const imageFingerprint = buildImageFingerprint(images);
      const contentFingerprint = buildContentFingerprint(receipt);

      // Verificar se já existe recibo com as MESMAS imagens para este utilizador
      if (imageFingerprint) {
        const { data: existing, error: existingError } = await supabase
          .from('receipts')
          .select('id')
          .eq('user_id', user.id)
          .eq('image_fingerprint', imageFingerprint)
          .maybeSingle();

        if (existingError && existingError.code !== 'PGRST116') {
          console.error('Erro ao verificar recibo existente:', existingError);
        }

        if (existing?.id) {
          // Recibo duplicado encontrado - verificar se as imagens existem
          const existingId = existing.id;
          
          // Verificar se as imagens já foram carregadas
          const { data: existingImages } = await supabase
            .from('receipt_images')
            .select('id')
            .eq('receipt_id', existingId);
          
          // Se não houver imagens, fazer upload agora
          if (!existingImages || existingImages.length === 0) {
            // Buscar dados do recibo existente para obter o nome do estabelecimento
            const { data: existingReceipt } = await supabase
              .from('receipts')
              .select('store, date')
              .eq('id', existingId)
              .single();
            
            const storeName = existingReceipt?.store || null;
            const receiptDate = existingReceipt?.date || null;
            
            const uploads = images.map(async (file, index) => {
              const ext =
                file.type === 'image/png'
                  ? 'png'
                  : file.type === 'image/gif'
                  ? 'gif'
                  : file.type === 'image/webp'
                  ? 'webp'
                  : 'jpg';

              const normalizedStore = normalizeStoreName(storeName);
              const fileName = generateFileName(storeName, receiptDate, index, ext);
              const path = `${user.id}/${normalizedStore}/${fileName}`;

              const { error: uploadError } = await supabase.storage
                .from('receipts')
                .upload(path, file, {
                  contentType: file.type,
                  upsert: true, // Permitir sobrescrever se já existir
                });

              if (uploadError) {
                console.error('Erro ao fazer upload da imagem do recibo:', uploadError);
                return;
              }

              const { error: imgInsertError } = await supabase
                .from('receipt_images')
                .insert({
                  receipt_id: existingId,
                  page_number: index + 1,
                  storage_path: path,
                  mime_type: file.type,
                  size_bytes: file.size,
                });

              if (imgInsertError) {
                console.error('Erro ao registar imagem do recibo:', imgInsertError);
              }
            });

            await Promise.all(uploads);
          }
          
          setReceiptId(existingId);
          return existingId;
        }
      }

      // Criar novo recibo
      const { data: newReceipt, error: insertError } = await supabase
        .from('receipts')
        .insert({
          user_id: user.id,
          total: receipt.total,
          currency: 'EUR',
          date: receipt.date,
          time: receipt.time,
          store: receipt.store,
          company_name: receipt.companyName,
          address: receipt.address,
          postal_code: receipt.postalCode,
          city: receipt.city,
          nif: receipt.nif,
          payment_method: receipt.paymentMethod,
          raw_text: receipt.rawText,
          parsed_json: receipt as any,
          image_fingerprint: imageFingerprint,
          content_fingerprint: contentFingerprint,
        })
        .select('id')
        .single();

      if (insertError || !newReceipt?.id) {
        console.error('Erro ao guardar recibo:', insertError);
        toast({
          title: 'Erro ao guardar recibo',
          description: 'O recibo foi processado, mas não foi possível guardá-lo na base de dados.',
          variant: 'destructive',
        });
        return null;
      }

      const newReceiptId = newReceipt.id as string;

      // Normalizar nome do estabelecimento para usar como pasta
      const normalizedStore = normalizeStoreName(receipt.store || receipt.companyName);

      // Fazer upload das imagens para o bucket "receipts" e registar em receipt_images
      const uploads = images.map(async (file, index) => {
        const ext =
          file.type === 'image/png'
            ? 'png'
            : file.type === 'image/gif'
            ? 'gif'
            : file.type === 'image/webp'
            ? 'webp'
            : 'jpg';

        // Nova estrutura: user_id/estabelecimento/nome_estabelecimento - data.ext
        const fileName = generateFileName(receipt.store || receipt.companyName, receipt.date, index, ext);
        const path = `${user.id}/${normalizedStore}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(path, file, {
            contentType: file.type,
            upsert: false, // Não sobrescrever - se já existir, dar erro
          });

        if (uploadError) {
          // Se o erro for que o ficheiro já existe, continuar (pode ter sido criado anteriormente)
          if (uploadError.message?.includes('already exists') || uploadError.statusCode === '409') {
            console.warn('Imagem já existe no bucket:', path);
          } else {
            console.error('Erro ao fazer upload da imagem do recibo:', uploadError);
            toast({
              title: 'Aviso',
              description: `Erro ao fazer upload da imagem ${index + 1}: ${uploadError.message}`,
              variant: 'destructive',
            });
            return;
          }
        }

        const { error: imgInsertError } = await supabase
          .from('receipt_images')
          .insert({
            receipt_id: newReceiptId,
            page_number: index + 1,
            storage_path: path,
            mime_type: file.type,
            size_bytes: file.size,
          });

        if (imgInsertError) {
          console.error('Erro ao registar imagem do recibo:', imgInsertError);
        }
      });

      await Promise.all(uploads);

      setReceiptId(newReceiptId);
      return newReceiptId;
    } catch (error) {
      console.error('Erro inesperado ao guardar recibo:', error);
      toast({
        title: 'Erro ao guardar recibo',
        description: 'O recibo foi processado, mas ocorreu um erro ao guardá-lo.',
        variant: 'destructive',
      });
      return null;
    }
  };

  const handleCreateTransaction = async () => {
    const totalValue = parseFloat(editableTotal.replace(',', '.'));
    
    if (!selectedCategory || !totalValue || totalValue <= 0) {
      toast({
        title: 'Erro',
        description: 'Preenche todos os campos obrigatórios (categoria e montante).',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Usar a data extraída do recibo, se disponível, senão usar a data editável
      // parsedData.date já está no formato YYYY-MM-DD
      const finalDate = (parsedData && parsedData.date) ? parsedData.date : transactionDate;
      
      await createTransaction.mutateAsync({
        category_id: selectedCategory,
        amount: totalValue,
        description: editableStore || 'Recibo processado',
        type: 'expense',
        date: finalDate,
        // Nota: receipt_id não existe na tabela transactions, por isso não é incluído
      });

      toast({
        title: 'Transação criada!',
        description: 'A transação foi criada com sucesso a partir do recibo.',
      });

      // Limpar estado
      setImages([]);
      setImagePreviews([]);
      setExtractedText('');
      setParsedData(null);
      setSelectedCategory('');
      setEditableTotal('');
      setEditableStore('');
      setReceiptId(null);
      setIsConfirmDialogOpen(false);
    } catch (error) {
      console.error('Erro ao criar transação:', error);
      toast({
        title: 'Erro',
        description: 'Ocorreu um erro ao criar a transação.',
        variant: 'destructive',
      });
    }
  };

  const handleReset = () => {
    setImages([]);
    setImagePreviews([]);
    setExtractedText('');
    setParsedData(null);
    setSelectedCategory('');
    setEditableTotal('');
    setEditableStore('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="bg-card rounded-xl border p-6 shadow-card">
      <div className="mb-6">
        <h2 className="font-display font-semibold text-xl mb-2">OCR de Recibos</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Faz upload de uma foto de um recibo e extrai automaticamente o montante, data e estabelecimento.
        </p>

        {/* Método de Processamento */}
        <div className="space-y-3 mb-4">
          <Label htmlFor="processing-method">Método de Análise</Label>
          <Select
            value={processingMethod}
            onValueChange={(value) => setProcessingMethod(value as ProcessingMethod)}
          >
            <SelectTrigger id="processing-method">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tesseract">
                Tesseract.js (Local - Gratuito)
              </SelectItem>
              <SelectItem value="gemini">
                Google Gemini
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {processingMethod === 'tesseract' 
              ? 'Processamento local, mais rápido mas menos preciso.'
              : 'Análise por IA, mais precisa e entende melhor a estrutura do recibo.'}
          </p>
        </div>

      </div>

      {/* Upload Area */}
      {imagePreviews.length === 0 ? (
        <div className="border-2 border-dashed border-border rounded-lg p-12 text-center hover:border-primary/50 transition-colors">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
            multiple
            onChange={(e) => {
              const files = e.target.files;
              if (files && files.length > 0) {
                handleImageSelect(files);
              }
            }}
            className="hidden"
            id="receipt-upload"
          />
          <label
            htmlFor="receipt-upload"
            className="cursor-pointer flex flex-col items-center gap-4"
          >
            <div className="p-4 rounded-full bg-primary/10">
              <Upload className="w-8 h-8 text-primary" />
            </div>
            <div>
              <p className="font-medium mb-1">Clica para fazer upload de um recibo</p>
              <p className="text-sm text-muted-foreground">
                ou arrasta e solta uma imagem aqui
              </p>
            </div>
            <Button type="button" variant="outline" className="gap-2">
              <Camera className="w-4 h-4" />
              Selecionar Imagem
            </Button>
          </label>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Image Preview */}
          <div className="relative space-y-4 max-h-[32rem] overflow-y-auto">
            {imagePreviews.map((preview, index) => (
              <div key={index} className="relative">
                <img
                  src={preview}
                  alt={`Preview do recibo - página ${index + 1}`}
                  className="w-full max-h-96 object-contain rounded-lg border"
                />
                {index === 0 && (
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={handleReset}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          {/* Process Button */}
          {!isProcessing && !extractedText && (
            <Button
              onClick={processReceipt}
              className="w-full gap-2"
              disabled={images.length === 0}
            >
              <Upload className="w-4 h-4" />
              Processar Recibo
            </Button>
          )}

          {/* Processing State */}
          {isProcessing && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <div className="flex-1">
                  <div className="font-medium">{processingPhase || 'A processar recibo...'}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{progress}% concluído</div>
                </div>
                <span className="text-sm font-semibold text-primary">{progress}%</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-3 overflow-hidden">
                <motion.div
                  className="bg-gradient-primary h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                />
              </div>
            </div>
          )}

          {/* Parsed Data */}
          {parsedData && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className={`border rounded-lg p-4 ${parsedData.total ? 'bg-card' : 'bg-destructive/10 border-destructive/20'}`}>
                      <p className="text-xs text-muted-foreground mb-1">Montante Total</p>
                      <p className={`font-display font-semibold text-lg ${parsedData.total ? '' : 'text-destructive'}`}>
                        {parsedData.total ? `€${parsedData.total.toFixed(2)}` : '⚠️ Não encontrado'}
                      </p>
                    </div>
                    <div className={`border rounded-lg p-4 ${parsedData.date ? 'bg-card' : 'bg-destructive/10 border-destructive/20'}`}>
                      <p className="text-xs text-muted-foreground mb-1">Data</p>
                      <p className={`font-semibold ${parsedData.date ? '' : 'text-destructive'}`}>
                        {parsedData.date
                          ? new Date(parsedData.date).toLocaleDateString('pt-PT')
                          : '⚠️ Não encontrada'}
                      </p>
                      {parsedData.time && (
                        <p className="text-xs text-muted-foreground mt-1">Hora: {parsedData.time}</p>
                      )}
                    </div>
                    <div className={`border rounded-lg p-4 ${parsedData.store ? 'bg-card' : 'bg-destructive/10 border-destructive/20'}`}>
                      <p className="text-xs text-muted-foreground mb-1">Estabelecimento</p>
                      <p className={`font-semibold truncate ${parsedData.store ? '' : 'text-destructive'}`}>
                        {parsedData.store || parsedData.companyName || '⚠️ Não encontrado'}
                      </p>
                      {parsedData.companyName && parsedData.companyName !== parsedData.store && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">{parsedData.companyName}</p>
                      )}
                      {parsedData.nif && (
                        <p className="text-xs text-muted-foreground mt-1">NIF: {parsedData.nif}</p>
                      )}
                    </div>
                    <div className={`border rounded-lg p-4 ${parsedData.address || parsedData.city ? 'bg-card' : 'bg-secondary/50'}`}>
                      <p className="text-xs text-muted-foreground mb-1">Localização</p>
                      {parsedData.address && (
                        <p className="text-xs font-medium truncate">{parsedData.address}</p>
                      )}
                      {parsedData.postalCode && (
                        <p className="text-xs text-muted-foreground">{parsedData.postalCode}</p>
                      )}
                      {parsedData.city && (
                        <p className="text-xs text-muted-foreground">{parsedData.city}</p>
                      )}
                      {!parsedData.address && !parsedData.city && (
                        <p className="text-xs text-muted-foreground">Não encontrada</p>
                      )}
                    </div>
                  </div>

                  {/* Items List */}
                  {parsedData.items.length > 0 && (
                    <div className="border rounded-lg p-4 bg-card">
                      <h4 className="font-semibold mb-3 text-sm">Itens Extraídos ({parsedData.items.length})</h4>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {parsedData.items.map((item, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-2 rounded bg-secondary/50 text-sm"
                          >
                            <div className="flex-1 min-w-0">
                              <span className="font-medium text-muted-foreground mr-2">
                                {item.quantity}x
                              </span>
                              <span className="font-medium">{item.description}</span>
                              {item.vatRate && (
                                <span className="text-xs text-muted-foreground ml-2">
                                  (IVA {item.vatRate}%)
                                </span>
                              )}
                              {(item.mainCategory || item.subCategory) && (
                                <div className="text-xs text-muted-foreground mt-0.5 truncate">
                                  {item.mainCategory}
                                  {item.subCategory &&
                                    item.subCategory !== item.mainCategory && (
                                      <span>{` • ${item.subCategory}`}</span>
                                    )}
                                </div>
                              )}
                            </div>
                            <span className="font-display font-semibold ml-4">
                              €{(item.price * item.quantity).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 pt-3 border-t space-y-1 text-xs text-muted-foreground">
                        <p>
                          Total dos itens: €{parsedData.items.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2)}
                          {parsedData.total && (
                            <span className="ml-2">
                              (Total do recibo: €{parsedData.total.toFixed(2)})
                            </span>
                          )}
                        </p>
                        {parsedData.paymentMethod && (
                          <p>Método de pagamento: {parsedData.paymentMethod}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* VAT Summary */}
                  {parsedData.vatSummary.length > 0 && (
                    <div className="border rounded-lg p-4 bg-card">
                      <h4 className="font-semibold mb-3 text-sm">Resumo de IVA</h4>
                      <div className="space-y-2">
                        {parsedData.vatSummary.map((vat, index) => (
                          <div key={index} className="flex items-center justify-between p-2 rounded bg-secondary/50 text-sm">
                            <span className="font-medium">IVA {vat.rate}%</span>
                            <div className="flex gap-4 text-xs text-muted-foreground">
                              <span>Base: €{vat.base.toFixed(2)}</span>
                              <span>IVA: €{vat.vat.toFixed(2)}</span>
                              <span className="font-semibold text-foreground">Total: €{vat.total.toFixed(2)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Debug Info */}
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>Confiança: {Math.round(parsedData.confidence * 100)}%</p>
                    <p>Tempo de processamento: {parsedData.processingTime}ms</p>
                    {parsedData.items.length === 0 && (
                      <p className="text-muted-foreground text-xs">
                        💡 Nenhum item individual foi extraído. Apenas o total será usado.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              {parsedData && (
                <div className="flex gap-2">
                  <Button
                    onClick={() => setIsConfirmDialogOpen(true)}
                    className="flex-1 gap-2"
                    disabled={!parsedData.total}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Criar Transação
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleReset}
                  >
                    Novo Recibo
                  </Button>
                </div>
              )}
            </div>
          )}

      {/* Confirmation Dialog */}
      <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Transação a partir do Recibo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {parsedData && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="total">Montante *</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                      <Input
                        id="total"
                        type="text"
                        value={editableTotal}
                        onChange={(e) => {
                          // Permitir apenas números, vírgula e ponto
                          const value = e.target.value.replace(/[^\d,.]/g, '');
                          setEditableTotal(value);
                        }}
                        placeholder="0.00"
                        className="pl-8"
                      />
                    </div>
                    {parsedData.total && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Sugerido: €{parsedData.total.toFixed(2)}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="date">Data *</Label>
                    <Input
                      id="date"
                      type="date"
                      value={transactionDate}
                      onChange={(e) => setTransactionDate(e.target.value)}
                    />
                    {parsedData.date && parsedData.date !== transactionDate && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Extraída: {new Date(parsedData.date).toLocaleDateString('pt-PT')}
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  <Label htmlFor="store">Estabelecimento</Label>
                  <Input
                    id="store"
                    value={editableStore}
                    onChange={(e) => setEditableStore(e.target.value)}
                    placeholder="Nome do estabelecimento"
                  />
                  {parsedData.store && parsedData.store !== editableStore && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Sugerido: {parsedData.store}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="category">Categoria *</Label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger id="category">
                      <SelectValue placeholder="Seleciona categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {expenseCategories && (() => {
                        const groups: Record<string, typeof expenseCategories> = {};
                        expenseCategories.forEach((cat) => {
                          const group = cat.category_group || 'general_expenses';
                          if (!groups[group]) groups[group] = [];
                          groups[group].push(cat);
                        });
                        const groupOrder: string[] = ['fixed_expenses', 'general_expenses', 'optional_expenses', 'savings_investments'];
                        const groupLabels: Record<string, string> = {
                          fixed_expenses: 'Despesas Fixas',
                          general_expenses: 'Despesas Gerais',
                          optional_expenses: 'Despesas Opcionais',
                          savings_investments: 'Poupança / Investimentos',
                        };
                        return groupOrder.map((group) => {
                          const cats = groups[group];
                          if (!cats || cats.length === 0) return null;
                          return (
                            <div key={group}>
                              <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                                {groupLabels[group]}
                              </div>
                              {cats.map((cat) => (
                                <SelectItem key={cat.id} value={cat.id}>
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="w-3 h-3 rounded-full"
                                      style={{ backgroundColor: cat.color || '#ef4444' }}
                                    />
                                    <span>{cat.name}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </div>
                          );
                        });
                      })()}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsConfirmDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateTransaction}
              disabled={!selectedCategory || !editableTotal || createTransaction.isPending}
            >
              {createTransaction.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  A criar...
                </>
              ) : (
                'Criar Transação'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
