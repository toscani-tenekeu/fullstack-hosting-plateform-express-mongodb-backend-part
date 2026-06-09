# Hosting Starter Backend

<p>
  <img alt="Express.js" src="https://img.shields.io/badge/Express.js-111111?style=for-the-badge&logo=express&logoColor=white">
  <img alt="MongoDB" src="https://img.shields.io/badge/MongoDB-001E2B?style=for-the-badge&logo=mongodb&logoColor=47A248">
  <img alt="Clerk" src="https://img.shields.io/badge/Clerk-6C47FF?style=for-the-badge&logo=clerk&logoColor=white">
  <img alt="Ollama Design System" src="https://img.shields.io/badge/Ollama_Design_System-111111?style=for-the-badge&logo=ollama&logoColor=white">
</p>

Backend part of a basic hosting infrastructure starter. It is intentionally simple and made for people who want to start a small hosting platform without deep hosting expertise at the beginning.

Frontend part: [fullstack-hosting-plateform-vuejs-frontend-part](https://github.com/toscani-tenekeu/fullstack-hosting-plateform-vuejs-frontend-part)

This backend provides the API for profiles, offers, customer credit, debt, subscriptions, invoices, order requests, Clerk authentication/webhooks, and admin operations.

By installing this project, you can start a simple hosting platform quickly. The backend gives you the API foundation for customers, admin operations, offers, invoices, subscriptions, credit, order requests, and Clerk authentication.

To deliver real hosting access, you only need to pair it with a hosting control panel license such as DirectAdmin or cPanel/WHM. After creating a customer's hosting account in that panel, the administrator records the panel URL, username, password, and domain information in this project's database. Customers can then order from the frontend, open their hosting area with the `Web Panel` button, and retrieve their displayed credentials from the dashboard.

Domain registration and DNS automation are intentionally not included in this starter, which keeps the first setup simple and flexible. You can add registrar or DNS-provider integrations later when your workflow is ready.

## Backend-Driven Screens

<table>
  <tr>
    <td width="50%">
      <strong>Admin dashboard overview</strong><br>
      <img src="docs/images/admin-dashboard-overview.svg" alt="Admin dashboard overview screenshot">
    </td>
    <td width="50%">
      <strong>Admin subscription editor</strong><br>
      <img src="docs/images/admin-subscription-editor.svg" alt="Admin subscription editor screenshot">
    </td>
  </tr>
  <tr>
    <td width="50%">
      <strong>Customer dashboard overview</strong><br>
      <img src="docs/images/customer-dashboard-overview.svg" alt="Customer dashboard overview screenshot">
    </td>
    <td width="50%">
      <strong>Customer invoice details</strong><br>
      <img src="docs/images/customer-invoice-details.svg" alt="Customer invoice details screenshot">
    </td>
  </tr>
</table>

## Requirements

- Node.js `24.16.0` LTS recommended
- npm `11.13.0` recommended
- MongoDB Atlas or compatible MongoDB URI
- Clerk application keys

## Setup

Clone the backend repository:

```bash
git clone https://github.com/toscani-tenekeu/fullstack-hosting-plateform-express-mongodb-backend-part.git
cd fullstack-hosting-plateform-express-mongodb-backend-part
```

Install dependencies:

```bash
npm install
```

Create the environment file:

```bash
cp .env.example .env
```

Fill `.env`:

```env
PORT=3000
CLIENT_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
MONGODB_URI=your_mongodb_uri
CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
CLERK_WEBHOOK_SIGNING_SECRET=your_clerk_webhook_signing_secret
```

Run the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000/health
http://localhost:3000/api/docs
```

## Scripts

```bash
npm run dev
npm run build
npm test
npm run seed:offers
```

`npm test` uses `mongodb-memory-server`. On a fresh machine it may download a MongoDB binary the first time tests run.

## API Docs

- OpenAPI JSON: `/api/openapi.json`
- Swagger UI: `/api/docs`
- Temporary backend auth page: `/dev/auth`

Local URLs:

- Backend: `http://localhost:3000`
- Swagger UI: `http://localhost:3000/api/docs`
- OpenAPI JSON: `http://localhost:3000/api/openapi.json`

## Main API Routes

Public/system:

- `GET /health`
- `GET /api/openapi.json`
- `GET /api/docs`
- `GET /api/offers`
- `GET /api/offers/slug/:slug`
- `GET /api/offers/:id`
- `POST /api/webhooks/clerk`

Current user:

- `GET /api/me`
- `PATCH /api/me/profile`
- `GET /api/me/subscriptions`
- `GET /api/me/subscriptions/:id`
- `GET /api/me/invoices`
- `GET /api/me/invoices/:id`
- `POST /api/me/order-requests`

Admin:

- `GET /api/admin/users`
- `GET /api/admin/users/:clerkUserId`
- `PATCH /api/admin/users/:clerkUserId/profile`
- `PATCH /api/admin/users/:clerkUserId/credit`
- `POST /api/admin/users/:clerkUserId/credit/add`
- `POST /api/admin/users/:clerkUserId/credit/subtract`
- `PATCH /api/admin/users/:clerkUserId/debt`
- `PATCH /api/admin/users/:clerkUserId/role`
- `POST /api/admin/users/:clerkUserId/resync`
- `GET|POST /api/admin/offers`
- `GET|PATCH|DELETE /api/admin/offers/:id`
- `GET /api/admin/user-requests`
- `GET|PATCH /api/admin/user-requests/:id`
- `GET|POST /api/admin/subscriptions`
- `GET|PATCH|DELETE /api/admin/subscriptions/:id`
- `GET|POST /api/admin/invoices`
- `GET|PATCH|DELETE /api/admin/invoices/:id`

## Auth Model

- Clerk handles sign-up and sign-in.
- Frontend requests can use `Authorization: Bearer <Clerk session token>`.
- If frontend and backend share origin, Clerk cookies can authenticate requests automatically.
- Clerk webhooks should point to `POST /api/webhooks/clerk`.
- Subscribe at least to `user.created` and `user.updated`.

## Payments and Credit

Payment methods are not implemented in this backend. There is no payment gateway, checkout session, payment webhook, or automatic crediting system.

Manual starter flow:

- The customer pays outside the platform.
- The admin verifies the payment manually.
- The admin sets, adds, or subtracts user credit through the admin API or admin dashboard.
- When a customer submits an order request, the backend checks that the customer has enough credit.
- If credit is sufficient, the backend subtracts the offer `pricePerYear` from `credit.amount`.
- If credit is insufficient, the backend rejects the order request.
- If provisioning fails, the admin should manually refund the customer credit.

Relevant endpoints:

- `PATCH /api/admin/users/:clerkUserId/credit`
- `POST /api/admin/users/:clerkUserId/credit/add`
- `POST /api/admin/users/:clerkUserId/credit/subtract`
- `POST /api/me/order-requests`

## Currency

The default currency is `XAF`.

To change the backend currency:

1. Update currency enums/defaults in `src/models/user-profile.ts`, `src/models/offer.ts`, and `src/models/user-request.ts`.
2. Update service defaults that write `currency: 'XAF'` in `src/services/user-profile-service.ts`, `src/services/offer-service.ts`, `src/services/offer-seed.ts`, and `src/services/user-request-service.ts`.
3. Update fallback currency values in `src/lib/serializers.ts`.
4. Update OpenAPI schemas and descriptions in `src/openapi.ts`.
5. Update validation messages in `src/schemas/user.ts` and `src/schemas/offer.ts`.
6. Update seed data prices in `src/data/offers.ts`.
7. Update backend tests that expect `XAF`.
8. If data already exists, migrate `offers.currency`, `user_profiles.credit.currency`, `user_profiles.debt.currency`, and `user_requests.currency` in MongoDB.

## Subscriptions and Domains

- Admin and self subscription responses use `domains[]`, not a single `domain`.
- Every domain entry contains `name`, `type`, `price`, `startDate`, `endDate`, and `status`.
- Every hosting plan/subscription requires `invoiceNumber`.
- VPS plans require `vpsCredentials.rootPassword`.
- VPS `vpsCredentials.rootUsername` defaults to `root` when omitted.
- `vpsCredentials` is rejected for non-VPS plans.
- `credentials` remains available for free-form extra admin data.

## Admin Bootstrap

Promote an existing Clerk user to admin:

```bash
npx ts-node --files scripts/setup-admin-cli.ts --email admin@example.com
```

## Ollama Design System

The frontend visual direction follows an Ollama Design System style: white canvas, strong black typography, pill buttons, thin borders, and clean documentation-like layouts.

## License

This project is open source under the MIT License.

It is free to use for personal and commercial purposes without asking for permission.

## Main Contributor

Main contributor: Toscani TENEKEU

Website: https://toscani-tenekeu.com
