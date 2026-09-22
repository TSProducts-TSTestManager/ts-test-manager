# Frontend - TSTestManager

This is the frontend application for TSTestManager, built with React, TypeScript, Vite, and Tailwind CSS. Features real-time collaborative editing, comprehensive test management UI, and analytics dashboards.

## Development

### Local Development

From the root directory:
```bash
npm run dev  # Start backend
cd frontend && npm run dev  # Start frontend (separate terminal)
```

Or from this directory:
```bash
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`

### Environment Variables

For **local development**, no environment variables needed. The frontend automatically uses `http://localhost:5000/api` as the API URL.

For **production/Hostinger deployment**, create a `.env` file in this directory:

```bash
# Backend API URL (your Hostinger backend URL)
VITE_API_URL=https://api.yourdomain.com/api
```

See `.env.example` in this directory for reference.

## Deployment

### Deploy to Hostinger Linux VPS (Recommended)

Build static and serve via Nginx, Docker, or Hostinger VPS:

```bash
npm run build      # vite build -> dist/
# with Docker (nginx)
docker build -t ts-test-manager-frontend .
docker run -d -p 80:80 ts-test-manager-frontend
```

On Hostinger VPS, set `VITE_API_URL=https://api.yourdomain.com/api` and `ALLOWED_ORIGINS=https://yourdomain.com` on backend.

📖 **[Hostinger Linux Deployment →](../ts-test-manager-docs/Documentation/Deployment/HOSTINGER_LINUX_DEPLOYMENT.md)** (docs repo)

**Important:** 
1. Build produces `dist/` static files
2. Add `VITE_API_URL` with your backend URL

### Deploy to Traditional Hosting

For traditional hosting, deploy `dist/` to any static host (Nginx, Hostinger, S3+CloudFront).

Docs are in `ts-test-manager-docs/Documentation/`.

## Building

```bash
npm run build
```

Builds the app for production to the `dist` folder.

## Features

### Authentication
- 🔐 Email/Password signup and login
- � Google OAuth 2.0 integration
- ✅ Email verification with OTP
- 🔄 Password reset flow
- 🔒 Change password functionality
- 🛡️ Protected routes

### UI Components
- � Modern, responsive design with Tailwind CSS
- ✨ Smooth animations with Framer Motion
- � Password strength meter
- 🔔 Toast notifications with react-hot-toast
- � Lucide React icons

### Pages
- 🏠 Dashboard with analytics
- ⚙️ Settings page with tabs
- 📧 Email verification page
- 🔑 Login/Signup pages
- 🔄 Password reset pages
- � Google OAuth redirect handler

### State Management
- Zustand for global auth state
- Persistent authentication
- Automatic token refresh

### Real-Time Collaboration
- 📡 **Socket.io Client** - WebSocket connection for live updates
- 👥 **Collaborative Editing** - Google Docs-style live field editing
- 🟢 **Presence Indicators** - See who else is viewing/editing
- 🔄 **Live Sync** - Automatic UI updates when others make changes

Key real-time files:
- `src/services/socket.ts` - Socket.io client singleton
- `src/hooks/useRealtimeTestCases.ts` - List-level live updates
- `src/hooks/useCollaborativeEditing.ts` - Field-level collaboration

## Project Structure (Frontend repo `ts-test-manager`)

```
├── src/
│   ├── components/
│   │   ├── AppLayout.tsx
│   │   ├── FloatingShape.tsx
│   │   ├── GoogleLoginButton.tsx
│   │   ├── Header.tsx
│   │   ├── Input.tsx
│   │   ├── LoadingSpinner.tsx
│   │   ├── PasswordStrengthMeter.tsx
│   │   ├── Sidebar.tsx
│   │   └── SidebarMenuLayout.tsx
│   ├── pages/
│   │   ├── ChangePasswordPage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── EmailVerificationPage.tsx
│   │   ├── ForgotPasswordPage.tsx
│   │   ├── LoginPage.tsx
│   │   ├── OAuthRedirect.tsx
│   │   ├── ResetPasswordPage.tsx
│   │   ├── SettingsPage.tsx
│   │   ├── SignUpPage.tsx
│   │   └── [dashboard sections]/
│   ├── store/
│   │   └── authStore.ts         # Zustand state management
│   ├── types/
│   │   ├── api.types.ts
│   │   ├── auth.types.ts
│   │   ├── component.types.ts
│   │   ├── store.types.ts
│   │   └── user.types.ts
│   ├── utils/
│   │   └── date.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── public/
├── .env.example                 # Example environment variables
├── nginx.conf                   # Nginx config for Hostinger Docker
├── Dockerfile                   # Frontend nginx image
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── tsconfig.json
└── vite.config.js
```

