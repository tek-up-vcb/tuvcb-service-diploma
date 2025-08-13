-- Migration pour corriger le schéma des signatures de diplôme
-- Objectif : Changer les adresses wallet vers les IDs utilisateurs

-- 1. Sauvegarder les données existantes si nécessaire
-- CREATE TABLE diploma_requests_backup AS SELECT * FROM diploma_requests;
-- CREATE TABLE diploma_request_signatures_backup AS SELECT * FROM diploma_request_signatures;

-- 2. Mettre à jour la colonne createdBy dans diploma_requests
-- Changer de VARCHAR(42) vers UUID
ALTER TABLE diploma_requests ALTER COLUMN "createdBy" TYPE uuid USING "createdBy"::uuid;

-- 3. Mettre à jour la colonne userId dans diploma_request_signatures  
-- Changer de VARCHAR(42) vers UUID
ALTER TABLE diploma_request_signatures ALTER COLUMN "userId" TYPE uuid USING "userId"::uuid;

-- 4. Si des données existantes utilisent des adresses wallet, elles devront être converties manuellement
-- ou les tables peuvent être vidées pour un nouveau départ :
-- TRUNCATE TABLE diploma_request_signatures;
-- TRUNCATE TABLE diploma_requests;

-- Note: Cette migration nécessite que les données existantes soient compatibles avec le format UUID
-- Si ce n'est pas le cas, les tables devront être vidées avant d'exécuter cette migration
