# HarvestHub Database & Data Storage Architecture

## 📍 Database Location

**MongoDB Connection:**
- **URL:** `mongodb://localhost:27017` (Local MongoDB running in Docker container)
- **Database Name:** `test_database`
- **Access:** Internal to the application (not publicly exposed)

## 📊 Current Data in Database

Based on live data count:

| Collection | Count | Description |
|------------|-------|-------------|
| **users** | 7 | User profiles and account info |
| **user_sessions** | 11 | Active login sessions |
| **products** | 8 | Listed products in marketplace |
| **posts** | 4 | Community feed posts |
| **messages** | 9 | Direct messages between users |
| **orders** | 0 | Completed orders/purchases |
| **crops** | 2 | Legacy crop data |

## 🗂️ Data Storage Breakdown

### 1. **Authentication Data** 🔐

**Where Passwords Are Stored:**
- ❌ **NOT in MongoDB**
- ✅ **Stored by Auth0** (Emergent Auth service)
- Auth0 handles all password security, encryption, and authentication

**What IS Stored in MongoDB:**
```javascript
// Collection: users
{
  user_id: "user_abc123",
  auth0_id: "auth0|xyz789",  // Reference to Auth0 account
  email: "user@example.com",
  name: "John Doe",
  phone: "+1-555-1234",
  profile_photo: "data:image/jpeg;base64,...",  // Profile picture
  location: {
    lat: 37.7749,
    lng: -122.4194,
    address: "San Francisco, CA"
  },
  rating: 4.8,
  total_sales: 12,
  joined_date: "2024-01-15T10:30:00Z",
  verified: true
}

// Collection: user_sessions
{
  user_id: "user_abc123",
  session_token: "token_xyz...",
  expires_at: "2024-01-22T10:30:00Z",
  created_at: "2024-01-15T10:30:00Z"
}
```

### 2. **Product/Marketplace Data** 🌾

```javascript
// Collection: products
{
  product_id: "product_def456",
  seller_id: "user_abc123",
  name: "Fresh Heirloom Tomatoes",
  category: "Vegetables",
  description: "Organic, pesticide-free tomatoes",
  photos: ["data:image/jpeg;base64,..."],  // Images stored as base64
  price: 4.50,
  quantity: 5,
  unit: "lbs",
  location: {
    lat: 37.7749,
    lng: -122.4194,
    address: "San Francisco, CA"
  },
  status: "available",  // available, sold, pending
  created_at: "2024-01-15T10:30:00Z",
  views: 45
}
```

### 3. **Payment Data** 💳

**What IS Stored in MongoDB:**
```javascript
// Collection: orders
{
  order_id: "order_ghi789",
  buyer_id: "user_abc123",
  seller_id: "user_def456",
  items: [{
    product_id: "product_xyz",
    product_name: "Tomatoes",
    quantity: 2,
    price: 4.50
  }],
  total_amount: 9.00,
  status: "completed",  // pending, completed, failed, refunded
  payment_intent_id: "pi_stripe123",  // Stripe reference
  delivery_method: "pickup",
  created_at: "2024-01-15T10:30:00Z",
  completed_at: "2024-01-15T10:35:00Z"
}
```

**What IS NOT Stored in MongoDB:**
- ❌ Credit card numbers
- ❌ CVV codes
- ❌ Bank account details
- ✅ All payment processing handled by **Stripe** (PCI compliant)
- Only transaction references and status stored locally

### 4. **Messaging Data** 💬

```javascript
// Collection: messages
{
  message_id: "msg_jkl012",
  sender_id: "user_abc123",
  receiver_id: "user_def456",
  text: "Is the produce still available?",
  read: false,
  created_at: "2024-01-15T10:30:00Z"
}
```

### 5. **Community Feed Data** 📱

```javascript
// Collection: posts
{
  post_id: "post_mno345",
  user_id: "user_abc123",
  content: "🌱 Just harvested my first batch of tomatoes! #organic",
  images: ["data:image/jpeg;base64,..."],
  likes: ["user_def456", "user_ghi789"],  // Array of user IDs
  comments: [{
    user_id: "user_def456",
    text: "Looks amazing!",
    created_at: "2024-01-15T11:00:00Z"
  }],
  hashtags: ["organic"],
  created_at: "2024-01-15T10:30:00Z"
}
```

## 🔒 Security & Privacy

### What We Store Locally (MongoDB):
✅ User profiles (name, email, location)
✅ Product listings and photos
✅ Messages between users
✅ Transaction records (amounts, status)
✅ Community posts
✅ Session tokens (temporary, expire in 7 days)

### What External Services Handle:
🔐 **Auth0 (Emergent Auth):**
- User passwords
- OAuth tokens
- Authentication security
- Password reset flows

💳 **Stripe:**
- Credit card processing
- Payment method storage
- PCI compliance
- Refunds and disputes

🗺️ **Google Maps:**
- Geocoding addresses
- Distance calculations
- Map tile serving

## 📡 Data Flow

```
User Login:
┌─────────┐      ┌──────────┐      ┌──────────┐      ┌─────────┐
│ Mobile  │─────>│  Auth0   │─────>│ Backend  │─────>│ MongoDB │
│   App   │      │(Emergent)│      │   API    │      │ (Local) │
└─────────┘      └──────────┘      └──────────┘      └─────────┘
                      ↓                                      ↓
                 Validates                            Stores session
                 password                             + user profile

Payment Flow:
┌─────────┐      ┌──────────┐      ┌──────────┐      ┌─────────┐
│ Mobile  │─────>│  Stripe  │─────>│ Backend  │─────>│ MongoDB │
│   App   │      │  (PCI)   │      │   API    │      │ (Local) │
└─────────┘      └──────────┘      └──────────┘      └─────────┘
                      ↓                                      ↓
                 Processes                            Stores order
                 payment                              record only
```

## 🔑 Your Current Setup

**MongoDB:** Running locally in Docker container
- No external MongoDB service needed
- Data stored on local disk
- Accessible only within your application

**Auth0 Credentials:** Your keys
- Domain: `dev-e1eyqqhsiocvvg8t.us.auth0.com`
- Handles authentication for your users

**Stripe:** Your keys
- Test mode keys active
- Processes payments securely

**Google Maps:** Your API key
- Calculates distances
- Geocodes addresses

## 💾 Backup & Data Management

**To backup your database:**
```bash
mongodump --uri="mongodb://localhost:27017" --db=test_database --out=/backup
```

**To view your data:**
```bash
mongosh mongodb://localhost:27017/test_database
```

**To switch to production MongoDB:**
- Update `MONGO_URL` in `/app/backend/.env`
- Options: MongoDB Atlas, AWS DocumentDB, etc.

## 📈 Current Stats

- **7 users** registered (including you!)
- **8 products** in marketplace (sample data)
- **4 community posts**
- **9 messages** exchanged
- **11 active sessions**
- **0 completed orders** (ready for first transaction!)

All data is safely stored in your local MongoDB instance! 🎉
