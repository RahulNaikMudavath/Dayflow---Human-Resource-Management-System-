import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { addDays, format } from "date-fns";
import {
  ATTENDANCE_META,
  formatTime,
  netPay,
  workHours,
  type AttendanceRow,
  type AttendanceStatus,
  type SalaryStructure,
} from "@/lib/dayflow";

/* ------------------------------------------------------------------ */
/* Daybreak Editorial palette (RGB)                                    */
/* ------------------------------------------------------------------ */
const ESPRESSO: [number, number, number] = [43, 33, 24];
const AMBER: [number, number, number] = [194, 87, 27];
const CREAM: [number, number, number] = [247, 242, 232];
const PAPER: [number, number, number] = [252, 249, 243];
const INK: [number, number, number] = [56, 44, 33];
const MUTED: [number, number, number] = [120, 104, 88];
const FAINT: [number, number, number] = [214, 199, 178];
const BORDER: [number, number, number] = [227, 218, 202];

const STATUS_COLORS: Record<AttendanceStatus, [number, number, number]> = {
  present: [62, 142, 90],
  absent: [194, 64, 46],
  half_day: [190, 135, 40],
  leave: [124, 92, 191],
};

export interface PdfProfile {
  full_name: string;
  employee_id: string | null;
  department: string | null;
  designation: string | null;
}

/** jsPDF's built-in fonts lack the ₹ glyph — use "Rs" with Indian grouping. */
function inr(n: number) {
  return `Rs ${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n)}`;
}

function slug(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function header(doc: jsPDF, title: string, rightLine1: string) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(...ESPRESSO);
  doc.rect(0, 0, w, 30, "F");

  // Sunrise mark
  doc.setFillColor(...AMBER);
  doc.circle(17, 15, 4.5, "F");
  doc.setFillColor(...ESPRESSO);
  doc.rect(12.5, 15, 9, 4.5, "F");
  doc.setDrawColor(...AMBER);
  doc.setLineWidth(0.6);
  doc.line(11, 18.5, 23, 18.5);

  doc.setTextColor(...CREAM);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text("Dayflow", 26, 17);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...FAINT);
  doc.text(title.toUpperCase(), 26, 23.5);

  doc.setFontSize(9.5);
  doc.setTextColor(...CREAM);
  doc.text(rightLine1, w - 14, 13.5, { align: "right" });
  doc.setFontSize(8);
  doc.setTextColor(...FAINT);
  doc.text(`Generated ${format(new Date(), "dd MMM yyyy, hh:mm a")}`, w - 14, 19.5, {
    align: "right",
  });
  doc.setTextColor(232, 164, 110);
  doc.text("dayflow.io", w - 14, 25, { align: "right" });
}

function employeeBlock(doc: jsPDF, p: PdfProfile, y: number, rightNote: string) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(...CREAM);
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.roundedRect(14, y, w - 28, 22, 2.5, 2.5, "FD");

  const initials = p.full_name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
  doc.setFillColor(...AMBER);
  doc.circle(24, y + 11, 6, "F");
  doc.setTextColor(255, 250, 240);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(initials, 24, y + 12.6, { align: "center" });

  doc.setTextColor(...INK);
  doc.setFontSize(13);
  doc.text(p.full_name, 34, y + 9.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(`${p.employee_id}  ·  ${p.designation ?? "—"}  ·  ${p.department ?? "—"}`, 34, y + 16);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...AMBER);
  doc.text(rightNote, w - 21, y + 13.5, { align: "right" });
}

function footer(doc: jsPDF, note: string) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.line(14, h - 16, w - 14, h - 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(note, 14, h - 10.5);
  doc.text("Dayflow HRMS · Confidential — internal use only", w - 14, h - 10.5, {
    align: "right",
  });
}

