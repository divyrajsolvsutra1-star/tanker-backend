import { exportToJSON, exportToCSV, generateHTMLTable, generateHTML_TrialBalance, generateHTML_ProfitAndLoss, generateHTML_BalanceSheet } from "../utils/export.js";

function httpError(status, message) { return Object.assign(new Error(message), { status }); }

export async function exportReport(req, res, next) {
  try {
    const { reportName, format = "json", data } = req.body;

    if (!reportName || !data) {
      throw httpError(400, "Report name and data are required");
    }

    if (!["json", "csv", "html", "print"].includes(format)) {
      throw httpError(400, "Invalid export format. Supported: json, csv, html, print");
    }

    let content, contentType, filename;

    if (format === "json") {
      const result = await exportToJSON(data, `${reportName}.json`);
      content = result.content;
      contentType = result.contentType;
      filename = result.filename;
    } else if (format === "csv") {
      const columns = req.body.columns || [];
      const result = await exportToCSV(data, columns);
      content = result.content;
      contentType = result.contentType;
      filename = result.filename;
    } else if (format === "html" || format === "print") {
      let htmlContent;

      if (reportName.includes("trial-balance")) {
        htmlContent = generateHTML_TrialBalance(data);
      } else if (reportName.includes("profit-loss")) {
        htmlContent = generateHTML_ProfitAndLoss(data);
      } else if (reportName.includes("balance-sheet")) {
        htmlContent = generateHTML_BalanceSheet(data);
      } else {
        const title = req.body.title || reportName;
        htmlContent = generateHTMLTable(title, Array.isArray(data) ? data : [data]);
      }

      content = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${reportName}</title></head><body>${htmlContent}${format === "print" ? "<script>window.onload=()=>window.print();</script>" : ""}</body></html>`;
      contentType = "text/html; charset=utf-8";
      filename = `${reportName}.html`;
    }

    if (format === "print") {
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    } else {
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    }

    res.send(content);
  } catch (error) { next(error); }
}

export async function listExportFormats(req, res, next) {
  try {
    res.json({
      formats: [
        {
          name: "JSON",
          value: "json",
          format: "json",
          description: "JSON format for data import/export",
          extension: ".json"
        },
        {
          name: "CSV",
          value: "csv",
          format: "csv",
          description: "Comma-separated values, compatible with Excel",
          extension: ".csv"
        },
        {
          name: "HTML",
          value: "html",
          format: "html",
          description: "HTML format for download and email",
          extension: ".html"
        },
        {
          name: "Print",
          value: "print",
          format: "print",
          description: "Print-friendly HTML format",
          extension: ".html"
        }
      ]
    });
  } catch (error) { next(error); }
}
