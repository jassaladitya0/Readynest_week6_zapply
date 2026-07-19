# ⚡ Zapply Chat

Zapply Chat is a production-ready, highly secure, real-time messaging application designed with privacy first. It features end-to-end encryption (E2E), 24-hour message/story auto-deletion, WebRTC audio/video calling, and a secure administration panel.

To guarantee complete privacy, **only user credentials and public keys are stored in the database**. Chat history, media attachments, call logs, and status updates are stored **exclusively on the user's local device** (using IndexedDB) and auto-delete after 24 hours.

---

## 🚀 Key Features

*   **🔐 End-to-End Encryption (E2E)**: Messages are encrypted client-side using **TweetNaCl.js** (X25519 Diffie-Hellman key exchange & XSalsa20-Poly1305 payload encryption). Private keys never leave the user's device.
*   **⏳ 24h Auto-Delete**: All messages, media, and status updates have a strict 24-hour TTL (Time To Live). A background Service Worker & IndexedDB cleanup process prunes expired items automatically.
*   **📞 WebRTC Audio & Video Calls**: Crystal-clear calling powered by WebRTC with signaling handled in real-time via Socket.IO.
*   **📸 Status Stories**: Share text and media updates that automatically vanish after 24 hours.
*   **📡 Channels**: Discover and follow public announcement channels.
*   **🛡️ Secure Admin Control Panel**: Protected via username, password, and a secondary secret key to moderate reports, warn/suspend/delete users, and audit admin actions.

---

## 🛠️ Tech Stack

### Frontend (Client)
*   **Core**: React (TypeScript) + Vite
*   **Styling**: Vanilla CSS + Framer Motion (for premium fluid animations)
*   **Database**: IndexedDB (via Dexie.js) for secure, local-only storage
*   **Real-time**: Socket.IO Client
*   **Crypto**: TweetNaCl.js & tweetnacl-util

### Backend (Server)
*   **Runtime**: Node.js & Express
*   **Database**: MongoDB (Mongoose) — *for credentials, public keys, and logs only*
*   **Signaling & Events**: Socket.IO
*   **Security**: JSON Web Tokens (Access/Refresh flow), bcrypt, Helmet (CSP)

---

## 📁 Project Structure

```
zapply/
├── client/                 # React & Vite Frontend
│   ├── src/
│   │   ├── components/     # UI components (Sidebar, Call UI, Modals)
│   │   ├── hooks/          # Custom React hooks (useSocket, useWebRTC)
│   │   ├── lib/            # Utility libraries (api, crypto, db, socket)
│   │   ├── pages/          # Pages (Landing, Chats, Status, Settings, Admin)
│   │   ├── store/          # Zustand state management
│   │   └── types/          # TypeScript interface definitions
│   └── public/             # Service Worker & PWA Manifest
│
├── server/                 # Express & Socket.IO Backend
│   ├── middleware/         # Auth and rate-limiting middleware
│   ├── models/             # Mongoose schemas (User, Report, AdminAction)
│   ├── routes/             # REST API controllers
│   ├── socket/             # Socket.IO handlers
│   └── utils/              # JWT & Crypto helper utilities
```

---

## 💻 Local Setup & Installation

### Prerequisites
*   Node.js (v18+)
*   MongoDB Instance (Local or MongoDB Atlas)

### Step 1: Clone the repository
```bash
git clone https://github.com/jassaladitya0/Readynest_week6_zapply.git
cd Readynest_week6_zapply
```

### Step 2: Configure Server Environment
Navigate to the `server/` directory, create a `.env` file (refer to `.env.example`), and configure:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/zapply
JWT_SECRET=your_jwt_secret_key
JWT_REFRESH_SECRET=your_jwt_refresh_secret_key
ADMIN_SECRET_KEY=your_admin_secret_key
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin_password
```
Install dependencies and start the backend:
```bash
cd server
npm install
npm start
```

### Step 3: Configure Client Environment
Navigate to the `client/` directory and configure the environment variables in a `.env` file:
```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```
Install dependencies and start the Vite dev server:
```bash
cd ../client
npm install
npm run dev
```

---

## 🌐 Deployment Configuration

### Frontend (Vercel)
The client includes a `vercel.json` config file ready for production deployment. Make sure to set:
*   `VITE_API_URL`: Your backend URL (e.g. `https://zapply-api.onrender.com/api`)
*   `VITE_SOCKET_URL`: Your backend socket URL (e.g. `https://zapply-api.onrender.com`)

### Backend (Render)
A `render.yaml` blueprint config is included. You can deploy directly on Render using the blueprint template, which spins up the Node service and connects it to the configured MongoDB instance.

---

## 🔒 Security Practices

1.  **Zero-Knowledge History**: Direct message payloads are encrypted using recipient public keys before being sent over Socket.IO. The server acts purely as a relay.
2.  **No Message Logs**: The server database contains no collection for messages, media, or calls.
3.  **Local Encryption**: The private key is stored in the browser's local storage, protected using the user's password hash.
4.  **JWT Rotation**: Short-lived Access Tokens paired with secure HttpOnly / local Refresh Tokens to prevent session hijacking.
