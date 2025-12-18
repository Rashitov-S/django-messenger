import django.urls
from django.contrib import admin

urlpatterns = [
    django.urls.path(
        "users/",
        django.urls.include("users.urls", namespace="users"),
    ),
    django.urls.path(
        "chat/",
        django.urls.include("chat.urls", namespace="chat"),
    ),

    django.urls.path("admin/", admin.site.urls),
]
