from django.urls import path
import chat.views

app_name = "chats"

urlpatterns = [
    path("", chat.views.ChatPageView.as_view(), name="chat-page"),
    path("<int:chat_id>/", chat.views.ChatPageView.as_view(), name="chat"),
    path("<int:chat_id>/messages/", chat.views.chat_messages, name="chat-messages"),
    path("<int:chat_id>/save_chat_key/", chat.views.save_chat_key, name="save-chat-key"),
    path("<int:chat_id>/aes_key/", chat.views.get_chat_aes_key, name="chat-aes-key"),

    path("with/<str:username>/", chat.views.chat_with_user, name="chat-with-user"),
    path("search/", chat.views.chat_search, name="search"),
]
