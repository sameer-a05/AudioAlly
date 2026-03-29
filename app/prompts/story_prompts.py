"""
Prompt templates for the Story Engine.
Separated into their own file so you can iterate on them fast.
"""


def get_story_generation_prompt(content, child_age, learning_needs, num_questions):
    needs_str = ", ".join(learning_needs) if learning_needs else "none specified"

    if child_age <= 7:
        complexity = "very simple words, short sentences, familiar comparisons"
    elif child_age <= 10:
        complexity = "clear and simple language, occasional new vocabulary with context clues"
    elif child_age <= 13:
        complexity = "moderate vocabulary, can handle abstract concepts if explained concretely"
    else:
        complexity = "age-appropriate vocabulary, can handle nuance and complexity"

    needs_instructions = ""
    if "adhd" in learning_needs:
        needs_instructions += "\n- ADHD: Keep segments SHORT (max 50 words). Use cliffhangers. Add action."
    if "dyslexia" in learning_needs:
        needs_instructions += "\n- DYSLEXIA: Use concrete, vivid language. Repeat key concepts differently."
    if "esl" in learning_needs:
        needs_instructions += "\n- ESL: Simpler vocabulary. Avoid idioms. Define new terms immediately."

    system_prompt = f"""You are StoryPath's Story Engine. Transform educational content into an interactive audio story.

TARGET: Age {child_age} | NEEDS: {needs_str} | COMPLEXITY: {complexity}
{needs_instructions}

RULES:
1. SAFETY: No violence, scary content, or inappropriate material for children.
2. SEGMENTS: Max 75 words each (ideally 40-60). ~20-30 seconds of audio.
3. QUESTIONS: Exactly {num_questions} question(s). Open-ended, generous keywords (10+), include fallback_choices (first = correct).
4. VOICES: 2-3 max. Always include "narrator". Characters should have distinct personalities.
5. STRUCTURE: intro → narration → questions → recap. Child feels like part of the adventure.
6. SEGMENT IDS: Sequential: seg_1, seg_2, q_1, seg_3_correct, seg_3_incorrect, etc.
7. OUTPUT: ONLY valid JSON. No markdown, no fences, no explanation.

JSON STRUCTURE:
{{
  "title": "string",
  "topic": "string",
  "target_age": {child_age},
  "learning_needs": {learning_needs},
  "estimated_duration_minutes": integer,
  "voices": {{
    "narrator": {{"character_name": "string", "description": "string", "gender": "male|female|neutral", "age": "child|teen|adult|elderly"}},
    "character_key": {{...}}
  }},
  "segments": [
    {{"id": "string", "type": "intro|narration|question|recap", "speaker": "string",
      "text": "string (narration/intro/recap)", "next": "string (next segment ID)",
      "question_text": "string (questions)", "correct_answer_keywords": ["string"],
      "acceptable_explanation": "string", "correct_next": "string", "incorrect_next": "string",
      "hint_text": "string", "fallback_choices": ["correct", "wrong1", "wrong2"]}}
  ],
  "first_segment_id": "string"
}}"""

    user_prompt = f"Transform this into an interactive audio story:\n---\n{content}\n---\nGenerate the complete story JSON now."
    return system_prompt, user_prompt


def get_answer_evaluation_prompt(question_text, acceptable_explanation, correct_keywords, child_answer, child_age, learning_needs):
    needs_str = ", ".join(learning_needs) if learning_needs else "none"

    system_prompt = f"""You are a kind teacher evaluating a {child_age}-year-old's answer. Needs: {needs_str}.

Be GENEROUS. Any understanding of the core concept = "correct".
Only "incorrect" if clearly wrong. "unclear" if garbled/too short.

Question: "{question_text}"
Correct answer demonstrates: {acceptable_explanation}
Keywords: {', '.join(correct_keywords)}

Return ONLY JSON:
{{"result": "correct|incorrect|unclear",
  "encouragement": "Short warm message. ALWAYS positive. Never say 'wrong'.",
  "explanation": "If incorrect, gentle re-explanation. null if correct/unclear."}}"""

    user_prompt = f'The child said: "{child_answer}"\n\nEvaluate now.'
    return system_prompt, user_prompt


def get_topic_expansion_prompt(topic, child_age):
    system_prompt = f"""Write a clear, factual summary of a topic for a {child_age}-year-old.
Include 3-5 key facts, important people/dates/terms, and why it matters.
Under 500 words. Simple prose, not bullet points."""

    user_prompt = f"Write educational content about: {topic}"
    return system_prompt, user_prompt