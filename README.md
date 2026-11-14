<p align="center"><a href="https://laravel.com" target="_blank"><img src="https://raw.githubusercontent.com/laravel/art/master/logo-lockup/5%20SVG/2%20CMYK/1%20Full%20Color/laravel-logolockup-cmyk-red.svg" width="400" alt="Laravel Logo"></a></p>
# PharmaCore SaaS (`pharmacy-saas`)

<p align="center">
<a href="https://github.com/laravel/framework/actions"><img src="https://github.com/laravel/framework/workflows/tests/badge.svg" alt="Build Status"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/dt/laravel/framework" alt="Total Downloads"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/v/laravel/framework" alt="Latest Stable Version"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/l/laravel/framework" alt="License"></a>
</p>
Multi-tenant Pharmacy & Medical Chain SaaS Starter Architecture built with **Laravel 13**, **Inertia.js v3**, **React 19**, **TypeScript**, **Tailwind CSS v4**, and **PostgreSQL 16**.

## About Laravel
## Local Docker Environment

Laravel is a web application framework with expressive, elegant syntax. We believe development must be an enjoyable and creative experience to be truly fulfilling. Laravel takes the pain out of development by easing common tasks used in many web projects, such as:
Isolated ports prevent collisions with other local projects:

- [Simple, fast routing engine](https://laravel.com/docs/routing).
- [Powerful dependency injection container](https://laravel.com/docs/container).
- Multiple back-ends for [session](https://laravel.com/docs/session) and [cache](https://laravel.com/docs/cache) storage.
- Expressive, intuitive [database ORM](https://laravel.com/docs/eloquent).
- Database agnostic [schema migrations](https://laravel.com/docs/migrations).
- [Robust background job processing](https://laravel.com/docs/queues).
- [Real-time event broadcasting](https://laravel.com/docs/broadcasting).
| Service | Container | Port | Details |
| :--- | :--- | :--- | :--- |
| Web App | `pharmacy-saas-app` | `http://localhost:8001` | PHP 8.4 (`pdo_pgsql`, `pgsql`, `redis`) |
| PostgreSQL 16 | `pharmacy-saas-db` | `localhost:5434` (host) / `5432` (docker) | DB: `pharmacy_saas`, User: `pharmacy`, Pass: `secret` |
| Redis 7 | `pharmacy-saas-redis` | `localhost:6388` (host) / `6379` (docker) | Cache & queue ready |
| Vite HMR (optional) | Host Node | `http://localhost:5174` | Production build pre-compiled in `public/build` |

Laravel is accessible, powerful, and provides tools required for large, robust applications.
## Common Commands

## Learning Laravel
```bash
# Start all containers
docker compose up -d

Laravel has the most extensive and thorough [documentation](https://laravel.com/docs) and video tutorial library of all modern web application frameworks, making it a breeze to get started with the framework.
# Run database migrations & demo seeders
docker exec pharmacy-saas-app php artisan migrate:fresh --seed

In addition, [Laracasts](https://laracasts.com) contains thousands of video tutorials on a range of topics including Laravel, modern PHP, unit testing, and JavaScript. Boost your skills by digging into our comprehensive video library.
# Run automated feature & unit tests (isolated in-memory SQLite)
docker exec pharmacy-saas-app php artisan test

You can also watch bite-sized lessons with real-world projects on [Laravel Learn](https://laravel.com/learn), where you will be guided through building a Laravel application from scratch while learning PHP fundamentals.
# Frontend TypeScript check & Vite build
npx tsc --noEmit
npm run build

## Agentic Development

Laravel's predictable structure and conventions make it ideal for AI coding agents like Claude Code, Cursor, and GitHub Copilot. Install [Laravel Boost](https://laravel.com/docs/ai) to supercharge your AI workflow:

```bash
composer require laravel/boost --dev

php artisan boost:install
# Live HMR during frontend development
npm run dev
```

Boost provides your agent 15+ tools and skills that help agents build Laravel applications while following best practices.
## Demo Credentials (`password`)

## Contributing
| Role | Email | Notes |
| :--- | :--- | :--- |
| **Owner** | `owner@pharmacore.test` | Member of 2 pharmacies (`GreenLife Pharmacy & Diagnostics` & `CarePlus Medico Hub`) for testing Workspace Switching |
| **Pharmacist** | `pharmacist@pharmacore.test` | Licensed Pharmacist access |
| **Cashier** | `cashier@pharmacore.test` | POS Cashier access (restricted from branch/team management) |

Thank you for considering contributing to the Laravel framework! The contribution guide can be found in the [Laravel documentation](https://laravel.com/docs/contributions).
## SaaS Starter Architecture

## Code of Conduct

In order to ensure that the Laravel community is welcoming to all, please review and abide by the [Code of Conduct](https://laravel.com/docs/contributions#code-of-conduct).

## Security Vulnerabilities

If you discover a security vulnerability within Laravel, please send an e-mail to Taylor Otwell via [taylor@laravel.com](mailto:taylor@laravel.com). All security vulnerabilities will be promptly addressed.

## License

The Laravel framework is open-sourced software licensed under the [MIT license](https://opensource.org/licenses/MIT).
- **Tenant Context & ORM Scoping:**
  - `App\Support\TenantContext` stores the active `Pharmacy`, `Branch`, and `role`.
  - `App\Http\Middleware\EnsureTenantContext` validates active memberships and redirects un-onboarded users to `/onboarding/pharmacy`.
  - `App\Models\Concerns\BelongsToPharmacy` attaches `PharmacyScope` globally and stamps `pharmacy_id` automatically on model creation.
- **Role-Based Access Control:** `App\Enums\TenantRole` (`owner`, `manager`, `pharmacist`, `cashier`) + `tenant.role` middleware.
- **Database Schema:** `plans`, `pharmacies`, `branches`, `subscriptions`, `pharmacy_user`, `medicine_categories`, `suppliers`, `medicines`, `medicine_batches`, `customers`, `sales`, `sale_items`, and `audit_logs` (`jsonb`).
- **Workspace Provisioning:** `App\Services\TenantProvisioningService` atomically provisions new pharmacy tenants, main branches, default categories, 14-day trials, and audit records.
