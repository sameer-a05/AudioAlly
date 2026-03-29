/**
 * PDF upload server — writes extracted text to MongoDB `documents` collection
 * so FastAPI `story_engine._fetch_document_content(document_id)` can read it.
 *
 * Env (same cluster/db naming as Python — see .env.example):
 *   MONGODB_URI   — required
 *   MONGODB_DB    — optional, default "audioally"
 */

const path = require('path')
// Same `.env` discovery as Python (`files/.env` or parent), regardless of cwd.
require('dotenv').config({ path: path.join(__dirname, '.env') })
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })
require('dotenv').config()
const express = require('express')
const multer = require('multer')
const { MongoClient } = require('mongodb')
const fs = require('fs')
const pdfParse = require('pdf-parse')

const uri = process.env.MONGODB_URI
// Must match Python `get_mongo_db()` / `MONGODB_DB` (default audioally).
const dbName = process.env.MONGODB_DB || 'audioally'

if (!uri) {
  console.error('FATAL: Set MONGODB_URI in .env (must match Python Story Engine).')
  process.exit(1)
}

const app = express()
const upload = multer({ dest: 'uploads/' })

app.get('/', (req, res) => {
  res.send(`
    <h2>Upload PDF to MongoDB</h2>
    <p>Text is extracted and stored in the <code>documents</code> collection for the Story Engine.</p>
    <form method="POST" action="/api/upload-pdf" enctype="multipart/form-data">
      <input type="file" name="pdf" accept="application/pdf" required />
      <button type="submit">Upload PDF</button>
    </form>
  `)
})

async function withMongo(handler) {
  const client = new MongoClient(uri)
  try {
    await client.connect()
    const db = client.db(dbName)
    return await handler(db, client)
  } finally {
    await client.close()
  }
}

/** List recent documents (same collection the Story Engine reads). */
app.get('/api/documents', async (req, res) => {
  try {
    const docs = await withMongo(async (db) => {
      const cur = db
        .collection('documents')
        .find({})
        .sort({ uploaded_at: -1 })
        .limit(20)
        .project({ extracted_text: 0 })
      return cur.toArray()
    })
    return res.json(
      docs.map((d) => ({
        document_id: d._id.toString(),
        filename: d.filename,
        text_length: d.text_length,
        text_preview: d.text_preview,
        uploaded_at: d.uploaded_at,
      }))
    )
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Server error', details: err.message })
  }
})

app.post('/api/upload-pdf', upload.single('pdf'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' })
  }

  const client = new MongoClient(uri)
  try {
    const buffer = fs.readFileSync(req.file.path)
    let extractedText = ''
    try {
      const data = await pdfParse(buffer)
      extractedText = (data.text || '').trim()
    } catch (parseErr) {
      fs.unlinkSync(req.file.path)
      return res.status(422).json({
        error: 'Could not extract text from PDF',
        details: parseErr.message,
      })
    }

    fs.unlinkSync(req.file.path)

    if (extractedText.length < 20) {
      return res.status(422).json({
        error: 'Not enough text in PDF',
        details:
          'The file may be scanned or image-only. The Story Engine needs at least ~20 characters of extractable text.',
      })
    }

    const filename = req.file.originalname || 'upload.pdf'
    const textPreview = extractedText.slice(0, 280)

    await client.connect()
    const db = client.db(dbName)
    const result = await db.collection('documents').insertOne({
      filename,
      extracted_text: extractedText,
      text_length: extractedText.length,
      text_preview: textPreview,
      uploaded_at: new Date(),
    })

    return res.json({
      document_id: result.insertedId.toString(),
      filename,
      text_length: extractedText.length,
      text_preview: textPreview,
    })
  } catch (err) {
    try {
      if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path)
    } catch { /* ignore */ }
    console.error(err)
    return res.status(500).json({ error: 'Server error', details: err.message })
  } finally {
    await client.close()
  }
})

app.listen(3000, () => {
  console.log(`PDF server on http://localhost:3000  (MongoDB db: ${dbName})`)
})
