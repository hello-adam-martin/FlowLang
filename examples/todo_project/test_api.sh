#!/bin/bash
# Test TodoManager API endpoints

BASE_URL="http://localhost:8000"

echo "=========================================="
echo "Testing TodoManager API"
echo "=========================================="

echo ""
echo "1. Testing Health Check..."
curl -s "$BASE_URL/health" | python3 -m json.tool

echo ""
echo ""
echo "2. Testing List Flows..."
curl -s "$BASE_URL/flows" | python3 -m json.tool

echo ""
echo ""
echo "3. Testing Get Flow Info..."
curl -s "$BASE_URL/flows/TodoManager" | python3 -m json.tool

echo ""
echo ""
echo "4. Testing Execute Flow (list action)..."
curl -s -X POST "$BASE_URL/flows/TodoManager/execute" \
  -H "Content-Type: application/json" \
  -d '{"inputs": {"user_id": "user_123", "action": "list"}}' \
  | python3 -m json.tool

echo ""
echo ""
echo "5. Testing List Tasks..."
curl -s "$BASE_URL/flows/TodoManager/tasks" | python3 -m json.tool

echo ""
echo ""
echo "=========================================="
echo "API Tests Complete"
echo "=========================================="
