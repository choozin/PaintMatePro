# PaintMatePro

PaintMatePro is a comprehensive, production-grade, offline-first quoting and project management application for professional painting companies. It is designed to be a native mobile application for both Android and iOS.

## Features

- **AR-Powered Measurements:** Use your device's camera to capture room dimensions and automatically calculate surface areas.
- **Offline-First Quoting:** Create, edit, and manage quotes directly on-site, with or without an internet connection.
- **Client & Project Management:** Keep track of all your clients and the projects associated with them.
- **Crew Scheduling:** A visual calendar to schedule jobs and assign crew members.
- **Client Portal:** A secure portal for clients to view project details, approve quotes, and make payments.

## Tech Stack

- **Frontend:** [React](https://react.dev/) (with [Vite](https://vitejs.dev/))
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Backend & Database:** [Firebase](https://firebase.google.com/) (Authentication, Firestore, Storage, and Functions)
- **Native Mobile:** [Capacitor](https://capacitorjs.com/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/) with [shadcn/ui](https://ui.shadcn.com/) components

For a more detailed breakdown of the architecture, see [ARCHITECTURE.md](./ARCHITECTURE.md).

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (LTS version)
- [pnpm](https://pnpm.io/) (or npm/yarn)

### Installation

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd PaintMatePro
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up Firebase:**
    - Create a new Firebase project in the [Firebase Console](https://console.firebase.google.com/).
    - Enable Authentication, Firestore, and Storage.
    - Copy your Firebase project configuration.
    - Create a `.env` file in the `client` directory (`client/.env`) and add your Firebase configuration keys there. You can use `client/.env.example` as a template.

4.  **Run the development server:**
    ```bash
    npm run dev
    ```

The application will be available at `http://localhost:5173` (or another port if 5173 is in use).