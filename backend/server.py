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
class TodoList(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    is_default: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

class TodoListCreate(BaseModel):
    name: str
    is_default: bool = False

class TodoListUpdate(BaseModel):
    name: Optional[str] = None
    is_default: Optional[bool] = None

class TodoItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    list_id: str
    text: str
    priority: str = "normal"  # urgent, normal, low
    completed: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class TodoCreate(BaseModel):
    text: str
    priority: str = "normal"
    list_id: Optional[str] = None

class TodoUpdate(BaseModel):
    text: Optional[str] = None
    priority: Optional[str] = None
    completed: Optional[bool] = None


# Helper function to ensure default list exists
async def ensure_default_list():
    default_list = await db.lists.find_one({"is_default": True})
    if not default_list:
        # Create default list
        new_list = TodoList(name="Lista mea", is_default=True)
        await db.lists.insert_one(new_list.dict())
        return new_list
    return TodoList(**default_list)


# List CRUD endpoints
@api_router.get("/lists", response_model=List[TodoList])
async def get_lists():
    await ensure_default_list()
    lists = await db.lists.find().sort("created_at", 1).to_list(100)
    return [TodoList(**lst) for lst in lists]

@api_router.post("/lists", response_model=TodoList)
async def create_list(list_data: TodoListCreate):
    # If this is set as default, unset other defaults
    if list_data.is_default:
        await db.lists.update_many({}, {"$set": {"is_default": False}})
    
    new_list = TodoList(**list_data.dict())
    await db.lists.insert_one(new_list.dict())
    return new_list

@api_router.put("/lists/{list_id}", response_model=TodoList)
async def update_list(list_id: str, list_update: TodoListUpdate):
    update_data = {k: v for k, v in list_update.dict().items() if v is not None}
    
    # If setting as default, unset other defaults first
    if update_data.get("is_default"):
        await db.lists.update_many({}, {"$set": {"is_default": False}})
    
    if update_data:
        result = await db.lists.update_one(
            {"id": list_id},
            {"$set": update_data}
        )
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="List not found")
    
    lst = await db.lists.find_one({"id": list_id})
    if not lst:
        raise HTTPException(status_code=404, detail="List not found")
    return TodoList(**lst)

@api_router.delete("/lists/{list_id}")
async def delete_list(list_id: str):
    # Check if it's the only list
    count = await db.lists.count_documents({})
    if count <= 1:
        raise HTTPException(status_code=400, detail="Nu poți șterge ultima listă")
    
    # Check if it's default
    lst = await db.lists.find_one({"id": list_id})
    if lst and lst.get("is_default"):
        raise HTTPException(status_code=400, detail="Nu poți șterge lista default. Setează altă listă ca default mai întâi.")
    
    # Delete all todos in this list
    await db.todos.delete_many({"list_id": list_id})
    
    # Delete the list
    result = await db.lists.delete_one({"id": list_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="List not found")
    
    return {"message": "List deleted successfully"}

@api_router.delete("/lists/{list_id}/clear")
async def clear_list(list_id: str):
    """Clear all todos from a list"""
    result = await db.todos.delete_many({"list_id": list_id})
    return {"message": f"Cleared {result.deleted_count} todos from list"}


# Todo CRUD endpoints
@api_router.get("/")
async def root():
    return {"message": "Todo API is running"}

@api_router.post("/todos", response_model=TodoItem)
async def create_todo(todo: TodoCreate):
    # Get list_id - use provided or get default
    list_id = todo.list_id
    if not list_id:
        default_list = await ensure_default_list()
        list_id = default_list.id
    
    todo_dict = todo.dict()
    todo_dict["list_id"] = list_id
    todo_obj = TodoItem(**todo_dict)
    await db.todos.insert_one(todo_obj.dict())
    return todo_obj

@api_router.get("/todos", response_model=List[TodoItem])
async def get_todos(list_id: Optional[str] = None):
    query = {}
    if list_id:
        query["list_id"] = list_id
    todos = await db.todos.find(query).sort("created_at", -1).to_list(1000)
    result = []
    for todo in todos:
        # Handle old todos without list_id
        if "list_id" not in todo or not todo["list_id"]:
            # Assign to default list
            default_list = await db.lists.find_one({"is_default": True})
            if default_list:
                todo["list_id"] = default_list["id"]
            else:
                continue  # Skip if no default list
        result.append(TodoItem(**todo))
    return result

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
