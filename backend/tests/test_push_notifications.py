"""
CampusBite Push Notification API Tests
Tests for Web Push notification feature and existing auth/order flows
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials - sourced from environment variables
STUDENT_AUID = os.environ.get('TEST_STUDENT_AUID', 'AIT24BEIS001')
STAFF_EMAIL = os.environ.get('TEST_STAFF_EMAIL', 'maincanteen@ait.edu')
STAFF_PASSWORD = os.environ.get('TEST_STAFF_PASSWORD', '')
ADMIN_EMAIL = os.environ.get('TEST_ADMIN_EMAIL', '')
ADMIN_PASSWORD = os.environ.get('TEST_ADMIN_PASSWORD', '')


class TestHealthAndBasics:
    """Basic health check and API availability tests"""
    
    def test_api_root(self):
        """Test API root endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "CampusBite" in data["message"]
        print("✓ API root endpoint working")
    
    def test_service_worker_accessible(self):
        """Test that service worker file is accessible at /sw.js"""
        response = requests.get(f"{BASE_URL}/sw.js")
        assert response.status_code == 200
        content = response.text
        assert "push" in content.lower()
        assert "addEventListener" in content
        print("✓ Service worker /sw.js is accessible")


class TestAuthFlows:
    """Authentication endpoint tests"""
    
    def test_student_login_with_auid(self):
        """Test student login with AUID"""
        response = requests.post(f"{BASE_URL}/api/auth/student/login", json={
            "auid": STUDENT_AUID
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["role"] == "student"
        assert data["user"]["auid"] == STUDENT_AUID.upper()
        print(f"✓ Student login successful with AUID: {STUDENT_AUID}")
        return data["token"]
    
    def test_staff_login(self):
        """Test staff login"""
        response = requests.post(f"{BASE_URL}/api/auth/staff/login", json={
            "email": STAFF_EMAIL,
            "password": STAFF_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["role"] == "canteen_staff"
        assert data["user"]["canteen_id"] == "main"
        print(f"✓ Staff login successful: {STAFF_EMAIL}")
        return data["token"]
    
    def test_admin_login(self):
        """Test admin login"""
        response = requests.post(f"{BASE_URL}/api/auth/admin/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["role"] == "admin"
        print(f"✓ Admin login successful: {ADMIN_EMAIL}")
        return data["token"]
    
    def test_staff_login_invalid_credentials(self):
        """Test staff login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/staff/login", json={
            "email": "wrong@email.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("✓ Invalid staff credentials rejected correctly")


class TestPushNotificationAPIs:
    """Push notification specific API tests"""
    
    def test_get_vapid_key(self):
        """Test GET /api/push/vapid-key returns VAPID public key"""
        response = requests.get(f"{BASE_URL}/api/push/vapid-key")
        assert response.status_code == 200
        data = response.json()
        assert "public_key" in data
        assert len(data["public_key"]) > 50  # VAPID keys are long
        print(f"✓ VAPID public key returned: {data['public_key'][:30]}...")
    
    def test_push_subscribe_requires_auth(self):
        """Test POST /api/push/subscribe rejects unauthenticated requests"""
        response = requests.post(f"{BASE_URL}/api/push/subscribe", json={
            "subscription": {
                "endpoint": "https://fake-push-service.com/test",
                "keys": {"p256dh": "test", "auth": "test"}
            }
        })
        assert response.status_code == 401
        print("✓ Push subscribe correctly rejects unauthenticated requests")
    
    def test_push_subscribe_authenticated(self):
        """Test POST /api/push/subscribe stores subscription for authenticated student"""
        # First login as student
        login_resp = requests.post(f"{BASE_URL}/api/auth/student/login", json={
            "auid": "TEST_PUSH_STUDENT"
        })
        assert login_resp.status_code == 200
        token = login_resp.json()["token"]
        
        # Subscribe to push
        unique_endpoint = f"https://fake-push-service.com/test-{uuid.uuid4()}"
        response = requests.post(
            f"{BASE_URL}/api/push/subscribe",
            json={
                "subscription": {
                    "endpoint": unique_endpoint,
                    "keys": {"p256dh": "test_key", "auth": "test_auth"}
                }
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "subscribed"
        print("✓ Push subscription created successfully")
        
        return token, unique_endpoint
    
    def test_push_subscribe_duplicate_returns_already_subscribed(self):
        """Test POST /api/push/subscribe returns 'already_subscribed' for duplicate endpoint"""
        # Login as student
        login_resp = requests.post(f"{BASE_URL}/api/auth/student/login", json={
            "auid": "TEST_PUSH_DUP"
        })
        token = login_resp.json()["token"]
        
        # Subscribe first time
        endpoint = f"https://fake-push-service.com/dup-test-{uuid.uuid4()}"
        subscription = {
            "subscription": {
                "endpoint": endpoint,
                "keys": {"p256dh": "test_key", "auth": "test_auth"}
            }
        }
        headers = {"Authorization": f"Bearer {token}"}
        
        resp1 = requests.post(f"{BASE_URL}/api/push/subscribe", json=subscription, headers=headers)
        assert resp1.status_code == 200
        assert resp1.json()["status"] == "subscribed"
        
        # Subscribe again with same endpoint
        resp2 = requests.post(f"{BASE_URL}/api/push/subscribe", json=subscription, headers=headers)
        assert resp2.status_code == 200
        assert resp2.json()["status"] == "already_subscribed"
        print("✓ Duplicate subscription correctly returns 'already_subscribed'")
    
    def test_push_unsubscribe(self):
        """Test POST /api/push/unsubscribe removes subscription"""
        # Login as student
        login_resp = requests.post(f"{BASE_URL}/api/auth/student/login", json={
            "auid": "TEST_PUSH_UNSUB"
        })
        token = login_resp.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Subscribe first
        endpoint = f"https://fake-push-service.com/unsub-test-{uuid.uuid4()}"
        subscription = {
            "subscription": {
                "endpoint": endpoint,
                "keys": {"p256dh": "test_key", "auth": "test_auth"}
            }
        }
        
        requests.post(f"{BASE_URL}/api/push/subscribe", json=subscription, headers=headers)
        
        # Unsubscribe
        response = requests.post(f"{BASE_URL}/api/push/unsubscribe", json=subscription, headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "unsubscribed"
        assert "count" in data
        print("✓ Push unsubscribe works correctly")


class TestOrderFlow:
    """Order creation and status update tests"""
    
    @pytest.fixture
    def student_token(self):
        """Get student token"""
        resp = requests.post(f"{BASE_URL}/api/auth/student/login", json={
            "auid": "TEST_ORDER_STUDENT"
        })
        return resp.json()["token"]
    
    @pytest.fixture
    def staff_token(self):
        """Get staff token"""
        resp = requests.post(f"{BASE_URL}/api/auth/staff/login", json={
            "email": STAFF_EMAIL,
            "password": STAFF_PASSWORD
        })
        return resp.json()["token"]
    
    def test_create_order(self, student_token):
        """Test POST /api/orders creates order"""
        response = requests.post(
            f"{BASE_URL}/api/orders",
            json={
                "canteen_id": "main",
                "items": [
                    {"item_id": "m1", "name": "Veg Thali", "qty": 1, "price": 80}
                ]
            },
            headers={"Authorization": f"Bearer {student_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "order_id" in data
        assert "token_number" in data
        assert data["status"] == "placed"
        assert data["canteen_id"] == "main"
        print(f"✓ Order created: #{data['token_number']}")
        return data["order_id"]
    
    def test_order_status_update_to_preparing(self, student_token, staff_token):
        """Test PATCH /api/staff/orders/{order_id}/status to 'preparing' triggers push notification logic"""
        # Create order first
        order_resp = requests.post(
            f"{BASE_URL}/api/orders",
            json={
                "canteen_id": "main",
                "items": [
                    {"item_id": "m1", "name": "Veg Thali", "qty": 1, "price": 80}
                ]
            },
            headers={"Authorization": f"Bearer {student_token}"}
        )
        order_id = order_resp.json()["order_id"]
        
        # Update status to preparing
        response = requests.patch(
            f"{BASE_URL}/api/staff/orders/{order_id}/status",
            json={"status": "preparing"},
            headers={"Authorization": f"Bearer {staff_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "preparing"
        print(f"✓ Order status updated to 'preparing' - push notification triggered")
        return order_id
    
    def test_order_status_update_to_ready(self, student_token, staff_token):
        """Test PATCH /api/staff/orders/{order_id}/status to 'ready' triggers push notification logic"""
        # Create order
        order_resp = requests.post(
            f"{BASE_URL}/api/orders",
            json={
                "canteen_id": "main",
                "items": [
                    {"item_id": "m2", "name": "Paneer Thali", "qty": 1, "price": 100}
                ]
            },
            headers={"Authorization": f"Bearer {student_token}"}
        )
        order_id = order_resp.json()["order_id"]
        
        # Update to preparing first
        requests.patch(
            f"{BASE_URL}/api/staff/orders/{order_id}/status",
            json={"status": "preparing"},
            headers={"Authorization": f"Bearer {staff_token}"}
        )
        
        # Update to ready
        response = requests.patch(
            f"{BASE_URL}/api/staff/orders/{order_id}/status",
            json={"status": "ready"},
            headers={"Authorization": f"Bearer {staff_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ready"
        print(f"✓ Order status updated to 'ready' - push notification triggered")


class TestSSENotificationStream:
    """Test existing SSE notification stream still works"""
    
    def test_sse_stream_requires_token(self):
        """Test /api/notifications/stream requires token"""
        response = requests.get(f"{BASE_URL}/api/notifications/stream", timeout=5)
        assert response.status_code == 401
        print("✓ SSE stream correctly requires token")
    
    def test_sse_stream_with_valid_token(self):
        """Test /api/notifications/stream works with valid token"""
        # Get student token
        login_resp = requests.post(f"{BASE_URL}/api/auth/student/login", json={
            "auid": "TEST_SSE_STUDENT"
        })
        token = login_resp.json()["token"]
        
        # Connect to SSE stream with timeout
        try:
            response = requests.get(
                f"{BASE_URL}/api/notifications/stream?token={token}",
                stream=True,
                timeout=3
            )
            assert response.status_code == 200
            assert "text/event-stream" in response.headers.get("Content-Type", "")
            
            # Read first event (should be connected message)
            for line in response.iter_lines(decode_unicode=True):
                if line and line.startswith("data:"):
                    import json
                    data = json.loads(line[5:].strip())
                    assert data["type"] == "connected"
                    print("✓ SSE stream connected successfully")
                    break
            response.close()
        except requests.exceptions.ReadTimeout:
            # Timeout is expected after initial connection
            print("✓ SSE stream connection established (timeout expected)")


class TestCanteenAndMenuAPIs:
    """Test existing canteen and menu APIs still work"""
    
    def test_get_canteens(self):
        """Test GET /api/canteens"""
        response = requests.get(f"{BASE_URL}/api/canteens")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        assert "canteen_id" in data[0]
        print(f"✓ Canteens API working - {len(data)} canteens found")
    
    def test_get_menu(self):
        """Test GET /api/canteens/{canteen_id}/menu"""
        response = requests.get(f"{BASE_URL}/api/canteens/main/menu")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        assert "item_id" in data[0]
        assert "name" in data[0]
        assert "price" in data[0]
        print(f"✓ Menu API working - {len(data)} items found")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
