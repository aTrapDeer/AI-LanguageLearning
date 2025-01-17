from fastapi import FastAPI, HTTPException, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import os
import logging
# from dotenv import load_dotenv
from livekit_agent import ( 
    AgentPipeline
)

# Set up logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://laingfy.com",
        "https://www.laingfy.com",
        "http://127.0.0.1:3000",
        "https://language-audio-clips.s3.us-east-1.amazonaws.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logger.info("FastAPI app initialized with CORS")

class ChatRequest(BaseModel):
    message: str
    language: str = "English"  # Default to English

class ChatResponse(BaseModel):
    response: str
    audio_url: Optional[str] = None

# Create a global AgentPipeline instance
agent_pipeline = AgentPipeline()

@app.post("/chat")
async def chat(request: ChatRequest) -> ChatResponse:
    logger.info(f"Received chat request: {request}")
    try:
        # Convert language to code
        language_code = {
            "English": "en",  # Add English mapping
            "German": "de",
            "Portuguese": "pt",
            "Chinese": "zh",
            "Norwegian": "no"
        }.get(request.language, "en")  # Default to 'en' instead of 'de'
        
        # Set the language and create/update agent if needed
        await agent_pipeline.set_language(language_code)
        
        # Process message
        logger.info(f"Processing message: {request.message}")
        response = await agent_pipeline.process_input(request.message)
        
        api_response = ChatResponse(
            response=response["text"],
            audio_url=response["audio_url"]
        )
        logger.info(f"Sending response: {api_response}")
        return api_response
    except Exception as e:
        logger.error(f"Error processing chat request: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    logger.info("Health check endpoint called")
    return {"status": "healthy"}

@app.on_event("startup")
async def startup_event():
    logger.info("FastAPI application starting up")
    logger.info("Checking required environment variables:")
    openai_key = os.getenv("OPENAI_API_KEY", "").strip('"')  # Strip quotes
    # Only show first 10 and last 4 characters for security
    masked_key = f"{openai_key[:10]}...{openai_key[-4:]}" if openai_key else "NOT SET"
    logger.info(f"OPENAI_API_KEY loaded as: {masked_key}")
    
    # Check AWS credentials
    aws_access_key = os.getenv("AWS_ACCESS_KEY_ID", "")
    aws_secret_key = os.getenv("AWS_SECRET_ACCESS_KEY", "")
    aws_bucket = os.getenv("AWS_S3_BUCKET_AUDIO", "")
    
    logger.info(f"AWS Access Key ID is {'set' if aws_access_key else 'NOT SET'}")
    logger.info(f"AWS Secret Access Key is {'set' if aws_secret_key else 'NOT SET'}")
    logger.info(f"AWS S3 Bucket is set to: {aws_bucket}")
    logger.info(f"AWS Region is set to: {os.getenv('AWS_REGION', 'NOT SET')}")
    
    logger.info(f"DEEPGRAM_API_KEY is {'set' if os.getenv('DEEPGRAM_API_KEY') else 'NOT SET'}")

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("FastAPI application shutting down")
    if agent_pipeline:
        agent_pipeline.cleanup()

@app.post("/chat/audio")
async def chat_audio(audio: UploadFile = File(...), language: str = Form("English")) -> ChatResponse:
    logger.info(f"Received audio chat request for language: {language}")
    try:
        # Read audio file
        audio_content = await audio.read()
        
        # Convert language to code
        language_code = {
            "English": "en",
            "German": "de",
            "Portuguese": "pt",
            "Chinese": "zh",
            "Norwegian": "no"
        }.get(language, "en")
        
        # Set the language and create/update agent if needed
        await agent_pipeline.set_language(language_code)
        
        # Process audio through STT
        text = await agent_pipeline.agent.stt.transcribe(audio_content)
        logger.info(f"Transcribed text: {text}")
        
        # Process transcribed text
        response = await agent_pipeline.process_input(text)
        
        api_response = ChatResponse(
            response=response["text"],
            audio_url=response["audio_url"]
        )
        logger.info(f"Sending response: {api_response}")
        return api_response
    except Exception as e:
        logger.error(f"Error processing audio chat request: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    logger.info("Starting uvicorn server")
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info") 