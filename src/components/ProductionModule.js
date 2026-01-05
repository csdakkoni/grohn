import React, { useState, useEffect } from 'react';
import { Factory, Plus, Trash2, Calendar, Package, DollarSign, TrendingUp, Filter, AlertTriangle, FileText, Printer, CheckCircle, X, AlertCircle, Search, Beaker, Loader, Download, RefreshCw, XCircle, User } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import html2canvas from 'html2canvas';
import { preparePDFWithFont } from '../utils/exportUtils';
import { drawCIHeader, drawCIFooter, drawCIMetadataGrid, drawCIWrappedText, CI_PALETTE } from '../utils/pdfCIUtils';
import { supabase } from '../supabaseClient';

// Helper for safety
const parseInputFloat = (val) => {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    const cleanStr = val.toString().replace(',', '.').replace(/[^0-9.-]/g, '');
    const parsed = parseFloat(cleanStr);
    return isNaN(parsed) ? 0 : parsed;
};

const formatMoney = (amount, currency = 'TRY') => {
    const safeAmount = parseInputFloat(amount);
    const symbols = { USD: '$', EUR: '€', TRY: '₺' };
    const symbol = symbols[currency] || currency;
    return symbol + safeAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '-';
        return date.toLocaleDateString('tr-TR');
    } catch (e) { return '-'; }
};

