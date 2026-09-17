import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Receipt, Calendar, Store, MapPin, FileText, Image as ImageIcon, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface ReceiptImage {
  id: string;
  page_number: number;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
}

interface ReceiptRecord {
  id: string;
  total: number | null;
  date: string | null;
  time: string | null;
  store: string | null;
  company_name: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  nif: string | null;
  payment_method: string | null;
  created_at: string;
  receipt_images: ReceiptImage[];
  parsed_json: any;
}

interface ReceiptViewerProps {
  transactionId: string;
  transactionAmount: number;
  transactionDate: string;
  transactionDescription: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReceiptViewer({
  transactionId,
  transactionAmount,
  transactionDate,
  transactionDescription,
  open,
  onOpenChange,
}: ReceiptViewerProps) {
  const { user } = useAuth();
  const [imageUrls, setImageUrls] = useState<Record<string, string[]>>({});

  // Procurar recibo que corresponda à transação
  const { data: receipt, isLoading } = useQuery({
    queryKey: ['receipt-for-transaction', transactionId, transactionAmount, transactionDate],
    queryFn: async () => {
      if (!user?.id) return null;

      // Procurar recibos que correspondam à transação
      // Critérios: mesmo utilizador, mesmo montante (aproximado), mesma data
      const { data, error } = await supabase
        .from('receipts')
        .select(`
          *,
          receipt_images (
            id,
            page_number,
            storage_path,
            mime_type,
            size_bytes
          )
        `)
        .eq('user_id', user.id)
        .eq('date', transactionDate)
        .gte('total', transactionAmount - 0.01) // Tolerância de 1 cêntimo
        .lte('total', transactionAmount + 0.01)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Erro ao procurar recibo:', error);
        return null;
      }

      return (data || null) as ReceiptRecord | null;
    },
    enabled: open && !!user?.id,
  });

  // Carregar URLs das imagens
  useEffect(() => {
    if (!receipt || !receipt.receipt_images || receipt.receipt_images.length === 0) {
      setImageUrls({});
      return;
    }

    const loadImageUrls = async () => {
      const urls: string[] = [];
      
      for (const img of receipt.receipt_images) {
        const { data } = await supabase.storage
          .from('receipts')
          .createSignedUrl(img.storage_path, 3600);
        
        if (data?.signedUrl) {
          urls.push(data.signedUrl);
        }
      }
      
      setImageUrls({ [receipt.id]: urls });
    };

    loadImageUrls();
  }, [receipt]);

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Recibo da Transação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!receipt) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Recibo não encontrado</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Não foi encontrado um recibo associado a esta transação.
          </p>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            Recibo da Transação
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informações Principais */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-semibold flex items-center gap-2">
                <Store className="w-4 h-4" />
                Estabelecimento
              </h4>
              <p>{receipt.store || receipt.company_name || 'Não especificado'}</p>
            </div>
            {receipt.total && (
              <div className="space-y-2">
                <h4 className="font-semibold">Montante Total</h4>
                <p className="text-2xl font-bold text-primary">
                  {formatCurrency(receipt.total)}
                </p>
              </div>
            )}
            {receipt.date && (
              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Data e Hora
                </h4>
                <p>
                  {new Date(receipt.date).toLocaleDateString('pt-PT', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                  {receipt.time && ` • ${receipt.time}`}
                </p>
              </div>
            )}
            {receipt.nif && (
              <div className="space-y-2">
                <h4 className="font-semibold">NIF</h4>
                <p>{receipt.nif}</p>
              </div>
            )}
          </div>

          {/* Localização */}
          {(receipt.address || receipt.city) && (
            <div className="space-y-2">
              <h4 className="font-semibold flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Localização
              </h4>
              <p>
                {receipt.address && <span>{receipt.address}</span>}
                {receipt.postal_code && <span> {receipt.postal_code}</span>}
                {receipt.city && <span>, {receipt.city}</span>}
              </p>
            </div>
          )}

          {/* Imagens */}
          {receipt.receipt_images && receipt.receipt_images.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-semibold flex items-center gap-2">
                <ImageIcon className="w-4 h-4" />
                Imagens do Recibo ({receipt.receipt_images.length})
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {imageUrls[receipt.id]?.map((url, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={url}
                      alt={`Página ${index + 1} do recibo`}
                      className="w-full rounded-lg border shadow-sm"
                    />
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = url;
                          link.download = `recibo-${receipt.id}-pagina-${index + 1}.jpg`;
                          link.click();
                        }}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Itens Extraídos */}
          {receipt.parsed_json?.items && 
           Array.isArray(receipt.parsed_json.items) && 
           receipt.parsed_json.items.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Itens Extraídos ({receipt.parsed_json.items.length})
              </h4>
              <div className="border rounded-lg divide-y max-h-60 overflow-y-auto">
                {receipt.parsed_json.items.map((item: any, index: number) => (
                  <div key={index} className="p-3 flex items-center justify-between">
                    <div className="flex-1">
                      <span className="text-muted-foreground mr-2">
                        {item.quantity}x
                      </span>
                      <span className="font-medium">{item.description}</span>
                      {item.vatRate && (
                        <span className="text-xs text-muted-foreground ml-2">
                          (IVA {item.vatRate}%)
                        </span>
                      )}
                      {(item.mainCategory || item.subCategory) && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {item.mainCategory && <span>{item.mainCategory}</span>}
                          {item.mainCategory && item.subCategory && <span> • </span>}
                          {item.subCategory && <span>{item.subCategory}</span>}
                        </div>
                      )}
                    </div>
                    <div className="font-semibold ml-4">
                      {formatCurrency(item.price)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Resumo IVA */}
          {receipt.parsed_json?.vatSummary && 
           Array.isArray(receipt.parsed_json.vatSummary) && 
           receipt.parsed_json.vatSummary.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-semibold">Resumo de IVA</h4>
              <div className="border rounded-lg divide-y">
                {receipt.parsed_json.vatSummary.map((vat: any, index: number) => (
                  <div key={index} className="p-3 flex items-center justify-between">
                    <span>IVA {vat.rate}%</span>
                    <div className="text-right">
                      <div>Base: {formatCurrency(vat.base)}</div>
                      <div className="text-sm text-muted-foreground">
                        IVA: {formatCurrency(vat.vat)} | Total: {formatCurrency(vat.total)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
