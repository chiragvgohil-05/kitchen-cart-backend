const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const createInvoice = (order, path) => {
    let doc = new PDFDocument({ margin: 50 });

    generateHeader(doc);
    generateCustomerInformation(doc, order);
    generateInvoiceTable(doc, order);
    generateFooter(doc);

    doc.end();
    doc.pipe(fs.createWriteStream(path));
};

function generateHeader(doc) {
    doc
        .fillColor('#444444')
        .fontSize(20)
        .text('Kitchen Cart', 110, 57)
        .fontSize(10)
        .text('123 Main Street', 200, 65, { align: 'right' })
        .text('New York, NY, 10025', 200, 80, { align: 'right' })
        .moveDown();
}

function generateCustomerInformation(doc, order) {
    doc
        .fillColor('#444444')
        .fontSize(20)
        .text('Invoice', 50, 160);

    generateHr(doc, 185);

    const customerInformationTop = 200;

    doc
        .fontSize(10)
        .text('Invoice Number:', 50, customerInformationTop)
        .font('Helvetica-Bold')
        .text(order._id, 150, customerInformationTop)
        .font('Helvetica')
        .text('Invoice Date:', 50, customerInformationTop + 15)
        .text(new Date().toDateString(), 150, customerInformationTop + 15)
        .text('Balance Due:', 50, customerInformationTop + 30)
        .text(formatCurrency(order.totalAmount), 150, customerInformationTop + 30)
        .font('Helvetica-Bold')
        .text(order.shippingAddress.name, 300, customerInformationTop) // Assuming name is passed or in shippingAddress
        .font('Helvetica')
        .text(order.shippingAddress.street, 300, customerInformationTop + 15)
        .text(
            `${order.shippingAddress.city}, ${order.shippingAddress.state}, ${order.shippingAddress.country}`,
            300,
            customerInformationTop + 30
        )
        .moveDown();

    generateHr(doc, 252);
}

function generateInvoiceTable(doc, order) {
    let i;
    const invoiceTableTop = 330;

    doc.font('Helvetica-Bold');
    generateTableRow(
        doc,
        invoiceTableTop,
        'Item',
        'Unit Cost',
        'Quantity',
        'Line Total'
    );
    generateHr(doc, invoiceTableTop + 20);
    doc.font('Helvetica');

    for (i = 0; i < order.items.length; i++) {
        const item = order.items[i];
        const position = invoiceTableTop + (i + 1) * 30;
        generateTableRow(
            doc,
            position,
            item.product.name ? item.product.name : 'Product', // Assuming populated
            formatCurrency(item.price),
            item.quantity,
            formatCurrency(item.price * item.quantity)
        );

        generateHr(doc, position + 20);
    }

    const subtotalPosition = invoiceTableTop + (i + 1) * 30;
    generateTableRow(
        doc,
        subtotalPosition,
        '',
        '',
        'Total',
        formatCurrency(order.totalAmount)
    );
}

function generateFooter(doc) {
    doc
        .fontSize(10)
        .text(
            'Payment is due within 15 days. Thank you for your business.',
            50,
            780,
            { align: 'center', width: 500 }
        );
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
        .fontSize(10)
        .text(item, 50, y)
        .text(unitCost, 280, y, { width: 90, align: 'right' })
        .text(quantity, 370, y, { width: 90, align: 'right' })
        .text(lineTotal, 0, y, { align: 'right' });
}

function generateHr(doc, y) {
    doc
        .strokeColor('#aaaaaa')
        .lineWidth(1)
        .moveTo(50, y)
        .lineTo(550, y)
        .stroke();
}

function formatCurrency(cents) {
    return '₹' + (cents).toFixed(2);
}

module.exports = createInvoice;
