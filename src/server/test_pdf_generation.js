const pdfService = require('./services/pdfService');
const fs = require('fs').promises;
const path = require('path');

async function testPDFGeneration() {
  try {
    console.log('🧪 Testing PDF generation...\n');

    // Simple HTML for testing
    const testHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { color: #333; }
          .box { border: 2px solid #667eea; padding: 20px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <h1>Test PDF Document</h1>
        <div class="box">
          <h2>This is a test</h2>
          <p>If you can read this, the PDF generation is working correctly!</p>
          <p>Date: ${new Date().toLocaleString()}</p>
        </div>
        <table border="1" style="width: 100%; border-collapse: collapse;">
          <tr>
            <th>Column 1</th>
            <th>Column 2</th>
            <th>Column 3</th>
          </tr>
          <tr>
            <td>Data 1</td>
            <td>Data 2</td>
            <td>Data 3</td>
          </tr>
        </table>
      </body>
      </html>
    `;

    console.log('📄 Generating test PDF...');
    const result = await pdfService.generateKFSPDF(testHTML, 'test_pdf.pdf');

    console.log('\n✅ PDF Generated Successfully!');
    console.log('📁 File saved at:', result.filepath);
    console.log('📊 File size:', result.buffer.length, 'bytes');
    console.log('📋 Filename:', result.filename);

    // Verify file exists
    const stats = await fs.stat(result.filepath);
    console.log('✅ File verified on disk, size:', stats.size, 'bytes');

    // Check PDF header
    const fileBuffer = await fs.readFile(result.filepath);
    const header = fileBuffer.slice(0, 5).toString();
    console.log('📝 PDF Header:', header);

    if (header.startsWith('%PDF')) {
      console.log('✅ Valid PDF format confirmed!');
    } else {
      console.log('❌ Invalid PDF format!');
    }

    console.log('\n🎉 Test completed successfully!');
    console.log('📂 You can open the test PDF at:', result.filepath);

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Close browser
    await pdfService.closeBrowser();
    process.exit(0);
  }
}

testPDFGeneration();


