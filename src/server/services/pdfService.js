const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs').promises;

class PDFService {
  constructor() {
    this.browser = null;
  }

  /**
   * Initialize browser instance (reusable)
   */
  async initBrowser() {
    if (!this.browser) {
      console.log('🚀 Launching Puppeteer browser...');
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--disable-software-rasterizer',
          '--disable-extensions',
          '--disable-web-security',
          '--font-render-hinting=none'
        ],
        ignoreHTTPSErrors: true,
        dumpio: false
      });
      console.log('✅ Browser launched successfully');
    }
    return this.browser;
  }

  /**
   * Close browser instance
   */
  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Generate PDF from HTML content
   * @param {string} html - HTML content
   * @param {object} options - PDF options
   * @returns {Buffer} PDF buffer
   */
  async generatePDF(html, options = {}) {
    const browser = await this.initBrowser();
    const page = await browser.newPage();

    try {
      // Set viewport for consistent rendering
      await page.setViewport({
        width: 1024,
        height: 1400,
        deviceScaleFactor: 2
      });

      // Set content with proper encoding
      await page.setContent(html, {
        waitUntil: ['networkidle0', 'domcontentloaded'],
        timeout: 30000
      });

      // Wait for any images to load
      await page.evaluate(() => {
        return Promise.all(
          Array.from(document.images)
            .filter(img => !img.complete)
            .map(img => new Promise(resolve => {
              img.onload = img.onerror = resolve;
            }))
        );
      });

      // Generate PDF with enhanced compatibility options
      const pdfOptions = {
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true, // Let @page rule handle margins and size
        displayHeaderFooter: options.displayHeaderFooter || false,
        headerTemplate: options.headerTemplate || '<div></div>',
        footerTemplate: options.footerTemplate || '<div></div>',
        margin: options.margin, // This will be undefined for KFS, allowing CSS @page to control it
        tagged: true, // Generate tagged PDF for better accessibility and compatibility
        outline: false,
        ...options
      };
      
      const pdfBuffer = await page.pdf(pdfOptions);

      console.log('✅ PDF buffer generated, size:', pdfBuffer.length, 'bytes');

      // Validate PDF buffer
      if (!pdfBuffer || pdfBuffer.length === 0) {
        throw new Error('Generated PDF is empty');
      }

      // Check if it's a valid PDF (starts with %PDF)
      const pdfHeaderBytes = Array.from(pdfBuffer.slice(0, 5));
      const pdfHeader = String.fromCharCode(...pdfHeaderBytes);
      console.log('📝 PDF Header bytes:', pdfHeaderBytes);
      console.log('📝 PDF Header string:', pdfHeader);
      
      if (!pdfHeader.startsWith('%PDF')) {
        console.warn('⚠️ Warning: PDF header not standard');
      } else {
        console.log('✅ Valid PDF header confirmed');
      }

      await page.close();
      return pdfBuffer;

    } catch (error) {
      await page.close();
      throw new Error(`PDF generation failed: ${error.message}`);
    }
  }

  /**
   * Generate KFS PDF from React component HTML
   * @param {string} htmlContent - Full HTML content
   * @param {string} filename - Output filename
   * @returns {object} { buffer, filepath }
   */
  async generateKFSPDF(htmlContent, filename = 'KFS.pdf') {
    try {
      console.log('📄 Generating KFS PDF...');

      // Add necessary CSS for print
      const styledHTML = this.addPrintStyles(htmlContent);

      // Generate PDF with KFS-specific options with dynamic footer
      const pdfBuffer = await this.generatePDF(styledHTML, {
        displayHeaderFooter: true,
        headerTemplate: `<div></div>`, // Kept empty because @page margin handles top space
        footerTemplate: `
          <div style="box-sizing: border-box; width: 100%; font-size: 9px; padding: 5px 15mm; display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid #ccc;">
            <div style="text-align: left; line-height: 1.3;">
              <span style="font-weight: 500;">Page-<span class="pageNumber"></span> of <span class="totalPages"></span></span>
            </div>
            <div style="text-align: right; line-height: 1.3;">
              <div style="font-weight: 500;">Digital Signature</div>
              <div style="margin-top: 2px; font-size: 8px;">Pocket Credit Private Limited</div>
            </div>
          </div>
        `
      });

      // Optionally save to file
      const outputDir = path.join(__dirname, '../temp/pdfs');
      await fs.mkdir(outputDir, { recursive: true });
      
      const filepath = path.join(outputDir, filename);
      await fs.writeFile(filepath, pdfBuffer);

      console.log('✅ PDF generated successfully:', filepath);

      return {
        buffer: pdfBuffer,
        filepath: filepath,
        filename: filename
      };

    } catch (error) {
      console.error('❌ PDF generation error:', error);
      throw error;
    }
  }

  /**
   * Add print-specific styles to HTML
   * @param {string} html - Original HTML
   * @returns {string} HTML with print styles
   */
  addPrintStyles(html) {
    const printStyles = `
      <style>
        @page {
          size: A4 portrait;
          margin: 20mm 15mm 25mm 15mm; /* top right bottom left */
        }
        
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
          box-sizing: border-box;
        }
        
        html { }
        
        body {
          margin: 0;
          padding: 0;
          font-family: Arial, sans-serif;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        
        /* Tailwind-like utility classes */
        .text-center { text-align: center; }
        .text-left { text-align: left; }
        .text-right { text-align: right; }
        .text-xs { font-size: 0.65rem; line-height: 1rem; }
        .text-sm { font-size: 0.75rem; line-height: 1.25rem; }
        .text-xl { font-size: 1.15rem; line-height: 1.75rem; }
        .font-bold { font-weight: 700; }
        .mb-1 { margin-bottom: 0.2rem; }
        .mb-2 { margin-bottom: 0.4rem; }
        .mb-3 { margin-bottom: 0.6rem; }
        .mb-4 { margin-bottom: 0.8rem; }
        .mb-8 { margin-bottom: 1.5rem; }
        .mt-8 { margin-top: 1.5rem; }
        .ml-5 { margin-left: 1.25rem; }
        .p-2 { padding: 0.5rem; }
        .p-8 { padding: 2rem; }
        .w-full { width: 100%; }
        
        /* Border utilities */
        .border { border-width: 1px; }
        .border-black { border-color: #000; }
        .border-gray-400 { border-color: #9ca3af; }
        .border-collapse { border-collapse: collapse; }
        
        /* Background utilities */
        .bg-white { background-color: #fff; }
        .bg-gray-50 { background-color: #f9fafb; }
        .bg-gray-100 { background-color: #f3f4f6; }
        
        /* Flex utilities */
        .flex { display: flex; }
        .items-center { align-items: center; }
        .items-end { align-items: flex-end; }
        .justify-between { justify-content: space-between; }
        
        /* List utilities */
        .list-disc { list-style-type: disc; }
        
        /* Leading utilities */
        .leading-relaxed { line-height: 1.625; }
        
        .page-break-before {
          page-break-before: always !important;
          break-before: page !important;
        }
        
        .page-break-after {
          page-break-after: always !important;
          break-after: page !important;
        }
        
        .page-break-inside-avoid {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        
        /* Prevent orphan content */
        h1, h2, h3, h4, h5, h6 {
          page-break-after: avoid !important;
          break-after: avoid !important;
        }
        
        /* Allow content to flow naturally across pages */
        .kfs-document-content > div {
          page-break-inside: auto;
          padding-bottom: 8mm; /* breathing room above footer */
        }
        
        /* Reduce padding for PDF to prevent overflow */
        .p-8 {
          padding: 1.5rem !important;
        }
        
        table {
          page-break-inside: avoid;
          border-collapse: collapse !important;
          width: 100%;
          margin-bottom: 0.75rem;
        }
        
        table td, table th {
          border: 1px solid #000 !important;
          padding: 0.4rem;
          vertical-align: top;
        }
        
        /* Ensure inline border styles work */
        td.border-black, th.border-black {
          border-color: #000 !important;
        }
        
        /* Handle colSpan and rowSpan */
        td[colspan], th[colspan] {
          text-align: center;
        }
        
        hr {
          border: 0;
          border-top: 1px solid #9ca3af;
          margin: 1rem 0;
        }
        
        /* Hide non-printable elements */
        .no-print, .print\\:hidden {
          display: none !important;
        }
        
        /* Ensure proper spacing */
        .print\\:my-0 {
          margin-top: 0 !important;
          margin-bottom: 0 !important;
        }
        
        .print\\:shadow-none {
          box-shadow: none !important;
        }
        
        /* Max width container */
        .max-w-\\[210mm\\] {
          max-width: 210mm;
          width: 100%;
          margin-left: auto;
          margin-right: auto;
        }
        
        /* Ensure container doesn't add extra space */
        .my-8 {
          margin-top: 0 !important;
          margin-bottom: 0 !important;
        }
        
        .mx-auto {
          margin-left: auto;
          margin-right: auto;
        }
        
        /* Shadow */
        .shadow-lg {
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        }
      </style>
    `;

    // Wrap in complete HTML document if not already wrapped
    if (!html.includes('<!DOCTYPE html>') && !html.includes('<html')) {
      return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>KFS Document</title>
  ${printStyles}
</head>
<body>
  ${html}
</body>
</html>`;
    }

    // Insert styles before closing head tag or at the beginning
    if (html.includes('</head>')) {
      return html.replace('</head>', `${printStyles}</head>`);
    } else {
      return printStyles + html;
    }
  }

  /**
   * Clean up old PDF files
   * @param {number} maxAgeHours - Maximum age in hours
   */
  async cleanupOldPDFs(maxAgeHours = 24) {
    try {
      const outputDir = path.join(__dirname, '../temp/pdfs');
      const files = await fs.readdir(outputDir);
      const now = Date.now();
      const maxAge = maxAgeHours * 60 * 60 * 1000;

      for (const file of files) {
        const filepath = path.join(outputDir, file);
        const stats = await fs.stat(filepath);
        const age = now - stats.mtimeMs;

        if (age > maxAge) {
          await fs.unlink(filepath);
          console.log(`🗑️ Deleted old PDF: ${file}`);
        }
      }
    } catch (error) {
      console.error('Error cleaning up PDFs:', error);
    }
  }
}

// Export singleton instance
const pdfService = new PDFService();

// Cleanup on process exit
process.on('exit', async () => {
  await pdfService.closeBrowser();
});

module.exports = pdfService;

