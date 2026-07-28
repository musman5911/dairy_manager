const { Cow, Milk, Expense, Rate, Health, Sale, DailyLog } = require('../db');

async function buildSummaryData(dateStr) {
  const [cows, milkToday, expensesToday, rate, healthAll, salesToday, log] = await Promise.all([
    Cow.find(),
    Milk.find({ date: dateStr }),
    Expense.find({ date: dateStr }),
    Rate.findById('1'),
    Health.find({ nextDueDate: { $exists: true, $ne: '' } }),
    Sale.find({ date: dateStr }),
    DailyLog.findById(dateStr),
  ]);

  const totalMilk = milkToday.reduce((a, m) => a + Math.max(0, (m.morning || 0) + (m.evening || 0) - (m.calfMilk || 0)), 0);
  const currentRate = rate?.value || 0;
  const milkRevenue = totalMilk * currentRate;
  const totalExpenses = expensesToday.reduce((a, e) => a + (e.amount || 0), 0);
  const saleIncome = salesToday.reduce((a, s) => a + (s.salePrice || 0), 0);
  const netToday = milkRevenue + saleIncome - totalExpenses;

  const activeCows = cows.filter(c => c.status === 'active').length;

  // Health items due today or overdue
  const dueOrOverdue = healthAll.filter(h => h.nextDueDate && h.nextDueDate <= dateStr);

  const checklist = log?.checklist || [];
  const checklistDone = checklist.filter(i => i.done).length;
  const notes = log?.notes || '';

  return {
    date: dateStr,
    totalCows: cows.length,
    activeCows,
    totalMilk,
    milkRevenue,
    totalExpenses,
    saleIncome,
    netToday,
    dueOrOverdue,
    checklist,
    checklistDone,
    notes,
    salesToday,
    cows,
  };
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function renderSummaryHtml(data) {
  const cowNameById = Object.fromEntries(data.cows.map(c => [c._id, c.name]));

  const healthRows = data.dueOrOverdue.length
    ? data.dueOrOverdue.map(h =>
        `<li>${escapeHtml(cowNameById[h.cowId] || 'Unknown')} — ${escapeHtml(h.type)}: ${escapeHtml(h.description)} (due ${escapeHtml(h.nextDueDate)})</li>`
      ).join('')
    : '<li style="color:#94a3b8">Nothing due</li>';

  const salesRows = data.salesToday.length
    ? data.salesToday.map(s =>
        `<li>${escapeHtml(cowNameById[s.cowId] || 'Unknown')} sold for ₨${s.salePrice.toLocaleString()}${s.buyer ? ` to ${escapeHtml(s.buyer)}` : ''}</li>`
      ).join('')
    : '<li style="color:#94a3b8">No animals sold today</li>';

  const checklistRows = data.checklist.length
    ? data.checklist.map(i =>
        `<li style="${i.done ? 'color:#0d9488' : 'color:#94a3b8'}">${i.done ? '✅' : '⬜'} ${escapeHtml(i.text)}</li>`
      ).join('')
    : '<li style="color:#94a3b8">No checklist recorded for today</li>';

  return `
  <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 560px; margin: 0 auto; color:#1e293b;">
    <div style="background:#0d9488; padding:20px 24px; border-radius:12px 12px 0 0;">
      <h1 style="color:#fff; font-size:18px; margin:0;">🐄 Usman Dairy Farm — Daily Summary</h1>
      <p style="color:#ccfbf1; font-size:13px; margin:4px 0 0;">${escapeHtml(data.date)}</p>
    </div>
    <div style="border:1px solid #e2e8f0; border-top:none; border-radius:0 0 12px 12px; padding:24px;">

      <table style="width:100%; border-collapse:collapse; margin-bottom:20px;">
        <tr>
          <td style="padding:10px; background:#f8fafc; border-radius:8px;">
            <div style="font-size:11px; color:#64748b;">TOTAL COWS</div>
            <div style="font-size:20px; font-weight:700;">${data.totalCows} <span style="font-size:12px; font-weight:400; color:#64748b;">(${data.activeCows} active)</span></div>
          </td>
        </tr>
      </table>

      <table style="width:100%; border-collapse:collapse; margin-bottom:20px;">
        <tr>
          <td style="padding:10px 14px 10px 0; width:50%;">
            <div style="font-size:11px; color:#64748b;">MILK TODAY</div>
            <div style="font-size:18px; font-weight:700;">${data.totalMilk.toFixed(1)} L</div>
          </td>
          <td style="padding:10px 0 10px 14px; width:50%;">
            <div style="font-size:11px; color:#64748b;">MILK REVENUE</div>
            <div style="font-size:18px; font-weight:700; color:#0d9488;">₨${data.milkRevenue.toLocaleString()}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:10px 14px 10px 0;">
            <div style="font-size:11px; color:#64748b;">EXPENSES TODAY</div>
            <div style="font-size:18px; font-weight:700; color:#ef4444;">₨${data.totalExpenses.toLocaleString()}</div>
          </td>
          <td style="padding:10px 0 10px 14px;">
            <div style="font-size:11px; color:#64748b;">NET TODAY</div>
            <div style="font-size:18px; font-weight:700; color:${data.netToday >= 0 ? '#0d9488' : '#ef4444'};">₨${data.netToday.toLocaleString()}</div>
          </td>
        </tr>
      </table>

      <h3 style="font-size:14px; margin:20px 0 8px;">📋 Checklist (${data.checklistDone}/${data.checklist.length} done)</h3>
      <ul style="margin:0; padding-left:20px; font-size:13px;">${checklistRows}</ul>

      <h3 style="font-size:14px; margin:20px 0 8px;">💊 Health — due or overdue</h3>
      <ul style="margin:0; padding-left:20px; font-size:13px;">${healthRows}</ul>

      <h3 style="font-size:14px; margin:20px 0 8px;">💰 Animal Sales Today</h3>
      <ul style="margin:0; padding-left:20px; font-size:13px;">${salesRows}</ul>

      ${data.notes ? `
      <h3 style="font-size:14px; margin:20px 0 8px;">📝 Notes</h3>
      <p style="font-size:13px; color:#475569; white-space:pre-wrap; background:#f8fafc; padding:10px 12px; border-radius:8px;">${escapeHtml(data.notes)}</p>
      ` : ''}

      <p style="font-size:11px; color:#94a3b8; margin-top:24px; border-top:1px solid #f1f5f9; padding-top:12px;">
        Sent automatically by Usman Dairy Farm Management System.
      </p>
    </div>
  </div>`;
}

module.exports = { buildSummaryData, renderSummaryHtml };
