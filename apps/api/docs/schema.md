# QR Menus API Schema Guide

This schema models a multi-tenant SaaS backend for restaurants, hotels, cafes, and similar businesses. The important idea is:

Each platform user can belong to many tenants, and every tenant owns its own menus, tables, members, API keys, subscription state, and audit history.


## Core Identity

### User

Represents a person who can log in.

Key fields:
- `email` is unique.
- `passwordHash` stores the hashed password, never the raw password.
- `systemRole` is platform-level access, such as `SUPER_ADMIN`.
- `status` lets the app disable accounts.
- `passwordChangedAt`, `forcePasswordReset`, and `emailVerifiedAt` support future security flows.

Important relation:
- A user can have many `TenantMember` records.

Meaning:
A user is not automatically allowed into every restaurant. Access comes from memberships.


## Tenants

### Tenant

Represents one restaurant, hotel, cafe, or business account.

Key fields:
- `name` and `slug` identify the tenant.
- `status` blocks suspended tenants.
- `plan` and `subscriptionStatus` support SaaS billing rules.
- `trialEndsAt` and `currentPeriodEndsAt` support subscription expiry.

Important relations:
- A tenant has many members.
- A tenant owns menus and tables.
- A tenant owns API keys.
- A tenant has audit logs.

Meaning:
Tenant data is the main isolation boundary. Most business data must always be queried by `tenantId`.


## Memberships And Roles

### TenantMember

Connects a `User` to a `Tenant`.

Key fields:
- `role`: `OWNER`, `ADMIN`, or `STAFF`.
- `status`: `INVITED`, `ACTIVE`, or `DISABLED`.
- `userId` and `tenantId` form a unique pair.

Meaning:
This is where tenant-level authorization lives.

Important rule:
Do not trust tenant roles from the frontend or JWT. Check this table from the database.


## Auth Sessions

### RefreshToken

Stores refresh-token sessions safely.

Key fields:
- `id` is the public token id.
- `tokenHash` stores only the hashed secret part.
- `revokedAt` marks a token as unusable.
- `revokedReason` explains why it was revoked.
- `replacedByTokenId` tracks token rotation.
- `ipAddress`, `userAgent`, and `familyId` support audit/security analysis.

Token shape:

```txt
tokenId.secret
```

Only the secret is hashed. The raw token is never stored.

Meaning:
Refresh lookup is fast because the app finds one row by `id`, then verifies the secret hash.


## Menu Data

### Menu

Represents a tenant menu.

Key fields:
- `tenantId` keeps the menu scoped to one tenant.
- `name` is unique per tenant.
- `isActive` controls whether it should be shown.

### Category

Represents a section inside a menu.

Examples:
- Starters
- Mains
- Drinks
- Desserts

Key fields:
- `menuId` scopes the category to a menu.
- `position` controls ordering.
- `isActive` controls visibility.

### Item

Represents one menu item.

Key fields:
- `categoryId` scopes the item to a category.
- `price` is a decimal, not a float.
- `currency` defaults to `USD`.
- `position` controls ordering.
- `isAvailable` controls visibility.

Meaning:
The menu structure is:

```txt
Tenant -> Menu -> Category -> Item
```


## Tables And QR Codes

### Table

Represents a physical table, room, counter, or location that can have a QR code.

Key fields:
- `label` is the human name, like `Table 5`.
- `code` is the stable QR identifier.
- `tenantId` keeps it scoped to one tenant.
- `isActive` lets the tenant disable a QR without deleting it.

Meaning:
Table-specific QR URLs can resolve tenant + table context.


## API Keys

### ApiKey

Represents an integration key for external systems.

Key fields:
- `keyPrefix` is stored for lookup/display.
- `keyHash` stores only the hashed secret.
- `tenantId` binds the key to one tenant.
- `scopes` control what the key can do.
- `revokedAt` disables the key.
- `lastUsedAt` records usage.

Meaning:
API keys are separate from user login sessions. Do not use refresh tokens as API keys.


## Account Recovery And Verification

### PasswordResetToken

Supports forgot-password flow.

Important rule:
Store only a hashed token secret, expire it quickly, and mark it used after reset.

### EmailVerificationToken

Supports email verification.

Important rule:
Use a short-lived token and mark it used after verification.


## Invitations

### TenantInvitation

Supports inviting staff into a tenant.

Key fields:
- `tenantId` says which tenant the invite is for.
- `email` is the invited address.
- `role` is the role selected by an authorized inviter.
- `tokenHash` stores only the hashed invite secret.
- `acceptedAt` and `revokedAt` track state.

Meaning:
The frontend should not be allowed to freely create members with arbitrary roles. The server must enforce who can invite which role.


## Audit Logs

### AuditLog

Records sensitive activity.

Examples:
- Login success/failure
- Logout
- Refresh-token reuse
- Member invited
- API key created/revoked
- Tenant suspended

Key fields:
- `actorUserId` is who did it.
- `tenantId` is where it happened.
- `action` is the event name.
- `metadata` stores extra structured context.

Meaning:
Audit logs help explain what happened after a security or support issue.


## Mental Model

The app is built around these boundaries:

```txt
User
  -> TenantMember
    -> Tenant
      -> Menus
      -> Tables
      -> API Keys
      -> Audit Logs
```

System role answers:

```txt
Can this user manage the whole platform?
```

Tenant role answers:

```txt
What can this user do inside this restaurant/hotel?
```

Subscription answers:

```txt
Is this tenant allowed to use this paid feature?
```


## Rules To Remember

- Always scope tenant-owned queries by `tenantId`.
- Check active membership from the database.
- Keep `systemRole` separate from `TenantMember.role`.
- Never store raw refresh tokens, API keys, reset tokens, or invite tokens.
- Disabled users cannot log in or refresh.
- Suspended tenants should be blocked from private tenant routes.
- API keys are for integrations, not browser login.
- Audit sensitive actions.

