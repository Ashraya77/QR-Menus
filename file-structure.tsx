menus/
├── apps/
│   ├── web/
│   │   └── src/
│   │       ├── app/
│   │       │   ├── (auth)/
│   │       │   │   ├── login/
│   │       │   │   │   └── page.tsx
│   │       │   │   └── register/
│   │       │   │       └── page.tsx
│   │       │   ├── (dashboard)/
│   │       │   │   ├── layout.tsx               # Sidebar + auth guard
│   │       │   │   ├── dashboard/
│   │       │   │   │   └── page.tsx
│   │       │   │   ├── menus/
│   │       │   │   │   ├── page.tsx             # List menus
│   │       │   │   │   └── [menuId]/
│   │       │   │   │       ├── page.tsx         # Edit menu
│   │       │   │   │       └── categories/
│   │       │   │   │           └── [categoryId]/
│   │       │   │   │               └── page.tsx # Edit category + items
│   │       │   │   ├── tables/
│   │       │   │   │   ├── page.tsx             # List tables + QR codes
│   │       │   │   │   └── [tableId]/
│   │       │   │   │       └── page.tsx         # QR code view + print
│   │       │   │   └── settings/
│   │       │   │       └── page.tsx             # Tenant profile, logo, etc.
│   │       │   ├── (menu)/
│   │       │   │   └── m/
│   │       │   │       └── [tenant]/
│   │       │   │           └── [tableId]/
│   │       │   │               └── page.tsx     # Customer-facing menu
│   │       │   ├── layout.tsx                   # Root layout
│   │       │   └── page.tsx                     # → redirect to /dashboard
│   │       ├── components/
│   │       │   ├── ui/                          # Primitives (Button, Input, Modal…)
│   │       │   ├── dashboard/                   # Dashboard-specific components
│   │       │   │   ├── Sidebar.tsx
│   │       │   │   ├── MenuCard.tsx
│   │       │   │   ├── CategoryList.tsx
│   │       │   │   ├── ItemForm.tsx
│   │       │   │   └── QRCodeCard.tsx
│   │       │   └── menu/                        # Customer menu components
│   │       │       ├── MenuView.tsx
│   │       │       ├── CategorySection.tsx
│   │       │       └── ItemCard.tsx
│   │       ├── lib/
│   │       │   ├── api.ts                       # Fetch wrapper for NestJS API
│   │       │   └── auth.ts                      # Auth helpers (token storage etc.)
│   │       └── hooks/
│   │           ├── useMenu.ts
│   │           ├── useTables.ts
│   │           └── useAuth.ts
│   │
│   └── api/
│       └── src/
│           ├── auth/
│           │   ├── auth.module.ts
│           │   ├── auth.controller.ts
│           │   ├── auth.service.ts              # register, login, JWT signing
│           │   ├── strategies/
│           │   │   └── jwt.strategy.ts
│           │   └── dto/
│           │       ├── register.dto.ts
│           │       └── login.dto.ts
│           │
│           ├── tenants/
│           │   ├── tenants.module.ts
│           │   ├── tenants.controller.ts
│           │   ├── tenants.service.ts
│           │   ├── tenants.repository.ts        # DB access only
│           │   ├── entities/
│           │   │   └── tenant.entity.ts
│           │   └── dto/
│           │       ├── create-tenant.dto.ts
│           │       └── update-tenant.dto.ts
│           │
│           ├── menus/
│           │   ├── menus.module.ts
│           │   ├── menus.controller.ts
│           │   ├── menus.service.ts
│           │   ├── menus.repository.ts
│           │   ├── categories/
│           │   │   ├── categories.controller.ts
│           │   │   ├── categories.service.ts
│           │   │   ├── categories.repository.ts
│           │   │   ├── entities/
│           │   │   │   └── category.entity.ts
│           │   │   └── dto/
│           │   │       ├── create-category.dto.ts
│           │   │       └── update-category.dto.ts
│           │   ├── items/
│           │   │   ├── items.controller.ts
│           │   │   ├── items.service.ts
│           │   │   ├── items.repository.ts
│           │   │   ├── entities/
│           │   │   │   └── item.entity.ts
│           │   │   └── dto/
│           │   │       ├── create-item.dto.ts
│           │   │       └── update-item.dto.ts
│           │   ├── entities/
│           │   │   └── menu.entity.ts
│           │   └── dto/
│           │       ├── create-menu.dto.ts
│           │       └── update-menu.dto.ts
│           │
│           ├── tables/
│           │   ├── tables.module.ts
│           │   ├── tables.controller.ts
│           │   ├── tables.service.ts
│           │   ├── tables.repository.ts
│           │   ├── entities/
│           │   │   └── table.entity.ts
│           │   └── dto/
│           │       ├── create-table.dto.ts
│           │       └── update-table.dto.ts
│           │
│           ├── common/
│           │   ├── guards/
│           │   │   ├── jwt-auth.guard.ts        # Protects private routes
│           │   │   └── tenant.guard.ts          # Scopes requests to tenantId
│           │   ├── decorators/
│           │   │   ├── current-user.decorator.ts
│           │   │   └── public.decorator.ts      # Mark routes as public
│           │   ├── interceptors/
│           │   │   └── tenant-scope.interceptor.ts  # Auto-injects tenantId
│           │   ├── filters/
│           │   │   └── http-exception.filter.ts
│           │   └── pipes/
│           │       └── validation.pipe.ts
│           │
│           ├── database/
│           │   ├── database.module.ts
│           │   └── prisma.service.ts            # PrismaClient wrapper
│           │
│           ├── app.module.ts
│           └── main.ts
│
└── packages/
    ├── types/
    │   ├── package.json
    │   └── index.ts
    │       ├── Tenant
    │       ├── Menu
    │       ├── Category
    │       ├── MenuItem
    │       ├── Table
    │       └── AuthUser
    │
    └── utils/
        ├── package.json
        └── index.ts
            ├── buildMenuUrl()
            ├── formatPrice()
            └── slugify()