# Papermark: Free DocSend Alternative
Exported on: 12/31/2025, 1:01:28 PM

---

**You:**
analyze all you find about how to setup papermark by free or the smallest possible cost (without incurring in non sense work) to replace docsend. Return all possible info and thorough plan

**Gemini:**
To replace DocSend with Papermark at the lowest possible cost, you have two primary paths: the **SaaS Free Tier** (zero setup) or **Self-Hosting** (maximum control, near-zero cost).

### Comparison: SaaS vs. Self-Hosted

| Feature | Papermark SaaS (Free) | Self-Hosted (Free/Hobby) |
| --- | --- | --- |
| **Cost** | $0 | \~$0 (using Free Tiers) |
| **Effort** | None (Sign up & go) | \~30-60 mins setup |
| **Storage** | 10 documents | Unlimited (limited by your storage tier) |
| **Analytics** | Basic tracking | Full page-by-page tracking |
| **Data Rooms** | ❌ (Paid only) | ❌ (Restricted in personal version) |
| **Custom Domain** | ❌ (Paid only) | ✅ Included |

Export to Sheets---

## 🚀 The "No-Nonsense" Plan: Self-Hosting for $0

If you need more than 10 documents and want a custom domain for free, self-hosting is the best "DocSend killer."

### 1. The "Free" Stack

To keep costs at $0, you will use the "Free Tier" of these four providers:

