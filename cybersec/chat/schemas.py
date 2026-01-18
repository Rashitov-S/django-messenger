from ninja import Schema
from typing import List, Optional
import users.schemas


class MessageSchema(Schema):
    id: int
    sender: users.schemas.UserSchema
    ciphertext: str
    created_at: str
    delivery_status: Optional[str]
    is_read: bool
    signal_type: int


class ChatPreviewSchema(Schema):
    id: int
    type: str
    name: Optional[str]
    members: List[users.schemas.UserSchema]
    last_message: Optional[MessageSchema]
    unread_count: int


class ChatMessagesSchema(Schema):
    chat_id: int
    type: str
    name: Optional[str]
    members: List[users.schemas.UserSchema]
    messages: List[MessageSchema]
