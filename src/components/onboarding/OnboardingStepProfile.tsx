import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User } from 'lucide-react';
import type { OnboardingData } from '@/pages/Onboarding';

interface Props {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
}

export function OnboardingStepProfile({ data, updateData }: Props) {
  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <div className="w-20 h-20 rounded-full bg-gradient-primary mx-auto flex items-center justify-center mb-4">
          <User className="w-10 h-10 text-primary-foreground" />
        </div>
        <p className="text-muted-foreground">
          Vamos começar! Como te podemos chamar?
        </p>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="name">O teu nome</Label>
        <Input
          id="name"
          value={data.name}
          onChange={(e) => updateData({ name: e.target.value })}
          placeholder="Ex: João"
          className="text-lg"
          autoFocus
        />
        <p className="text-sm text-muted-foreground">
          Este nome será usado para personalizar a tua experiência
        </p>
      </div>
    </div>
  );
}
