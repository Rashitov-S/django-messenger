import django.shortcuts
import django.views.generic
import users.forms
from django.urls import reverse_lazy


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