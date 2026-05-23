You are reviewing and upgrading a NestJS + Prisma + PostgreSQL authentication system for a multi-tenant hotel/restaurant SaaS.

Current system:
- NestJS backend
- Prisma ORM
- PostgreSQL
- User model with email, passwordHash, systemRole
- Tenant model
- TenantMember model with userId, tenantId, role, status
- Access token is JWT, expires in 15 minutes
- Refresh token is opaque random string
- Refresh token is hashed before storing
- Refresh token rotation exists
- Logout revokes refresh token
- Auth routes: login, refresh, logout
- JwtStrategy extracts bearer access token
- Refresh tokens are currently returned in JSON
- Current refresh token lookup scans all active refresh tokens and compares hashes one by one

Goal:
Upgrade this auth system to a production-grade multi-tenant SaaS auth setup suitable for hotel/restaurant management software.

Important principles:
- Do not invent custom cryptography.
- Do not store raw refresh tokens.
- Do not accept roles from request body unless inside a controlled invite/create-owner flow.
- Do not trust tenantId from frontend without verifying membership.
- Keep system-level roles separate from tenant-level roles.
- Prefer simple, secure, maintainable code over over-engineered abstractions.

Implement the following improvements.

1. Refresh token storage and lookup

Replace current refresh token lookup logic.

Current bad behavior:
- The service fetches all active refresh tokens.
- It loops over every token.
- It verifies each hash until one matches.

This is not scalable and can become a performance/security issue.

New design:
- Generate refresh tokens in this format:

  refreshToken = tokenId.secret

Example:
  "clxabc123.randomBase64UrlSecret"

- Store tokenId as the RefreshToken.id.
- Store only hash(secret) in tokenHash.
- Never store the raw refresh token or raw secret.

Refresh flow:
- Split incoming refresh token by "."
- Validate tokenId and secret exist
- Find one RefreshToken row by id
- Check:
  - token exists
  - revokedAt is null
  - expiresAt is greater than now
  - user still exists
  - user.status is ACTIVE
- Verify secret against tokenHash
- Revoke old token
- Create new refresh token
- Return new access token
- Set new refresh token cookie if using cookies

Also add Prisma indexes where useful:
- @@index([userId])
- @@index([expiresAt])
- @@index([revokedAt])
- Optional: @@index([userId, revokedAt])

2. Add refresh token reuse detection

When a refresh token is already revoked but someone tries to use it again:
- Treat it as suspicious token reuse.
- Revoke all active refresh tokens for that user.
- Return UnauthorizedException.
- Optional: create an audit log entry.

This protects against stolen refresh tokens.

Add fields to RefreshToken:
- replacedByTokenId String?
- ipAddress String?
- userAgent String?
- familyId String? optional
- revokedReason RefreshTokenRevokedReason? optional

Suggested enum:
enum RefreshTokenRevokedReason {
  LOGOUT
  ROTATED
  REUSED
  ADMIN_REVOKED
}

When rotating:
- old token revokedAt = now
- old token revokedReason = ROTATED
- old token replacedByTokenId = new token id

When logout:
- revokedReason = LOGOUT

3. Move refresh token to httpOnly cookie

For browser SaaS production:
- Access token can be returned in JSON.
- Refresh token should be stored in an httpOnly, secure, sameSite cookie.

Login:
- Validate credentials.
- Create access token.
- Create refresh token.
- Set refresh token cookie.
- Return accessToken, user profile, and active tenant memberships.

Refresh:
- Read refresh token from cookie.
- Rotate refresh token.
- Set new refresh token cookie.
- Return new accessToken.

Logout:
- Read refresh token from cookie.
- Revoke refresh token.
- Clear cookie.
- Return success message.

Cookie settings:
- httpOnly: true
- secure: true in production
- sameSite: "lax" or "strict" depending frontend/backend domain setup
- path: "/auth/refresh" if only refresh endpoint needs it, or broader if logout also needs it
- maxAge: 30 days

For local dev:
- secure can be false
- sameSite may need to be "lax"

Do not store refresh token in localStorage.

4. Add user account status

Update User model:

enum UserStatus {
  ACTIVE
  DISABLED
}

