from fastapi import FastAPI, HTTPException, Depends, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
import os
import uuid
import stripe
import httpx
import googlemaps
import math

load_dotenv()

# Environment variables
MONGO_URL = os.getenv("MONGO_URL")
DB_NAME = os.getenv("DB_NAME")
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
STRIPE_PUBLISHABLE_KEY = os.getenv("STRIPE_PUBLISHABLE_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")
GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")
AUTH0_DOMAIN = os.getenv("AUTH0_DOMAIN")
AUTH0_API_AUDIENCE = os.getenv("AUTH0_API_AUDIENCE")

# Initialize Stripe
stripe.api_key = STRIPE_SECRET_KEY

# Initialize Google Maps
gmaps = googlemaps.Client(key=GOOGLE_MAPS_API_KEY)

# MongoDB client
client = None
db = None

app = FastAPI(title="HarvestHub Marketplace API")

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===== DATABASE CONNECTION =====
@app.on_event("startup")
async def startup_db():
    global client, db
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    print(f"Connected to MongoDB: {DB_NAME}")

@app.on_event("shutdown")
async def shutdown_db():
    if client:
        client.close()
        print("Closed MongoDB connection")

# ===== MODELS =====
class Location(BaseModel):
    lat: float
    lng: float
    address: Optional[str] = None

class User(BaseModel):
    user_id: str
    auth0_id: Optional[str] = None
    email: str
    name: str
    phone: Optional[str] = None
    location: Optional[Location] = None
    profile_photo: Optional[str] = None
    rating: float = 0.0
    total_sales: int = 0
    joined_date: datetime
    verified: bool = False

class Product(BaseModel):
    product_id: str
    seller_id: str
    name: str
    category: str  # Vegetables, Fruits, Herbs, etc.
    description: Optional[str] = None
    photos: List[str] = []  # base64 encoded images
    price: float
    quantity: float
    unit: str = "lbs"
    location: Location
    status: str = "available"  # available, sold, pending
    created_at: datetime
    views: int = 0

class CartItem(BaseModel):
    product_id: str
    quantity: float

class Cart(BaseModel):
    cart_id: str
    user_id: str
    items: List[CartItem] = []
    updated_at: datetime

class OrderItem(BaseModel):
    product_id: str
    product_name: str
    quantity: float
    price: float

class Order(BaseModel):
    order_id: str
    buyer_id: str
    seller_id: str
    items: List[OrderItem]
    total_amount: float
    status: str = "pending"  # pending, completed, cancelled, refunded
    payment_intent_id: Optional[str] = None
    delivery_method: str = "pickup"
    created_at: datetime
    completed_at: Optional[datetime] = None

class Message(BaseModel):
    message_id: str
    sender_id: str
    receiver_id: str
    text: str
    read: bool = False
    created_at: datetime

class Comment(BaseModel):
    user_id: str
    text: str
    created_at: datetime

class Post(BaseModel):
    post_id: str
    user_id: str
    content: str
    images: List[str] = []
    likes: List[str] = []
    comments: List[Comment] = []
    hashtags: List[str] = []
    created_at: datetime

# ===== REQUEST MODELS =====
class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[Location] = None
    profile_photo: Optional[str] = None

class CreateProductRequest(BaseModel):
    name: str
    category: str
    description: Optional[str] = None
    photos: List[str] = []
    price: float
    quantity: float
    unit: str = "lbs"

class UpdateProductRequest(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    photos: Optional[List[str]] = None
    price: Optional[float] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    status: Optional[str] = None

class AddToCartRequest(BaseModel):
    product_id: str
    quantity: float

class CreateOrderRequest(BaseModel):
    cart_items: List[CartItem]
    delivery_method: str = "pickup"

class CreateMessageRequest(BaseModel):
    receiver_id: str
    text: str

class CreatePostRequest(BaseModel):
    content: str
    images: List[str] = []
    hashtags: List[str] = []

class AddCommentRequest(BaseModel):
    text: str

# ===== AUTHENTICATION HELPER =====
async def get_current_user(authorization: Optional[str] = Header(None)) -> User:
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")
    
    try:
        token = authorization.replace("Bearer ", "")
        
        # Check session in database
        session = await db.user_sessions.find_one(
            {"session_token": token},
            {"_id": 0}
        )
        
        if not session:
            raise HTTPException(status_code=401, detail="Invalid or expired session")
        
        # Check if session is expired
        expires_at = session["expires_at"]
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        
        if expires_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=401, detail="Session expired")
        
        # Get user
        user_doc = await db.users.find_one(
            {"user_id": session["user_id"]},
            {"_id": 0}
        )
        
        if not user_doc:
            raise HTTPException(status_code=404, detail="User not found")
        
        return User(**user_doc)
    
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")

