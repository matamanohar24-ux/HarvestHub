# HarvestHub 🌱

A mobile marketplace connecting backyard growers in local communities to buy, sell, and exchange home-grown crops.

## Features

### 🔐 Authentication
- Email-based authentication via Auth0 (Emergent Auth)
- Secure session management
- Profile customization with photo upload

### 🌾 Crop Management
- Post crops with multiple photos
- Location-based discovery (5-10 mile radius)
- Real-time distance calculations
- Browse nearby crops on an interactive map
- Secure in-app purchases with Stripe

### 💬 Communication
- Direct messaging between buyers and sellers
- Unread message indicators
- Conversation history

### 💰 Payments & Transactions
- Secure payment processing with Stripe
- Transaction history tracking
- Automatic crop availability updates
- Purchase and sales tracking

### 📱 Community Features
- Social feed with posts and images
- Like and comment on community posts
- Farming history tracking
- Grower profiles with statistics

## Tech Stack

### Frontend
- **Framework**: React Native with Expo
- **Navigation**: Expo Router (file-based routing)
- **State Management**: React Context API
- **UI Components**: Custom components with React Native
- **Authentication**: Auth0 via Emergent Auth
- **Payments**: Stripe React Native SDK
- **Maps**: expo-location, react-native-maps
- **Camera**: expo-image-picker

### Backend
- **Framework**: FastAPI
- **Database**: MongoDB with Motor (async driver)
- **Authentication**: Auth0 token validation
- **Payments**: Stripe API
- **Maps**: Google Maps API

## Project Structure

```
/app
├── backend/
│   ├── server.py              # FastAPI application with all endpoints
│   ├── .env                   # Environment variables (Auth0, Stripe, MongoDB)
│   └── requirements.txt       # Python dependencies
├── frontend/
│   ├── app/
│   │   ├── _layout.tsx        # Root layout with providers
│   │   ├── index.tsx          # Welcome/login screen
│   │   └── (tabs)/            # Tab navigation screens
│   │       ├── feed.tsx       # Community feed
│   │       ├── discover.tsx   # Location-based crop discovery
│   │       ├── post-crop.tsx  # Post new crops
│   │       ├── messages.tsx   # Messaging inbox
│   │       └── profile.tsx    # User profile & settings
│   ├── contexts/
│   │   └── AuthContext.tsx    # Authentication context
│   ├── .env                   # Frontend environment variables
│   └── package.json           # Node dependencies
└── memory/
    └── PRD.md                 # Product requirements document
```

## API Endpoints

### Authentication
- `POST /api/auth/exchange-session` - Exchange session ID for user data
- `GET /api/auth/me` - Get current user profile
- `POST /api/auth/logout` - Logout and clear session

### User Management
- `PUT /api/users/profile` - Update user profile
- `GET /api/users/nearby` - Get nearby growers

### Crops
- `POST /api/crops` - Create new crop listing
- `GET /api/crops/nearby` - Search crops by location
- `GET /api/crops/my-crops` - Get user's posted crops
- `GET /api/crops/{crop_id}` - Get crop details
- `DELETE /api/crops/{crop_id}` - Delete crop listing

### Messaging
- `POST /api/messages` - Send a message
- `GET /api/messages/conversations` - Get conversation list
- `GET /api/messages/{user_id}` - Get messages with specific user

### Payments
- `GET /api/stripe/config` - Get Stripe configuration
- `POST /api/stripe/create-payment-intent` - Create payment intent
- `POST /api/stripe/webhook` - Handle Stripe webhooks

### Community
- `POST /api/posts` - Create feed post
- `GET /api/posts` - Get community feed
- `POST /api/posts/{post_id}/like` - Like/unlike post

### Transactions
- `GET /api/transactions/history` - Get transaction history

## Development

### Image Storage
All images are stored as base64-encoded strings in MongoDB for simplicity in Phase 1.

## Security Considerations

- All API endpoints require authentication (except public routes)
- Passwords are never stored (Auth0 handles authentication)
- Payment processing uses Stripe's secure API
- Session tokens expire after 7 days
- Environment variables store all sensitive data

## Phase 1 Scope

✅ **Included:**
- User authentication and profiles
- Crop posting with photos
- Location-based discovery
- Direct messaging
- Stripe payment integration
- Community feed
- Transaction history

❌ **Phase 1 Exclusions:**
- No delivery system (in-person pickup only)
- No professional farmers (backyard growers only)
- No land leasing
- No storage operations
- Limited search filters

## Future Enhancements (Phase 2+)

- Advanced search and filtering
- Crop exchange algorithms
- In-app delivery coordination
- Growing guides and tips
- Weather integration
- Push notifications
- Rating and review system
- Real-time messaging with Socket.io

---

Built with ❤️ for local farming communities
