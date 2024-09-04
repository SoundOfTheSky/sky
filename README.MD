# Sky
Backend for my website. Accessible here: https://soft-sky.ru

Main focus of this website is to teach myself japanese and other little tools.

## Stack
- BunJS
- SQLite

## Notable stuff
- WebAuthn authentication
- SRS like learning system
- Backups
- Sessions
- WebSocket

## Code & style
Project uses Bun for package management, running & building.

### Linters
1. Prettier - basic code style
2. ESLint - code analyze and style (prettier integrated)

### Imports
Please use global imports and follow the order:
1. Package imports
2. Global imports
3. Relative imports

### Database
SQLite accessed through Bun. Uses foreign keys, CASCADE deletes, create time and update time with triggers. Main module for database located in services. Database backups to YandexDisk's cloud storage.

### Routes
Routes automatically parsed to HTTP routes, no need for import.