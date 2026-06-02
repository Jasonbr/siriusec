.PHONY: build up down reset logs users status nodes

build:
	docker compose build

up:
	docker compose up -d

down:
	docker compose down

reset: down
	docker compose down -v

logs:
	docker compose logs -f

# Create a new admin user (prints invite URL)
users:
	docker compose exec auth sctl -c /etc/siriusec/auth.yaml users add admin --roles=admin,access,editor

# Reset admin password (prints reset URL)
reset-password:
	docker compose exec auth sctl -c /etc/siriusec/auth.yaml users reset admin

status:
	docker compose exec auth sctl -c /etc/siriusec/auth.yaml status

nodes:
	docker compose exec auth sctl -c /etc/siriusec/auth.yaml nodes ls

ping:
	curl -sk https://localhost:3080/webapi/ping | python3 -m json.tool

shell-auth:
	docker compose exec -it auth /bin/bash

shell-proxy:
	docker compose exec -it proxy /bin/bash

shell-node:
	docker compose exec -it node /bin/bash
