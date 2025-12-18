import base64
import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
import chat.models


class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.chat_id = self.scope['url_route']['kwargs']['chat_id']
        self.room_group_name = f'chat_{self.chat_id}'

        if not self.scope['user'].is_authenticated:
            await self.close()
            return

        is_member = await database_sync_to_async(self.check_membership)()
        if not is_member:
            await self.close()
            return

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        data = json.loads(text_data)
        content = data.get('message', '')

        if not content:
            return

        saved_message = await database_sync_to_async(self.save_message)(content)

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "chat_message",
                "content":  saved_message.content,
                "from_user": self.scope["user"].id,
                "from_user_username": self.scope["user"].username,
                "created_at": saved_message.created_at.isoformat(),
                "chat_id": self.chat_id,
            }
        )

    async def chat_message(self, event):
        content_b64 = base64.b64encode(event["content"]).decode("utf-8")
        await self.send(text_data=json.dumps({
            "content": content_b64,
            "from_user": event["from_user"],
            "from_user_username": event["from_user_username"],
            "created_at": event["created_at"],
            "chat_id": event["chat_id"],
        }))

    def check_membership(self):
        try:
            current_chat = chat.models.Chat.objects.get(id=self.chat_id)
            return self.scope["user"] in current_chat.members.all()
        except chat.models.Chat.DoesNotExist:
            return False

    def save_message(self, content):
        current_chat = chat.models.Chat.objects.get(id=self.chat_id)
        encrypted_bytes = base64.b64decode(content)
        saved_message = chat.models.Message.objects.create(chat=current_chat, from_user=self.scope["user"], content=encrypted_bytes)
        current_chat.last_message = saved_message
        current_chat.save(update_fields=["last_message"])
        return saved_message
