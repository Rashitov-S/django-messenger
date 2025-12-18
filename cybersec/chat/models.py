import django.db.models
import users.models
from django.core.exceptions import ValidationError


class Chat(django.db.models.Model):
    members = django.db.models.ManyToManyField(users.models.User)
    created_at = django.db.models.DateTimeField(auto_now_add=True)
    last_message = django.db.models.ForeignKey(
        "Message",
        null=True,
        blank=True,
        on_delete=django.db.models.SET_NULL,
        related_name="+"
    )

    def get_title(self, current_user):
        others = self.members.exclude(id=current_user.id)
        if others.exists():
            return ", ".join(user.username for user in others)
        return "Чат"

    class Meta:
        verbose_name = "чаты"
        verbose_name_plural = "чаты"


class Message(django.db.models.Model):
    chat = django.db.models.ForeignKey(Chat, on_delete=django.db.models.CASCADE, related_name="messages")
    from_user = django.db.models.ForeignKey(users.models.User, on_delete=django.db.models.CASCADE)

    content = django.db.models.BinaryField()
    created_at = django.db.models.DateTimeField(auto_now_add=True)

    def clean(self):
        if self.content and len(self.content) > 8192:
            raise ValidationError("Сообщение слишком длинное (максимум 8192 байт)")

    class Meta:
        verbose_name = "сообщение"
        verbose_name_plural = "сообщения"

    def __str__(self):
        return f"{self.from_user.username} --> {self.chat.get_title}: {self.content}"


class ChatKey(django.db.models.Model):
    chat = django.db.models.ForeignKey(Chat, on_delete=django.db.models.CASCADE, related_name="keys")
    user = django.db.models.ForeignKey(users.models.User, on_delete=django.db.models.CASCADE)
    encrypted_key = django.db.models.BinaryField()

    class Meta:
        unique_together = ("chat", "user")
        verbose_name = "ключ чата"
        verbose_name_plural = "ключи чатов"