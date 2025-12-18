import base64
import json

import django.shortcuts
import django.views.generic
import users.forms
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.urls import reverse_lazy
from django.views.decorators.csrf import csrf_exempt


class SignupView(django.views.generic.FormView):
    template_name = "users/signup.html"
    form_class = users.forms.SignupForm
    success_url = reverse_lazy("users:login")

    def get(self, request, *args, **kwargs):
        return django.shortcuts.render(
            request,
            self.template_name,
            {"signup_form": self.form_class()},
        )

    def post(self, request, *args, **kwargs):
        signup_form = self.form_class(request.POST)
        if signup_form.is_valid():
            signup_form.save()
            return self.form_valid(signup_form)

        return self.form_invalid(signup_form)

    def form_invalid(self, form):
        return django.shortcuts.render(
            self.request,
            self.template_name,
            {"signup_form": form},
        )


@login_required
@csrf_exempt
def save_public_key(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            public_key_b64 = data["public_key"]
            public_key_bytes = base64.b64decode(public_key_b64)
            request.user.public_key = public_key_bytes
            request.user.save()
            return JsonResponse({"success": True})
        except (KeyError, ValueError):
            return JsonResponse({"error": "Некорректные данные"}, status=400)
    return JsonResponse({"status": "error"}, status=400)


@login_required
def get_public_key(request, username):
    user = django.shortcuts.get_object_or_404(users.models.User, username=username)
    if not user.public_key:
        return JsonResponse({"error": "Public key not set"}, status=404)

    public_key_b64 = base64.b64encode(bytes(user.public_key)).decode("ascii")
    public_key_b64 = public_key_b64.replace("\n", "")
    return JsonResponse({"public_key": public_key_b64})
