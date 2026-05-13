"""
Item Service
Business logic for item operations.

⚠️  IMPORTANT — IN-MEMORY ONLY (DEMO):
    This service stores items in a Python ``list`` that lives inside the
    FastAPI process. It does NOT touch NeonDB, /api/items will keep
    answering 200 even if the database is completely unreachable.

    Therefore: ``GET /api/items`` returning 200 is NEVER a proof that
    the project's database works. Use ``GET /api/health`` (which now
    runs an actual ``SELECT 1``) or hit any auth endpoint instead.

    If you replace this with a DB-backed service, also update
    ``services/auth_service.py`` callers if needed and remove this
    notice.
"""
from typing import List, Optional
from datetime import datetime
from models.item import Item, ItemCreate, ItemUpdate


class ItemService:
    """Service for managing items.

    ⚠️  In-memory only — see module docstring above.
    """

    def __init__(self):
        """Initialize with in-memory storage."""
        self.items: List[Item] = []
        self.next_id: int = 1
        self._initialize_sample_data()

    def _initialize_sample_data(self):
        """Load sample data"""
        sample_items = [
            ItemCreate(
                title="Welcome to Fullstack App",
                description="This is a sample todo item from your FastAPI backend",
                completed=False
            ),
            ItemCreate(
                title="Backend: Python + FastAPI",
                description="Production-ready backend with modular structure",
                completed=True
            ),
            ItemCreate(
                title="Frontend: React + TypeScript",
                description="Modern frontend with Vite and Tailwind CSS",
                completed=True
            ),
        ]

        for item_data in sample_items:
            self.create_item(item_data)

    def get_all_items(self) -> List[Item]:
        """Get all items"""
        return self.items

    def get_item_by_id(self, item_id: int) -> Optional[Item]:
        """Get item by ID"""
        for item in self.items:
            if item.id == item_id:
                return item
        return None

    def create_item(self, item_data: ItemCreate) -> Item:
        """Create a new item"""
        now = datetime.now()
        new_item = Item(
            id=self.next_id,
            title=item_data.title,
            description=item_data.description,
            completed=item_data.completed,
            created_at=now,
            updated_at=now
        )

        self.items.append(new_item)
        self.next_id += 1

        return new_item

    def update_item(self, item_id: int, item_data: ItemUpdate) -> Optional[Item]:
        """Update an existing item"""
        item = self.get_item_by_id(item_id)
        if not item:
            return None

        # Update only provided fields
        update_data = item_data.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            setattr(item, field, value)

        item.updated_at = datetime.now()

        return item

    def delete_item(self, item_id: int) -> bool:
        """Delete an item"""
        for i, item in enumerate(self.items):
            if item.id == item_id:
                self.items.pop(i)
                return True
        return False

    def get_stats(self) -> dict:
        """Get statistics"""
        total = len(self.items)
        completed = sum(1 for item in self.items if item.completed)
        pending = total - completed

        return {
            "total": total,
            "completed": completed,
            "pending": pending,
            "completion_rate": round((completed / total * 100) if total > 0 else 0, 2)
        }


# Global service instance
item_service = ItemService()