model User {
  id           String     @id @default(cuid())
  name         String?
  email        String     @unique
  passwordHash String
  systemRole   SystemRole @default(USER)
  status       UserStatus @default(ACTIVE)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  memberships    TenantMember[]
  createdTenants Tenant[]       @relation("TenantCreatedBy")
  refreshTokens  RefreshToken[]

  @@index([systemRole])
  @@index([status])
}

Login should fail if user.status !== ACTIVE.
Refresh should fail if user.status !== ACTIVE.
JWT validation may either:
- only trust JWT for basic identity and check status in sensitive guards
- or load user from DB inside JwtStrategy for stronger validation

5. Filter active tenants and memberships on login

Currently login should not return disabled/invited memberships.

When fetching user memberships during login, only include:
- membership.status = ACTIVE
- tenant.status = ACTIVE

Example Prisma include:
memberships: {
  where: {
    status: 'ACTIVE',
    tenant: {
      status: 'ACTIVE'
    }
  },
  include: {
    tenant: true
  }
}

Also ensure guards check membership status from DB, not only from the login response.

6. Add TenantGuard

Create a proper TenantGuard for all tenant-owned resources.

Goal:
Prevent users from accessing another restaurant/hotel’s data.

The guard should:
- Require authenticated user from JwtAuthGuard
- Extract tenantId from:
  - req.params.tenantId
  - or req.params.slug
  - or a custom decorator/config if route uses a different param
- Query TenantMember where:
  - userId = req.user.id
  - tenantId = param tenantId
  - status = ACTIVE
  - tenant.status = ACTIVE
- Attach membership and tenant to request:
  req.tenant = tenant
  req.membership = membership

If no valid membership:
- throw ForbiddenException

SUPER_ADMIN behavior:
- Decide clearly.
- Either SUPER_ADMIN can bypass tenant membership
- or SUPER_ADMIN must explicitly impersonate/select tenant
- Prefer explicit behavior and audit it

Example usage:
@UseGuards(JwtAuthGuard, TenantGuard)
@Get('/tenants/:tenantId/menus')
findMenus() {}

7. Add tenant role/permission guard

Create RolesGuard or PermissionsGuard for tenant-level permissions.

Tenant roles:
- OWNER
- ADMIN
- STAFF

Optional future roles:
- MANAGER
- CASHIER
- KITCHEN
- WAITER

Do not overcomplicate early, but design cleanly.

Example decorator:
@TenantRoles(TenantRole.OWNER, TenantRole.ADMIN)

Guard should read req.membership.role from TenantGuard.
It should not trust role from JWT for tenant-level authorization.

Example:
@UseGuards(JwtAuthGuard, TenantGuard, TenantRolesGuard)
@TenantRoles('OWNER', 'ADMIN')
@Post('/tenants/:tenantId/menus')
createMenu() {}

8. Add system role guard

Keep systemRole separate from tenant role.

System roles:
- SUPER_ADMIN
- USER

Use system role only for platform-level routes:
- managing all tenants
- suspending tenants
- platform analytics
- admin support

Example:
@SystemRoles('SUPER_ADMIN')
@Get('/platform/tenants')
findAllTenants() {}

Do not use systemRole for restaurant permissions.

9. Add SubscriptionGuard

Since this is a SaaS, add subscription-based access control.

Add models or placeholders:
- Subscription
- Plan
- TenantSubscription

At minimum, Tenant should eventually have subscription info:
- plan
- subscriptionStatus
- trialEndsAt
- currentPeriodEndsAt

Subscription statuses:
- TRIALING
- ACTIVE
- PAST_DUE
- CANCELED
- EXPIRED

Create SubscriptionGuard:
- Reads tenant from req.tenant
- Allows access if tenant subscription is valid
- Blocks paid features if not subscribed

Example decorator:
@RequiredPlan('PRO')
or
@RequiresFeature('API_KEYS')

Use cases:
- free plan can manage menu
- pro plan can use analytics
- enterprise plan can use API keys/webhooks

10. Add API keys for subscribed users separately from login auth

Do not use user JWT refresh tokens as API keys.

Create API key system for external integrations.

Model example:
model ApiKey {
  id          String    @id @default(cuid())
  name        String
  keyPrefix   String
  keyHash     String
  tenantId    String
  tenant      Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  createdById String
  createdBy   User      @relation(fields: [createdById], references: [id])
  scopes      String[]
  lastUsedAt  DateTime?
  expiresAt   DateTime?
  revokedAt   DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([tenantId])
  @@index([keyPrefix])
  @@index([revokedAt])
}

