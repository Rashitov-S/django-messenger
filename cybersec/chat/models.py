import django.db.models
import users.models
import crypto.models
from django.core.exceptions import ValidationError


class Chat(django.db.models.Model):
    CHAT_TYPE_CHOICES = [
        ("private", "Private"),
        ("group", "Group"),
    ]
    type = django.db.models.CharField(max_length=10, choices=CHAT_TYPE_CHOICES)
    name = django.db.models.CharField(max_length=100, blank=True, null=True)
    members = django.db.models.ManyToManyField(users.models.User, through="ChatMember", related_name="chats")
    created_at = django.db.models.DateTimeField(auto_now_add=True)

    def clean(self):
        if self.type == "group" and (not self.name or self.name.strip() == ""):
            raise ValidationError("Group chat must have a name")

    @classmethod
    def create_private(cls, user1, user2):
        existing = cls.objects.filter(type="private", members=user1).filter(members=user2)
        if existing.exists():
            return existing.first()

        chat = cls(type="private")
        chat.save()
        ChatMember.objects.bulk_create([
            ChatMember(chat=chat, user=user1),
            ChatMember(chat=chat, user=user2)
        ])
        return chat

    def __str__(self):
        return f"Chat({self.id}, type={self.type})"

class ChatMember(django.db.models.Model):
    chat = django.db.models.ForeignKey(Chat, on_delete=django.db.models.CASCADE, related_name="chat_memberships")
    user = django.db.models.ForeignKey(users.models.User, on_delete=django.db.models.CASCADE)
    joined_at = django.db.models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("chat", "user")

    def __str__(self):
        return f"ChatMember(chat={self.chat.id}, user={self.user.id})"


class ChatMessageMeta(django.db.models.Model):
    chat = django.db.models.ForeignKey(
        Chat,
        on_delete=django.db.models.CASCADE,
        related_name="messages"
    )
    sender = django.db.models.ForeignKey(
        users.models.User,
        on_delete=django.db.models.CASCADE
    )

    signal_message = django.db.models.OneToOneField(
        crypto.models.SignalMessage,
        on_delete=django.db.models.CASCADE,
        related_name="chat_meta"
    )

    created_at = django.db.models.DateTimeField(auto_now_add=True)
    is_read = django.db.models.BooleanField(default=False)
    is_deleted = django.db.models.BooleanField(default=False)


    def delivery_status(self, user_id):
        if user_id == self.sender.id:
            return "read" if self.is_read else "delivered"
        return None


    def __str__(self):
        return f"ChatMessageMeta(dialog={self.chat.id})"