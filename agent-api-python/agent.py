from fastapi import FastAPI, HTTPException, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import os
import logging
from dotenv import load_dotenv
# import openai
from openai import AsyncOpenAI

from agentResponse import AgentResponse

# Import LiveKit SDK components
from livekit import rtc
from livekit.agents import (
    AutoSubscribe,
    JobContext,
    WorkerOptions,
    WorkerType,
    cli,
    multimodal,
    llm
)
from livekit.plugins import openai

import aiohttp
import asyncio

# Set up logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Initialize OpenAI client
client = AsyncOpenAI(api_key=os.getenv('OPENAI_API_KEY'))

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
        "https://api.laingfy.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

logger.info("FastAPI app initialized with CORS")

class ChatRequest(BaseModel):
    message: str
    language: str = "English"  # Default to English

class ChatResponse(BaseModel):
    response: str
    audio_url: Optional[str] = None

class LiveKitRequest(BaseModel):
    room: str
    language: str
    token: str
    serverUrl: str

# Create a global AgentResponse instance
agent_response = AgentResponse()

# Global task storage
active_agents = {}

@app.post("/chat")
async def chat(request: ChatRequest) -> ChatResponse:
    logger.info(f"Received chat request: {request}")
    try:
        # Convert language to code
        language_code = {
            "English": "en",
            "German": "de",
            "Portuguese (Brazilian)": "pt-BR",
            "Chinese": "zh",
            "Norwegian": "no"
        }.get(request.language)
        
        if not language_code:
            logger.warning(f"Unknown language: {request.language}, defaulting to English")
            language_code = "en"
        
        logger.info(f"Using language code: {language_code}")
        
        # Set the language and create/update agent if needed
        await agent_response.set_language(language_code)
        
        # Process message
        logger.info(f"Processing message: {request.message}")
        response = await agent_response.process_input(request.message)
        
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
    # Clean up all active agents
    for room_name in list(active_agents.keys()):
        if room_name in active_agents:
            del active_agents[room_name]
    if agent_response:
        agent_response.cleanup()

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
            "Portuguese (Brazilian)": "pt-BR",
            "Chinese": "zh",
            "Norwegian": "no"
        }.get(language, "en")
        
        # Set the language for the agent
        await agent_response.set_language(language_code)
        
        # TODO: Implement audio transcription using OpenAI Whisper API
        # For now, return an error
        raise HTTPException(
            status_code=501, 
            detail="Audio chat functionality is not implemented yet"
        )
        
    except Exception as e:
        logger.error(f"Error processing audio chat request: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

async def create_and_start_agent(room: rtc.Room, language: str, room_name: str):
    logger.info(f"Starting agent for language: {language} in room: {room_name}")
    http_session = None
    participant_connected = asyncio.Event()
    connection_closed = asyncio.Event()
    
    try:
        # Create HTTP session for the OpenAI plugin
        http_session = aiohttp.ClientSession()
        
        # Set up connection handlers
        @room.on("disconnected")
        def on_disconnected(reason):
            logger.info(f"Room disconnected with reason: {reason}")
            if reason == "DUPLICATE_IDENTITY":
                logger.info("Duplicate identity detected, attempting to reconnect...")
                return
            connection_closed.set()
            
        @room.on("connected")
        def on_connected():
            logger.info("Room connected successfully")
            
        @room.on("participant_connected")
        def on_participant_connected(participant):
            logger.info(f"Participant joined: {participant.identity}")
            participant_connected.set()
            
        @room.on("participant_disconnected")
        def on_participant_disconnected(participant):
            logger.info(f"Participant left: {participant.identity}")
            if room_name in active_agents:
                participant_connected.clear()

        @room.on("track_published")
        def on_track_published(publication, participant):
            logger.info(f"Track published by {participant.identity}: {publication.kind}")
            
        @room.on("track_subscribed")
        def on_track_subscribed(track, publication, participant):
            logger.info(f"Subscribed to track from {participant.identity}: {track.kind}")
            
        # Wait for first participant
        logger.info("Waiting for participant to join...")
        await participant_connected.wait()
        
        # Create and start the agent with realtime model
        model = openai.realtime.RealtimeModel(
            instructions=f"""You are an expert language instructor for {language}. Your teaching style is 
encouraging, patient, and engaging. You should adapt your teaching approach based on 
the student's proficiency level. Use a clear, standard accent that's easily 
understandable for learners. Focus on:
- Natural conversation practice in {language}
- Gentle correction of pronunciation and grammar mistakes
- Introducing relevant vocabulary in context
- Providing cultural context when appropriate
- Maintaining a supportive learning environment

Keep interactions conversational while weaving in language learning opportunities.
If the student makes a mistake, wait for them to finish speaking before offering
corrections. Praise good usage and progress. Adjust your speaking pace and
complexity based on the student's demonstrated ability level.""",
            voice="alloy",
            temperature=0.8,
            modalities=["text", "audio"],
            turn_detection=openai.realtime.ServerVadOptions(
                threshold=0.5,
                silence_duration_ms=200,
                prefix_padding_ms=300,
            ),
            http_session=http_session  # Pass the HTTP session to the model
        )
        
        agent = multimodal.MultimodalAgent(model=model)
        agent.start(room)
        logger.info("MultimodalAgent successfully started")
        
        # Initialize conversation
        session = model.sessions[0]
        session.conversation.item.create(
            llm.ChatMessage(
                role="assistant",
                content=f"Hello! I'm your {language} language instructor. I'm here to help you practice and improve your {language} skills. Would you like to start with some basic conversation?",
            )
        )
        session.response.create()
        
        # Set up event handlers
        @agent.on("user_started_speaking")
        def on_user_started_speaking():
            logger.info("User started speaking")
            
        @agent.on("user_stopped_speaking")
        def on_user_stopped_speaking():
            logger.info("User stopped speaking")
            
        @agent.on("user_speech_committed")
        def on_user_speech_committed(msg: llm.ChatMessage):
            logger.info(f"User speech committed: {msg.content}")
            
        @agent.on("agent_started_speaking")
        def on_agent_started_speaking():
            logger.info("Agent started speaking")
            
        @agent.on("agent_stopped_speaking")
        def on_agent_stopped_speaking():
            logger.info("Agent stopped speaking")
            
        @agent.on("agent_speech_committed")
        def on_agent_speech_committed(msg: llm.ChatMessage):
            logger.info(f"Agent speech committed: {msg.content}")
        
        # Keep the connection alive and monitor participant
        while room_name in active_agents and not connection_closed.is_set():
            if not participant_connected.is_set():
                logger.info("No participants in room, closing")
                break
            await asyncio.sleep(1)
            
    except Exception as e:
        logger.error(f"Error in agent task: {str(e)}", exc_info=True)
    finally:
        if room_name in active_agents:
            del active_agents[room_name]
        if http_session:
            await http_session.close()
        try:
            await room.disconnect()
        except Exception as e:
            logger.error(f"Error disconnecting room: {str(e)}", exc_info=True)

@app.post("/livekit-agent")
async def create_livekit_agent(request: LiveKitRequest):
    logger.info(f"Received LiveKit agent request: {request}")
    room = None
    try:
        # Check if agent already exists for this room
        if request.room in active_agents:
            return {"status": "success", "message": "LiveKit agent already running"}
            
        # Convert language to code
        language_code = {
            "English": "en",
            "German": "de",
            "Portuguese (Brazilian)": "pt-BR",
            "Chinese": "zh",
            "Norwegian": "no"
        }.get(request.language, "en")
        
        logger.info(f"Using language code: {language_code} for language: {request.language}")

        # Create the room client
        room = rtc.Room()
        
        # Connect to the room with explicit RoomOptions
        logger.info(f"Connecting to LiveKit room at {request.serverUrl}")
        options = rtc.RoomOptions(
            auto_subscribe=True,  # Auto-subscribe to all tracks
            dynacast=False,       # Disable dynamic bitrate adjustment
            rtc_config=rtc.RtcConfiguration(
                continual_gathering_policy=1,  # GATHER_CONTINUALLY
                ice_transport_type=2           # ALL transport types
            )
        )
        await room.connect(request.serverUrl, request.token, options)
        logger.info(f"Successfully connected to LiveKit room: {request.room}")

        # Create and start the agent as a background task
        task = asyncio.create_task(create_and_start_agent(room, request.language, request.room))
        active_agents[request.room] = task
        
        return {"status": "success", "message": "LiveKit agent started"}

    except Exception as e:
        logger.error(f"Error creating LiveKit agent: {str(e)}", exc_info=True)
        if room:
            try:
                await room.disconnect()
            except Exception as disconnect_error:
                logger.error(f"Error disconnecting room: {str(disconnect_error)}", exc_info=True)
        if request.room in active_agents:
            del active_agents[request.room]
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    logger.info("Starting uvicorn server")
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info") 