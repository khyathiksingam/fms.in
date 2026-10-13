const fs = require('fs');
const path = require('path');
const { createWorker } = require('tesseract.js');
const pdfParse = require('pdf-parse');
const { dbHelper } = require('../config/db');

let worker = null;

async function getTesseractWorker() {
  if (!worker) {
    try {
      worker = await createWorker('eng');
    } catch (err) {
      console.warn('Failed to initialize Tesseract worker, falling back to on-demand:', err.message);
    }
  }
  return worker;
}

/**
 * Process a file for OCR / text indexing asynchronously
 * @param {number} fileId - The database ID of the file
 * @param {string} filePath - Absolute path to the stored file
 * @param {string} mimeType - MIME type of the file
 */
async function processFileOCR(fileId, filePath, mimeType) {
  try {
    if (!fs.existsSync(filePath)) {
      await dbHelper.run(
        "UPDATE files SET ocr_status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [fileId]
      );
      return;
    }

    await dbHelper.run(
      "UPDATE files SET ocr_status = 'processing', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [fileId]
    );

    let extractedText = '';
    const ext = path.extname(filePath).toLowerCase();

    // 1. Image OCR (PNG, JPG, JPEG, WEBP, BMP)
    if (mimeType.startsWith('image/') || ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tiff'].includes(ext)) {
      const ocrWorker = await getTesseractWorker();
      if (ocrWorker) {
        const ret = await ocrWorker.recognize(filePath);
        extractedText = ret.data.text || '';
      } else {
        // One-shot fallback
        const singleWorker = await createWorker('eng');
        const ret = await singleWorker.recognize(filePath);
        extractedText = ret.data.text || '';
        await singleWorker.terminate();
      }
    } 
    // 2. PDF Text Extraction
    else if (mimeType === 'application/pdf' || ext === '.pdf') {
      try {
        const dataBuffer = fs.readFileSync(filePath);
        const pdfData = await pdfParse(dataBuffer);
        extractedText = pdfData.text || '';
      } catch (pdfErr) {
        console.warn(`PDF parse error for file ${fileId}:`, pdfErr.message);
      }
    }
    // 3. Plain Text, CSV, JSON, Markdown, Code files
    else if (
      mimeType.startsWith('text/') || 
      ['.txt', '.csv', '.md', '.json', '.js', '.py', '.html', '.css', '.xml'].includes(ext)
    ) {
      try {
        extractedText = fs.readFileSync(filePath, 'utf8');
      } catch (readErr) {
        console.warn(`Text file read error for file ${fileId}:`, readErr.message);
      }
    } 
    // 4. Unsupported binary types (media, zip)
    else {
      await dbHelper.run(
        "UPDATE files SET ocr_status = 'unsupported', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [fileId]
      );
      return;
    }

    // Clean up extracted text: truncate excessive whitespace, limit if very huge
    const cleanedText = (extractedText || '')
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .trim();

    await dbHelper.run(
      "UPDATE files SET extracted_text = ?, ocr_status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [cleanedText, fileId]
    );

    console.log(`[OCR] File ${fileId} indexing completed. Extracted ${cleanedText.length} characters.`);
  } catch (error) {
    console.error(`[OCR] Error processing file ${fileId}:`, error);
    await dbHelper.run(
      "UPDATE files SET ocr_status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [fileId]
    );
  }
}

module.exports = {
  processFileOCR
};
