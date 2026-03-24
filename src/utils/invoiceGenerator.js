const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const createInvoice = (order, outputPath) => {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const stream = fs.createWriteStream(outputPath);

        stream.on('finish', () => resolve(outputPath));
        stream.on('error', reject);
        doc.on('error', reject);

        doc.pipe(stream);

        generateHeader(doc);
        generateCustomerInformation(doc, order);
        generateInvoiceTable(doc, order);
        generateFooter(doc);

        doc.end();
    });
};

function generateHeader(doc) {
    // Header Background
    doc.rect(0, 0, doc.page.width, 140).fill('#FAFAFA');

    // Accent line at bottom of header
    doc.rect(0, 140, doc.page.width, 3).fill('#DBAB72');

    // Brand Colors
    const primaryColor = '#4E342E';
    const accentColor = '#DBAB72';

    // Logo Icon Background
    const logoPath = path.join(__dirname, '../../public/logo.png');
    if (fs.existsSync(logoPath)) {
        // Use fit instead of width so it scales correctly whether horizontal or vertical
        doc.image(logoPath, 50, 30, { fit: [150, 120] });
    } else {
        doc.circle(90, 70, 35).fill(primaryColor);
        doc.font('Helvetica-Bold')
            .fillColor(accentColor)
            .fontSize(28)
            .text('SE', 55, 56, { width: 70, align: 'center' });
    }

    // Company Address
    doc
        .font('Helvetica-Bold')
        .fillColor(primaryColor)
        .fontSize(11)
        .text('SnowEra Cafe HQ', 200, 45, { align: 'right' })
        .font('Helvetica')
        .fillColor('#555555')
        .fontSize(10)
        .text('Industrial Area, Phase 1', 200, 62, { align: 'right' })
        .text('Chandigarh, India, 160002', 200, 76, { align: 'right' })
        .font('Helvetica-Bold')
        .fillColor(accentColor)
        .text('hello@snoweracafe.com', 200, 90, { align: 'right' })
        .moveDown();
}

function generateCustomerInformation(doc, order) {
    const shippingAddress = order.shippingAddress || {};
    const primaryColor = '#4E342E';
    const bgColor = '#F5F5F0';

    doc.fillColor(primaryColor).fontSize(22).font('Helvetica-Bold').text('INVOICE', 50, 175);

    // Information Boxes
    doc.roundedRect(50, 215, 230, 110, 8).fill(bgColor);
    doc.roundedRect(315, 215, 230, 110, 8).fill(bgColor);

    // Inside invoice box
    doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(9).text('INVOICE DETAILS', 65, 230);
    doc.rect(65, 242, 200, 1).fill('white');

    doc.fillColor(primaryColor).font('Helvetica-Bold').text('Invoice #:', 65, 250);
    doc.font('Helvetica').text(order._id ? order._id.toString().substring(0, 12).toUpperCase() : 'N/A', 135, 250);

    doc.font('Helvetica-Bold').text('Date:', 65, 265);
    doc.font('Helvetica').text(new Date(order.createdAt || Date.now()).toLocaleDateString(), 135, 265);

    doc.font('Helvetica-Bold').text('Payment:', 65, 280);
    let paymentStr = order.paymentMethod || 'COD';
    if (order.paymentStatus === 'paid') paymentStr += ' (Paid)';
    doc.font('Helvetica').text(paymentStr, 135, 280);

    doc.font('Helvetica-Bold').text('Total Due:', 65, 300);
    doc.font('Helvetica-Bold').fillColor('#DBAB72').fontSize(11).text(formatCurrency(order.totalAmount || 0), 135, 299);

    // Inside customer box
    doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(9).text('BILLED TO', 330, 230);
    doc.rect(330, 242, 200, 1).fill('white');

    doc.fillColor(primaryColor).font('Helvetica-Bold').text(shippingAddress.name || order.user?.name || 'Customer', 330, 250);
    doc.font('Helvetica').text(shippingAddress.street || '-', 330, 265);
    doc.text(
        `${shippingAddress.city || '-'}, ${shippingAddress.state || '-'}, ${shippingAddress.zipCode || '-'}`,
        330,
        278
    );
    doc.text(shippingAddress.country || '', 330, 291);
}

function generateInvoiceTable(doc, order) {
    let position = 360;
    const primaryColor = '#4E342E';
    const accentColor = '#DBAB72';
    const bgColor = '#F5F5F0';

    // Table Header Background
    doc.roundedRect(50, position, 495, 30, 5).fill(primaryColor);

    doc.font('Helvetica-Bold').fontSize(10).fillColor('#FFFFFF');
    generateTableRow(
        doc,
        position + 10,
        'Item Description',
        'Unit Price',
        'Qty',
        'Total'
    );

    position += 40;
    doc.font('Helvetica').fontSize(10);

    const items = order.items || [];

    for (let i = 0; i < items.length; i++) {
        const item = items[i];

        // Alternating row background
        if (i % 2 === 0) {
            doc.rect(50, position - 8, 495, 38).fill('#FAFAFA');
        }

        doc.fillColor('#333333');

        // truncate item name so it doesn't wrap and break layout
        let itemName = item.product?.name ? item.product.name : 'Product';
        if (itemName.length > 35) itemName = itemName.substring(0, 35) + '...';

        const productId = item.product?._id ? item.product._id.toString().substring(0, 8).toUpperCase() : 'N/A';
        const itemDescription = `${itemName}`;

        generateTableRow(
            doc,
            position,
            itemDescription,
            formatCurrency(item.price || 0),
            item.quantity || 1,
            formatCurrency((item.price || 0) * (item.quantity || 1))
        );

        position += 38;
    }

    // Total Section
    position += 20;
    doc.roundedRect(300, position, 245, 50, 5).fill(bgColor);

    doc.font('Helvetica-Bold').fontSize(14).fillColor(primaryColor);
    doc.text('TOTAL AMOUNT:', 320, position + 18);

    doc.font('Helvetica-Bold').fontSize(16).fillColor(accentColor);
    doc.text(formatCurrency(order.totalAmount || 0), 410, position + 17, { width: 115, align: 'right' });
}

function generateFooter(doc) {
    const bottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    doc.rect(0, doc.page.height - 80, doc.page.width, 80).fill('#FAFAFA');
    doc.rect(0, doc.page.height - 80, doc.page.width, 1).fill('#EEEEEE');

    // Accent line at the bottommost edge
    doc.rect(0, doc.page.height - 5, doc.page.width, 5).fill('#DBAB72');

    doc
        .font('Helvetica-Bold')
        .fillColor('#4E342E')
        .fontSize(10)
        .text('Thank you for choosing SnowEra Cafe!', 0, doc.page.height - 55, { align: 'center', width: doc.page.width })
        .font('Helvetica')
        .fillColor('#777777')
        .fontSize(9)
        .text('For questions concerning this invoice, please contact hello@snoweracafe.com', 0, doc.page.height - 35, { align: 'center', width: doc.page.width });

    doc.page.margins.bottom = bottomMargin;
}

function generateTableRow(
    doc,
    y,
    item,
    unitCost,
    quantity,
    lineTotal
) {
    doc
        .text(item, 65, y, { width: 220 })
        .text(unitCost, 290, y, { width: 80, align: 'right' })
        .text(quantity, 380, y, { width: 50, align: 'center' })
        .text(lineTotal, 440, y, { width: 90, align: 'right' });
}

function formatCurrency(cents) {
    return '₹' + Number(cents).toFixed(2);
}

module.exports = createInvoice;
