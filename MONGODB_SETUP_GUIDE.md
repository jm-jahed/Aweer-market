# AweerMarket — MongoDB Atlas Setup & Configuration Guide

> **Mode:** Audit & Preparation Only  
> **Status:** Draft / Ready for Review  
> **Target Production VPS:** `169.58.33.89`  
> **Backend Process:** `aweermarket-api` (Port `4000`)

---

## 1. Current Application Database Architecture

- **Backend Framework:** Fastify with Mongoose (`mongoose@^8.9.5`).
- **Connection Logic:** Located in [`backend/src/plugins/db.ts`](file:///D:/Aweer-market/backend/src/plugins/db.ts) and initialized in [`backend/src/server.ts`](file:///D:/Aweer-market/backend/src/server.ts).
- **Environment Variable:** **`MONGODB_URI`**
- **Connection Mode:** **Fail-Closed**. The API server intentionally refuses to bind to port 4000 and aborts startup if the database connection cannot be established or times out (`serverSelectionTimeoutMS: 5000`, `connectTimeoutMS: 10000`).
- **Data Models:**
  - `User` (`users` collection) — Super Admin, Shop Admins, and Buyers
  - `Shop` (`shops` collection) — Al Aweer wholesale stalls and vendors
  - `Product` (`products` collection) — Wholesale fruits, vegetables, packaging, and pricing
  - `Category` (`categories` collection) — Marketplace category taxonomy
  - `Order` (`orders` collection) — Wholesale B2B orders and line items

---

## 2. Step-by-Step Instructions: Creating a Dedicated Atlas Database

### Step 2.1 — Create or Select a Project & Cluster
1. Log in to [MongoDB Atlas](https://cloud.mongodb.com/).
2. Navigate to or create a dedicated project (e.g., `AweerMarket-Production`).
3. Deploy a new cluster:
   - **Tier:** M0 (Free tier for testing) or M10+ (for production traffic with automated backups).
   - **Provider & Region:** AWS `me-central-1` (UAE / Dubai) or AWS `eu-central-1` (Frankfurt) for optimal latency to the Contabo European VPS.
   - **Cluster Name:** e.g., `aweermarket-cluster`.

### Step 2.2 — Configure Network Access (IP Access List)
The Contabo VPS needs outbound TCP access to port 27017 on the Atlas cluster.
1. In the Atlas sidebar, click **Network Access** under **Security**.
2. Click **Add IP Address**.
3. Add the exact Contabo VPS public IP:
   - **IP Address:** `169.58.33.89/32`
   - **Comment:** `Contabo VPS - AweerMarket Production Backend`
4. Confirm the entry status transitions to **Active**.

### Step 2.3 — Create a Dedicated Least-Privilege Database User
Avoid using global administrative accounts (`atlasAdmin` or `readWriteAnyDatabase`).
1. In the Atlas sidebar, click **Database Access** under **Security**.
2. Click **Add New Database User**.
3. **Authentication Method:** Password.
4. **Username:** `aweer_backend_app` (or your preferred username).
5. **Password:** Generate a strong 24+ character password (avoid special characters that require URI-encoding such as `@`, `:`, `/`, or `%`, or ensure they are URL-encoded).
6. **Database User Privileges:**
   - Select **Built-in Role** -> **Only read and write to specific databases**.
   - Specific Database: `aweermarket`
   - Role: `readWrite`
7. Click **Add User**.

---

## 3. Obtaining the Connection String

1. In MongoDB Atlas, click **Database** -> **Connect** on your cluster.
2. Select **Drivers** -> Driver: **Node.js**, Version: **5.5 or later**.
3. Atlas will provide a standard SRV connection string:
   ```text
   mongodb+srv://<username>:<password>@<cluster-host>.mongodb.net/?retryWrites=true&w=majority
   ```
4. Append the database name `aweermarket` right before the query parameter `?`:
   ```text
   mongodb+srv://<username>:<password>@<cluster-host>.mongodb.net/aweermarket?retryWrites=true&w=majority
   ```

---

## 4. Redacted Production Environment Template

For the Contabo VPS at `/var/www/aweer-market/backend/.env`:

```env
# =====================================================================
# AweerMarket Backend API - Production Environment Configuration
# =====================================================================
PORT=4000
HOST=0.0.0.0
NODE_ENV=production

# MongoDB Atlas Connection
# Format: mongodb+srv://<db_user>:<db_password>@<cluster-endpoint>/aweermarket?retryWrites=true&w=majority
MONGODB_URI=mongodb+srv://<db_user>:<db_password>@<cluster-endpoint>/aweermarket?retryWrites=true&w=majority

# CORS Configuration (All active web portals)
CORS_ORIGINS=https://barakahalrizquae.com,https://shop.barakahalrizquae.com,https://aweeradmin.barakahalrizquae.com,https://aweermarket.barakahalrizquae.com

# JWT Authentication Secrets (Must be 32+ cryptographically random characters)
JWT_SECRET=<32_char_cryptographically_secure_random_string>
ADMIN_JWT_SECRET=<32_char_cryptographically_secure_random_string>
SUPER_ADMIN_JWT_SECRET=<32_char_cryptographically_secure_random_string>

# Super Admin Initial Seeding (Set true only if initial production seed is required)
ENABLE_SUPER_ADMIN_SEED=false
SUPER_ADMIN_EMAIL=superadmin@aweermarket.ae
SUPER_ADMIN_PASSWORD=<strong_password_minimum_12_characters>
SUPER_ADMIN_NAME="Aweer Market Super Admin"
```

---

## 5. Pre-Implementation Verification Checklist (Before Application)

Once the new cluster, IP allowlist, and user are provisioned, the following safe checks should be completed prior to restarting any production service:
1. **DNS SRV Resolution Check:** Verify that `_mongodb._tcp.<cluster-host>` resolves from the VPS.
2. **Outbound TCP Check:** Confirm port 27017 on the cluster shards can be reached over TCP.
3. **Isolated Test Script:** Run an isolated one-shot script on the VPS using Mongoose to verify authentication without affecting the live backend.
4. **Controlled Switchover:** Update `/var/www/aweer-market/backend/.env` and restart only `aweermarket-api` via PM2.
5. **Health Validation:** Verify `http://127.0.0.1:4000/api/v1/health` and `https://api.barakahalrizquae.com/api/v1/health` return HTTP 200 `{"status":"ok"}`.
