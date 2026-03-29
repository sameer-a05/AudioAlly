/**
 * AudioAlly Audio Engine
 * =======================
 * Handles ElevenLabs TTS, audio playback, mic recording, and
 * GRAPH-BASED story traversal (follows next/correct_next/incorrect_next).
 *
 * Schema alignment:
 *   Python `speaker` field → JS reads `segment.speaker` (fallback: `segment.voice`)
 *   Python `question_text` → JS reads `segment.question_text` (fallback: `segment.text`)
 */

/**
 * ElevenLabs voice catalog (user-selectable + legacy story keys).
 * IDs are ElevenLabs voice_id strings.
 */
export const VOICES = {
  femaleNarrator: 'jv41DhCf464zw0TI7I1w',
  maleNarrator: 'jfIS2w2yJi0grJZPyEsk',
  sheriffBilly: 'KTPVrSVAEUSJRClDzBw7',
  stadiumStan: 'gU0LNdkMOQCOrPrwtbee',
  commanderConner: 'YOq2y2Up4RgXP2HyXjE5',
  studioStacey: 'jqcCZkN6Knx8BJ5TBdYR',
}

/** UI list: selectable voices with display labels */
export const VOICE_OPTIONS = [
  { key: 'femaleNarrator', label: 'Female Narrator' },
  { key: 'maleNarrator', label: 'Male Narrator' },
  { key: 'sheriffBilly', label: 'Sheriff Billy' },
  { key: 'stadiumStan', label: 'Stadium Stan' },
  { key: 'commanderConner', label: 'Commander Conner' },
  { key: 'studioStacey', label: 'Studio Stacey' },
]

function ttsBaseUrl() {
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) return '/elevenlabs-api'
  return 'https://api.elevenlabs.io'
}

function cacheKey(voiceId, text) {
  return `${voiceId}::${text}`
}

/** True if browser supports Web Speech API recognition */
export function isSpeechRecognitionSupported() {
  if (typeof window === 'undefined') return false
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition)
}

export default class AudioEngine {
  constructor(elevenLabsApiKey) {
    this.apiKey = elevenLabsApiKey
    this.currentAudio = null
    this.mediaRecorder = null
    this._mediaStream = null
    this._recordedChunks = []
    this._recognition = null
    this._speechLines = []
    this._volumeRaf = null
    this._audioContext = null
    this._analyser = null
    this._listeningActive = false
    this._recordingOptions = null
    this.audioCache = new Map()
    this.isPlaying = false
    this.isPaused = false
    this._stopRequested = false

    // Dynamic voice map: speaker_key → ElevenLabs voice ID
    // Built from GeneratedStory.voices when playStory is called
    this._voiceMap = {}
    /** When set, `speakerKey === 'narrator'` uses this catalog key (see resolveVoiceId) */
    this._preferredVoiceKey = 'femaleNarrator'
  }

  /** Apply user-selected voice for generic `narrator` segments */
  setPreferredVoiceKey(catalogKey) {
    if (catalogKey && VOICES[catalogKey]) {
      this._preferredVoiceKey = catalogKey
    }
  }

  /**
   * Build the voice map from a GeneratedStory's voices object.
   * Maps each speaker key to the best matching ElevenLabs voice ID
   * based on the VoiceConfig's gender + age fields.
   */
  buildVoiceMap(voices) {
    const map = {};
    for (const [key, config] of Object.entries(voices)) {
      const desc = config.description.toLowerCase();
      const name = config.character_name.toLowerCase();
      
      // 1. Try specific character name matches
      if (name.includes('ben franklin') || desc.includes('grandfatherly')) {
        map[key] = VOICES.maleNarrator
      } else if (desc.includes('excited') || desc.includes('coach')) {
        map[key] = VOICES.stadiumStan
      } else if (config.gender === 'female' && config.age === 'adult') {
        map[key] = VOICES.femaleNarrator
      } else {
        map[key] = this.getArchetypeVoice(config.gender, config.age)
      }
    }
    return map;
  }

