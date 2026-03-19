
-- Create update_updated_at function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  voice_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Allow registration insert" ON public.profiles FOR INSERT WITH CHECK (true);

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Encrypted files table
CREATE TABLE public.encrypted_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original_name TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'normal',
  classification TEXT NOT NULL DEFAULT 'normal',
  encrypted_file_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  iv TEXT NOT NULL,
  encrypted_key TEXT NOT NULL,
  decrypt_count INTEGER NOT NULL DEFAULT 0,
  max_decrypt_limit INTEGER NOT NULL DEFAULT 10,
  self_destruct_enabled BOOLEAN NOT NULL DEFAULT false,
  expiry_datetime TIMESTAMPTZ,
  file_size BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.encrypted_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own files" ON public.encrypted_files FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own files" ON public.encrypted_files FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own files" ON public.encrypted_files FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own files" ON public.encrypted_files FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_files_updated_at BEFORE UPDATE ON public.encrypted_files
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Login logs table
CREATE TABLE public.login_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  device TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.login_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own logs" ON public.login_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own logs" ON public.login_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Self destruct logs
CREATE TABLE public.destruct_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_id UUID NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.destruct_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own destruct logs" ON public.destruct_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert destruct logs" ON public.destruct_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Storage bucket for encrypted files
INSERT INTO storage.buckets (id, name, public) VALUES ('encrypted-files', 'encrypted-files', false);

CREATE POLICY "Users can upload encrypted files" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'encrypted-files' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can view own encrypted files" ON storage.objects FOR SELECT USING (bucket_id = 'encrypted-files' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own encrypted files" ON storage.objects FOR DELETE USING (bucket_id = 'encrypted-files' AND auth.uid()::text = (storage.foldername(name))[1]);