function lastTableY(doc: jsPDF, fallback: number) {
  return (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? fallback;
}

/** Explicit blob-anchor download — more reliable than jsPDF's FileSaver path. */
function savePdf(doc: jsPDF, filename: string) {
  const url = URL.createObjectURL(doc.output("blob"));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/* ------------------------------------------------------------------ */
/* Weekly attendance report                                            */
/* ------------------------------------------------------------------ */
export function exportWeeklyAttendancePdf(opts: {
  profile: PdfProfile;
  weekStart: Date;
  rows: AttendanceRow[];
}) {
  const { profile, weekStart, rows } = opts;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const weekEnd = addDays(weekStart, 6);
  const range = `${format(weekStart, "dd MMM")} - ${format(weekEnd, "dd MMM yyyy")}`;

  header(doc, "Weekly attendance report", range);

  const totalHours =
    Math.round(rows.reduce((s, r) => s + (workHours(r.check_in, r.check_out) ?? 0), 0) * 10) / 10;
  employeeBlock(doc, profile, 38, `${totalHours}h logged this week`);

  const byDate = new Map(rows.map((r) => [r.date, r]));
  interface DayRow {
    cells: string[];
    status: AttendanceStatus | null;
    off: boolean;
  }
  const days: DayRow[] = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i);
    const key = format(d, "yyyy-MM-dd");
    const r = byDate.get(key);
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    const hours = r ? workHours(r.check_in, r.check_out) : null;
    return {
      cells: [
        format(d, "EEEE"),
        format(d, "dd MMM yyyy"),
        r ? ATTENDANCE_META[r.status].label : isWeekend ? "Weekend" : "No record",
        formatTime(r?.check_in ?? null),
        formatTime(r?.check_out ?? null),
        hours != null ? `${hours}h` : "-",
      ],
      status: r?.status ?? null,
      off: isWeekend && !r,
    };
  });

  autoTable(doc, {
    startY: 66,
    head: [["Day", "Date", "Status", "Check-in", "Check-out", "Hours"]],
    body: days.map((d) => d.cells),
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 10,
      cellPadding: 3.4,
      textColor: INK,
      lineColor: BORDER,
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: ESPRESSO,
      textColor: CREAM,
      fontStyle: "bold",
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: PAPER },
    columnStyles: {
      5: { halign: "right", fontStyle: "bold" },
    },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const day = days[data.row.index];
      if (data.column.index === 2) {
        if (day?.status) {
          data.cell.styles.textColor = STATUS_COLORS[day.status];
          data.cell.styles.fontStyle = "bold";
        } else {
          data.cell.styles.textColor = MUTED;
          data.cell.styles.fontStyle = "italic";
        }
      }
      if (day?.off) {
        data.cell.styles.textColor = MUTED;
      }
    },
  });

  // Summary band
  const y = lastTableY(doc, 120) + 8;
  const counts: Record<AttendanceStatus, number> = {
    present: 0,
    absent: 0,
    half_day: 0,
    leave: 0,
  };
  rows.forEach((r) => {
    counts[r.status] += 1;
  });
  doc.setFillColor(...CREAM);
  doc.setDrawColor(...BORDER);
  doc.roundedRect(14, y, w - 28, 15, 2.5, 2.5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.text(
    `Present ${counts.present}   ·   Half day ${counts.half_day}   ·   On leave ${counts.leave}   ·   Absent ${counts.absent}`,
    21,
    y + 9.5,
  );
  doc.setTextColor(...AMBER);
  doc.text(`Total ${totalHours}h`, w - 21, y + 9.5, { align: "right" });

  footer(
    doc,
    `Attendance for ${profile.full_name} (${profile.employee_id ?? "—"}) · Week of ${format(weekStart, "dd MMM yyyy")}`,
  );
  savePdf(
    doc,
    `dayflow-attendance-${slug(profile.employee_id ?? "emp")}-${format(weekStart, "yyyy-MM-dd")}.pdf`,
  );
}

/* ------------------------------------------------------------------ */
/* Payroll summary                                                     */
/* ------------------------------------------------------------------ */
export function exportPayrollPdf(opts: { profile: PdfProfile; salary: SalaryStructure }) {
  const { profile, salary } = opts;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();

  const gross = salary.basic + salary.hra + salary.allowances;
  const net = netPay(salary);
  const effective = format(new Date(salary.effective_from), "dd MMM yyyy");

  header(doc, "Salary summary", format(new Date(), "MMMM yyyy"));
  employeeBlock(doc, profile, 38, `Effective from ${effective}`);

  // Net pay hero band
  doc.setFillColor(...ESPRESSO);
  doc.roundedRect(14, 66, w - 28, 26, 2.5, 2.5, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...FAINT);
  doc.text("NET MONTHLY TAKE-HOME", 22, 75);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(21);
  doc.setTextColor(255, 250, 240);
  doc.text(inr(net), 22, 86);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...FAINT);
  doc.text(`Gross ${inr(gross)} - deductions ${inr(salary.deductions)}`, w - 22, 78, {
    align: "right",
  });
  doc.setTextColor(...AMBER);
  doc.setFont("helvetica", "bold");
  doc.text(`Annual gross ${inr(gross * 12)}`, w - 22, 85, { align: "right" });

  autoTable(doc, {
    startY: 100,
    head: [["Component", "Monthly", "Annual"]],
    body: [
      ["Basic", inr(salary.basic), inr(salary.basic * 12)],
      ["House rent allowance (HRA)", inr(salary.hra), inr(salary.hra * 12)],
      ["Allowances", inr(salary.allowances), inr(salary.allowances * 12)],
      [
        "Deductions (PF, professional tax)",
        `- ${inr(salary.deductions)}`,
        `- ${inr(salary.deductions * 12)}`,
      ],
      ["Gross pay", inr(gross), inr(gross * 12)],
      ["Net take-home", inr(net), inr(net * 12)],
    ],
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 10,
      cellPadding: 3.4,
      textColor: INK,
      lineColor: BORDER,
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: ESPRESSO,
      textColor: CREAM,
      fontStyle: "bold",
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: PAPER },
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "right" },
    },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      if (data.row.index === 3) {
        data.cell.styles.textColor = [194, 64, 46];
      }
      if (data.row.index === 4) {
        data.cell.styles.fontStyle = "bold";
      }
      if (data.row.index === 5) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = CREAM;
        data.cell.styles.textColor = data.column.index === 0 ? INK : AMBER;
      }
    },
  });

  const y = lastTableY(doc, 160) + 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text(
    "Figures reflect the current salary structure on record. For queries, contact People Ops.",
    14,
    y,
  );

  footer(
    doc,
    `Salary summary for ${profile.full_name} (${profile.employee_id ?? "—"}) · Effective ${effective}`,
  );
  savePdf(doc, `dayflow-payroll-${slug(profile.employee_id ?? "emp")}.pdf`);
}
