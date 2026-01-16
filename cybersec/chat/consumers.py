import base64
import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
import chat.models
import users.models
import crypto.models
from django.db import transaction


# class ChatConsumer(AsyncWebsocketConsumer):
#     async def connect(self):
#         self.chat_id = self.scope["url_route"]["kwargs"]["chat_id"]
#         self.user = self.scope["user"]
#         self.room_group_name = f"chat_{self.chat_id}"
#
#         if not self.scope["user"].is_authenticated:
#             await self.close()
#             return
#
#         is_member = await self.check_membership()
#         if not is_member:
#             await self.close()
#             return
#
#         await self.channel_layer.group_add(
#             self.room_group_name,
#             self.channel_name
#         )
#
#         await self.accept()
#
#     async def disconnect(self, close_code):
#         await self.channel_layer.group_discard(
#             self.room_group_name,
#             self.channel_name
#         )
#
#     async def receive(self, text_data=None, bytes_data=None):
#         print(text_data)
#         data = json.loads(text_data)
#         message = data.get("message", "").strip()
#
#         if not message:
#             return
#
#         saved_message = await self.save_message(message)
#
#         await self.channel_layer.group_send(
#             self.room_group_name,
#             {
#                 "type": "chat_message",
#                 "message": {
#                     "chat_id": self.chat_id,
#                     "sender": {
#                         "id": self.user.id,
#                         "username": self.user.username,
#                     },
#                     "ciphertext": saved_message["ciphertext"],
#                     "created_at": saved_message["created_at"],
#
#                 }
#             }
#         )
#
#     async def chat_message(self, event):
#         await self.send(text_data=json.dumps({
#             "message": event["message"],
#         }))
#
#     @database_sync_to_async
#     def check_membership(self):
#         return chat.models.Chat.objects.filter(id=self.chat_id, members=self.user).exists()
#
#     @database_sync_to_async
#     def save_message(self, text):
#         current_chat = chat.models.Chat.objects.get(id=self.chat_id)
#
#         signal_msg = crypto.models.SignalMessage.objects.create(
#             ciphertext=text
#         )
#
#         meta = chat.models.ChatMessageMeta.objects.create(
#             chat=current_chat,
#             sender=self.user,
#             signal_message=signal_msg,
#             is_read=False,
#             is_deleted=False,
#         )
#
#         return {
#             "id": meta.id,
#             "sender": {
#                 "id": self.user.id,
#                 "username": self.user.username,
#             },
#             "ciphertext": text,
#             "created_at": meta.created_at.isoformat(),
#         }


class UserConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope["user"]
        if not self.user.is_authenticated:
            await self.close()
            return

        self.user_group = f"user_{self.user.id}"

        await self.channel_layer.group_add(
            self.user_group,
            self.channel_name
        )

        await self.accept()
        print(f"User {self.user.username} connected to UserConsumer")

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.user_group,
            self.channel_name
        )
        print(f"User {self.user.username} disconnected from UserConsumer")

    async def receive(self, text_data=None, bytes_data=None):
        print("вебсокет ивент")
        print(text_data)
        if not text_data:
            return

        data = json.loads(text_data)
        event_type = data.get("type")

        if event_type == "send_message":
            chat_id = data.get("chat_id")
            content = data.get("ciphertext", "").strip()
            client_id = data.get("client_id")
            signal_type = data.get("signal_type")
            recipient_username = data.get("recipient_username")

            if not content:
                return

            if not chat_id:
                if not recipient_username:
                    return

                current_chat = await self.get_or_create_private_chat(recipient_username)
                if not current_chat:
                    return

                chat_id = current_chat.id
                await self.broadcast_new_chat(current_chat)

            saved_message = await self.save_message(chat_id, content, signal_type, client_id)

            await self.broadcast_new_message(chat_id, saved_message)

        elif event_type == "read_message":
            chat_id = data.get("chat_id")
            last_message_id = data.get("last_message_id")
            if chat_id and last_message_id:
                await self.mark_messages_read(chat_id, last_message_id)
                await self.broadcast_read_receipt(chat_id, last_message_id)


        # elif event_type == "typing":
        #     chat_id = data.get("chat_id")
        #     is_typing = data.get("is_typing", False)
        #     if chat_id is not None:
        #         await self.broadcast_typing(chat_id, is_typing)

        else:
            print("Unknown event type:", event_type)

    @database_sync_to_async
    def get_or_create_private_chat(self, recipient_username):
        try:
            recipient = users.models.User.objects.get(username=recipient_username)
        except users.models.User.DoesNotExist:
            return None

        chat_qs = chat.models.Chat.objects.filter(
            type="private",
            members=self.user
        ).filter(members=recipient).distinct()

        if chat_qs.exists():
            return chat_qs.first()

        with transaction.atomic():
            current_chat = chat.models.Chat.objects.create(type="private")
            current_chat.members.add(self.user, recipient)

        return current_chat

    @database_sync_to_async
    def save_message(self, chat_id, text, signal_type, client_id):
        current_chat = chat.models.Chat.objects.get(id=chat_id)

        signal_msg = crypto.models.SignalMessage.objects.create(
            ciphertext=base64.b64decode(text),
            signal_type=signal_type,
        )

        meta = chat.models.ChatMessageMeta.objects.create(
            chat=current_chat,
            sender=self.user,
            signal_message=signal_msg,
            is_read=False,
            is_deleted=False,
        )

        return {
            "id": meta.id,
            "sender": {
                "id": self.user.id,
                "username": self.user.username,
            },
            "ciphertext": text,
            "created_at": meta.created_at.isoformat(),
            "delivery_status": "delivered",
            "client_id": client_id,
            "signal_type": signal_type,
        }

    async def broadcast_new_message(self, chat_id, message):
        participants = await database_sync_to_async(
            lambda: list(
                chat.models.Chat.objects.get(id=chat_id)
                .members.values_list("id", flat=True)
            )
        )()

        for user_id in participants:
            await self.channel_layer.group_send(
                f"user_{user_id}",
                {
                    "type": "new_message",
                    "chat_id": chat_id,
                    "message": message,
                }
            )

    @database_sync_to_async
    def mark_messages_read(self, chat_id, last_message_id):
        try:
            last_message = chat.models.ChatMessageMeta.objects.get(
                id=last_message_id,
                chat_id=chat_id
            )
        except chat.models.ChatMessageMeta.DoesNotExist:
            return

        sender = last_message.sender

        chat.models.ChatMessageMeta.objects.filter(
            chat_id=chat_id,
            sender=sender,
            is_read=False,
            id__lte=last_message_id
        ).exclude(sender=self.user).update(is_read=True)

    async def broadcast_read_receipt(self, chat_id, last_message_id):
        last_message = await database_sync_to_async(
            lambda: chat.models.ChatMessageMeta.objects.select_related("sender").get(
                id=last_message_id,
                chat_id=chat_id
            )
        )()

        sender = last_message.sender

        if sender.id == self.user.id:
            return

        await self.channel_layer.group_send(
            f"user_{sender.id}",
            {
                "type": "read_receipt",
                "chat_id": chat_id,
                "last_message_id": last_message_id,
                "reader": {
                    "id": self.user.id,
                    "username": self.user.username,
                }
            }
        )

    async def broadcast_new_chat(self, chat):
        participants = await self.get_chat_member_ids(chat)
        members_data = await self.get_chat_members_data(chat)

        chat_data = {
            "id": chat.id,
            "name": chat.name,
            "type": chat.type,
            "members": members_data,
            "last_message": None,
            "last_message_at": None,
            "unread_count": 0,
            "delivery_status": None,
        }

        for user_id in participants:
            await self.channel_layer.group_send(
                f"user_{user_id}",
                {
                    "type": "new_chat",
                    "chat": chat_data,
                }
            )

    @database_sync_to_async
    def get_chat_member_ids(self, chat):
        return list(chat.members.values_list("id", flat=True))

    @database_sync_to_async
    def get_chat_members_data(self, chat):
        return list(
            chat.members.values("id", "username")
        )

    async def new_chat(self, event):
        await self.send(text_data=json.dumps(event))

    async def read_receipt(self, event):
        print(event)
        await self.send(text_data=json.dumps(event))

    async def new_message(self, event):
        await self.send(text_data=json.dumps(event))
