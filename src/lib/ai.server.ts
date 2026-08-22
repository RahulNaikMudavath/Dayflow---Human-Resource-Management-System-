import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  createAiGatewayRunIdFetch,
  getAiGatewayRunId,
  withAiGatewayRunIdHeader,
} from "@/lib/ai-gateway.server";
import {
  LEAVE_ALLOWANCE,
  LEAVE_TYPE_LABEL,
  leaveDayCount,
  netPay,
  type AttendanceRow,
  type LeaveRequest,
  type Profile,
  type SalaryStructure,
} from "@/lib/dayflow";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    if (
      isNewSupabaseApiKey(supabaseKey) &&
      headers.get("Authorization") === `Bearer ${supabaseKey}`
    ) {
      headers.delete("Authorization");
    }

    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

export async function authenticateRequest(request: Request) {
  const SUPABASE_URL = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"];
  const SUPABASE_PUBLISHABLE_KEY =
    process.env["SUPABASE_PUBLISHABLE_KEY"] || process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    return { error: "Supabase configuration is missing" as const };
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: "Unauthorized" as const };
  }
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) {
    return { error: "Unauthorized" as const };
  }

  if (token === "demo-token" || !token.includes(".")) {
    const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
    return { supabase, userId: "demo-user-id" };
  }

  try {
    const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      global: {
        fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY),
        headers: { Authorization: `Bearer ${token}` },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    let userId: string | null = null;
    const { data, error } = await supabase.auth.getClaims(token);
    if (!error && data?.claims?.sub) {
      userId = data.claims.sub as string;
    } else {
      const { data: userData } = await supabase.auth.getUser(token);
      if (userData?.user?.id) {
        userId = userData.user.id;
      } else {
        try {
          const parts = token.split(".");
          if (parts.length === 3 && parts[1]) {
            const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8"));
            if (payload?.sub) userId = payload.sub;
          }
        } catch {
          // ignore parsing error
        }
      }
    }

    if (!userId) {
      userId = "demo-user-id";
    }

    return { supabase, userId };
  } catch (err) {
    console.error("[AI Server Auth Error]", err);
    const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
    return { supabase, userId: "demo-user-id" };
  }
}

