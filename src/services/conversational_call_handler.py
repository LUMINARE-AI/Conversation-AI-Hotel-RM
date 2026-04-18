"""
Conversational Call Handler - Dynamic LLM-driven multi-turn conversation

Uses Sarvam AI for:
  - STT (speech_to_text): Convert user speech to text
  - LLM (generate_response): Dynamic dialogue based on conversation history
  - TTS (text_to_speech): Convert responses to natural audio

Flow (repeating loop):
  1. User speaks
  2. STT: Speech → Text
  3. Append user message to conversation history
  4. LLM: Generate next response based on ENTIRE history
  5. TTS: Response → Audio
  6. Play audio to user
  7. Loop back to step 1

CRITICAL: NOT using hardcoded flow (handle-response → handle-response-experience → handle-visit-plans)
Instead: Single webhook handles all steps, LLM drives conversation dynamically
"""
import logging
import json
import re
from datetime import datetime
from statistics import mode
from typing import Optional, Dict, List, Tuple
from src.models.database import get_session, CallHistory, Customer
from src.services.servam_service import get_servam_service
from src.agents.relationship_manager_agent import RelationshipManagerAgent
from config.config import get_config

logger = logging.getLogger(__name__)
config = get_config()

# Voice LLM: enough headroom (reasoning models); moderate temp for natural phone tone
LLM_VOICE_MAX_TOKENS = 512
LLM_VOICE_TEMPERATURE = 0.35

# Samvaad / branding — spoken in first turn templates
BRAND_LUMINARE_AI = "Luminare AI"

# Global conversation history storage (in production, use Redis/database)
# Key: call_sid, Value: {customer_id, language, messages: [{role, content}], turn_count, start_time}
CONVERSATION_HISTORY = {}


