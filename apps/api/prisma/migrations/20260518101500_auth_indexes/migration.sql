-- Add indexes used by auth and tenant authorization checks.
CREATE INDEX "User_systemRole_idx" ON "User"("systemRole");
CREATE INDEX "Tenant_status_idx" ON "Tenant"("status");
CREATE INDEX "TenantMember_tenantId_role_idx" ON "TenantMember"("tenantId", "role");
CREATE INDEX "TenantMember_tenantId_status_idx" ON "TenantMember"("tenantId", "status");
