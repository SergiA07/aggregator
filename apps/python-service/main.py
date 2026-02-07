import logging
import os
import re
import secrets
import sys
import time
from collections import defaultdict
from datetime import datetime
from typing import Optional

import httpx

# Configure logging - stdout only (no file logging for security)
# Use DEBUG in development, INFO in production
# Check multiple env vars for dev detection (ENV, NODE_ENV, or default to dev if neither set)
_env = os.getenv("ENV") or os.getenv("NODE_ENV") or "development"
_is_dev = _env.lower() in ("development", "dev", "local")
_log_level = logging.DEBUG if _is_dev else logging.INFO
logging.basicConfig(
    level=_log_level,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
tr_logger = logging.getLogger('trade_republic')
from bs4 import BeautifulSoup
from fastapi import Depends, FastAPI, HTTPException, Security
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import APIKeyHeader
from pydantic import BaseModel, Field
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import NoTranscriptFound, TranscriptsDisabled

# Configuration - env vars are passed by deployment platform or set externally
CORS_ORIGINS = os.getenv(
    "CORS_ORIGINS", "http://localhost:5173,http://localhost:3000"
).split(",")

# API Key for service-to-service authentication
# REQUIRED in production: Set PYTHON_SERVICE_API_KEY environment variable
API_KEY = os.getenv("PYTHON_SERVICE_API_KEY")
if not API_KEY:
    if _is_dev:
        API_KEY = "dev-api-key"  # Default for local development only
        logging.warning("Using default dev-api-key. Set PYTHON_SERVICE_API_KEY in production!")
    else:
        raise ValueError(
            "PYTHON_SERVICE_API_KEY environment variable is required in production. "
            "Set it in your environment or deployment platform."
        )
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def verify_api_key(api_key: str = Security(api_key_header)) -> str:
    """Verify API key for protected endpoints."""
    if not api_key or api_key != API_KEY:
        raise HTTPException(
            status_code=401,
            detail="Invalid or missing API key",
        )
    return api_key


# ============== Rate Limiting ==============
# Simple in-memory rate limiter for Trade Republic endpoints
# Prevents brute-force attempts on login

RATE_LIMIT_WINDOW = 60  # seconds
RATE_LIMIT_MAX_REQUESTS = 3  # max attempts per window
_rate_limit_store: dict[str, list[float]] = defaultdict(list)


def check_rate_limit(identifier: str) -> None:
    """
    Check if the identifier has exceeded rate limits.
    Raises HTTPException if rate limit exceeded.
    """
    now = time.time()
    window_start = now - RATE_LIMIT_WINDOW

    # Clean old entries
    _rate_limit_store[identifier] = [
        ts for ts in _rate_limit_store[identifier] if ts > window_start
    ]

    # Check limit
    if len(_rate_limit_store[identifier]) >= RATE_LIMIT_MAX_REQUESTS:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded. Max {RATE_LIMIT_MAX_REQUESTS} attempts per {RATE_LIMIT_WINDOW} seconds.",
        )

    # Record this request
    _rate_limit_store[identifier].append(now)

app = FastAPI(
    title="Portfolio Aggregator - Python Service",
    description="Web scraping and YouTube transcripts service",
    version="1.0.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in CORS_ORIGINS],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============== Models ==============


class ScrapeRequest(BaseModel):
    url: str
    selector: Optional[str] = None  # CSS selector to extract specific content


class ScrapeResponse(BaseModel):
    url: str
    title: Optional[str] = None
    content: str
    success: bool
    error: Optional[str] = None


class TranscriptRequest(BaseModel):
    url: str
    languages: list[str] = ["en", "es", "ca"]


class TranscriptResponse(BaseModel):
    video_id: str
    title: Optional[str] = None
    transcript: str
    language: str
    success: bool
    error: Optional[str] = None


class BatchTranscriptRequest(BaseModel):
    urls: list[str]
    languages: list[str] = ["en", "es", "ca"]


# ============== Health Check ==============


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "python-service",
        "cors_origins": CORS_ORIGINS,
    }


# ============== Scraping Endpoints ==============


