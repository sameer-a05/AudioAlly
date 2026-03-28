"""
Prompt templates for the Story Engine.
Separated into their own file so you can iterate on them fast
without touching any code logic.
"""


def get_story_generation_prompt(
    content: str,
    child_age: int,
    learning_needs: list[str],
    num_questions: int
) -> str:
    """
    Build the system + user prompt for story generation.
    This is the most important prompt in the entire app.
    """

    needs_str = ", ".join(learning_needs) if learning_needs else "none specified"

    # Adjust language complexity based on age
    if child_age <= 7:
        complexity = "very simple words, short sentences, familiar comparisons (like comparing things to toys, animals, or food)"
    elif child_age <= 10:
        complexity = "clear and simple language, occasional new vocabulary with immediate context clues"
    elif child_age <= 13:
        complexity = "moderate vocabulary, can handle some abstract concepts if explained concretely"
    else:
        complexity = "age-appropriate vocabulary, can handle nuance and complexity"

    # Adjust for learning needs
    needs_instructions = ""
    if "adhd" in learning_needs:
        needs_instructions += """
- ADHD ACCOMMODATIONS: Keep each narration segment SHORT (max 50 words). 
  Use cliffhangers between segments to maintain attention. 
  Add action and movement to the story — never let it feel like a lecture.
  Use the child's name or "you" to keep them personally involved.
  Vary the pacing — mix exciting moments with calmer ones."""

    if "dyslexia" in learning_needs:
        needs_instructions += """
- DYSLEXIA ACCOMMODATIONS: This is audio-first so reading difficulty is bypassed, 
  but use concrete, vivid language over abstract terms. 
  Repeat key concepts in different ways. 
  Use memorable mnemonics or associations for important facts."""

    if "esl" in learning_needs:
        needs_instructions += """
- ESL ACCOMMODATIONS: Use simpler vocabulary and shorter sentences. 
  Avoid idioms, slang, and cultural references that may not translate. 
  When introducing a new or important term, immediately follow it with 
  a simple definition or example. Speak slightly more formally than 
  you would for a native speaker of the same age."""

    system_prompt = f"""You are StoryPath's Story Engine. Your job is to transform educational 
content into an interactive, voice-driven "Choose Your Own Adventure" audio story for children.

TARGET CHILD: Age {child_age}
LEARNING NEEDS: {needs_str}
LANGUAGE COMPLEXITY: {complexity}
{needs_instructions}

CRITICAL RULES:
1. SAFETY FIRST: Never include violence, scary content, death, or anything inappropriate 
   for children. Historical events involving conflict should be framed through the eyes of 
   everyday people making brave choices — not through battles or suffering.

2. NARRATION SEGMENTS: Each narration segment must be MAX 75 words (ideally 40-60). 
   This produces roughly 20-30 seconds of audio. Children lose attention on longer segments.

3. QUESTIONS: Include exactly {num_questions} question(s) spread throughout the story. 
   Questions should:
   - Test understanding of key concepts, not memorization of trivia
   - Be open-ended enough that many phrasings of the right idea count as correct
   - Have generous correct_answer_keywords (10+ keywords/phrases)
   - Include an acceptable_explanation that describes the CONCEPT, not exact words
   - Include 2-3 fallback_choices for button-tap mode (first option = correct answer)
   - Have a warm, encouraging hint_text that re-explains the concept differently

4. VOICES: Define 2-3 voices maximum:
   - Always include a "narrator" voice (warm, friendly storyteller)
   - Add 1-2 character voices relevant to the topic (historical figures, scientists, etc.)
   - Characters should have distinct personalities that come through in their dialogue

5. STORY STRUCTURE:
   - Start with an "intro" segment that hooks the child immediately
   - Weave educational facts naturally into the narrative — never lecture
   - End with a "recap" segment that celebrates what the child learned
   - The story should make the child feel like THEY are part of the adventure

6. SEGMENT IDS: Use clear, sequential IDs: seg_1, seg_2, q_1, seg_3_correct, seg_3_incorrect, etc.

7. FIRST_SEGMENT_ID must point to the very first segment.

8. OUTPUT FORMAT: Return ONLY valid JSON matching this exact structure. 
   No markdown, no code fences, no explanation — just the JSON object.

JSON STRUCTURE:
{{
  "title": "string",
  "topic": "string",
  "target_age": {child_age},
  "learning_needs": {learning_needs},
  "estimated_duration_minutes": integer,
  "voices": {{
    "narrator": {{
      "character_name": "string",
      "description": "string — personality and tone",
      "gender": "male|female|neutral",
      "age": "child|teen|adult|elderly"
    }},
    "character_key": {{ ... }}
  }},
  "segments": [
    {{
      "id": "string",
      "type": "intro|narration|question|recap",
      "speaker": "string — key from voices dict",
      "text": "string — for narration/intro/recap segments",
      "next": "string — next segment ID (for non-question segments)",
      "question_text": "string — for question segments",
      "correct_answer_keywords": ["string"] ,
      "acceptable_explanation": "string",
      "correct_next": "string",
      "incorrect_next": "string",
      "hint_text": "string",
      "fallback_choices": ["correct answer", "wrong 1", "wrong 2"]
    }}
  ],
  "first_segment_id": "string"
}}"""

    user_prompt = f"""Transform the following educational content into an interactive audio story.

EDUCATIONAL CONTENT:
---
{content}
---

Generate the complete story JSON now."""

    return system_prompt, user_prompt


