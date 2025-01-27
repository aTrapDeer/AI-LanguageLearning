import logging
import os
from typing import Dict, Any
import aiohttp
from livekit.plugins import openai
from livekit.agents import multimodal

logger = logging.getLogger(__name__)

class AgentPipeline:
    def __init__(self):
        self.agent = None
        self.model = None
        self.current_language = None
        self.session = None
        logger.info("AgentPipeline initialized")

    async def set_language(self, language_code: str):
        """Set the language for the agent."""
        if language_code != self.current_language:
            self.current_language = language_code
            logger.info(f"Language set to: {language_code}")
            await self.initialize_agent()

    async def initialize_agent(self):
        """Initialize or update the agent with current settings."""
        try:
            if self.session:
                await self.session.close()
            
            self.session = aiohttp.ClientSession()
            
            # Create the model like in the examples
            self.model = openai.realtime.RealtimeModel(
                instructions=f"""You are an expert language instructor for {self.current_language}. Your teaching style is 
encouraging, patient, and engaging. You should adapt your teaching approach based on 
the student's proficiency level. Use a clear, standard accent that's easily 
understandable for learners. Focus on:
- Natural conversation practice in {self.current_language}
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
                max_response_output_tokens="inf",
                modalities=["text", "audio"],
                http_session=self.session,
                turn_detection=openai.realtime.ServerVadOptions(
                    threshold=0.5,
                    silence_duration_ms=200,
                    prefix_padding_ms=300,
                )
            )
            
            # Create the agent with the model
            self.agent = multimodal.MultimodalAgent(model=self.model)
            logger.info("Agent initialized with new language settings")
            
        except Exception as e:
            logger.error(f"Error initializing agent: {str(e)}", exc_info=True)
            raise

    async def process_input(self, input_text: str) -> Dict[str, Any]:
        """Process text input and return response with audio."""
        try:
            if not self.agent:
                await self.initialize_agent()
            
            # Process the input using the model directly
            response = await self.model.process_text(input_text)
            
            return {
                "text": response.text,
                "audio_url": response.audio_url if hasattr(response, 'audio_url') else None
            }
        except Exception as e:
            logger.error(f"Error processing input: {str(e)}", exc_info=True)
            raise

    async def cleanup(self):
        """Cleanup resources."""
        if self.session:
            try:
                await self.session.close()
                logger.info("Cleaned up aiohttp session")
            except Exception as e:
                logger.error(f"Error closing session: {str(e)}", exc_info=True) 