@app.post("/scrape/url", response_model=ScrapeResponse)
async def scrape_url(request: ScrapeRequest):
    """Scrape content from a URL (static sites only - no JS rendering)"""
    try:
        async with httpx.AsyncClient(
            timeout=30.0,
            follow_redirects=True,
            headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
            },
        ) as client:
            response = await client.get(request.url)
            response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")

        # Remove script and style elements
        for script in soup(["script", "style", "nav", "footer", "header"]):
            script.decompose()

        # Get title
        title = soup.title.string if soup.title else None

        # Get content
        if request.selector:
            elements = soup.select(request.selector)
            content = "\n".join(el.get_text(strip=True) for el in elements)
        else:
            # Get main content area or body
            main = soup.find("main") or soup.find("article") or soup.find("body")
            content = main.get_text(separator="\n", strip=True) if main else ""

        return ScrapeResponse(
            url=request.url,
            title=title,
            content=content[:50000],  # Limit content size
            success=True,
        )

    except httpx.HTTPStatusError as e:
        return ScrapeResponse(
            url=request.url,
            content="",
            success=False,
            error=f"HTTP error {e.response.status_code}",
        )
    except Exception as e:
        return ScrapeResponse(
            url=request.url, content="", success=False, error=str(e)
        )


@app.get("/scrape/sources")
async def get_scrape_sources():
    """List configured news sources for investment information"""
    return {
        "sources": [
            {
                "name": "Seeking Alpha",
                "url": "https://seekingalpha.com",
                "type": "investment_news",
            },
            {
                "name": "Yahoo Finance",
                "url": "https://finance.yahoo.com",
                "type": "market_data",
            },
            {
                "name": "Reuters Markets",
                "url": "https://www.reuters.com/markets/",
                "type": "financial_news",
            },
            {
                "name": "Bloomberg",
                "url": "https://www.bloomberg.com/markets",
                "type": "financial_news",
            },
        ]
    }


# ============== YouTube Endpoints ==============


def extract_video_id(url: str) -> str:
    """Extract YouTube video ID from various URL formats"""
    patterns = [
        r"(?:v=|\/v\/|youtu\.be\/|\/embed\/)([a-zA-Z0-9_-]{11})",
        r"^([a-zA-Z0-9_-]{11})$",
    ]

    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)

    raise ValueError(f"Could not extract video ID from: {url}")


@app.post("/youtube/transcript", response_model=TranscriptResponse)
async def get_youtube_transcript(request: TranscriptRequest):
    """Get transcript for a YouTube video"""
    try:
        video_id = extract_video_id(request.url)

        # Try to get transcript in preferred languages
        transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)

        transcript = None
        language_used = ""

        # Try manual transcripts first, then auto-generated
        for lang in request.languages:
            try:
                transcript = transcript_list.find_transcript([lang])
                language_used = lang
                break
            except NoTranscriptFound:
                continue

        # Fallback to any available transcript
        if not transcript:
            try:
                transcript = transcript_list.find_generated_transcript(
                    request.languages
                )
                language_used = "auto"
            except NoTranscriptFound:
                # Get first available
                for t in transcript_list:
                    transcript = t
                    language_used = t.language_code
                    break

        if not transcript:
            return TranscriptResponse(
                video_id=video_id,
                transcript="",
                language="",
                success=False,
                error="No transcript available",
            )

        # Fetch and combine transcript text
        transcript_data = transcript.fetch()
        full_text = " ".join(entry["text"] for entry in transcript_data)

        return TranscriptResponse(
            video_id=video_id,
            transcript=full_text,
            language=language_used,
            success=True,
        )

    except TranscriptsDisabled:
        return TranscriptResponse(
            video_id=request.url,
            transcript="",
            language="",
            success=False,
            error="Transcripts are disabled for this video",
        )
    except ValueError as e:
        return TranscriptResponse(
            video_id=request.url,
            transcript="",
            language="",
            success=False,
            error=str(e),
        )
    except Exception as e:
        return TranscriptResponse(
            video_id=request.url,
            transcript="",
            language="",
            success=False,
            error=str(e),
        )


@app.post("/youtube/batch")
async def get_youtube_transcripts_batch(request: BatchTranscriptRequest):
    """Get transcripts for multiple YouTube videos"""
    results = []

    for url in request.urls:
        transcript_request = TranscriptRequest(url=url, languages=request.languages)
        result = await get_youtube_transcript(transcript_request)
        results.append(result)

    return {"results": results, "total": len(results)}


# ============== Trade Republic Integration ==============
# Uses pytr library to fetch transaction data from Trade Republic
# Security: Credentials are never stored, only used for session creation
# Flow: 1) Init web login -> 2) User enters 4-digit code from TR app -> 3) Fetch data

# In-memory session storage (short-lived, cleared on restart)
_tr_sessions: dict[str, dict] = {}
SESSION_TIMEOUT_SECONDS = 120  # 2 minutes to complete 2FA (reduced for security)