# ===== UTILITY FUNCTIONS =====
def calculate_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate distance between two coordinates in miles using Haversine formula"""
    R = 3959  # Earth's radius in miles
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    
    a = math.sin(dlat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlng/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    return R * c

# ===== AUTH ENDPOINTS =====
@app.post("/api/auth/exchange-session")
async def exchange_session_id(session_id: str = Header(None, alias="X-Session-ID")):
    """Exchange session_id for session data using Emergent Auth API"""
    if not session_id:
        raise HTTPException(status_code=400, detail="Session ID missing")
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id},
                timeout=10.0
            )
            response.raise_for_status()
            user_data = response.json()
        
        # Check if user exists
        existing_user = await db.users.find_one(
            {"email": user_data["email"]},
            {"_id": 0}
        )
        
        if not existing_user:
            # Create new user
            user_id = f"user_{uuid.uuid4().hex[:12]}"
            new_user = {
                "user_id": user_id,
                "auth0_id": user_data["id"],
                "email": user_data["email"],
                "name": user_data["name"],
                "phone": None,
                "profile_photo": user_data.get("picture", ""),
                "location": None,
                "rating": 0.0,
                "total_sales": 0,
                "joined_date": datetime.now(timezone.utc),
                "verified": False
            }
            await db.users.insert_one(new_user)
            user_id_to_use = user_id
        else:
            user_id_to_use = existing_user["user_id"]
        
        # Create session
        session_token = user_data["session_token"]
        await db.user_sessions.insert_one({
            "user_id": user_id_to_use,
            "session_token": session_token,
            "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
            "created_at": datetime.now(timezone.utc)
        })
        
        # Get user data
        user = await db.users.find_one(
            {"user_id": user_id_to_use},
            {"_id": 0}
        )
        
        return {
            "session_token": session_token,
            "user": user
        }
    
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"Auth API error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Session exchange failed: {str(e)}")

@app.get("/api/auth/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@app.post("/api/auth/logout")
async def logout(current_user: User = Depends(get_current_user), authorization: str = Header(None)):
    token = authorization.replace("Bearer ", "")
    await db.user_sessions.delete_one({"session_token": token})
    return {"message": "Logged out successfully"}

# ===== USER ENDPOINTS =====
@app.put("/api/users/profile")
async def update_profile(request: UpdateProfileRequest, current_user: User = Depends(get_current_user)):
    update_data = {k: v for k, v in request.dict().items() if v is not None}
    
    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc)
        
        # Convert Location to dict if present
        if "location" in update_data and update_data["location"]:
            if hasattr(update_data["location"], "dict"):
                update_data["location"] = update_data["location"].dict()
        
        await db.users.update_one(
            {"user_id": current_user.user_id},
            {"$set": update_data}
        )
    
    updated_user = await db.users.find_one({"user_id": current_user.user_id}, {"_id": 0})
    return updated_user

@app.get("/api/users/{user_id}")
async def get_user(user_id: str, current_user: User = Depends(get_current_user)):
    """Get public user profile"""
    user = await db.users.find_one(
        {"user_id": user_id},
        {"_id": 0, "user_id": 1, "name": 1, "profile_photo": 1, "location": 1, "rating": 1, "total_sales": 1, "joined_date": 1}
    )
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return user

# ===== PRODUCT/MARKETPLACE ENDPOINTS =====
@app.post("/api/products")
async def create_product(request: CreateProductRequest, current_user: User = Depends(get_current_user)):
    """Create a new product listing"""
    if not current_user.location:
        raise HTTPException(status_code=400, detail="Please set your location first")
    
    product_id = f"product_{uuid.uuid4().hex[:12]}"
    product = {
        "product_id": product_id,
        "seller_id": current_user.user_id,
        "name": request.name,
        "category": request.category,
        "description": request.description,
        "photos": request.photos,
        "price": request.price,
        "quantity": request.quantity,
        "unit": request.unit,
        "location": current_user.location.dict() if hasattr(current_user.location, 'dict') else current_user.location,
        "status": "available",
        "created_at": datetime.now(timezone.utc),
        "views": 0
    }
    
    await db.products.insert_one(product)
    return await db.products.find_one({"product_id": product_id}, {"_id": 0})

@app.get("/api/products")
async def get_products(
    category: Optional[str] = None,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    radius: float = 10,
    limit: int = 50,
    current_user: User = Depends(get_current_user)
):
    """Get all products with optional filters"""
    query = {"status": "available"}
    
    if category:
        query["category"] = category
    
    products = await db.products.find(query, {"_id": 0}).limit(limit).to_list(limit)
    
    # Get all unique seller_ids
    seller_ids = list(set(p["seller_id"] for p in products))
    
    # Fetch all sellers in one query
    sellers = await db.users.find(
        {"user_id": {"$in": seller_ids}},
        {"_id": 0, "user_id": 1, "name": 1, "profile_photo": 1, "rating": 1, "location": 1}
    ).to_list(len(seller_ids))
    
    seller_dict = {s["user_id"]: s for s in sellers}
    
    # Enrich products with seller data and distance
    enriched_products = []
    for product in products:
        product["seller"] = seller_dict.get(product["seller_id"])
        
        # Calculate distance if lat/lng provided
        if lat and lng and product.get("location"):
            distance = calculate_distance(
                lat, lng,
                product["location"]["lat"],
                product["location"]["lng"]
            )
            
            # Filter by radius if specified
            if distance <= radius:
                product["distance"] = round(distance, 2)
                enriched_products.append(product)
        else:
            enriched_products.append(product)
    
    # Sort by distance if available
    if lat and lng:
        enriched_products.sort(key=lambda x: x.get("distance", 999))
    
    return enriched_products

@app.get("/api/products/nearby")
async def get_products_nearby(
    lat: float,
    lng: float,
    radius: float = 10,
    category: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get products within radius for map view"""
    query = {"status": "available"}
    
    if category:
        query["category"] = category
    
    products = await db.products.find(query, {"_id": 0}).limit(200).to_list(200)
    
    # Get all unique seller_ids
    seller_ids = list(set(p["seller_id"] for p in products))
    
    # Fetch all sellers
    sellers = await db.users.find(
        {"user_id": {"$in": seller_ids}},
        {"_id": 0, "user_id": 1, "name": 1, "profile_photo": 1, "rating": 1}
    ).to_list(len(seller_ids))
    
    seller_dict = {s["user_id"]: s for s in sellers}
    
    # Filter by distance and enrich
    nearby_products = []
    for product in products:
        if product.get("location"):
            distance = calculate_distance(
                lat, lng,
                product["location"]["lat"],
                product["location"]["lng"]
            )
            
            if distance <= radius:
                product["seller"] = seller_dict.get(product["seller_id"])
                product["distance"] = round(distance, 2)
                nearby_products.append(product)
    
    nearby_products.sort(key=lambda x: x["distance"])
    return nearby_products

