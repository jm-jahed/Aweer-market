# AweerMarket — Dubai Al Aweer Wholesale Marketplace

AweerMarket is a specialized B2B and consumer marketplace for the **Dubai Al Aweer Wholesale Fruits & Vegetables Market**. It connects wholesale stall vendors, commercial buyers, and individual consumers with transparent unit-pricing (AED/Kg) and direct order workflows.

---

## Architecture Overview

AweerMarket is structured as an isolated pnpm monorepo consisting of **four independent applications** and **shared packages**:

```text
D:\Aweer-market/
├── Frontend/                    # Public Marketplace & Buyer Portal (Next.js - Port 3000)
├── backend/                     # Central API & Business Rules (Fastify + TS - Port 4000)
├── shopadmin/                   # Market Operations Admin Portal (Next.js - Port 3001)
├── superadmin/                  # Platform Owner Governance Portal (Next.js - Port 3002)
├── packages/
│   ├── types/                   # Shared TypeScript Domain Models & Enums
│   └── validation/              # Shared Zod Schemas for API & Client Inputs
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── README.md
```

---

## Local Applications & Port Allocations

| Application | Path | Tech Stack | Local Port | URL | Primary Responsibilities |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Public Marketplace** | `Frontend/` | Next.js, React 19 | **3000** | `http://localhost:3000` | Public discovery, lowest price first, single-vendor cart & checkout |
| **Backend Central API** | `backend/` | Fastify, TS, Mongoose, Zod | **4000** | `http://localhost:4000` | Central API, Auth, Lowest price calculation, RBAC, DB connection |
| **Market / Shop Admin** | `shopadmin/` | Next.js, React 19 | **3001** | `http://localhost:3001` | Stall review, vendor documents, product moderation, order dispute review |
| **Super Admin Portal** | `superadmin/` | Next.js, React 19 | **3002** | `http://localhost:3002` | Platform owner governance, admin provisioning, commission fees, audit logs |

---

## Security Boundaries

1. **Direct Database Isolation**: No frontend portal (`Frontend/`, `shopadmin/`, or `superadmin/`) has direct database access. All data flows strictly through the Central API (`backend/`).
2. **Strict Authorization**: Hiding a UI menu does not constitute authorization. Every protected endpoint in `backend/` verifies role claims and active database credentials.
3. **No Self-Privilege Escalation**: Shop/Market Admin accounts cannot create or elevate accounts to Super Admin.
4. **No Public Super Admin Registration**: Super Admin accounts can only be provisioned through secure, platform-owner mechanisms with mandatory MFA.
5. **Multi-Tenant Vendor Scoping**: Vendor requests are scoped to their respective `vendorId` to prevent cross-stall data leakage.

---

## Local Development Quickstart

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Build shared packages:**
   ```bash
   pnpm build:packages
   ```

3. **Start services:**
   - Central API: `pnpm dev:backend` (Runs on `http://localhost:4000`)
   - Healthcheck: `http://localhost:4000/api/v1/health`
   - Public Marketplace: `pnpm dev:frontend` (Runs on `http://localhost:3000`)
   - Shop Admin: `pnpm dev:shopadmin` (Runs on `http://localhost:3001`)
   - Super Admin: `pnpm dev:superadmin` (Runs on `http://localhost:3002`)
