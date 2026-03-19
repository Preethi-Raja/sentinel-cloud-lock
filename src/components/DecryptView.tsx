import { useEffect, useState } from 'react';
import { Download, Lock, Mic, FileText, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { decryptFile } from '@/lib/crypto';
import { hashPassword, hashVoice } from '@/lib/crypto';
import VoiceRecorder from '@/components/VoiceRecorder';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
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
  storage_path: string;
}

const DecryptView = () => {
  const { user } = useAuth();
  const [files, setFiles] = useState<EncryptedFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<EncryptedFile | null>(null);
  const [step, setStep] = useState<'select' | 'password' | 'voice' | 'decrypting'>('select');
  const [password, setPassword] = useState('');
  const [voiceText, setVoiceText] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchFiles = async () => {
      const { data } = await supabase
        .from('encrypted_files')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      setFiles(data || []);
    };
    fetchFiles();
  }, [user]);

  const handleSelectFile = (file: EncryptedFile) => {
    if (file.decrypt_count >= file.max_decrypt_limit) {
      toast.error('Decrypt limit reached! This file will self-destruct.');
      handleSelfDestruct(file, 'Decrypt limit exceeded');
      return;
    }
    setSelectedFile(file);
    setStep('password');
  };

  const handlePasswordStep = async () => {
    if (!password) {
      toast.error('Enter your password');
      return;
    }

    setLoading(true);
    try {
      const passHash = await hashPassword(password);
      const { data: profile } = await supabase
        .from('profiles')
        .select('password_hash, voice_hash')
        .eq('user_id', user!.id)
        .single();

      if (profile?.password_hash !== passHash) {
        toast.error('Incorrect password');
        setLoading(false);
        return;
      }

      // If user has voice hash and file is personal/confidential, require voice
      if (profile?.voice_hash && selectedFile?.classification !== 'normal') {
        setStep('voice');
      } else {
        await performDecryption();
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVoiceStep = async () => {
    if (!voiceText) {
      toast.error('Please record your voice');
      return;
    }

    setLoading(true);
    try {
      const voiceHash = await hashVoice(voiceText);
      const { data: profile } = await supabase
        .from('profiles')
        .select('voice_hash')
        .eq('user_id', user!.id)
        .single();

      if (profile?.voice_hash === voiceHash) {
        await performDecryption();
      } else {
        toast.error('Voice mismatch! Access denied.');
        // Self-destruct on voice mismatch for confidential files
        if (selectedFile?.classification === 'confidential') {
          handleSelfDestruct(selectedFile, 'Voice mismatch');
        }
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const performDecryption = async () => {
    if (!selectedFile || !user) return;
    setStep('decrypting');

    try {
      // Download encrypted file from storage
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('encrypted-files')
        .download(selectedFile.storage_path);

      if (downloadError) throw downloadError;

      const encryptedBuffer = await fileData.arrayBuffer();
      const decryptedBuffer = await decryptFile(
        encryptedBuffer,
        selectedFile.iv,
        selectedFile.encrypted_key
      );

      // Increment decrypt count
      const newCount = selectedFile.decrypt_count + 1;
      await supabase
        .from('encrypted_files')
        .update({ decrypt_count: newCount })
        .eq('id', selectedFile.id);

      // Trigger download
      const blob = new Blob([decryptedBuffer]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = selectedFile.original_name;
      a.click();
      URL.revokeObjectURL(url);

      toast.success(`File decrypted! (${newCount}/${selectedFile.max_decrypt_limit} decryptions used)`);

      // Check if limit reached after this decryption
      if (newCount >= selectedFile.max_decrypt_limit && selectedFile.self_destruct_enabled) {
        handleSelfDestruct(selectedFile, 'Decrypt limit reached');
      }

      // Reset
      setStep('select');
      setSelectedFile(null);
      setPassword('');
      setVoiceText('');

      // Refresh files list
      const { data } = await supabase
        .from('encrypted_files')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      setFiles(data || []);
    } catch (err: any) {
      toast.error(err.message || 'Decryption failed');
      setStep('select');
    }
  };

  const handleSelfDestruct = async (file: EncryptedFile, reason: string) => {
    try {
      await supabase.storage.from('encrypted-files').remove([file.storage_path]);
      await supabase.from('encrypted_files').delete().eq('id', file.id);
      await supabase.from('destruct_logs').insert({
        user_id: user!.id,
        file_id: file.id,
        reason,
      });
      toast.error(`💣 File "${file.original_name}" self-destructed: ${reason}`);
      setFiles(prev => prev.filter(f => f.id !== file.id));
      setStep('select');
      setSelectedFile(null);
    } catch (err) {
      console.error('Self-destruct error:', err);
    }
  };

  const classificationBadge = (cls: string) => {
    const variants: Record<string, string> = {
      normal: 'bg-success/15 text-success border-success/30',
      personal: 'bg-warning/15 text-warning border-warning/30',
      confidential: 'bg-destructive/15 text-destructive border-destructive/30',
    };
    return variants[cls] || variants.normal;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-lg space-y-6"
    >
      <div>
        <h2 className="text-xl font-mono font-bold text-foreground">Decrypt File</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Multi-factor authentication required for decryption.
        </p>
      </div>

      {step === 'select' && (
        <div className="space-y-3">
          {files.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No files to decrypt</p>
          ) : (
            files.map((file) => (
              <button
                key={file.id}
                onClick={() => handleSelectFile(file)}
                className="w-full glass-panel rounded-lg p-4 cyber-border text-left hover:border-primary/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">{file.original_name}</span>
                  </div>
                  <span className={cn('text-xs border rounded px-2 py-0.5', classificationBadge(file.classification))}>
                    {file.classification}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span>Decrypts: {file.decrypt_count}/{file.max_decrypt_limit}</span>
                  {file.decrypt_count >= file.max_decrypt_limit && (
                    <span className="text-destructive flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Limit reached
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {step === 'password' && selectedFile && (
        <div className="space-y-4">
          <div className="glass-panel rounded-lg p-3 cyber-border">
            <p className="text-sm font-medium">{selectedFile.original_name}</p>
            <p className="text-xs text-muted-foreground">Step 1: Password Verification</p>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <Lock className="w-3 h-3" /> Enter Password
            </Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your account password"
              className="h-11"
            />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setStep('select'); setPassword(''); }}>
              Cancel
            </Button>
            <Button onClick={handlePasswordStep} disabled={loading} className="flex-1">
              {loading ? 'Verifying...' : 'Verify Password'}
            </Button>
          </div>
        </div>
      )}

      {step === 'voice' && selectedFile && (
        <div className="space-y-4">
          <div className="glass-panel rounded-lg p-3 cyber-border">
            <p className="text-sm font-medium">{selectedFile.original_name}</p>
            <p className="text-xs text-muted-foreground">Step 2: Voice Verification (MFA)</p>
          </div>

          <div className="rounded-md bg-warning/10 border border-warning/30 p-3">
            <p className="text-warning text-sm font-medium flex items-center gap-1">
              <Mic className="w-4 h-4" /> Voice Required
            </p>
            <p className="text-muted-foreground text-xs mt-1">
              This file is classified as <strong>{selectedFile.classification}</strong> and requires voice verification.
            </p>
          </div>

          <VoiceRecorder
            onRecorded={setVoiceText}
            label="Speak Your Voice Passphrase"
          />

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setStep('select'); setVoiceText(''); }}>
              Cancel
            </Button>
            <Button onClick={handleVoiceStep} disabled={loading || !voiceText} className="flex-1">
              {loading ? 'Verifying...' : 'Verify Voice & Decrypt'}
            </Button>
          </div>
        </div>
      )}

      {step === 'decrypting' && (
        <div className="text-center py-8">
          <div className="w-12 h-12 mx-auto rounded-full gradient-glow animate-pulse-glow flex items-center justify-center mb-4">
            <Download className="w-6 h-6 text-primary-foreground" />
          </div>
          <p className="text-foreground font-medium">Decrypting file...</p>
          <p className="text-muted-foreground text-xs mt-1">Processing in secure memory</p>
        </div>
      )}
    </motion.div>
  );
};

export default DecryptView;
