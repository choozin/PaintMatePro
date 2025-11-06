# PaintPro - Painting Business Management Platform

A comprehensive SaaS application designed for painting companies to manage quotes, projects, clients, and scheduling.

## Features

- 🎨 **Project Management**: Track painting projects from quote to completion
- 📐 **Room Measurements**: Manual entry with AR camera-assisted scanning on mobile devices
- 💰 **Quote Generation**: Automated quote creation with room-by-room breakdowns
- 👥 **Client Management**: Organize and track client information
- 📱 **AR Room Scanning**: WebXR-powered room measurement with cascading fallback support
- 🔐 **Multi-tenant**: Organization-based access control with Firebase Authentication
- 📊 **Entitlements System**: Feature flags for tiered pricing (Free, Pro, Enterprise)

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for blazing-fast development and optimized builds
- **Wouter** for client-side routing
- **TanStack Query** for server state management
- **shadcn/ui** + **Radix UI** for accessible components
- **Tailwind CSS** for styling
- **Three.js** for AR visualization

### Backend
- **Express.js** serverless API
- **Firebase Firestore** for real-time database
- **Firebase Authentication** for user management
- **Firebase Storage** for file uploads
- **Firebase Cloud Functions** for serverless backend operations

### AR Technology
- **WebXR Device API** for immersive AR experiences
- Cascading fallback system: hit-test → plane-detection → pose-based → manual
- Compatible with Android devices (Chrome browser)

## Getting Started

### Prerequisites
- Node.js 18.x or higher
- npm or yarn
- Firebase account

### Installation

1. Clone the repository:
```bash
git clone https://github.com/YOUR_USERNAME/paintpro.git
cd paintpro
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env` file in the root directory:
```env
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_APP_ID=your_firebase_app_id
VITE_FIREBASE_PROJECT_ID=your_firebase_project_id
SESSION_SECRET=your_session_secret
```

4. Start the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:5000`

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete deployment instructions to Vercel.

### Quick Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/paintpro)

## Project Structure

```
paintpro/
├── client/                 # Frontend React app
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── pages/         # Page components
│   │   ├── lib/           # Utilities and Firebase config
│   │   └── contexts/      # React contexts (Auth, etc.)
├── server/                # Express backend
│   ├── index.ts           # Main server entry
│   └── vite.ts            # Vite dev server integration
├── api/                   # Vercel serverless functions
│   └── index.js           # API entry point
├── shared/                # Shared types and schemas
├── public/                # Static assets
└── dist/                  # Production build output

```

## Features in Detail

### AR Room Scanning
- Automatically detects device AR capabilities
- Three scanning modes:
  - **Hit-test**: Most accurate, uses WebXR hit-testing
  - **Plane-detection**: Falls back to plane detection
  - **Pose-based**: Calibrated floor plane for basic devices
- Friendly fallback to manual entry on unsupported devices

### Quote Management
- Automatic material calculations (paint coverage, coats)
- Labor estimation based on square footage
- Configurable tax rates and validity periods
- Room-by-room breakdowns
- PDF export capabilities

### Multi-Tenancy
- Organization-based data isolation
- Role-based access control (owner, admin, member)
- Custom claims via Firebase Authentication

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Run production build locally
- `npm run check` - Type check with TypeScript

## Browser Support

- **Desktop**: Chrome, Firefox, Safari, Edge (latest 2 versions)
- **Mobile**: Chrome on Android (for AR features), Safari on iOS

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see [LICENSE](LICENSE) for details

## Support

For issues and questions:
- Create an issue in this repository
- Contact: your-email@example.com

## Acknowledgments

- Built with [Vite](https://vitejs.dev/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- AR powered by [WebXR](https://www.w3.org/TR/webxr/)
- Backend infrastructure by [Firebase](https://firebase.google.com/)
