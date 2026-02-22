#!/usr/bin/env python3
"""
HarvestHub Backend Authentication Testing Suite
Testing newly implemented authentication endpoints
"""

import requests
import json
import sys
from datetime import datetime

# Backend URL from environment
BACKEND_URL = "https://session-clear.preview.emergentagent.com/api"

class TestResults:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.results = []
    
    def add_result(self, test_name, passed, message="", response_data=None):
        self.results.append({
            "test": test_name,
            "passed": passed,
            "message": message,
            "response_data": response_data
        })
        if passed:
            self.passed += 1
        else:
            self.failed += 1
    
    def print_summary(self):
        print(f"\n{'='*60}")
        print(f"TEST SUMMARY")
        print(f"{'='*60}")
        print(f"Total Tests: {self.passed + self.failed}")
        print(f"Passed: {self.passed}")
        print(f"Failed: {self.failed}")
        print(f"Success Rate: {(self.passed/(self.passed + self.failed)*100):.1f}%")
        
        if self.failed > 0:
            print(f"\n{'='*60}")
            print("FAILED TESTS:")
            print(f"{'='*60}")
            for result in self.results:
                if not result["passed"]:
                    print(f"❌ {result['test']}: {result['message']}")

def test_health_check():
    """Test basic health check endpoint"""
    try:
        response = requests.get(f"{BACKEND_URL}/health", timeout=10)
        if response.status_code == 200:
            return True, "Health check passed"
        else:
            return False, f"Health check failed with status {response.status_code}"
    except Exception as e:
        return False, f"Health check failed: {str(e)}"

