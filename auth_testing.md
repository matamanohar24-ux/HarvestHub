# Auth0 Testing Playbook for HarvestHub

## Step 1: Create Test User & Session

```bash
mongosh --eval "
use('test_database');
var visitorId = 'user_' + Date.now();
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({
  user_id: visitorId,
  email: 'test.user.' + Date.now() + '@example.com',
  name: 'Test User',
  auth0_id: 'auth0|test_' + Date.now(),
  location: { lat: 40.7128, lng: -74.0060, address: 'New York, NY' },
  is_grower: true,
  profile_photo: '',
  created_at: new Date(),
  farming_history: []
});
db.user_sessions.insertOne({
  user_id: visitorId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
});
print('Session token: ' + sessionToken);
print('User ID: ' + visitorId);
"
```

## Step 2: Test Backend API

```bash
# Test auth endpoint
curl -X GET "http://localhost:8001/api/auth/me" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"

# Test crops endpoint
curl -X GET "http://localhost:8001/api/crops/nearby?lat=40.7128&lng=-74.0060&radius=10" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"

# Create a crop
curl -X POST "http://localhost:8001/api/crops" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -d '{
    "name": "Tomatoes",
    "description": "Fresh organic tomatoes",
    "quantity": 10,
    "unit": "lbs",
    "price": 5.00,
    "photos": []
  }'
```

## Step 3: Mobile Testing with Session Token

Set Authorization header in Expo app and test navigation through all screens.

## Success Indicators
- ✅ /api/auth/me returns user data with user_id field
- ✅ Dashboard loads without redirect
- ✅ CRUD operations work for crops, messages, transactions