@app.get("/api/products/{product_id}")
async def get_product(product_id: str, current_user: User = Depends(get_current_user)):
    """Get product details"""
    product = await db.products.find_one({"product_id": product_id}, {"_id": 0})
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Increment view count
    await db.products.update_one(
        {"product_id": product_id},
        {"$inc": {"views": 1}}
    )
    
    # Get seller info
    seller = await db.users.find_one(
        {"user_id": product["seller_id"]},
        {"_id": 0, "user_id": 1, "name": 1, "email": 1, "phone": 1, "profile_photo": 1, "rating": 1, "total_sales": 1, "location": 1}
    )
    product["seller"] = seller
    
    # Calculate distance if user has location
    if current_user.location and product.get("location"):
        distance = calculate_distance(
            current_user.location.lat,
            current_user.location.lng,
            product["location"]["lat"],
            product["location"]["lng"]
        )
        product["distance"] = round(distance, 2)
    
    return product

@app.put("/api/products/{product_id}")
async def update_product(
    product_id: str,
    request: UpdateProductRequest,
    current_user: User = Depends(get_current_user)
):
    """Update product listing"""
    product = await db.products.find_one({"product_id": product_id}, {"_id": 0})
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    if product["seller_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = {k: v for k, v in request.dict().items() if v is not None}
    
    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc)
        await db.products.update_one(
            {"product_id": product_id},
            {"$set": update_data}
        )
    
    return await db.products.find_one({"product_id": product_id}, {"_id": 0})

