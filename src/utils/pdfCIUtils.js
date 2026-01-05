/**
 * PDF Corporate Identity (CI) Utilities
 * Centralizes the drawing of headers, footers, and brand tokens.
 */

export const CI_PALETTE = {
    pure_black: [29, 29, 31],
    neutral_grey: [134, 134, 139],
    hairline_grey: [210, 210, 215],
    apple_blue: [0, 113, 227],
    success_green: [34, 197, 94],
    error_red: [220, 38, 38],
    industrial_orange: [249, 115, 22],
    clinical_bg: [245, 245, 247]
};

export const CI_CONFIG = {
    font_bold: 'bold',
    font_normal: 'normal',
    margin_x: 14,
    header_y: 25,
    baseline_y: 32,
    footer_start_y: 275,
    line_width_thin: 0.05,
    line_width_med: 0.1
};

export const drawCIHeader = (doc, title, subtitle, docDate, docRef) => {
    const fontName = doc.activeFont || 'helvetica';

    // Top Hairline - High precision clinical divider
    doc.setDrawColor(...CI_PALETTE.hairline_grey);
    doc.setLineWidth(CI_CONFIG.line_width_thin);
    doc.line(CI_CONFIG.margin_x, 12, 196, 12);

    // LEFT SIDE: Brand & Subtitle (Vertically Stacked)
    // Brand Mark
    doc.setFontSize(16);
    doc.setTextColor(...CI_PALETTE.pure_black);
    doc.setFont(fontName, CI_CONFIG.font_bold);
    doc.text('GROHN', CI_CONFIG.margin_x, 22);

    // Clinical Subtitle (Positioned below Brand)
    if (subtitle) {
        doc.setFontSize(7);
        doc.setFont(fontName, CI_CONFIG.font_normal);
        doc.setTextColor(...CI_PALETTE.neutral_grey);
        doc.text(subtitle.toUpperCase(), CI_CONFIG.margin_x, 26);
    }

    // RIGHT SIDE: Document Title & Metadata (Vertically Stacked)
    // Document Identity Area (Right Aligned)
    doc.setFontSize(11);
    doc.setTextColor(...CI_PALETTE.apple_blue);
    doc.setFont(fontName, CI_CONFIG.font_bold);
    doc.text(title.toUpperCase(), 196, 22, null, null, 'right');

    // Official Document Info (Date/Ref) (Positioned below Title)
    if (docDate || docRef) {
        doc.setFontSize(7);
        doc.setFont(fontName, CI_CONFIG.font_normal);
        doc.setTextColor(...CI_PALETTE.neutral_grey);

        let infoStr = '';
        if (docDate) infoStr += `TARİH: ${docDate}`;
        if (docRef) infoStr += (docDate ? '  |  ' : '') + `REF: ${docRef}`;

        doc.text(infoStr, 196, 26, null, null, 'right');
    }

    // Baseline - Solid Anchor
    doc.setDrawColor(...CI_PALETTE.hairline_grey);
    doc.setLineWidth(CI_CONFIG.line_width_med);
    doc.line(CI_CONFIG.margin_x, CI_CONFIG.baseline_y, 196, CI_CONFIG.baseline_y);

    doc.setTextColor(...CI_PALETTE.pure_black);
};

/**
 * Draws the standardized clinical metadata footer.
 */