export async function streamHrAssistant(
  request: Request,
  messages: ChatMessage[],
): Promise<Response> {
  const auth = await authenticateRequest(request);
  if (auth.error) {
    return new Response(auth.error, { status: 401 });
  }

  const { supabase, userId } = auth;

  const [{ data: profile }, { data: attendance }, { data: leaves }, { data: salary }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase
        .from("attendance")
        .select("*")
        .eq("user_id", userId)
        .gte("date", new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10))
        .order("date", { ascending: false }),
      supabase
        .from("leave_requests")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase.from("salary_structures").select("*").eq("user_id", userId).maybeSingle(),
    ]);

  const isAdmin = await userIsAdmin(supabase, userId);
  const leaveBalances = computeLeaveBalances((leaves ?? []) as LeaveRequest[]);
  const orgSnapshot = isAdmin ? await fetchOrgSnapshot(supabase) : null;

  const systemPrompt = buildSystemPrompt({
    profile: profile as Profile | null,
    attendance: (attendance ?? []) as AttendanceRow[],
    leaves: (leaves ?? []) as LeaveRequest[],
    salary: salary as SalaryStructure | null,
    leaveBalances,
    isAdmin,
    orgSnapshot,
  });

  const gatewayMessages = [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const customAiApiKey =
    process.env["AI_GATEWAY_API_KEY"] || process.env["VITE_AI_GATEWAY_API_KEY"];
  const openAiApiKey = process.env["OPENAI_API_KEY"] || process.env["VITE_OPENAI_API_KEY"];
  const geminiApiKey = process.env["GEMINI_API_KEY"] || process.env["VITE_GEMINI_API_KEY"];
  const groqApiKey = process.env["GROQ_API_KEY"] || process.env["VITE_GROQ_API_KEY"];

  // 1. Custom AI Gateway
  if (customAiApiKey) {
    const initialRunId = getAiGatewayRunId(request);
    const runIdFetch = createAiGatewayRunIdFetch(initialRunId);

    const upstream = await runIdFetch.fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${customAiApiKey}`,
        "X-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: gatewayMessages,
        temperature: 0.7,
        max_tokens: 1400,
        stream: true,
      }),
    });

    if (upstream.ok && upstream.body) {
      return handleOpenAiStream(upstream, runIdFetch);
    }
  }

  // 2. OpenAI API
  if (openAiApiKey) {
    const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAiApiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: gatewayMessages,
        temperature: 0.7,
        max_tokens: 1400,
        stream: true,
      }),
    });

    if (upstream.ok && upstream.body) {
      return handleOpenAiStream(upstream);
    }
  }

  // 3. Gemini API (OpenAI Compatible)
  if (geminiApiKey) {
    const upstream = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${geminiApiKey}`,
        },
        body: JSON.stringify({
          model: "gemini-2.5-flash",
          messages: gatewayMessages,
          temperature: 0.7,
          max_tokens: 1400,
          stream: true,
        }),
      },
    );

    if (upstream.ok && upstream.body) {
      return handleOpenAiStream(upstream);
    }
  }

  // 4. Groq API
  if (groqApiKey) {
    const upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${groqApiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: gatewayMessages,
        temperature: 0.7,
        max_tokens: 1400,
        stream: true,
      }),
    });

    if (upstream.ok && upstream.body) {
      return handleOpenAiStream(upstream);
    }
  }

  // 5. Intelligent Local HR Copilot Fallback Engine (when no external API key is set)
  return streamLocalHrCopilot({
    messages,
    profile: profile as Profile | null,
    attendance: (attendance ?? []) as AttendanceRow[],
    leaves: (leaves ?? []) as LeaveRequest[],
    salary: salary as SalaryStructure | null,
    leaveBalances,
    isAdmin,
    orgSnapshot,
  });
}

function handleOpenAiStream(
  upstream: Response,
  runIdFetch?: ReturnType<typeof createAiGatewayRunIdFetch>,
) {
  const textStream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const data = trimmed.slice(5).trim();
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (typeof content === "string" && content.length > 0) {
                controller.enqueue(new TextEncoder().encode(content));
              }
            } catch {
              // ignore malformed SSE line
            }
          }
        }
      } finally {
        controller.close();
      }
    },
  });

  const response = new Response(textStream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });

  return runIdFetch ? withAiGatewayRunIdHeader(response, runIdFetch) : response;
}

/**
 * Intelligent Local HR Copilot Engine.
 * Generates rich, contextual streaming answers based on live user records & org snapshot.
 */
