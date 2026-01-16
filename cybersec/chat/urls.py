from django.urls import path
import chat.views
app_name = "chats"

urlpatterns = [
    path("", chat.views.ChatPageView.as_view(), name="chat-page"),
]
