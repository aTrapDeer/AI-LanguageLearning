import os
import logging
import asyncio
from contextlib import asynccontextmanager
import aiohttp
import time
import boto3
from botocore.exceptions import ClientError
import io
import botocore
import mimetypes
import random
import sys
import traceback
from typing import Optional
from dotenv import load_dotenv
from openai import OpenAI


# LiveKit imports - make sure these packages are installed correctly
try:
    from livekit import agents
    from livekit.agents import AutoSubscribe, JobContext, cli, llm, WorkerOptions
    from livekit.agents.voice_assistant import VoiceAssistant, VoicePipelineAgent
    from livekit.plugins import openai, silero, deepgram
except ImportError as e:
    logging.error(f"Failed to import LiveKit packages: {str(e)}")
    logging.error("Make sure all LiveKit packages are installed correctly")
    raise

# Load environment variables
load_dotenv()

# Set up logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Export environment variables
AWS_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID', '').strip()
AWS_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY', '').strip()
AWS_REGION = os.getenv('AWS_REGION', '').strip()
AWS_S3_BUCKET_AUDIO = os.getenv('AWS_S3_BUCKET_AUDIO', '').strip()
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', '').strip('"')
DEEPGRAM_API_KEY = os.getenv('DEEPGRAM_API_KEY', '').strip()

# Log environment variable status
logger.info("Environment variables loaded")
logger.info(f"AWS Access Key ID is {'SET' if AWS_ACCESS_KEY_ID else 'NOT SET'}")
logger.info(f"AWS Secret Access Key is {'SET' if AWS_SECRET_ACCESS_KEY else 'NOT SET'}")
logger.info(f"AWS S3 Bucket is set to: {AWS_S3_BUCKET_AUDIO}")
logger.info(f"AWS Region is set to: {AWS_REGION or 'NOT SET'}")

# Language configurations
LANGUAGE_CONFIGS = {
    'en': {
        'instructions': """You are a friendly and engaging English language conversation partner. Your primary goal is to maintain a natural conversation while helping users improve their English. Follow these guidelines:
1. Always respond conversationally first, keeping the dialogue flowing
2. Then provide gentle corrections if needed, marked with 💡
3. Use emojis and friendly language to keep the conversation engaging
4. Ask follow-up questions to encourage more conversation
5. Provide cultural context when relevant, marked with 🌍
6. Keep responses concise but informative

Example format:
[Conversational response continuing the dialogue]
💡 Corrections (if needed): [specific corrections]
❓ [Follow-up question to keep the conversation going]""",
        'language': 'en',
        'voice': 'shimmer',
        'temperature': 0.7
    },
    'de': {
        'instructions': """You are a friendly and engaging German language conversation partner. Your primary goal is to maintain a natural conversation while helping users improve their German. Follow these guidelines:
1. Always respond in German first, followed by an English translation
2. Keep the conversation flowing naturally while providing gentle corrections
3. Use emojis and friendly language to keep the conversation engaging
4. Ask follow-up questions to encourage more conversation

Example format:
🇩🇪 [German response continuing the dialogue]
🇺🇸 [English translation]
💡 Corrections (if needed): [specific corrections]
❓ [Follow-up question in German with translation]""",
        'language': 'de',
        'voice': 'shimmer',
        'temperature': 0.7
    },
    'zh': {
        'instructions': """You are a friendly and engaging Mandarin Chinese conversation partner. Your primary goal is to maintain a natural conversation while helping users improve their Mandarin. Follow these guidelines:
1. Always respond in Chinese characters first, followed by pinyin and English translation
2. Keep the conversation flowing naturally while providing gentle corrections
3. Use emojis and friendly language to keep the conversation engaging
4. Ask follow-up questions to encourage more conversation
5. Provide cultural context about Chinese-speaking regions when relevant

Example format:
🇨🇳 [Chinese characters response]
📝 Pinyin: [pinyin with tones]
🇺🇸 [English translation]
💡 Corrections (if needed): [specific corrections]
❓ [Follow-up question in Chinese with pinyin and translation]""",
        'language': 'zh',
        'voice': 'shimmer',
        'temperature': 0.7
    },
    'no': {
        'instructions': """You are a friendly and engaging Norwegian language conversation partner. Your primary goal is to maintain a natural conversation while helping users improve their Norwegian. Follow these guidelines:
1. Always respond in Norwegian first, followed by an English translation
2. Keep the conversation flowing naturally while providing gentle corrections
3. Use emojis and friendly language to keep the conversation engaging
4. Ask follow-up questions to encourage more conversation

Example format:
🇳🇴 [Norwegian response continuing the dialogue]
🇺🇸 [English translation]
💡 Corrections (if needed): [specific corrections]
❓ [Follow-up question in Norwegian with translation]""",
        'language': 'no',
        'voice': 'shimmer',
        'temperature': 0.7
    },
        'pt-BR': {
        'instructions': """You are a friendly and engaging Brazilian Portugese language conversation partner. Your primary goal is to maintain a natural conversation while helping users improve their Brazilian Portuguese. Follow these guidelines:
1. Always respond in Brazilian Portuguese first, followed by an English translation
2. Keep the conversation flowing naturally while providing gentle corrections
3. Use emojis and friendly language to keep the conversation engaging
4. Ask follow-up questions to encourage more conversation

Example format:
🇧🇷 [Brazilian Portuguese response continuing the dialogue]
🇺🇸 [English translation]
💡 Corrections (if needed): [specific corrections]
❓ [Follow-up question in Portuguese with translation]""",
        'language': 'pt-BR',
        'voice': 'shimmer',
        'temperature': 0.7
    },
}

