-- User vault KDF configuration (Argon2id per-user salt)
CREATE TABLE IF NOT EXISTS public.user_vault_config (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    kdf_version INTEGER NOT NULL DEFAULT 2,
    kdf_salt TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_vault_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own vault config"
    ON public.user_vault_config
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own vault config"
    ON public.user_vault_config
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own vault config"
    ON public.user_vault_config
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
