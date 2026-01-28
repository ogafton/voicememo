#!/usr/bin/env python3
"""
Backend API Testing for To Do List App
Tests all CRUD operations for todos API endpoints
"""

import requests
import json
import time
from datetime import datetime
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/frontend/.env')

# Get backend URL from environment
BACKEND_URL = os.getenv('EXPO_PUBLIC_BACKEND_URL', 'http://localhost:8001')
API_BASE = f"{BACKEND_URL}/api"

class TodoAPITester:
    def __init__(self):
        self.base_url = API_BASE
        self.created_todos = []  # Track created todos for cleanup
        
    def log(self, message, level="INFO"):
        """Log test messages with timestamp"""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{timestamp}] [{level}] {message}")
        
    def test_api_connection(self):
        """Test basic API connectivity"""
        self.log("Testing API connection...")
        try:
            response = requests.get(f"{self.base_url}/", timeout=10)
            if response.status_code == 200:
                self.log("✅ API connection successful")
                return True
            else:
                self.log(f"❌ API connection failed with status {response.status_code}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ API connection failed: {str(e)}", "ERROR")
            return False
    
    def test_create_todo(self):
        """Test POST /api/todos endpoint"""
        self.log("Testing CREATE todo endpoint...")
        
        # Test cases with different priorities
        test_cases = [
            {"text": "Finalizează proiectul urgent", "priority": "urgent"},
            {"text": "Cumpără ingrediente pentru cină", "priority": "normal"},
            {"text": "Citește cartea nouă", "priority": "low"},
            {"text": "Organizează biroul"}  # Test default priority
        ]
        
        success_count = 0
        for i, todo_data in enumerate(test_cases):
            try:
                response = requests.post(f"{self.base_url}/todos", json=todo_data, timeout=10)
                
                if response.status_code == 200:
                    todo = response.json()
                    self.created_todos.append(todo['id'])
                    
                    # Validate response structure
                    required_fields = ['id', 'text', 'priority', 'completed', 'created_at', 'updated_at']
                    if all(field in todo for field in required_fields):
                        self.log(f"✅ Todo {i+1} created successfully: {todo['text']}")
                        success_count += 1
                        
                        # Validate priority
                        expected_priority = todo_data.get('priority', 'normal')
                        if todo['priority'] == expected_priority:
                            self.log(f"✅ Priority correctly set to: {todo['priority']}")
                        else:
                            self.log(f"❌ Priority mismatch. Expected: {expected_priority}, Got: {todo['priority']}", "ERROR")
                    else:
                        self.log(f"❌ Todo {i+1} missing required fields", "ERROR")
                else:
                    self.log(f"❌ Failed to create todo {i+1}: {response.status_code} - {response.text}", "ERROR")
                    
            except Exception as e:
                self.log(f"❌ Error creating todo {i+1}: {str(e)}", "ERROR")
        
        self.log(f"CREATE test completed: {success_count}/{len(test_cases)} successful")
        return success_count == len(test_cases)
    
    def test_get_todos(self):
        """Test GET /api/todos endpoint"""
        self.log("Testing GET todos endpoint...")
        
        try:
            response = requests.get(f"{self.base_url}/todos", timeout=10)
            
            if response.status_code == 200:
                todos = response.json()
                self.log(f"✅ Retrieved {len(todos)} todos")
                
                # Validate sorting (created_at desc)
                if len(todos) > 1:
                    is_sorted = True
                    for i in range(len(todos) - 1):
                        current_time = datetime.fromisoformat(todos[i]['created_at'].replace('Z', '+00:00'))
                        next_time = datetime.fromisoformat(todos[i+1]['created_at'].replace('Z', '+00:00'))
                        if current_time < next_time:
                            is_sorted = False
                            break
                    
                    if is_sorted:
                        self.log("✅ Todos are correctly sorted by created_at (desc)")
                    else:
                        self.log("❌ Todos are NOT correctly sorted by created_at (desc)", "ERROR")
                        return False
                
                # Validate structure of each todo
                for todo in todos:
                    required_fields = ['id', 'text', 'priority', 'completed', 'created_at', 'updated_at']
                    if not all(field in todo for field in required_fields):
                        self.log(f"❌ Todo missing required fields: {todo}", "ERROR")
                        return False
                
                self.log("✅ All todos have correct structure")
                return True
            else:
                self.log(f"❌ Failed to get todos: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Error getting todos: {str(e)}", "ERROR")
            return False
    
    def test_toggle_todo(self):
        """Test PUT /api/todos/{id}/toggle endpoint"""
        self.log("Testing TOGGLE todo endpoint...")
        
        if not self.created_todos:
            self.log("❌ No todos available for toggle test", "ERROR")
            return False
        
        todo_id = self.created_todos[0]
        
        try:
            # First toggle (should set to completed=True)
            response = requests.put(f"{self.base_url}/todos/{todo_id}/toggle", timeout=10)
            
            if response.status_code == 200:
                todo = response.json()
                if todo['completed'] == True:
                    self.log("✅ Todo toggled to completed successfully")
                else:
                    self.log(f"❌ Toggle failed - expected completed=True, got {todo['completed']}", "ERROR")
                    return False
                
                # Second toggle (should set back to completed=False)
                response = requests.put(f"{self.base_url}/todos/{todo_id}/toggle", timeout=10)
                
                if response.status_code == 200:
                    todo = response.json()
                    if todo['completed'] == False:
                        self.log("✅ Todo toggled back to incomplete successfully")
                        return True
                    else:
                        self.log(f"❌ Second toggle failed - expected completed=False, got {todo['completed']}", "ERROR")
                        return False
                else:
                    self.log(f"❌ Second toggle request failed: {response.status_code}", "ERROR")
                    return False
            else:
                self.log(f"❌ Toggle request failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Error toggling todo: {str(e)}", "ERROR")
            return False
    
    def test_update_todo(self):
        """Test PUT /api/todos/{id} endpoint"""
        self.log("Testing UPDATE todo endpoint...")
        
        if not self.created_todos:
            self.log("❌ No todos available for update test", "ERROR")
            return False
        
        todo_id = self.created_todos[0] if len(self.created_todos) > 0 else None
        if not todo_id:
            self.log("❌ No valid todo ID for update test", "ERROR")
            return False
        
        update_data = {
            "text": "Task actualizat cu succes",
            "priority": "urgent",
            "completed": True
        }
        
        try:
            response = requests.put(f"{self.base_url}/todos/{todo_id}", json=update_data, timeout=10)
            
            if response.status_code == 200:
                todo = response.json()
                
                # Validate all updates were applied
                if (todo['text'] == update_data['text'] and 
                    todo['priority'] == update_data['priority'] and 
                    todo['completed'] == update_data['completed']):
                    self.log("✅ Todo updated successfully with all fields")
                    return True
                else:
                    self.log(f"❌ Update validation failed. Expected: {update_data}, Got: {todo}", "ERROR")
                    return False
            else:
                self.log(f"❌ Update request failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Error updating todo: {str(e)}", "ERROR")
            return False
    
    def test_delete_todo(self):
        """Test DELETE /api/todos/{id} endpoint"""
        self.log("Testing DELETE todo endpoint...")
        
        if not self.created_todos:
            self.log("❌ No todos available for delete test", "ERROR")
            return False
        
        # Test deleting existing todo
        todo_id = self.created_todos.pop()  # Remove from tracking list
        
        try:
            response = requests.delete(f"{self.base_url}/todos/{todo_id}", timeout=10)
            
            if response.status_code == 200:
                self.log("✅ Todo deleted successfully")
                
                # Verify todo is actually deleted
                get_response = requests.get(f"{self.base_url}/todos", timeout=10)
                if get_response.status_code == 200:
                    todos = get_response.json()
                    if not any(todo['id'] == todo_id for todo in todos):
                        self.log("✅ Todo confirmed deleted from database")
                    else:
                        self.log("❌ Todo still exists in database after deletion", "ERROR")
                        return False
                
                # Test deleting non-existent todo (should return 404)
                fake_id = "non-existent-id-12345"
                response = requests.delete(f"{self.base_url}/todos/{fake_id}", timeout=10)
                
                if response.status_code == 404:
                    self.log("✅ Correctly returned 404 for non-existent todo")
                    return True
                else:
                    self.log(f"❌ Expected 404 for non-existent todo, got {response.status_code}", "ERROR")
                    return False
            else:
                self.log(f"❌ Delete request failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Error deleting todo: {str(e)}", "ERROR")
            return False
    
    def cleanup(self):
        """Clean up any remaining test todos"""
        self.log("Cleaning up test data...")
        for todo_id in self.created_todos:
            try:
                requests.delete(f"{self.base_url}/todos/{todo_id}", timeout=5)
            except:
                pass  # Ignore cleanup errors
        self.log("Cleanup completed")
    
    def run_all_tests(self):
        """Run all API tests in sequence"""
        self.log("=" * 60)
        self.log("STARTING TODO API TESTS")
        self.log(f"Backend URL: {self.base_url}")
        self.log("=" * 60)
        
        test_results = {}
        
        # Test API connection first
        if not self.test_api_connection():
            self.log("❌ API connection failed - aborting tests", "ERROR")
            return {"connection": False}
        
        test_results["connection"] = True
        
        # Run all CRUD tests
        test_results["create"] = self.test_create_todo()
        test_results["get"] = self.test_get_todos()
        test_results["toggle"] = self.test_toggle_todo()
        test_results["update"] = self.test_update_todo()
        test_results["delete"] = self.test_delete_todo()
        
        # Cleanup
        self.cleanup()
        
        # Summary
        self.log("=" * 60)
        self.log("TEST RESULTS SUMMARY")
        self.log("=" * 60)
        
        passed = sum(1 for result in test_results.values() if result)
        total = len(test_results)
        
        for test_name, result in test_results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            self.log(f"{test_name.upper()}: {status}")
        
        self.log(f"\nOVERALL: {passed}/{total} tests passed")
        
        if passed == total:
            self.log("🎉 ALL TESTS PASSED!")
        else:
            self.log("⚠️  SOME TESTS FAILED - Check logs above for details")
        
        return test_results

if __name__ == "__main__":
    tester = TodoAPITester()
    results = tester.run_all_tests()