<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/2d1049f3-0ba3-412c-b7aa-a50e7c908715

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Start the local API in one terminal:
   `npm run dev:server`
4. Start the Vite app in a second terminal:
   `npm run dev:client`

The front end hydrates from `GET /api/state`, sends targeted mutations to the local API when it is available, and falls back to browser storage when it is not.
