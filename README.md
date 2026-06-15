# 🚀 DSA Mastery

DSA Mastery is a high-performance, developer-centric React application engineered to help software engineers systematically prepare for technical interviews. The platform integrates pattern-based tracking, automated spaced-repetition scheduling, Google Drive study material integration, and real-time cloud synchronization to deliver an optimal preparation workflow.

---

## ⚡ Quick Stats

[![React](https://img.shields.io/badge/React-19.0.0-61DAFB?logo=react&logoColor=white&style=flat-square)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.0.12-646CFF?logo=vite&logoColor=white&style=flat-square)](https://vitejs.dev/)
[![Firebase](https://img.shields.io/badge/Firebase-12.14.0-FFCA28?logo=firebase&logoColor=black&style=flat-square)](https://firebase.google.com/)
[![Zustand](https://img.shields.io/badge/Zustand-5.0.14-8A63D2?style=flat-square)](https://github.com/pmndrs/zustand)
[![Google Drive](https://img.shields.io/badge/Google_Drive-v3-4285F4?logo=googledrive&logoColor=white&style=flat-square)](https://developers.google.com/drive)

---

## 📋 Table of Contents

- [🎯 Key Features](#-key-features)
- [📁 Directory Structure](#-directory-structure)
- [💻 Tech Stack & Architecture Rationale](#-tech-stack--architecture-rationale)
- [🛡️ Security Architecture](#️-security-architecture)
- [🚀 Getting Started](#-getting-started)
- [🛠️ Project Scripts](#️-project-scripts)
- [📄 License](#-license)

---

## 🎯 Key Features

- **Pattern-Based Tracking:** Groups algorithmic problems into foundational mental models (e.g., Two Pointers, Sliding Window, DFS/BFS) rather than arbitrary lists, optimizing conceptual retention.
- **Automated Spaced-Repetition Scheduler:** Implements structured revision intervals (1, 3, 7, 15, and 30 days) based on cognitive science principles, prompting reviews of solved questions to lock in problem-solving intuition.
- **GitHub-Style Solve Heatmap:** Provides a visual, calendar-based activity matrix mapping daily solve statistics to cultivate consistency and track streaks.
- **Rich Interactive Workspace (Notes):** Allows developers to document key insights, optimal time/space complexity benchmarks, potential pitfalls, and clean code snippets directly on each problem. 
- **Google Drive Study Sync:** 
  - **Auto-Folder Structuring:** Authenticates via Google Identity Services and automatically creates a structured nested directory path `DSA Mastery / [Topic] / [Question or Concept Name]` in the user's Drive.
  - **Concept-Level Study Hubs:** Supports creating study notes and syncing files for algorithms themselves (e.g., Two Pointers concept) directly from the Roadmap list.
  - **Custom Native File Explorer:** Queries the active Drive folder, displays user files (Docs, Sheets, Slides, PDFs, drawings, and images) with clean type-specific icons, and renders them in-app via an embeddable iframe preview.
  - **Backdrop-Blurred Upload Overlay:** Renders a premium backdrop blur modal (`rgba(10, 10, 15, 0.75)` with `12px` blur) that handles drag-and-drop or manual file picking, launching background uploads with concurrent queue statuses.
- **Custom Question Registry:** Enables users to extend the default problem set by registering custom interview questions tagged with difficulty, algorithmic topics, target companies, and urgency levels.
- **Real-Time Cloud Sync & Offline Support:** Combines local Zustand store state persistence with background Firebase Firestore sync, enabling seamless transitions between online and offline states.

---

## 📁 Directory Structure

A walk-through of the main codebase directory tree:

```text
dsa-sheet/
├── .env                    # Local environment variables configuration
├── firestore.rules         # Security access control rules for Firestore
├── index.html              # Single Page Application root markup
├── vite.config.js          # Vite build and plugin configurations
├── src/
│   ├── main.jsx            # Application entrypoint
│   ├── App.jsx             # Core router and component container layout
│   ├── index.css           # Global design system tokens and UI styling
│   ├── firebaseClient.js   # Initialization of Firebase App, Auth, and Firestore
│   ├── data/               # Static dataset declarations
│   │   ├── patterns.js     # Definitions for algorithm patterns
│   │   ├── questions.js    # Master list of curated interview questions
│   │   ├── roadmap.js      # Structured topic sequence and guide data
│   │   └── topics.js       # Mapping of DSA topics
│   ├── services/           # External service integration logic
│   │   └── dbSync.js       # Real-time state syncing wrapper between Zustand & Firestore
│   ├── utils/              # Shared helper modules
│   │   ├── googleDrive.js  # REST API wrappers for Drive searching, creation, and uploads
│   │   ├── helpers.jsx     # App UI helpers, icons, and links mapping
│   │   └── markdown.js     # Lightweight markdown-to-HTML parsing engine
│   └── store/              # Global state managers powered by Zustand
│       ├── useGoogleAuthStore.js # Google OAuth2 access token and session lifecycle store
│       ├── useNotesStore.js     # State persistence for problem & concept notes
│       ├── useProgressStore.js  # State manager for user status, bookmarks, and streaks
│       ├── useRevisionStore.js  # Scheduler logic for upcoming/due reviews
│       └── useThemeStore.js     # Management of light/dark theme preference
└── public/                 # Static assets directory
```

---

## 💻 Tech Stack & Architecture Rationale

### Frontend Layer
- **React 19 & React Router DOM 7:** Utilizes React's latest engine for rendering optimization and declarative route management.
- **Zustand 5:** Chosen for high-performance, boilerplate-free state management. It handles client-side updates instantly and persists data locally inside `localStorage` for zero-latency startups.
- **Google Identity Services (GIS) & Google Drive API v3:** Handles seamless user authorization and secure resource syncing directly into their personal cloud storage under granular scopes.

### Cloud Backend Layer
- **Firebase Authentication:** Handles password verification, session tokens, and user sign-ups securely. Sensitive credentials never hit application databases.
- **Cloud Firestore:** A scalable document database that acts as a secure, real-time persistence layer. Firestore's client SDK allows offline caching and seamless synchronization when internet connectivity changes.

### State Synchronization Engine (`src/services/dbSync.js`)
- Employs a **Local-First, Cloud-Synced** architecture. User interaction updates are applied instantaneously to the local state (Zustand), followed by non-blocking, asynchronous database writes to Firestore.
- Handles data hydration automatically on user authentication, merging local state with cloud-stored values and healing discrepancies (e.g., re-calculating solve histories or current streaks).

---

## 🛡️ Security Architecture

The application implements strict document-level security rules in [firestore.rules](file:///Users/danush/Documents/Projects/DSA%20sheet/firestore.rules) to ensure data privacy:

- **Users Collection (`/users/{uid}`):** Publicly readable to check profile details, but write operations are limited strictly to the authenticated document owner matching the UID.
- **Username Reservations (`/usernames/{username}`):** Serves as a unique lookup registry preventing duplicates during sign-ups. Read-write access is restricted to the username owner, and directly modifying entries is forbidden (they must be deleted and recreated).
- **Workspace Documents (`/user_progress`, `/user_notes`, `/user_revisions`, `/custom_questions`):** Protected by query-level filters ensuring that users can only read or write documents where `resource.data.uid == request.auth.uid`.

---

## 🚀 Getting Started

Follow these steps to run the project locally for development:

### Prerequisites
- Node.js (version 18 or higher recommended)
- A Firebase Project (with Email/Password Authentication and Firestore Database enabled)
- A Google Cloud Developer Console project with the Google Drive API enabled and OAuth 2.0 Web Client credentials configured.

### Local Setup Instructions

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd "DSA sheet"
   ```

2. **Install project dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in the root directory and populate it with your Firebase and Google project credentials:
   ```env
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id
   ```

4. **Launch the Development Server:**
   ```bash
   npm run dev
   ```
   Open your browser and navigate to the local URL (usually `http://localhost:5173`).

5. **Build for Production:**
   ```bash
   npm run build
   ```
   The production-ready bundle will be outputted to the `dist` directory.

---

## 🛠️ Project Scripts

The following npm scripts are available:

- `npm run dev`: Runs the application in development mode with Hot Module Replacement (HMR).
- `npm run build`: Compiles and optimizes the React codebase for production deployment.
- `npm run lint`: Analyzes code quality using ESLint configured in `eslint.config.js`.
- `npm run preview`: Statically serves the locally built production output for verification.

---

## 📄 License

This project is private and proprietary. All rights reserved.
