# WhatsApp SaaS Platform

A complete SaaS platform for selling services through WhatsApp using AI-powered conversations. Built with Node.js, Next.js, PostgreSQL, and Baileys.

## Features

### Core Features
- **WhatsApp Integration**: Connect multiple WhatsApp accounts using Baileys (unofficial WhatsApp Web API)
- **AI-Powered Conversations**: Automated customer support using multiple AI providers (Claude, Gemini, Groq, Cohere)
- **Service Management**: Create and manage services with customizable packages
- **Order Processing**: Complete order lifecycle from creation to completion
- **Payment Verification**: Manual payment verification with EasyPaisa, JazzCash, and bank transfers
- **Admin Dashboard**: Full-featured Next.js dashboard for managing all aspects of the platform

### Technical Features
- Real-time updates via Socket.io
- Multi-provider AI with automatic failover and daily limits
- Rate limiting and anti-ban measures for WhatsApp
- Secure session management
- Comprehensive audit logging
- RESTful API with Zod validation

## Tech Stack

### Backend
- Node.js 18+ with Express.js
- TypeScript (strict mode)
- PostgreSQL with Prisma ORM
- Socket.io for real-time communication
- Baileys for WhatsApp Web API
- Multiple AI providers (Claude, Gemini, Groq, Cohere)
- Cloudinary for media storage

### Frontend
- Next.js 14 (App Router)
- React 18
- Tailwind CSS
- Socket.io Client
- SWR for data fetching

## Project Structure

```
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma     # Database schema
│   │   └── seed.ts           # Database seeding
│   └── src/
│       ├── config/           # Configuration files
│       ├── controllers/      # Route controllers
│       ├── middleware/       # Express middleware
│       ├── routes/           # API routes
│       ├── services/         # Business logic
│       ├── types/            # TypeScript types
│       ├── utils/            # Utility functions
│       ├── websocket/        # Socket.io handlers
│       └── index.ts          # Application entry point
├── frontend/
│   └── src/
│       ├── app/              # Next.js pages (App Router)
│       ├── components/       # React components
│       ├── hooks/            # Custom React hooks
│       ├── lib/              # Utilities and API client
│       └── types/            # TypeScript types
└── README.md
```

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL database (recommended: Neon)
- Cloudinary account
- At least one AI provider API key

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Selling-service-on-whatsapp
   ```

2. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Configure backend environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Set up database**
   ```bash
   # Generate Prisma client
   npm run db:generate

   # Push schema to database
   npm run db:push

   # Seed initial data
   npm run db:seed
   ```

5. **Install frontend dependencies**
   ```bash
   cd ../frontend
   npm install
   ```

6. **Configure frontend environment**
   ```bash
   cp .env.example .env.local
   # Edit .env.local if needed
   ```

### Running the Application

1. **Start backend** (from backend directory)
   ```bash
   npm run dev
   ```

2. **Start frontend** (from frontend directory)
   ```bash
   npm run dev
   ```

3. **Access the dashboard**
   - Open http://localhost:3000
   - Login with default credentials:
     - Email: admin@example.com
     - Password: Admin@123456

### Connecting WhatsApp

1. Go to WhatsApp section in the dashboard
2. Click "Add Account" to create a new WhatsApp account
3. Click "Connect" to start the connection
4. Scan the QR code with your WhatsApp mobile app
5. The account will show as "Connected" when ready

## Configuration

### Environment Variables

#### Backend (.env)

| Variable | Description | Required |
|----------|-------------|----------|
| DATABASE_URL | PostgreSQL connection string | Yes |
| JWT_SECRET | Secret for JWT tokens (32+ chars) | Yes |
| WHATSAPP_SESSION_SECRET | Secret for session encryption | Yes |
| CLOUDINARY_CLOUD_NAME | Cloudinary cloud name | Yes |
| CLOUDINARY_API_KEY | Cloudinary API key | Yes |
| CLOUDINARY_API_SECRET | Cloudinary API secret | Yes |
| CLAUDE_API_KEY | Anthropic Claude API key | No |
| GEMINI_API_KEY | Google Gemini API key | No |
| GROQ_API_KEY | Groq API key | No |
| COHERE_API_KEY | Cohere API key | No |
| CORS_ORIGIN | Allowed CORS origins | Yes |

#### Frontend (.env.local)

| Variable | Description |
|----------|-------------|
| NEXT_PUBLIC_API_URL | Backend API URL |
| NEXT_PUBLIC_WS_URL | WebSocket URL |

## Deployment

### Render (Free Tier)

#### Backend
1. Create a new Web Service on Render
2. Connect your repository
3. Set build command: `cd backend && npm install && npm run build`
4. Set start command: `cd backend && npm start`
5. Add environment variables from .env.example

#### Frontend
1. Create a new Static Site on Render
2. Connect your repository
3. Set build command: `cd frontend && npm install && npm run build`
4. Set publish directory: `frontend/out`
5. Add environment variables

### Database (Neon)
1. Create a free PostgreSQL database on Neon
2. Copy the connection string to DATABASE_URL

### Cloudinary (Free Tier)
1. Create a free Cloudinary account
2. Copy credentials from the dashboard

## API Documentation

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Register
- `GET /api/auth/profile` - Get profile
- `POST /api/auth/change-password` - Change password

### Services
- `GET /api/services` - List services
- `POST /api/services` - Create service
- `GET /api/services/:id` - Get service
- `PATCH /api/services/:id` - Update service
- `DELETE /api/services/:id` - Delete service

### Packages
- `GET /api/packages` - List packages
- `POST /api/packages` - Create package
- `GET /api/packages/:id` - Get package
- `PATCH /api/packages/:id` - Update package
- `DELETE /api/packages/:id` - Delete package

### Orders
- `GET /api/orders` - List orders
- `GET /api/orders/:id` - Get order
- `PATCH /api/orders/:id/status` - Update order status

### Customers
- `GET /api/customers` - List customers
- `GET /api/customers/:id` - Get customer
- `GET /api/customers/:id/messages` - Get customer messages
- `POST /api/customers/:id/block` - Block customer
- `POST /api/customers/:id/unblock` - Unblock customer

### WhatsApp
- `GET /api/whatsapp` - List accounts
- `POST /api/whatsapp` - Create account
- `POST /api/whatsapp/:id/connect` - Connect account
- `POST /api/whatsapp/:id/disconnect` - Disconnect account
- `POST /api/whatsapp/:id/send` - Send message

### AI Providers
- `GET /api/ai-providers` - List providers
- `POST /api/ai-providers` - Create provider
- `PATCH /api/ai-providers/:id` - Update provider
- `DELETE /api/ai-providers/:id` - Delete provider

### Dashboard
- `GET /api/dashboard/stats` - Get statistics
- `GET /api/dashboard/activity` - Get recent activity
- `GET /api/dashboard/analytics` - Get analytics
- `GET /api/dashboard/health` - System health check

## Security Considerations

- Change default admin password immediately after setup
- Use strong, unique values for JWT_SECRET and WHATSAPP_SESSION_SECRET
- Enable HTTPS in production
- Configure CORS_ORIGIN to your actual frontend domain
- Regularly review audit logs
- Keep dependencies updated

## License

MIT License

## Support

For issues and feature requests, please open an issue on GitHub.
