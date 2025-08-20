-- Adicionar colunas para controle de exclusão (soft-delete)
-- Permite médicos e admin deletarem as notas sem afetar uns aos outros
ALTER TABLE invoices ADD COLUMN deleted_by_user BOOLEAN DEFAULT 0;  -- Se médico/prestador deletou de sua visualização
ALTER TABLE invoices ADD COLUMN deleted_by_admin BOOLEAN DEFAULT 0; -- Se admin deletou de sua visualização
ALTER TABLE invoices ADD COLUMN deleted_at TEXT; -- Timestamp da deleção