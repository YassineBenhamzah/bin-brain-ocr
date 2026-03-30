const express = require('express');
const Tesseract = require('tesseract.js');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/process', async (req, res) => {
  const { filePath } = req.body;

  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'file_not_found', attempted_path: filePath });
  }

  try {
    let imageToProcess = filePath;
    let tempImage = null;
    const extension = path.extname(filePath).toLowerCase();

    // If PDF, use Poppler (Linux utility) to grab the first page
    if (extension === '.pdf') {
      console.log(`Converting PDF to image...`);
      // This creates a file at /tmp/pdf_page-1.png
      execSync(`pdftoppm -f 1 -l 1 -png "${filePath}" /tmp/pdf_page`);
      
      tempImage = '/tmp/pdf_page-1.png';
      imageToProcess = tempImage;
    }

    console.log(`Starting OCR...`);
    const { data: { text, confidence } } = await Tesseract.recognize(imageToProcess, 'eng');
    
    // Clean up the temporary PNG if we created one
    if (tempImage && fs.existsSync(tempImage)) {
      fs.unlinkSync(tempImage);
    }

    console.log(`OCR complete! Confidence: ${confidence}`);
    res.json({ text, confidence });

  } catch (err) {
    console.error('OCR failed:', err);
    res.status(500).json({ error: 'ocr_failed', details: err.message });
  }
});

app.listen(3000, () => console.log('OCR service running on port 3000'));
