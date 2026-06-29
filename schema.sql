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
    category TEXT NOT NULL DEFAULT 'API Key', -- e.g., 'API Key', 'Auth Secret', 'Password', 'Secret Note'
    encrypted_secret TEXT NOT NULL,
    iv TEXT NOT NULL, -- Hex-encoded initialization vector (AES-GCM)
    auth_tag TEXT NOT NULL, -- Hex-encoded authentication tag (AES-GCM)
    prefix TEXT NOT NULL, -- Plaintext identifier prefix (e.g., 'sec_abc12')
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ
);

-- Migration script if table already exists:
-- ALTER TABLE public.secrets ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'API Key';

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_secrets_user_id ON public.secrets(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.secrets ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can list/read their own metadata
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

-- Policy: Authenticated users can update their own secrets (editing)
CREATE POLICY "Users can update their own secrets"
    ON public.secrets
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id);
