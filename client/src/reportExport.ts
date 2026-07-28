import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Cow, MilkEntry, Expense, Sale, HealthRecord, RateHistory } from './types';
import { fmt, fmtPKR, fmtL, monthLabel } from './utils/format';
import { calcRevenueWithHistory } from './utils/rates';
import { todayStr, shiftDate } from './utils/date';

type Color = [number, number, number];
const TEAL: Color = [13, 148, 136];
const DARK: Color = [30, 41, 59];
const GRAY: Color = [148, 163, 184];
const PURPLE: Color = [168, 85, 247];
const RED: Color = [239, 68, 68];
const GREEN: Color = [13, 148, 136];

interface ReportCtx {
  month: string;
  rangeLabel?: string;
  rangeDays?: number;
  cows: Cow[];
  milkEntries: MilkEntry[];
  expenses: Expense[];
  sales: Sale[];
  rate: number;
  rateHistory?: RateHistory[];
  rateDate?: string;
  costPerAnimal: (Cow & { milkL: number; revenue: number; expenses: number; saleIncome: number; net: number })[];
}

/** Filter records by rangeDays relative to today */
function filterByRange<T extends { date: string }>(records: T[], days?: number): T[] {
  if (!days) return records;
  const cutoffStr = shiftDate(todayStr(), -days);
  return records.filter(r => r.date >= cutoffStr);
}

function rangeLabel(days?: number): string {
  if (!days) return '';
  const labels: Record<number, string> = { 1: 'Last 1 Day', 7: 'Last 7 Days', 30: 'Last 1 Month', 90: 'Last 3 Months', 180: 'Last 6 Months', 365: 'Last 1 Year' };
  return labels[days] || `Last ${days} Days`;
}

// ── Helper ─────────────────────────────────────────────────────
function header(doc: jsPDF, title: string, subtitle: string) {
  doc.setFillColor(...TEAL);
  doc.roundedRect(10, 10, 190, 24, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text('Usman Dairy Farm', 15, 22);
  doc.setFontSize(10);
  doc.text(title, 15, 30);
  doc.setFontSize(7);
  doc.text(subtitle, 150, 22);
  return 40;
}

function footer(doc: jsPDF, label: string) {
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 282, 210, 15, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.line(10, 282, 200, 282);
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text(`Usman Dairy Farm — ${label}`, 14, 288);
    doc.text(`Page ${i}/${n}`, 185, 288);
  }
}

function sectionTitle(doc: jsPDF, y: number, title: string): number {
  doc.setTextColor(...DARK);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, y);
  doc.setFont('helvetica', 'normal');
  return y + 6;
}

function checkPage(doc: jsPDF, y: number, needed = 40): number {
  if (y > 280 - needed) { doc.addPage(); return 15; }
  return y;
}

