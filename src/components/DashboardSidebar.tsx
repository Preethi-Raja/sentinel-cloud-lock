import { Shield, Upload, Download, Eye, Trash2, LogOut, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

type View = 'encrypt' | 'decrypt' | 'preview' | 'delete';

interface DashboardSidebarProps {
  activeView: View;
  onViewChange: (view: View) => void;
}

const navItems: { view: View; label: string; icon: React.ElementType }[] = [
  { view: 'encrypt', label: 'Encrypt File', icon: Upload },
  { view: 'decrypt', label: 'Decrypt File', icon: Download },
  { view: 'preview', label: 'Preview Files', icon: Eye },
  { view: 'delete', label: 'Delete File', icon: Trash2 },
];

const DashboardSidebar = ({ activeView, onViewChange }: DashboardSidebarProps) => {
  const { signOut, timeRemaining } = useAuth();

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <aside className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col h-screen">
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md gradient-glow flex items-center justify-center">
            <Shield className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-mono font-bold text-sm text-gradient">VAULT CIPHER</span>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map(({ view, label, icon: Icon }) => (
          <button
            key={view}
            onClick={() => onViewChange(view)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors',
              activeView === view
                ? 'bg-sidebar-accent text-sidebar-primary'
                : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </nav>

      <div className="p-3 border-t border-sidebar-border space-y-2">
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-sidebar-accent/50">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <span className={cn(
            'text-xs font-mono',
            timeRemaining < 120000 ? 'text-destructive' : 'text-muted-foreground'
          )}>
            Session: {formatTime(timeRemaining)}
          </span>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start text-sidebar-foreground"
          onClick={signOut}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </div>
    </aside>
  );
};

export default DashboardSidebar;
