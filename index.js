const express = require('express');
const { createWorker, createScheduler } = require('tesseract.js');
const fs = require('fs');
const path = require('path');
const os = require('os');
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

  const extension = path.extname(filePath).toLowerCase();
  const uniqueId = `pdf_${Date.now()}`;
  let imagesToProcess = [filePath]; // Default to single image
  let isPdf = false;

  try {
    // 1. If PDF, extract ALL pages
    if (extension === '.pdf') {
      isPdf = true;
      console.log(`Extracting all pages from PDF: ${filePath}`);
      // Omitting -f and -l tells Poppler to extract EVERY page
      execSync(`pdftoppm -png "${filePath}" /tmp/${uniqueId}`);
      
      // Find all the generated PNGs in /tmp and sort them numerically
      const allFiles = fs.readdirSync('/tmp');
      imagesToProcess = allFiles
        .filter(file => file.startsWith(uniqueId) && file.endsWith('.png'))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
        .map(file => `/tmp/${file}`);
      
      console.log(`Found ${imagesToProcess.length} pages to process.`);
    }

    // 2. Setup the High-Speed Parallel Scheduler
    console.log(`Booting multi-threaded OCR engine...`);
    const scheduler = createScheduler();
    
    // Use up to 4 cores (or fewer if computer is slower) to prevent RAM overload
    const coreCount = Math.min(4, Math.max(1, os.cpus().length - 1));
    console.log(`Spinning up ${coreCount} parallel workers...`);
    
    for (let i = 0; i < coreCount; i++) {
      const worker = await createWorker('eng');
      scheduler.addWorker(worker);
    }

    // 3. Queue all pages simultaneously
    const start = Date.now();
    const results = await Promise.all(
      imagesToProcess.map(image => scheduler.addJob('recognize', image))
    );
    const timeTaken = ((Date.now() - start) / 1000).toFixed(1);

    // 4. Combine all text and calculate average confidence
    let fullText = '';
    let totalConfidence = 0;

    results.forEach(result => {
      fullText += result.data.text + '\n\n--- Page Break ---\n\n';
      totalConfidence += result.data.confidence;
    });

    const averageConfidence = Math.round(totalConfidence / results.length);
    
    // 5. Terminate the workers to free CPU/RAM
    await scheduler.terminate();

    // 6. Delete all temp PNG files
    if (isPdf) {
      imagesToProcess.forEach(tempImg => {
        if (fs.existsSync(tempImg)) fs.unlinkSync(tempImg);
      });
    }

    console.log(`Finished ${imagesToProcess.length} pages in ${timeTaken} seconds! Avg Confidence: ${averageConfidence}%`);
    res.json({ text: fullText.trim(), confidence: averageConfidence });

  } catch (err) {
    console.error('OCR failed:', err);
    res.status(500).json({ error: 'ocr_failed', details: err.message });
  }
});

app.listen(3000, () => console.log('Multi-threaded OCR service running on port 3000'));