// ═══════════════════════════════════════════════════════════════
// 1. MILK REPORT
// ═══════════════════════════════════════════════════════════════
export function generateMilkReport(data: ReportCtx) {
  const doc = new jsPDF();
  const rLabel = data.rangeLabel || monthLabel(data.month);
  const rate = data.rate;
  const rDays = data.rangeDays;

  // Filter milk by range
  const milk = filterByRange(data.milkEntries, rDays);

  let y = header(doc, `Milk Report — ${rLabel}`, `Rate: ${fmtPKR(rate)}/L | ${milk.length} records`);

  const totalL = milk.reduce((a, m) => a + (m.morning || 0) + (m.evening || 0), 0);
  const calfL = milk.reduce((a, m) => a + (m.calfMilk || 0), 0);
  const revenue = calcRevenueWithHistory(milk, data.rateHistory || [], rate, data.rateDate || '');
  const days = new Set(milk.map(m => m.date)).size;

  // Summary
  y = sectionTitle(doc, y, 'Summary');
  autoTable(doc, {
    startY: y,
    head: [['Total Milk', 'Calf Milk', 'Saleable', 'Revenue', 'Days Recorded']],
    body: [[fmtL(totalL), fmtL(calfL), fmtL(Math.max(0, totalL - calfL)), fmtPKR(revenue), String(days)]],
    theme: 'grid',
    headStyles: { fillColor: TEAL, fontSize: 9 },
    bodyStyles: { fontSize: 10, halign: 'center' },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // By Cow
  y = checkPage(doc, y, 60);
  y = sectionTitle(doc, y, 'Production by Cow');

  const cowMap: Record<string, { m: number; e: number; calf: number; days: number }> = {};
  milk.forEach(rec => {
    if (!cowMap[rec.cowId]) cowMap[rec.cowId] = { m: 0, e: 0, calf: 0, days: 0 };
    cowMap[rec.cowId].m += rec.morning || 0;
    cowMap[rec.cowId].e += rec.evening || 0;
    cowMap[rec.cowId].calf += rec.calfMilk || 0;
    cowMap[rec.cowId].days++;
  });

  const cowRows = Object.entries(cowMap).map(([cowId, d]) => {
    const cow = data.cows.find(c => c._id === cowId);
    return [cow?.name || cowId, cow?.breed || '-', String(d.days), fmt(d.m + d.e), d.calf > 0 ? fmt(d.calf) : '-', fmt(Math.max(0, d.m + d.e - d.calf)), d.days > 0 ? fmt((d.m + d.e) / d.days) : '0'];
  }).sort((a, b) => parseFloat(b[3]) - parseFloat(a[3]));

  autoTable(doc, {
    startY: y,
    head: [['Cow', 'Breed', 'Days', 'Total (L)', 'Calf (L)', 'Saleable (L)', 'Avg/Day']],
    body: cowRows.length ? cowRows : [['No data', '', '', '', '', '', '']],
    theme: 'striped',
    headStyles: { fillColor: TEAL, fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // Daily Detail
  y = checkPage(doc, y, 40);
  y = sectionTitle(doc, y, 'Daily Records');

  const dailyRows = milk
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(m => {
      const cow = data.cows.find(c => c._id === m.cowId);
      const total = (m.morning || 0) + (m.evening || 0);
      return [m.date, cow?.name || m.cowId, fmt(m.morning), fmt(m.evening), m.calfMilk ? fmt(m.calfMilk) : '-', fmt(total)];
    });

  autoTable(doc, {
    startY: y,
    head: [['Date', 'Cow', 'Morning', 'Evening', 'Calf', 'Total']],
    body: dailyRows.length ? dailyRows : [['No records', '', '', '', '', '']],
    theme: 'striped',
    headStyles: { fillColor: TEAL, fontSize: 8 },
    bodyStyles: { fontSize: 7 },
    margin: { left: 14, right: 14 },
  });

  footer(doc, `Milk Report — ${rLabel}`);
  doc.save(`milk-report-${rLabel.replace(/\s+/g, '-').toLowerCase()}.pdf`);
}

// ═══════════════════════════════════════════════════════════════
// 2. EXPENSE REPORT
// ═══════════════════════════════════════════════════════════════
export function generateExpenseReport(data: ReportCtx) {
  const doc = new jsPDF();
  const rLabel = data.rangeLabel || monthLabel(data.month);
  const rDays = data.rangeDays;

  // Filter expenses by range
  const exp = filterByRange(data.expenses, rDays);
  const total = exp.reduce((a, e) => a + (e.amount || 0), 0);

  let y = header(doc, `Expense Report — ${rLabel}`, `${exp.length} records | Total: ${fmtPKR(total)}`);

  // By Type
  y = sectionTitle(doc, y, 'Breakdown by Category');
  const byType: Record<string, number> = {};
  exp.forEach(e => { byType[e.type] = (byType[e.type] || 0) + (e.amount || 0); });

  const typeRows = Object.entries(byType)
    .sort((a, b) => b[1] - a[1])
    .map(([type, amount]) => [
      type === 'purchasing' ? 'Animal Purchase' : type.charAt(0).toUpperCase() + type.slice(1),
      fmtPKR(amount),
      total > 0 ? `${fmt((amount / total) * 100, 1)}%` : '0%',
    ]);

  autoTable(doc, {
    startY: y,
    head: [['Category', 'Amount', '% of Total']],
    body: typeRows.length ? typeRows : [['No expenses', '', '']],
    theme: 'grid',
    headStyles: { fillColor: TEAL, fontSize: 9 },
    bodyStyles: { fontSize: 10 },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // By Cow
  y = checkPage(doc, y, 50);
  y = sectionTitle(doc, y, 'Expenses by Cow');

  const cowExpMap: Record<string, number> = {};
  const farmWide = exp.filter(e => !e.cowId).reduce((a, e) => a + (e.amount || 0), 0);
  exp.filter(e => e.cowId).forEach(e => { cowExpMap[e.cowId!] = (cowExpMap[e.cowId!] || 0) + (e.amount || 0); });

  const cowRows = Object.entries(cowExpMap)
    .sort((a, b) => b[1] - a[1])
    .map(([cowId, amount]) => {
      const cow = data.cows.find(c => c._id === cowId);
      return [cow?.name || cowId, cow?.breed || '-', fmtPKR(amount)];
    });

  if (farmWide > 0) cowRows.push(['Farm-wide (unassigned)', '-', fmtPKR(farmWide)]);

  autoTable(doc, {
    startY: y,
    head: [['Cow', 'Breed', 'Total Expenses']],
    body: cowRows.length ? cowRows : [['No data', '', '']],
    theme: 'striped',
    headStyles: { fillColor: TEAL, fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // Detail
  y = checkPage(doc, y, 40);
  y = sectionTitle(doc, y, 'Expense Details');

  const detailRows = exp
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(e => {
      const cow = e.cowId ? data.cows.find(c => c._id === e.cowId) : null;
      return [e.date, e.type === 'purchasing' ? 'Animal Purchase' : e.type, cow?.name || 'Farm-wide', fmtPKR(e.amount), e.note || '-'];
    });

  autoTable(doc, {
    startY: y,
    head: [['Date', 'Type', 'Cow', 'Amount', 'Note']],
    body: detailRows.length ? detailRows : [['No records', '', '', '', '']],
    theme: 'striped',
    headStyles: { fillColor: TEAL, fontSize: 8 },
    bodyStyles: { fontSize: 7 },
    margin: { left: 14, right: 14 },
  });

  footer(doc, `Expense Report — ${rLabel}`);
  doc.save(`expense-report-${rLabel.replace(/\s+/g, '-').toLowerCase()}.pdf`);
}

// ═══════════════════════════════════════════════════════════════
// 3. MONTHLY SUMMARY
// ═══════════════════════════════════════════════════════════════
export function generateSummaryReport(data: ReportCtx & {
  stats: {
    milkL: number; calfMilk: number; milkRevenue: number;
    saleIncome: number; totalExp: number; operatingProfit: number;
    totalProfit: number; expByType: Record<string, number>;
  };
}) {
  const doc = new jsPDF();
  const rLabel = data.rangeLabel || monthLabel(data.month);
  const rDays = data.rangeDays;

  // Filter all data by range for accurate totals
  const milk = filterByRange(data.milkEntries, rDays);
  const exp = filterByRange(data.expenses, rDays);
  const salesList = filterByRange(data.sales, rDays);

  const filteredMilkL = milk.reduce((a, m) => a + (m.morning || 0) + (m.evening || 0), 0);
  const filteredRevenue = calcRevenueWithHistory(milk, data.rateHistory || [], data.rate, data.rateDate || '');
  const filteredTotalExp = exp.reduce((a, e) => a + (e.amount || 0), 0);
  const filteredSaleIncome = salesList.reduce((a, s) => a + (s.salePrice || 0), 0);
  const filteredOpProfit = filteredRevenue - filteredTotalExp;
  const filteredTotalProfit = filteredOpProfit + filteredSaleIncome;

  const filteredExpByType: Record<string, number> = {};
  exp.forEach(e => { filteredExpByType[e.type] = (filteredExpByType[e.type] || 0) + (e.amount || 0); });

  let y = header(doc, `Monthly Summary — ${rLabel}`, `Rate: ${fmtPKR(data.rate)}/L | ${milk.length} milk, ${exp.length} expenses`);

  // Financial Summary
  y = sectionTitle(doc, y, 'Financial Summary');
  autoTable(doc, {
    startY: y,
    head: [[
      { content: 'Milk', styles: { halign: 'center' } },
      { content: 'Milk Revenue', styles: { halign: 'center' } },
      { content: 'Expenses', styles: { halign: 'center' } },
      { content: 'Operating Profit', styles: { halign: 'center' } },
    ]],
    body: [[
      { content: fmtL(filteredMilkL), styles: { halign: 'center' } },
      { content: fmtPKR(filteredRevenue), styles: { halign: 'center' } },
      { content: fmtPKR(filteredTotalExp), styles: { halign: 'center' } },
      { content: fmtPKR(filteredOpProfit), styles: { halign: 'center', fontStyle: 'bold', textColor: filteredOpProfit >= 0 ? GREEN : RED } },
    ]],
    theme: 'grid',
    headStyles: { fillColor: TEAL, fontSize: 9 },
    bodyStyles: { fontSize: 10 },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 3;

  if (filteredSaleIncome > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Animal Sales', 'Total Profit']],
      body: [[fmtPKR(filteredSaleIncome), fmtPKR(filteredTotalProfit)]],
      theme: 'grid',
      headStyles: { fillColor: PURPLE, fontSize: 9 },
      bodyStyles: { fontSize: 10, halign: 'center' },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // Expense Breakdown
  y = checkPage(doc, y, 50);
  y = sectionTitle(doc, y, 'Expense Breakdown');
  const expRows = Object.entries(filteredExpByType).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
    .map(([t, a]) => [
      t === 'purchasing' ? 'Animal Purchase' : t.charAt(0).toUpperCase() + t.slice(1),
      fmtPKR(a),
      filteredTotalExp > 0 ? `${fmt((a / filteredTotalExp) * 100, 1)}%` : '0%',
    ]);

  autoTable(doc, {
    startY: y,
    head: [['Category', 'Amount', '%']],
    body: expRows.length ? expRows : [['No expenses', '', '']],
    theme: 'striped',
    headStyles: { fillColor: TEAL, fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // Cow-wise (use filtered data)
  y = checkPage(doc, y, 50);
  y = sectionTitle(doc, y, 'Cow-wise Performance');

  const cowMilkByRange: Record<string, number> = {};
  const cowExpByRange: Record<string, number> = {};
  const cowPurchaseByRange: Record<string, number> = {};
  const cowSalesByRange: Record<string, number> = {};

  milk.forEach(m => { cowMilkByRange[m.cowId] = (cowMilkByRange[m.cowId] || 0) + (m.morning || 0) + (m.evening || 0); });
  exp.filter(e => e.type !== 'purchasing').forEach(e => { if (e.cowId) cowExpByRange[e.cowId] = (cowExpByRange[e.cowId] || 0) + (e.amount || 0); });
  exp.filter(e => e.type === 'purchasing').forEach(e => { if (e.cowId) cowPurchaseByRange[e.cowId] = (cowPurchaseByRange[e.cowId] || 0) + (e.amount || 0); });
  salesList.forEach(s => { cowSalesByRange[s.cowId] = (cowSalesByRange[s.cowId] || 0) + (s.salePrice || 0); });

  const allCowIds = new Set([...Object.keys(cowMilkByRange), ...Object.keys(cowExpByRange), ...Object.keys(cowPurchaseByRange), ...Object.keys(cowSalesByRange)]);

  const cowRows = Array.from(allCowIds).map(cowId => {
    const cow = data.cows.find(c => c._id === cowId);
    const mL = cowMilkByRange[cowId] || 0;
    const revenue = calcRevenueWithHistory(milk.filter(m => m.cowId === cowId), data.rateHistory || [], data.rate, data.rateDate || '');
    const expAmt = cowExpByRange[cowId] || 0;
    const purchase = cowPurchaseByRange[cowId] || 0;
    const sale = cowSalesByRange[cowId] || 0;
    const net = revenue + sale - expAmt - purchase;
    return [cow?.name || cowId, cow?.breed || '-', fmt(mL), fmtPKR(revenue), purchase > 0 ? fmtPKR(purchase) : '-', fmtPKR(expAmt), sale > 0 ? fmtPKR(sale) : '-', fmtPKR(net)];
  }).sort((a, b) => parseFloat(b[7].replace(/[₨,\s]/g, '')) - parseFloat(a[7].replace(/[₨,\s]/g, '')));

  autoTable(doc, {
    startY: y,
    head: [['Cow', 'Breed', 'Milk (L)', 'Revenue', 'Purchase', 'Expenses', 'Sales', 'Net']],
    body: cowRows.length ? cowRows : [['No data', '', '', '', '', '', '', '']],
    theme: 'striped',
    headStyles: { fillColor: TEAL, fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    margin: { left: 14, right: 14 },
  });

  footer(doc, `Monthly Summary — ${rLabel}`);
  doc.save(`monthly-summary-${rLabel.replace(/\s+/g, '-').toLowerCase()}.pdf`);
}

// ═══════════════════════════════════════════════════════════════
// 4. SINGLE COW REPORT
// ═══════════════════════════════════════════════════════════════
export function generateCowReport(cowId: string, _rate: number, _rateHistory: RateHistory[], _rateDate: string, days = 30) {
  import('./api').then(({ api }) => {
  api.getCowSummary(cowId).then((data: any) => {
    const doc = new jsPDF();
    const { cow, milk, expenses, health, offspring, mother } = data;
    const rLabel = rangeLabel(days);
    let y = header(doc, `Cow Report — ${cow.name}`, `${rLabel} | Generated: ${new Date().toLocaleDateString('en-PK')}`);

    // ── Cow Info ───────────────────────────────────────────
    y = sectionTitle(doc, y, 'Animal Information');
    autoTable(doc, {
      startY: y,
      head: [['Field', 'Value']],
      body: [
        ['Name', cow.name],
        ['Gender', cow.gender === 'male' ? '🐂 Bull' : '🐄 Cow'],
        ['Tag', `#${cow._id.slice(-6).toUpperCase()}`],
        ['Breed', cow.breed],
        ['Status', cow.status.charAt(0).toUpperCase() + cow.status.slice(1)],
        ['Birth Date', cow.birthDate || 'N/A'],
        ['Weight', cow.weight ? `${fmt(cow.weight)} kg` : 'N/A'],
        ['Lactation #', cow.gender !== 'male' ? String(cow.lactationNumber || 0) : 'N/A'],
        ['Batch', cow.batch || 'N/A'],
        ['Mother', mother ? mother.name : 'N/A'],
        ['Purchase Price', cow.purchasePrice ? fmtPKR(cow.purchasePrice) : 'N/A'],
        ['Calving Date', cow.calvingDate || 'N/A'],
        ['Pregnancy Date', cow.pregnancyDate || 'N/A'],
        ['Nursing Until', cow.nursingUntil || 'N/A'],
        ['Notes', cow.notes || '-'],
      ],
      theme: 'grid',
      headStyles: { fillColor: TEAL, fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    // ── Offspring ──────────────────────────────────────────
    if (offspring && offspring.length > 0) {
      y = checkPage(doc, y, 30);
      y = sectionTitle(doc, y, 'Offspring (Calves)');
      const calfRows = offspring.map((o: Cow) => [o.name, o.gender === 'male' ? 'Bull' : 'Cow', o.breed, o.birthDate || '-', o.status]);
      autoTable(doc, {
        startY: y,
        head: [['Calf Name', 'Gender', 'Breed', 'Birth Date', 'Status']],
        body: calfRows,
        theme: 'striped',
        headStyles: { fillColor: PURPLE, fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }

    // ── Calving History ────────────────────────────────────
    if (cow.calvingHistory && cow.calvingHistory.length > 0) {
      y = checkPage(doc, y, 30);
      y = sectionTitle(doc, y, 'Calving History');
      const calvRows = cow.calvingHistory.map((h: any) => [h.date, h.calfId || '-', h.notes || '-']);
      autoTable(doc, {
        startY: y,
        head: [['Date', 'Calf ID', 'Notes']],
        body: calvRows,
        theme: 'striped',
        headStyles: { fillColor: TEAL, fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }

    // ── Milk Production (filter by selected days) ──────────
    if (cow.gender !== 'male') {
      y = checkPage(doc, y, 50);
      // Filter milk records by the selected number of days
      const cutoffStr = shiftDate(todayStr(), -days);
      const filteredMilk = (milk.records30 || []).filter((m: MilkEntry) => m.date >= cutoffStr);
      const filteredMilkTotal = filteredMilk.reduce((a: number, m: MilkEntry) => a + (m.morning || 0) + (m.evening || 0), 0);

      y = sectionTitle(doc, y, `Milk Production (${rLabel}) — Total: ${fmtL(filteredMilkTotal)}`);

      const milkRows = filteredMilk
        .sort((a: MilkEntry, b: MilkEntry) => b.date.localeCompare(a.date))
        .map((m: MilkEntry) => {
          const total = (m.morning || 0) + (m.evening || 0);
          return [m.date, fmt(m.morning), fmt(m.evening), m.calfMilk ? fmt(m.calfMilk) : '-', fmt(total)];
        });

      autoTable(doc, {
        startY: y,
        head: [['Date', 'Morning (L)', 'Evening (L)', 'Calf (L)', 'Total (L)']],
        body: milkRows.length ? milkRows : [['No records', '', '', '', '']],
        theme: 'striped',
        headStyles: { fillColor: TEAL, fontSize: 8 },
        bodyStyles: { fontSize: 7 },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }

    // ── Expenses (filter by selected days) ─────────────────
    y = checkPage(doc, y, 50);
    const cutoffStr2 = shiftDate(todayStr(), -days);
    const filteredExp = (expenses.records30 || []).filter((e: Expense) => e.date >= cutoffStr2);
    const filteredExpTotal = filteredExp.reduce((a: number, e: Expense) => a + (e.amount || 0), 0);

    y = sectionTitle(doc, y, `Expenses (${rLabel}) — Total: ${fmtPKR(filteredExpTotal)}`);

    // By type
    const expByType: Record<string, number> = {};
    filteredExp.forEach((e: Expense) => { expByType[e.type] = (expByType[e.type] || 0) + (e.amount || 0); });
    const expTypeRows = Object.entries(expByType).filter(([, v]) => v > 0)
      .map(([t, a]) => [t === 'purchasing' ? 'Animal Purchase' : t.charAt(0).toUpperCase() + t.slice(1), fmtPKR(a)]);

    if (expTypeRows.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [['Category', 'Amount']],
        body: expTypeRows,
        theme: 'grid',
        headStyles: { fillColor: RED, fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 5;
    }

    const expDetailRows = filteredExp
      .sort((a: Expense, b: Expense) => b.date.localeCompare(a.date))
      .map((e: Expense) => [e.date, e.type === 'purchasing' ? 'Animal Purchase' : e.type, fmtPKR(e.amount), e.note || '-']);

    if (expDetailRows.length > 0) {
      y = checkPage(doc, y, 30);
      autoTable(doc, {
        startY: y,
        head: [['Date', 'Type', 'Amount', 'Note']],
        body: expDetailRows,
        theme: 'striped',
        headStyles: { fillColor: TEAL, fontSize: 8 },
        bodyStyles: { fontSize: 7 },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }

    // ── Health Records ─────────────────────────────────────
    y = checkPage(doc, y, 40);
    y = sectionTitle(doc, y, 'Health Records (Recent)');

    const healthRows = (health || [])
      .sort((a: HealthRecord, b: HealthRecord) => b.date.localeCompare(a.date))
      .map((h: HealthRecord) => [h.date, h.type, h.description, h.medicine || '-', h.vet || '-', h.cost ? fmtPKR(h.cost) : '-', h.nextDueDate || '-']);

    autoTable(doc, {
      startY: y,
      head: [['Date', 'Type', 'Description', 'Medicine', 'Vet', 'Cost', 'Next Due']],
      body: healthRows.length ? healthRows : [['No records', '', '', '', '', '', '']],
      theme: 'striped',
      headStyles: { fillColor: TEAL, fontSize: 8 },
      bodyStyles: { fontSize: 7 },
      margin: { left: 14, right: 14 },
    });

    footer(doc, `Cow Report — ${cow.name}`);
    doc.save(`cow-report-${cow.name.toLowerCase().replace(/\s+/g, '-')}.pdf`);
  });
  }); // end import
}
