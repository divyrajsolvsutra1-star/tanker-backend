// Export utilities for different formats

export async function exportToJSON(data, filename = "export.json") {
  return {
    contentType: "application/json",
    filename,
    content: JSON.stringify(data, null, 2)
  };
}

export async function exportToCSV(data, columns = []) {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("Data must be a non-empty array");
  }

  if (columns.length === 0) {
    columns = Object.keys(data[0]);
  }

  // Header row
  const header = columns.map(col => `"${col}"`).join(",");

  // Data rows
  const rows = data.map(row =>
    columns.map(col => {
      const value = row[col] ?? "";
      const stringValue = typeof value === "object" ? JSON.stringify(value) : String(value);
      return `"${stringValue.replace(/"/g, '""')}"`;
    }).join(",")
  );

  const content = [header, ...rows].join("\n");

  return {
    contentType: "text/csv; charset=utf-8",
    filename: "export.csv",
    content
  };
}

export function formatCurrencyForExcel(value) {
  return typeof value === "number" ? value : 0;
}

export function formatDateForExcel(date) {
  if (!date) return "";
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// HTML table generation for printing
export function generateHTMLTable(title, data, columns = []) {
  if (!Array.isArray(data) || data.length === 0) {
    return "<p>No data available</p>";
  }

  if (columns.length === 0) {
    columns = Object.keys(data[0]);
  }

  const headerCells = columns.map(col => `<th>${col}</th>`).join("");
  const rows = data.map(row =>
    `<tr>${
      columns.map(col => {
        const value = row[col] ?? "";
        if (typeof value === "number") {
          return `<td class="number">${value.toFixed(2)}</td>`;
        }
        return `<td>${value}</td>`;
      }).join("")
    }</tr>`
  ).join("");

  const styles = `
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; }
      h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
      table { width: 100%; border-collapse: collapse; margin-top: 20px; }
      th { background-color: #4CAF50; color: white; padding: 12px; text-align: left; }
      td { padding: 10px; border-bottom: 1px solid #ddd; }
      tr:hover { background-color: #f5f5f5; }
      .number { text-align: right; }
      .footer { margin-top: 30px; text-align: center; color: #666; font-size: 12px; }
    </style>
  `;

  return `
    ${styles}
    <h1>${title}</h1>
    <table>
      <thead><tr>${headerCells}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="footer">Generated on ${new Date().toLocaleString()}</div>
  `;
}

export function generateHTMLStatement(title, fromDate, toDate, lines = []) {
  const headerCells = `
    <th>Date</th>
    <th>Particulars</th>
    <th>Debit</th>
    <th>Credit</th>
    <th>Balance</th>
  `;

  const rows = lines.map(line => `
    <tr>
      <td>${formatDateForExcel(line.date)}</td>
      <td>${line.particulars || line.narration || ""}</td>
      <td class="number">${(line.debit || 0).toFixed(2)}</td>
      <td class="number">${(line.credit || 0).toFixed(2)}</td>
      <td class="number"><strong>${(line.balance || 0).toFixed(2)}</strong></td>
    </tr>
  `).join("");

  const styles = `
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; }
      h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
      .info { margin-bottom: 20px; color: #666; }
      table { width: 100%; border-collapse: collapse; margin-top: 20px; }
      th { background-color: #4CAF50; color: white; padding: 12px; text-align: left; }
      td { padding: 10px; border-bottom: 1px solid #ddd; }
      tr:hover { background-color: #f5f5f5; }
      .number { text-align: right; }
      .footer { margin-top: 30px; text-align: center; color: #666; font-size: 12px; }
    </style>
  `;

  return `
    ${styles}
    <h1>${title}</h1>
    <div class="info">
      <p><strong>From:</strong> ${formatDateForExcel(fromDate)} | <strong>To:</strong> ${formatDateForExcel(toDate)}</p>
    </div>
    <table>
      <thead><tr>${headerCells}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="footer">Generated on ${new Date().toLocaleString()}</div>
  `;
}

export function generateHTML_TrialBalance(report) {
  const lines = report.lines.map(line => `
    <tr>
      <td>${line.code}</td>
      <td>${line.name}</td>
      <td class="number">${line.type}</td>
      <td class="number">${line.debit.toFixed(2)}</td>
      <td class="number">${line.credit.toFixed(2)}</td>
    </tr>
  `).join("");

  const styles = `
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; }
      h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
      .info { margin-bottom: 20px; color: #666; }
      table { width: 100%; border-collapse: collapse; margin-top: 20px; }
      th { background-color: #4CAF50; color: white; padding: 12px; text-align: left; }
      td { padding: 10px; border-bottom: 1px solid #ddd; }
      .number { text-align: right; }
      .total-row { font-weight: bold; background-color: #f0f0f0; border-top: 2px solid #333; }
      .footer { margin-top: 30px; text-align: center; color: #666; font-size: 12px; }
      .balanced { color: green; }
      .unbalanced { color: red; }
    </style>
  `;

  const balancedStatus = Math.abs(report.totalDebit - report.totalCredit) < 0.01
    ? `<p class="balanced">✓ Trial Balance is BALANCED</p>`
    : `<p class="unbalanced">✗ Trial Balance is NOT BALANCED - Difference: ${(report.totalDebit - report.totalCredit).toFixed(2)}</p>`;

  return `
    ${styles}
    <h1>Trial Balance</h1>
    ${balancedStatus}
    <table>
      <thead><tr>
        <th>Code</th>
        <th>Account Name</th>
        <th>Type</th>
        <th>Debit</th>
        <th>Credit</th>
      </tr></thead>
      <tbody>
        ${lines}
        <tr class="total-row">
          <td colspan="3">TOTAL</td>
          <td class="number">${report.totalDebit.toFixed(2)}</td>
          <td class="number">${report.totalCredit.toFixed(2)}</td>
        </tr>
      </tbody>
    </table>
    <div class="footer">Generated on ${new Date().toLocaleString()}</div>
  `;
}

export function generateHTML_ProfitAndLoss(report) {
  const incomeRows = report.incomes.map(acc => `
    <tr>
      <td>${acc.code}</td>
      <td>${acc.name}</td>
      <td class="number">${acc.amount.toFixed(2)}</td>
    </tr>
  `).join("");

  const expenseRows = report.expenses.map(acc => `
    <tr>
      <td>${acc.code}</td>
      <td>${acc.name}</td>
      <td class="number">${acc.amount.toFixed(2)}</td>
    </tr>
  `).join("");

  const styles = `
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; }
      h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
      h3 { margin-top: 30px; color: #555; }
      .info { margin-bottom: 20px; color: #666; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; }
      th { background-color: #4CAF50; color: white; padding: 12px; text-align: left; }
      td { padding: 10px; border-bottom: 1px solid #ddd; }
      .number { text-align: right; }
      .subtotal-row { font-weight: bold; background-color: #f0f0f0; border-top: 2px solid #333; }
      .total-row { font-weight: bold; background-color: #e0e0e0; border-top: 2px solid #000; border-bottom: 2px solid #000; font-size: 1.1em; }
      .footer { margin-top: 30px; text-align: center; color: #666; font-size: 12px; }
      .profit { color: green; }
      .loss { color: red; }
    </style>
  `;

  const netClass = report.netProfit >= 0 ? "profit" : "loss";
  const netLabel = report.netProfit >= 0 ? "NET PROFIT" : "NET LOSS";

  return `
    ${styles}
    <h1>Profit & Loss Statement</h1>
    <div class="info">
      <p><strong>From:</strong> ${formatDateForExcel(report.fromDate)} | <strong>To:</strong> ${formatDateForExcel(report.toDate)}</p>
    </div>

    <h3>INCOME</h3>
    <table>
      <thead><tr>
        <th>Code</th>
        <th>Account Name</th>
        <th>Amount</th>
      </tr></thead>
      <tbody>
        ${incomeRows}
        <tr class="subtotal-row">
          <td colspan="2">Total Income</td>
          <td class="number">${report.totalIncome.toFixed(2)}</td>
        </tr>
      </tbody>
    </table>

    <h3>EXPENSES</h3>
    <table>
      <thead><tr>
        <th>Code</th>
        <th>Account Name</th>
        <th>Amount</th>
      </tr></thead>
      <tbody>
        ${expenseRows}
        <tr class="subtotal-row">
          <td colspan="2">Total Expenses</td>
          <td class="number">${report.totalExpense.toFixed(2)}</td>
        </tr>
      </tbody>
    </table>

    <table style="margin-top: 20px;">
      <tbody>
        <tr class="total-row ${netClass}">
          <td colspan="2">${netLabel}</td>
          <td class="number">${Math.abs(report.netProfit).toFixed(2)}</td>
        </tr>
      </tbody>
    </table>

    <div class="footer">Generated on ${new Date().toLocaleString()}</div>
  `;
}

export function generateHTML_BalanceSheet(report) {
  const assetRows = report.assets.map(acc => `
    <tr>
      <td>${acc.code}</td>
      <td>${acc.name}</td>
      <td class="number">${acc.amount.toFixed(2)}</td>
    </tr>
  `).join("");

  const liabilityRows = report.liabilities.map(acc => `
    <tr>
      <td>${acc.code}</td>
      <td>${acc.name}</td>
      <td class="number">${acc.amount.toFixed(2)}</td>
    </tr>
  `).join("");

  const equityRows = report.equity.map(acc => `
    <tr>
      <td>${acc.code}</td>
      <td>${acc.name}</td>
      <td class="number">${acc.amount.toFixed(2)}</td>
    </tr>
  `).join("");

  const styles = `
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; }
      h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
      h3 { margin-top: 30px; color: #555; }
      .info { margin-bottom: 20px; color: #666; }
      .container { display: flex; gap: 40px; margin-top: 20px; }
      .section { flex: 1; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; }
      th { background-color: #4CAF50; color: white; padding: 12px; text-align: left; }
      td { padding: 10px; border-bottom: 1px solid #ddd; }
      .number { text-align: right; }
      .subtotal-row { font-weight: bold; background-color: #f0f0f0; border-top: 2px solid #333; }
      .footer { margin-top: 30px; text-align: center; color: #666; font-size: 12px; }
      .balanced { color: green; }
      .unbalanced { color: red; }
    </style>
  `;

  const balancedStatus = Math.abs(report.totalAssets - (report.totalLiabilities + report.totalEquity)) < 0.01
    ? `<p class="balanced">✓ Balance Sheet is BALANCED (Assets = Liabilities + Equity)</p>`
    : `<p class="unbalanced">✗ Balance Sheet is NOT BALANCED</p>`;

  return `
    ${styles}
    <h1>Balance Sheet</h1>
    <div class="info">
      <p><strong>As of:</strong> ${formatDateForExcel(report.asOfDate)}</p>
    </div>
    ${balancedStatus}

    <div class="container">
      <div class="section">
        <h3>ASSETS</h3>
        <table>
          <thead><tr>
            <th>Code</th>
            <th>Account Name</th>
            <th>Amount</th>
          </tr></thead>
          <tbody>
            ${assetRows}
            <tr class="subtotal-row">
              <td colspan="2">Total Assets</td>
              <td class="number">${report.totalAssets.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="section">
        <div>
          <h3>LIABILITIES</h3>
          <table>
            <thead><tr>
              <th>Code</th>
              <th>Account Name</th>
              <th>Amount</th>
            </tr></thead>
            <tbody>
              ${liabilityRows}
              <tr class="subtotal-row">
                <td colspan="2">Total Liabilities</td>
                <td class="number">${report.totalLiabilities.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style="margin-top: 30px;">
          <h3>EQUITY</h3>
          <table>
            <thead><tr>
              <th>Code</th>
              <th>Account Name</th>
              <th>Amount</th>
            </tr></thead>
            <tbody>
              ${equityRows}
              <tr class="subtotal-row">
                <td colspan="2">Total Equity</td>
                <td class="number">${report.totalEquity.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="footer">Generated on ${new Date().toLocaleString()}</div>
  `;
}
