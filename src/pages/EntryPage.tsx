import { motion } from 'framer-motion';
import { Shield, Lock, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const EntryPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background grid */}
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: 'linear-gradient(hsl(var(--primary) / 0.3) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary) / 0.3) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
      }} />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="glass-panel rounded-lg p-8 cyber-border">
          {/* Logo */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="flex justify-center mb-6"
          >
            <div className="w-20 h-20 rounded-lg gradient-glow flex items-center justify-center cyber-glow">
              <Shield className="w-10 h-10 text-primary-foreground" />
            </div>
          </motion.div>

          <h1 className="text-2xl font-bold text-center mb-2 font-mono text-gradient">
            VAULT CIPHER
          </h1>
          <p className="text-center text-muted-foreground text-sm mb-8">
            AI-Powered Encrypted File Locker
          </p>

          <div className="space-y-3">
            <Button
              onClick={() => navigate('/login')}
              className="w-full h-12 text-base"
              variant="default"
            >
              <Lock className="w-5 h-5 mr-2" />
              Login
            </Button>

            <Button
              onClick={() => navigate('/register')}
              className="w-full h-12 text-base"
              variant="outline"
            >
              <UserPlus className="w-5 h-5 mr-2" />
              Register
            </Button>
          </div>

          <p className="text-center text-muted-foreground text-xs mt-6">
            AES-256 Encryption · AI Classification · Self-Destruct
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default EntryPage;