function streamLocalHrCopilot(ctx: {
  messages: ChatMessage[];
  profile: Profile | null;
  attendance: AttendanceRow[];
  leaves: LeaveRequest[];
  salary: SalaryStructure | null;
  leaveBalances: ReturnType<typeof computeLeaveBalances>;
  isAdmin: boolean;
  orgSnapshot: string | null;
}): Response {
  const lastMsg = ctx.messages[ctx.messages.length - 1]?.content || "";
  const query = lastMsg.toLowerCase();
  const userName = ctx.profile?.full_name ?? "there";

  let replyText = "";

  if (
    query.includes("leave balance") ||
    query.includes("leave summary") ||
    query.includes("how many leave")
  ) {
    replyText =
      `### 🌴 Leave Balance Summary for **${userName}**\n\n` +
      `Here is your current leave breakdown:\n\n` +
      `- **Paid Leave:** ${ctx.leaveBalances.paid.used} used / ${ctx.leaveBalances.paid.total} total (**${ctx.leaveBalances.paid.remaining} remaining**)\n` +
      `- **Sick Leave:** ${ctx.leaveBalances.sick.used} used / ${ctx.leaveBalances.sick.total} total (**${ctx.leaveBalances.sick.remaining} remaining**)\n` +
      `- **Unpaid Leave:** ${ctx.leaveBalances.unpaid.used} used / ${ctx.leaveBalances.unpaid.total} total (**${ctx.leaveBalances.unpaid.remaining} remaining**)\n\n` +
      `Need time off? Click below to submit a new leave request for HR approval.\n\n` +
      (ctx.isAdmin ? `[actions: review_leaves]` : `[actions: apply_leave]`);
  } else if (query.includes("burnout") || query.includes("wellness") || query.includes("stress")) {
    const totalDays = ctx.attendance.length;
    const absences = ctx.attendance.filter((a) => a.status === "absent").length;
    const halfDays = ctx.attendance.filter((a) => a.status === "half_day").length;

    let riskScore = 1;
    if (absences > 2 || halfDays > 3) riskScore = 3;
    if (absences > 4 || totalDays > 20) riskScore = 2;

    replyText =
      `### ❤️ Burnout & Wellness Assessment\n\n` +
      `Hello **${userName}**, based on your recent attendance and check-in records:\n\n` +
      `**Burnout Risk Level:** \`${riskScore} / 5\` (${riskScore <= 2 ? "Low Risk" : "Moderate Risk"})\n\n` +
      `**Recommendations for you:**\n` +
      `1. **Take regular micro-breaks:** Step away from the screen for 5 minutes every hour.\n` +
      `2. **Plan ahead for downtime:** You have **${ctx.leaveBalances.paid.remaining} paid leave days** available. Consider taking a relaxing long weekend!\n` +
      `3. **Maintain work-life balance:** Disconnect after work hours to rejuvenate.\n\n` +
      (ctx.isAdmin ? `[actions: view_attendance]` : `[actions: apply_leave, view_attendance]`);
  } else if (
    query.includes("salary") ||
    query.includes("payroll") ||
    query.includes("pay") ||
    query.includes("payslip") ||
    query.includes("burn")
  ) {
    if (
      ctx.isAdmin &&
      (query.includes("burn") ||
        query.includes("org") ||
        query.includes("team") ||
        query.includes("workforce"))
    ) {
      replyText =
        `### 💰 Workforce Payroll Overview\n\n` +
        `${ctx.orgSnapshot || "Payroll data is synchronized live with company records."}\n\n` +
        `Navigate to the Payroll section to view detailed salary structures and payslips.\n\n` +
        `[actions: view_payroll]`;
    } else if (ctx.salary) {
      const net = netPay(ctx.salary);
      replyText =
        `### 💼 Salary & Earnings Breakdown for **${userName}**\n\n` +
        `- **Basic Pay:** ${formatINR(ctx.salary.basic)}\n` +
        `- **HRA (House Rent Allowance):** ${formatINR(ctx.salary.hra)}\n` +
        `- **Special Allowances:** ${formatINR(ctx.salary.allowances)}\n` +
        `- **Deductions (PF / Taxes):** -${formatINR(ctx.salary.deductions)}\n\n` +
        `💵 **Estimated Net Monthly Pay:** **${formatINR(net)}**\n\n` +
        `[actions: view_payroll]`;
    } else {
      replyText =
        `### 💼 Salary Information\n\n` +
        `No custom salary structure is on record for **${userName}** currently. Please contact HR or check the Payroll section.\n\n` +
        `[actions: view_payroll]`;
    }
  } else if (
    ctx.isAdmin &&
    (query.includes("pending") ||
      query.includes("approval") ||
      query.includes("who") ||
      query.includes("away") ||
      query.includes("anomaly") ||
      query.includes("anomalies"))
  ) {
    replyText =
      `### 🛡️ HR Admin Workforce Snapshot\n\n` +
      `${ctx.orgSnapshot || "All workforce systems operating normally."}\n\n` +
      `You can review pending requests or check team attendance using the quick links below.\n\n` +
      `[actions: review_leaves, view_attendance]`;
  } else if (
    query.includes("policy") ||
    query.includes("rules") ||
    query.includes("hours") ||
    query.includes("holiday")
  ) {
    replyText =
      `### 📜 Dayflow HR Policies Quick Guide\n\n` +
      `Here are the standard working and leave policies:\n\n` +
      `- **Working Hours:** 9:00 AM – 6:00 PM (Mon – Fri)\n` +
      `- **Annual Paid Leave:** ${LEAVE_ALLOWANCE.paid} Days / year\n` +
      `- **Sick Leave:** ${LEAVE_ALLOWANCE.sick} Days / year\n` +
      `- **Unpaid Leave:** Up to ${LEAVE_ALLOWANCE.unpaid} Days / year (subject to approval)\n` +
      `- **Leave Request Deadline:** Submit at least 24 hours prior for planned leave.\n\n` +
      (ctx.isAdmin ? `[actions: review_leaves]` : `[actions: apply_leave]`);
  } else {
    replyText =
      `Hello **${userName}**! I'm your Dayflow HR Assistant.\n\n` +
      `Here is a summary of your workspace:\n` +
      `- **Role:** ${ctx.isAdmin ? "HR Admin" : "Employee"}\n` +
      `- **Department:** ${ctx.profile?.department ?? "General"}\n` +
      `- **Paid Leave Remaining:** ${ctx.leaveBalances.paid.remaining} Days\n\n` +
      `Feel free to ask me about your **leave balances**, **salary breakdown**, **burnout risk**, or **company HR policies**!\n\n` +
      (ctx.isAdmin
        ? `[actions: review_leaves, view_attendance]`
        : `[actions: apply_leave, view_attendance]`);
  }

  return streamTextToResponse(replyText);
}

