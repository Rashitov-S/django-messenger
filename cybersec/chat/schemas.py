from ninja import Schema
from typing import List, Optional
import users.schemas


class ChatPreviewSchema(Schema):
    id: int
    type: str
    name: Optional[str]
    members: List[users.schemas.UserSchema]
    last_message: Optional[str]
    last_message_at: Optional[str]
    last_message_sender: Optional[str]
    last_message_id: Optional[int]
    delivery_status: Optional[str]
    unread_count: int


class MessageSchema(Schema):
    id: int
    sender: users.schemas.UserSchema
    ciphertext: str
    created_at: str
    delivery_status: Optional[str]
    is_read: bool


class ChatMessagesSchema(Schema):
    chat_id: int
    type: str
    name: Optional[str]
    members: List[users.schemas.UserSchema]
    messages: List[MessageSchema]
