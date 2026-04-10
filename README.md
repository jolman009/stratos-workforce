<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Stratos Workforce

Workforce scheduling, clock tracking, notifications, and time-off management built with React, Vite, and a local Express + SQLite API.

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Start the local API in one terminal:
   `npm run dev:server`
3. Start the Vite app in a second terminal:
   `npm run dev:client`

The front end hydrates from `GET /api/state`, sends targeted mutations to the local API when it is available, and falls back to browser storage when it is not.

## Planning

The implementation roadmap lives in [docs/phased-implementation-report.md](docs/phased-implementation-report.md).
