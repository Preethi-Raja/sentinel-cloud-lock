import { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { hashPassword, hashVoice } from '@/lib/crypto';
import VoiceRecorder from '@/components/VoiceRecorder';
import { toast } from 'sonner';

const RegisterPage = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [voiceText, setVoiceText] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error('Please fill in all fields');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const email = `${username.toLowerCase().replace(/[^a-z0-9]/g, '')}@vault.local`;
      const passHash = await hashPassword(password);
      const voiceHash = voiceText ? await hashVoice(voiceText) : null;

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        const { error: profileError } = await supabase.from('profiles').insert({
          user_id: data.user.id,
          username,
          password_hash: passHash,
          voice_hash: voiceHash,
        });

        if (profileError) throw profileError;
      }

      toast.success('Registration successful! Redirecting...');
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: 'linear-gradient(hsl(var(--primary) / 0.3) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary) / 0.3) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
      }} />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="glass-panel rounded-lg p-8 cyber-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="mb-4 text-muted-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>

          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-md gradient-glow flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold font-mono text-gradient">Register</h1>
              <p className="text-muted-foreground text-xs">Create your secure vault</p>
            </div>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Voice Authentication (Optional)</Label>
              <VoiceRecorder onRecorded={setVoiceText} />
              <p className="text-muted-foreground text-xs">
                Say a unique passphrase. This will be used for MFA during decryption.
              </p>
            </div>

            <Button
              type="submit"
              className="w-full h-12"
              disabled={loading}
            >
              {loading ? 'Creating Vault...' : 'Create Secure Account'}
            </Button>
          </form>

          <p className="text-center text-muted-foreground text-xs mt-4">
            Already have an account?{' '}
            <button onClick={() => navigate('/login')} className="text-primary hover:underline">
              Login
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default RegisterPage;
