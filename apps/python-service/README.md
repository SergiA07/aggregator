# Python Service

FastAPI service for operations not well-suited for JavaScript, including Trade Republic integration.

## Tech Stack

- **FastAPI** - Async Python web framework
- **pytr** - Trade Republic private API client
- **BeautifulSoup4** - HTML parsing for web scraping
- **httpx** - Async HTTP client
- **uvicorn** - ASGI server
- **uv** - Package manager

## Setup

```bash
cd apps/python-service

# Install dependencies with uv
uv sync

# Start the service
uv run uvicorn main:app --reload --port 8000
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `API_KEY` | API key for authenticating requests from NestJS API | `dev-api-key-change-in-production` |

## Endpoints

### Health Check

```
GET /health
```

### Trade Republic Sync

Enables syncing portfolio data from Trade Republic via their private API.

**Security**: All Trade Republic endpoints require `X-API-Key` header matching the `API_KEY` environment variable.

#### Initialize Login

```
POST /trade-republic/login/init
```

Starts the 2FA login flow. Sends a verification code to the user's Trade Republic app.

**Request:**
```json
{
  "phone_number": "+49123456789",
  "pin": "1234"
}
```

**Response:**
```json
{
  "session_id": "uuid",
  "expires_in_seconds": 120,
  "message": "Verification code sent..."
}
```

#### Complete Login

```
POST /trade-republic/login/complete
```

Completes login with verification code and fetches portfolio data.

**Request:**
```json
{
  "session_id": "uuid",
  "verify_code": "1234"
}
```

**Response:**
```json
{
  "success": true,
  "transactions": [...],
  "positions": [...],
  "cashBalances": [{"currency": "EUR", "amount": 34588.21}],
  "total_transactions": 42
}
```

#### Resend Code

```
POST /trade-republic/login/resend?session_id=uuid
```

Resends the verification code to the user's device.

#### Cancel Session

```
DELETE /trade-republic/session/{session_id}
```

Cancels a pending login session.

### Web Scraping

```
POST /scrape/url
GET /scrape/sources
```

### YouTube Transcripts

```
POST /youtube/transcript
POST /youtube/batch
```

## Architecture

The Trade Republic integration uses the `pytr` library to connect to Trade Republic's private WebSocket API:

1. **Login Init** - Creates a session and initiates 2FA
2. **Login Complete** - Verifies code and fetches:
   - Timeline transactions (buy/sell/dividend/interest)
   - Portfolio positions
   - Cash balances
3. **Data returned** to NestJS API for import

Sessions are stored in-memory and expire after 2 minutes.

## Security Notes

- User credentials are NEVER stored - used only for the TR API call
- Sessions expire after 2 minutes
- API key required for all requests (prevents direct frontend access)
- The NestJS API proxies requests, keeping the API key server-side
