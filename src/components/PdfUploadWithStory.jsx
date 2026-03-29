import { useState } from 'react'
import { uploadPdf } from './api'
import { useNavigate } from 'react-router-dom'

export default function PdfUploadWithStory() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null)
  const [fileId, setFileId] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const [showGenerate, setShowGenerate] = useState(false)
  const [story, setStory] = useState(null)

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files[0]
    setFile(selectedFile)
    setFileId(null)
    setShowGenerate(false)
    setStory(null)
    if (selectedFile) {
      setUploading(true)
      setError(null)
      try {
        const data = await uploadPdf(selectedFile)
        const id = data.fileId || data.document_id || data._id
        if (id) {
          setFileId(id)
          // Immediately generate story after upload
          await handleGenerateStory(id)
        } else {
          setError(data.error || 'Upload failed')
        }
      } catch (err) {
        setError(err.message || 'Upload error')
      } finally {
        setUploading(false)
      }
    }
  }

  // Removed handleUpload; upload now happens in handleFileChange

  const handleGenerateStory = async (customFileId) => {
    setError(null)
    setStory(null)
    const docId = customFileId || fileId
    if (!docId) return
    try {
      const storyApi = window.location.port === '5173' ? 'http://localhost:8000' : '';
      const res = await fetch(`${storyApi}/api/generate-story`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_id: docId }),
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
      <div className="flex flex-col gap-4">
        <input type="file" accept="application/pdf" onChange={handleFileChange} disabled={uploading} />
      </div>
      {error && <div className="mt-2 text-red-400">{error}</div>}
      {/* Story display moved to /story route */}
    </section>
  )
}
