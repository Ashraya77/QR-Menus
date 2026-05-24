# QR Menus API Auth Guide

This auth system is for a multi-tenant SaaS app. The main goal is simple:

Users log in once, then the backend decides which restaurant/hotel tenant they can access by checking database membership.


## Big Picture

The auth system has three separate layers:

```txt
Login identity
  -> Who is this user?

Tenant membership
  -> Which tenant can this user access?

Tenant/system permissions
  -> What can this user do there?
```

Do not mix these up.


## Tokens

### Access Token

The access token is a JWT.

It is short-lived and currently expires in about 15 minutes.

Payload shape:

```ts
{
  sub: user.id,
  email: user.email,
  systemRole: user.systemRole,
  type: 'access'
}
```
 
Meaning:
The JWT proves identity, but tenant permissions still come from the database.


### Refresh Token

The refresh token is an opaque random token.

Shape:

```txt
tokenId.secret
```

Example:

```txt
rt_abc123.randomSecretHere
```

Storage rule:
- Store `tokenId` as `RefreshToken.id`.
- Store only `hash(secret)` in `tokenHash`.
- Never store the raw token.

Meaning:
Refresh lookup is fast because the app finds one token row by id, then verifies the secret hash.


## Login Flow

Endpoint:

```txt
POST /auth/login
```

What happens:

1. Normalize email.
2. Find the user.
3. Reject if the user does not exist.
4. Reject if `user.status !== ACTIVE`.
5. Verify password with Argon2.
6. Fetch only active memberships on active tenants.
7. Create access token.
8. Create refresh token.
9. Store hashed refresh secret.
10. Set refresh token in an httpOnly cookie.
11. Return access token, user profile, and active tenants.

Important:
Login does not return disabled/invited memberships.


## Refresh Flow

Endpoint:

```txt
POST /auth/refresh
```

What happens:

1. Read refresh token from the httpOnly cookie.
2. Split it into `tokenId` and `secret`.
3. Find `RefreshToken` by `id`.
4. Verify the stored hash against the secret.
5. Reject if expired.
6. Reject if user is disabled.
7. Revoke old refresh token.
8. Create a new refresh token.
9. Set the new refresh token cookie.
10. Return a new access token.

Important:
Refresh tokens rotate every time. Old tokens should not work again.


## Refresh Token Reuse Detection

If an already-revoked refresh token is used again, that is suspicious.

What the app does:

1. Detects the old token was already revoked.
2. Revokes all active refresh tokens for that user.
3. Writes a best-effort audit log.
4. Throws unauthorized.

Meaning:
If a stolen refresh token is replayed, all sessions for that user are killed.


## Logout Flow

Endpoint:

```txt
POST /auth/logout
```

What happens:

1. Read refresh token from cookie.
2. Verify it.
3. Mark it revoked.
4. Set revoke reason to `LOGOUT`.
5. Clear the refresh cookie.
6. Return success.


## Cookies

Refresh tokens are stored in an httpOnly cookie.

Cookie name:

```txt
qr_refresh_token
```

Cookie settings:
- `httpOnly: true`
- `secure: true` in production
- `sameSite: lax`
- `path: /auth`
- `maxAge: 30 days`

Meaning:
Frontend JavaScript should not store or read refresh tokens.


## Passwords

Passwords are hashed with Argon2.

Important rules:
- Never store raw passwords.
- Never log passwords.
- Password DTOs require a minimum length.
- When password reset is fully implemented, refresh tokens should be revoked after password change.


## Guards

Guards are how protected routes make decisions.


### JwtAuthGuard

Checks the access token.

If a route is not marked `@Public()`, the user must send:

```txt
Authorization: Bearer <accessToken>
```

File:

```txt
common/guards/jwt-auth.guard.ts
```


### TenantGuard

Checks tenant membership.

It verifies:
- User is authenticated.
- Tenant exists.
- Tenant is active.
- User has an active membership in that tenant.

It attaches:

```ts
request.tenant
request.membership
```

Meaning:
Tenant-owned routes should never trust only a frontend `tenantId`.

File:

```txt
common/guards/tenant.guard.ts
```


### TenantRoleGuard

Checks tenant-level role.

Example:

```ts
@TenantRoles(TenantRole.OWNER, TenantRole.ADMIN)
```

It reads the role from `request.membership`, not from the request body and not from the JWT.

File:

```txt
common/guards/tenant-role.guard.ts
```


### SystemRoleGuard

Checks platform-level role.

Example:

```ts
@SystemRoles(SystemRole.SUPER_ADMIN)
```

