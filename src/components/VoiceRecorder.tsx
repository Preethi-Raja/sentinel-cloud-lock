import { useState } from 'react';
import { Mic, MicOff, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { startVoiceRecording } from '@/lib/voice';
import { motion, AnimatePresence } from 'framer-motion';

interface VoiceRecorderProps {
  onRecorded: (transcript: string) => void;
  label?: string;
}

const VoiceRecorder = ({ onRecorded, label = 'Record Voice Passphrase' }: VoiceRecorderProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recorded, setRecorded] = useState(false);
  const [error, setError] = useState('');

  const handleRecord = async () => {
    setIsRecording(true);
    setError('');
    try {
      const transcript = await startVoiceRecording();
      onRecorded(transcript);
      setRecorded(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsRecording(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant={recorded ? 'outline' : 'secondary'}
        className="w-full h-12 relative overflow-hidden"
        onClick={handleRecord}
        disabled={isRecording}
      >
        <AnimatePresence mode="wait">
          {isRecording ? (
            <motion.div
              key="recording"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2"
            >
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Listening... Speak now</span>
            </motion.div>
          ) : recorded ? (
            <motion.div
              key="done"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 text-accent"
            >
              <Check className="w-5 h-5" />
              <span>Voice Recorded — Click to Re-record</span>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2"
            >
              <Mic className="w-5 h-5" />
              <span>{label}</span>
            </motion.div>
          )}
        </AnimatePresence>
        {isRecording && (
          <motion.div
            className="absolute inset-0 bg-primary/10"
            animate={{ opacity: [0.1, 0.3, 0.1] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
          />
        )}
      </Button>
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
};

export default VoiceRecorder;
