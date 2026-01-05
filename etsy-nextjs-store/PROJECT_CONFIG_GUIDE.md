# Project Configuration Guide

To enable product synchronization and payments, you need to populate your environment variables. 

### 1. Supabase Setup
- Create a project on [Supabase](https://supabase.com).
- Run the contents of `ecommerce_schema.sql` in the SQL Editor.
- Get your `URL`, `Anon Key`, and `Service Role Key` from Settings > API.

### 2. Etsy API v3 Setup
- Register an app at [Etsy Developers](https://www.etsy.com/developers/your-apps).
- **Keystring:** This is your `ETSY_API_KEY`.
- **Shared Secret:** This is your `ETSY_SHARED_SECRET`.
- **Shop ID:** Find this in your Etsy Shop Manager or URL.
- **Access Token:** Use the provided `get_etsy_token.mjs` script to generate this.

### 3. Stripe Setup
- Go to [Stripe Dashboard](https://dashboard.stripe.com).
- Get your `Publishable key` and `Secret key`.

---

### Environment Variable Template
Copy these to a `.env` file in the root directory (untracked by git):

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

ETSY_API_KEY=...
ETSY_SHOP_ID=...
ETSY_ACCESS_TOKEN=...

STRIPE_SECRET_KEY=...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=...
STRIPE_WEBHOOK_SECRET=...
```