* **Hosting:** [Vercel](https://vercel.com/) (Hobby Plan - $0)
* **Database:** [Supabase](https://supabase.com/) (PostgreSQL Free Tier - $0)
* **File Storage:** [Vercel Blob](https://vercel.com/storage/blob) (Free up to 250MB) or [AWS S3](https://aws.amazon.com/s3/) (5GB Free for 12 months).
* **Analytics:** [Tinybird](https://www.tinybird.co/) (Free Tier - crucial for the "DocSend" tracking features).
* **Email:** [Resend](https://resend.com/) (3,000 free emails/mo).

### 2. Implementation Steps

1. **Fork the Repo:** Go to [github.com/mfts/papermark](https://github.com/mfts/papermark) and click **Fork**.
2. **Setup Supabase:** Create a new project. Copy the **Transaction** and **Session** connection strings from Settings > Database.
3. **Setup Tinybird:** This is the "brain" of your analytics.

* Create a workspace.
* Install the Tinybird CLI locally: `pip install tinybird-cli`.
* In the `/lib/tinybird` folder of the repo, run `tb push` to upload the data schemas.
4. **Deploy to Vercel:**

* Import your GitHub fork into Vercel.
* Add your environment variables (copied from Supabase, Tinybird, and Resend).
* **Crucial:** Ensure `NEXT_PUBLIC_BASE_URL` is set to your Vercel URL or custom domain.

### 3. Avoiding "Non-Sense" Work

* **Skip Local Setup:** Don't waste time setting up a local database. Use Supabase directly as your "Development" database in your `.env` file.
* **Use Vercel Blob:** It is significantly easier to configure than AWS S3. It only requires a single API token and zero "IAM Policy" headaches.
* **Authentication:** Use **GitHub** or **Google** OAuth (Free) instead of setting up a custom email/password system to avoid managing user security yourself.

---

## 🛠 Strategic Optimization

If you are doing this to save money, keep these "gotchas" in mind:

### The "Personal License" Limit

The open-source version of Papermark is licensed for **personal, non-commercial use**.

* **The Trap:** Features like "Data Rooms" (multiple files in one link) and "NDA signing" are often stripped from the free open-source version or require a license key.
* **The Workaround:** If you just need "DocSend" style PDF tracking, the basic "Shareable Link" feature in the open-source version works perfectly and provides page-by-page analytics.

### Minimal Ongoing Cost (The $5/mo Path)

If you exceed Vercel’s free limits (e.g., you are sending thousands of documents), the "non-sense-free" upgrade path is:

1. **Vercel Pro ($20/mo):** Only if you need high bandwidth.
2. **Hetzner/DigitalOcean VPS ($5/mo):** If you prefer Docker, you can run the entire stack on a $5/mo VPS using [Coolify](https://coolify.io/), which automates the "non-sense" parts of server management.

---

**Would you like me to generate the specific list of Environment Variables you'll need to copy-paste into Vercel to make this work?**

---

**You:**
give me the instructions, complete, to follow step by step

**Gemini:**
This plan avoids the high cost of DocSend by leveraging the **Papermark Open Source** version. By using the "Hobby" tiers of modern cloud providers, you can run a professional document tracking platform for **$0/month** (up to a reasonable volume of traffic).

### 📋 Prerequisites

Before starting, create free accounts on these platforms (takes 5 mins):

* **GitHub** (To host your code)
* **Vercel** (To host the website)
* **Supabase** (For your database)
* **Tinybird** (For the document analytics)
* **Resend** (For sending emails)
* **Google Cloud Console** (For "Sign in with Google")

---

### Phase 1: The Code & Database

1. **Fork the Repository:** Go to [github.com/mfts/papermark](https://github.com/mfts/papermark) and click **Fork**.
2. **Setup Supabase:**

* Create a new project in Supabase.
* Go to **Project Settings > Database**.
* Copy the **Connection String** (use the "Transaction" mode URL).
* Save this as your `DATABASE_URL`.

### Phase 2: Analytics (The "DocSend" Magic)

Papermark uses Tinybird to track exactly which pages your viewers read.

1. **Create Workspace:** Log into Tinybird and create a new workspace.
2. **Get Token:** Go to **Tokens** and copy the `admin` token.
3. **Push the Schema:** This is the only "technical" part.

* Open a terminal on your computer.
* Clone your forked repo: `git clone https://github.com/YOUR_USERNAME/papermark.git`.
* Navigate to the tinybird folder: `cd papermark/lib/tinybird`.
* Install Tinybird CLI: `pip install tinybird-cli`.
* Run `tb auth` (paste your token).
* Run `tb push` to upload the data schemas.

### Phase 3: Storage & Authentication

1. **Vercel Blob:** \* In your Vercel Dashboard, go to **Storage > Create New > Blob**.

* Connect it to your (upcoming) project. It will provide a `BLOB_READ_WRITE_TOKEN`.
2. **Google OAuth:**

* Go to Google Cloud Console > APIs & Services > Credentials.
* Create **OAuth 2.0 Client ID** (Web Application).
* Authorized Redirect URI: `https://your-domain.com/api/auth/callback/google`.
3. **Resend:**

* Grab your API Key from the Resend dashboard.

### Phase 4: The Vercel Deployment

Create a new project in Vercel, import your GitHub fork, and add these **Environment Variables**:

| Variable | Source / Value |
| --- | --- |
| `DATABASE_URL` | Your Supabase connection string |
| `NEXTAUTH_SECRET` | Run `openssl rand -base64 32` in your terminal to generate |
| `NEXTAUTH_URL` | Your deployment URL (e.g., `https://my-docs.vercel.app`) |
| `GOOGLE_CLIENT_ID` | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud Console |
| `BLOB_READ_WRITE_TOKEN` | From Vercel Storage tab |
| `TINYBIRD_TOKEN` | Your Tinybird Admin Token |
| `RESEND_API_KEY` | From Resend |
| `NEXT_PUBLIC_BASE_URL` | Your custom domain or Vercel URL |

Export to Sheets---

### ⚠️ Important Limitations

To keep it "No-Nonsense," you must accept these tradeoffs in the Open Source version:

* **No Data Rooms:** The free OS version usually only allows sharing **individual files**. You cannot create a folder/room containing 10 files behind one link (that's a SaaS-only feature).
* **Personal Use:** The license is technically for personal/non-commercial use. For a small startup or freelancer, this is a gray area, but for large enterprise use, you'd need the paid version.
* **Watermarking:** Dynamic watermarking is often restricted to the paid SaaS tier or requires manual coding in the OS version.

### 💰 Total Monthly Cost: $0.00

* **Vercel:** Free (Hobby)
* **Supabase:** Free (500MB DB)
* **Tinybird:** Free (Build tier)
* **Resend:** Free (3k emails/mo)
* **Storage:** 250MB free via Vercel Blob (Enough for \~50–100 pitch decks).

---

**Would you like me to generate a script that automatically checks if your environment variables are correctly formatted before you hit deploy?**

---

