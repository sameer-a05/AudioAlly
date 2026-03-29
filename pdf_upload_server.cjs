// Express server with PDF upload endpoint using GridFS
const express = require('express');
const multer = require('multer');
const { MongoClient, GridFSBucket } = require('mongodb');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const pdfParse = require('pdf-parse');

const uri = 'mongodb+srv://testuser:2b34fd51@cluster0.mzjaq7s.mongodb.net/';
const dbName = 'testdb';
const bucketName = 'uploadedpdfs';

const app = express();
app.use(cors({ origin: 'http://localhost:5173' }));
const upload = multer({ dest: 'uploads/' }); // Temporary storage for uploaded files

// Serve a simple HTML form for PDF upload at the root URL
app.get('/', (req, res) => {
  res.send(`
    <h2>Upload PDF to MongoDB (GridFS)</h2>
    <form method="POST" action="/api/upload-pdf" enctype="multipart/form-data">
      <input type="file" name="pdf" accept="application/pdf" required />
      <button type="submit">Upload PDF</button>
    </form>
  `);
});

app.post('/api/upload-pdf', upload.single('pdf'), async (req, res) => {
  if (!req.file) {
    console.error('[UPLOAD] No file uploaded');
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbName);
    const bucket = new GridFSBucket(db, { bucketName });
    const uploadStream = bucket.openUploadStream(req.file.originalname);
    const fileStream = fs.createReadStream(req.file.path);
    fileStream.pipe(uploadStream)
      .on('finish', async () => {
        console.log(`[UPLOAD] File uploaded to GridFS with id: ${uploadStream.id}`);
        try {
          // Extract text from PDF
          const dataBuffer = fs.readFileSync(req.file.path);
          console.log('[EXTRACT] Starting PDF text extraction...');
          const pdfData = await pdfParse(dataBuffer);
          const extractedText = pdfData.text;
          console.log(`[EXTRACT] Extracted text length: ${extractedText.length}`);
          // Save extracted text to a file in extracted_texts/{fileId}.txt
          const path = require('path');
          const outputDir = path.join(__dirname, 'extracted_texts');
          const outputPath = path.join(outputDir, `${uploadStream.id}.txt`);
          const fsPromises = require('fs').promises;
          console.log(`[EXTRACT] fileId: ${uploadStream.id}`);
          console.log(`[EXTRACT] Intended output path: ${outputPath}`);
          console.log(`[EXTRACT] Extracted text length: ${extractedText.length}`);
          try {
            await fsPromises.writeFile(outputPath, extractedText, 'utf8');
            console.log(`[EXTRACT] Successfully saved extracted text to ${outputPath}`);
          } catch (fileErr) {
            console.error('[EXTRACT] Failed to save extracted text to file:', fileErr);
          }
        } catch (extractErr) {
          // Extraction failed, but PDF is uploaded
          console.error('[EXTRACT] PDF text extraction failed:', extractErr);
        }
        fs.unlinkSync(req.file.path); // Remove temp file
        res.json({ message: 'PDF uploaded and text extracted', fileId: uploadStream.id });
        client.close();
      })
      .on('error', (err) => {
        fs.unlinkSync(req.file.path);
        console.error('[UPLOAD] Error uploading PDF:', err);
        res.status(500).json({ error: 'Error uploading PDF', details: err.message });
        client.close();
      });
  } catch (err) {
    console.error('[SERVER] Server error:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
    client.close();
  }
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});