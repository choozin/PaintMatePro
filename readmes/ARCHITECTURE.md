# Architecture Overview

This document provides a high-level overview of the PaintMatePro application's architecture.

## Core Technologies

- **Frontend:** [React](https://react.dev/) (with [Vite](https://vitejs.dev/))
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Backend & Database:** [Firebase](https://firebase.google.com/) (Authentication, Firestore, Storage, and Functions)
- **Native Mobile:** [Capacitor](https://capacitorjs.com/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/) with [shadcn/ui](https://ui.shadcn.com/) components

## Project Structure

- **`/client`**: Contains the main React application. This is the core of the project.
  - **`/client/src/components`**: Reusable React components.
  - **`/client/src/pages`**: Top-level page components that correspond to application routes.
  - **`/client/src/lib`**: Core logic, including Firebase integration (`firebase.ts`, `firestore.ts`), utility functions, and type definitions.
  - **`/client/src/hooks`**: Custom React hooks for managing state and side effects, particularly for data fetching from Firestore.
- **`/functions`**: Houses the code for [Firebase Functions](https://firebase.google.com/docs/functions), used for backend logic that cannot be run on the client (e.g., processing payments, sending notifications, managing user roles).
- **`/shared`**: Contains code that is intended to be shared between the frontend client and the Firebase Functions. This is currently empty but may be used in the future.
- **`/readmes`**: Project documentation, including this file.

## Data Flow

1.  **Authentication:** User authentication is handled entirely by **Firebase Authentication**. The client-side code in `/client/src/lib/firebaseAuth.ts` and the `/client/src/contexts/AuthContext.tsx` manage the user's session.
2.  **Data Persistence:** All application data (Projects, Clients, Quotes, etc.) is stored in **Cloud Firestore**. The client interacts directly with Firestore using the helper functions defined in `/client/src/lib/firestore.ts`.
3.  **Business Logic:** Most of the business logic resides within the React components and hooks on the client side. For sensitive operations or tasks requiring elevated privileges, **Firebase Functions** are used.
4.  **Native Functionality:** **Capacitor** is used to wrap the web application into a native shell for Android and iOS. This allows the app to be deployed to the app stores and to access native device features (like the camera for the AR functionality).