Generate API key:
- Format: sk_live_prefix.secret or sk_test_prefix.secret
- Show raw key only once.
- Store only hash(secret).
- Store prefix for lookup/display.
- Allow revoke/regenerate.

ApiKeyGuard:
- Read x-api-key or Authorization: Bearer
- Split prefix/secret
- Find by prefix
- Verify hash
- Check tenant active
- Check subscription allows API access
- Check scopes
- Attach tenant/apiKey to request

Scopes:
- read:menu
- write:menu
- read:orders
- write:orders
- read:tables
- write:tables
- read:analytics

11. Add rate limiting

Add rate limiting to:
- POST /auth/login
- POST /auth/refresh
- POST /auth/logout
- password reset request
- OTP endpoints if added
- API key endpoints

For login:
- Limit by IP
- Limit by email
- Consider progressive delay after failed attempts

Example:
- 5 failed attempts per minute per IP/email
- lock or slow down after repeated failures

Use @nestjs/throttler or Redis-backed limiter for production.

12. Add password security

Password hashing:
- Use Argon2id if possible
- bcrypt is acceptable if configured properly

Password rules:
- Minimum 8 or 10 characters
- Do not force weird symbol rules too aggressively
- Block common weak passwords if practical

Add:
- passwordChangedAt DateTime?
- forcePasswordReset Boolean @default(false)

When password changes:
- revoke all refresh tokens for the user
- optionally invalidate access tokens by checking iat > passwordChangedAt for sensitive routes

13. Add forgot password flow

Implement secure password reset:
- POST /auth/forgot-password
- POST /auth/reset-password

PasswordResetToken model:
- id
- tokenHash
- userId
- expiresAt
- usedAt
- createdAt

Use same tokenId.secret pattern.
Send reset link by email.
Token expires in 15–30 minutes.
After reset:
- mark token used
- update password hash
- revoke all refresh tokens
- optionally notify user

Do not reveal whether email exists:
Return same message:
"If an account exists, a reset link has been sent."

14. Add email verification

For SaaS, add email verification.

User fields:
- emailVerifiedAt DateTime?

EmailVerificationToken:
- id
- tokenHash
- userId
- expiresAt
- usedAt
- createdAt

On signup/invite:
- send verification email
- restrict sensitive actions until verified

15. Add staff invitation flow

For hotel/restaurant SaaS, staff should often be invited.

Do not let frontend submit arbitrary role freely.

Owner/Admin invite flow:
- OWNER or ADMIN invites staff by email
- Server creates invitation with role selected by authorized inviter
- Role must be validated against allowed roles
- STAFF cannot invite OWNER
- ADMIN may not be allowed to invite OWNER depending policy

Invitation model:
model TenantInvitation {
  id          String
  tenantId    String
  email       String
  role        TenantRole
  tokenHash   String
  expiresAt   DateTime
  acceptedAt  DateTime?
  revokedAt   DateTime?
  invitedById String
  createdAt   DateTime
}

Accept invite:
- verify token
- create user if needed or attach existing user
- create TenantMember with invited role
- mark invitation accepted

16. Add audit logs

Add audit logging for sensitive actions:
- login success
- login failure
- logout
- refresh token reuse detected
- password changed
- tenant created
- tenant suspended
- member invited
- member role changed
- member disabled
- API key created
- API key revoked
- subscription changed
- menu/table/order sensitive changes if needed

AuditLog model:
model AuditLog {
  id          String   @id @default(cuid())
  actorUserId String?
  tenantId    String?
  action      String
  targetType  String?
  targetId    String?
  ipAddress   String?
  userAgent   String?
  metadata    Json?
  createdAt   DateTime @default(now())

  @@index([actorUserId])
  @@index([tenantId])
  @@index([action])
  @@index([createdAt])
}

17. Add CSRF protection if using cookies

If refresh token is in httpOnly cookie and same-site setup is not enough, add CSRF protection.

Options:
- sameSite=strict/lax if frontend/backend same site
- CSRF token for state-changing endpoints
- double-submit cookie pattern

At minimum:
- Use SameSite=Lax or Strict
- Use CORS allowlist
- Do not allow wildcard credentials CORS

18. Harden CORS

Configure CORS strictly.

Allowed origins:
- local frontend in development
- production frontend domain