class TRLoginInitRequest(BaseModel):
    """Request to initiate Trade Republic login"""

    phone_number: str = Field(
        ...,
        description="Phone number with country code (e.g., +49123456789)",
        pattern=r"^\+[0-9]{10,15}$",
    )
    pin: str = Field(
        ...,
        description="4-digit Trade Republic PIN",
        pattern=r"^[0-9]{4}$",
    )


class TRLoginInitResponse(BaseModel):
    """Response after initiating login - user must enter verification code"""

    session_id: str
    status: str
    message: str
    expires_in_seconds: int


class TRLoginCompleteRequest(BaseModel):
    """Request to complete login with verification code"""

    session_id: str
    verify_code: str = Field(
        ...,
        description="4-digit verification code from TR app",
        pattern=r"^[0-9]{4}$",
    )


class TRTransaction(BaseModel):
    """Parsed Trade Republic transaction"""

    date: str
    type: str
    isin: Optional[str]
    name: str
    quantity: float
    price: float
    amount: float
    currency: str
    fees: float = 0.0


class TRCashBalance(BaseModel):
    """Cash balance for an account"""

    currency: str
    amount: float


class TRSyncResponse(BaseModel):
    """Response with Trade Republic transaction data"""

    success: bool
    transactions: list[TRTransaction] = []
    positions: list[dict] = []
    cashBalances: list[TRCashBalance] = []
    total_transactions: int = 0
    error: Optional[str] = None


@app.post("/trade-republic/login/init", response_model=TRLoginInitResponse)
async def tr_login_init(
    request: TRLoginInitRequest,
    _api_key: str = Depends(verify_api_key),
):
    """
    Step 1: Initiate Trade Republic web login.

    This sends a login request to Trade Republic. The user will receive
    a 4-digit verification code in their Trade Republic app or via SMS.

    Security:
    - Requires API key authentication
    - Rate limited to 3 attempts per minute per phone number
    - Credentials are used only for this request, never stored
    - Session ID is random and expires in 2 minutes
    - All communication uses HTTPS (via pytr)
    """
    # Apply rate limiting by phone number to prevent brute-force
    check_rate_limit(f"tr_login:{request.phone_number}")

    try:
        from pytr.api import TradeRepublicApi

        # Create a unique session ID
        session_id = secrets.token_urlsafe(32)

        # Initialize the TR API
        tr_api = TradeRepublicApi(
            phone_no=request.phone_number,
            pin=request.pin,
            locale="en",
        )

        # Initiate web login - this sends a verification code to user
        # This is a synchronous HTTP request (not WebSocket)
        countdown = tr_api.initiate_weblogin()

        # Store session temporarily (credentials are NOT stored)
        _tr_sessions[session_id] = {
            "api": tr_api,
            "created_at": datetime.now(),
            "status": "awaiting_code",
        }

        return TRLoginInitResponse(
            session_id=session_id,
            status="awaiting_code",
            message="Enter the 4-digit code from your Trade Republic app",
            expires_in_seconds=min(countdown, SESSION_TIMEOUT_SECONDS),
        )

    except ValueError as e:
        # pytr raises ValueError for API errors (wrong credentials, etc.)
        raise HTTPException(
            status_code=400,
            detail=str(e),
        )
    except Exception as e:
        import traceback
        print(f"TR Init Error: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=400,
            detail=f"Failed to initiate Trade Republic login: {str(e)}",
        )


