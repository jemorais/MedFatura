-- MedFatura Database Schema for Supabase
-- Version 4: Simplified and more robust cleanup.

-- Drop all tables with CASCADE to remove dependent objects (triggers, policies, etc.)
-- This is the most reliable way to clean the slate.
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.pending_payments CASCADE;
DROP TABLE IF EXISTS public.invoices CASCADE;
DROP TABLE IF EXISTS public.invitations CASCADE;
DROP TABLE IF EXISTS public.sessions CASCADE;
DROP TABLE IF EXISTS public.users CASCADE; -- Old table from local schema
DROP TABLE IF EXISTS public.usuarios CASCADE; -- Old table name, just in case
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.user_types CASCADE;

-- Drop functions separately, in case they exist without the tables
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.update_updated_at_column();

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";

-- 1. user_types table
CREATE TABLE public.user_types (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    type_name TEXT NOT NULL UNIQUE
);
COMMENT ON TABLE public.user_types IS 'Tipos de usuário (ex: admin, medico)';

-- Insert default user types
INSERT INTO public.user_types (type_name) VALUES ('admin'), ('medico'), ('prestador') ON CONFLICT (type_name) DO NOTHING;

-- 2. profiles table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    updated_at TIMESTAMPTZ,
    full_name TEXT,
    cpf_crm TEXT UNIQUE,
    user_type_id BIGINT NOT NULL REFERENCES public.user_types(id),
    CONSTRAINT full_name_length CHECK (char_length(full_name) >= 3)
);
COMMENT ON TABLE public.profiles IS 'Tabela de perfis dos usuários, vinculada ao auth.users';

-- 3. invitations table
CREATE TABLE public.invitations (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    invited_by_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    cpf_crm TEXT NOT NULL,
    user_type_id BIGINT NOT NULL REFERENCES public.user_types(id),
    token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
COMMENT ON TABLE public.invitations IS 'Convites para novos usuários';

-- 4. invoices table
CREATE TABLE public.invoices (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    original_filename TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'recebido')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    deleted_by_user BOOLEAN DEFAULT FALSE,
    deleted_by_admin BOOLEAN DEFAULT FALSE
);
COMMENT ON TABLE public.invoices IS 'Faturas/notas fiscais enviadas pelos médicos';

-- 5. pending_payments table
CREATE TABLE public.pending_payments (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL,
    description TEXT NOT NULL,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'confirmed', 'cancelled')),
    invoice_storage_path TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    confirmed_at TIMESTAMPTZ
);
COMMENT ON TABLE public.pending_payments IS 'Pagamentos pendentes entre admin e médicos';

-- 6. notifications table
CREATE TABLE public.notifications (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    from_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('pending_payment', 'payment_sent', 'payment_confirmed', 'general')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    related_id BIGINT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    read_at TIMESTAMPTZ
);
COMMENT ON TABLE public.notifications IS 'Notificações do sistema';

-- Triggers and Functions
-- Function to create a profile for a new user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, user_type_id, full_name, cpf_crm)
  VALUES (
    new.id,
    (SELECT id FROM public.user_types WHERE type_name = 'medico'), -- Default to 'medico'
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'cpf_crm'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the function on new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update the 'updated_at' column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_pending_payments_updated_at BEFORE UPDATE ON public.pending_payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies
-- Enable RLS for all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policies for user_types (read-only for all authenticated users)
CREATE POLICY "Allow read access to all authenticated users" ON public.user_types FOR SELECT TO authenticated USING (true);

-- Policies for profiles
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING ((SELECT profiles.user_type_id FROM public.profiles WHERE profiles.id = auth.uid()) = (SELECT user_types.id FROM public.user_types WHERE user_types.type_name = 'admin'));

-- Policies for invoices
CREATE POLICY "Users can manage their own invoices" ON public.invoices FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all invoices" ON public.invoices FOR SELECT USING ((SELECT profiles.user_type_id FROM public.profiles WHERE profiles.id = auth.uid()) = (SELECT user_types.id FROM public.user_types WHERE user_types.type_name = 'admin'));

-- Policies for other tables
CREATE POLICY "Admins can manage invitations" ON public.invitations FOR ALL USING ((SELECT profiles.user_type_id FROM public.profiles WHERE profiles.id = auth.uid()) = (SELECT user_types.id FROM public.user_types WHERE user_types.type_name = 'admin'));
CREATE POLICY "Admins can manage pending payments" ON public.pending_payments FOR ALL USING ((SELECT profiles.user_type_id FROM public.profiles WHERE profiles.id = auth.uid()) = (SELECT user_types.id FROM public.user_types WHERE user_types.type_name = 'admin'));
CREATE POLICY "Users can view their own pending payments" ON public.pending_payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);