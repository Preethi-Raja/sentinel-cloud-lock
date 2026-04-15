import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import DashboardSidebar from '@/components/DashboardSidebar';
import RiskIndicator from '@/components/RiskIndicator';
import EncryptView from '@/components/EncryptView';
import DecryptView from '@/components/DecryptView';
import PreviewView from '@/components/PreviewView';
import DeleteView from '@/components/DeleteView';
import { supabase } from '@/integrations/supabase/client';
import { getUserProfile } from '@/lib/firebase';

type View = 'encrypt' | 'decrypt' | 'preview' | 'delete';
const DashboardPage = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState<View>('encrypt');
  const [username, setUsername] = useState('');
  const [riskLevel, setRiskLevel] = useState<'low' | 'medium' | 'high'>('low');

  useEffect(() => {
    if (!loading && !user) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      const profile = await getUserProfile(user.id);
      if (profile?.username) setUsername(profile.username);
    };

    const checkRisk = async () => {
      const fifteenMin = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const { data: logs } = await supabase
        .from('login_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', fifteenMin);

      if (logs && logs.length > 3) {
        setRiskLevel('high');
      } else if (logs && logs.length > 1) {
        setRiskLevel('medium');
      } else {
        setRiskLevel('low');
      }
    };

    fetchProfile();
    checkRisk();
  }, [user]);

  // Check for expired self-destruct files
  useEffect(() => {
    if (!user) return;
    const checkExpiry = async () => {
      const now = new Date().toISOString();
      const { data: expired } = await supabase
        .from('encrypted_files')
        .select('*')
        .eq('user_id', user.id)
        .eq('self_destruct_enabled', true)
        .lte('expiry_datetime', now);

      if (expired && expired.length > 0) {
        for (const file of expired) {
          await supabase.storage.from('encrypted-files').remove([file.storage_path]);
          await supabase.from('encrypted_files').delete().eq('id', file.id);
          await supabase.from('destruct_logs').insert({
            user_id: user.id,
            file_id: file.id,
            reason: 'Expiry time reached',
          });
        }
      }
    };

    checkExpiry();
    const interval = setInterval(checkExpiry, 60000);
    return () => clearInterval(interval);
  }, [user]);

  if (loading) return null;
  if (!user) return null;

  const renderView = () => {
    switch (activeView) {
      case 'encrypt': return <EncryptView />;
      case 'decrypt': return <DecryptView />;
      case 'preview': return <PreviewView />;
      case 'delete': return <DeleteView />;
    }
  };

  return (
    <div className="flex h-screen bg-background">
      <DashboardSidebar activeView={activeView} onViewChange={setActiveView} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-14 border-b border-border flex items-center justify-between px-6">
          <h2 className="font-mono text-sm text-muted-foreground">
            Welcome, <span className="text-foreground font-medium">{username}</span>
          </h2>
          <RiskIndicator level={riskLevel} />
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-6">
          {renderView()}
        </main>
      </div>
    </div>
  );
};

export default DashboardPage;