Use this only for platform admin routes.

Do not use `systemRole` for restaurant permissions.

File:

```txt
common/guards/system-role.guard.ts
```


### SubscriptionGuard

Checks whether the tenant plan/subscription allows a feature.

Example future usage:

```ts
@RequiredPlan(Plan.PRO)
@RequiredFeature('API_KEYS')
```

Meaning:
This is how paid SaaS features are gated.

File:

```txt
common/guards/subscription.guard.ts
```


### ApiKeyGuard

Used for external integrations, not browser login.

It reads API keys from:
- `x-api-key`
- or `Authorization: Bearer <apiKey>`

API key shape:

```txt
prefix.secret
```

The app stores:
- prefix for lookup
- hash(secret) for verification

File:

```txt
common/guards/api-key.guard.ts
```


### AuthRateLimitGuard

Limits repeated auth attempts.

Current use:
- login
- refresh
- logout

Meaning:
This slows down brute-force and noisy auth abuse.

File:

```txt
common/guards/auth-rate-limit.guard.ts
```


## Decorators

Useful auth decorators:

```ts
@Public()
@CurrentUser()
@CurrentTenant()
@CurrentMembership()
@SystemRoles(...)
@TenantRoles(...)
@RequiredPlan(...)
@RequiredFeature(...)
@ApiScopes(...)
```

Meaning:
Decorators describe what a route needs. Guards enforce it.


## Decorator Map

### @Public()

Marks a route as not requiring JWT auth.

File:

```txt
common/decorators/public.decorator.ts
```


### @CurrentUser()

Reads the authenticated user from the request.

File:

```txt
common/decorators/current-user.decorator.ts
```


### @CurrentTenant()

Reads the tenant attached by `TenantGuard`.

File:

```txt
common/decorators/current-tenant.decorator.ts
```


### @CurrentMembership()

Reads the tenant membership attached by `TenantGuard`.

File:

```txt
common/decorators/current-membership.decorator.ts
```


### @SystemRoles(...)

Declares platform-level roles required by `SystemRoleGuard`.

Example:

```ts
@SystemRoles(SystemRole.SUPER_ADMIN)
```

File:

```txt
common/decorators/system-roles.decorator.ts
```


### @TenantRoles(...)

Declares tenant-level roles required by `TenantRoleGuard`.

Example:

```ts
@TenantRoles(TenantRole.OWNER, TenantRole.ADMIN)
```

File:

```txt
common/decorators/tenant-roles.decorator.ts
```


### @RequiredPlan(...) and @RequiredFeature(...)

Declare subscription requirements checked by `SubscriptionGuard`.

Example:

```ts
@RequiredPlan(Plan.PRO)
@RequiredFeature('API_KEYS')
```

File:

```txt
common/decorators/subscription.decorator.ts
```


### @ApiScopes(...)

Declares API key scopes required by `ApiKeyGuard`.

Example:

```ts
@ApiScopes('read:menu', 'write:menu')
```

File:

```txt
common/decorators/api-scopes.decorator.ts
```


## Important Files

Auth logic:

```txt
src/auth/auth.service.ts
```

Auth routes:

```txt
src/auth/auth.controller.ts
```

JWT validation:

```txt
src/auth/strategies/jwt.strategy.ts
```

Password hashing:

```txt
src/auth/password.service.ts
```

Guards:

```txt
common/guards/
```

Decorators:

```txt
common/decorators/
```

Schema:

```txt
prisma/schema.prisma
```


## Security Rules To Remember

- Access tokens are short-lived.
- Refresh tokens are rotated.
- Raw refresh tokens are never stored.
- Refresh token reuse revokes all active sessions.
- Disabled users cannot log in or refresh.
- Tenant access must be checked from `TenantMember`.
- Tenant role must come from the database.
- System role and tenant role are different things.
- Refresh tokens belong in httpOnly cookies, not localStorage.
- API keys are separate from login tokens.
- Audit sensitive actions.


## Mental Model

Use this when thinking about any protected route:

```txt
Is the user authenticated?
  -> JwtAuthGuard

Which tenant are they trying to access?
  -> TenantGuard

Are they a member of that tenant?
  -> TenantGuard

Do they have the right tenant role?
  -> TenantRoleGuard

Is this a platform admin route?
  -> SystemRoleGuard

Is this a paid feature?
  -> SubscriptionGuard
```

That is the auth system in one sentence:

Authenticate the user with JWT, authorize tenant access through database membership, then enforce tenant/system/subscription permissions with guards.
