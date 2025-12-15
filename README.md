# My Aggregator Monorepo

This is a monorepo project organized with [Turbo](https://turbo.build/) and [Bun](https://bun.sh/). It includes a Vite React web application, a Python service, and a Supabase backend.

## Prerequisites

Before starting, ensure you have the following installed:

- **[Bun](https://bun.sh/)**: JavaScript runtime and package manager.
- **[uv](https://github.com/astral-sh/uv)**: An extremely fast Python package installer and resolver.
- **[Docker](https://www.docker.com/)**: Required for running Supabase locally.
- **Node.js & npm**: Required for some scripts (like `npx`).

## Setup

1.  **Install Dependencies**

    ```bash
    bun install
    ```

2.  **Environment Setup**

    Copy the example environment file to `.env`:

    ```bash
    cp .env.example .env
    ```

    Open `.env` and verify the configuration. The defaults are usually set up for local development with the standard Supabase ports.

3.  **Database Setup (Supabase)**

    Start the local Supabase instance:

    ```bash
    npx supabase start
    ```

    Push the database schema:

    ```bash
    bun run db:push
    ```

    *Note: If you don't have the Supabase CLI installed globally, `npx` will download and run it for you.*

## Running the Project

To start all services (API, Web, and Python service) in development mode:

```bash
bun run dev
```

This command uses `concurrently` to run:
- `@repo/api`: The Node.js API
- `@repo/web`: The Vite React frontend
- `apps/python-service`: The Python backend (using `uv` to run `uvicorn`)

## Services

- **Web**: Access at `http://localhost:5173` (default Vite port, check terminal output)
- **Supabase Studio**: Access at `http://localhost:54323` (or the port shown in `supabase start` output)
- **Python Service**: Runs on port `8000`
