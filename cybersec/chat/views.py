from django.views import generic
from django.contrib.auth.mixins import LoginRequiredMixin


class ChatPageView(LoginRequiredMixin, generic.TemplateView):
    template_name = "chat/chat_page.html"



