#!/usr/bin/env python3
"""
Script to create sample data for HarvestHub
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone, timedelta
import random
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "test_database")

# Sample data
SAMPLE_USERS = [
    {
        "user_id": "user_demo001",
        "email": "john@example.com",
        "name": "John Farmer",
        "phone": "+1234567890",
        "profile_photo": None,
        "location": {"lat": 40.7128, "lng": -74.0060, "address": "New York, NY"},
        "rating": 4.8,
        "total_sales": 25,
        "joined_date": datetime.now(timezone.utc) - timedelta(days=120),
        "verified": True,
        "followers": ["user_demo002", "user_demo003"],
        "following": ["user_demo002"],
        "bio": "Organic farmer for 10 years. Growing the best tomatoes in town!"
    },
    {
        "user_id": "user_demo002",
        "email": "sarah@example.com",
        "name": "Sarah Green",
        "phone": "+1234567891",
        "profile_photo": None,
        "location": {"lat": 40.7200, "lng": -74.0100, "address": "Brooklyn, NY"},
        "rating": 4.9,
        "total_sales": 42,
        "joined_date": datetime.now(timezone.utc) - timedelta(days=200),
        "verified": True,
        "followers": ["user_demo001"],
        "following": ["user_demo001", "user_demo003"],
        "bio": "Urban gardener specializing in herbs and microgreens"
    },
    {
        "user_id": "user_demo003",
        "email": "mike@example.com",
        "name": "Mike Harvest",
        "phone": "+1234567892",
        "profile_photo": None,
        "location": {"lat": 40.7300, "lng": -73.9900, "address": "Queens, NY"},
        "rating": 4.7,
        "total_sales": 18,
        "joined_date": datetime.now(timezone.utc) - timedelta(days=90),
        "verified": True,
        "followers": ["user_demo002"],
        "following": [],
        "bio": "Fresh fruits from my backyard garden!"
    }
]

SAMPLE_PRODUCTS = [
    {
        "product_id": "product_001",
        "seller_id": "user_demo001",
        "name": "Fresh Organic Tomatoes",
        "category": "Vegetables",
        "description": "Vine-ripened organic tomatoes from my backyard garden. Perfect for salads and sandwiches!",
        "photos": [],
        "price": 4.99,
        "quantity": 15,
        "unit": "lbs",
        "location": {"lat": 40.7128, "lng": -74.0060, "address": "New York, NY"},
        "status": "available",
        "created_at": datetime.now(timezone.utc) - timedelta(days=2),
        "views": 45
    },
    {
        "product_id": "product_002",
        "seller_id": "user_demo001",
        "name": "Garden Fresh Cucumbers",
        "category": "Vegetables",
        "description": "Crispy, fresh cucumbers picked this morning. No pesticides used.",
        "photos": [],
        "price": 2.99,
        "quantity": 20,
        "unit": "pieces",
        "location": {"lat": 40.7128, "lng": -74.0060, "address": "New York, NY"},
        "status": "available",
        "created_at": datetime.now(timezone.utc) - timedelta(days=1),
        "views": 28
    },
    {
        "product_id": "product_003",
        "seller_id": "user_demo002",
        "name": "Fresh Basil Bundle",
        "category": "Herbs",
        "description": "Aromatic fresh basil, perfect for Italian dishes. Grown with love!",
        "photos": [],
        "price": 3.49,
        "quantity": 25,
        "unit": "bundles",
        "location": {"lat": 40.7200, "lng": -74.0100, "address": "Brooklyn, NY"},
        "status": "available",
        "created_at": datetime.now(timezone.utc) - timedelta(hours=12),
        "views": 67
    },
    {
        "product_id": "product_004",
        "seller_id": "user_demo002",
        "name": "Microgreens Mix",
        "category": "Herbs",
        "description": "Nutritious mix of microgreens - perfect for smoothies and salads.",
        "photos": [],
        "price": 6.99,
        "quantity": 10,
        "unit": "boxes",
        "location": {"lat": 40.7200, "lng": -74.0100, "address": "Brooklyn, NY"},
        "status": "available",
        "created_at": datetime.now(timezone.utc) - timedelta(hours=6),
        "views": 35
    },
    {
        "product_id": "product_005",
        "seller_id": "user_demo003",
        "name": "Fresh Strawberries",
        "category": "Fruits",
        "description": "Sweet, juicy strawberries picked at peak ripeness.",
        "photos": [],
        "price": 5.99,
        "quantity": 8,
        "unit": "pints",
        "location": {"lat": 40.7300, "lng": -73.9900, "address": "Queens, NY"},
        "status": "available",
        "created_at": datetime.now(timezone.utc) - timedelta(hours=3),
        "views": 89
    },
    {
        "product_id": "product_006",
        "seller_id": "user_demo003",
        "name": "Backyard Blueberries",
        "category": "Fruits",
        "description": "Organic blueberries from my garden. High in antioxidants!",
        "photos": [],
        "price": 7.49,
        "quantity": 12,
        "unit": "pints",
        "location": {"lat": 40.7300, "lng": -73.9900, "address": "Queens, NY"},
        "status": "available",
        "created_at": datetime.now(timezone.utc) - timedelta(hours=1),
        "views": 56
    },
    {
        "product_id": "product_007",
        "seller_id": "user_demo001",
        "name": "Free Range Eggs",
        "category": "Eggs",
        "description": "Farm fresh eggs from happy chickens. Rich orange yolks!",
        "photos": [],
        "price": 6.00,
        "quantity": 30,
        "unit": "dozen",
        "location": {"lat": 40.7128, "lng": -74.0060, "address": "New York, NY"},
        "status": "available",
        "created_at": datetime.now(timezone.utc) - timedelta(days=1),
        "views": 42
    },
    {
        "product_id": "product_008",
        "seller_id": "user_demo002",
        "name": "Local Raw Honey",
        "category": "Honey",
        "description": "Pure, unfiltered honey from local bees. Great for allergies!",
        "photos": [],
        "price": 12.99,
        "quantity": 15,
        "unit": "jars",
        "location": {"lat": 40.7200, "lng": -74.0100, "address": "Brooklyn, NY"},
        "status": "available",
        "created_at": datetime.now(timezone.utc) - timedelta(hours=8),
        "views": 78
    }
]

SAMPLE_POSTS = [
    {
        "post_id": "post_001",
        "user_id": "user_demo001",
        "content": "Just harvested the first batch of tomatoes this season! 🍅 Can't wait to share them with the community. They're bursting with flavor!",
        "images": [],
        "likes": ["user_demo002", "user_demo003"],
        "comments": [
            {
                "user_id": "user_demo002",
                "text": "They look amazing! Save some for me!",
                "created_at": datetime.now(timezone.utc) - timedelta(hours=2)
            }
        ],
        "hashtags": ["organic", "tomatoes", "harvest"],
        "created_at": datetime.now(timezone.utc) - timedelta(hours=5)
    },
    {
        "post_id": "post_002",
        "user_id": "user_demo002",
        "content": "Tips for growing basil indoors: 1) Plenty of sunlight 2) Well-draining soil 3) Water when top inch is dry. Anyone else growing herbs at home? 🌿",
        "images": [],
        "likes": ["user_demo001"],
        "comments": [
            {
                "user_id": "user_demo003",
                "text": "Great tips! I'm trying to grow mint but it keeps spreading everywhere 😅",
                "created_at": datetime.now(timezone.utc) - timedelta(hours=3)
            },
            {
                "user_id": "user_demo001",
                "text": "Mint is so invasive! Try growing it in a container.",
                "created_at": datetime.now(timezone.utc) - timedelta(hours=2)
            }
        ],
        "hashtags": ["herbs", "gardening", "tips"],
        "created_at": datetime.now(timezone.utc) - timedelta(hours=12)
    },
    {
        "post_id": "post_003",
        "user_id": "user_demo003",
        "content": "Strawberry season is here! 🍓 These beauties are ready for picking. Nothing beats homegrown fruit!",
        "images": [],
        "likes": ["user_demo001", "user_demo002"],
        "comments": [],
        "hashtags": ["strawberries", "fruits", "homegrown"],
        "created_at": datetime.now(timezone.utc) - timedelta(hours=8)
    }
]

SAMPLE_MESSAGES = [
    {
        "message_id": "msg_001",
        "sender_id": "user_demo002",
        "receiver_id": "user_demo001",
        "text": "Hi John! Are the tomatoes still available?",
        "read": True,
        "created_at": datetime.now(timezone.utc) - timedelta(hours=10)
    },
    {
        "message_id": "msg_002",
        "sender_id": "user_demo001",
        "receiver_id": "user_demo002",
        "text": "Yes they are! I have about 15 lbs available. Would you like to pick them up?",
        "read": True,
        "created_at": datetime.now(timezone.utc) - timedelta(hours=9)
    },
    {
        "message_id": "msg_003",
        "sender_id": "user_demo002",
        "receiver_id": "user_demo001",
        "text": "Perfect! I'll take 5 lbs. Can we meet tomorrow afternoon?",
        "read": False,
        "created_at": datetime.now(timezone.utc) - timedelta(hours=8)
    },
    {
        "message_id": "msg_004",
        "sender_id": "user_demo003",
        "receiver_id": "user_demo002",
        "text": "Hey Sarah! Love your microgreens. Do you have any tips for growing them at home?",
        "read": True,
        "created_at": datetime.now(timezone.utc) - timedelta(hours=5)
    },
    {
        "message_id": "msg_005",
        "sender_id": "user_demo002",
        "receiver_id": "user_demo003",
        "text": "Thanks Mike! The key is good seeds and consistent moisture. Happy to show you sometime!",
        "read": False,
        "created_at": datetime.now(timezone.utc) - timedelta(hours=4)
    }
]

SAMPLE_NOTIFICATIONS = [
    {
        "notification_id": "notif_001",
        "user_id": "user_demo001",
        "from_user_id": "user_demo002",
        "type": "follow",
        "read": False,
        "created_at": datetime.now(timezone.utc) - timedelta(hours=2)
    },
    {
        "notification_id": "notif_002",
        "user_id": "user_demo001",
        "from_user_id": "user_demo003",
        "type": "like",
        "post_id": "post_001",
        "read": False,
        "created_at": datetime.now(timezone.utc) - timedelta(hours=5)
    },
    {
        "notification_id": "notif_003",
        "user_id": "user_demo002",
        "from_user_id": "user_demo001",
        "type": "comment",
        "post_id": "post_002",
        "read": True,
        "created_at": datetime.now(timezone.utc) - timedelta(hours=2)
    }
]


async def create_sample_data():
    """Create sample data in MongoDB"""
    print(f"Connecting to MongoDB at {MONGO_URL}...")
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    # Clear existing sample data
    print("Clearing existing sample data...")
    await db.users.delete_many({"user_id": {"$regex": "^user_demo"}})
    await db.products.delete_many({"product_id": {"$regex": "^product_"}})
    await db.posts.delete_many({"post_id": {"$regex": "^post_"}})
    await db.messages.delete_many({"message_id": {"$regex": "^msg_"}})
    await db.notifications.delete_many({"notification_id": {"$regex": "^notif_"}})

    # Insert sample users
    print("Creating sample users...")
    for user in SAMPLE_USERS:
        await db.users.insert_one(user)
    print(f"  Created {len(SAMPLE_USERS)} users")

    # Insert sample products
    print("Creating sample products...")
    for product in SAMPLE_PRODUCTS:
        await db.products.insert_one(product)
    print(f"  Created {len(SAMPLE_PRODUCTS)} products")

    # Insert sample posts
    print("Creating sample posts...")
    for post in SAMPLE_POSTS:
        await db.posts.insert_one(post)
    print(f"  Created {len(SAMPLE_POSTS)} posts")

    # Insert sample messages
    print("Creating sample messages...")
    for msg in SAMPLE_MESSAGES:
        await db.messages.insert_one(msg)
    print(f"  Created {len(SAMPLE_MESSAGES)} messages")

    # Insert sample notifications
    print("Creating sample notifications...")
    for notif in SAMPLE_NOTIFICATIONS:
        await db.notifications.insert_one(notif)
    print(f"  Created {len(SAMPLE_NOTIFICATIONS)} notifications")

    # Create indexes
    print("Creating indexes...")
    await db.users.create_index("user_id", unique=True)
    await db.users.create_index("email", unique=True)
    await db.products.create_index("product_id", unique=True)
    await db.products.create_index("seller_id")
    await db.products.create_index("category")
    await db.posts.create_index("post_id", unique=True)
    await db.posts.create_index("user_id")
    await db.messages.create_index("message_id", unique=True)
    await db.messages.create_index([("sender_id", 1), ("receiver_id", 1)])
    await db.notifications.create_index("user_id")

    print("\\n✅ Sample data created successfully!")
    print("\\nSample users:")
    for user in SAMPLE_USERS:
        print(f"  - {user['name']} ({user['email']})")
    
    print("\\nSample products:")
    for product in SAMPLE_PRODUCTS:
        print(f"  - {product['name']} (${product['price']}/{product['unit']})")

    client.close()


if __name__ == "__main__":
    asyncio.run(create_sample_data())
