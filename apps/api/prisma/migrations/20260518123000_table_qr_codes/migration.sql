-- Add stable public table codes used by QR URLs.
ALTER TABLE "Table" ADD COLUMN "code" TEXT;

UPDATE "Table"
SET "code" = 'tbl_' || substring(md5(random()::text || "id" || clock_timestamp()::text), 1, 12)
WHERE "code" IS NULL;

ALTER TABLE "Table" ALTER COLUMN "code" SET NOT NULL;

CREATE UNIQUE INDEX "Table_tenantId_code_key" ON "Table"("tenantId", "code");
