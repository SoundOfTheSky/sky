# SKY
Backend for my website. Accessible here: https://softsky.site

Main focus of this website is to teach myself japanese and other little tools. Many subsystems called after Touhou characters.
## Subsystems

### Remilia (Database)
Remilia is the heart of this project.
She is a SQLite database in WAL mode.

### Marisa (Session & Authentication)
To access website you must first pass through Marisa.
Marisa gives you JWT session. This JWT session may be authenticated or not.
Marisa automatically refreshes tokens and checks permissions.

### Reimu (Protection)
Marisa and Reimu work closely together. While Marisa is managing sessions, Reimu checks these sessions and protect website if any suspicious activity is found.


### Pathouli (Study)
Pathouli is a SRS (Spaced Repetition System) study tool. Based on tool called Anki and tailored for learning Japanese language but may be used for anything.

### Sakuya (Planner tool) [TODO]
Sakuya is a planner tool. It allows to create events like any other planner tool out there but with minor additions. It has a feature to add geolocation to any event and even plan the road you need to take to get somethere. It really helps to plan a route to visit everything I want most effeciently.

### Chiruno (Tools)
Used for weird stuff that I use mainly for bulk data processing.

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