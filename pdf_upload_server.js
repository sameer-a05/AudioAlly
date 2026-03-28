
// Express server with PDF upload endpoint using GridFS
const express = require('express');
const multer = require('multer');
const { MongoClient, GridFSBucket } = require('mongodb');
const fs = require('fs');
const path = require('path');

const uri = 'mongodb+srv://testuser:2b34fd51@cluster0.mzjaq7s.mongodb.net/';
const dbName = 'testdb';
const bucketName = 'uploadedpdfs';

const app = express();
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
      .on('finish', () => {
        fs.unlinkSync(req.file.path); // Remove temp file
        res.json({ message: 'PDF uploaded successfully', fileId: uploadStream.id });
        client.close();
      })
      .on('error', (err) => {
        fs.unlinkSync(req.file.path);
        res.status(500).json({ error: 'Error uploading PDF', details: err.message });
        client.close();
      });
  } catch (err) {
    res.status(500).json({ error: 'Server error', details: err.message });
    client.close();
  }
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
