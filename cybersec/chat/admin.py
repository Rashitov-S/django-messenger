from django.contrib import admin
import chat.models

admin.site.register(chat.models.Chat)
admin.site.register(chat.models.Message)