@app.post("/trade-republic/login/complete", response_model=TRSyncResponse)
async def tr_login_complete(
    request: TRLoginCompleteRequest,
    _api_key: str = Depends(verify_api_key),
):
    """
    Step 2: Complete login with verification code and fetch data.

    Submit the 4-digit code received from the TR app, then fetch all data.
    The session is immediately destroyed after use.

    Security:
    - Requires API key authentication
    - Rate limited to 3 attempts per minute per session
    """
    import asyncio

    # Rate limit verification code attempts to prevent brute-force
    check_rate_limit(f"tr_complete:{request.session_id}")
    session = _tr_sessions.get(request.session_id)

    if not session:
        raise HTTPException(
            status_code=404,
            detail="Session not found or expired. Please start a new login.",
        )

    # Check session expiry
    elapsed = (datetime.now() - session["created_at"]).total_seconds()
    if elapsed > SESSION_TIMEOUT_SECONDS:
        del _tr_sessions[request.session_id]
        raise HTTPException(
            status_code=410,
            detail="Session expired. Please start a new login.",
        )

    try:
        tr_api = session["api"]

        # Complete the web login with verification code (synchronous HTTP request)
        tr_api.complete_weblogin(request.verify_code)

        # Get settings to extract securities account number (synchronous HTTP call)
        # This is required by the new TR API for portfolio requests (see pytr issue #246)
        settings_data = tr_api.settings()

        # Extract secAccNo from settings (check multiple possible locations)
        sec_acc_no = None
        if isinstance(settings_data, dict):
            sec_acc_no = settings_data.get("securitiesAccountNumber")
            if not sec_acc_no:
                sec_acc = settings_data.get("securitiesAccount")
                if isinstance(sec_acc, dict):
                    sec_acc_no = sec_acc.get("id")
                elif isinstance(sec_acc, list) and sec_acc:
                    sec_acc_no = sec_acc[0].get("id")
            if not sec_acc_no:
                sec_acc_no = settings_data.get("securitiesAccountId")
            if not sec_acc_no:
                # Check accounts array for securities type
                accounts = settings_data.get("accounts", [])
                for acc in accounts:
                    if acc.get("type") == "securities":
                        sec_acc_no = acc.get("id")
                        break

        tr_logger.info(f"secAccNo = {sec_acc_no}")
        tr_logger.info(f"settings keys = {list(settings_data.keys()) if isinstance(settings_data, dict) else 'not a dict'}")

        # Helper to fetch one response from an async subscription
        async def fetch_one(subscription_coro, timeout=15):
            """Subscribe, get first response, unsubscribe."""
            subscription_id = await subscription_coro
            try:
                return await asyncio.wait_for(
                    tr_api._recv_subscription(subscription_id),
                    timeout=timeout
                )
            finally:
                await tr_api.unsubscribe(subscription_id)

        # Fetch portfolio using the new compactPortfolioByType subscription
        # The old 'portfolio' type no longer works - TR API changed (see pytr issue #246)
        if sec_acc_no:
            portfolio_sub_id = await tr_api.subscribe({
                "type": "compactPortfolioByType",
                "secAccNo": sec_acc_no
            })
        else:
            # Fallback to old method if we couldn't get secAccNo
            portfolio_sub_id = await tr_api.subscribe({"type": "compactPortfolio"})

        try:
            portfolio = await asyncio.wait_for(
                tr_api._recv_subscription(portfolio_sub_id),
                timeout=15
            )
        finally:
            await tr_api.unsubscribe(portfolio_sub_id)

        # Fetch timeline transactions (async WebSocket subscription)
        # This returns a list of basic event info (id, title, timestamp, action)
        timeline_data = await fetch_one(tr_api.timeline_transactions(), timeout=30)

        # Debug: log timeline structure
        tr_logger.info(f"Timeline type: {type(timeline_data)}")
        if isinstance(timeline_data, dict):
            tr_logger.info(f"Timeline keys: {list(timeline_data.keys())}")
            items = timeline_data.get("items", [])
            tr_logger.info(f"Timeline items count: {len(items)}")
            if items:
                tr_logger.info(f"First item sample: {items[0]}")
        elif isinstance(timeline_data, list):
            tr_logger.info(f"Timeline list count: {len(timeline_data)}")
            if timeline_data:
                tr_logger.info(f"First item sample: {timeline_data[0]}")

        # Also try fetching the activity log which may have interest payments
        activity_log = None
        try:
            activity_log = await fetch_one(tr_api.timeline_activity_log(), timeout=30)
            tr_logger.info(f"Activity log type: {type(activity_log)}")
            if isinstance(activity_log, dict):
                tr_logger.info(f"Activity log keys: {list(activity_log.keys())}")
                activity_items = activity_log.get("items", [])
                tr_logger.info(f"Activity items count: {len(activity_items)}")
                if activity_items:
                    tr_logger.info(f"First activity sample: {activity_items[0]}")
        except Exception as e:
            tr_logger.error(f"Activity log fetch failed: {e}")

        # Collect all timeline items (basic info has amount, title, etc.)
        # The basic timeline item already has what we need for most transactions
        all_timeline_items = []
        if isinstance(timeline_data, dict):
            all_timeline_items.extend(timeline_data.get("items", []))

        # Activity log items typically don't have amounts (emails, verifications, etc.)
        # We'll skip those for transactions

        tr_logger.info(f"Found {len(all_timeline_items)} timeline items to process")

        # Log the structure of the first item to see what fields are available
        if all_timeline_items:
            first = all_timeline_items[0]
            tr_logger.info(f"First timeline item keys: {list(first.keys())}")
            tr_logger.info(f"First timeline item: {first}")

        # Also fetch cash balance
        cash_data = None
        try:
            cash_data = await fetch_one(tr_api.cash(), timeout=10)
            tr_logger.info(f"Cash data: {cash_data}")
        except Exception as e:
            tr_logger.error(f"Cash fetch failed: {e}")

        # Parse transactions from timeline items (they already have amount, title, etc.)
        transactions = []
        for item in all_timeline_items:
            parsed = _parse_tr_timeline_item(item)
            if parsed:
                transactions.append(parsed)

        # Parse portfolio positions
        positions = _parse_tr_portfolio(portfolio)

        # Parse cash balances (separate from positions)
        # Cash data comes as an array: [{'accountNumber': '...', 'currencyId': 'EUR', 'amount': 34588.21}]
        cash_balances: list[TRCashBalance] = []
        if cash_data:
            if isinstance(cash_data, list):
                for cash_account in cash_data:
                    if isinstance(cash_account, dict):
                        cash_amount = cash_account.get("amount", 0)
                        currency = cash_account.get("currencyId", "EUR")
                        if cash_amount and float(cash_amount) > 0:
                            cash_balances.append(TRCashBalance(
                                currency=currency,
                                amount=float(cash_amount),
                            ))
                            tr_logger.info(f"Added cash balance: {cash_amount} {currency}")
            elif isinstance(cash_data, (int, float)):
                cash_amount = float(cash_data)
                if cash_amount > 0:
                    cash_balances.append(TRCashBalance(
                        currency="EUR",
                        amount=cash_amount,
                    ))
                    tr_logger.info(f"Added cash balance: {cash_amount} EUR")
            elif isinstance(cash_data, dict):
                cash_value = cash_data.get("value", 0) or cash_data.get("amount", 0)
                if cash_value and float(cash_value) > 0:
                    cash_balances.append(TRCashBalance(
                        currency=cash_data.get("currency", cash_data.get("currencyId", "EUR")),
                        amount=float(cash_value),
                    ))
                    tr_logger.info(f"Added cash balance from dict: {cash_value}")

        tr_logger.info(f"Final result: {len(transactions)} transactions, {len(positions)} positions, {len(cash_balances)} cash balances")
        if transactions:
            tr_logger.info(f"Sample transaction: {transactions[0]}")
        if positions:
            tr_logger.info(f"Sample position: {positions[0]}")
        if cash_balances:
            tr_logger.info(f"Sample cash balance: {cash_balances[0]}")

        return TRSyncResponse(
            success=True,
            transactions=transactions,
            positions=positions,
            cashBalances=cash_balances,
            total_transactions=len(transactions),
        )

    except Exception as e:
        import traceback
        error_detail = f"Failed to fetch Trade Republic data: {str(e)}"
        # Log the full traceback for debugging
        print(f"TR Error: {error_detail}")
        print(traceback.format_exc())
        return TRSyncResponse(
            success=False,
            error=error_detail,
        )

    finally:
        # Always clean up session - credentials should not persist
        if request.session_id in _tr_sessions:
            del _tr_sessions[request.session_id]