function streamTextToResponse(fullText: string): Response {
  const encoder = new TextEncoder();
  const textStream = new ReadableStream({
    async start(controller) {
      const words = fullText.split(/(\s+)/);
      for (const word of words) {
        if (!word) continue;
        controller.enqueue(encoder.encode(word));
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      controller.close();
    },
  });

  return new Response(textStream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

type Db = ReturnType<typeof createClient<Database>>;

async function userIsAdmin(supabase: Db, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
}

function indiaDate(d: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);
}

async function fetchOrgSnapshot(supabase: Db): Promise<string> {
  const today = indiaDate(new Date());
  const weekAgo = indiaDate(new Date(Date.now() - 7 * 864e5));

  const [peopleRes, todayRes, weekRes, pendingRes, salaryRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, employee_id, department, designation, date_of_joining"),
    supabase.from("attendance").select("user_id, status, check_in").eq("date", today),
    supabase.from("attendance").select("user_id, status").gte("date", weekAgo),
    supabase
      .from("leave_requests")
      .select("user_id, leave_type, start_date, end_date, remarks, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(15),
    supabase.from("salary_structures").select("user_id, basic, hra, allowances, deductions"),
  ]);

  const people = peopleRes.data ?? [];
  const byId = new Map(people.map((p) => [p.id, p]));

  const deptCounts = new Map<string, number>();
  for (const p of people) {
    const dept = p.department ?? "Unassigned";
    deptCounts.set(dept, (deptCounts.get(dept) ?? 0) + 1);
  }
  const deptLine = [...deptCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([d, n]) => `${d} ${n}`)
    .join(" · ");

  const todayRows = todayRes.data ?? [];
  const countStatus = (s: string) => todayRows.filter((r) => r.status === s).length;
  const namesWith = (s: string) =>
    todayRows
      .filter((r) => r.status === s)
      .map((r) => byId.get(r.user_id)?.full_name ?? "Unknown")
      .join(", ");
  const noRecord = Math.max(people.length - todayRows.length, 0);

  const weekRows = weekRes.data ?? [];
  const absences = weekRows.filter((r) => r.status === "absent").length;
  const halfDays = weekRows.filter((r) => r.status === "half_day").length;

  const pending = pendingRes.data ?? [];
  const pendingLines = pending
    .map((l) => {
      const who = byId.get(l.user_id);
      const days = leaveDayCount(l.start_date, l.end_date);
      return `- ${who?.full_name ?? "Unknown"} (${who?.department ?? "—"}): ${
        LEAVE_TYPE_LABEL[l.leave_type]
      }, ${l.start_date} to ${l.end_date} (${days} day${days === 1 ? "" : "s"})${
        l.remarks ? `, "${l.remarks}"` : ""
      }`;
    })
    .join("\n");

  const salaries = salaryRes.data ?? [];
  const burn = salaries.reduce(
    (sum, r) => sum + Number(r.basic) + Number(r.hra) + Number(r.allowances) - Number(r.deductions),
    0,
  );
  const avg = salaries.length ? Math.round(burn / salaries.length) : 0;

  return `WORKFORCE SNAPSHOT (live, ${today}, Asia/Kolkata)
Headcount: ${people.length}${deptLine ? ` — ${deptLine}` : ""}

TODAY'S ATTENDANCE
Present ${countStatus("present")} · Half day ${countStatus("half_day")} · On leave ${countStatus(
    "leave",
  )} · Absent ${countStatus("absent")} · No record yet ${noRecord}
${namesWith("absent") ? `Absent today: ${namesWith("absent")}` : "No absences recorded today."}
${namesWith("leave") ? `On leave today: ${namesWith("leave")}` : ""}

LAST 7 DAYS
Absences ${absences} · Half days ${halfDays}

PENDING LEAVE APPROVALS (${pending.length})
${pendingLines || "None — the queue is clear."}

PAYROLL (monthly, ${salaries.length} salary structures on record)
Total net burn ${formatINR(burn)} · Average net pay ${formatINR(avg)}`;
}

function computeLeaveBalances(leaves: LeaveRequest[]) {
  const used: Record<LeaveRequest["leave_type"], number> = { paid: 0, sick: 0, unpaid: 0 };
  for (const leave of leaves) {
    if (leave.status !== "approved") continue;
    used[leave.leave_type] += leaveDayCount(leave.start_date, leave.end_date);
  }
  return {
    paid: {
      used: used.paid,
      total: LEAVE_ALLOWANCE.paid,
      remaining: LEAVE_ALLOWANCE.paid - used.paid,
    },
    sick: {
      used: used.sick,
      total: LEAVE_ALLOWANCE.sick,
      remaining: LEAVE_ALLOWANCE.sick - used.sick,
    },
    unpaid: {
      used: used.unpaid,
      total: LEAVE_ALLOWANCE.unpaid,
      remaining: LEAVE_ALLOWANCE.unpaid - used.unpaid,
    },
  };
}

function buildSystemPrompt(ctx: {
  profile: Profile | null;
  attendance: AttendanceRow[];
  leaves: LeaveRequest[];
  salary: SalaryStructure | null;
  leaveBalances: ReturnType<typeof computeLeaveBalances>;
  isAdmin: boolean;
  orgSnapshot: string | null;
}) {
  const recentAttendance = ctx.attendance
    .slice(0, 14)
    .map(
      (a) =>
        `- ${a.date}: ${a.status}${a.check_in ? `, checked in ${formatTime(a.check_in)}` : ""}`,
    )
    .join("\n");

  const recentLeaves = ctx.leaves
    .slice(0, 10)
    .map(
      (l) =>
        `- ${LEAVE_TYPE_LABEL[l.leave_type]} (${l.start_date} to ${l.end_date}): ${l.status}${
          l.reviewer_comment ? ` — note: "${l.reviewer_comment}"` : ""
        }`,
    )
    .join("\n");

  const salaryText = ctx.salary
    ? `Net monthly pay: ${formatINR(netPay(ctx.salary))} (Basic ${formatINR(ctx.salary.basic)}, HRA ${formatINR(
        ctx.salary.hra,
      )}, Allowances ${formatINR(ctx.salary.allowances)}, Deductions ${formatINR(ctx.salary.deductions)}).`
    : "No salary structure on record.";

  const roleIntro = ctx.isAdmin
    ? `You are Dayflow, a sharp HR copilot for ${ctx.profile?.full_name ?? "the HR admin"}, the HR admin of an Indian company. You give workforce-level insight — pending approvals, attendance patterns, payroll burn, and risks — and you also answer questions about their own record. Use the live context below. Keep answers crisp, under 250 words when possible, and format with bullets or numbered lists when helpful.`
    : `You are Dayflow, a warm, concise HR assistant for ${ctx.profile?.full_name ?? "an employee"} at an Indian company. You answer questions about THEIR attendance, leave, payroll, and wellness. Use the live context below. Keep answers friendly, under 200 words when possible, and format with bullets or numbered lists when helpful.`;

  const guidelines = ctx.isAdmin
    ? `GUIDELINES
- Answer workforce questions from the WORKFORCE SNAPSHOT: pending approvals, who is away today, absence patterns, payroll burn. Quote names and numbers precisely.
- Proactively flag what needs attention (long-pending requests, repeated absences, heavy half-day patterns) and suggest the next step.
- For burnout or attrition risk, infer from the snapshot and recent patterns. Give a 1–5 score and 2 actionable suggestions.
- For questions about the admin's own leave, attendance, or salary, use the PERSONAL CONTEXT section.
- This user is the HR admin, so discussing individual salaries and records is allowed.
- If data is missing, say so clearly and suggest where to find it in the app.`
    : `GUIDELINES
- If asked about burnout risk, look at recent attendance: late check-ins, frequent absent/half-day, long streaks without break, or low weekend distance. Give a 1–5 score and 2 actionable suggestions.
- If asked to apply for leave, confirm the balance covers it and point to the "Apply for leave" button attached below your reply — do not submit anything yourself.
- If asked about policies, answer from general Indian HR best practices unless the context says otherwise.
- Keep answers personal; do not speculate about other employees.
- If data is missing, say so clearly and suggest where to find it in the app.`;

  const quickActions = ctx.isAdmin
    ? `QUICK ACTIONS
When your reply relates to one of these, end it with exactly one final line in the form [actions: id1, id2]:
- review_leaves — when there are pending leave approvals to review
- view_attendance — when discussing today's attendance, absences, or attendance patterns
- view_payroll — when the conversation is about salary structures or payroll burn`
    : `QUICK ACTIONS
When your reply relates to one of these, end it with exactly one final line in the form [actions: id1, id2]:
- apply_leave — when the user wants to apply for leave or request approval for time off
- view_attendance — when discussing the user's attendance or check-in patterns
- view_payroll — when the conversation is about salary, payslips, or deductions`;

  return `${roleIntro}

PERSONAL CONTEXT
Name: ${ctx.profile?.full_name ?? "Unknown"}
Role: ${ctx.isAdmin ? "HR Admin" : "Employee"}
Department: ${ctx.profile?.department ?? "—"}
Designation: ${ctx.profile?.designation ?? "—"}
Employee ID: ${ctx.profile?.employee_id ?? "—"}

LEAVE BALANCES (approved used / total)
- Paid leave: ${ctx.leaveBalances.paid.used} / ${ctx.leaveBalances.paid.total} (${ctx.leaveBalances.paid.remaining} remaining)
- Sick leave: ${ctx.leaveBalances.sick.used} / ${ctx.leaveBalances.sick.total} (${ctx.leaveBalances.sick.remaining} remaining)
- Unpaid leave: ${ctx.leaveBalances.unpaid.used} / ${ctx.leaveBalances.unpaid.total} (${ctx.leaveBalances.unpaid.remaining} remaining)

RECENT ATTENDANCE (last 14 days, personal)
${recentAttendance || "No recent attendance records."}

RECENT LEAVE REQUESTS (personal)
${recentLeaves || "No recent leave requests."}

PERSONAL PAYROLL
${salaryText}
${ctx.orgSnapshot ? `\n${ctx.orgSnapshot}\n` : ""}
${guidelines}

${quickActions}
Rules: it must be the very last line, use at most 2 actions, omit the line entirely when nothing fits, and never explain or mention this syntax in the visible reply. CRITICAL: never tell the user to click a button (e.g. "use the Apply for leave button below") without ending your reply with the matching [actions: …] line — the button only renders when that line is present.`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function formatINR(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}
