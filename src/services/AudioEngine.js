/** Default ElevenLabs voice */
const DEFAULT_VOICE_ID = 'wWWn96OtTHu1sn8SRGEr'

export const VOICES = {
  narrator: DEFAULT_VOICE_ID,
  ben_franklin: DEFAULT_VOICE_ID,
  child: DEFAULT_VOICE_ID,
  ally: DEFAULT_VOICE_ID,
}

function ttsBaseUrl() {
  if (import.meta.env.DEV) return '/elevenlabs-api'
  return 'https://api.elevenlabs.io'
}

function cacheKey(voiceId, text) {
  return `${voiceId}::${text}`
}

export default class AudioEngine {
  constructor(elevenLabsApiKey) {
    this.apiKey = elevenLabsApiKey
    this.currentAudio = null
    this.mediaRecorder = null
    this._mediaStream = null
    this._recordedChunks = []
    /** @type {any} */
    this._recognition = null
    this._speechLines = []
    /** @type {number | null} */
    this._volumeRaf = null
    this._audioContext = null
    /** @type {AnalyserNode | null} */
    this._analyser = null
    /** While true, restart speech recognition after onend for longer utterances */
    this._listeningActive = false
    /** @type {object | null} */
    this._recordingOptions = null
    this.audioCache = new Map()
    this.isPlaying = false
    this.isPaused = false
  }

  resolveVoiceId(voiceKey) {
    if (VOICES[voiceKey]) return VOICES[voiceKey]
    if (typeof voiceKey === 'string' && voiceKey.length > 20) return voiceKey
    return DEFAULT_VOICE_ID
  }

  async generateSpeech(text, voiceKey = 'narrator') {
    const trimmed = (text || '').trim()
    if (!trimmed) throw new Error('generateSpeech: empty text')
    if (!this.apiKey) throw new Error('Missing ElevenLabs API key')

    const voiceId = this.resolveVoiceId(voiceKey)
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
      audio.addEventListener('ended', () => {
        this.isPlaying = false
        resolve()
      }, { once: true })
      audio.addEventListener('error', () => {
        this.isPlaying = false
        reject(new Error('Audio playback error'))
      }, { once: true })
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

  /**
   * @param {object} [options]
   * @param {(ev: { error: string }) => void} [options.onRecognitionError]
   * @param {() => void} [options.onSpeechActivity]
   * @param {(text: string) => void} [options.onPartialTranscript]
   * @param {(level0to100: number) => void} [options.onVolumeLevel]
   */
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
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
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
        if (interim.trim()) {
          options.onSpeechActivity?.()
        }
        if (typeof options.onPartialTranscript === 'function') {
          const finals = this._speechLines.join(' ')
          const combined = [finals, interim.trim()].filter(Boolean).join(' ')
          options.onPartialTranscript(combined)
        }
      }

      this._recognition.onerror = (ev) => {
        options.onRecognitionError?.(ev)
      }

      /** Keeps listening across pauses so full sentences can finish */
      this._recognition.onend = () => {
        if (!this._listeningActive || this.mediaRecorder?.state !== 'recording') return
        try {
          this._recognition.start()
        } catch {
          /* ignore */
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
        for (let i = 0; i < data.length; i += 1) {
          sum += data[i]
        }
        const norm = sum / data.length / 255
        const level = Math.min(100, Math.round(norm * 140 + 5))
        callback(level)
        this._volumeRaf = requestAnimationFrame(tick)
      }
      this._volumeRaf = requestAnimationFrame(tick)
    } catch {
      /* ignore */
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
        /* ignore */
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
        /* ignore */
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
    const audioBlob =
      this._recordedChunks.length > 0 ? new Blob(this._recordedChunks, { type: blobType }) : null

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
        /* ignore */
      }
    })
    this._mediaStream = null
  }

  _segmentText(segment) {
    if (!segment) return ''
    if (segment.type === 'question') {
      return (segment.question_text || segment.text || '').trim()
    }
    return (segment.text || segment.narration || '').trim()
  }

  _segmentVoice(segment) {
    return segment.voice || segment.speaker || 'narrator'
  }

  async preCacheSegment(segment) {
    const text = this._segmentText(segment)
    if (!text) return ''
    return this.generateSpeech(text, this._segmentVoice(segment))
  }

  async playStory(storyJson, onQuestionDetected) {
    const segments = Array.isArray(storyJson?.segments)
      ? storyJson.segments
      : Array.isArray(storyJson)
        ? storyJson
        : null

    if (!segments?.length) throw new Error('playStory: no segments')

    for (let i = 0; i < segments.length; i += 1) {
      const segment = segments[i]
      const next = segments[i + 1]
      const text = this._segmentText(segment)
      if (!text) continue

      if (next) {
        this.preCacheSegment(next).catch(() => {})
      }

      const url = await this.generateSpeech(text, this._segmentVoice(segment))
      const isQuestion = segment.type === 'question'

      if (isQuestion) {
        await this.playAudio(url)
        if (typeof onQuestionDetected === 'function') {
          await onQuestionDetected(segment)
        }
        continue
      }

      await this.playAudio(url)
    }
  }

  cleanup() {
    try {
      this._listeningActive = false
      this._stopVolumeMeter()
      if (this.currentAudio) {
        this.currentAudio.pause()
        this.currentAudio.src = ''
        this.currentAudio = null
      }
      if (this.mediaRecorder?.state !== 'inactive') {
        try {
          this.mediaRecorder.stop()
        } catch {
          /* ignore */
        }
      }
      this.mediaRecorder = null
      if (this._recognition) {
        this._recognition.onend = null
        try {
          this._recognition.stop()
        } catch {
          /* ignore */
        }
        this._recognition = null
      }
      this._stopTracks()
      for (const u of this.audioCache.values()) {
        try {
          URL.revokeObjectURL(u)
        } catch {
          /* ignore */
        }
      }
      this.audioCache.clear()
      this.isPlaying = false
      this.isPaused = false
    } catch {
      /* ignore */
    }
  }
}