class AgentPipeline:
    def __init__(self):
        self.response_lock = asyncio.Lock()
        self.current_task = None
        self.agent = None
        self.current_language = 'en'  # Default to English
        
        # Initialize OpenAI client
        self.openai_client = OpenAI(api_key=OPENAI_API_KEY)
        
        # Add debug logging for AWS environment variables
        logger.info(f"AWS Environment Variables:")
        logger.info(f"AWS Access Key ID is {'SET' if AWS_ACCESS_KEY_ID else 'NOT SET'}")
        logger.info(f"AWS Secret Access Key is {'SET' if AWS_SECRET_ACCESS_KEY else 'NOT SET'}")
        logger.info(f"AWS S3 Bucket is set to: {AWS_S3_BUCKET_AUDIO}")
        logger.info(f"AWS Region is set to: {AWS_REGION or 'NOT SET'}")
        
        # Initialize S3 client with explicit credentials and endpoint
        try:
            # Set default region if not provided
            region = AWS_REGION if AWS_REGION else 'us-east-1'
            
            # Initialize the S3 client with explicit endpoint
            self.s3_client = boto3.client(
                's3',
                aws_access_key_id=AWS_ACCESS_KEY_ID,
                aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
                region_name=region,
                endpoint_url=f'https://s3.{region}.amazonaws.com'  # Explicit endpoint URL
            )
            self.bucket_name = AWS_S3_BUCKET_AUDIO
            
            if not self.bucket_name:
                raise ValueError("AWS_S3_BUCKET_AUDIO is not set")
            
            logger.info(f"Initialized S3 client for bucket: {self.bucket_name} in region: {region}")
            
            # Test S3 connection and bucket existence
            try:
                self.s3_client.head_bucket(Bucket=self.bucket_name)
                logger.info(f"Successfully connected to S3 bucket: {self.bucket_name}")
                
                # List objects in bucket
                response = self.s3_client.list_objects_v2(Bucket=self.bucket_name)
                object_count = response.get('KeyCount', 0)
                logger.info(f"Bucket contains {object_count} objects")
                
            except botocore.exceptions.ClientError as e:
                error_code = e.response['Error']['Code']
                if error_code == '404':
                    logger.error(f"Bucket {self.bucket_name} does not exist")
                elif error_code == '403':
                    logger.error("Access denied to S3 bucket. Check IAM permissions")
                else:
                    logger.error(f"Error accessing S3 bucket: {str(e)}")
                
                # Set s3_client to None if bucket access fails
                self.s3_client = None
                
        except Exception as e:
            logger.error(f"Error initializing S3 client: {str(e)}")
            # Set s3_client to None if initialization fails
            self.s3_client = None

    @asynccontextmanager
    async def managed_task(self):
        if self.current_task is not None:
            self.current_task.cancel()
            try:
                await self.current_task
            except asyncio.CancelledError:
                pass
        
        task = asyncio.current_task()
        self.current_task = task
        try:
            yield
        finally:
            if self.current_task == task:
                self.current_task = None

    async def process_input(self, input_text):
        async with self.response_lock:
            async with self.managed_task():
                # Process the input and generate response
                response = await self.generate_language_response(input_text)
                return response

    async def set_language(self, language_code: str):
        """Set the current language for the agent"""
        self.current_language = language_code
        if self.agent is None or self.current_language != language_code:
            self.agent = await create_agent_for_language(language_code)

    async def generate_language_response(self, input_text):
        """Generate language-specific response using OpenAI"""
        try:
            openai_api_key = os.getenv('OPENAI_API_KEY', '').strip('"')
            if not openai_api_key or not (openai_api_key.startswith('sk-') or openai_api_key.startswith('sk-proj-')):
                raise ValueError("Invalid OpenAI API key format. Key should start with 'sk-' or 'sk-proj-'")

            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {openai_api_key}"
            }

            # Use the stored language configuration
            config = LANGUAGE_CONFIGS.get(self.current_language, LANGUAGE_CONFIGS['en'])

            # Simplified prompt that follows the language-specific format
            language_specific_prompt = f"""
            {config['instructions']}
            
            Remember to:
            1. Keep responses natural and conversational
            2. Focus on practical, everyday language use
            3. Provide improvements only when they would genuinely help the user learn
            4. Keep explanations concise and clear
            """

            payload = {
                "model": "gpt-4o-mini",
                "messages": [
                    {
                        "role": "system",
                        "content": language_specific_prompt
                    },
                    {
                        "role": "user",
                        "content": input_text
                    }
                ],
                "temperature": 0.7,
                "max_tokens": 700
            }

            async with aiohttp.ClientSession() as session:
                async with session.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers=headers,
                    json=payload
                ) as response:
                    if response.status == 200:
                        result = await response.json()
                        text_response = result["choices"][0]["message"]["content"]
                        
                        # Convert text to speech using OpenAI directly
                        audio_url = None
                        if self.agent.tts:
                            try:
                                # Extract only the target language portions for TTS
                                lines = text_response.split('\n')
                                tts_text = []
                                
                                # Language-specific extraction
                                if self.current_language == 'de':
                                    for line in lines:
                                        if line.startswith('🇩🇪'):
                                            tts_text.append(line.split('🇩🇪')[1].strip())
                                        elif line.startswith('❓'):
                                            german_part = line.split('/')[0].replace('❓', '').strip()
                                            tts_text.append(german_part)
                                
                                elif self.current_language == 'zh':
                                    for line in lines:
                                        if line.startswith('🇨🇳'):
                                            tts_text.append(line.split('🇨🇳')[1].strip())
                                        elif line.startswith('❓'):
                                            chinese_part = line.split('📝')[0].replace('❓', '').strip()
                                            tts_text.append(chinese_part)
                                
                                elif self.current_language == 'pt-BR':
                                    for line in lines:
                                        if line.startswith('🇧🇷'):
                                            tts_text.append(line.split('🇧🇷')[1].strip())
                                        elif line.startswith('❓'):
                                            portuguese_part = line.split('/')[0].replace('❓', '').strip()
                                            tts_text.append(portuguese_part)

                                elif self.current_language == 'no':
                                    for line in lines:
                                        if line.startswith('🇳🇴'):
                                            tts_text.append(line.split('🇳🇴')[1].strip())
                                        elif line.startswith('❓'):
                                            norwegian_part = line.split('/')[0].replace('❓', '').strip()
                                            tts_text.append(norwegian_part)
                                
                                # Combine the text for TTS
                                if tts_text:
                                    combined_tts_text = ' '.join(tts_text)
                                    logger.info(f"Preparing TTS for text: {combined_tts_text[:100]}...")
                                    
                                    try:
                                        # Generate audio using OpenAI
                                        response = self.openai_client.audio.speech.create(
                                            model="tts-1",
                                            voice="shimmer",
                                            input=combined_tts_text
                                        )
                                        
                                        # Create a temporary buffer to store the audio data
                                        audio_buffer = io.BytesIO()
                                        
                                        try:
                                            # Get the audio data
                                            for chunk in response.iter_bytes():
                                                audio_buffer.write(chunk)
                                            
                                            # Reset buffer position
                                            audio_buffer.seek(0)
                                            
                                            # Check if S3 client is available
                                            if self.s3_client is None:
                                                logger.error("S3 client is not initialized, cannot upload audio")
                                                audio_url = None
                                            else:
                                                try:
                                                    # Generate a unique filename
                                                    timestamp = int(time.time())
                                                    random_string = ''.join(random.choices('abcdefghijklmnopqrstuvwxyz0123456789', k=6))
                                                    audio_filename = f"audio_{timestamp}_{random_string}.mp3"
                                                    
                                                    # Upload to S3
                                                    self.s3_client.upload_fileobj(
                                                        audio_buffer,
                                                        self.bucket_name,
                                                        f"audio/{audio_filename}",
                                                        ExtraArgs={
                                                            'ContentType': 'audio/mpeg',
                                                            'CacheControl': 'max-age=3600',
                                                            'Metadata': {
                                                                'language': self.current_language,
                                                                'timestamp': str(timestamp)
                                                            }
                                                        }
                                                    )
                                                    
                                                    # Generate the S3 URL
                                                    region = AWS_REGION if AWS_REGION else 'us-east-1'
                                                    audio_url = f"https://{self.bucket_name}.s3.{region}.amazonaws.com/audio/{audio_filename}"
                                                    logger.info(f"Audio uploaded to S3: {audio_url}")
                                                    
                                                except botocore.exceptions.ClientError as e:
                                                    error_code = e.response.get('Error', {}).get('Code', 'Unknown')
                                                    error_message = e.response.get('Error', {}).get('Message', 'Unknown error')
                                                    logger.error(f"S3 upload error: {error_code} - {error_message}")
                                                    audio_url = None
                                                
                                        except Exception as e:
                                            logger.error(f"Error processing audio data: {str(e)}", exc_info=True)
                                            audio_url = None
                                            
                                    except Exception as e:
                                        logger.error(f"OpenAI TTS error: {str(e)}", exc_info=True)
                                        audio_url = None
                                    
                            except Exception as e:
                                logger.error(f"Error processing text for TTS: {str(e)}", exc_info=True)
                                audio_url = None
                        
                        return {
                            "text": text_response,
                            "audio_url": audio_url
                        }
                    else:
                        error_text = await response.text()
                        raise Exception(f"OpenAI API error: {error_text}")

        except Exception as e:
            logger.error(f"Error generating response: {str(e)}", exc_info=True)
            raise

    def cleanup(self):
        if self.current_task:
            self.current_task.cancel()

    async def cleanup_old_audio_files(self):
        """Clean up audio files older than 24 hours"""
        try:
            response = self.s3_client.list_objects_v2(
                Bucket=self.bucket_name,
                Prefix='audio/'
            )
            
            current_time = time.time()
            for obj in response.get('Contents', []):
                # Extract timestamp from filename
                filename = obj['Key']
                try:
                    timestamp = int(filename.split('_')[1])
                    if current_time - timestamp > 86400:  # 24 hours
                        self.s3_client.delete_object(
                            Bucket=self.bucket_name,
                            Key=filename
                        )
                        logger.info(f"Deleted old audio file: {filename}")
                except (IndexError, ValueError):
                    continue
                
        except Exception as e:
            logger.error(f"Error cleaning up old audio files: {str(e)}")