export const drawCIFooter = (doc, globalSettings, versionInfo) => {
    const fontName = doc.activeFont || 'helvetica';
    const pageNumber = doc.internal.getNumberOfPages();
    const totalPages = "{total_pages_count_string}"; // placeholder for jspdf-autotable

    doc.setDrawColor(...CI_PALETTE.hairline_grey);
    doc.setLineWidth(CI_CONFIG.line_width_thin);
    doc.line(CI_CONFIG.margin_x, CI_CONFIG.footer_start_y, 196, CI_CONFIG.footer_start_y);

    doc.setFontSize(7);
    doc.setTextColor(...CI_PALETTE.neutral_grey);
    doc.setFont(fontName, CI_CONFIG.font_bold);
    doc.text((globalSettings.company_name || 'Grohn Tekstil Kimyasal Ürünler San. Tic. Ltd. Şti.').toUpperCase(), CI_CONFIG.margin_x, CI_CONFIG.footer_start_y + 5);

    doc.setFont(fontName, CI_CONFIG.font_normal);
    doc.text(`${globalSettings.company_address || 'Velimeşe OSB, Ergene / Tekirdağ'}`, CI_CONFIG.margin_x, CI_CONFIG.footer_start_y + 9);
    doc.text(`${globalSettings.company_tax_office || 'Çorlu V.D.'} | VKN: ${globalSettings.company_tax_no || '4111172813'}`, CI_CONFIG.margin_x, CI_CONFIG.footer_start_y + 13);

    doc.text(`destek: ${globalSettings.company_email || 'grohn@grohn.com.tr'}`, 196, CI_CONFIG.footer_start_y + 9, null, null, 'right');
    doc.text(`telefon: ${globalSettings.company_phone || '+90 539 880 23 46'}`, 196, CI_CONFIG.footer_start_y + 13, null, null, 'right');

    const metaLabel = `${versionInfo} - Sayfa ${pageNumber}`;
    doc.setFont(fontName, 'italic');
    doc.setFontSize(6);
    doc.text(metaLabel, 105, 292, null, null, 'center');
};

/**
 * Draws a high-precision metadata grid for document headers.
 * Returns the final Y position after the grid.
 */
export const drawCIMetadataGrid = (doc, x, y, data, cols = 2) => {
    const fontName = doc.activeFont || 'helvetica';
    const colWidth = 182 / cols;
    let currentY = y;

    doc.setFontSize(7);

    // Process in chunks (rows)
    for (let i = 0; i < data.length; i += cols) {
        const rowData = data.slice(i, i + cols);
        let maxRowHeight = 12; // Base height

        // First pass: calculate max height for this row with safer buffer
        rowData.forEach((item) => {
            const splitValue = doc.splitTextToSize(item.value || '-', colWidth - 5);
            // Label(5) + lines * 4.5 + buffer(3)
            const contentHeight = 5 + (splitValue.length * 4.5) + 3;
            if (contentHeight > maxRowHeight) maxRowHeight = contentHeight;
        });

        // Second pass: draw items
        rowData.forEach((item, colIndex) => {
            const currX = x + (colIndex * colWidth);

            // Label
            doc.setFont(fontName, 'bold');
            doc.setTextColor(...CI_PALETTE.neutral_grey);
            doc.text(item.label.toUpperCase(), currX, currentY);

            // Value
            doc.setFont(fontName, 'normal');
            doc.setTextColor(...CI_PALETTE.pure_black);
            doc.setFontSize(9);
            const splitValue = doc.splitTextToSize(item.value || '-', colWidth - 5);
            doc.text(splitValue, currX, currentY + 5);
            doc.setFontSize(7);
        });

        currentY += maxRowHeight + 1; // Spacing between rows
    }

    return currentY;
};

/**
 * Draws a wrapped block of text with a label.
 * Returns the final Y position after the block.
 */
export const drawCIWrappedText = (doc, x, y, label, text, width = 182) => {
    const fontName = doc.activeFont || 'helvetica';

    if (label) {
        doc.setFontSize(7);
        doc.setFont(fontName, 'bold');
        doc.setTextColor(...CI_PALETTE.neutral_grey);
        doc.text(label.toUpperCase(), x, y);
        y += 5;
    }

    doc.setFontSize(8);
    doc.setFont(fontName, 'normal');
    doc.setTextColor(...CI_PALETTE.pure_black);
    const splitText = doc.splitTextToSize(text || '-', width);
    doc.text(splitText, x, y);

    const lineCount = splitText.length;
    const lineHeight = 4; // approximate height per line for 8pt font
    return y + (lineCount * lineHeight) + 5;
};
