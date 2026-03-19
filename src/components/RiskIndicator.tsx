import { ShieldCheck, ShieldAlert, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RiskIndicatorProps {
  level: 'low' | 'medium' | 'high';
}

const RiskIndicator = ({ level }: RiskIndicatorProps) => {
  const config = {
    low: { icon: ShieldCheck, label: 'Low Risk', colorClass: 'text-success' },
    medium: { icon: Shield, label: 'Medium Risk', colorClass: 'text-warning' },
    high: { icon: ShieldAlert, label: 'High Risk', colorClass: 'text-destructive' },
  };

  const { icon: Icon, label, colorClass } = config[level];

  return (
    <div className={cn('flex items-center gap-1.5 text-xs font-mono', colorClass)}>
      <Icon className="w-4 h-4" />
      <span>{label}</span>
    </div>
  );
};

export default RiskIndicator;