@app.post("/trade-republic/login/resend")
async def tr_resend_code(
    session_id: str,
    _api_key: str = Depends(verify_api_key),
):
    """Resend the verification code for a pending session (requires API key)"""
    check_rate_limit(f"tr_resend:{session_id}")
    session = _tr_sessions.get(session_id)

    if not session:
        raise HTTPException(
            status_code=404,
            detail="Session not found or expired.",
        )

    try:
        tr_api = session["api"]
        # resend_weblogin is synchronous (HTTP request)
        tr_api.resend_weblogin()
        return {"status": "code_resent", "message": "New code sent to your device"}
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to resend code: {str(e)}",
        )


@app.delete("/trade-republic/session/{session_id}")
async def tr_cancel_session(
    session_id: str,
    _api_key: str = Depends(verify_api_key),
):
    """Cancel a pending Trade Republic session (requires API key)"""
    if session_id in _tr_sessions:
        del _tr_sessions[session_id]
        return {"status": "cancelled"}
    return {"status": "not_found"}


def _parse_tr_timeline_item(item: dict) -> Optional[TRTransaction]:
    """Parse a Trade Republic timeline item into a transaction.

    The timeline item structure (from timeline_transactions) has:
    - id, timestamp, title, subtitle
    - icon: e.g., 'logos/timeline_interest_new/v2'
    - amount: {currency, value, fractionDigits}
    - status: 'EXECUTED'
    - action: {type, payload}
    """
    try:
        title = item.get("title", "")
        subtitle = item.get("subtitle", "")
        title_lower = title.lower()
        icon = item.get("icon", "")

        tr_logger.debug(f"Parsing timeline item: title={title}, icon={icon}")

        # Determine transaction type from title and icon
        tx_type = "other"

        # Interest payments (use 'interest' type for proper tracking)
        if "interest" in title_lower or "zinsen" in title_lower or "interest" in icon:
            tx_type = "interest"

        # Dividends
        elif "dividend" in title_lower or "dividende" in title_lower:
            tx_type = "dividend"

        # Deposits
        elif any(word in title_lower for word in ["deposit", "einzahlung", "überweisung"]):
            tx_type = "other"  # Skip deposits for now

        # Withdrawals
        elif any(word in title_lower for word in ["withdrawal", "auszahlung"]):
            tx_type = "other"  # Skip withdrawals for now

        # Buy orders
        elif any(word in title_lower for word in ["kauf", "buy", "order", "sparplan"]):
            tx_type = "buy"

        # Sell orders
        elif any(word in title_lower for word in ["verkauf", "sell"]):
            tx_type = "sell"

        # Round-up / Saveback
        elif "round" in title_lower or "saveback" in title_lower:
            tx_type = "dividend"

        else:
            # Skip unknown types for now
            tr_logger.debug(f"Skipping unknown item type: title={title}")
            return None

        # Extract amount
        amount_obj = item.get("amount", {})
        if isinstance(amount_obj, dict):
            amount = float(amount_obj.get("value", 0))
            currency = amount_obj.get("currency", "EUR")
        else:
            amount = 0
            currency = "EUR"

        if amount == 0:
            tr_logger.debug(f"Skipping item with zero amount: {title}")
            return None

        # Get date/timestamp
        date_str = item.get("timestamp", "")
        if date_str:
            # Handle ISO format: '2026-01-01T14:48:42.252+0000'
            date_str = date_str[:10]  # YYYY-MM-DD

        # Get name from title - keep original for proper tracking
        name = title or subtitle or "Transaction"

        tr_logger.info(f"Parsed transaction: type={tx_type}, amount={amount}, name={name}, date={date_str}")

        return TRTransaction(
            date=date_str,
            type=tx_type,
            isin=None,  # Timeline items don't have ISIN directly
            name=name,
            quantity=0,  # For interest/dividends, quantity is 0
            price=0,
            amount=abs(amount),
            currency=currency,
            fees=0,
        )
    except Exception as e:
        import traceback
        tr_logger.error(f"Parse error: {e} for item: {item}")
        tr_logger.error(traceback.format_exc())
        return None


