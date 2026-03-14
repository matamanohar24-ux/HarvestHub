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
    zip_code: Optional[str] = None

class User(BaseModel):
    user_id: str
    auth0_id: Optional[str] = None
    email: str
    name: str
    phone: Optional[str] = None
    location: Optional[Location] = None
    zip_code: Optional[str] = None  # Standalone ZIP for manual entry
    profile_photo: Optional[str] = None
    rating: float = 0.0
    total_sales: int = 0
    joined_date: datetime
    verified: bool = False
    followers: List[str] = []  # List of user_ids
    following: List[str] = []  # List of user_ids
    bio: Optional[str] = None

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
    average_rating: float = 0.0
    review_count: int = 0

class Review(BaseModel):
    review_id: str
    product_id: str
    user_id: str
    rating: int  # 1-5 stars
    comment: Optional[str] = None
    created_at: datetime

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
    bio: Optional[str] = None
    zip_code: Optional[str] = None

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

class CreateReviewRequest(BaseModel):
    rating: int  # 1-5 stars
    comment: Optional[str] = None

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

# ===== PRODUCT REVIEWS ENDPOINTS =====
@app.post("/api/products/{product_id}/reviews")
async def create_review(
    product_id: str,
    request: CreateReviewRequest,
    current_user: User = Depends(get_current_user)
):
    """Create a review for a product"""
    # Validate rating
    if request.rating < 1 or request.rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")
    
    # Check if product exists
    product = await db.products.find_one({"product_id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Check if user already reviewed this product
    existing_review = await db.reviews.find_one({
        "product_id": product_id,
        "user_id": current_user.user_id
    })
    if existing_review:
        raise HTTPException(status_code=400, detail="You have already reviewed this product")
    
    # Create review
    review_id = f"review_{uuid.uuid4().hex[:12]}"
    review = {
        "review_id": review_id,
        "product_id": product_id,
        "user_id": current_user.user_id,
        "rating": request.rating,
        "comment": request.comment,
        "created_at": datetime.now(timezone.utc)
    }
    await db.reviews.insert_one(review)
    
    # Update product's average rating
    all_reviews = await db.reviews.find({"product_id": product_id}, {"_id": 0, "rating": 1}).to_list(1000)
    avg_rating = sum(r["rating"] for r in all_reviews) / len(all_reviews)
    await db.products.update_one(
        {"product_id": product_id},
        {"$set": {"average_rating": round(avg_rating, 1), "review_count": len(all_reviews)}}
    )
    
    # Update seller's overall rating
    seller_products = await db.products.find(
        {"seller_id": product["seller_id"]},
        {"_id": 0, "average_rating": 1, "review_count": 1}
    ).to_list(1000)
    
    total_reviews = sum(p.get("review_count", 0) for p in seller_products)
    if total_reviews > 0:
        weighted_sum = sum(p.get("average_rating", 0) * p.get("review_count", 0) for p in seller_products)
        seller_rating = weighted_sum / total_reviews
        await db.users.update_one(
            {"user_id": product["seller_id"]},
            {"$set": {"rating": round(seller_rating, 1)}}
        )
    
    # Return review with user info
    return {
        "review_id": review_id,
        "product_id": product_id,
        "user_id": current_user.user_id,
        "user_name": current_user.name,
        "user_photo": current_user.profile_photo,
        "rating": request.rating,
        "comment": request.comment,
        "created_at": datetime.now(timezone.utc).isoformat()
    }

@app.get("/api/products/{product_id}/reviews")
async def get_product_reviews(product_id: str, current_user: User = Depends(get_current_user)):
    """Get all reviews for a product"""
    reviews = await db.reviews.find(
        {"product_id": product_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Enrich with user info
    user_ids = list(set(r["user_id"] for r in reviews))
    users = await db.users.find(
        {"user_id": {"$in": user_ids}},
        {"_id": 0, "user_id": 1, "name": 1, "profile_photo": 1}
    ).to_list(len(user_ids))
    
    user_dict = {u["user_id"]: u for u in users}
    
    enriched_reviews = []
    for review in reviews:
        user = user_dict.get(review["user_id"], {})
        enriched_reviews.append({
            **review,
            "user_name": user.get("name", "Anonymous"),
            "user_photo": user.get("profile_photo"),
            "created_at": review["created_at"].isoformat() if isinstance(review["created_at"], datetime) else review["created_at"]
        })
    
    return enriched_reviews

# ===== CART ENDPOINTS =====
@app.get("/api/cart")
async def get_cart(current_user: User = Depends(get_current_user)):
    """Get user's cart"""
    cart = await db.carts.find_one({"user_id": current_user.user_id}, {"_id": 0})
    
    if not cart:
        return {"cart_id": f"cart_{uuid.uuid4().hex[:12]}", "user_id": current_user.user_id, "items": [], "updated_at": datetime.now(timezone.utc).isoformat()}
    
    # Enrich cart items with product details
    product_ids = [item["product_id"] for item in cart.get("items", [])]
    
    if not product_ids:
        cart["items"] = []
        return cart
    
    products = await db.products.find(
        {"product_id": {"$in": product_ids}},
        {"_id": 0}
    ).to_list(len(product_ids))
    
    # Get seller info for products
    seller_ids = list(set(p.get("seller_id") for p in products if p.get("seller_id")))
    sellers = await db.users.find(
        {"user_id": {"$in": seller_ids}},
        {"_id": 0, "user_id": 1, "name": 1, "profile_photo": 1}
    ).to_list(len(seller_ids))
    seller_dict = {s["user_id"]: s for s in sellers}
    
    product_dict = {}
    for p in products:
        p["seller"] = seller_dict.get(p.get("seller_id"))
        product_dict[p["product_id"]] = p
    
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

# ===== MESSAGING ENDPOINTS =====
@app.post("/api/messages")
async def send_message(request: CreateMessageRequest, current_user: User = Depends(get_current_user)):
    message_id = f"msg_{uuid.uuid4().hex[:12]}"
    message = {
        "message_id": message_id,
        "sender_id": current_user.user_id,
        "receiver_id": request.receiver_id,
        "text": request.text,
        "read": False,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.messages.insert_one(message)
    return await db.messages.find_one({"message_id": message_id}, {"_id": 0})

@app.get("/api/messages/conversations")
async def get_conversations(current_user: User = Depends(get_current_user)):
    messages = await db.messages.find({
        "$or": [
            {"sender_id": current_user.user_id},
            {"receiver_id": current_user.user_id}
        ]
    }, {"_id": 0}).sort("created_at", -1).limit(200).to_list(200)
    
    user_ids = set()
    for msg in messages:
        other_user_id = msg["receiver_id"] if msg["sender_id"] == current_user.user_id else msg["sender_id"]
        user_ids.add(other_user_id)
    
    users = await db.users.find(
        {"user_id": {"$in": list(user_ids)}},
        {"_id": 0, "user_id": 1, "name": 1, "profile_photo": 1}
    ).to_list(len(user_ids))
    
    user_dict = {user["user_id"]: user for user in users}
    
    conversations = {}
    for msg in messages:
        other_user_id = msg["receiver_id"] if msg["sender_id"] == current_user.user_id else msg["sender_id"]
        
        if other_user_id not in conversations:
            conversations[other_user_id] = {
                "user": user_dict.get(other_user_id),
                "last_message": msg,
                "unread_count": 0
            }
        
        if msg["receiver_id"] == current_user.user_id and not msg["read"]:
            conversations[other_user_id]["unread_count"] += 1
    
    return list(conversations.values())

@app.get("/api/messages/{other_user_id}")
async def get_messages(other_user_id: str, current_user: User = Depends(get_current_user)):
    messages = await db.messages.find({
        "$or": [
            {"sender_id": current_user.user_id, "receiver_id": other_user_id},
            {"sender_id": other_user_id, "receiver_id": current_user.user_id}
        ]
    }, {"_id": 0}).sort("created_at", 1).limit(500).to_list(500)
    
    await db.messages.update_many(
        {"sender_id": other_user_id, "receiver_id": current_user.user_id, "read": False},
        {"$set": {"read": True}}
    )
    
    return messages

# ===== COMMUNITY FEED ENDPOINTS =====
@app.post("/api/posts")
async def create_post(request: CreatePostRequest, current_user: User = Depends(get_current_user)):
    post_id = f"post_{uuid.uuid4().hex[:12]}"
    post = {
        "post_id": post_id,
        "user_id": current_user.user_id,
        "content": request.content,
        "images": request.images,
        "likes": [],
        "comments": [],
        "hashtags": request.hashtags,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.posts.insert_one(post)
    return await db.posts.find_one({"post_id": post_id}, {"_id": 0})

@app.get("/api/posts")
async def get_posts(limit: int = 50, current_user: User = Depends(get_current_user)):
    actual_limit = min(limit, 100)
    posts = await db.posts.find({}, {"_id": 0}).sort("created_at", -1).limit(actual_limit).to_list(actual_limit)
    
    # Collect all user IDs (post authors + comment authors)
    user_ids = set()
    for post in posts:
        user_ids.add(post["user_id"])
        for comment in post.get("comments", []):
            user_ids.add(comment.get("user_id"))
    
    users = await db.users.find(
        {"user_id": {"$in": list(user_ids)}},
        {"_id": 0, "user_id": 1, "name": 1, "profile_photo": 1, "location": 1}
    ).to_list(len(user_ids))
    
    user_dict = {user["user_id"]: user for user in users}
    
    for post in posts:
        user = user_dict.get(post["user_id"])
        post["user"] = user
        
        # Enrich comments with user info
        enriched_comments = []
        for comment in post.get("comments", []):
            comment_user = user_dict.get(comment.get("user_id"), {})
            enriched_comments.append({
                **comment,
                "user_name": comment_user.get("name", "Anonymous"),
                "user_photo": comment_user.get("profile_photo"),
                "created_at": comment["created_at"].isoformat() if isinstance(comment.get("created_at"), datetime) else comment.get("created_at")
            })
        post["comments"] = enriched_comments
        
        if current_user.location and user and user.get("location"):
            distance = calculate_distance(
                current_user.location.lat,
                current_user.location.lng,
                user["location"]["lat"],
                user["location"]["lng"]
            )
            post["distance"] = round(distance, 2)
    
    return posts

@app.post("/api/posts/{post_id}/like")
async def like_post(post_id: str, current_user: User = Depends(get_current_user)):
    post = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    if current_user.user_id in post.get("likes", []):
        await db.posts.update_one(
            {"post_id": post_id},
            {"$pull": {"likes": current_user.user_id}}
        )
        return {"liked": False}
    else:
        await db.posts.update_one(
            {"post_id": post_id},
            {"$push": {"likes": current_user.user_id}}
        )
        return {"liked": True}

@app.post("/api/posts/{post_id}/comment")
async def add_comment(post_id: str, request: AddCommentRequest, current_user: User = Depends(get_current_user)):
    post = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    comment = {
        "user_id": current_user.user_id,
        "text": request.text,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.posts.update_one(
        {"post_id": post_id},
        {"$push": {"comments": comment}}
    )
    
    return comment

# ===== HEALTH CHECK =====
@app.get("/")
async def root():
    return {"status": "ok", "message": "HarvestHub Marketplace API"}

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

@app.get("/api/categories")
async def get_categories():
    return {
        "categories": [
            "Vegetables",
            "Fruits",
            "Herbs",
            "Grains",
            "Dairy",
            "Eggs",
            "Honey",
            "Other"
        ]
    }

# ===== FOLLOW/UNFOLLOW ENDPOINTS =====
@app.post("/api/users/{user_id}/follow")
async def follow_user(user_id: str, current_user: User = Depends(get_current_user)):
    """Follow a user"""
    if user_id == current_user.user_id:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")
    
    target_user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Add to current user's following
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {"$addToSet": {"following": user_id}}
    )
    
    # Add to target user's followers
    await db.users.update_one(
        {"user_id": user_id},
        {"$addToSet": {"followers": current_user.user_id}}
    )
    
    # Create notification
    await db.notifications.insert_one({
        "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "from_user_id": current_user.user_id,
        "type": "follow",
        "read": False,
        "created_at": datetime.now(timezone.utc)
    })
    
    return {"message": "Followed successfully"}

@app.post("/api/users/{user_id}/unfollow")
async def unfollow_user(user_id: str, current_user: User = Depends(get_current_user)):
    """Unfollow a user"""
    # Remove from current user's following
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {"$pull": {"following": user_id}}
    )
    
    # Remove from target user's followers
    await db.users.update_one(
        {"user_id": user_id},
        {"$pull": {"followers": current_user.user_id}}
    )
    
    return {"message": "Unfollowed successfully"}

@app.get("/api/users/{user_id}/followers")
async def get_followers(user_id: str, current_user: User = Depends(get_current_user)):
    """Get user's followers list"""
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "followers": 1})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    follower_ids = user.get("followers", [])
    followers = await db.users.find(
        {"user_id": {"$in": follower_ids}},
        {"_id": 0, "user_id": 1, "name": 1, "profile_photo": 1, "bio": 1}
    ).to_list(100)
    
    return followers

@app.get("/api/users/{user_id}/following")
async def get_following(user_id: str, current_user: User = Depends(get_current_user)):
    """Get user's following list"""
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "following": 1})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    following_ids = user.get("following", [])
    following = await db.users.find(
        {"user_id": {"$in": following_ids}},
        {"_id": 0, "user_id": 1, "name": 1, "profile_photo": 1, "bio": 1}
    ).to_list(100)
    
    return following

# ===== NOTIFICATIONS ENDPOINTS =====
@app.get("/api/notifications")
async def get_notifications(current_user: User = Depends(get_current_user)):
    """Get user's notifications"""
    notifications = await db.notifications.find(
        {"user_id": current_user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    
    # Enrich with user data
    user_ids = list(set(n.get("from_user_id") for n in notifications if n.get("from_user_id")))
    users = await db.users.find(
        {"user_id": {"$in": user_ids}},
        {"_id": 0, "user_id": 1, "name": 1, "profile_photo": 1}
    ).to_list(len(user_ids))
    
    user_dict = {u["user_id"]: u for u in users}
    
    for notif in notifications:
        if notif.get("from_user_id"):
            notif["from_user"] = user_dict.get(notif["from_user_id"])
        
        # Add post/product data if referenced
        if notif.get("post_id"):
            post = await db.posts.find_one(
                {"post_id": notif["post_id"]},
                {"_id": 0, "content": 1}
            )
            if post:
                notif["post"] = {"content": post["content"][:50] + "..."}
    
    return notifications

@app.put("/api/notifications/mark-read")
async def mark_notifications_read(current_user: User = Depends(get_current_user)):
    """Mark all notifications as read"""
    await db.notifications.update_many(
        {"user_id": current_user.user_id, "read": False},
        {"$set": {"read": True}}
    )
    return {"message": "Notifications marked as read"}