## API Configuration

The frontend automatically configures the API URL based on the environment:

```typescript
const API_URL =
    import.meta.env.MODE === "development"
        ? "http://localhost:5000/api"
        : import.meta.env.VITE_API_URL
            ? import.meta.env.VITE_API_URL
            : "/api";
```

- **Development**: Uses `http://localhost:5000/api`
- **Production with VITE_API_URL**: Uses the configured URL (for separate deployment)
- **Production without VITE_API_URL**: Uses relative `/api` (for monolithic deployment)

All auth endpoints are accessed by appending `/auth` to the base API URL (e.g., `${API_URL}/auth/login`).

## Technologies

- **React** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **Framer Motion** - Animation library
- **React Router** - Client-side routing
- **Zustand** - State management
- **Axios** - HTTP client
- **React Hot Toast** - Toast notifications
- **Lucide React** - Icon library
- **Recharts** - Charts and data visualization

## Development Tips

### Type Checking

```bash
npm run type-check
```

Checks TypeScript types without emitting files.

### Linting

```bash
npm run lint
```

Runs ESLint to check code quality.

### Preview Production Build

```bash
npm run build
npm run preview
```

Build and preview the production version locally.

### Hot Module Replacement (HMR)

Vite provides fast HMR during development. Changes to React components update instantly without full page reload.

## Responsive Design

The application is fully responsive and works on:
- 📱 Mobile devices
- 📱 Tablets
- 💻 Desktops
- 🖥️ Large screens

## Browser Support

Supports all modern browsers:
- Chrome
- Firefox
- Safari
- Edge

## Environment Variables

### Development

No environment variables needed for local development.

### Production (Separate Deployment — Hostinger)

Required:
- `VITE_API_URL` - Backend API URL (e.g., `https://api.yourdomain.com/api`)

## Security

- ✅ Credentials sent with all requests (HTTP-only cookies)
- ✅ CORS configured for backend domain
- ✅ Protected routes with authentication checks
- ✅ Secure OAuth flow with state parameter
- ✅ XSS protection via React's built-in escaping
- ✅ No sensitive data in localStorage

## Performance

- ⚡ Vite for fast builds and HMR
- 📦 Code splitting with React.lazy (if implemented)
- 🗜️ Minification and compression
- 🎯 Tree shaking for smaller bundles
- 🚀 Deployed via Nginx on Hostinger Linux VPS

## Troubleshooting

### API Connection Issues

If the frontend can't connect to the backend:
1. Check `VITE_API_URL` is set correctly in production
2. Verify backend is deployed and accessible
3. Check browser console for CORS errors
4. Ensure backend `CLIENT_URL` includes your frontend URL

### Build Errors

If the build fails:
1. Run `npm run type-check` to find TypeScript errors
2. Run `npm run lint` to find linting issues
3. Clear `node_modules` and reinstall: `rm -rf node_modules && npm install`

### Google OAuth Not Working

If Google login fails:
1. Check Google Cloud Console has correct redirect URIs
2. Verify backend `GOOGLE_REDIRECT_URI` is correct
3. Check frontend can reach backend API
4. Clear cookies and try again

## Support

For deployment issues, see Hostinger guide in `ts-test-manager-docs/Documentation/Deployment/HOSTINGER_LINUX_DEPLOYMENT.md`.

---

**Built with React + Vite + TypeScript** ⚡
