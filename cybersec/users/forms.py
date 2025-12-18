import re

import django.views.generic
import users.forms
import django.shortcuts
from core.mixins import BootstrapFormMixin
import django.contrib.auth.forms
import django.forms


class SignupForm(
    BootstrapFormMixin,
    django.contrib.auth.forms.UserCreationForm,
):
    password1 = django.forms.CharField(
        label="Пароль",
        strip=False,
        widget=django.forms.PasswordInput(
            attrs={"autocomplete": "new-password"},
        ),
    )

    password2 = django.forms.CharField(
        label="Подтверждение пароля",
        strip=False,
        widget=django.forms.PasswordInput(
            attrs={"autocomplete": "new-password"},
        ),
    )

    class Meta(django.contrib.auth.forms.UserCreationForm.Meta):
        model = users.models.User
        fields = (
            "username",
            "password1",
            "password2",
        )
        labels = {
            "username": "Логин",
        }
        help_texts = {
            "username": "",
        }

    def clean_username(self):
        username = super().clean_username()

        if not re.match(r"^[a-zA-Z0-9_]+$", username):
            raise django.forms.ValidationError(
                (
                    "Имя пользователя может содержать только латинские "
                    "буквы, цифры и символ подчёркивания",
                ),
            )

        return username


class CustomLoginForm(
    BootstrapFormMixin,
    django.contrib.auth.forms.AuthenticationForm,
):
    pass
