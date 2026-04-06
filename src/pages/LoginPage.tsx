import { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import { getLocation, calculateDistance } from '@/lib/location';
import { hashVoice } from '@/lib/crypto';
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

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });

      if (result.error) {
        toast.error('Google sign-in failed');
        setLoading(false);
        return;
      }

      if (result.redirected) {
        return;
      }

      // After Google sign-in, check if user has a profile (registered)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Authentication failed');
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('user_id', user.id)
        .single();

      if (!profile) {
        toast.error('This email is not registered. Please register first.');
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      toast.success('Login successful!');
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.message || 'Google login failed');
    } finally {
      setLoading(false);
    }
  };

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

      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const { data: recentLogs } = await supabase
        .from('login_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', fifteenMinutesAgo)
        .order('created_at', { ascending: false });

      await supabase.from('login_logs').insert({
        user_id: userId,
        latitude: location.latitude,
        longitude: location.longitude,
        device,
      });

      if (recentLogs && recentLogs.length > 0) {
        const lastLog = recentLogs[0];
        if (lastLog.latitude && lastLog.longitude) {
          const distance = calculateDistance(
            lastLog.latitude, lastLog.longitude,
            location.latitude, location.longitude
          );

          if (distance > 50) {
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
            <div className="space-y-4">
              {/* Google Sign-In */}
              <Button
                type="button"
                variant="outline"
                className="w-full h-12"
                onClick={handleGoogleLogin}
                disabled={loading}
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Sign in with Google
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">or</span>
                </div>
              </div>

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
            </div>
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
