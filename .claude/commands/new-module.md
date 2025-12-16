---
description: Scaffold a new Clean Architecture module
argument-hint: <module-name>
---

Create a new module following Clean Architecture for: $ARGUMENTS

## Structure to Create

```
apps/api/src/modules/<module-name>/
├── domain/
│   ├── entities/
│   │   ├── <entity>.entity.ts
│   │   └── index.ts
│   └── interfaces/
│       └── index.ts
├── application/
│   └── services/
│       ├── <module>.service.ts
│       └── index.ts
├── infrastructure/
│   └── repositories/
│       ├── <module>.repository.interface.ts
│       ├── <module>.repository.ts
│       └── index.ts
├── presentation/
│   ├── controllers/
│   │   ├── <module>.controller.ts
│   │   └── index.ts
│   └── dto/
│       ├── create-<entity>.dto.ts
│       ├── update-<entity>.dto.ts
│       └── index.ts
├── <module>.module.ts
└── index.ts
```

## Requirements

1. Follow existing patterns from the portfolio module
2. Use proper NestJS decorators
3. Include Swagger documentation
4. Set up dependency injection for repositories
5. Add barrel exports (index.ts files)
6. Register the module in AppModule
