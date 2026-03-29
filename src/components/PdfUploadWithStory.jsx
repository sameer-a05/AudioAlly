import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function PdfUploadWithStory() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null)
  const [fileId, setFileId] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const [showGenerate, setShowGenerate] = useState(false)
  const [story, setStory] = useState(null)

  const handleFileChange = (e) => {
    setFile(e.target.files[0])
    setFileId(null)
    setShowGenerate(false)
    setStory(null)
  }

  const handleUpload = async (e) => {
    e.preventDefault()
    if (!file) return
    setUploading(true)
    setError(null)
    setShowGenerate(false)
    setStory(null)
    try {
      const formData = new FormData()
      formData.append('pdf', file)
      const uploadApi = window.location.port === '5173' ? 'http://localhost:3000' : '';
      const res = await fetch(`${uploadApi}/api/upload-pdf`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (data.fileId) {
        setFileId(data.fileId)
        setShowGenerate(true)
      } else {
        setError(data.error || 'Upload failed')
      }
    } catch (err) {
      setError(err.message || 'Upload error')
    } finally {
      setUploading(false)
    }
  }

  const handleGenerateStory = async () => {
    setError(null)
    setStory(null)
    try {
      const storyApi = window.location.port === '5173' ? 'http://localhost:8000' : '';
      const res = await fetch(`${storyApi}/api/generate-story`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_id: fileId }),
      })
      const data = await res.json()
      if (data && data.title && data.segments) {
        // Navigate to /story and pass the story in state
        navigate('/story', { state: { story: data } })
      } else {
        setError(data.detail || 'Story generation failed')
      }
    } catch (err) {
      setError(err.message || 'Story generation error')
    }
  }

  return (
    <section className="rounded-2xl border border-violet-500/25 bg-slate-900/80 p-6 shadow-xl shadow-violet-950/40 backdrop-blur-sm mt-8">
      <h2 className="mb-2 text-xl font-semibold text-slate-100">Upload PDF & Generate Story</h2>
      <form onSubmit={handleUpload} className="flex flex-col gap-4">
        <input type="file" accept="application/pdf" onChange={handleFileChange} />
        <button type="submit" className="rounded bg-violet-600 px-4 py-2 text-white" disabled={uploading}>
          {uploading ? 'Uploading…' : 'Upload PDF'}
        </button>
      </form>
      {error && <div className="mt-2 text-red-400">{error}</div>}
      {showGenerate && (
        <button onClick={handleGenerateStory} className="mt-4 rounded bg-fuchsia-600 px-4 py-2 text-white">
          Generate Story
        </button>
      )}
      {/* Story display moved to /story route */}
    </section>
  )
}
