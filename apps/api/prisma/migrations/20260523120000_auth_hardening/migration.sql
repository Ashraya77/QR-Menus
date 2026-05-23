-- Harden auth/session storage and add SaaS authorization placeholders.
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED');

CREATE TYPE "RefreshTokenRevokedReason" AS ENUM (
    'LOGOUT',
    'ROTATED',
    'REUSED',
    'ADMIN_REVOKED'
);

CREATE TYPE "Plan" AS ENUM ('FREE', 'PRO', 'ENTERPRISE');

CREATE TYPE "SubscriptionStatus" AS ENUM (
    'TRIALING',
    'ACTIVE',
    'PAST_DUE',
    'CANCELED',
    'EXPIRED'
);

ALTER TABLE "User"
    ADD COLUMN "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN "passwordChangedAt" TIMESTAMP(3),
    ADD COLUMN "forcePasswordReset" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);

ALTER TABLE "RefreshToken"
    ADD COLUMN "replacedByTokenId" TEXT,
    ADD COLUMN "ipAddress" TEXT,
    ADD COLUMN "userAgent" TEXT,
    ADD COLUMN "familyId" TEXT,
    ADD COLUMN "revokedReason" "RefreshTokenRevokedReason";

ALTER TABLE "Tenant"
    ADD COLUMN "plan" "Plan" NOT NULL DEFAULT 'FREE',
    ADD COLUMN "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    ADD COLUMN "trialEndsAt" TIMESTAMP(3),
    ADD COLUMN "currentPeriodEndsAt" TIMESTAMP(3);

CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "scopes" TEXT[],
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailVerificationToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TenantInvitation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "TenantRole" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "invitedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantInvitation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "tenantId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "User_status_idx" ON "User"("status");
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");
CREATE INDEX "RefreshToken_revokedAt_idx" ON "RefreshToken"("revokedAt");
CREATE INDEX "RefreshToken_userId_revokedAt_idx" ON "RefreshToken"("userId", "revokedAt");
CREATE INDEX "Tenant_plan_idx" ON "Tenant"("plan");
CREATE INDEX "Tenant_subscriptionStatus_idx" ON "Tenant"("subscriptionStatus");
CREATE INDEX "ApiKey_tenantId_idx" ON "ApiKey"("tenantId");
CREATE INDEX "ApiKey_keyPrefix_idx" ON "ApiKey"("keyPrefix");
CREATE INDEX "ApiKey_revokedAt_idx" ON "ApiKey"("revokedAt");
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");
CREATE INDEX "PasswordResetToken_usedAt_idx" ON "PasswordResetToken"("usedAt");
CREATE INDEX "EmailVerificationToken_userId_idx" ON "EmailVerificationToken"("userId");
CREATE INDEX "EmailVerificationToken_expiresAt_idx" ON "EmailVerificationToken"("expiresAt");
CREATE INDEX "EmailVerificationToken_usedAt_idx" ON "EmailVerificationToken"("usedAt");
CREATE INDEX "TenantInvitation_tenantId_idx" ON "TenantInvitation"("tenantId");
CREATE INDEX "TenantInvitation_email_idx" ON "TenantInvitation"("email");
CREATE INDEX "TenantInvitation_expiresAt_idx" ON "TenantInvitation"("expiresAt");
CREATE INDEX "TenantInvitation_acceptedAt_idx" ON "TenantInvitation"("acceptedAt");
CREATE INDEX "TenantInvitation_revokedAt_idx" ON "TenantInvitation"("revokedAt");
CREATE INDEX "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId");
CREATE INDEX "AuditLog_tenantId_idx" ON "AuditLog"("tenantId");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantInvitation" ADD CONSTRAINT "TenantInvitation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantInvitation" ADD CONSTRAINT "TenantInvitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