@app.delete("/api/products/{product_id}")
async def delete_product(product_id: str, current_user: User = Depends(get_current_user)):
    """Delete product listing"""
    product = await db.products.find_one({"product_id": product_id}, {"_id": 0})
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    if product["seller_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.products.delete_one({"product_id": product_id})
    return {"message": "Product deleted successfully"}

@app.get("/api/products/seller/{seller_id}")
async def get_seller_products(seller_id: str, current_user: User = Depends(get_current_user)):
    """Get all products from a specific seller"""
    products = await db.products.find(
        {"seller_id": seller_id, "status": "available"},
        {"_id": 0}
    ).to_list(100)
    
    return products

# ===== CART ENDPOINTS =====
@app.get("/api/cart")
async def get_cart(current_user: User = Depends(get_current_user)):
    """Get user's cart"""
    cart = await db.carts.find_one({"user_id": current_user.user_id}, {"_id": 0})
    
    if not cart:
        return {"cart_id": f"cart_{uuid.uuid4().hex[:12]}", "user_id": current_user.user_id, "items": [], "updated_at": datetime.now(timezone.utc)}
    
    # Enrich cart items with product details
    product_ids = [item["product_id"] for item in cart.get("items", [])]
    products = await db.products.find(
        {"product_id": {"$in": product_ids}},
        {"_id": 0}
    ).to_list(len(product_ids))
    
    product_dict = {p["product_id"]: p for p in products}
    
    enriched_items = []
    for item in cart.get("items", []):
        product = product_dict.get(item["product_id"])
        if product:
            enriched_items.append({
                **item,
                "product": product
            })
    
    cart["items"] = enriched_items
    return cart

@app.post("/api/cart/add")
async def add_to_cart(request: AddToCartRequest, current_user: User = Depends(get_current_user)):
    """Add item to cart"""
    # Check if product exists and is available
    product = await db.products.find_one({"product_id": request.product_id}, {"_id": 0})
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    if product["status"] != "available":
        raise HTTPException(status_code=400, detail="Product is not available")
    
    if request.quantity > product["quantity"]:
        raise HTTPException(status_code=400, detail="Requested quantity exceeds available stock")
    
    # Get or create cart
    cart = await db.carts.find_one({"user_id": current_user.user_id}, {"_id": 0})
    
    if not cart:
        cart_id = f"cart_{uuid.uuid4().hex[:12]}"
        cart = {
            "cart_id": cart_id,
            "user_id": current_user.user_id,
            "items": [],
            "updated_at": datetime.now(timezone.utc)
        }
        await db.carts.insert_one(cart)
    
    # Check if item already in cart
    existing_item = next((item for item in cart.get("items", []) if item["product_id"] == request.product_id), None)
    
    if existing_item:
        # Update quantity
        await db.carts.update_one(
            {"user_id": current_user.user_id, "items.product_id": request.product_id},
            {"$set": {"items.$.quantity": request.quantity, "updated_at": datetime.now(timezone.utc)}}
        )
    else:
        # Add new item
        await db.carts.update_one(
            {"user_id": current_user.user_id},
            {"$push": {"items": {"product_id": request.product_id, "quantity": request.quantity}}, "$set": {"updated_at": datetime.now(timezone.utc)}}
        )
    
    return await get_cart(current_user)

@app.delete("/api/cart/remove/{product_id}")
async def remove_from_cart(product_id: str, current_user: User = Depends(get_current_user)):
    """Remove item from cart"""
    await db.carts.update_one(
        {"user_id": current_user.user_id},
        {"$pull": {"items": {"product_id": product_id}}, "$set": {"updated_at": datetime.now(timezone.utc)}}
    )
    
    return {"message": "Item removed from cart"}

@app.delete("/api/cart/clear")
async def clear_cart(current_user: User = Depends(get_current_user)):
    """Clear all items from cart"""
    await db.carts.update_one(
        {"user_id": current_user.user_id},
        {"$set": {"items": [], "updated_at": datetime.now(timezone.utc)}}
    )
    
    return {"message": "Cart cleared"}

# ===== ORDER & PAYMENT ENDPOINTS =====
@app.post("/api/orders/create")
async def create_order(request: CreateOrderRequest, current_user: User = Depends(get_current_user)):
    """Create order from cart items"""
    # Validate all products and calculate total
    order_items = []
    total_amount = 0
    sellers = set()
    
    for cart_item in request.cart_items:
        product = await db.products.find_one({"product_id": cart_item.product_id}, {"_id": 0})
        
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {cart_item.product_id} not found")
        
        if product["status"] != "available":
            raise HTTPException(status_code=400, detail=f"Product {product['name']} is not available")
        
        if cart_item.quantity > product["quantity"]:
            raise HTTPException(status_code=400, detail=f"Insufficient stock for {product['name']}")
        
        item_total = product["price"] * cart_item.quantity
        total_amount += item_total
        sellers.add(product["seller_id"])
        
        order_items.append({
            "product_id": product["product_id"],
            "product_name": product["name"],
            "quantity": cart_item.quantity,
            "price": product["price"]
        })
    
    # For now, single seller only (can be enhanced for multi-seller)
    if len(sellers) > 1:
        raise HTTPException(status_code=400, detail="Cart contains items from multiple sellers. Please checkout one seller at a time")
    
    seller_id = list(sellers)[0]
    
    # Create Stripe payment intent
    try:
        intent = stripe.PaymentIntent.create(
            amount=int(total_amount * 100),  # Convert to cents
            currency="usd",
            metadata={
                "buyer_id": current_user.user_id,
                "seller_id": seller_id
            }
        )
        
        # Create order
        order_id = f"order_{uuid.uuid4().hex[:12]}"
        order = {
            "order_id": order_id,
            "buyer_id": current_user.user_id,
            "seller_id": seller_id,
            "items": order_items,
            "total_amount": total_amount,
            "status": "pending",
            "payment_intent_id": intent.id,
            "delivery_method": request.delivery_method,
            "created_at": datetime.now(timezone.utc),
            "completed_at": None
        }
        
        await db.orders.insert_one(order)
        
        return {
            "order_id": order_id,
            "client_secret": intent.client_secret,
            "total_amount": total_amount
        }
    
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/stripe/webhook")
async def stripe_webhook(request: Request):
    """Handle Stripe webhooks"""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")
    
    if event["type"] == "payment_intent.succeeded":
        payment_intent = event["data"]["object"]
        
        # Update order status
        order = await db.orders.find_one(
            {"payment_intent_id": payment_intent["id"]},
            {"_id": 0}
        )
        
        if order:
            await db.orders.update_one(
                {"payment_intent_id": payment_intent["id"]},
                {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc)}}
            )
            
            # Update product quantities and seller's total sales
            for item in order["items"]:
                await db.products.update_one(
                    {"product_id": item["product_id"]},
                    {"$inc": {"quantity": -item["quantity"]}}
                )
                
                # Mark as sold if quantity reaches 0
                product = await db.products.find_one({"product_id": item["product_id"]})
                if product and product["quantity"] <= 0:
                    await db.products.update_one(
                        {"product_id": item["product_id"]},
                        {"$set": {"status": "sold"}}
                    )
            
            # Update seller's total sales
            await db.users.update_one(
                {"user_id": order["seller_id"]},
                {"$inc": {"total_sales": 1}}
            )
            
            # Clear buyer's cart
            await db.carts.update_one(
                {"user_id": order["buyer_id"]},
                {"$set": {"items": []}}
            )
    
    elif event["type"] == "payment_intent.payment_failed":
        payment_intent = event["data"]["object"]
        
        await db.orders.update_one(
            {"payment_intent_id": payment_intent["id"]},
            {"$set": {"status": "failed"}}
        )
    
    return {"received": True}

