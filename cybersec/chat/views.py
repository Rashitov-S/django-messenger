import base64
import json

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views import generic
from django.contrib.auth.mixins import LoginRequiredMixin
import django.shortcuts as shortcuts
from django.contrib import messages

import chat.models
import users.models
from django.views.decorators.csrf import csrf_exempt


class ChatPageView(LoginRequiredMixin, generic.View):
    template_name = "chat/chat_page.html"

    def get(self, request, chat_id=None):
        chats = chat.models.Chat.objects.filter(members=request.user).order_by("-last_message")

        for _chat in chats:
            _chat.title = _chat.get_title(request.user)
            if _chat.last_message and _chat.last_message.content:
                _chat.last_message_b64 = base64.b64encode(_chat.last_message.content).decode("utf-8")
            else:
                _chat.last_message_b64 = ""
        selected_chat = None

        if chat_id:
            selected_chat = chat.models.Chat.objects.filter(
                id=chat_id,
                members=request.user
            ).first()

            if selected_chat:
                selected_chat.title = selected_chat.get_title(request.user)

        return shortcuts.render(request, self.template_name, {
            "chats": chats,
            "selected_chat": selected_chat,
        })


@login_required
def chat_with_user(request, username):
    try:
        other = users.models.User.objects.exclude(
            id=request.user.id
        ).get(username=username)
    except users.models.User.DoesNotExist:
        messages.error(request, "Пользователь не найден или вы пытаетесь написать себе")
        return shortcuts.redirect("chats:chat-page")

    if request.method == "POST":
        try:
            data = json.loads(request.body)
            encrypted_keys = data["encrypted_keys"]
            if not encrypted_keys:
                raise KeyError()
        except (KeyError, json.JSONDecodeError):
            return JsonResponse({"success": False, "error": "Не удалось получить зашифрованный AES ключ"}, status=400)

        current_chat = chat.models.Chat.objects.filter(members=request.user).filter(members=other).first()
        if not current_chat:
            current_chat = chat.models.Chat.objects.create()
            current_chat.members.add(request.user, other)

        try:
            for user_id_str, key_b64 in encrypted_keys.items():
                print("user_id_str:", user_id_str, "key_b64:", key_b64)
                user_id = int(user_id_str)
                key_bytes = base64.b64decode(key_b64)
                chat.models.ChatKey.objects.get_or_create(chat=current_chat, user_id=user_id, defaults={"encrypted_key": key_bytes})
        except Exception as e:
            print("Ошибка при сохранении ключа:", e)
            current_chat.delete()
            return JsonResponse({"success": False, "error": "Не удалось сохранить ключи чата"}, status=500)

        return JsonResponse({"success": True, "chat_id": current_chat.id})

    context = {"other_user": other, "current_user": request.user}
    return shortcuts.render(request, "chat/chat_with_user.html", context)


@login_required
def chat_search(request):
    query = request.GET.get("q", "").strip()

    if not query:
        return shortcuts.redirect("chats:chat-page")

    return shortcuts.redirect("chats:chat-with-user", username=query)


@login_required
def chat_messages(request, chat_id):
    current_chat = shortcuts.get_object_or_404(chat.models.Chat, id=chat_id, members=request.user)

    qs = chat.models.Message.objects.filter(
        chat=current_chat,
    ).order_by("-created_at").select_related("from_user")

    messages = [
        {
            "id": m.id,
            "content": base64.b64encode(m.content).decode(),
            "from_user": m.from_user.id,
            "from_user_username": m.from_user.username,
            "created_at": m.created_at.isoformat(),
        }
        for m in reversed(qs)
    ]

    return JsonResponse({"messages": messages})


@login_required
@csrf_exempt
def save_chat_key(request, chat_id):
    if request.method != "POST":
        return JsonResponse({"status": "error", "detail": "Only POST allowed"}, status=405)

    current_chat = shortcuts.get_object_or_404(chat.models.Chat, id=chat_id, members=request.user)

    try:
        data = json.loads(request.body)
        encrypted_key_b64 = data["encrypted_key"]
        import base64
        encrypted_key = base64.b64decode(encrypted_key_b64)
    except (KeyError, json.JSONDecodeError, base64.binascii.Error):
        return JsonResponse({"status": "error", "detail": "Invalid data"}, status=400)

    chat.models.ChatKey.objects.update_or_create(
        chat=current_chat,
        user=request.user,
        defaults={"encrypted_key": encrypted_key}
    )

    return JsonResponse({"status": "ok"})


@login_required
def get_chat_aes_key(request, chat_id):
    try:
        chat_key = chat.models.ChatKey.objects.get(chat_id=chat_id, user=request.user)
    except chat.models.ChatKey.DoesNotExist:
        return JsonResponse({"error": "Key not found"}, status=404)

    encrypted_b64 = base64.b64encode(chat_key.encrypted_key).decode("ascii")
    return JsonResponse({"encrypted_key": encrypted_b64})