export default function ProductionModule({ session, onRefresh, productions, recipes, inventory, qualitySpecs = [], globalSettings = {}, customers = [], onPlan, onComplete, onDelete }) {
    const [viewMode, setViewMode] = useState('list'); // 'list', 'plan', 'complete'
    const [selectedProduction, setSelectedProduction] = useState(null);

    // Filters
    const [filterText, setFilterText] = useState('');
    const [filterStatus, setFilterStatus] = useState('All');
    const [filterDateStart, setFilterDateStart] = useState('');
    const [filterDateEnd, setFilterDateEnd] = useState('');
    const [filterCustomer, setFilterCustomer] = useState('');

    // Planning Form State
    const [planForm, setPlanForm] = useState({
        recipeId: '',
        quantity: '',
        productionDate: new Date().toISOString().split('T')[0],
        notes: '',
        targetPackagingId: '',
        targetPackageCount: '',
        netFilling: '',
        customerId: '',
        density: '1.0'
    });

    // Completion Form State
    const [completeForm, setCompleteForm] = useState({
        qcStatus: 'Pass',
        qcNotes: '',
        packagingId: '',
        currency: 'USD'
    });

    // Adjustment Modal State
    const [showAdjModal, setShowAdjModal] = useState(false);
    const [selectedAdjProd, setSelectedAdjProd] = useState(null);
    const [adjForm, setAdjForm] = useState({ itemId: '', quantity: '' });

    const handlePlanSubmit = (e) => {
        e.preventDefault();
        onPlan(planForm).then(success => {
            if (success) {
                setViewMode('list');
                setPlanForm({
                    recipeId: '',
                    quantity: '',
                    productionDate: new Date().toISOString().split('T')[0],
                    notes: '',
                    targetPackagingId: '',
                    targetPackageCount: '',
                    netFilling: '',
                    customerId: '',
                    density: '1.0'
                });
            }
        });
    };

    const handleCompleteClick = (production) => {
        const recipe = recipes.find(r => r.id === production.recipe_id);
        const product = inventory.find(i => i.id === recipe?.product_id);

        setSelectedProduction(production);
        setCompleteForm({
            ...completeForm,
            qcStatus: 'Pass',
            qcNotes: '',
            packagingId: production.target_packaging_id || '',
            packagingCount: production.target_package_count || '',
            currency: product?.currency || 'USD'
        });
        setViewMode('complete');
    };

    const handleCompleteSubmit = (e) => {
        e.preventDefault();
        onComplete({ ...completeForm, productionId: selectedProduction.id }).then(success => {
            if (success) {
                setViewMode('list');
                setSelectedProduction(null);
                setCompleteForm({
                    qcStatus: 'Pass',
                    qcNotes: ''
                });
            }
        });
    };

    const handleAdjSubmit = async (e) => {
        e.preventDefault();
        try {
            const { error } = await supabase.rpc('add_production_adjustment', {
                p_production_id: selectedAdjProd.id,
                p_item_id: adjForm.itemId,
                p_quantity: adjForm.quantity,
                p_user_id: session.user.id
            });
            if (error) throw error;
            alert('Ek sarfiyat başarıyla eklendi ve stoktan düşüldü.');
            setShowAdjModal(false);
            setAdjForm({ itemId: '', quantity: '' });
        } catch (err) {
            alert('Hata: ' + err.message);
        }
    };


    // ==================== LABEL PRINTING ====================
    // ==================== LABEL PRINTING ====================
    const handlePrintLabel = async (prod) => {
        // Create a hidden container for the label
        const containerId = 'label-print-container';
        let container = document.getElementById(containerId);
        if (container) document.body.removeChild(container);

        container = document.createElement('div');
        container.id = containerId;
        // Styles to match 214mm x 152mm (214mm width, 152mm height)
        // High resolution scale
        container.style.position = 'fixed';
        container.style.left = '-9999px'; // Hidden
        // container.style.left = '10px'; // DEBUG: Show on screen
        container.style.top = '0';
        container.style.width = '214mm';
        container.style.height = '152mm';
        container.style.backgroundColor = 'white';
        container.style.boxSizing = 'border-box';
        container.style.fontFamily = "'Oswald', 'Roboto Condensed', 'Roboto', sans-serif";

        // Inner Content Data
        const invItem = inventory.find(i => i.name === prod.product_name);
        const prodCode = invItem?.product_code || 'CODE-???';
        const symbols = invItem?.ghs_symbols || [];
        const shelfLifeMonths = invItem?.shelf_life_months || 24;

        // Brüt estimation: Net + 2% for plastic drums/canisters as a generic rule fallback if no package info
        // Ideally we would look up package type from `prod.target_packaging_id`.
        // Let's assume a standard tare or just placeholder if unknown.
        let grossWeight = '-';
        if (prod.quantity) {
            const net = parseFloat(prod.quantity);
            // Simple estimation: Net * 1.05 (5% tare)
            grossWeight = (net * 1.05).toFixed(2);
        }

        const prodDate = new Date(prod.production_date);
        const expDate = new Date(prodDate);
        expDate.setMonth(expDate.getMonth() + shelfLifeMonths);

        // --- CLINICAL CI THEME ---
        const theme = {
            primary: '#1d1d1f', // Monolithic Black
            accent: '#0071e3',  // Apple Blue
            border: '#d2d2d7',  // Hairline Grey
            text: '#1d1d1f',
            textLight: '#86868b'
        };

        // Build GHS Diamonds HTML
        const ghsDiamondsHtml = symbols.length > 0 ? symbols.slice(0, 4).map(s => {
            let char = '!';
            if (s === 'flammable') char = 'F';
            if (s === 'corrosive') char = 'C';
            if (s === 'toxic') char = 'T';
            if (s === 'environment') char = 'N';
            if (s === 'oxidizing') char = 'O';
            if (s === 'health') char = '*';

            return `
                <div style="width: 85px; height: 85px; position: relative; display:inline-block; margin: 4px;">
                    <svg viewBox="0 0 100 100" style="width:100%; height:100%;">
                        <path d="M50 5 L95 50 L50 95 L5 50 Z" fill="white" stroke="#d00" stroke-width="6" />
                        <text x="50" y="65" font-size="48" font-family="Arial" font-weight="bold" text-anchor="middle" fill="black">${char}</text>
                    </svg>
                </div>
             `;
        }).join('') : `
             <div style="width: 85px; height: 85px; position: relative; display:inline-block; margin: 4px;">
                <svg viewBox="0 0 100 100" style="width:100%; height:100%;">
                    <path d="M50 5 L95 50 L50 95 L5 50 Z" fill="white" stroke="#d00" stroke-width="6" />
                    <text x="50" y="65" font-size="48" font-family="Arial" font-weight="bold" text-anchor="middle" fill="black">!</text>
                </svg>
             </div>
        `;

        container.innerHTML = `
            <div style="display: flex; flex-direction: column; height: 100%; width: 100%; background: white; position: relative; color: #1d1d1f; font-family: 'Inter', -apple-system, sans-serif;">
                
                <!-- NEW HEADER: BRAND & TRACKING -->
                <div style="background-color: white; color: ${theme.primary}; padding: 0 40px; display: flex; justify-content: space-between; align-items: center; height: 12%; border-bottom: 2px solid #000;">
                     <div style="font-size: 36px; font-weight: 900; letter-spacing: -1.5px;">
                        GROHN KİMYA
                     </div>
                     <div style="display: flex; flex-direction: column; align-items: center; margin-right: 80px;">
                        <div style="font-size: 8px; font-weight: 700; color: ${theme.textLight}; letter-spacing: 1px; margin-bottom: 2px;">PRODUCT TRACKING CODE</div>
                        <svg id="barcode-target" style="width: 140px; height: 40px;"></svg>
                     </div>
                </div>

                <!-- QR CODE: COMPACT FLOATING -->
                <div style="position: absolute; top: 10px; right: 15px; background: white; padding: 5px; border: 1px solid rgba(0,0,0,0.1); border-radius: 4px; z-index: 10;">
                    <canvas id="qr-canvas-target" style="width: 55px; height: 55px;"></canvas>
                </div>

                <!-- MAIN AREA -->
                <div style="display: flex; flex: 1; height: 73%;">
                    
                    <!-- LEFT PANEL: HIGHLIGHTS -->
                    <div style="flex: 60; padding: 40px; display: flex; flex-direction: column; border-right: 2px solid #000;">
                        
                        <!-- PRODUCT SECTION -->
                        <div style="margin-bottom: 30px;">
                             <div style="font-size: 14px; color: ${theme.accent}; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 10px;">PRODUCT / ÜRÜN</div>
                             
                             <h1 style="font-size: 72px; font-weight: 900; line-height: 0.95; margin: 0; color: ${theme.primary}; text-transform: uppercase; letter-spacing: -2px;">
                                ${prod.product_name || 'KİMYASAL ÜRÜN'}
                             </h1>

                             <div style="display: flex; align-items: center; margin-top: 25px; border-top: 2px solid #000; padding-top: 15px;">
                                 <div style="font-size: 11px; font-weight: 900; color: ${theme.textLight}; letter-spacing: 1px; width: 120px;">CODE / ÜRÜN KODU:</div>
                                 <div style="font-size: 32px; font-weight: 800; color: ${theme.primary};">${prodCode}</div>
                             </div>
                        </div>

                        <!-- METADATA GRID -->
                        <div style="margin-top: auto; display: grid; grid-template-columns: 1fr 1fr; border-top: 1px solid ${theme.border};">
                             
                             <!-- Row 1 -->
                             <div style="padding: 15px 0; border-right: 1px solid #eee; border-bottom: 1px solid #eee;">
                                <div style="font-size: 9px; text-transform: uppercase; color: ${theme.accent}; font-weight: 800; letter-spacing: 1.5px;">LOT / BATCH NO</div>
                                <div style="font-size: 24px; font-weight: 800; color: #000;">${prod.lot_number || '-'}</div>
                             </div>

                             <div style="padding: 15px 0 15px 30px; border-bottom: 1px solid #eee;">
                                <div style="font-size: 9px; text-transform: uppercase; color: ${theme.accent}; font-weight: 800; letter-spacing: 1.5px;">ÜRETİM / PROD. DATE</div>
                                <div style="font-size: 24px; font-weight: 800; color: #000;">${prodDate.toLocaleDateString('tr-TR')}</div>
                             </div>

                             <!-- Row 2 -->
                             <div style="padding: 15px 0; border-right: 1px solid #eee; border-bottom: 1px solid #eee;">
                                <div style="font-size: 9px; text-transform: uppercase; color: ${theme.accent}; font-weight: 800; letter-spacing: 1.5px;">NET / NET KG</div>
                                <div style="font-size: 32px; font-weight: 900; color: #000;">${prod.quantity} <span style="font-size: 16px;">kg</span></div>
                             </div>

                             <div style="padding: 15px 0 15px 30px; border-bottom: 1px solid #eee;">
                                <div style="font-size: 9px; text-transform: uppercase; color: ${theme.accent}; font-weight: 800; letter-spacing: 1.5px;">GROSS / BRÜT KG</div>
                                <div style="font-size: 32px; font-weight: 900; color: #000;">${grossWeight} <span style="font-size: 16px;">kg</span></div>
                             </div>

                             <!-- Row 3: EXPIRY -->
                             <div style="padding: 15px 0; grid-column: span 2;">
                                <div style="font-size: 9px; text-transform: uppercase; color: ${theme.error_red || '#d00'}; font-weight: 800; letter-spacing: 1.5px;">S.K.T. / EXP. DATE</div>
                                <div style="font-size: 24px; font-weight: 800; color: #000;">${expDate.toLocaleDateString('tr-TR')}</div>
                             </div>
                        </div>
                    </div>

                    <!-- RIGHT PANEL: SAFETY -->
                    <div style="flex: 40; background-color: #fff; display: flex; flex-direction: column; align-items: center; padding: 40px 20px;">
                        
                        <div style="font-size: 11px; font-weight: 900; color: #000; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 25px; border-bottom: 3px solid ${theme.accent}; padding-bottom: 8px; width: 100%; text-align: center;">HAZARD SYMBOLS / GHS</div>
                        
                        <div style="width: 100%; display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; flex: 1; align-content: flex-start;">
                            ${ghsDiamondsHtml}
                        </div>
                    </div>
                </div>

                <!-- FOOTER -->
                <div style="background-color: ${theme.primary}; color: white; height: 15%; display: flex; flex-direction: column; justify-content: center; padding: 0 40px; font-size: 11px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="flex: 1;">
                            <div style="font-weight: 800; font-size: 14px; color: ${theme.accent};">${globalSettings.company_name || 'GROHN TEKSTİL VE KİMYA ÜRÜNLERİ'}</div>
                            <div style="font-size: 10px; opacity: 0.8;">${globalSettings.company_address || 'Velimeşe OSB, Ergene / Tekirdağ'}</div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-weight: 700;">www.grohn.com.tr</div>
                            <div style="font-size: 10px; opacity: 0.8;">${globalSettings.company_phone || '+90 539 880 23 46'}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(container);

        // Render Codes
        try {
            const qrCanvas = document.getElementById('qr-canvas-target');
            await QRCode.toCanvas(qrCanvas, `https://www.grohn.com.tr`, {
                width: 60,
                margin: 0,
                color: { dark: theme.primary, light: '#ffffff' }
            });

            JsBarcode("#barcode-target", prodCode.replace(/[^a-zA-Z0-9]/g, '') || '123456', {
                format: "CODE128",
                width: 1.5,
                height: 35,
                displayValue: true,
                fontSize: 10,
                font: 'Inter',
                margin: 0,
                background: "transparent"
            });
        } catch (e) {
            console.error('Code gen error', e);
        }

        // Snapshot
        try {
            // Wait a moment for fonts/Styles
            await new Promise(r => setTimeout(r, 150)); // Slightly longer delay

            const canvas = await html2canvas(container, {
                scale: 2, // High res
                logging: false,
                useCORS: true,
                backgroundColor: '#ffffff'
            });
            const imgData = canvas.toDataURL('image/png');

            // Create PDF
            const doc = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: [214, 152]
            });
            doc.addImage(imgData, 'PNG', 0, 0, 214, 152);
            doc.save(`${prod.lot_number}_Etiket.pdf`);
        } catch (err) {
            console.error('Canvas Error', err);
            alert('Etiket oluşturulurken hata oluştu: ' + err.message);
        } finally {
            // Cleanup
            if (document.body.contains(container)) document.body.removeChild(container);
        }
    };


    const handlePrintWorkOrder = async (production) => {
        const recipe = recipes.find(r => r.id === production.recipe_id);
        const product = inventory.find(i => i.id === recipe?.product_id);
        const ingredients = recipe?.ingredients || [];
        const customer = customers.find(c => c.id === production.customer_id);

        const doc = await preparePDFWithFont();
        const fontName = doc.activeFont || 'helvetica';

        // Initial Header (Professional Layout)
        const docDate = new Date(production.production_date).toLocaleDateString('tr-TR');
        drawCIHeader(doc, 'ÜRETİM İŞ EMRİ', 'ÜRETİM OPERASYON MERKEZİ', docDate, production.lot_number);
        const startY = 45;

        // Metadata Grid (Cleaned)
        const metaData = [
            { label: 'ÜRÜN', value: product?.name || '-' },
            { label: 'HEDEF MİKTAR', value: `${production.quantity} kg` },
            { label: 'MÜŞTERİ', value: customer ? customer.name : 'STOK ÜRETİMİ' },
            { label: 'REÇETE KODU', value: `#${recipe?.id || '-'}` }
        ];
        let currY = drawCIMetadataGrid(doc, 14, startY, metaData, 2);
        currY += 5; // Spacing after grid

        // Packaging Instructions (Highlight Box)
        if (production.target_packaging_id) {
            const pkg = inventory.find(i => i.id === production.target_packaging_id);
            if (pkg) {
                doc.setFillColor(...CI_PALETTE.clinical_bg);
                doc.rect(14, currY, 182, 14, 'F');
                doc.setDrawColor(...CI_PALETTE.hairline_grey);
                doc.setLineWidth(0.05);
                doc.line(14, currY, 196, currY);
                doc.line(14, currY + 14, 196, currY + 14);

                doc.setFontSize(7);
                doc.setFont(fontName, 'bold');
                doc.setTextColor(...CI_PALETTE.neutral_grey);
                doc.text('DOLUM TALİMATI', 18, currY + 5);

                doc.setFontSize(9);
                doc.setFont(fontName, 'normal');
                doc.setTextColor(...CI_PALETTE.pure_black);
                doc.text(`${pkg.name} | ${production.target_package_count} ADET | (Birim: ${pkg.capacity_value} ${pkg.capacity_unit})`, 18, currY + 10);
                currY += 20;
            }
        }

        if (production.notes) {
            currY = drawCIWrappedText(doc, 14, currY, 'NOTLAR', production.notes);
        }

        const pkgCount = parseInputFloat(production.target_package_count);
        const hasPackaging = production.target_packaging_id && pkgCount > 0;
        let tableHeaders = ['Hammadde', 'Kod', 'Oran', 'Toplam Miktar'];
        if (hasPackaging) tableHeaders.push('Birim Miktar');
        tableHeaders.push('Tartım Onayı');

        const tableData = ingredients.map(ing => {
            const item = inventory.find(i => i.id === ing.itemId);
            const totalQty = (production.quantity * ing.percentage / 100);
            const row = [
                item?.name || '?',
                item?.product_code || item?.id?.toString() || '-',
                `%${ing.percentage}`,
                `${totalQty.toFixed(2)} kg`
            ];
            if (hasPackaging) {
                const perPackageQty = (totalQty / pkgCount).toFixed(2);
                row.push(`${perPackageQty} kg`);
            }
            row.push('__________');
            return row;
        });

        autoTable(doc, {
            startY: currY + 5,
            head: [tableHeaders],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: CI_PALETTE.pure_black, textColor: 255, fontSize: 7, font: fontName, fontStyle: 'bold' },
            bodyStyles: { fontSize: 8, cellPadding: 3, font: fontName, textColor: CI_PALETTE.pure_black },
            columnStyles: { [hasPackaging ? 5 : 4]: { halign: 'center' } },
            margin: { top: 40, bottom: 35 },
            didDrawPage: (data) => {
                const docDate = new Date(production.production_date).toLocaleDateString('tr-TR');
                drawCIHeader(doc, 'ÜRETİM İŞ EMRİ', 'ÜRETİM OPERASYON MERKEZİ', docDate, production.lot_number);
                drawCIFooter(doc, globalSettings, 'Üretim Modülü v5.3.0');
            }
        });

        // QC Parameters (Checklist Style)
        let finalY = doc.lastAutoTable.finalY + 15;

        // Space Check - If not enough space for QC + Signatures, move to new page
        if (finalY > 220) {
            doc.addPage();
            const docDate = new Date(production.production_date).toLocaleDateString('tr-TR');
            drawCIHeader(doc, 'ÜRETİM İŞ EMRİ', 'ÜRETİM OPERASYON MERKEZİ', docDate, production.lot_number);
            drawCIFooter(doc, globalSettings, 'Üretim Modülü v5.3.0');
            finalY = 45;
        }

        if (finalY < 230) {
            doc.setFont(fontName, 'bold');
            doc.setFontSize(8);
            doc.setTextColor(...CI_PALETTE.apple_blue);
            doc.text('KALİTE KONTROL PARAMETRELERİ', 14, finalY);
            doc.setDrawColor(...CI_PALETTE.hairline_grey);
            doc.setLineWidth(0.05);
            doc.line(14, finalY + 2, 196, finalY + 2);
            finalY += 8;

            const productSpecs = qualitySpecs.filter(s => s.product_id === product?.id);
            let qcItems = productSpecs.length > 0 ? productSpecs.map(s => [
                s.parameter_name, `LİMİT: ${s.min_value || '-'} - ${s.max_value || '-'}`, '__________'
            ]) : [['Görünüş', 'Standart', '__________'], ['Renk', 'Standart', '__________'], ['pH', 'Spec', '__________']];

            autoTable(doc, {
                startY: finalY,
                head: [['Parametre', 'Kriter', 'Ölçülen']],
                body: qcItems,
                theme: 'plain',
                styles: { fontSize: 8, cellPadding: 2, font: fontName },
                headStyles: { textColor: CI_PALETTE.neutral_grey, fontStyle: 'bold' },
                columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 } }
            });

            // Clinical Signatures
            finalY = doc.lastAutoTable.finalY + 20;
            doc.setDrawColor(...CI_PALETTE.hairline_grey);
            doc.line(14, finalY + 15, 74, finalY + 15);
            doc.line(136, finalY + 15, 196, finalY + 15);

            doc.setFontSize(7);
            doc.setFont(fontName, 'bold');
            doc.setTextColor(...CI_PALETTE.neutral_grey);
            doc.text('ÜRETİM SORUMLUSU', 14, finalY);
            doc.text('KALİTE KONTROL ONAYI', 136, finalY);
        }

        doc.save(`WorkOrder_${production.lot_number}.pdf`);
    };

    const handlePrintRevisionOrder = async (production) => {
        const recipe = recipes.find(r => r.id === production.recipe_id);
        const product = inventory.find(i => i.id === recipe?.product_id);

        const doc = await preparePDFWithFont();
        const fontName = doc.activeFont || 'helvetica';

        // Initial Header (Special Revision Look)
        drawCIHeader(doc, 'REVİZYON İŞ EMRİ', 'ÜRETİM OPERASYON MERKEZİ');

        // Manual Red Override for Revision Style
        doc.setFontSize(14);
        doc.setTextColor(...CI_PALETTE.error_red);
        doc.setFont(fontName, 'bold');
        doc.text('GROHN', 14, 25);
        doc.setTextColor(...CI_PALETTE.pure_black);

        const startY = 45;

        // Metadata Grid for Revision
        const metaData = [
            { label: 'PARTİ NO', value: production.lot_number || '-' },
            { label: 'TARİH', value: new Date(production.production_date).toLocaleDateString('tr-TR') },
            { label: 'ÜRÜN', value: product?.name || '-' },
            { label: 'MİKTAR', value: `${production.quantity} kg` }
        ];
        drawCIMetadataGrid(doc, 14, startY, metaData, 2);

        let currentY = startY + 30;

        // ADJUSTMENT INSTRUCTIONS BOX (High Contrast)
        doc.setFillColor(255, 247, 237); // Orange-50
        doc.setDrawColor(...CI_PALETTE.industrial_orange);
        doc.setLineWidth(0.1);
        doc.rect(14, currentY, 182, 45, 'FD');

        doc.setFont(fontName, 'bold');
        doc.setFontSize(8);
        doc.setTextColor(...CI_PALETTE.industrial_orange);
        doc.text('YAPILACAK DÜZELTME / İLAVE İŞLEMLERİ:', 20, currentY + 8);

        doc.setFont(fontName, 'normal');
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        const splitNotes = doc.splitTextToSize(production.adjustment_notes || 'Detaylı düzeltme talimatı girilmemiş.', 170);
        doc.text(splitNotes, 20, currentY + 18);

        currentY += 60;

        // Signatures
        doc.setDrawColor(...CI_PALETTE.hairline_grey);
        doc.line(14, currentY + 15, 74, currentY + 15);
        doc.line(136, currentY + 15, 196, currentY + 15);

        doc.setFontSize(7);
        doc.setFont(fontName, 'bold');
        doc.setTextColor(...CI_PALETTE.neutral_grey);
        doc.text('ÜRETİM SORUMLUSU', 14, currentY);
        doc.text('KALİTE KONTROL ONAYI', 136, currentY);

        drawCIFooter(doc, globalSettings, 'Revizyon Modülü v5.3.0');

        doc.save(`Revizyon_Emri_${production.lot_number}.pdf`);
    };

    // --- FILTER LOGIC ---
    const filteredProductions = productions.filter(p => {
        const recipe = recipes.find(r => r.id === p.recipe_id);
        const product = recipe ? inventory.find(i => i.id === recipe.product_id) : null;
        const customer = customers.find(c => c.id === p.customer_id);

        const isPlanned = p.status === 'Planned';
        const statusMatch = filterStatus === 'All'
            ? true
            : filterStatus === 'Planned'
                ? isPlanned
                : !isPlanned;

        const dateMatch = (!filterDateStart || p.production_date >= filterDateStart) &&
            (!filterDateEnd || p.production_date <= filterDateEnd);

        const customerMatch = !filterCustomer || p.customer_id === parseInt(filterCustomer);

        const searchLower = filterText.toLowerCase();
        const textMatch = !filterText ||
            (p.lot_number && p.lot_number.toLowerCase().includes(searchLower)) ||
            (product && product.name && product.name.toLowerCase().includes(searchLower)) ||
            (product && product.product_code && product.product_code.toLowerCase().includes(searchLower)) ||
            (customer && customer.name && customer.name.toLowerCase().includes(searchLower));

        return statusMatch && dateMatch && customerMatch && textMatch;
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h2 className="heading-industrial text-2xl flex items-center gap-2">
                    <Factory className="h-6 w-6 text-[#0071e3]" /> ÜRETİM YÖNETİMİ
                </h2>
                <div className="flex gap-2">
                    {viewMode === 'list' && (
                        <button
                            onClick={() => setViewMode('plan')}
                            className="btn-primary flex items-center gap-2"
                        >
                            <Plus className="h-4 w-4" /> Yeni Plan
                        </button>
                    )}
                    {viewMode !== 'list' && (
                        <button
                            onClick={() => { setViewMode('list'); setSelectedProduction(null); }}
                            className="text-slate-500 hover:text-slate-700 flex items-center gap-1"
                        >
                            <X className="h-5 w-5" /> İptal
                        </button>
                    )}
                </div>
            </div>

            {/* FILTER BAR - Only in List Mode */}
            {viewMode === 'list' && (
                <div className="card-industrial p-4 grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
                    <div className="md:col-span-2">
                        <label className="label-industrial block">Arama</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="LOT, Ürün veya Müşteri ara..."
                                className="input-industrial pl-9"
                                value={filterText}
                                onChange={e => setFilterText(e.target.value)}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="label-industrial block">Durum</label>
                        <select
                            className="select-industrial"
                            value={filterStatus}
                            onChange={e => setFilterStatus(e.target.value)}
                        >
                            <option value="All">Tümü</option>
                            <option value="Planned">Planlanan</option>
                            <option value="Completed">Tamamlanan</option>
                        </select>
                    </div>

                    <div>
                        <label className="label-industrial block">Müşteri</label>
                        <select
                            className="select-industrial"
                            value={filterCustomer}
                            onChange={e => setFilterCustomer(e.target.value)}
                        >
                            <option value="">Tümü</option>
                            <option value="0">Stok (Müşterisiz)</option>
                            {customers.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="label-industrial block">Başlangıç</label>
                        <input
                            type="date"
                            className="input-industrial"
                            value={filterDateStart}
                            onChange={e => setFilterDateStart(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="label-industrial block">Bitiş</label>
                        <input
                            type="date"
                            className="input-industrial"
                            value={filterDateEnd}
                            onChange={e => setFilterDateEnd(e.target.value)}
                        />
                    </div>
                </div>
            )}

            {/* PLANNING FORM */}
            {viewMode === 'plan' && (
                <div className="card-industrial p-6">
                    <h3 className="text-lg font-bold mb-4 text-[#1d1d1f] uppercase tracking-tight">Yeni Üretim Planı</h3>
                    <form onSubmit={handlePlanSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="label-industrial block">Reçete / Ürün</label>
                            <select
                                required
                                value={planForm.recipeId}
                                onChange={e => {
                                    const rId = e.target.value;
                                    let newDensity = '1.0';
                                    if (rId) {
                                        const r = recipes.find(x => x.id === parseInt(rId));
                                        if (r && r.product_id) {
                                            const specs = qualitySpecs.filter(s => s.product_id === r.product_id);
                                            const densSpec = specs.find(s =>
                                                s.parameter_name.toLowerCase().includes('yoğunluk') ||
                                                s.parameter_name.toLowerCase().includes('density')
                                            );
                                            if (densSpec) newDensity = densSpec.target_value || densSpec.min_value || '1.0';
                                        }
                                    }
                                    setPlanForm({ ...planForm, recipeId: rId, density: newDensity });
                                }}
                                className="select-industrial"
                            >
                                <option value="">Seçiniz...</option>
                                {recipes.map(r => {
                                    const product = inventory.find(i => i.id === r.product_id);
                                    return <option key={r.id} value={r.id}>{product?.product_code || product?.id} - {product?.name || 'Bilinmeyen'}</option>;
                                })}
                            </select>
                        </div>

                        <div>
                            <label className="label-industrial block">Müşteri (Opsiyonel)</label>
                            <select
                                value={planForm.customerId}
                                onChange={e => setPlanForm({ ...planForm, customerId: e.target.value })}
                                className="select-industrial"
                            >
                                <option value="">Stok Üretimi (Seçiniz...)</option>
                                {customers.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                            <p className="text-[10px] text-gray-400 mt-1 font-medium">Özel sipariş ise seçiniz.</p>
                        </div>

                        <div>
                            <label className="label-industrial block">Planlanan Miktar (kg)</label>
                            <input
                                required
                                type="number"
                                value={planForm.quantity}
                                onChange={e => {
                                    const qty = e.target.value;
                                    let count = '';
                                    if (qty && planForm.netFilling) {
                                        count = Math.ceil(parseFloat(qty) / parseFloat(planForm.netFilling));
                                    }
                                    setPlanForm({ ...planForm, quantity: qty, targetPackageCount: count });
                                }}
                                className="input-industrial"
                            />
                        </div>
                        <div>
                            <label className="label-industrial block">Üretim Tarihi</label>
                            <input
                                required
                                type="date"
                                value={planForm.productionDate}
                                onChange={e => setPlanForm({ ...planForm, productionDate: e.target.value })}
                                className="input-industrial"
                            />
                        </div>

                        <div className="md:col-span-2 bg-[#fbfbfd] p-4 rounded-[6px] border border-[#d2d2d7]">
                            <h4 className="font-bold text-[#1d1d1f] mb-2 flex items-center gap-2 text-sm uppercase">
                                <Package className="h-4 w-4" /> Dolum / Ambalaj Planı
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="label-industrial block">Hedef Ambalaj</label>
                                    <select
                                        value={planForm.targetPackagingId}
                                        onChange={e => setPlanForm({ ...planForm, targetPackagingId: e.target.value })}
                                        className="select-industrial"
                                    >
                                        <option value="">Seçiniz (Opsiyonel)</option>
                                        {inventory.filter(i => i.type === 'Ambalaj').map(i => (
                                            <option key={i.id} value={i.id}>
                                                {i.product_code || i.id} - {i.name} ({i.capacity_value} {i.capacity_unit || 'L'})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="label-industrial block">Ambalaj Başına Net Dolum (kg)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={planForm.netFilling || ''}
                                        onChange={e => {
                                            const val = e.target.value;
                                            let count = '';
                                            if (val && planForm.quantity) {
                                                count = Math.ceil(parseFloat(planForm.quantity) / parseFloat(val));
                                            }
                                            setPlanForm({ ...planForm, netFilling: val, targetPackageCount: count });
                                        }}
                                        className="input-industrial"
                                        placeholder="Örn: 20"
                                    />
                                </div>
                                <div>
                                    <label className="label-industrial block">Hesaplanan Adet</label>
                                    <input
                                        type="number"
                                        value={planForm.targetPackageCount}
                                        readOnly
                                        className="input-industrial bg-gray-50 text-gray-500 cursor-not-allowed"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="md:col-span-2">
                            <label className="label-industrial block">Notlar</label>
                            <input
                                type="text"
                                value={planForm.notes}
                                onChange={e => setPlanForm({ ...planForm, notes: e.target.value })}
                                className="input-industrial"
                            />
                        </div>
                        <div className="md:col-span-2 flex justify-end">
                            <button type="submit" className="btn-primary">
                                Planı Kaydet
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* COMPLETION FORM */}
            {viewMode === 'complete' && selectedProduction && (
                <div className="card-industrial p-6 mb-6">
                    <div className="mb-6 bg-[#e8f2ff] p-4 rounded-[6px] border border-[#d0e6ff] flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-[#0071e3] mt-0.5" />
                        <div>
                            <h3 className="font-bold text-[#0071e3] text-sm">Üretim Tamamlama: {selectedProduction.lot_number}</h3>
                            <p className="text-xs text-[#0071e3] mt-1">Maliyetler ürün kartındaki referans değerlerden otomatik doldurulmuştur.</p>
                        </div>
                    </div>

                    <form onSubmit={handleCompleteSubmit} className="space-y-6">
                        <div className="card-industrial p-6 grid grid-cols-1 md:grid-cols-2 gap-6 bg-[#f5f5f7] border border-slate-200">
                            <div className="space-y-1">
                                <label className="label-industrial">Ambalaj Seçimi</label>
                                <select
                                    required
                                    className="select-industrial bg-white"
                                    value={completeForm.packagingId}
                                    onChange={e => setCompleteForm({ ...completeForm, packagingId: e.target.value })}
                                >
                                    <option value="">Seçiniz...</option>
                                    {inventory.filter(i => i.type === 'Ambalaj').map(i => (
                                        <option key={i.id} value={i.id}>{i.name} ({i.stock_qty} adet)</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="label-industrial">Ambalaj Adedi</label>
                                <input
                                    required
                                    type="number"
                                    className="input-industrial bg-white"
                                    value={completeForm.packagingCount}
                                    onChange={e => setCompleteForm({ ...completeForm, packagingCount: e.target.value })}
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="label-industrial">Kalite Onay Durumu</label>
                                <select
                                    required
                                    value={completeForm.qcStatus}
                                    onChange={e => setCompleteForm({ ...completeForm, qcStatus: e.target.value })}
                                    className="select-industrial bg-white"
                                >
                                    <option value="Pass">✓ ONAYLANDI (PASS)</option>
                                    <option value="Fail">✗ RED EDİLDİ (FAIL)</option>
                                    <option value="Conditional">⚠ ŞARTLI ONAY (CONDITIONAL)</option>
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="label-industrial">Kalite Notları</label>
                                <textarea
                                    value={completeForm.qcNotes}
                                    onChange={e => setCompleteForm({ ...completeForm, qcNotes: e.target.value })}
                                    className="input-industrial h-[46px] resize-none bg-white"
                                />
                            </div>
                        </div>


                        <div className="flex justify-end gap-3 pt-4">
                            <button
                                type="button"
                                onClick={() => setViewMode('list')}
                                className="px-6 py-3 text-slate-500 hover:bg-slate-100 rounded-xl font-bold transition-colors"
                            >
                                Vazgeç
                            </button>
                            <button
                                type="submit"
                                className="bg-green-600 hover:bg-green-700 text-white px-10 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-green-100 transition-all active:scale-95"
                            >
                                <CheckCircle className="h-6 w-6" /> Üretimi Onayla & Stoka Al
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* LIST */}
            {/* Production List Table */}
            <div className="card-industrial overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="table-industrial">
                        <thead>
                            <tr>
                                <th className="text-left whitespace-nowrap uppercase text-[10px] tracking-widest text-slate-400">Tarih</th>
                                <th className="text-left uppercase text-[10px] tracking-widest text-slate-400">Durum</th>
                                <th className="text-left w-1/4 uppercase text-[10px] tracking-widest text-slate-400">Ürün Adı</th>
                                <th className="text-left uppercase text-[10px] tracking-widest text-slate-400">Ürün Kodu</th>
                                <th className="text-left uppercase text-[10px] tracking-widest text-slate-400">Müşteri</th>
                                <th className="text-left uppercase text-[10px] tracking-widest text-slate-400">LOT NO</th>
                                <th className="text-right uppercase text-[10px] tracking-widest text-slate-400">Miktar</th>
                                <th className="text-right uppercase text-[10px] tracking-widest text-slate-400">Ambalaj</th>
                                <th className="text-right uppercase text-[10px] tracking-widest text-slate-400">Birim Maliyet</th>
                                <th className="text-right uppercase text-[10px] tracking-widest text-slate-400">Toplam Maliyet</th>
                                <th className="text-right uppercase text-[10px] tracking-widest text-slate-400">İşlem</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredProductions.map(p => {
                                const recipe = recipes.find(r => r.id === p.recipe_id);
                                const product = recipe ? inventory.find(i => i.id === recipe.product_id) : null;
                                const customer = customers.find(c => c.id === p.customer_id);

                                return (
                                    <tr key={p.id} className="hover:bg-[#fbfbfd] transition-colors">
                                        <td className="px-4 py-4 align-middle">
                                            <div className="font-mono text-xs text-gray-900 bg-white border border-slate-200 px-2 py-1 rounded shadow-sm w-fit">
                                                {formatDate(p.production_date)}
                                            </div>
                                        </td>
                                        <td className="align-middle">
                                            <div className="flex flex-col gap-1">
                                                <span className={`inline-flex px-2 py-0.5 rounded-[3px] text-[10px] font-bold uppercase border w-fit ${p.status === 'Completed' ? 'bg-green-50 text-green-700 border-green-100' :
                                                    p.status === 'Planned' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                                        'bg-yellow-50 text-yellow-700 border-yellow-100'
                                                    }`}>
                                                    {p.status === 'Completed' ? 'Tamamlandı' : p.status === 'Planned' ? 'Planlandı' : p.status}
                                                </span>
                                                {p.qc_status && (
                                                    <div className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-[3px] border w-fit ${p.qc_status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                                        p.qc_status === 'Rejected' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-orange-50 text-orange-700 border-orange-100'
                                                        }`}>
                                                        QC: {p.qc_status}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="align-middle">
                                            <div className="font-bold text-slate-900">{product?.name || 'Bilinmeyen Ürün'}</div>
                                        </td>
                                        <td className="align-middle">
                                            <div className="text-[11px] text-indigo-600 font-mono font-bold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 w-fit">
                                                {product?.product_code || '-'}
                                            </div>
                                        </td>
                                        <td className="align-middle">
                                            {customer ? (
                                                <div className="text-xs text-slate-700 font-medium flex items-center gap-1.5">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                                    {customer.name}
                                                </div>
                                            ) : (
                                                <div className="text-xs text-slate-400 italic">STANDART STOK</div>
                                            )}
                                        </td>
                                        <td className="align-middle">
                                            {p.lot_number ? (
                                                <div className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded border border-slate-200 w-fit">
                                                    {p.lot_number}
                                                </div>
                                            ) : (
                                                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Beklemede</div>
                                            )}
                                        </td>
                                        <td className="text-right align-middle">
                                            <div className="font-black text-slate-900 text-sm">{p.quantity} <span className="text-[10px] text-slate-400 font-bold">KG</span></div>
                                        </td>
                                        <td className="text-right align-middle">
                                            {p.target_package_count && (
                                                <div className="flex flex-col items-end">
                                                    <div className="text-[11px] font-bold text-slate-700">{p.target_package_count} ADET</div>
                                                    <div className="text-[10px] text-slate-400 font-mono">
                                                        {inventory.find(i => i.id === parseInt(p.target_packaging_id))?.capacity_value || '?'} kg/dolum
                                                    </div>
                                                </div>
                                            )}
                                        </td>
                                        <td className="text-right align-middle">
                                            <div className="text-xs font-mono font-bold text-slate-600">
                                                {p.calculated_unit_cost ? formatMoney(p.calculated_unit_cost) : '-'}
                                            </div>
                                        </td>
                                        <td className="text-right align-middle">
                                            <div className="text-sm font-black text-indigo-600 bg-indigo-50/50 px-2 py-1 rounded-sm border border-indigo-100/50">
                                                {p.calculated_total_cost ? formatMoney(p.calculated_total_cost) : '-'}
                                            </div>
                                        </td>
                                        <td className="text-right align-middle">
                                            <div className="flex flex-col gap-1 items-end">
                                                {/* ACTION BUTTONS LOGIC */}
                                                {p.status === 'Completed' ? (
                                                    <span className="p-1.5 px-3 text-[#107c10] bg-[#f2f9f2] rounded text-[10px] font-black border border-[#d2e7d2] flex items-center gap-1 uppercase tracking-wider shadow-sm">
                                                        <CheckCircle className="h-4 w-4" /> TAMAMLANDI
                                                    </span>
                                                ) : p.qc_status === 'Rejected' || p.qc_status === 'Fail' ? (
                                                    <div className="flex items-center gap-1">
                                                        <span className="p-1 text-red-600 bg-red-50 rounded text-[10px] font-bold border border-red-100 flex items-center gap-1" title="Laboratuvar RED verdi">
                                                            <XCircle className="h-3 w-3" /> RED
                                                        </span>
                                                        <button
                                                            onClick={() => handlePrintRevisionOrder(p)}
                                                            className="p-1.5 text-orange-600 hover:bg-orange-50 rounded border border-transparent hover:border-orange-100 transition-colors"
                                                            title="Düzeltme Föyü Yazdır"
                                                        >
                                                            <FileText className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => { setSelectedAdjProd(p); setShowAdjModal(true); }}
                                                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded border border-transparent hover:border-indigo-100 transition-colors"
                                                            title="Ek Sarfiyat Ekle (Stoktan Düş)"
                                                        >
                                                            <Plus className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            onClick={async () => {
                                                                const reason = window.prompt('Bu üretim için DÜZELTME SONRASI yeniden test başlatılsın mı? Lütfen yapılan işlemi kısaca belirtiniz:', 'Hammadde takviyesi / Seyreltme yapıldı');
                                                                if (reason === null) return;
                                                                try {
                                                                    const { error } = await supabase.rpc('send_production_to_qc', {
                                                                        p_production_id: p.id,
                                                                        p_user_id: session.user.id,
                                                                        p_notes: reason
                                                                    });
                                                                    if (error) throw error;
                                                                    alert('Yeniden test talebi iletildi. Üretim "In QC" durumuna getirildi.');
                                                                    if (onRefresh) onRefresh();
                                                                } catch (err) {
                                                                    alert('Hata: ' + err.message);
                                                                }
                                                            }}
                                                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded border border-transparent hover:border-blue-100 transition-colors"
                                                            title="Düzeltildi, Yeniden Test İste"
                                                        >
                                                            <Beaker className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            onClick={async () => {
                                                                if (!window.confirm('Bu üretimi tamamen SIFIRLAMAK (Planlandı durumuna geri çekmek) istiyor musunuz? LOT numarası silinecektir.')) return;
                                                                const { error } = await supabase.from('productions').update({ status: 'Planned', qc_status: null, lot_number: null }).eq('id', p.id);
                                                                if (!error) { alert('Üretim sıfırlandı ve Planlandı statüsüne alındı.'); if (onRefresh) onRefresh(); }
                                                            }}
                                                            className="p-1.5 text-slate-400 hover:bg-slate-100 rounded border border-transparent hover:border-slate-200 transition-colors"
                                                            title="Üretimi Sıfırla (Başa Al)"
                                                        >
                                                            <RefreshCw className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                ) : p.qc_status === 'Approved' ? (
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={() => handleCompleteClick(p)}
                                                            className="p-1.5 text-white bg-green-600 hover:bg-green-700 rounded shadow-sm hover:shadow transition-all w-fit"
                                                            title="Üretimi Tamamla (Onaylı)"
                                                        >
                                                            <CheckCircle className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            onClick={async () => {
                                                                const reason = window.prompt('Bu üretim için YENİDEN Kalite Kontrol testi başlatılsın mı? Lütfen yeniden test isteme nedenini belirtiniz:', 'Numune doğrulaması / Müşteri talebi');
                                                                if (reason === null) return;
                                                                try {
                                                                    const { error } = await supabase.rpc('send_production_to_qc', {
                                                                        p_production_id: p.id,
                                                                        p_user_id: session.user.id,
                                                                        p_notes: reason
                                                                    });
                                                                    if (error) throw error;
                                                                    alert('Yeni test talebi iletildi.');
                                                                    if (onRefresh) onRefresh();
                                                                } catch (err) {
                                                                    alert('Hata: ' + err.message);
                                                                }
                                                            }}
                                                            className="p-1.5 text-orange-600 hover:bg-orange-50 rounded border border-transparent hover:border-orange-100 transition-colors"
                                                            title="Yeniden Test İste"
                                                        >
                                                            <Beaker className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                ) : p.status === 'In QC' ? (
                                                    <span className="p-1 text-orange-600 bg-orange-50 rounded text-[10px] font-bold border border-orange-100 flex items-center gap-1 cursor-help" title="Laboratuvar onayı bekleniyor">
                                                        <Beaker className="h-3 w-3" /> Testte
                                                    </span>
                                                ) : (
                                                    <button
                                                        onClick={async () => {
                                                            if (!window.confirm('Bu üretim için Kalite Kontrol testi başlatılsın mı?')) return;
                                                            try {
                                                                const { error } = await supabase.rpc('send_production_to_qc', {
                                                                    p_production_id: p.id,
                                                                    p_user_id: session.user.id
                                                                });
                                                                if (error) throw error;
                                                                alert('Test talebi Kalite Kontrol birimine iletildi.');
                                                                if (onRefresh) onRefresh();
                                                            } catch (err) {
                                                                alert('Hata: ' + err.message);
                                                            }
                                                        }}
                                                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded border border-transparent hover:border-blue-100 transition-colors"
                                                        title="Test İste (Kalite Kontrol)"
                                                    >
                                                        <Beaker className="h-4 w-4" />
                                                    </button>
                                                )}

                                                <div className="flex gap-1 mt-1">
                                                    <button
                                                        onClick={() => handlePrintWorkOrder(p)}
                                                        className="p-1.5 text-gray-500 hover:text-indigo-600 transition-colors"
                                                        title="Üretim Föyü (İş Emri) Yazdır"
                                                    >
                                                        <FileText className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handlePrintLabel(p)}
                                                        className="p-1.5 text-gray-500 hover:text-indigo-600 transition-colors"
                                                        title="Ürün Etiketi Yazdır"
                                                    >
                                                        <Printer className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => onDelete(p.id)}
                                                        className="p-1.5 text-gray-500 hover:text-red-600 transition-colors"
                                                        title="Sil"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredProductions.length === 0 && (
                                <tr>
                                    <td colSpan="7" className="px-6 py-8 text-center text-slate-400 italic text-xs">
                                        Kriterlere uygun üretim kaydı bulunamadı.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            {/* ADJUSTMENT MODAL */}
            {showAdjModal && (
                <div className="modal-overlay-industrial flex items-center justify-center p-4">
                    <div className="modal-content-industrial w-full max-w-md">
                        <div className="modal-header-industrial">
                            <h3 className="text-sm font-bold text-[#1d1d1f] uppercase tracking-wide flex items-center gap-2">
                                <Plus className="h-4 w-4 text-[#0071e3]" /> Ek Sarfiyat Ekle
                            </h3>
                            <button onClick={() => setShowAdjModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleAdjSubmit}>
                            <div className="modal-body-industrial">
                                <div className="p-3 bg-yellow-50 rounded-[4px] border border-yellow-100 text-xs text-yellow-800 mb-4">
                                    <p className="font-bold flex items-center gap-1"><AlertTriangle size={12} /> Dikkat:</p>
                                    <p>Bu işlem stoğu hemen düşer ve maliyeti üretime yansıtır.</p>
                                </div>

                                <div>
                                    <label className="label-industrial block">Eklenecek Malzeme</label>
                                    <select
                                        required
                                        className="select-industrial"
                                        value={adjForm.itemId}
                                        onChange={e => setAdjForm({ ...adjForm, itemId: e.target.value })}
                                    >
                                        <option value="">Seçiniz...</option>
                                        {inventory.filter(i => i.type === 'Hammadde').map(i => (
                                            <option key={i.id} value={i.id}>{i.product_code} - {i.name} (Stok: {i.stock_qty || '-'} {i.unit})</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="label-industrial block">Miktar</label>
                                    <div className="flex gap-2">
                                        <input
                                            required
                                            type="number"
                                            step="0.001"
                                            className="input-industrial"
                                            value={adjForm.quantity}
                                            onChange={e => setAdjForm({ ...adjForm, quantity: e.target.value })}
                                            placeholder="0.000"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer-industrial">
                                <button
                                    type="button"
                                    onClick={() => setShowAdjModal(false)}
                                    className="btn-secondary"
                                >
                                    İptal
                                </button>
                                <button
                                    type="submit"
                                    className="btn-primary"
                                >
                                    Ekle ve Stoktan Düş
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
