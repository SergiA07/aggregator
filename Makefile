# Portfolio Aggregator Monorepo
# Run 'make help' to see available commands

.PHONY: help setup dev dev-api dev-web dev-python clean clean-all \
        build lint type-check test db-generate db-push db-reset db-studio \
        kill-ports logs

# Default target - show help
help:
	@echo "Portfolio Aggregator - Available Commands"
	@echo ""
	@echo "Setup & Development:"
	@echo "  make setup       - First-time project setup (install deps, generate db)"
	@echo "  make dev         - Start all services (API, Web, Python)"
	@echo "  make dev-api     - Start only the API server"
	@echo "  make dev-web     - Start only the Web frontend"
	@echo "  make dev-python  - Start only the Python service"
	@echo ""
	@echo "Quality:"
	@echo "  make build       - Build all packages"
	@echo "  make lint        - Run linter on all packages"
	@echo "  make type-check  - Run TypeScript type checking"
	@echo "  make test        - Run tests"
	@echo ""
	@echo "Database:"
	@echo "  make db-generate - Generate Prisma client"
	@echo "  make db-push     - Push schema changes to database"
	@echo "  make db-reset    - Reset database (WARNING: deletes all data)"
	@echo "  make db-studio   - Open Prisma Studio"
	@echo ""
	@echo "Utilities:"
	@echo "  make clean       - Remove build artifacts and caches"
	@echo "  make clean-all   - Remove everything including node_modules"
	@echo "  make kill-ports  - Kill processes on dev ports (3333, 5173, 8000)"
	@echo "  make logs        - Show recent git log"

# =============================================================================
# Setup & Development
# =============================================================================

setup:
	@echo "Installing dependencies..."
	bun install
	@echo "Setting up Python environment..."
	cd apps/python-service && uv sync
	@echo "Generating Prisma client..."
	bun run db:generate
	@echo ""
	@echo "Setup complete! Run 'make dev' to start development servers."

dev: kill-ports
	bun run dev

dev-api:
	bun run dev:api

dev-web:
	bun run dev:web

dev-python:
	bun run dev:python

# =============================================================================
# Quality
# =============================================================================

build:
	bun run build

lint:
	bun run lint

type-check:
	bun run type-check

test:
	bun run test

# =============================================================================
# Database
# =============================================================================

db-generate:
	bun run db:generate

db-push:
	bun run db:push

db-reset:
	@echo "WARNING: This will delete all data in the database!"
	@read -p "Are you sure? [y/N] " confirm && [ "$$confirm" = "y" ] || exit 1
	cd packages/database && bunx prisma db push --force-reset
	@echo "Database reset complete."

db-studio:
	bun run db:studio

# =============================================================================
# Utilities
# =============================================================================

clean:
	@echo "Cleaning build artifacts and caches..."
	rm -rf .turbo
	rm -rf apps/*/.turbo
	rm -rf packages/*/.turbo
	rm -rf apps/*/dist
	rm -rf packages/*/dist
	rm -rf apps/web/.vite
	@echo "Clean complete."

clean-all: clean
	@echo "Removing node_modules..."
	rm -rf node_modules
	rm -rf apps/*/node_modules
	rm -rf packages/*/node_modules
	rm -rf apps/python-service/.venv
	@echo "Full clean complete. Run 'make setup' to reinstall."

kill-ports:
	@lsof -ti:3333,5173,8000 | xargs kill -9 2>/dev/null || true

logs:
	git log --oneline -20