@app.get("/api/orders/my-orders")
async def get_my_orders(current_user: User = Depends(get_current_user)):
    """Get user's purchase orders"""
    orders = await db.orders.find(
        {"buyer_id": current_user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    
    # Enrich with seller info
    seller_ids = list(set(order["seller_id"] for order in orders))
    sellers = await db.users.find(
        {"user_id": {"$in": seller_ids}},
        {"_id": 0, "user_id": 1, "name": 1, "profile_photo": 1, "phone": 1}
    ).to_list(len(seller_ids))
    
    seller_dict = {s["user_id"]: s for s in sellers}
    
    for order in orders:
        order["seller"] = seller_dict.get(order["seller_id"])
    
    return orders

@app.get("/api/orders/my-sales")
async def get_my_sales(current_user: User = Depends(get_current_user)):
    """Get user's sales orders"""
    orders = await db.orders.find(
        {"seller_id": current_user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    
    # Enrich with buyer info
    buyer_ids = list(set(order["buyer_id"] for order in orders))
    buyers = await db.users.find(
        {"user_id": {"$in": buyer_ids}},
        {"_id": 0, "user_id": 1, "name": 1, "profile_photo": 1, "phone": 1}
    ).to_list(len(buyer_ids))
    
    buyer_dict = {b["user_id"]: b for b in buyers}
    
    for order in orders:
        order["buyer"] = buyer_dict.get(order["buyer_id"])
    
    return orders
