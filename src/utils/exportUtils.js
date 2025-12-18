import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const exportToExcel = (data, fileName) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sayfa1');
    XLSX.writeFile(wb, fileName + '.xlsx');
};

export const preparePDFWithFont = async () => {
    const doc = new jsPDF();
    try {
        const response = await fetch('/fonts/Roboto-Regular.ttf');
        if (response.ok) {
            const blob = await response.blob();
            const reader = new FileReader();
            await new Promise((resolve) => {
                reader.onloadend = () => {
                    const base64data = reader.result.split(',')[1];
                    doc.addFileToVFS('Roboto-Regular.ttf', base64data);
                    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
                    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'bold'); // Register as bold to prevent fallback
                    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'italic'); // Register as italic
                    doc.setFont('Roboto');
                    doc.activeFont = 'Roboto'; // Explicitly set property for consumers
                    resolve();
                };
                reader.readAsDataURL(blob);
            });
        } else {
            console.error('Font fetch failed');
        }
    } catch (e) {
        console.error('Font load error:', e);
    }
    return doc;
};

export const exportToPDF = async (title, headers, data, fileName) => {
    // 1. Prepare Doc with Font
    const doc = await preparePDFWithFont();

    doc.setFontSize(18);
    doc.text(title, 14, 22);

    doc.setFontSize(11);
    doc.text('Tarih: ' + new Date().toLocaleDateString('tr-TR'), 14, 30);

    autoTable(doc, {
        startY: 35,
        head: [headers],
        body: data,
        styles: { font: 'Roboto', fontSize: 9 }, // Use Custom Font
        headStyles: { fillColor: [79, 70, 229] },
        theme: 'grid'
    });

    doc.save(fileName + '.pdf');
};

export const handlePrint = (title, headers, data) => {
    const w = window.open('', '', 'height=600,width=800');
    let html = '<html><head><title>' + title + '</title><style>body{font-family:Arial,sans-serif;padding:20px}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #ddd;padding:10px;text-align:left}th{background:#4F46E5;color:white}tr:nth-child(even){background:#f9f9f9}</style></head><body><h2>' + title + '</h2><p>Tarih: ' + new Date().toLocaleDateString('tr-TR') + '</p><table><thead><tr>';

    headers.forEach(h => { html += '<th>' + h + '</th>'; });
    html += '</tr></thead><tbody>';

    data.forEach(row => {
        html += '<tr>';
        row.forEach(cell => { html += '<td>' + (cell || '-') + '</td>'; });
        html += '</tr>';
    });

    html += '</tbody></table></body></html>';

    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 250);
};

// Removed turkishToEnglish sanitization as we now support UTF-8
export const turkishToEnglish = (str) => str;
