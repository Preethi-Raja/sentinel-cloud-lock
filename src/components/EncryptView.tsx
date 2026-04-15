import { useState, useRef } from 'react';
import { Upload, FileUp, Calendar, Clock, Bomb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { encryptFile } from '@/lib/crypto';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { writeFileMetadata } from '@/lib/firebase';

const EncryptView = () => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [classification, setClassification] = useState<'normal' | 'personal'>('normal');
  const [selfDestruct, setSelfDestruct] = useState(false);
  const [expiryDate, setExpiryDate] = useState('');
  const [expiryTime, setExpiryTime] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
    }
  };

  const getMaxLimit = (cls: string) => {
    return cls === 'personal' ? 5 : 10;
  };

  const handleEncrypt = async () => {
    if (!file || !user) {
      toast.error('Please select a file');
      return;
    }

    setLoading(true);
    try {
      const maxLimit = getMaxLimit(classification);
      const { encrypted, iv, key } = await encryptFile(file);

      const storagePath = `${user.id}/${Date.now()}_${file.name}.enc`;
      const encBlob = new Blob([encrypted]);

      const { error: uploadError } = await supabase.storage
        .from('encrypted-files')
        .upload(storagePath, encBlob);

      if (uploadError) throw uploadError;

      let expiryDatetime = null;
      if (selfDestruct && expiryDate && expiryTime) {
        expiryDatetime = new Date(`${expiryDate}T${expiryTime}`).toISOString();
      }

      // Generate a signed URL valid for the file's lifetime (default 30 days, or until expiry)
      const signedUrlExpiry = expiryDatetime
        ? Math.max(60, Math.floor((new Date(expiryDatetime).getTime() - Date.now()) / 1000))
        : 30 * 24 * 60 * 60; // 30 days in seconds

      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('encrypted-files')
        .createSignedUrl(storagePath, signedUrlExpiry);

      if (signedUrlError || !signedUrlData?.signedUrl) {
        throw new Error('Failed to generate signed download URL');
      }

      const signedUrl = signedUrlData.signedUrl;

      const { error: dbError } = await supabase.from('encrypted_files').insert({
        user_id: user.id,
        original_name: file.name,
        file_type: file.type || 'application/octet-stream',
        classification,
        encrypted_file_url: signedUrl,
        storage_path: storagePath,
        iv,
        encrypted_key: key,
        max_decrypt_limit: maxLimit,
        self_destruct_enabled: selfDestruct,
        expiry_datetime: expiryDatetime,
        file_size: file.size,
      });

      if (dbError) throw dbError;

      // Sync metadata to Firebase Realtime Database
      const firebaseId = storagePath.replace(/[./#$[\]]/g, '_');
      await writeFileMetadata(firebaseId, {
        file_name: file.name,
        file_url: signedUrl,
        decryption_count: 0,
        expiry_time: expiryDatetime || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });

      toast.success(`File encrypted and uploaded! Classification: ${classification.toUpperCase()}`);
      setFile(null);
      setClassification('normal');
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
          </div>
        ) : (
          <div className="space-y-2">
            <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">Click to select a file</p>
            <p className="text-muted-foreground text-xs">Any file type supported</p>
          </div>
        )}
      </div>

      {/* Classification selection */}
      <div className="space-y-2">
        <Label className="font-medium">File Classification</Label>
        <Select value={classification} onValueChange={(v) => setClassification(v as 'normal' | 'personal')}>
          <SelectTrigger className="h-11">
            <SelectValue placeholder="Select classification" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="normal">Normal (Max 10 decrypts)</SelectItem>
            <SelectItem value="personal">Personal (Max 5 decrypts, MFA required)</SelectItem>
          </SelectContent>
        </Select>
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
