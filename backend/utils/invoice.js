const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * Generates a PDF invoice for a transaction
 * @param {string} filePath Local path to save the PDF
 * @param {object} transaction Database transaction record
 * @param {object} user User record
 * @param {object} plan Plan record
 * @param {number} discountPercent The discount percent applied (0 if none)
 * @returns {Promise<string>} Path to the generated PDF
 */
function generateInvoicePDF(filePath, transaction, user, plan, discountPercent = 0) {
  return new Promise((resolve, reject) => {
    try {
      // Ensure directory exists
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const doc = new PDFDocument({ margin: 50 });
      const writeStream = fs.createWriteStream(filePath);
      doc.pipe(writeStream);

      // Header Banner
      doc.rect(0, 0, 612, 100).fill('#5B21B6'); // Violet primary color
      doc.fillColor('#FFFFFF')
         .fontSize(24)
         .font('Helvetica-Bold')
         .text('VEXEL AI', 50, 30);
      
      doc.fontSize(10)
         .font('Helvetica')
         .text('AI Advertisement Image Generator', 50, 60);

      doc.fillColor('#FFFFFF')
         .fontSize(14)
         .font('Helvetica-Bold')
         .text('INVOICE', 450, 40, { align: 'right' });

      // Invoice Details
      doc.fillColor('#1F2937').fontSize(10).font('Helvetica');
      let y = 130;
      doc.text(`Invoice ID: ${transaction.id}`, 50, y);
      doc.text(`Date: ${new Date(transaction.createdAt).toLocaleDateString()}`, 50, y + 15);
      doc.text(`Payment ID: ${transaction.referenceId || 'N/A'}`, 50, y + 30);

      // Bill To
      doc.font('Helvetica-Bold').text('Bill To:', 350, y);
      doc.font('Helvetica').text(`Email: ${user.email}`, 350, y + 15);
      doc.text(`User ID: ${user.id}`, 350, y + 30);

      // Table Header
      y = 200;
      doc.rect(50, y, 512, 20).fill('#F3F4F6');
      doc.fillColor('#374151').font('Helvetica-Bold');
      doc.text('Description', 60, y + 5);
      doc.text('Qty', 350, y + 5);
      doc.text('Rate', 420, y + 5);
      doc.text('Amount', 490, y + 5);

      // Table Row
      y = 225;
      doc.fillColor('#1F2937').font('Helvetica');
      doc.text(`${plan.name} (${plan.credits} Credits Package)`, 60, y);
      doc.text('1', 350, y);
      doc.text(`INR ${plan.price.toFixed(2)}`, 420, y);
      doc.text(`INR ${plan.price.toFixed(2)}`, 490, y);

      // Calculations
      y = 260;
      doc.moveTo(50, y).lineTo(562, y).strokeColor('#E5E7EB').stroke();
      
      y = 275;
      doc.text('Subtotal:', 380, y, { width: 100, align: 'right' });
      doc.text(`INR ${plan.price.toFixed(2)}`, 490, y);

      if (discountPercent > 0) {
        y += 15;
        doc.fillColor('#DC2626');
        doc.text(`Discount (${discountPercent}%):`, 380, y, { width: 100, align: 'right' });
        const discountAmount = plan.price * (discountPercent / 100);
        doc.text(`- INR ${discountAmount.toFixed(2)}`, 490, y);
        doc.fillColor('#1F2937');
      }

      y += 20;
      doc.moveTo(380, y).lineTo(562, y).strokeColor('#D1D5DB').stroke();

      y += 10;
      doc.font('Helvetica-Bold').fontSize(12);
      doc.text('Total:', 380, y, { width: 100, align: 'right' });
      doc.text(`INR ${transaction.amount.toFixed(2)}`, 490, y);

      // Terms
      y = 400;
      doc.font('Helvetica-Bold').fontSize(10).text('Terms & Conditions', 50, y);
      doc.font('Helvetica').fontSize(8).fillColor('#6B7280');
      doc.text('1. Credits added are non-refundable and hold no monetary cash value.', 50, y + 15);
      doc.text('2. Every AI image generation deducts credits from your balance as per plan rate.', 50, y + 25);
      doc.text('3. For support queries, contact us in the Help Center in the Vexel application.', 50, y + 35);

      // Footer
      doc.moveTo(50, 700).lineTo(562, 700).strokeColor('#E5E7EB').stroke();
      doc.text('Thank you for choosing Vexel AI!', 50, 715, { align: 'center' });

      doc.end();

      writeStream.on('finish', () => {
        resolve(filePath);
      });

      writeStream.on('error', (err) => {
        reject(err);
      });
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = {
  generateInvoicePDF
};
