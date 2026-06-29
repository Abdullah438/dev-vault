-- ==========================================
-- DevVault - Database Schema for Secrets
-- Execute this SQL script in your Supabase SQL Editor.
-- ==========================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create the secrets table
CREATE TABLE IF NOT EXISTS public.secrets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    encrypted_secret TEXT NOT NULL,
    iv TEXT NOT NULL, -- Hex-encoded initialization vector (AES-GCM)
    auth_tag TEXT NOT NULL, -- Hex-encoded authentication tag (AES-GCM)
    prefix TEXT NOT NULL, -- Plaintext identifier prefix (e.g., 'sec_abc12')
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ
);

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_secrets_user_id ON public.secrets(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.secrets ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can list/read their own metadata
-- Note: This lets the frontend load the list, but they can't decrypt it directly 
-- because the decryption key (ENCRYPTION_MASTER_KEY) lives only on the Next.js server.
CREATE POLICY "Users can view their own secrets"
    ON public.secrets
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Policy: Authenticated users can delete their own secrets (revocation)
CREATE POLICY "Users can delete their own secrets"
    ON public.secrets
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- NOTE: There is no policy for INSERT or UPDATE for the 'authenticated' role.
-- Generating and updating keys is strictly managed by our Next.js API Routes,
-- which uses the Supabase Admin/Service Role Client to bypass RLS. 
-- This prevents users from writing raw/arbitrary ciphertext or spoofing metadata prefixes.
