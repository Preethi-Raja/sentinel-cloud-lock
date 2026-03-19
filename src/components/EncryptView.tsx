import { useState, useRef } from 'react';
import { Upload, FileUp, Calendar, Clock, Bomb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { encryptFile } from '@/lib/crypto';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

// Simple keyword-based AI classification
function classifyFile(fileName: string, fileType: string): { classification: string; maxLimit: number } {
  const name = fileName.toLowerCase();
  const confidentialKeywords = ['passport', 'ssn', 'tax', 'secret', 'confidential', 'classified', 'nda', 'contract'];
  const personalKeywords = ['resume', 'cv', 'bank', 'statement', 'id', 'license', 'aadhaar', 'pan', 'payslip', 'salary'];

  if (confidentialKeywords.some(k => name.includes(k))) {
    return { classification: 'confidential', maxLimit: 3 };
  }
  if (personalKeywords.some(k => name.includes(k))) {
    return { classification: 'personal', maxLimit: 5 };
  }
  return { classification: 'normal', maxLimit: 10 };
}

const EncryptView = () => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [selfDestruct, setSelfDestruct] = useState(false);
  const [expiryDate, setExpiryDate] = useState('');
  const [expiryTime, setExpiryTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [classification, setClassification] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      const result = classifyFile(selected.name, selected.type);
      setClassification(result.classification);
      toast.info(`AI Classification: ${result.classification.toUpperCase()}`);
    }
  };

  const handleEncrypt = async () => {
    if (!file || !user) {
      toast.error('Please select a file');
      return;
    }

    setLoading(true);
    try {
      const { classification: cls, maxLimit } = classifyFile(file.name, file.type);
      const { encrypted, iv, key } = await encryptFile(file);

      // Upload encrypted file to storage
      const storagePath = `${user.id}/${Date.now()}_${file.name}.enc`;
      const encBlob = new Blob([encrypted]);

      const { error: uploadError } = await supabase.storage
        .from('encrypted-files')
        .upload(storagePath, encBlob);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('encrypted-files')
        .getPublicUrl(storagePath);

      let expiryDatetime = null;
      if (selfDestruct && expiryDate && expiryTime) {
        expiryDatetime = new Date(`${expiryDate}T${expiryTime}`).toISOString();
      }

      const { error: dbError } = await supabase.from('encrypted_files').insert({
        user_id: user.id,
        original_name: file.name,
        file_type: file.type || 'application/octet-stream',
        classification: cls,
        encrypted_file_url: urlData.publicUrl,
        storage_path: storagePath,
        iv,
        encrypted_key: key,
        max_decrypt_limit: maxLimit,
        self_destruct_enabled: selfDestruct,
        expiry_datetime: expiryDatetime,
        file_size: file.size,
      });

      if (dbError) throw dbError;

      toast.success(`File encrypted and uploaded! Classification: ${cls.toUpperCase()}`);
      setFile(null);
      setClassification(null);
      setSelfDestruct(false);
      setExpiryDate('');
      setExpiryTime('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      toast.error(err.message || 'Encryption failed');
    } finally {
      setLoading(false);
    }
  };

  const classificationColors: Record<string, string> = {
    normal: 'text-success',
    personal: 'text-warning',
    confidential: 'text-destructive',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-lg space-y-6"
    >
      <div>
        <h2 className="text-xl font-mono font-bold text-foreground">Encrypt File</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Upload a file to encrypt with AES-256 and store securely.
        </p>
      </div>

      {/* File upload area */}
      <div
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
      >
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          className="hidden"
        />
        {file ? (
          <div className="space-y-2">
            <FileUp className="w-8 h-8 mx-auto text-primary" />
            <p className="text-foreground font-medium">{file.name}</p>
            <p className="text-muted-foreground text-xs">
              {(file.size / 1024).toFixed(1)} KB
            </p>
            {classification && (
              <p className={`text-sm font-mono font-bold ${classificationColors[classification] || ''}`}>
                AI Classification: {classification.toUpperCase()}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">Click to select a file</p>
            <p className="text-muted-foreground text-xs">Any file type supported</p>
          </div>
        )}
      </div>

      {/* Self-destruct settings */}
      <div className="glass-panel rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bomb className="w-4 h-4 text-destructive" />
            <Label className="font-medium">Self-Destruct</Label>
          </div>
          <Switch checked={selfDestruct} onCheckedChange={setSelfDestruct} />
        </div>

        {selfDestruct && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="space-y-3"
          >
            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Expiry Date
              </Label>
              <Input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1">
                <Clock className="w-3 h-3" /> Expiry Time
              </Label>
              <Input
                type="time"
                value={expiryTime}
                onChange={(e) => setExpiryTime(e.target.value)}
                className="h-9"
              />
            </div>
          </motion.div>
        )}
      </div>

      <Button
        onClick={handleEncrypt}
        disabled={!file || loading}
        className="w-full h-12"
      >
        {loading ? 'Encrypting & Uploading...' : 'Encrypt & Upload to Cloud'}
      </Button>
    </motion.div>
  );
};

export default EncryptView;
