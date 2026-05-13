"""
Items Router
API endpoints for item management
"""
from fastapi import APIRouter, HTTPException, status
from typing import List

from models.item import Item, ItemCreate, ItemUpdate
from services.item_service import item_service

router = APIRouter(
    prefix="/items",
    tags=["items"]
)


@router.get("", response_model=List[Item], summary="Get all items")
async def get_items():
    """
    Retrieve all items.

    Returns a list of all items in the system.
    """
    return item_service.get_all_items()


@router.get("/{item_id}", response_model=Item, summary="Get item by ID")
async def get_item(item_id: int):
    """
    Retrieve a specific item by ID.

    - **item_id**: The ID of the item to retrieve
    """
    item = item_service.get_item_by_id(item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Item with ID {item_id} not found"
        )
    return item


@router.post("", response_model=Item, status_code=status.HTTP_201_CREATED, summary="Create new item")
async def create_item(item_data: ItemCreate):
    """
    Create a new item.

    - **title**: Item title (required, 1-200 characters)
    - **description**: Item description (optional, max 1000 characters)
    - **completed**: Completion status (default: false)
    """
    return item_service.create_item(item_data)


@router.put("/{item_id}", response_model=Item, summary="Update item")
async def update_item(item_id: int, item_data: ItemUpdate):
    """
    Update an existing item.

    - **item_id**: The ID of the item to update
    - **title**: New title (optional)
    - **description**: New description (optional)
    - **completed**: New completion status (optional)
    """
    item = item_service.update_item(item_id, item_data)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Item with ID {item_id} not found"
        )
    return item


@router.delete("/{item_id}", summary="Delete item")
async def delete_item(item_id: int):
    """
    Delete an item.

    - **item_id**: The ID of the item to delete
    """
    success = item_service.delete_item(item_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Item with ID {item_id} not found"
        )

    return {
        "message": "Item deleted successfully",
        "item_id": item_id
    }


@router.get("/stats/summary", summary="Get statistics")
async def get_stats():
    """
    Get item statistics.

    Returns total, completed, pending counts and completion rate.
    """
    return item_service.get_stats()
