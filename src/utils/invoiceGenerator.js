const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const createInvoice = (order, outputPath, settings) => {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const stream = fs.createWriteStream(outputPath);

        stream.on('finish', () => resolve(outputPath));
        stream.on('error', reject);
        doc.on('error', reject);

        doc.pipe(stream);

        generateHeader(doc, settings);
        generateCustomerInformation(doc, order, settings);
        generateInvoiceTable(doc, order);
        generateFooter(doc, settings);

        doc.end();
    });
};

function generateHeader(doc, settings) {
    // Brand Colors
    const primaryColor = '#4E342E';
    const accentColor = '#DBAB72';

    // Header Background Accent
    doc.rect(0, 0, doc.page.width, 140).fill('#FAFAFA');
    doc.rect(0, 140, doc.page.width, 3).fill(accentColor);

    // Dynamic Header Info
    const cafeName = 'SnowEra Cafe';
    const address = settings?.address || 'Industrial Area, Phase 1, Chandigarh, India';
    const mobile = settings?.mobile || '';
    const phone = settings?.phone || '';
    const email = settings?.email || 'hello@snoweracafe.com';

    // Logo Icon
    const logoPath = path.join(__dirname, '../../public/logo.png');
    if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 50, 25, { fit: [140, 110] });
    } else {
        doc.circle(95, 70, 35).fill(primaryColor);
        doc.font('Helvetica-Bold')
            .fillColor('#FFFFFF')
            .fontSize(22)
            .text('SE', 60, 58, { width: 70, align: 'center' });
    }

    // Company Information
    doc
        .font('Helvetica-Bold')
        .fillColor(primaryColor)
        .fontSize(16)
        .text(cafeName, 200, 40, { align: 'right' })
        .font('Helvetica')
        .fillColor('#555555')
        .fontSize(9)
        .text(address, 200, 60, { align: 'right', width: 345 })
        .moveDown(0.2);

    if (mobile || phone) {
        let contactStr = '';
        if (mobile) contactStr += `Mob: ${mobile}`;
        if (mobile && phone) contactStr += ' | ';
        if (phone) contactStr += `Tel: ${phone}`;
        doc.text(contactStr, 200, doc.y, { align: 'right' });
    }

    doc
        .font('Helvetica-Bold')
        .fillColor(accentColor)
        .text(email, 200, doc.y + 4, { align: 'right' })
        .moveDown();
}

function generateCustomerInformation(doc, order, settings) {
    const shippingAddress = order.shippingAddress || {};
    const primaryColor = '#4E342E';
    const bgColor = '#FAFAFA';

    doc.fillColor(primaryColor).fontSize(20).font('Helvetica-Bold').text('INVOICE', 50, 175);
    doc.rect(50, 200, 50, 2).fill(primaryColor);

    // Information Boxes with subtle borders
    doc.roundedRect(50, 215, 230, 115, 5).lineWidth(1).strokeColor('#EEEEEE').stroke();
    doc.roundedRect(315, 215, 230, 115, 5).lineWidth(1).strokeColor('#EEEEEE').stroke();

    // Inside invoice box
    doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(10).text('INVOICE DETAILS', 65, 230);
    doc.rect(65, 245, 200, 1).fill('#EEEEEE');

    doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(9).text('Invoice #:', 65, 255);
    doc.font('Helvetica').fillColor('#555555').text(order._id ? order._id.toString().toUpperCase() : 'N/A', 135, 255);

    doc.font('Helvetica-Bold').fillColor(primaryColor).text('Date:', 65, 270);
    doc.font('Helvetica').fillColor('#555555').text(new Date(order.createdAt || Date.now()).toLocaleDateString(), 135, 270);

    doc.font('Helvetica-Bold').fillColor(primaryColor).text('Payment:', 65, 285);
    let paymentStr = order.paymentMethod || 'COD';
    if (order.paymentStatus === 'paid') paymentStr += ' (Paid)';
    doc.font('Helvetica').fillColor('#555555').text(paymentStr, 135, 285);

    const accentColor = '#DBAB72';
    doc.font('Helvetica-Bold').fillColor(primaryColor).text('Total Due:', 65, 305);
    doc.font('Helvetica-Bold').fillColor(accentColor).fontSize(12).text(formatCurrency(order.totalAmount || 0), 135, 304);

    // Inside customer box
    doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(10).text('BILLED TO', 330, 230);
    doc.rect(330, 245, 200, 1).fill('#EEEEEE');

    const customerName = order.user?.name || shippingAddress.name || 'Valued Customer';
    doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(11).text(customerName.toUpperCase(), 330, 255);

    doc.font('Helvetica').fillColor('#555555').fontSize(9);
    if (order.orderType === 'Delivery') {
        doc.text(shippingAddress.street || '-', 330, 270);
        doc.text(`${shippingAddress.city || ''}, ${shippingAddress.state || ''}`, 330, 282);
        doc.text(`${shippingAddress.zipCode || ''}, ${shippingAddress.country || ''}`, 330, 294);
    } else {
        doc.text(`Service Type: ${order.orderType}`, 330, 270);
        if (order.table) doc.text(`Table Selection: Station ${order.table.tableNumber || order.table}`, 330, 282);
    }
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
    position += 15;
    doc.roundedRect(300, position, 245, 90, 5).fill(bgColor);

    let summaryPos = position + 10;

    // Subtotal
    doc.font('Helvetica').fontSize(9).fillColor(primaryColor);
    doc.text('Subtotal:', 320, summaryPos);
    const subtotal = (order.totalAmount || 0) + (order.discountAmount || 0);
    doc.text(formatCurrency(subtotal), 410, summaryPos, { width: 115, align: 'right' });

    // Discount
    if (order.discountAmount > 0) {
        summaryPos += 15;
        doc.fillColor('#E53E3E');
        doc.text(`Discount (${order.reward?.name || 'Reward'}):`, 320, summaryPos, { width: 120 });
        doc.text(`- ${formatCurrency(order.discountAmount)}`, 410, summaryPos, { width: 115, align: 'right' });
    }

    // Final Total
    summaryPos += 20;
    doc.font('Helvetica-Bold').fontSize(12).fillColor(primaryColor);
    doc.text('TOTAL AMOUNT:', 320, summaryPos);

    doc.font('Helvetica-Bold').fontSize(14).fillColor(accentColor);
    doc.text(formatCurrency(order.totalAmount || 0), 410, summaryPos - 2, { width: 115, align: 'right' });
}

function generateFooter(doc, settings) {
    const bottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    const email = settings?.email || 'hello@snoweracafe.com';

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
        .text(`For questions concerning this receipt, please contact ${email}`, 0, doc.page.height - 35, { align: 'center', width: doc.page.width });

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
    return 'Rs. ' + Number(cents || 0).toFixed(2);
}

module.exports = createInvoice;
