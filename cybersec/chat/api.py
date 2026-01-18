import base64

from django.db.models import Max, F
from ninja import Router
import crypto.models
import chat.schemas
import chat.models
import users.schemas
from typing import List

from ninja.errors import HttpError

router = Router()


@router.get("/chats", response=List[chat.schemas.ChatPreviewSchema])
def get_user_chats(request):
    user = request.user
    chatlist = []

    user_chats = (
        user.chats.annotate(
            last_message_time=Max("messages__created_at")
        )
        .order_by(F("last_message_time").desc(nulls_last=True))
    )

    for user_chat in user_chats:
        members = [{"id": m.id, "username": m.username} for m in user_chat.members.all()]
        last_meta = user_chat.messages.order_by("-created_at").first()

        if last_meta:
            last_message = {
                "id": last_meta.id,
                "sender": users.schemas.UserSchema.from_orm(last_meta.sender),
                "ciphertext": base64.b64encode(last_meta.signal_message.ciphertext).decode(),
                "created_at": last_meta.created_at.isoformat(),
                "delivery_status": last_meta.delivery_status(user.id),
                "is_read": last_meta.is_read,
                "signal_type": last_meta.signal_message.signal_type,
            }
        else:
            last_message = None

        chatlist.append(
            chat.schemas.ChatPreviewSchema(
                id=user_chat.id,
                type=user_chat.type,
                name=user_chat.name,
                members=members,
                last_message=last_message,
                unread_count=user_chat.messages.filter(is_read=False).exclude(sender=user).count(),
            )
        )

    return chatlist


@router.get("/chats/{chat_id}/messages", response=chat.schemas.ChatMessagesSchema)
def get_chat_messages(request, chat_id: int):
    user = request.user
    chat_obj = chat.models.Chat.objects.filter(id=chat_id, members=user).first()
    if not chat_obj:
        raise HttpError(404, "Chat not found")

    messages = chat.models.ChatMessageMeta.objects.filter(chat_id=chat_id).select_related("sender",
                                                                                          "signal_message").order_by(
        "created_at")

    serialized_messages = [
        chat.schemas.MessageSchema(
            id=message.id,
            sender=users.schemas.UserSchema(id=message.sender.id, username=message.sender.username),
            ciphertext=base64.b64encode(message.signal_message.ciphertext).decode(),
            created_at=message.created_at.isoformat(),
            delivery_status=message.delivery_status(user.id),
            is_read=message.is_read,
            signal_type=message.signal_message.signal_type,
        )

        for message in messages
    ]

    members = [{"id": m.id, "username": m.username} for m in chat_obj.members.all()]

    return chat.schemas.ChatMessagesSchema(
        chat_id=chat_obj.id,
        type=chat_obj.type,
        name=chat_obj.name,
        members=members,
        messages=serialized_messages,
    )
