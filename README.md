# 🌅 Dayflow — Human Resource Management System (HRMS)

> A modern, full-stack Human Resource Management platform designed to streamline employee workflows, attendance tracking, leave requests, payroll processing, AI-assisted HR operations, and 100% offline-first local storage resilience.

---

## 🚀 Key Features

### 🌐 Offline-First & Local Database Engine
- **Zero Cloud Reliance**: Built with a dedicated **Local Storage Database Engine** (`src/lib/dayflow-local-db.ts`) that persists employee profiles, attendance logs, leave applications, and payroll structures locally in browser storage.
- **Offline Operations**: Check-ins, leave requests, profile updates, and salary edits function seamlessly even when disconnected from internet or cloud infrastructure.

### 🔐 Authentication & Access Control
- **Role-Based Access Control (RBAC)**: Support for Administrators, HR Managers, and Standard Employees.
- **Secure Authentication**: Integrated with Supabase Auth (Email/Password, Session management) and instant local token validation.
- **Protected Routes**: Enforced server-side and client-side authentication guards using TanStack Start routes.

### ⏱️ Attendance & Time Tracking
- **Smart Check-In / Check-Out**: One-click daily attendance logging with automatic timestamping and status badges (Present, Late, Half-day, On leave).
- **Time Breakdown**: Track working hours, break durations, and overtime.
- **Monthly & Weekly Logs**: Comprehensive 42-day calendar matrix and 7-day weekly time logger.
- **Weekly PDF Export**: Download itemized weekly attendance reports as PDF documents.

### 👥 Employee Management
- **Centralized Directory**: Search, filter, and view employee profiles by department, designation, and status.
- **Detailed Profiles**: Manage personal details, contact info, job role, joining date, emergency contacts, and salary info.
- **Profile Editor**: Modal dialog for editing employee information with automatic 256px WebP avatar image cropping.

### 🏖️ Leave Management System
- **Leave Applications**: Request time off for Paid (12d), Sick (6d), or Unpaid (30d) leaves with reason notes and automatic working-day calculations.
- **Approval Workflow**: Dedicated HR/Admin approval and rejection interface with reviewer feedback.

### 💰 Payroll & Payslips
- **Salary Processing**: View base salary, HRA, allowances, overtime pay, and tax/PF deductions.
- **Payslip Generator**: Downloadable itemized PDF payslips generated using client-side rendering.
- **Payroll Control**: HR Admin dashboard for managing company-wide salary structures.

### 🤖 AI HR Assistant
- **Conversational Intelligence**: Ask policy questions, leave balances, or company guidelines via natural language.

---

## 🛠️ Technology Stack

| Component | Technology |
| :--- | :--- |
| **Frontend Framework** | [React 19](https://react.dev/) + [TanStack Start](https://tanstack.com/start) |
| **Language** | [TypeScript](https://www.typescriptlang.org/) |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) + [Radix UI](https://www.radix-ui.com/) |
| **Icons** | [Lucide React](https://lucide.dev/) |
| **Database & Auth** | [Supabase](https://supabase.com/) (PostgreSQL, RLS, Auth) + Local DB Engine |
| **Build Tool** | [Vite](https://vitejs.dev/) |
| **PDF Generation** | Custom HTML Canvas / jsPDF Export Engine |

---

## 📁 Directory Structure

```
FINALREPT/
├── src/
│   ├── components/         # Reusable UI components & Dayflow feature modules
│   │   ├── dayflow/        # HRMS widgets (check-in, profile dialogs, notifications)
│   │   └── ui/             # Design system components (Buttons, Dialogs, Cards, Tables)
│   ├── hooks/              # Custom React hooks (e.g. useCurrentUser)
│   ├── integrations/       # Supabase client setup, Auth middleware, RLS policies
│   ├── lib/                # Utilities, AI gateway, PDF exporter, Dayflow Local DB
│   │   └── dayflow-local-db.ts  # Offline Local Storage Database Engine
│   └── routes/             # TanStack Start file-based router
│       ├── _authenticated/ # HR dashboard pages (attendance, leave, payroll, employees)
│       ├── api/            # API endpoints (AI Assistant backend)
│       ├── auth.tsx        # Auth login/signup page
│       └── index.tsx       # Landing page
├── supabase/
│   └── migrations/         # SQL schema definitions & PostgreSQL database migrations
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
Install project dependencies:

```bash
npm install
```

### 4. Run Locally
Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Production Build
Verify the production bundle:

```bash
npm run build
```

---

## 👨‍💻 Author & Repository

- **Author**: Pranav Hiremath ([pranavhiremath7777@gmail.com](mailto:pranavhiremath7777@gmail.com))
- **Repository**: [RahulNaikMudavath/Dayflow---Human-Resource-Management-System-](https://github.com/RahulNaikMudavath/Dayflow---Human-Resource-Management-System-)
- **Branch**: `pranav`

---

© 2026 Dayflow HRMS. All rights reserved.