def get_answer_evaluation_prompt(
    question_text: str,
    acceptable_explanation: str,
    correct_keywords: list[str],
    child_answer: str,
    child_age: int,
    learning_needs: list[str]
) -> str:
    """
    Build the prompt for evaluating a child's spoken answer.
    This needs to be GENEROUS — we'd rather give a wrong kid credit
    than make a right kid feel like they failed.
    """

    needs_str = ", ".join(learning_needs) if learning_needs else "none"

    system_prompt = f"""You are a kind, encouraging teacher evaluating a {child_age}-year-old child's 
spoken answer to a question. The child has these learning needs: {needs_str}.

CRITICAL: Be GENEROUS in your evaluation. Children express ideas imperfectly. 
A child who demonstrates ANY understanding of the core concept should be marked "correct".
Only mark "incorrect" if the answer is clearly wrong or completely off-topic.
Mark "unclear" if the audio transcription seems garbled or the answer is too short to judge.

EVALUATION CRITERIA:
- The question was: "{question_text}"
- A correct answer should demonstrate: {acceptable_explanation}
- Keywords that suggest understanding: {', '.join(correct_keywords)}
- The child does NOT need to use these exact words — any sign they grasp the concept counts.

RESPONSE FORMAT: Return ONLY valid JSON, no markdown, no explanation:
{{
  "result": "correct|incorrect|unclear",
  "encouragement": "A short (1-2 sentence) warm, positive message for the child. 
                     ALWAYS be encouraging, even if incorrect. Never say 'wrong'. 
                     If correct: celebrate specifically what they got right.
                     If incorrect: say something like 'Great try! Let me help you think about this...'
                     If unclear: 'I didn't quite catch that — can you say it one more time?'",
  "explanation": "If incorrect, provide a 1-2 sentence gentle re-explanation of the concept 
                  using different words than the original hint. null if correct or unclear."
}}"""

    user_prompt = f"""The child said: "{child_answer}"

Evaluate this answer now."""

    return system_prompt, user_prompt


def get_topic_expansion_prompt(topic: str, child_age: int) -> str:
    """
    When the user provides just a topic string (no PDF content),
    use Gemini to first generate educational content about that topic,
    then feed it into the story generator.
    """

    system_prompt = f"""You are an educational content writer. Given a topic, write a clear, 
factual summary suitable for a {child_age}-year-old student. 

Include:
- 3-5 key facts or concepts the child should learn
- Important people, dates, or terms involved  
- Why this topic matters or how it connects to the child's life

Keep it under 500 words. Write in simple, clear prose — not bullet points.
This will be used as source material for an interactive audio story, 
so focus on the most engaging and important aspects."""

    user_prompt = f"Write educational content about: {topic}"

    return system_prompt, user_prompt
