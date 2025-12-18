---
description: Scaffold a new Clean Architecture module
argument-hint: <module-name>
---

Create a new module following Clean Architecture for: $ARGUMENTS

## Structure to Create

```
apps/api/src/modules/<module-name>/
├── domain/
│   └── entities/
│       ├── <entity>.entity.ts
│       └── index.ts
├── application/
│   ├── services/
│   │   ├── <module>.service.ts
│   │   └── index.ts
│   └── use-cases/              # Optional, for complex operations
│       └── index.ts
├── infrastructure/
│   └── repositories/
│       ├── <module>.repository.interface.ts   # Interface + token constant
│       ├── <module>.repository.ts             # Implementation
│       └── index.ts
├── presentation/
│   ├── controllers/
│   │   ├── <module>.controller.ts
│   │   └── index.ts
│   └── dto/
│       ├── <module>/
│       │   ├── create-<entity>.dto.ts
│       │   └── update-<entity>.dto.ts
│       └── index.ts
├── <module>.module.ts
└── index.ts
```

## Key Patterns to Follow

### Repository Interface (infrastructure/repositories/<module>.repository.interface.ts)

```typescript
export const <MODULE>_REPOSITORY = '<MODULE>_REPOSITORY';

export interface I<Module>Repository {
  findByUserId(userId: string): Promise<Entity[]>;
  findById(id: string): Promise<Entity | null>;
  create(data: CreateDto, userId: string): Promise<Entity>;
  update(id: string, data: UpdateDto): Promise<Entity>;
  delete(id: string): Promise<void>;
}
```

### Module Registration (<module>.module.ts)

```typescript
import { Module } from '@nestjs/common';
import { DatabaseService } from '@/shared/database';
import { <MODULE>_REPOSITORY, <Module>Repository } from './infrastructure/repositories';
import { <Module>Service } from './application/services';
import { <Module>Controller } from './presentation/controllers';

@Module({
  controllers: [<Module>Controller],
  providers: [
    // Repository with factory provider
    {
      provide: <MODULE>_REPOSITORY,
      useFactory: (db: DatabaseService) => new <Module>Repository(db),
      inject: [DatabaseService],
    },
    // Services
    <Module>Service,
  ],
  exports: [<Module>Service],
})
export class <Module>Module {}
```

### Controller (presentation/controllers/<module>.controller.ts)

```typescript
import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SupabaseAuthGuard, CurrentUser, AuthUser } from '@/modules/auth';

@ApiTags('<Module>')
@Controller('<module>')  // No /api/v1/ prefix
@UseGuards(SupabaseAuthGuard)
export class <Module>Controller {
  constructor(private readonly service: <Module>Service) {}

  @Get()
  @ApiOperation({ summary: 'List all <module>' })
  findAll(@CurrentUser() user: AuthUser) {
    return this.service.findByUserId(user.id);
  }
}
```

### Service (application/services/<module>.service.ts)

```typescript
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { <MODULE>_REPOSITORY, I<Module>Repository } from '../../infrastructure/repositories';

@Injectable()
export class <Module>Service {
  constructor(
    @Inject(<MODULE>_REPOSITORY)
    private readonly repository: I<Module>Repository,
  ) {}

  async findByUserId(userId: string) {
    return this.repository.findByUserId(userId);
  }
}
```

## Requirements

1. Follow existing patterns from the portfolio module
2. Use factory providers for repository DI
3. Include Swagger documentation on all endpoints
4. Add barrel exports (index.ts files) at each level
5. Register the module in AppModule
6. Use repository token constants (not string literals)
