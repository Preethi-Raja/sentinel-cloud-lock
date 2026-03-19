import { useEffect, useState } from 'react';
import { Trash2, FileText, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface EncryptedFile {
  id: string;
  original_name: string;
  classification: string;
  storage_path: string;
  created_at: string;
}

const DeleteView = () => {
  const { user } = useAuth();
  const [files, setFiles] = useState<EncryptedFile[]>([]);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchFiles = async () => {
      const { data } = await supabase
        .from('encrypted_files')
        .select('id, original_name, classification, storage_path, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      setFiles(data || []);
    };
    fetchFiles();
  }, [user]);

  const handleDelete = async (file: EncryptedFile) => {
    setLoading(true);
    try {
      await supabase.storage.from('encrypted-files').remove([file.storage_path]);
      await supabase.from('encrypted_files').delete().eq('id', file.id);
      await supabase.from('destruct_logs').insert({
        user_id: user!.id,
        file_id: file.id,
        reason: 'Manual deletion',
      });
      setFiles(prev => prev.filter(f => f.id !== file.id));
      setConfirmId(null);
      toast.success(`File "${file.original_name}" deleted`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div>
        <h2 className="text-xl font-mono font-bold text-foreground">Delete Files</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Permanently delete encrypted files from the cloud.
        </p>
      </div>

      {files.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Trash2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No files to delete</p>
        </div>
      ) : (
        <div className="space-y-2">
          {files.map((file) => (
            <div key={file.id} className="glass-panel rounded-lg p-4 cyber-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  <span className="text-sm">{file.original_name}</span>
                </div>

                {confirmId === file.id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-destructive text-xs flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Confirm?
                    </span>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(file)}
                      disabled={loading}
                    >
                      Delete
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setConfirmId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirmId(file.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
};

export default DeleteView;
