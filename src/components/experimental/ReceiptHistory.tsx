import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Receipt, 
  Calendar, 
  Store, 
  MapPin, 
  FileText, 
  Image as ImageIcon,
  Download,
  Eye,
  X,
  Trash2,
  Loader2
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { formatCurrency } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

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

export function ReceiptHistory() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptRecord | null>(null);
  const [imageUrls, setImageUrls] = useState<Record<string, string[]>>({});
  const [receiptToDelete, setReceiptToDelete] = useState<ReceiptRecord | null>(null);

  const { data: receipts, isLoading } = useQuery({
    queryKey: ['receipts', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

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
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as ReceiptRecord[];
    },
    enabled: !!user?.id,
  });

  // Carregar URLs das imagens quando os recibos são carregados
  useEffect(() => {
    if (!receipts || receipts.length === 0) return;

    const loadImageUrls = async () => {
      const urls: Record<string, string[]> = {};

      for (const receipt of receipts) {
        if (receipt.receipt_images && receipt.receipt_images.length > 0) {
          const receiptUrls: string[] = [];
          
          for (const img of receipt.receipt_images) {
            const { data } = await supabase.storage
              .from('receipts')
              .createSignedUrl(img.storage_path, 3600); // URL válida por 1 hora
            
            if (data?.signedUrl) {
              receiptUrls.push(data.signedUrl);
            }
          }
          
          urls[receipt.id] = receiptUrls;
        }
      }

      setImageUrls(urls);
    };

    loadImageUrls();
  }, [receipts]);

  // Mutation para eliminar recibo
  const deleteReceipt = useMutation({
    mutationFn: async (receipt: ReceiptRecord) => {
      if (!user?.id) throw new Error('Not authenticated');

      // 1. Eliminar imagens do storage bucket
      if (receipt.receipt_images && receipt.receipt_images.length > 0) {
        const pathsToDelete = receipt.receipt_images.map(img => img.storage_path);
        
        const { error: deleteError } = await supabase.storage
          .from('receipts')
          .remove(pathsToDelete);

        if (deleteError) {
          console.error('Erro ao eliminar imagens do storage:', deleteError);
          // Continuar mesmo se houver erro (pode ser que as imagens já não existam)
        }
      }

      // 2. Eliminar o recibo (as imagens em receipt_images serão eliminadas automaticamente por CASCADE)
      const { error: deleteReceiptError } = await supabase
        .from('receipts')
        .delete()
        .eq('id', receipt.id)
        .eq('user_id', user.id);

      if (deleteReceiptError) {
        throw deleteReceiptError;
      }
    },
    onSuccess: () => {
      // Invalidar a query para atualizar a lista
      queryClient.invalidateQueries({ queryKey: ['receipts', user?.id] });
      setReceiptToDelete(null);
      setSelectedReceipt(null); // Fechar dialog se estiver aberto
      toast({
        title: 'Recibo eliminado',
        description: 'O recibo e todas as imagens associadas foram eliminados com sucesso.',
      });
    },
    onError: (error: any) => {
      console.error('Erro ao eliminar recibo:', error);
      toast({
        title: 'Erro ao eliminar recibo',
        description: error.message || 'Ocorreu um erro ao eliminar o recibo.',
        variant: 'destructive',
      });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (!receipts || receipts.length === 0) {
    return (
      <div className="text-center py-12">
        <Receipt className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Ainda não há recibos processados.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {receipts.map((receipt) => (
        <Card key={receipt.id} className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-primary" />
                  {receipt.store || receipt.company_name || 'Recibo sem estabelecimento'}
                </CardTitle>
                <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
                  {receipt.total && (
                    <span className="font-semibold text-foreground">
                      {formatCurrency(receipt.total)}
                    </span>
                  )}
                  {receipt.date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {new Date(receipt.date).toLocaleDateString('pt-PT')}
                      {receipt.time && ` • ${receipt.time}`}
                    </span>
                  )}
                  {receipt.receipt_images && receipt.receipt_images.length > 0 && (
                    <span className="flex items-center gap-1">
                      <ImageIcon className="w-4 h-4" />
                      {receipt.receipt_images.length} {receipt.receipt_images.length === 1 ? 'imagem' : 'imagens'}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedReceipt(receipt)}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Ver Detalhes
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setReceiptToDelete(receipt)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {receipt.nif && (
                <div>
                  <span className="text-muted-foreground">NIF: </span>
                  <span className="font-medium">{receipt.nif}</span>
                </div>
              )}
              {(receipt.address || receipt.city) && (
                <div className="flex items-start gap-1">
                  <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <span>
                    {receipt.address && <span>{receipt.address}</span>}
                    {receipt.postal_code && <span> {receipt.postal_code}</span>}
                    {receipt.city && <span>, {receipt.city}</span>}
                  </span>
                </div>
              )}
              {receipt.payment_method && (
                <div>
                  <span className="text-muted-foreground">Método de pagamento: </span>
                  <span className="font-medium">{receipt.payment_method}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Dialog de Detalhes */}
      <Dialog open={!!selectedReceipt} onOpenChange={(open) => !open && setSelectedReceipt(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5" />
              Detalhes do Recibo
            </DialogTitle>
          </DialogHeader>

          {selectedReceipt && (
            <div className="space-y-6">
              {/* Informações Principais */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Store className="w-4 h-4" />
                    Estabelecimento
                  </h4>
                  <p>{selectedReceipt.store || selectedReceipt.company_name || 'Não especificado'}</p>
                </div>
                {selectedReceipt.total && (
                  <div className="space-y-2">
                    <h4 className="font-semibold">Montante Total</h4>
                    <p className="text-2xl font-bold text-primary">
                      {formatCurrency(selectedReceipt.total)}
                    </p>
                  </div>
                )}
                {selectedReceipt.date && (
                  <div className="space-y-2">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Data e Hora
                    </h4>
                    <p>
                      {new Date(selectedReceipt.date).toLocaleDateString('pt-PT', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                      {selectedReceipt.time && ` • ${selectedReceipt.time}`}
                    </p>
                  </div>
                )}
                {selectedReceipt.nif && (
                  <div className="space-y-2">
                    <h4 className="font-semibold">NIF</h4>
                    <p>{selectedReceipt.nif}</p>
                  </div>
                )}
              </div>

              {/* Localização */}
              {(selectedReceipt.address || selectedReceipt.city) && (
                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Localização
                  </h4>
                  <p>
                    {selectedReceipt.address && <span>{selectedReceipt.address}</span>}
                    {selectedReceipt.postal_code && <span> {selectedReceipt.postal_code}</span>}
                    {selectedReceipt.city && <span>, {selectedReceipt.city}</span>}
                  </p>
                </div>
              )}

              {/* Imagens */}
              {selectedReceipt.receipt_images && selectedReceipt.receipt_images.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    <ImageIcon className="w-4 h-4" />
                    Imagens do Recibo ({selectedReceipt.receipt_images.length})
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {imageUrls[selectedReceipt.id]?.map((url, index) => (
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
                              link.download = `recibo-${selectedReceipt.id}-pagina-${index + 1}.jpg`;
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
              {selectedReceipt.parsed_json?.items && 
               Array.isArray(selectedReceipt.parsed_json.items) && 
               selectedReceipt.parsed_json.items.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Itens Extraídos ({selectedReceipt.parsed_json.items.length})
                  </h4>
                  <div className="border rounded-lg divide-y max-h-60 overflow-y-auto">
                    {selectedReceipt.parsed_json.items.map((item: any, index: number) => (
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
              {selectedReceipt.parsed_json?.vatSummary && 
               Array.isArray(selectedReceipt.parsed_json.vatSummary) && 
               selectedReceipt.parsed_json.vatSummary.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold">Resumo de IVA</h4>
                  <div className="border rounded-lg divide-y">
                    {selectedReceipt.parsed_json.vatSummary.map((vat: any, index: number) => (
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

              {/* Data de Processamento */}
              <div className="text-xs text-muted-foreground pt-4 border-t">
                Processado em: {new Date(selectedReceipt.created_at).toLocaleString('pt-PT')}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSelectedReceipt(null)}
            >
              Fechar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setReceiptToDelete(selectedReceipt);
                setSelectedReceipt(null);
              }}
              disabled={deleteReceipt.isPending}
            >
              {deleteReceipt.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  A eliminar...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Eliminar Recibo
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação de Eliminação */}
      <AlertDialog open={!!receiptToDelete} onOpenChange={(open) => !open && setReceiptToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Recibo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Isto irá eliminar permanentemente:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>O recibo e todos os dados extraídos</li>
                <li>Todas as imagens associadas ({receiptToDelete?.receipt_images?.length || 0} {receiptToDelete?.receipt_images?.length === 1 ? 'imagem' : 'imagens'})</li>
                <li>O histórico de processamento</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteReceipt.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => receiptToDelete && deleteReceipt.mutate(receiptToDelete)}
              disabled={deleteReceipt.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteReceipt.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  A eliminar...
                </>
              ) : (
                'Eliminar'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