async def create_agent_for_language(language_code: str):
    """Create a VoicePipelineAgent for the specified language."""
    
    # Validate environment variables and API key format
    openai_api_key = os.getenv('OPENAI_API_KEY', '').strip('"')  # Strip quotes
    deepgram_api_key = os.getenv('DEEPGRAM_API_KEY', '').strip('"')  # Strip quotes
    
    # Debug log the key (masked for security)
    masked_key = f"{openai_api_key[:10]}...{openai_api_key[-4:]}" if openai_api_key else "None"
    logger.info(f"Validating OpenAI API key: {masked_key}")
    
    if not openai_api_key or not (openai_api_key.startswith('sk-') or openai_api_key.startswith('sk-proj-')):
        logger.error(f"Invalid key format. Key prefix: {openai_api_key[:7] if openai_api_key else 'None'}")
        raise ValueError("Invalid OpenAI API key format. Key should start with 'sk-' or 'sk-proj-'")
    
    if not deepgram_api_key:
        raise ValueError("Missing Deepgram API key")
    
    config = LANGUAGE_CONFIGS.get(language_code)
    if not config:
        raise ValueError(f"Unsupported language code: {language_code}")
    
    logger.info(f"Creating agent for language: {language_code}")
    
    # Initialize chat context
    initial_ctx = llm.ChatContext().append(
        role="system",
        text=config['instructions']
    )

    # Create the agent with proper configuration
    agent = VoicePipelineAgent(
        vad=silero.VAD.load(),
        stt=deepgram.STT(
            api_key=deepgram_api_key,
            model="nova-2-general",
            language=config['language']
        ),
        llm=openai.LLM(
            api_key=openai_api_key,
            temperature=0.7,
        ),
        tts=openai.TTS(
            api_key=openai_api_key,
            voice=config['voice']
        ),
        chat_ctx=initial_ctx,
        min_endpointing_delay=1.5,
        allow_interruptions=True,
        interrupt_speech_duration=1.0
    )
    
    logger.info(f"Agent created successfully for {language_code}")
    return agent 

async def modify_context(ctx, config):
    """Modify the context before sending to OpenAI"""
    # Add any additional context or modifications needed
    if len(ctx.messages) > 10:
        system_prompt = next((m for m in ctx.messages if m['role'] == 'system'), None)
        recent_messages = ctx.messages[-10:]
        ctx.messages = ([system_prompt] if system_prompt else []) + recent_messages
    return ctx

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    options = WorkerOptions(
        entrypoint_fnc=lambda ctx: create_agent_for_language('de')  # Default to German
    )
    cli.run_app(options)