  /**
   * Map gender/age from API to a concrete voice ID string.
   */
  getArchetypeVoice(gender, age) {
    const g = (gender || '').toLowerCase()
    const a = (age || '').toLowerCase()
    if (a === 'child' || a === 'kid' || a === 'young') {
      return g === 'female' ? VOICES.femaleNarrator : VOICES.maleNarrator
    }
    if (g === 'female') return VOICES.femaleNarrator
    return VOICES.maleNarrator
  }

  /**
   * Resolve a speaker key to an ElevenLabs voice ID.
   * Priority: dynamic map → VOICES catalog → preferred narrator → default
   */
  resolveVoiceId(speakerKey) {
    if (this._voiceMap[speakerKey]) return this._voiceMap[speakerKey]
    if (typeof speakerKey === 'string' && speakerKey.length > 20) return speakerKey
    if (speakerKey === 'narrator') {
      const pref = this._preferredVoiceKey
      if (pref && VOICES[pref]) return VOICES[pref]
      return VOICES.femaleNarrator
    }
    if (speakerKey && VOICES[speakerKey]) return VOICES[speakerKey]
    return VOICES.femaleNarrator
  }

  // ─── TTS ────────────────────────────────────────────────────────────

  async generateSpeech(text, speakerKey = 'narrator') {
    const trimmed = (text || '').trim()
    if (!trimmed) throw new Error('generateSpeech: empty text')
    if (!this.apiKey) throw new Error('Missing ElevenLabs API key')

    const voiceId = this.resolveVoiceId(speakerKey)
    const key = cacheKey(voiceId, trimmed)
    if (this.audioCache.has(key)) return this.audioCache.get(key)

    const url = `${ttsBaseUrl()}/v1/text-to-speech/${voiceId}/stream`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
        'xi-api-key': this.apiKey,
      },
      body: JSON.stringify({
        text: trimmed,
        model_id: 'eleven_turbo_v2_5',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`TTS ${res.status}: ${err}`)
    }

