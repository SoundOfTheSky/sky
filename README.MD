# SKY
Backend for my website. Accessible here: https://softsky.site

Main focus of this website is to teach myself japanese and other little tools. Many subsystems called after Norse mythology, bare with it.

## Yggdrasil (authentication)
To access website you must first pass through Yggdrasil. Yggrasil gives you session which may include your authentication details. Authentication is not mundatory.

Yggdrasil protects website and users alike from bots and hackers.

## Mímir (Study)
Mímir is a SRS (Spaced Repetition System) study tool. Based on tool called Anki and tailored for learning Japanese language.

## Ginnungagap (File Storage)
Ginnungagap is a file storage. It allows users to upload any kind of file similar to Cloud Storage. Ginnungagap also can convert a bunch of file formats, optimize image and video files, and also serve files though direct link.

## Tíð (Planner tool)
Tíð is a planner tool. It allows to create events like any other planner tool out there but with minor additions. It has a feature to add geolocation to any event and even plan the road you need to take to get somethere. I used this to plan my visit to Japan. It really helps to plan a route to visit everything I want most effeciently.

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

### Weird
Used for weird stuff that I use mainly for bulk data processing.