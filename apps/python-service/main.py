from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import httpx
from bs4 import BeautifulSoup
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import TranscriptsDisabled, NoTranscriptFound
import re

app = FastAPI(
    title="Portfolio Aggregator - Python Service",
    description="Web scraping and YouTube transcripts service",
    version="1.0.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
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
    return {"status": "healthy", "service": "python-service"}


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


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
