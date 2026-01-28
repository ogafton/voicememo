from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime
from bson import ObjectId


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class TodoItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    text: str
    priority: str = "normal"  # urgent, normal, low
    completed: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class TodoCreate(BaseModel):
    text: str
    priority: str = "normal"

class TodoUpdate(BaseModel):
    text: Optional[str] = None
    priority: Optional[str] = None
    completed: Optional[bool] = None

class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Todo API is running"}

# Todo CRUD endpoints
@api_router.post("/todos", response_model=TodoItem)
async def create_todo(todo: TodoCreate):
    todo_dict = todo.dict()
    todo_obj = TodoItem(**todo_dict)
    await db.todos.insert_one(todo_obj.dict())
    return todo_obj

@api_router.get("/todos", response_model=List[TodoItem])
async def get_todos():
    todos = await db.todos.find().sort("created_at", -1).to_list(1000)
    return [TodoItem(**todo) for todo in todos]

@api_router.put("/todos/{todo_id}", response_model=TodoItem)
async def update_todo(todo_id: str, todo_update: TodoUpdate):
    update_data = {k: v for k, v in todo_update.dict().items() if v is not None}
    if update_data:
        update_data["updated_at"] = datetime.utcnow()
        result = await db.todos.update_one(
            {"id": todo_id},
            {"$set": update_data}
        )
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Todo not found")
    
    todo = await db.todos.find_one({"id": todo_id})
    if not todo:
        raise HTTPException(status_code=404, detail="Todo not found")
    return TodoItem(**todo)

@api_router.delete("/todos/{todo_id}")
async def delete_todo(todo_id: str):
    result = await db.todos.delete_one({"id": todo_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Todo not found")
    return {"message": "Todo deleted successfully"}

@api_router.put("/todos/{todo_id}/toggle")
async def toggle_todo(todo_id: str):
    todo = await db.todos.find_one({"id": todo_id})
    if not todo:
        raise HTTPException(status_code=404, detail="Todo not found")
    
    new_completed = not todo.get("completed", False)
    await db.todos.update_one(
        {"id": todo_id},
        {"$set": {"completed": new_completed, "updated_at": datetime.utcnow()}}
    )
    
    updated_todo = await db.todos.find_one({"id": todo_id})
    return TodoItem(**updated_todo)

# Status check endpoints (keeping original)
@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.dict()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.dict())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
