.PHONY: up down logs migrate test build dev typecheck autoload

up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f app

autoload:
	docker exec pharmacy-saas-app composer dump-autoload

migrate:
	docker exec pharmacy-saas-app php artisan migrate --force

test:
	docker exec pharmacy-saas-app php artisan test

build:
	cd apps/pharmacy-web && npm run build

dev:
	cd apps/pharmacy-web && npm run dev

typecheck:
	cd apps/pharmacy-web && npm run typecheck

