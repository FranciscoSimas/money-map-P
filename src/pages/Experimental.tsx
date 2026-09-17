import { Layout } from '@/components/layout/Layout';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { ReceiptOCR } from '@/components/experimental/ReceiptOCR';
import { ReceiptHistory } from '@/components/experimental/ReceiptHistory';
import { Beaker } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Experimental() {
  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-primary/10">
            <Beaker className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl lg:text-3xl font-bold">Experimental</h1>
            <p className="text-muted-foreground mt-1">
              Funcionalidades em teste e desenvolvimento
            </p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="process" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="process">Processar Recibo</TabsTrigger>
            <TabsTrigger value="history">Histórico</TabsTrigger>
          </TabsList>
          
          <TabsContent value="process" className="mt-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <ReceiptOCR />
            </motion.div>
          </TabsContent>
          
          <TabsContent value="history" className="mt-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <ReceiptHistory />
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