def _parse_float_value(text: str) -> float:
    """Parse a float from text, handling German locale (comma as decimal)."""
    if not text:
        return 0.0
    # Remove currency symbols and whitespace
    text = text.strip().replace("€", "").replace("EUR", "").replace(" ", "")
    # Handle German format: 1.234,56 -> 1234.56
    if "," in text and "." in text:
        text = text.replace(".", "").replace(",", ".")
    elif "," in text:
        text = text.replace(",", ".")
    try:
        return float(text)
    except ValueError:
        return 0.0


def _parse_tr_portfolio(portfolio: dict) -> list[dict]:
    """Parse Trade Republic portfolio into positions"""
    positions = []

    tr_logger.info(f"Portfolio type: {type(portfolio)}")
    tr_logger.info(f"Portfolio keys: {list(portfolio.keys()) if isinstance(portfolio, dict) else 'not dict'}")
    if isinstance(portfolio, dict):
        tr_logger.info(f"Portfolio positions count: {len(portfolio.get('positions', []))}")
        # Also check for other keys that might contain positions
        for key in portfolio.keys():
            val = portfolio[key]
            if isinstance(val, list) and len(val) > 0:
                tr_logger.info(f"Portfolio key '{key}' has {len(val)} items, first: {val[0] if val else 'empty'}")

    for position in portfolio.get("positions", []):
        try:
            positions.append(
                {
                    "isin": position.get("instrumentId"),
                    "name": position.get("name", "Unknown"),
                    "quantity": float(position.get("netSize", 0)),
                    "avgCost": float(position.get("averageBuyIn", 0)),
                    "currency": "EUR",
                }
            )
        except Exception as e:
            tr_logger.error(f"Position parse error: {e} for position: {position}")
            continue

    return positions


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
