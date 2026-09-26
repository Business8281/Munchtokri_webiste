"use client";

// Export to CSV
export function exportToCSV(filename: string, headers: string[], rows: (string | number)[][]) {
    if (typeof window === 'undefined') return;

    const escapeField = (val: string | number) => {
        const str = String(val ?? '');
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };

    const csvContent = [
        headers.map(escapeField).join(','),
        ...rows.map(row => row.map(escapeField).join(','))
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// Export to Excel-compatible CSV with UTF-8 BOM
export function exportToExcel(filename: string, headers: string[], rows: (string | number)[][]) {
    if (typeof window === 'undefined') return;

    const escapeField = (val: string | number) => {
        const str = String(val ?? '');
        if (str.includes('\t') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };

    // Tab-delimited format works natively across all versions of Microsoft Excel
    const tsvContent = [
        headers.map(escapeField).join('\t'),
        ...rows.map(row => row.map(escapeField).join('\t'))
    ].join('\r\n');

    // Prepend UTF-8 BOM (\uFEFF) so Excel interprets UTF-8 special characters properly
    const blob = new Blob(['\uFEFF' + tsvContent], { type: 'text/tab-separated-values;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${filename}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// Export to PDF dynamically in browser runtime
export async function exportToPDF(
    title: string,
    subtitle: string,
    headers: string[],
    rows: (string | number)[][],
    filename: string
) {
    if (typeof window === 'undefined') return;

    try {
        const { jsPDF } = await import('jspdf');
        const autoTable = (await import('jspdf-autotable')).default;

        const doc = new jsPDF({
            orientation: 'landscape',
            unit: 'pt',
            format: 'a4'
        });

        // Brand Header (matching Munch Tokri Teal & Red brand)
        doc.setFillColor(0, 128, 128); // #008080 Teal
        doc.rect(0, 0, doc.internal.pageSize.getWidth(), 50, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('MUNCH TOKRI - E-COMMERCE BUSINESS ANALYTICS', 40, 32);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, doc.internal.pageSize.getWidth() - 200, 32);

        // Section Title & Subtitle
        doc.setTextColor(51, 51, 51);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(title, 40, 75);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(102, 102, 102);
        doc.text(subtitle, 40, 92);

        // Render Table
        autoTable(doc, {
            head: [headers],
            body: rows.map(r => r.map(c => String(c ?? ''))),
            startY: 110,
            theme: 'grid',
            headStyles: {
                fillColor: [0, 128, 128],
                textColor: [255, 255, 255],
                fontSize: 9,
                fontStyle: 'bold'
            },
            bodyStyles: {
                fontSize: 8.5,
                textColor: [51, 51, 51]
            },
            alternateRowStyles: {
                fillColor: [248, 250, 252]
            },
            margin: { left: 40, right: 40 }
        });

        doc.save(`${filename}.pdf`);
    } catch (err) {
        console.error('[PDF Export] Error:', err);
    }
}