Do not use:
origin: '*'
credentials: true

Use:
credentials: true
origin: [FRONTEND_URL]

19. Add ConfigModule validation

Do not use process.env.JWT_ACCESS_SECRET! directly without validation.

Use ConfigModule with Joi or Zod.

Required env:
- DATABASE_URL
- JWT_ACCESS_SECRET
- JWT_ACCESS_EXPIRES_IN
- REFRESH_TOKEN_DAYS
- FRONTEND_URL
- NODE_ENV
- COOKIE_DOMAIN optional
- SMTP settings if email added

App should fail at startup if required env is missing.

20. Improve JwtStrategy

Current JwtStrategy validates payload and returns:
- id
- email
- systemRole

Improve:
- Validate payload shape
- Optionally load user from DB if route needs stronger account status check
- At least ensure required claims exist
- Do not put sensitive data in JWT

Access token payload:
{
  sub: user.id,
  email: user.email,
  systemRole: user.systemRole,
  type: "access"
}

Optional:
- jti for token id
- iat included automatically
- iss/aud claims if needed

21. Add proper HTTP status codes

NestJS POST returns 201 by default.
For auth actions use 200.

Add:
@HttpCode(HttpStatus.OK)

For:
- login
- refresh
- logout

22. Add DTO validation and global ValidationPipe

Ensure main.ts has:
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
);

DTOs:
- LoginDto
- RefreshTokenDto
- SignupDto
- InviteMemberDto
- AcceptInviteDto
- ForgotPasswordDto
- ResetPasswordDto

Add:
- @IsEmail()
- @IsString()
- @MinLength(8)
- @IsEnum()
- @IsOptional()
- @IsUUID() or cuid validation where relevant

23. Add OpenAPI/Swagger accuracy

Update Swagger docs:
- refresh token should not appear in JSON response after moving to cookies
- document cookie usage
- document Authorization bearer for protected endpoints
- document tenant role requirements if possible

24. Add tests

Create tests for:

Auth:
- login success
- login invalid email
- login invalid password
- disabled user cannot login
- access token contains expected claims
- refresh success rotates token
- old refresh token cannot be reused
- refresh reuse revokes all user sessions
- logout revokes refresh token
- expired refresh token rejected

Tenant:
- user can access own tenant
- user cannot access other tenant
- disabled membership blocked
- suspended tenant blocked
- role guard allows OWNER
- role guard blocks STAFF for admin action

API keys:
- subscribed tenant can create API key
- free tenant cannot create API key
- revoked API key rejected
- invalid scope rejected

Security:
- rate limit blocks repeated login attempts
- CORS config is not wildcard with credentials
- DTO strips unknown fields

25. Suggested final architecture

Modules:
- AuthModule
- UsersModule
- TenantsModule
- MembershipsModule
- SubscriptionsModule
- ApiKeysModule
- AuditLogsModule
- MailModule

Guards:
- JwtAuthGuard
- OptionalJwtAuthGuard
- SystemRolesGuard
- TenantGuard
- TenantRolesGuard
- SubscriptionGuard
- ApiKeyGuard
- ScopesGuard

Decorators:
- @Public()
- @CurrentUser()
- @CurrentTenant()
- @CurrentMembership()
- @SystemRoles()
- @TenantRoles()
- @RequiredPlan()
- @RequiredFeature()
- @ApiScopes()

26. Acceptance criteria

After implementing:
- Refresh token lookup must be O(1), not scanning all tokens.
- Raw refresh tokens must never be stored.
- Refresh token must be rotated on every refresh.
- Reusing an old refresh token must revoke the user’s active sessions.
- Refresh token should be stored in httpOnly cookie in production browser flow.
- Login must only return active tenant memberships.
- Every tenant-owned route must verify active membership.
- Tenant role checks must come from DB membership, not request body.
- System roles and tenant roles must stay separate.
- Disabled users cannot login or refresh.
- Suspended tenants cannot be accessed.
- Login endpoint must be rate-limited.
- API keys must be separate from user login tokens.
- API keys must be hashed, scoped, revocable, and tenant-bound.
- Config env vars must be validated at startup.
- Tests must cover auth, refresh rotation, tenant isolation, and role checks.

Refactor carefully without breaking existing API behavior unless necessary.
Prefer small, clear services and guards.
Add comments only where security decisions may not be obvious.