class ConversationalCallManager:
    """
    Manages LLM-driven multi-turn conversations with dynamic flow
    """
    
    def __init__(self):
        self.sarvam = get_servam_service()
        self.agent = RelationshipManagerAgent()
        self.session = get_session()
    
    def _should_switch_language(self, current_language: str, detected_language: str, text: str) -> bool:
        """
        Decide whether to switch conversation language for this turn.

        Prevent abrupt switches on short/ambiguous utterances like "और", "ok", "haan".
        Only allow switching between English and Hindi freely; other languages
        require very strong evidence (STT often hallucinates ta/te/ml/kn on English speech).
        """
        if not detected_language or detected_language == current_language:
            return False

        stripped_text = (text or "").strip()
        if not stripped_text:
            return False

        # Only allow en↔hi switches freely; block ta/te/ml/kn unless overwhelming evidence
        allowed_easy_switch = {"en", "hi", "ta", "te", "ml"}
        if detected_language not in allowed_easy_switch:
            logger.info(f"🌍 Blocking language switch to {detected_language} (only en/hi allowed without strong evidence)")
            return False

        words = stripped_text.split()
        text_len = len(stripped_text)
        latin_letters = sum(1 for c in stripped_text if c.isascii() and c.isalpha())
        devanagari_chars = sum(1 for c in stripped_text if 0x0900 <= ord(c) <= 0x097F)

        # Require stronger signal for very short interjections.
        is_short_utterance = text_len < 12 or len(words) <= 2
        if is_short_utterance:
            if detected_language == "en":
                return latin_letters >= 6
            if detected_language == "hi":
                return devanagari_chars >= 6
            return False

        return True

    def _ensure_complete_spoken_response(self, text: str, language: str) -> str:
        """
        Normalize LLM output so TTS doesn't speak clipped mid-clause responses.
        """
        normalized = (text or "").strip()
        if not normalized:
            return normalized

        terminal_marks = (".", "!", "?", "।")
        if normalized.endswith(terminal_marks):
            return normalized

        lang = (language or "en").lower()

        if lang == "en":
            dangling_endings = (
                "to", "and", "or", "but", "because", "so", "with", "for", "of", "that",
                "which", "ensure", "ensure that", "make sure", "help"
            )
            lower = normalized.lower().rstrip()
            for ending in dangling_endings:
                if lower.endswith(f" {ending}") or lower == ending:
                    return f"{normalized} your next stay is even better."
            return f"{normalized}."

        if lang == "hi":
            return f"{normalized}।"

        return f"{normalized}."

    def _is_filler_utterance(self, text: str) -> bool:
        """True if the user only said filler / deictic words (e.g. 'Just', 'This') with no substance."""
        t = (text or "").strip().lower()
        if not t:
            return True
        words = re.findall(r"[a-zA-Z']+", t)
        if not words:
            return len(t) <= 4
        # Only non-semantic noise / deictics — not "good", "yes", "nice" (those can be real answers)
        fillers = {
            "just", "this", "that", "um", "uh", "hmm", "mm", "mmm", "okay", "ok",
            "well", "so", "hi", "hey", "hello", "bye", "thanks", "thank", "you",
            "got", "it",
        }
        if len(words) > 4:
            return False
        return all(w in fillers for w in words)

    # ==================== Samvaad Detection ====================  
    def get_system_prompt(self, mode: str) -> str:
        voice = """
VOICE (Samvaad-style — you are """ + BRAND_LUMINARE_AI + """, a natural voice assistant powered by Sarvam. Sound human on a live call, not a chatbot):
- Short, natural sentences. Use contractions: I'm, we're, that's, don't, it's.
- Warm and calm; avoid stiff corporate openers every time — vary your wording.
- React to what they *just* said; one clear thought per reply.
- Never repeat your *previous* reply verbatim. If they only say "okay", "just", or "this", acknowledge briefly and move toward a clean close — do not paste the same long paragraph again.
- Do not list policies unless they ask. No emojis.
- Output ONLY the words you would speak aloud. Never use <redacted_thinking>, hidden reasoning, or step-by-step planning in your reply.
"""
        if mode == "hotel":
            return """You are """ + BRAND_LUMINARE_AI + """ for Luminare Hotels — like Sarvam Samvaad: clear, brief, friendly phone conversation with a guest.
""" + voice + """
              CONVERSATION FLOW (follow this structure):
                Turn 1: Acknowledge how they are doing, then ask "Are you planning to visit us again soon?"
                Turn 2 (if they say YES): "That's wonderful! As a valued guest, we have an exclusive 20% loyalty discount for your next stay. We'd love to welcome you back. See you soon and take care!"
                Turn 2 (if they say NO / not sure): "No worries! Whenever you plan in the future, we have a special 20% discount waiting just for you. Hope to see you soon! Take care."
                Turn 2 (if negative experience): Apologize sincerely, offer 30% recovery discount, say goodbye warmly.
                Turn 3+: Thank them and say goodbye. The call should end naturally after the discount offer.

              IMPORTANT: Once you have offered the discount and said goodbye, do NOT continue the conversation. End warmly.  
              """

        elif mode == "election":
            return """You are """ + BRAND_LUMINARE_AI + """ representing Luminare Party — Samvaad-style: natural, respectful voter outreach (not a script).
""" + voice + """
              CONVERSATION FLOW (follow this structure):
                Turn 1: Acknowledge their concerns, then ask "Are you planning to vote for us in the upcoming election?"
                Turn 2 (if they say YES): "That's wonderful! We truly appreciate your support. Together, we can make a difference and create a better future. Thank you for standing with us!"
                Turn 2 (if they say NO / not sure): "I understand. If you have any questions about our policies or want to know more about our vision for the future, I'm here to chat. Your voice matters, and we'd love to earn your support!"
                Turn 2 (if negative experience with party): Apologize sincerely, address their concerns, and say goodbye warmly.
                Turn 3+: Thank them and say goodbye. The call should end naturally after addressing their concerns.
                IMPORTANT: Once you have addressed their concerns and said goodbye, do NOT continue the conversation. End warmly."""

        elif mode == "feedback":
            return """You are """ + BRAND_LUMINARE_AI + """ for Luminare Hospitals — Samvaad-style patient feedback: warm, unhurried, one question at a time.
""" + voice + """
              CONVERSATION FLOW (follow this structure):
                Turn 1: Greet as Luminare AI, then ask how their visit or care experience was (one short question).
                Turn 2 (if they sound positive): Warmth first, then one short invite for detail if they want — avoid long "we appreciate your feedback" blocks.
                Turn 2 (if they sound negative or mixed): Brief sorry that matches what they said; invite one concrete detail; sound like a person, not a form letter.
                Turn 3+: Short thanks and a clean goodbye — no new questions unless they raised something unclear.
                IMPORTANT: After you've thanked them and said goodbye, stop — do not repeat the same closing if they only grunt "okay" or "mm-hmm"."""

        return "You are a helpful AI assistant."
      
    # ==================== LANGUAGE DETECTION (Script-based) ====================
    
    def detect_language_from_script(self, text: str) -> str:
        """
        Detect language based on Unicode script ranges.
        Returns language code: 'en', 'hi', 'ta', 'te', 'ml', etc.
        
        Script ranges:
        - Devanagari (Hindi, Marathi): U+0900–U+097F
        - Tamil: U+0B80–U+0BFF
        - Telugu: U+0C00–U+0C7F
        - Malayalam: U+0D00–U+0D7F
        """
        if not text:
            return "en"
        
        devanagari_count = sum(1 for c in text if 0x0900 <= ord(c) <= 0x097F)
        tamil_count = sum(1 for c in text if 0x0B80 <= ord(c) <= 0x0BFF)
        telugu_count = sum(1 for c in text if 0x0C00 <= ord(c) <= 0x0C7F)
        malayalam_count = sum(1 for c in text if 0x0D00 <= ord(c) <= 0x0D7F)
        
        # Check if text contains Indian scripts
        if devanagari_count > 2:  # At least 3 Devanagari chars = Hindi
            return "hi"
        elif tamil_count > 2:
            return "ta"
        elif telugu_count > 2:
            return "te"
        elif malayalam_count > 2:
            return "ml"
        else:
            return "en"  # Default to English
    
    # ==================== CONVERSATION HISTORY MANAGEMENT ====================
    
    def init_conversation(self, call_sid: str, customer_id: str, language: str = "en", mode: str = "hotel") -> Optional[Dict]:
        """
        Initialize conversation history for a new call
        
        Args:
            call_sid: Twilio call ID
            customer_id: Customer ID
            language: Language code (en, hi, ta, etc)
            
        Returns:
            Conversation context dict
        """
        try:
            is_web_user = customer_id.startswith("web")

            if is_web_user:
                customer = type("Customer", (), {
                    "name": "Web User",
                    "total_visits": 0,
                    "loyalty_score": 0,
                    "last_stay_date": None,
                    "preferred_room_type": None
                })()
            else:
                customer = self.session.query(Customer).filter_by(customer_id=customer_id).first()

                if not customer:
                    logger.error(f"Customer {customer_id} not found")
                    return None    
            
            # System prompt - natural conversational style
            customer_context = f"""
Customer Profile:
- Name: {customer.name}
- Total Visits: {customer.total_visits}
- Loyalty Score: {customer.loyalty_score}
- Last Visit: {customer.last_stay_date.strftime('%B %Y') if customer.last_stay_date else 'Unknown'}
- Preferred Room: {customer.preferred_room_type or 'Not specified'}
"""
            system_prompt = self.get_system_prompt(mode)
            system_message = f"""
{system_prompt}

Customer Details: {customer_context}

Rules:
- Respond in {language} only.
- Keep response to 1-2 short sentences max (voice-friendly for TTS).
- Follow the conversation flow strictly.
- Read the user's last message and respond directly to it — sound like a real person, not a template.
- No thinking tags or internal reasoning — only speakable text.
- You are {BRAND_LUMINARE_AI} (Sarvam voice); sound helpful and conversational, not sales-heavy.
"""
            
            context = {
                "call_sid": call_sid,
                "customer_id": customer_id,
                "customer_name": customer.name,
                "language": language,
                "mode": mode,
                "messages": [
                    {"role": "system", "content": system_message}
                ],
                "turn_count": 0,
                "start_time": datetime.utcnow(),
                "sentiment_history": [],
                "conversation_done": False,
            }
            
            CONVERSATION_HISTORY[call_sid] = context
            logger.info(f"✓ Conversation initialized: call_sid={call_sid}, customer={customer_id}, lang={language}")
            return context
        
        except Exception as e:
            logger.error(f"Error initializing conversation: {str(e)}")
            return None
    
    def get_conversation_context(self, call_sid: str) -> Optional[Dict]:
        """Get existing conversation context"""
        return CONVERSATION_HISTORY.get(call_sid)

    def get_stt_language_code(self, call_sid: str) -> str:
        """
        Sarvam STT language_code for the *next* utterance (based on session language so far).
        Uses en-IN for English sessions instead of 'unknown' to reduce wrong-script hallucinations.
        """
        ctx = self.get_conversation_context(call_sid)
        if not ctx:
            return "en-IN"
        raw = (ctx.get("language") or "en").lower()
        if raw.startswith("en"):
            lang = "en"
        elif raw.startswith("hi"):
            lang = "hi"
        elif raw.startswith("ta"):
            lang = "ta"
        elif raw.startswith("te"):
            lang = "te"
        elif raw.startswith("ml"):
            lang = "ml"
        else:
            lang = raw.split("-")[0].split("_")[0] if raw else "en"
        mapping = {
            "en": "en-IN",
            "hi": "hi-IN",
            "ta": "ta-IN",
            "te": "te-IN",
            "ml": "ml-IN",
        }
        return mapping.get(lang, "en-IN")
    
    def append_user_message(self, call_sid: str, user_text: str) -> bool:
        """
        Append user message to conversation history & auto-detect language
        
        Args:
            call_sid: Twilio call ID
            user_text: User's spoken text
            
        Returns:
            True if successful
        """
        try:
            context = self.get_conversation_context(call_sid)
            if not context:
                logger.error(f"Conversation context not found: {call_sid}")
                return False
            
            context["messages"].append({
                "role": "user",
                "content": user_text
            })
            
            # 🌍 AUTO-DETECT LANGUAGE from user's text (script-based)
            # Keep current language on silence/empty/noise placeholders.
            normalized_text = (user_text or "").strip().lower()
            is_silence = normalized_text in ["", "[silence]", "silence", "...", "."]

            if not is_silence:
                detected_lang = self.detect_language_from_script(user_text)

                if self._should_switch_language(context["language"], detected_lang, user_text):
                    logger.info(f"🌍 Language detected: {context['language']} → {detected_lang}")
                    context["language"] = detected_lang
            
            # Skip sentiment analysis to reduce API calls
            # sentiment_result = self.sarvam.analyze_sentiment(user_text, context["language"])
            # sentiment = sentiment_result.get("sentiment", "neutral") if sentiment_result else "neutral"
            sentiment = "neutral"  # Default sentiment
            context["sentiment_history"].append(sentiment)
            
            logger.info(f"✓ User: {user_text[:50]}... (lang: {context['language']}, sentiment: {sentiment})")
            return True
        
        except Exception as e:
            logger.error(f"Error appending user message: {str(e)}")
            return False
    
    def append_agent_message(self, call_sid: str, agent_text: str) -> bool:
        """
        Append agent message to conversation history
        
        Args:
            call_sid: Twilio call ID
            agent_text: Agent's response text
            
        Returns:
            True if successful
        """
        try:
            context = self.get_conversation_context(call_sid)
            if not context:
                logger.error(f"Conversation context not found: {call_sid}")
                return False
            
            context["messages"].append({
                "role": "assistant",
                "content": agent_text
            })
            
            context["turn_count"] += 1
            logger.info(f"✓ Agent (turn {context['turn_count']}): {agent_text[:50]}...")
            return True
        
        except Exception as e:
            logger.error(f"Error appending agent message: {str(e)}")
            return False
    
    # ==================== LANGUAGE DETECTION (LLM-Based) ====================
    
    def detect_language_llm(self, text: str, current_language: str = "en") -> str:
        """
        Detect the language of user text using LLM
        
        Much more reliable than keyword matching!
        
        Args:
            text: User's text to analyze
            current_language: Current language (fallback if detection fails)
            
        Returns:
            Language code (en, hi, ta, te, ml) or current_language if detection fails
        """
        try:
            if not text or len(text.strip()) < 2:
                return current_language
            
            # Use LLM to detect language (with short timeout via max_tokens=10)
            detection_prompt = f"""Detect language. Return ONLY code: en/hi/ta/te/ml/mixed

Text: "{text[:100]}"

CODE ONLY:"""
            
            response = self.sarvam.client.chat.completions.create(
                model="sarvam-m",
                messages=[{"role": "user", "content": detection_prompt}],
                max_tokens=5,  # VERY short - just the code
                temperature=0.0  # Deterministic
            )
            
            if response and hasattr(response, 'choices') and len(response.choices) > 0:
                detected = response.choices[0].message.content.strip().lower()
                
                # Check if it's a recognized code
                recognized_langs = ["en", "hi", "ta", "te", "ml", "mixed"]
                if detected in recognized_langs:
                    if detected == "mixed":
                        logger.info(f"✓ LLM: Mixed language → using {current_language}")
                        return current_language
                    else:
                        logger.info(f"✓ LLM: Language detected as {detected}")
                        return detected
                else:
                    logger.debug(f"LLM returned unrecognized: {detected}")
                    return current_language
            
            logger.debug(f"LLM language detection empty, using current: {current_language}")
            return current_language
        
        except Exception as e:
            logger.debug(f"LLM language detection error (using {current_language}): {type(e).__name__}")
            return current_language
    
    # ==================== STT (Speech-to-Text) ====================
    
    def speech_to_text(self, call_sid: str, audio_data: bytes) -> Optional[str]:
        """
        Convert speech to text using Sarvam STT
        
        Args:
            call_sid: Twilio call ID
            audio_data: Audio bytes
            
        Returns:
            Transcribed text or None if failed
        """
        try:
            context = self.get_conversation_context(call_sid)
            if not context:
                logger.error(f"Conversation context not found: {call_sid}")
                return None
            
            language = context["language"]
            
            # STT using Sarvam
            logger.debug(f"Calling STT for audio ({len(audio_data)} bytes)...")
            stt_result = self.sarvam.speech_to_text(audio_data, language=language)
            
            if not stt_result:
                logger.warning("STT failed to transcribe audio")
                return None
            
            text = stt_result.get("text", "").strip()
            detected_lang = stt_result.get("language", language)
            confidence = stt_result.get("confidence", 0)
            
            logger.info(f"✓ STT: '{text}' (confidence: {confidence:.2%})")
            
            # Update language if detected
            if detected_lang and detected_lang != language and len(text) > 3:
                old_lang = context["language"]
                context["language"] = detected_lang
                logger.info(f"   Language updated: {old_lang} → {detected_lang}")
            
            return text
        
        except Exception as e:
            logger.error(f"Error in speech_to_text: {str(e)}")
            return None
    
    # ==================== LLM (Text Generation via Sarvam LLM) ====================
    
    def generate_next_response(self, call_sid: str) -> Optional[str]:
        """
        Generate next response using Sarvam LLM based on conversation history
        
        Smart triggers detect conversation flow without rigid turn logic:
        - Detect if user wants to end call ("bye", "busy", "not interested")
        - Detect if user mentions another visit
        - Detect complaints/concerns
        - Guide LLM to offer discount if engagement is low
        
        Args:
            call_sid: Twilio call ID
            
        Returns:
            Generated response text or None if failed
        """
        try:
            context = self.get_conversation_context(call_sid)
            if not context:
                logger.error(f"Conversation context not found: {call_sid}")
                return None
            
            if context.get("conversation_done"):
                return None

            # Get last user message for trigger detection
            last_user_msg = ""
            for msg in reversed(context["messages"]):
                if msg["role"] == "user":
                    last_user_msg = msg["content"].lower()
                    break
            mode = context.get("mode", "hotel")
            language = context["language"]

            # Feedback: vague filler late in the call — short closing, no duplicate LLM block (faster + human)
            if mode == "feedback" and context["turn_count"] >= 3 and self._is_filler_utterance(last_user_msg):
                context["conversation_done"] = True
                n = context["turn_count"]
                if language == "hi":
                    outs = [
                        "ठीक है — समय देने के लिए धन्यवाद। अपना ख्याल रखिए!",
                        "धन्यवाद — यह हमारे लिए मायने रखता है। जल्दी फिर बात करेंगे!",
                    ]
                else:
                    outs = [
                        "Alright — thanks for taking the time. Wishing you a good day!",
                        "Thanks — that really helps us. Take care!",
                        "Appreciate you sharing that. Have a good one!",
                    ]
                pick = outs[n % len(outs)]
                return self._ensure_complete_spoken_response(pick, language)

            # ============ SMART TRIGGER DETECTION ============
            if mode == "hotel":

                end_keywords = [
                    "bye", "goodbye", "see you", "talk later", "not interested",
                    "busy", "don't call again", "okay bye", "ok bye", "bye bye",
                ]
                if any(word in last_user_msg for word in end_keywords):
                    context["conversation_done"] = True
                    return {
                        "en": "Thank you so much for your time. Take care, and we hope to see you again soon!",
                        "hi": "आपके समय के लिए बहुत धन्यवाद! अपना ख्याल रखें, जल्द ही फिर मिलेंगे!",
                        "ta": "உங்கள் நேரத்திற்கு மிக்க நன்றி! பார்த்துக் கொள்ளுங்கள், விரைவில் மீண்டும் சந்திப்போம்!",
                        "te": "మీ సమయానికి చాలా ధన్యవాదాలు! జాగ్రత్తగా ఉండండి, త్వరలో మళ్లీ కలుద్దాం!",
                        "ml": "നിങ്ങളുടെ സമയത്തിന് വളരെ നന്ദി! ശ്രദ്ധിക്കുക, വീണ്ടും കാണാം!",
                    }.get(language, "Thank you so much for your time. Take care, and we hope to see you again soon!")
                no_visit_keywords = ["not planning", "maybe later", "not soon"]
                if any(phrase in last_user_msg for phrase in no_visit_keywords):
                    return {
                        "en": "No worries! Whenever you plan in the future, we have a special 20% discount waiting just for you. Hope to see you soon! Take care.",
                        "hi": "कोई बात नहीं! जब भी आप भविष्य में योजना बनाएं, हमारे पास आपके लिए एक विशेष 20% छूट तैयार है। आशा है कि जल्द ही मिलेंगे! ध्यान रखना।"
                    }.get(language, "No worries! Whenever you plan in the future, we have a special 20% discount waiting just for you. Hope to see you soon! Take care.")
                complaint_keywords = ["not happy", "bad experience", "complain", "issue", "problem", "disappointed"]
                if any(word in last_user_msg for word in complaint_keywords):
                    return {
                        "en": "I'm really sorry to hear that. We strive to provide the best experience, and your feedback is valuable to us. Please accept a 30% discount on your next stay as a token of our apology. We hope to have the chance to make it up to you in the future.",
                        "hi": "यह सुनकर मुझे बहुत खेद है। हम सर्वोत्तम अनुभव प्रदान करने का प्रयास करते हैं, और आपकी प्रतिक्रिया हमारे लिए मूल्यवान है। कृपया हमारी माफी के प्रतीक के रूप में अपनी अगली यात्रा पर 30% छूट स्वीकार करें। हमें उम्मीद है कि भविष्य में इसे सुधारने का मौका मिलेगा।"
                    }.get(language, "I'm really sorry to hear that. We strive to provide the best experience, and your feedback is valuable to us. Please accept a 30% discount on your next stay as a token of our apology. We hope to have the chance to make it up to you in the future.")

                # First assistant reply: strict Turn 1 + Luminare AI (matches Sarvaad-style intro)
                if context["turn_count"] == 0:
                    first_turn = {
                        "en": f"Hi — this is {BRAND_LUMINARE_AI} with Luminare Hotels. How are you today, and are you thinking of visiting us again soon?",
                        "hi": f"नमस्ते — मैं {BRAND_LUMINARE_AI} से Luminare Hotels की ओर से बोल रहा हूँ। आप आज कैसे हैं, और क्या आप जल्द फिर से आने की सोच रहे हैं?",
                        "ta": f"வணக்கம் — நான் Luminare Hotels-இலிருந்து {BRAND_LUMINARE_AI}. இன்று எப்படி இருக்கிறீர்கள், விரைவில் மீண்டும் வர திட்டமிருக்கிறீர்களா?",
                        "te": f"నమస్కారం — నేను Luminare Hotels తరఫున {BRAND_LUMINARE_AI}. ఈరోజు ఎలా ఉన్నారు, త్వరలో మళ్లీ రావాలని అనుకుంటున్నారా?",
                        "ml": f"നമസ്കാരം — ഞാൻ Luminare Hotels-ൽ നിന്ന് {BRAND_LUMINARE_AI} ആണ്. ഇന്ന് എങ്ങനെയുണ്ട്, വീണ്ടും വരാൻ പ്ലാൻ ചെയ്യുന്നുണ്ടോ?",
                    }
                    return self._ensure_complete_spoken_response(
                        first_turn.get(language, first_turn["en"]),
                        language,
                    )

            elif mode == "election":

                if context["turn_count"] == 0:
                    lm = last_user_msg.strip()
                    decline = (
                        "not interested", "don't call", "stop", "busy", "not voting",
                    )
                    short_refuse = lm in ("no", "nope", "nah", "no.", "nope.")
                    if not short_refuse and not any(d in last_user_msg for d in decline):
                        first_turn = {
                            "en": f"Hi — this is {BRAND_LUMINARE_AI} with Luminare Party. How are you doing, and would you be open to a quick chat about the upcoming election?",
                            "hi": f"नमस्ते — मैं {BRAND_LUMINARE_AI} हूँ, Luminare Party की ओर से। आप कैसे हैं, और क्या आप चुनाव पर एक छोटी बातचीत के लिए तैयार हैं?",
                        }
                        return self._ensure_complete_spoken_response(
                            first_turn.get(language, first_turn["en"]),
                            language,
                        )

                if "no" in last_user_msg or "not" in last_user_msg:
                    return {
                        "en": "I understand your concerns. Can I share how our policies will benefit you?",
                        "hi": "मैं आपकी चिंताओं को समझता हूँ। क्या मैं आपको बता सकता हूँ कि हमारी नीतियाँ आपके लिए कैसे लाभकारी होंगी?"
                    }.get(language, "I understand your concerns. Can I share how our policies will benefit you?")   
                elif "yes" in last_user_msg or "vote" in last_user_msg:
                    return {
                        "en": "That's wonderful! We truly appreciate your support. Together, we can make a difference and create a better future. Thank you for standing with us!",
                        "hi": "यह शानदार है! हम आपके समर्थन की वास्तव में सराहना करते हैं। साथ मिलकर, हम एक फर्क कर सकते हैं और एक बेहतर भविष्य बना सकते हैं। हमारे साथ खड़े होने के लिए धन्यवाद!"
                    }.get(language, "That's wonderful! We truly appreciate your support. Together, we can make a difference and create a better future. Thank you for standing with us!")

            elif mode == "feedback":
                if any(
                    w in last_user_msg
                    for w in ("bye", "goodbye", "hang up", "got to go", "gotta go")
                ):
                    context["conversation_done"] = True
                    return self._ensure_complete_spoken_response(
                        "Thanks for your time with us — take care!",
                        language,
                    )

                if context["turn_count"] == 0:
                    first_turn = {
                        "en": f"Hi — this is {BRAND_LUMINARE_AI} with Luminare Hospitals. Thanks for speaking with us. Overall, how did your visit go?",
                        "hi": f"नमस्ते — मैं {BRAND_LUMINARE_AI} हूँ, Luminare Hospitals की ओर से। समय देने के लिए धन्यवाद — आपकी यात्रा कैसी रही?",
                    }
                    return self._ensure_complete_spoken_response(
                        first_turn.get(language, first_turn["en"]),
                        language,
                    )

                if "good" in last_user_msg or "great" in last_user_msg or "excellent" in last_user_msg:
                    return {
                        "en": "That's really good to hear — thanks for telling me. If anything stood out, I'd love to hear it.",
                        "hi": "यह सुनकर अच्छा लगा — बताने के लिए धन्यवाद। अगर कुछ खास लगा हो तो बता सकते हैं।"
                    }.get(language, "That's really good to hear — thanks for telling me. If anything stood out, I'd love to hear it.")
                elif "bad" in last_user_msg or "not good" in last_user_msg or "poor" in last_user_msg:
                    return {
                        "en": "I'm sorry it wasn't great — I hear you. What bothered you most, if you're okay sharing?",
                        "hi": "यह सुनकर अफ़सोस हुआ — मैं समझ रहा हूँ। अगर आप बता सकें तो सबसे ज़्यादा क्या खराब लगा?"
                    }.get(language, "I'm sorry it wasn't great — I hear you. What bothered you most, if you're okay sharing?")
                
            # ============ NORMAL CONVERSATION (LLM-DRIVEN) ============
            
            # Check turn limit (safety cutoff)
            if context["turn_count"] >= 8:
                logger.info(f"⏹️ Max turns reached ({context['turn_count']}), gracefully ending call")
                context["conversation_done"] = True
                lang = context["language"]
                closing = {
                    "en": "Thank you so much for chatting with us today! We hope to see you again soon. Take care!",
                    "hi": "आपसे बात करने के लिए बहुत-बहुत धन्यवाद! जल्दी मिलेंगे। अलविदा!",
                }
                return closing.get(lang, closing["en"])

            logger.debug(f"🟢 NORMAL FLOW (turn {context['turn_count']}): '{last_user_msg[:50]}'")
            
            # Build messages with system prompt + language instruction
            lang = context["language"]
            lang_names = {"en": "English", "hi": "Hindi", "ta": "Tamil", "te": "Telugu", "ml": "Malayalam"}
            lang_instruction = (
                f"\nRespond in {lang_names.get(lang, 'English')} only. "
                "1–2 short sentences max, as natural spoken dialogue (not marketing copy)."
            )
            
            system_with_lang = context["messages"][0]["content"].replace(
                f"- Respond in {context['language']} only.",
                f"- Respond in {lang_names.get(lang, 'English')} only."
            ) + lang_instruction
            
            messages = [{"role": "system", "content": system_with_lang}] + context["messages"][1:]
            
            acknowledgments = [
                "சரி சார்", "சரி", "okay", "ok", "haan", "ha", "accha",
                "theek hai", "sari", "yes", "yep", "sure", "alright", "fine"
            ]
            if any(ack in last_user_msg.lower() for ack in acknowledgments):
                turn = context["turn_count"]
                if turn >= 2:
                    context["conversation_done"] = True
                    closing = {
                        "en": "Thank you so much for your time! Have a wonderful day.",
                        "hi": "आपके समय के लिए बहुत धन्यवाद! आपका दिन शुभ हो।",
                        "ta": "உங்கள் நேரத்திற்கு மிக்க நன்றி! அருமையான நாள்!",
                        "te": "మీ సమయానికి చాలా ధన్యవాదాలు! మీకు శుభమైన రోజు.",
                        "ml": "നിങ്ങളുടെ സമയത്തിന് വളരെ നന്ദി! ഒരു മനോഹരമായ ദിവസം."
                    }
                    return closing.get(lang, closing["en"])
            
            try:
                logger.debug(f"Calling LLM (turn {context['turn_count']}, lang={lang}, msgs={len(messages)})...")
                logger.debug(f"System prompt length: {len(system_with_lang)}")
                logger.debug(f"Last 3 messages: {messages[-3:] if len(messages) >= 3 else messages}")
                
                # Call LLM — tight max_tokens keeps latency low for voice turns
                agent_text = self.sarvam.call_llm_safe(
                    messages=messages,
                    model="sarvam",
                    max_tokens=LLM_VOICE_MAX_TOKENS,
                    temperature=LLM_VOICE_TEMPERATURE,
                )
                
                if not agent_text:
                    logger.error(f"LLM returned None")
                    return None
                
                if len(agent_text.strip()) == 0:
                    logger.error(f"LLM returned empty text")
                    return None
                
                # 🧠 Strip thinking tags if present (some LLMs return reasoning)
                # e.g., <think>reasoning...</think>actual response
                agent_text = re.sub(r'<think>.*?</think>\s*', '', agent_text, flags=re.DOTALL).strip()

                # Ensure response is complete and speakable before TTS playback.
                agent_text = self._ensure_complete_spoken_response(agent_text, lang)
                
                if len(agent_text) < 3:
                    logger.warning(f"LLM returned very short response after filtering: '{agent_text}'")
                    return None
                
                logger.info(f"✓ LLM response (turn {context['turn_count']}, lang={lang}): {agent_text[:80]}...")
                return agent_text
            
            except Exception as llm_err:
                logger.error(f"LLM API error: {type(llm_err).__name__}: {str(llm_err)}")
                import traceback
                logger.error(f"Traceback: {traceback.format_exc()}")
                return None
        
        except Exception as e:
            logger.error(f"Error in generate_next_response: {str(e)}")
            return None
    
    # ==================== TTS (Text-to-Speech) ====================
    
    def text_to_speech_url(self, agent_text: str, language: str) -> Optional[str]:
        """
        Convert text to speech and return endpoint URL (on-the-fly, no file storage)
        
        Args:
            agent_text: Text to convert
            language: Language code
            
        Returns:
            URL to audio endpoint or None if failed
        """
        try:
            # Validate text is not empty
            if not agent_text or not isinstance(agent_text, str) or len(agent_text.strip()) == 0:
                logger.error(f"❌ TTS error: Empty or invalid text provided")
                return None
            
            import urllib.parse
            
            tts_lang_map = {
                "en": "en-IN",
                "hi": "hi-IN",
                "ta": "ta-IN",
                "te": "te-IN",
                "ml": "ml-IN"
            }
            tts_language = tts_lang_map.get(language, "en-IN")

            # URL encode the text
            encoded_text = urllib.parse.quote(agent_text.strip())
            audio_url = f"/api/v1/audio/generate?text={encoded_text}&language={tts_language}"
            
            logger.info(f"✓ TTS URL generated: {tts_language} ({len(agent_text)} chars)")
            return audio_url
        
        except Exception as e:
            logger.error(f"Error in text_to_speech_url: {str(e)}")
            return None
    
    # ==================== CALL MANAGEMENT ====================
    
    def end_conversation(self, call_sid: str) -> Optional[Dict]:
        """
        End conversation and save to database
        
        Args:
            call_sid: Twilio call ID
            
        Returns:
            Conversation summary
        """
        try:
            context = self.get_conversation_context(call_sid)
            if not context:
                logger.warning(f"Conversation context not found: {call_sid}")
                return None
            
            customer_id = context["customer_id"]
            duration = (datetime.utcnow() - context["start_time"]).total_seconds()
            
            # Extract conversation for storage (skip system message)
            conversation_text = "\n".join([
                f"{msg['role'].upper()}: {msg['content']}"
                for msg in context["messages"][1:]  # Skip system message
            ])
            
            # Analyze overall sentiment
            if context["sentiment_history"]:
                positive_count = sum(1 for s in context["sentiment_history"] if s == "positive")
                negative_count = sum(1 for s in context["sentiment_history"] if s == "negative")
                overall_sentiment = "positive" if positive_count > negative_count else ("negative" if negative_count > positive_count else "neutral")
            else:
                overall_sentiment = "neutral"
            
            # Save to database
            call_record = CallHistory(
                customer_id=customer_id,
                call_date=datetime.utcnow(),
                call_duration=int(duration),
                call_status="completed",
                conversation_transcript=conversation_text,
                sentiment=overall_sentiment,
                agent_notes=f"LLM-driven, Turns: {context['turn_count']}, Language: {context['language']}"
            )
            self.session.add(call_record)
            self.session.commit()
            
            # Clean up conversation
            del CONVERSATION_HISTORY[call_sid]
            
            logger.info(f"✓ Call ended: customer={customer_id}, duration={int(duration)}s, turns={context['turn_count']}, sentiment={overall_sentiment}")
            
            return {
                "customer_id": customer_id,
                "duration": int(duration),
                "turns": context["turn_count"],
                "sentiment": overall_sentiment
            }
        
        except Exception as e:
            logger.error(f"Error ending conversation: {str(e)}")
            return None
    
    def get_greeting(self, customer_name: str, language: str = "en") -> str:
        """Get personalized greeting"""
        greetings = {
            "en": f"Hello {customer_name}! This is calling from Beacon Hotel. How are you doing today?",
            "hi": f"नमस्ते {customer_name}! यह बीकन होटल की ओर से कॉल है। आप कैसे हैं?",
            "ta": f"வணக்கம் {customer_name}! பீகன் ஹோட்டலில் இருந்து அழைக்கிறோம்.",
            "te": f"హలో {customer_name}! బీకన్ హోటల్ నుండి కాల్ చేస్తున్నాం.",
            "ml": f"ഹലോ {customer_name}! ബീകൻ ഹോട്ടലിൽ നിന്നുള്ള കോൾ ആണ്.",
        }
        return greetings.get(language, greetings["en"])
    
    def get_next_twiml(self, audio_url: str, webhook_url: str, language: str = "en") -> str:
        """
        Generate TwiML for playing audio and recording user response
        
        Uses Twilio <Record> to capture raw audio → Sarvam STT for transcription
        (NOT Twilio's limited STT)
        
        Args:
            audio_url: URL to audio file to play
            webhook_url: Webhook URL to receive recording URL
            language: Language code (en, hi, ta, te, ml) - passed to webhook
            
        Returns:
            TwiML XML string
        """
        try:
            # Escape URLs for XML
            audio_url_xml = audio_url.replace("&", "&amp;")

            # Add language to callback URL
            separator = "&" if "?" in webhook_url else "?"
            callback_url = f"{webhook_url}{separator}language={language}"
            callback_url_xml = callback_url.replace("&", "&amp;")

            # IMPORTANT:
            # - action: controls call flow and expects TwiML response (used for conversation loop)
            # If action is missing, Twilio can complete the <Record> and then end the call.
            # NOTE: Avoid using recordingStatusCallback here with the same webhook,
            # otherwise the same recording may be processed twice.
            twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
            <Response>
                <Play>{audio_url_xml}</Play>
                <Record maxLength="30" timeout="5" playBeep="true"
                        action="{callback_url_xml}" method="POST"
                        />
            </Response>"""
            
            logger.debug(f"Generated TwiML with Record (using Sarvam STT for lang={language})")
            return twiml
        
        except Exception as e:
            logger.error(f"Error generating TwiML: {str(e)}")
            return """<?xml version="1.0" encoding="UTF-8"?>
            <Response>
                <Say>Thank you for your time.</Say>
            </Response>"""
    
    def get_greeting_script(self, customer_name: str, detected_language: str = "en") -> str:
        """
        Generate warm greeting based on language and customer info
        IMPORTANT: This returns ONLY the greeting, NOT the prompt!
        The prompt "Please say yes or hi to continue" is added separately in TwiML Gather tag.
        
        Args:
            customer_name: Customer's name
            detected_language: Language code (en, hi, etc)
            
        Returns:
            Greeting script in appropriate language (without prompt)
        """
        greetings = {
            "en": f"Hello {customer_name}! This is calling from Beacon Hotel. How are you doing today?",
            "hi": f"नमस्ते {customer_name}! यह बीकन होटल की ओर से कॉल है। आप कैसे हैं?",
            "ta": f"வணக்கம் {customer_name}! பீகன் ஹோட்டலில் இருந்து அழைக்கிறோம். நீங்கள் எப்படி இருக்கிறீர்கள்?",
            "te": f"హలో {customer_name}! బీకన్ హోటల్ నుండి కాల్ చేస్తున్నాం. మీరు ఎలా ఉన్నారు?",
            "ml": f"ഹലോ {customer_name}! ബീകൻ ഹോട്ടലിൽ നിന്നുള്ള കോൾ ആണ്. നിങ്ങൾ എങ്ങനെയുണ്ട്?"
        }
        return greetings.get(detected_language, greetings["en"])
    
    def get_experience_question(self, customer_name: str, language: str) -> str:
        """Ask about customer's experience at hotel"""
        questions = {
            "en": f"That's wonderful {customer_name}! I'm so glad to hear. How was your last experience with us at Beacon Hotel? Was everything good?",
            "hi": f"बहुत अच्छा {customer_name}! मुझे खुशी है। बीकन होटल में आपका अनुभव कैसा रहा? क्या सब कुछ ठीक था?",
            "ta": f"அருமை {customer_name}! என்னுடைய மகிழ்ச்சி. பீகன் ஹோட்டலில் உங்கள் அனுபவம் எப்படி இருந்தது? நல்லிருந்ததா?",
        }
        return questions.get(language, questions["en"])
    
    def get_visit_plans_question(self, customer_name: str, language: str) -> str:
        """Ask about future visit plans"""
        questions = {
            "en": f"Thank you for sharing that {customer_name}! That's wonderful to hear. Are you planning to visit us again soon? We'd love to see you!",
            "hi": f"वह शेयर करने के लिए धन्यवाद {customer_name}! क्या आप जल्द ही हमसे फिर से मिलने की योजना बना रहे हैं?",
            "ta": f"அதை சொல்லியதற்கு நன்றி {customer_name}! நீங்கள் மீண்டும் வர திட்டம் இருக்கிறதா?",
        }
        return questions.get(language, questions["en"])
    
    def get_loyalty_offer(self, customer_name: str, discount: float, language: str) -> str:
        """Present loyalty offer"""
        offers = {
            "en": f"Since you're such a valued guest {customer_name}, we have an exclusive {int(discount)}% loyalty discount waiting for you! We'd love to welcome you back. Shall I transfer you to our booking team?",
            "hi": f"{customer_name}, आप हमारे मूल्यवान अतिथि हैं। हमारे पास आपके लिए {int(discount)}% की विशेष छूट है! क्या आप बुकिंग टीम से बात करना चाहेंगे?",
            "ta": f"{customer_name}, நீங்கள் எங்களின் மূல்யமான விருந்தினர்! உங்களுக்கு {int(discount)}% ছাড் உள்ளது! புককிங் டீமுடன் பேச விரும்புகிறீர்களா?",
        }
        return offers.get(language, offers["en"])
    
    def create_twiml_with_listen(self, text_to_say: str, action_url: str, 
                                 num_digits: int = 0, hint: str = "speech") -> str:
        """
        Create TwiML that plays text AND listens for response
        
        Args:
            text_to_say: Text for TTS
            action_url: Webhook URL for processing response
            num_digits: If >0, expect keypresses; if 0, expect speech
            hint: For speech recognition ("yes no", "currency", "speech" etc)
            
        Returns:
            TwiML XML string
        """
        if num_digits > 0:
            # Listen for keypress
            twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
            <Response>
                <Say>{text_to_say}</Say>
                <Gather numDigits="{num_digits}" timeout="5" action="{action_url}" method="POST">
                    <Say>Press 1 for yes, 2 for no, or just speak your response.</Say>
                </Gather>
                <Fallback>
                    <Say>Sorry, I didn't catch that. Let me transfer you to our team.</Say>
                </Fallback>
            </Response>"""
        else:
            # Listen for speech (speech recognition)
            twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
            <Response>
                <Say>{text_to_say}</Say>
                <Gather input="speech" speechTimeout="auto" hints="{hint}" 
                        action="{action_url}" method="POST">
                    <Say>Please tell me your response.</Say>
                </Gather>
                <Fallback>
                    <Say>Sorry, I didn't catch that. Please try again.</Say>
                </Fallback>
            </Response>"""
        
        return twiml
