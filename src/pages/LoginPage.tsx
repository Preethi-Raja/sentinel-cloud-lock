import { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getLocation, calculateDistance } from '@/lib/location';
import { hashVoice } from '@/lib/crypto';
import { startVoiceRecording } from '@/lib/voice';
import VoiceRecorder from '@/components/VoiceRecorder';
import { toast } from 'sonner';

const LoginPage = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [voiceRequired, setVoiceRequired] = useState(false);
  const [voiceText, setVoiceText] = useState('');
  const [pendingUserId, setPendingUserId] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const email = `${username.toLowerCase().replace(/[^a-z0-9]/g, '')}@vault.local`;

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const userId = data.user.id;
      const location = await getLocation();
      const device = navigator.userAgent;

      // Check recent logins for location mismatch
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const { data: recentLogs } = await supabase
        .from('login_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', fifteenMinutesAgo)
        .order('created_at', { ascending: false });

      // Log this login
      await supabase.from('login_logs').insert({
        user_id: userId,
        latitude: location.latitude,
        longitude: location.longitude,
        device,
      });

      // Check if location differs from recent logins
      if (recentLogs && recentLogs.length > 0) {
        const lastLog = recentLogs[0];
        if (lastLog.latitude && lastLog.longitude) {
          const distance = calculateDistance(
            lastLog.latitude, lastLog.longitude,
            location.latitude, location.longitude
          );

          if (distance > 50) {
            // Different location - need voice verification
            setPendingUserId(userId);
            setVoiceRequired(true);
            setLoading(false);
            toast.warning('Different location detected. Voice verification required.');
            return;
          }
        }
      }

      toast.success('Login successful!');
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVoiceVerify = async () => {
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
        .eq('user_id', pendingUserId)
        .single();

      if (profile?.voice_hash === voiceHash) {
        toast.success('Voice verified! Access granted.');
        navigate('/dashboard');
      } else {
        toast.error('Voice mismatch! Access blocked — possible unauthorized access.');
        await supabase.auth.signOut();
      }
    } catch (err: any) {
      toast.error(err.message);
      await supabase.auth.signOut();
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
              <h1 className="text-xl font-bold font-mono text-gradient">
                {voiceRequired ? 'Voice Verification' : 'Login'}
              </h1>
              <p className="text-muted-foreground text-xs">
                {voiceRequired ? 'Location mismatch detected' : 'Access your encrypted vault'}
              </p>
            </div>
          </div>

          {voiceRequired ? (
            <div className="space-y-4">
              <div className="rounded-md bg-warning/10 border border-warning/30 p-3">
                <p className="text-warning text-sm font-medium">⚠️ Security Alert</p>
                <p className="text-muted-foreground text-xs mt-1">
                  Login from a different location detected. Please verify your identity with your voice passphrase.
                </p>
              </div>

              <VoiceRecorder
                onRecorded={setVoiceText}
                label="Speak Your Voice Passphrase"
              />

              <Button
                onClick={handleVoiceVerify}
                className="w-full h-12"
                disabled={loading || !voiceText}
              >
                {loading ? 'Verifying...' : 'Verify Identity'}
              </Button>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
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
                    placeholder="Enter password"
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

              <Button
                type="submit"
                className="w-full h-12"
                disabled={loading}
              >
                {loading ? 'Authenticating...' : 'Access Vault'}
              </Button>
            </form>
          )}

          <p className="text-center text-muted-foreground text-xs mt-4">
            Don't have an account?{' '}
            <button onClick={() => navigate('/register')} className="text-primary hover:underline">
              Register
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default LoginPage;