def test_email_password_registration():
    """Test email/password registration endpoint"""
    test_data = {
        "email": "alice.farmer@example.com",
        "password": "SecurePass123!",
        "name": "Alice Farmer"
    }
    
    try:
        response = requests.post(f"{BACKEND_URL}/auth/register", json=test_data, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if "session_token" in data and "user" in data:
                user = data["user"]
                if (user["email"] == test_data["email"].lower() and 
                    user["name"] == test_data["name"] and
                    "password_hash" not in user):
                    return True, "Registration successful", data
                else:
                    return False, "Registration response missing required fields or contains password_hash", data
            else:
                return False, "Registration response missing session_token or user", data
        elif response.status_code == 400:
            error_msg = response.json().get("detail", "Unknown error")
            if "already registered" in error_msg:
                return True, "Registration correctly rejected duplicate email", response.json()
            else:
                return False, f"Registration failed with validation error: {error_msg}", response.json()
        else:
            return False, f"Registration failed with status {response.status_code}: {response.text}", None
            
    except Exception as e:
        return False, f"Registration test failed: {str(e)}", None

def test_registration_validation():
    """Test registration input validation"""
    results = []
    
    # Test invalid email format
    try:
        response = requests.post(f"{BACKEND_URL}/auth/register", json={
            "email": "invalid-email",
            "password": "SecurePass123!",
            "name": "Test User"
        }, timeout=10)
        
        if response.status_code == 400 and "Invalid email format" in response.json().get("detail", ""):
            results.append((True, "Invalid email format correctly rejected"))
        else:
            results.append((False, f"Invalid email should be rejected, got status {response.status_code}"))
    except Exception as e:
        results.append((False, f"Invalid email test failed: {str(e)}"))
    
    # Test short password
    try:
        response = requests.post(f"{BACKEND_URL}/auth/register", json={
            "email": "test@example.com",
            "password": "short",
            "name": "Test User"
        }, timeout=10)
        
        if response.status_code == 400 and "at least 8 characters" in response.json().get("detail", ""):
            results.append((True, "Short password correctly rejected"))
        else:
            results.append((False, f"Short password should be rejected, got status {response.status_code}"))
    except Exception as e:
        results.append((False, f"Short password test failed: {str(e)}"))
    
    # Check if all validation tests passed
    all_passed = all(result[0] for result in results)
    messages = [result[1] for result in results]
    
    return all_passed, "; ".join(messages), results

def test_email_password_login():
    """Test email/password login endpoint"""
    # First register a user
    register_data = {
        "email": "bob.grower@example.com",
        "password": "MyPassword123!",
        "name": "Bob Grower"
    }
    
    try:
        # Register user first
        reg_response = requests.post(f"{BACKEND_URL}/auth/register", json=register_data, timeout=10)
        
        # Now test login
        login_data = {
            "email": "bob.grower@example.com",
            "password": "MyPassword123!"
        }
        
        response = requests.post(f"{BACKEND_URL}/auth/login", json=login_data, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if "session_token" in data and "user" in data:
                user = data["user"]
                if (user["email"] == login_data["email"].lower() and
                    "password_hash" not in user):
                    return True, "Login successful", data
                else:
                    return False, "Login response missing required fields or contains password_hash", data
            else:
                return False, "Login response missing session_token or user", data
        else:
            return False, f"Login failed with status {response.status_code}: {response.text}", None
            
    except Exception as e:
        return False, f"Login test failed: {str(e)}", None

def test_login_validation():
    """Test login validation with wrong credentials"""
    results = []
    
    # Test wrong password
    try:
        response = requests.post(f"{BACKEND_URL}/auth/login", json={
            "email": "bob.grower@example.com",
            "password": "WrongPassword123!"
        }, timeout=10)
        
        if response.status_code == 401 and "Invalid email or password" in response.json().get("detail", ""):
            results.append((True, "Wrong password correctly rejected"))
        else:
            results.append((False, f"Wrong password should be rejected, got status {response.status_code}"))
    except Exception as e:
        results.append((False, f"Wrong password test failed: {str(e)}"))
    
    # Test non-existent email
    try:
        response = requests.post(f"{BACKEND_URL}/auth/login", json={
            "email": "nonexistent@example.com",
            "password": "SomePassword123!"
        }, timeout=10)
        
        if response.status_code == 401 and "Invalid email or password" in response.json().get("detail", ""):
            results.append((True, "Non-existent email correctly rejected"))
        else:
            results.append((False, f"Non-existent email should be rejected, got status {response.status_code}"))
    except Exception as e:
        results.append((False, f"Non-existent email test failed: {str(e)}"))
    
    # Check if all validation tests passed
    all_passed = all(result[0] for result in results)
    messages = [result[1] for result in results]
    
    return all_passed, "; ".join(messages), results

def test_session_validation(session_token):
    """Test session validation endpoint"""
    try:
        headers = {"Authorization": f"Bearer {session_token}"}
        response = requests.get(f"{BACKEND_URL}/auth/me", headers=headers, timeout=10)
        
        if response.status_code == 200:
            user_data = response.json()
            if "user_id" in user_data and "email" in user_data and "name" in user_data:
                return True, "Session validation successful", user_data
            else:
                return False, "Session validation response missing required fields", user_data
        else:
            return False, f"Session validation failed with status {response.status_code}: {response.text}", None
            
    except Exception as e:
        return False, f"Session validation test failed: {str(e)}", None

def test_profile_update_with_zip(session_token):
    """Test profile update with ZIP code field"""
    try:
        headers = {"Authorization": f"Bearer {session_token}"}
        update_data = {
            "zip_code": "90210",
            "name": "Updated Name",
            "bio": "I'm a passionate home grower!"
        }
        
        response = requests.put(f"{BACKEND_URL}/users/profile", json=update_data, headers=headers, timeout=10)
        
        if response.status_code == 200:
            user_data = response.json()
            if (user_data.get("zip_code") == "90210" and 
                user_data.get("name") == "Updated Name" and
                user_data.get("bio") == "I'm a passionate home grower!"):
                return True, "Profile update with ZIP code successful", user_data
            else:
                return False, f"Profile update failed - ZIP code not saved correctly. Got: {user_data.get('zip_code')}", user_data
        else:
            return False, f"Profile update failed with status {response.status_code}: {response.text}", None
            
    except Exception as e:
        return False, f"Profile update test failed: {str(e)}", None

def test_unauthorized_access():
    """Test that endpoints properly reject unauthorized requests"""
    try:
        # Test /auth/me without token
        response = requests.get(f"{BACKEND_URL}/auth/me", timeout=10)
        
        if response.status_code == 401:
            return True, "Unauthorized access correctly rejected", None
        else:
            return False, f"Unauthorized access should be rejected, got status {response.status_code}", None
            
    except Exception as e:
        return False, f"Unauthorized access test failed: {str(e)}", None

def main():
    print(f"🧪 HarvestHub Backend Authentication Testing")
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*60)
    
    results = TestResults()
    session_token = None
    
    # Test 1: Health Check
    print("1. Testing health check...")
    passed, message = test_health_check()
    results.add_result("Health Check", passed, message)
    print(f"   {'✅' if passed else '❌'} {message}")
    
    # Test 2: Email/Password Registration
    print("\n2. Testing email/password registration...")
    passed, message, data = test_email_password_registration()
    results.add_result("Email/Password Registration", passed, message, data)
    print(f"   {'✅' if passed else '❌'} {message}")
    if passed and data and "session_token" in data:
        session_token = data["session_token"]
    
    # Test 3: Registration Validation
    print("\n3. Testing registration input validation...")
    passed, message, data = test_registration_validation()
    results.add_result("Registration Validation", passed, message, data)
    print(f"   {'✅' if passed else '❌'} {message}")
    
    # Test 4: Email/Password Login
    print("\n4. Testing email/password login...")
    passed, message, data = test_email_password_login()
    results.add_result("Email/Password Login", passed, message, data)
    print(f"   {'✅' if passed else '❌'} {message}")
    if passed and data and "session_token" in data:
        session_token = data["session_token"]  # Use login token for subsequent tests
    
    # Test 5: Login Validation
    print("\n5. Testing login validation...")
    passed, message, data = test_login_validation()
    results.add_result("Login Validation", passed, message, data)
    print(f"   {'✅' if passed else '❌'} {message}")
    
    # Test 6: Session Validation (only if we have a token)
    if session_token:
        print("\n6. Testing session validation...")
        passed, message, data = test_session_validation(session_token)
        results.add_result("Session Validation", passed, message, data)
        print(f"   {'✅' if passed else '❌'} {message}")
        
        # Test 7: Profile Update with ZIP Code
        print("\n7. Testing profile update with ZIP code...")
        passed, message, data = test_profile_update_with_zip(session_token)
        results.add_result("Profile Update with ZIP Code", passed, message, data)
        print(f"   {'✅' if passed else '❌'} {message}")
    else:
        print("\n6-7. Skipping session-dependent tests (no valid session token)")
        results.add_result("Session Validation", False, "Skipped - no session token available")
        results.add_result("Profile Update with ZIP Code", False, "Skipped - no session token available")
    
    # Test 8: Unauthorized Access
    print("\n8. Testing unauthorized access rejection...")
    passed, message, data = test_unauthorized_access()
    results.add_result("Unauthorized Access Rejection", passed, message, data)
    print(f"   {'✅' if passed else '❌'} {message}")
    
    # Print summary
    results.print_summary()
    
    # Return exit code based on results
    return 0 if results.failed == 0 else 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)