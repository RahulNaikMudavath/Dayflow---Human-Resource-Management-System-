# 🌅 Dayflow — Human Resource Management System (HRMS)

> A modern, full-stack Human Resource Management platform designed to streamline employee workflows, attendance tracking, leave requests, payroll processing, and AI-assisted HR operations.

---

## 🚀 Features

### 🔐 Authentication & Access Control
- **Role-Based Access Control (RBAC)**: Support for Administrators, HR Managers, and Standard Employees.
- **Secure Authentication**: Integrated with Supabase Auth (Email/Password, Session management).
- **Protected Routes**: Enforced server-side and client-side authentication guards using TanStack Start routes.

### ⏱️ Attendance & Time Tracking
- **Smart Check-In / Check-Out**: One-click daily attendance logging with automatic timestamping and status badges (Present, Late, Half-day).
- **Time Breakdown**: Track working hours, break durations, and overtime.
- **Monthly Attendance Logs**: Comprehensive calendar and table views for attendance history.

### 👥 Employee Management
- **Centralized Directory**: Search, filter, and view employee profiles by department, designation, and status.
- **Detailed Profiles**: Manage personal details, contact info, job role, joining date, emergency contacts, and salary info.
- **Profile Updates**: Direct edit dialogs for employees to keep their contact and personal information up to date.

### 🏖️ Leave Management System
- **Leave Applications**: Request time off for Paid, Sick, Casual, or Unpaid leaves with reason notes.
- **Approval Workflow**: Dedicated HR/Admin approval and rejection interface.
- **Leave Balance Tracking**: Real-time quotas and remaining leave counters.

### 💰 Payroll & Payslips
- **Salary Processing**: View base salary, allowances, overtime pay, and tax/PF deductions.
- **Payslip Generator**: Downloadable PDF payslips with formatted itemized breakdowns.
- **Payroll Statuses**: Track processed vs. pending payroll cycles.

### 🤖 AI HR Assistant
- **Conversational Intelligence**: Ask questions about HR policies, leave balances, or company guidelines.
- **Fast Lookup**: Query employee data and quick statistics via natural language.

---

## 🛠️ Technology Stack

| Component | Technology |
| :--- | :--- |
| **Frontend Framework** | [React 19](https://react.dev/) + [TanStack Start](https://tanstack.com/start) |
| **Language** | [TypeScript](https://www.typescriptlang.org/) |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) + [Radix UI](https://www.radix-ui.com/) |
| **Icons** | [Lucide React](https://lucide.dev/) |
| **Database & Auth** | [Supabase](https://supabase.com/) (PostgreSQL, RLS, Auth) |
| **Build Tool** | [Vite](https://vitejs.dev/) |
| **PDF Generation** | Custom Canvas / jsPDF Export Engine |

---

## 📁 Directory Structure

```
FINALREPT/
├── src/
│   ├── components/         # Reusable UI components & Dayflow feature modules
│   │   ├── dayflow/        # HRMS specific widgets (check-in, profile dialogs, notifications)
│   │   └── ui/             # Design system components (Buttons, Dialogs, Cards, Tables)
│   ├── hooks/              # React hooks (e.g. useCurrentUser)
│   ├── integrations/       # Supabase client setup, Auth middleware, RLS policies
│   ├── lib/                # Utilities, AI gateway, PDF export functions
│   └── routes/             # TanStack Start file-based router
│       ├── _authenticated/ # Protected HR dashboard pages (attendance, leave, payroll, employees)
│       ├── api/            # API endpoints (AI Assistant backend)
│       ├── auth.tsx        # Auth login/signup page
│       └── index.tsx       # Landing page
├── supabase/
│   └── migrations/         # SQL schema definitions & database migrations
├── package.json
└── vite.config.ts
```

---

## ⚙️ Getting Started

### 1. Prerequisites
Ensure you have the following installed on your local machine:
- **Node.js** (v18.x or higher)
- **npm** or **bun**

### 2. Environment Setup
Create a `.env` file in the root directory and configure your Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-supabase-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 3. Installation
Install the project dependencies:

```bash
npm install
```

### 4. Run Locally
Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) (or the port indicated in terminal) to view the application in your browser.

---

## 🤝 Repository & Contributing

- **Repository**: [RahulNaikMudavath/Dayflow---Human-Resource-Management-System-](https://github.com/RahulNaikMudavath/Dayflow---Human-Resource-Management-System-)
- **Branch**: `prajwalbranch`

---

© 2026 Dayflow HRMS. All rights reserved.
