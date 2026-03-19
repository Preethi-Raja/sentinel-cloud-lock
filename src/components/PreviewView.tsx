import { useEffect, useState } from 'react';
import { Eye, FileText, Shield, Clock, Bomb } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface EncryptedFile {
  id: string;
  original_name: string;
  classification: string;
  iv: string;
  encrypted_key: string;
  file_type: string;
  decrypt_count: number;
  max_decrypt_limit: number;
  self_destruct_enabled: boolean;
  expiry_datetime: string | null;
  file_size: number | null;
  created_at: string;
}

const PreviewView = () => {
  const { user } = useAuth();
  const [files, setFiles] = useState<EncryptedFile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchFiles = async () => {
      const { data } = await supabase
        .from('encrypted_files')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      setFiles(data || []);
      setLoading(false);
    };
    fetchFiles();
  }, [user]);

  const classificationBadge = (cls: string) => {
    const variants: Record<string, string> = {
      normal: 'bg-success/15 text-success border-success/30',
      personal: 'bg-warning/15 text-warning border-warning/30',
      confidential: 'bg-destructive/15 text-destructive border-destructive/30',
    };
    return variants[cls] || variants.normal;
  };

  const maskKey = (key: string) => {
    if (key.length <= 8) return '••••••••';
    return key.slice(0, 4) + '••••••••' + key.slice(-4);
  };

  if (loading) {
    return <p className="text-muted-foreground">Loading files...</p>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div>
        <h2 className="text-xl font-mono font-bold text-foreground">Encrypted Files</h2>
        <p className="text-muted-foreground text-sm mt-1">
          View encrypted file metadata. No decryption or download available here.
        </p>
      </div>

      {files.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Eye className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No encrypted files yet</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {files.map((file) => (
            <div key={file.id} className="glass-panel rounded-lg p-4 cyber-border">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  <span className="font-medium text-sm">{file.original_name}</span>
                </div>
                <span className={cn('text-xs border rounded px-2 py-0.5', classificationBadge(file.classification))}>
                  {file.classification.toUpperCase()}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground font-mono">
                <div>
                  <span className="text-foreground/50">IV: </span>
                  {file.iv.slice(0, 16)}...
                </div>
                <div>
                  <span className="text-foreground/50">Key: </span>
                  {maskKey(file.encrypted_key)}
                </div>
                <div>
                  <span className="text-foreground/50">Type: </span>
                  {file.file_type}
                </div>
                <div>
                  <span className="text-foreground/50">Decrypts: </span>
                  {file.decrypt_count}/{file.max_decrypt_limit}
                </div>
              </div>

              <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(file.created_at).toLocaleDateString()}
                </div>
                {file.self_destruct_enabled && (
                  <div className="flex items-center gap-1 text-destructive">
                    <Bomb className="w-3 h-3" />
                    Self-destruct: {file.expiry_datetime ? new Date(file.expiry_datetime).toLocaleString() : 'On limit'}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
};

export default PreviewView;
