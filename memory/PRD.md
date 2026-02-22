# HarvestHub - Product Requirements Document

## Product Overview
HarvestHub is a mobile marketplace application that connects local community members to buy and sell fresh vegetables and produce. Users can discover products within a 5-10 mile radius, view detailed seller information, make secure purchases, and engage with their farming community.

## Core Features

### 1. Authentication & User Management
- **Auth0 Integration**: Multiple login options
  - Google OAuth
  - Facebook OAuth
  - Email/Password
  - Twitter OAuth
- **User Profiles**:
  - Name, email, phone, profile photo
  - Location (GPS + address)
  - Seller rating system
  - Join date and verification status

### 2. Marketplace (Primary Feature)
- **Product Browsing**:
  - Grid/list view of available products
  - Category filters (Vegetables, Fruits, Herbs, etc.)
  - Search functionality
  - Sort by: Price, Distance, Newest
- **Product Details**:
  - Multiple product images
  - Price, quantity available, unit
  - Detailed description
  - Seller profile card (name, photo, rating, location, distance)
  - Seller contact button
  - Add to cart / Buy now
- **Shopping Cart**:
  - Add/remove items
  - Quantity adjustment
  - Subtotal calculation
  - Checkout flow

### 3. Maps & Location
- **Interactive Map View**:
  - Product markers within 5-10 mile radius
  - Color-coded by category
  - Tap marker to see product preview
  - Navigate to full product details
  - Radius adjustment slider (5, 7.5, 10 miles)
  - User's current location marker
- **Location Services**:
  - Real-time distance calculation
  - Directions to seller (via native maps)

### 4. Selling Products
- **Create Listing**:
  - Product name, category
  - Multiple photo upload (camera/gallery)
  - Price, quantity, unit
  - Detailed description
  - Availability toggle
- **Manage Listings**:
  - View all your products
  - Edit/delete listings
  - Mark as sold
  - View inquiries

### 5. Payment Integration (Stripe)
- **Checkout Process**:
  - Review order summary
  - Stripe payment form
  - Payment confirmation
  - Receipt generation
- **Transaction Management**:
  - Order history (buyer view)
  - Sales history (seller view)
  - Transaction status tracking
  - Refund support

### 6. Community Feed
- **Social Features**:
  - Create posts with text and images
  - Like and comment on posts
  - Hashtag support (#organic, #fresh, etc.)
  - User mentions
  - Post sharing
- **Feed Display**:
  - Chronological timeline
  - User profile cards with distance
  - Image galleries
  - Engagement metrics

### 7. Messaging System
- **Direct Messages**:
  - One-on-one conversations
  - Text messaging
  - Message history
  - Unread indicators
  - Contact sellers directly from product page

### 8. User Profile
- **Profile Management**:
  - Edit profile information
  - Update profile photo
  - Set/update location
  - Phone number (for contact)
- **Activity Dashboard**:
  - Purchase history
  - Sales history
  - Active listings
  - Seller rating and reviews
  - Account settings

## Technical Stack

### Frontend
- **Framework**: React Native with Expo
- **Navigation**: Expo Router (file-based)
- **State Management**: React Context API + Zustand
- **Authentication**: Auth0 React Native SDK
- **Payments**: Stripe React Native SDK
- **Maps**: react-native-maps + Google Maps
- **Image Handling**: expo-image-picker (base64)

### Backend
- **Framework**: FastAPI
- **Database**: MongoDB with Motor (async)
- **Authentication**: Auth0 token validation
- **Payments**: Stripe API
- **Maps**: Google Maps API (geocoding, distance)

## User Flows

### 1. Marketplace Flow
1. User opens Marketplace tab
2. Browses products (grid view)
3. Taps product card → Product details screen
4. Views product images, price, seller info
5. Taps "Add to Cart" or "Buy Now"
6. Reviews cart items
7. Proceeds to checkout
8. Enters Stripe payment details
9. Confirms purchase
10. Receives confirmation and receipt

### 2. Map Discovery Flow
1. User opens Map tab
2. App shows products within default radius (10 miles)
3. User adjusts radius slider (5-10 miles)
4. Taps product marker on map
5. Views product preview card
6. Taps "View Details" → Product details screen
7. Proceeds to purchase or contact seller

### 3. Selling Flow
1. User taps "Sell" tab
2. Fills product form (name, category, price, photos)
3. Sets location (auto-filled from profile)
4. Submits listing
5. Product appears in marketplace and map
6. Receives inquiries via messages
7. Manages orders and marks as sold

## Data Models

### User
```
{
  user_id: string
  auth0_id: string
  email: string
  name: string
  phone: string?
  profile_photo: string (base64)
  location: {lat, lng, address}
  rating: float (0-5)
  total_sales: int
  joined_date: datetime
  verified: boolean
}
```

### Product
```
{
  product_id: string
  seller_id: string
  name: string
  category: string (Vegetables, Fruits, Herbs, etc.)
  description: string
  photos: string[] (base64)
  price: float
  quantity: float
  unit: string (lbs, kg, pieces)
  location: {lat, lng, address}
  status: string (available, sold, pending)
  created_at: datetime
  views: int
}
```

### Order
```
{
  order_id: string
  buyer_id: string
  seller_id: string
  items: [{product_id, quantity, price}]
  total_amount: float
  status: string (pending, completed, cancelled, refunded)
  payment_intent_id: string
  delivery_method: string (pickup, delivery)
  created_at: datetime
  completed_at: datetime?
}
```

### Message
```
{
  message_id: string
  sender_id: string
  receiver_id: string
  text: string
  read: boolean
  created_at: datetime
}
```

### Post
```
{
  post_id: string
  user_id: string
  content: string
  images: string[] (base64)
  likes: string[] (user_ids)
  comments: [{user_id, text, created_at}]
  hashtags: string[]
  created_at: datetime
}
```

### Cart
```
{
  cart_id: string
  user_id: string
  items: [{product_id, quantity}]
  updated_at: datetime
}
```

## Success Metrics
- User registration and retention rate
- Product listing rate
- Transaction completion rate
- Average order value
- Seller-buyer messaging engagement
- Community feed activity
- Map-based discovery usage

## Phase 1 Exclusions
- ❌ Land leasing features
- ❌ "You Grow, We Buy" section
- ❌ "We Grow" section
- ❌ Delivery/shipping logistics
- ❌ In-app reviews system (ratings only)
- ❌ Advanced search filters
- ❌ Multiple payment methods (Stripe only)
