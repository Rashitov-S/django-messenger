from django.urls import re_path
import chat.consumers

websocket_urlpatterns = [
    re_path(r'ws/user/$', chat.consumers.UserConsumer.as_asgi()),
]