    const blob = await res.blob()
    const objectUrl = URL.createObjectURL(blob)
    this.audioCache.set(key, objectUrl)
    return objectUrl
  }

  // ─── Playback ─────────────────────────────────────────────────────

  async playAudio(audioUrl) {
    if (!audioUrl) throw new Error('playAudio: missing url')
    if (this.currentAudio) {
      this.currentAudio.pause()
      this.currentAudio.src = ''
      this.currentAudio = null
    }
    const audio = new Audio(audioUrl)
    this.currentAudio = audio
    this.isPaused = false
    this.isPlaying = true

    await new Promise((resolve, reject) => {
      audio.addEventListener('ended', () => { this.isPlaying = false; resolve() }, { once: true })
      audio.addEventListener('error', () => { this.isPlaying = false; reject(new Error('Playback error')) }, { once: true })
      audio.play().catch(reject)
    })
  }

  pauseAudio() {
    if (!this.currentAudio) return
    this.currentAudio.pause()
    this.isPaused = true
    this.isPlaying = false
  }

  async resumeAudio() {
    if (!this.currentAudio) return
    this.isPaused = false
    this.isPlaying = true
    await this.currentAudio.play()
  }

  stopStory() {
    this._stopRequested = true
    this.pauseAudio()
  }

  // ─── Story Playback (Graph Traversal) ─────────────────────────────

  /**
   * Extract the spoken text from a segment.
   * Handles the Python schema: narration uses `text`, questions use `question_text`.
   */
  _segmentText(segment) {
    if (!segment) return ''
    if (segment.type === 'question') {
      return (segment.question_text || segment.text || '').trim()
    }
    return (segment.text || '').trim()
  }

  /**
   * Get the speaker key. Python uses `speaker`, old JS used `voice`.
   */
  _segmentSpeaker(segment) {
    return segment.speaker || segment.voice || 'narrator'
  }

  /**
   * Pre-cache a segment's audio in the background.
   */
  async preCacheSegment(segment) {
    const text = this._segmentText(segment)
    if (!text) return
    try {
      await this.generateSpeech(text, this._segmentSpeaker(segment))
    } catch {
      void 0
    }
  }

  /**
   * Play a full story by traversing the segment graph.
   *
   * @param {object} storyJson - GeneratedStory from the Python API
   * @param {object} callbacks
   * @param {function} callbacks.onSegmentStart - (segment) called when segment begins
   * @param {function} callbacks.onQuestion - (segment) => Promise<'correct'|'incorrect'|'unclear'>
   *   Must return the evaluation result so we know which branch to take.
   * @param {function} callbacks.onStoryEnd - () called when story finishes
   */
  async playStory(storyJson, callbacks = {}) {
    const { onSegmentStart, onQuestion, onStoryEnd } = callbacks

    // Build segment lookup
    const segments = storyJson.segments || []
    const segmentMap = new Map()
    for (const seg of segments) {
      segmentMap.set(seg.id, seg)
    }

    // Build voice map from story's voice configs
    this._voiceMap = this.buildVoiceMap(storyJson.voices || {})

    // Start from first_segment_id (Python schema) or first element
    let currentId = storyJson.first_segment_id || segments[0]?.id
    this._stopRequested = false

    while (currentId && !this._stopRequested) {
      const segment = segmentMap.get(currentId)
      if (!segment) {
        console.warn(`Segment '${currentId}' not found. Ending story`)
        break
      }

      const text = this._segmentText(segment)
      if (!text) {
        // Skip empty segments, follow next
        currentId = segment.next || null
        continue
      }

      // Notify UI
      onSegmentStart?.(segment)

      // Pre-cache the next likely segments while this one plays
      const nextIds = [segment.next, segment.correct_next, segment.incorrect_next].filter(Boolean)
      for (const nid of nextIds) {
        const nextSeg = segmentMap.get(nid)
        if (nextSeg) this.preCacheSegment(nextSeg)
      }

      // Generate + play this segment's audio
      const audioUrl = await this.generateSpeech(text, this._segmentSpeaker(segment))
      await this.playAudio(audioUrl)

      if (this._stopRequested) break

      // Determine next segment
      if (segment.type === 'question') {
        // Pause for the question. Let the UI handle mic/evaluation
        if (onQuestion) {
          const result = await onQuestion(segment)
          // result should be 'correct', 'incorrect', or 'unclear'
          if (this._stopRequested) break
          if (result === 'correct') {
            currentId = segment.correct_next || segment.next || null
          } else {
            // Both incorrect and unclear go to the incorrect/hint branch
            currentId = segment.incorrect_next || segment.next || null
          }
        } else {
          // No question handler. Just follow correct_next as default
          currentId = segment.correct_next || segment.next || null
        }
      } else {
        // Narration/intro/recap. Follow `next`
        currentId = segment.next || null
      }
    }

    onStoryEnd?.()
  }

  // ─── Microphone Recording ─────────────────────────────────────────

  async startRecording(options = {}) {
    if (this.mediaRecorder?.state === 'recording') return

    this._recordedChunks = []
    this._speechLines = []
    this._listeningActive = true
    this._recordingOptions = options

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    this._mediaStream = stream

    if (typeof options.onVolumeLevel === 'function') {
      this._startVolumeMeter(stream, options.onVolumeLevel)
    }

    const mime = MediaRecorder.isTypeSupported?.('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported?.('audio/webm')
        ? 'audio/webm'
        : undefined

    this.mediaRecorder = mime
      ? new MediaRecorder(stream, { mimeType: mime })
      : new MediaRecorder(stream)

    this.mediaRecorder.ondataavailable = (ev) => {
      if (ev.data?.size) this._recordedChunks.push(ev.data)
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SR) {
      this._recognition = new SR()
      this._recognition.lang = (navigator.language || 'en-US').replace('_', '-')
      this._recognition.continuous = true
      this._recognition.interimResults = true
      this._recognition.maxAlternatives = 1

      this._recognition.onresult = (event) => {
        let interim = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i]
          const piece = res[0]?.transcript ?? ''
          if (res.isFinal) {
            const line = piece.trim()
            if (line) this._speechLines.push(line)
            options.onSpeechActivity?.()
          } else {
            interim += piece
          }
        }
        if (interim.trim()) options.onSpeechActivity?.()
        if (typeof options.onPartialTranscript === 'function') {
          const finals = this._speechLines.join(' ')
          const combined = [finals, interim.trim()].filter(Boolean).join(' ')
          options.onPartialTranscript(combined)
        }
      }

      this._recognition.onerror = (ev) => {
        console.log('❌ SpeechRecognition error:', ev?.error)
        options.onRecognitionError?.(ev)
      }

      this._recognition.onend = () => {
        if (!this._listeningActive || this.mediaRecorder?.state !== 'recording') return
        try {
          this._recognition.start()
        } catch {
          void 0
        }
      }

      try {
        this._recognition.start()
      } catch {
        this._recognition = null
      }
    }

    this.mediaRecorder.start(200)
  }

  _startVolumeMeter(stream, callback) {
    this._stopVolumeMeter()
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext
      this._audioContext = new Ctx()
      const source = this._audioContext.createMediaStreamSource(stream)
      this._analyser = this._audioContext.createAnalyser()
      this._analyser.fftSize = 256
      this._analyser.smoothingTimeConstant = 0.65
      source.connect(this._analyser)
      const data = new Uint8Array(this._analyser.frequencyBinCount)
      const tick = () => {
        if (!this._analyser) return
        this._analyser.getByteFrequencyData(data)
        let sum = 0
        for (let i = 0; i < data.length; i++) sum += data[i]
        const norm = sum / data.length / 255
        const level = Math.min(100, Math.round(norm * 140 + 5))
        callback(level)
        this._volumeRaf = requestAnimationFrame(tick)
      }
      this._volumeRaf = requestAnimationFrame(tick)
    } catch {
      void 0
    }
  }

  _stopVolumeMeter() {
    if (this._volumeRaf != null) {
      cancelAnimationFrame(this._volumeRaf)
      this._volumeRaf = null
    }
    if (this._audioContext) {
      try {
        this._audioContext.close()
      } catch {
        void 0
      }
      this._audioContext = null
    }
    this._analyser = null
  }

  async stopRecordingAndTranscribe() {
    this._listeningActive = false
    this._stopVolumeMeter()

    if (this._recognition) {
      this._recognition.onend = null
      try {
        this._recognition.stop()
      } catch {
        void 0
      }
      this._recognition = null
    }
    this._recordingOptions = null

    const transcript = this._speechLines.join(' ').trim()

    if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
      this._stopTracks()
      return { transcript, audioBlob: null }
    }

    await new Promise((resolve) => {
      this.mediaRecorder.onstop = resolve
      this.mediaRecorder.stop()
    })

    const blobType = this._recordedChunks[0]?.type || this.mediaRecorder.mimeType || 'audio/webm'
    const audioBlob = this._recordedChunks.length > 0
      ? new Blob(this._recordedChunks, { type: blobType })
      : null

    this.mediaRecorder = null
    this._recordedChunks = []
    this._stopTracks()

    return { transcript, audioBlob }
  }

  _stopTracks() {
    this._mediaStream?.getTracks().forEach((t) => {
      try {
        t.stop()
      } catch {
        void 0
      }
    })
    this._mediaStream = null
  }

  // ─── Cleanup ──────────────────────────────────────────────────────

  cleanup() {
    try {
      this._listeningActive = false
      this._stopRequested = true
      this._stopVolumeMeter()
      if (this.currentAudio) { this.currentAudio.pause(); this.currentAudio.src = ''; this.currentAudio = null }
      if (this.mediaRecorder?.state !== 'inactive') {
        try {
          this.mediaRecorder.stop()
        } catch {
          void 0
        }
      }
      this.mediaRecorder = null
      if (this._recognition) {
        this._recognition.onend = null
        try {
          this._recognition.stop()
        } catch {
          void 0
        }
        this._recognition = null
      }
      this._stopTracks()
      for (const u of this.audioCache.values()) {
        try {
          URL.revokeObjectURL(u)
        } catch {
          void 0
        }
      }
      this.audioCache.clear()
      this.isPlaying = false
      this.isPaused = false
    } catch {
      void 0
    }
  }
}