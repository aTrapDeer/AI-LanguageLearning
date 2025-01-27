import os
import logging
import asyncio
import aiohttp
import time
import boto3
from botocore.exceptions import ClientError
import io
import botocore
import random
from typing import Optional
from dotenv import load_dotenv
from openai import AsyncOpenAI

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
        'voice': 'shimmer'
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
        'voice': 'shimmer'
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
        'voice': 'shimmer'
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
        'voice': 'shimmer'
    },
    'pt-BR': {
        'instructions': """You are a friendly and engaging Brazilian Portuguese language conversation partner. Your primary goal is to maintain a natural conversation while helping users improve their Brazilian Portuguese. Follow these guidelines:
1. Always respond in Brazilian Portuguese first, followed by an English translation
2. Keep the conversation flowing naturally while providing gentle corrections
3. Use emojis and friendly language to keep the conversation engaging
4. Ask follow-up questions to encourage more conversation

Example format:
🇧🇷 [Brazilian Portuguese response continuing the dialogue]
🇺🇸 [English translation]
💡 Corrections (if needed): [specific corrections]
❓ [Follow-up question in Portuguese with translation]""",
        'voice': 'shimmer'
    },
}

class AgentResponse:
    def __init__(self):
        self.response_lock = asyncio.Lock()
        self.current_task = None
        self.current_language = 'en'  # Default to English
        
        # Initialize OpenAI client
        self.openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)
        
        # Initialize S3 client
        try:
            region = AWS_REGION if AWS_REGION else 'us-east-1'
            self.s3_client = boto3.client(
                's3',
                aws_access_key_id=AWS_ACCESS_KEY_ID,
                aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
                region_name=region,
                endpoint_url=f'https://s3.{region}.amazonaws.com'
            )
            self.bucket_name = AWS_S3_BUCKET_AUDIO
            
            if not self.bucket_name:
                raise ValueError("AWS_S3_BUCKET_AUDIO is not set")
            
            # Test S3 connection
            self.s3_client.head_bucket(Bucket=self.bucket_name)
            logger.info(f"Successfully connected to S3 bucket: {self.bucket_name}")
            
        except Exception as e:
            logger.error(f"Error initializing S3 client: {str(e)}")
            self.s3_client = None

    async def set_language(self, language_code: str):
        """Set the current language for responses"""
        self.current_language = language_code
        logger.info(f"Language set to: {language_code}")

    async def process_input(self, input_text):
        """Process text input and return response with audio"""
        async with self.response_lock:
            try:
                # Get language configuration
                config = LANGUAGE_CONFIGS.get(self.current_language, LANGUAGE_CONFIGS['en'])
                
                # Generate text response using GPT-4
                completion = await self.openai_client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[
                        {"role": "system", "content": config['instructions']},
                        {"role": "user", "content": input_text}
                    ],
                    temperature=0.7,
                    max_tokens=700
                )
                
                text_response = completion.choices[0].message.content
                logger.info(f"Generated text response: {text_response[:100]}...")
                
                # Extract language-specific text for TTS
                tts_text = self._extract_language_text(text_response)
                logger.info(f"Extracted TTS text: {tts_text[:100]}...")
                
                # Always try to generate audio
                try:
                    audio_url = await self._generate_audio(tts_text)
                    if not audio_url:
                        logger.warning("Failed to generate audio, trying with full response")
                        audio_url = await self._generate_audio(text_response)
                except Exception as e:
                    logger.error(f"Error in audio generation: {str(e)}")
                    audio_url = None
                
                return {
                    "text": text_response,
                    "audio_url": audio_url
                }
                
            except Exception as e:
                logger.error(f"Error processing input: {str(e)}", exc_info=True)
                raise

    def _extract_language_text(self, text_response: str) -> str:
        """Extract language-specific text for TTS based on the current language"""
        lines = text_response.split('\n')
        tts_text = []
        
        # For English, use the conversational response part (before any corrections)
        if self.current_language == 'en':
            # Take text until we hit a line with an emoji
            for line in lines:
                if any(emoji in line for emoji in ['💡', '❓', '🌍']):
                    break
                if line.strip():
                    tts_text.append(line.strip())
        
        # For German, extract German text (before English translations)
        elif self.current_language == 'de':
            for line in lines:
                if line.startswith('🇩🇪'):
                    # Get text between 🇩🇪 and 🇺🇸 if present
                    german_text = line.split('🇩🇪')[1]
                    if '🇺🇸' in german_text:
                        german_text = german_text.split('🇺🇸')[0]
                    tts_text.append(german_text.strip())
                elif line.startswith('❓'):
                    # For questions, get the German part before any translation
                    question = line.replace('❓', '').strip()
                    if '/' in question:
                        question = question.split('/')[0]
                    tts_text.append(question.strip())
        
        # For Chinese, extract Chinese characters
        elif self.current_language == 'zh':
            for line in lines:
                if line.startswith('🇨🇳'):
                    # Get text between 🇨🇳 and 📝 (before pinyin)
                    chinese_text = line.split('🇨🇳')[1]
                    if '📝' in chinese_text:
                        chinese_text = chinese_text.split('📝')[0]
                    tts_text.append(chinese_text.strip())
                elif line.startswith('❓'):
                    # For questions, get the Chinese part before pinyin
                    question = line.replace('❓', '').strip()
                    if '📝' in question:
                        question = question.split('📝')[0]
                    tts_text.append(question.strip())
        
        # For Norwegian, extract Norwegian text
        elif self.current_language == 'no':
            for line in lines:
                if line.startswith('🇳🇴'):
                    # Get text between 🇳🇴 and 🇺🇸
                    norwegian_text = line.split('🇳🇴')[1]
                    if '🇺🇸' in norwegian_text:
                        norwegian_text = norwegian_text.split('🇺🇸')[0]
                    tts_text.append(norwegian_text.strip())
                elif line.startswith('❓'):
                    # For questions, get the Norwegian part before translation
                    question = line.replace('❓', '').strip()
                    if '/' in question:
                        question = question.split('/')[0]
                    tts_text.append(question.strip())
        
        # For Brazilian Portuguese, extract Portuguese text
        elif self.current_language == 'pt-BR':
            for line in lines:
                if line.startswith('🇧🇷'):
                    # Get text between 🇧🇷 and 🇺🇸
                    portuguese_text = line.split('🇧🇷')[1]
                    if '🇺🇸' in portuguese_text:
                        portuguese_text = portuguese_text.split('🇺🇸')[0]
                    tts_text.append(portuguese_text.strip())
                elif line.startswith('❓'):
                    # For questions, get the Portuguese part before translation
                    question = line.replace('❓', '').strip()
                    if '/' in question:
                        question = question.split('/')[0]
                    tts_text.append(question.strip())
        
        # Join all extracted text with proper spacing
        combined_text = ' '.join(tts_text).strip()
        logger.info(f"Extracted text for TTS ({self.current_language}): {combined_text[:100]}...")
        
        return combined_text if combined_text else text_response

    async def _generate_audio(self, text: str) -> Optional[str]:
        """Generate audio from text and upload to S3"""
        try:
            if not text.strip():
                logger.error("Empty text provided for audio generation")
                return None

            # Select voice based on language
            voice = {
                'en': 'shimmer',  # Female voice for English
                'de': 'onyx',     # Male voice for German
                'zh': 'nova',     # Female voice for Chinese
                'no': 'echo',     # Female voice for Norwegian
                'pt-BR': 'alloy'  # Neural voice for Portuguese
            }.get(self.current_language, 'shimmer')  # Default to shimmer

            logger.info(f"Generating audio with voice {voice} for language {self.current_language}")
            logger.info(f"Text to convert: {text[:100]}...")
            
            # Generate audio using OpenAI
            logger.info("Calling OpenAI TTS API...")
            response = await self.openai_client.audio.speech.create(
                model="tts-1",
                voice=voice,
                input=text
            )
            logger.info(f"OpenAI TTS response type: {type(response)}")
            
            if not self.s3_client:
                logger.error("S3 client is not initialized")
                return None
                
            # Create a buffer for the audio
            audio_buffer = io.BytesIO()
            
            # Get the audio content
            logger.info("Processing audio response...")
            if hasattr(response, 'content'):
                logger.info("Response has content attribute")
                audio_buffer.write(response.content)
            elif hasattr(response, 'read'):
                logger.info("Response is a file-like object")
                audio_buffer.write(await response.read())
            else:
                logger.info(f"Using raw response of type: {type(response)}")
                audio_buffer.write(response)
            
            audio_buffer.seek(0)
            buffer_size = audio_buffer.getbuffer().nbytes
            logger.info(f"Audio buffer size: {buffer_size} bytes")
            
            if buffer_size == 0:
                logger.error("Audio buffer is empty")
                return None
            
            # Generate unique filename
            timestamp = int(time.time())
            random_string = ''.join(random.choices('abcdefghijklmnopqrstuvwxyz0123456789', k=6))
            audio_filename = f"audio_{timestamp}_{random_string}.mp3"
            logger.info(f"Generated filename: {audio_filename}")
            
            # Upload to S3
            try:
                logger.info("Uploading to S3...")
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
                
                # Generate URL
                region = AWS_REGION if AWS_REGION else 'us-east-1'
                audio_url = f"https://{self.bucket_name}.s3.{region}.amazonaws.com/audio/{audio_filename}"
                logger.info(f"Successfully uploaded audio to S3: {audio_url}")
                
                return audio_url
            except Exception as e:
                logger.error(f"Error uploading to S3: {str(e)}")
                return None
            
        except Exception as e:
            logger.error(f"Error generating audio: {str(e)}", exc_info=True)
            return None

    async def cleanup_old_audio_files(self):
        """Clean up audio files older than 24 hours"""
        if not self.s3_client:
            return
            
        try:
            response = self.s3_client.list_objects_v2(
                Bucket=self.bucket_name,
                Prefix='audio/'
            )
            
            current_time = time.time()
            for obj in response.get('Contents', []):
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

    def cleanup(self):
        """Cleanup resources"""
        if self.current_task:
            self.current_task.cancel()