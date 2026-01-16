from django.contrib.auth import views
from django.urls import path

import users.views

app_name = "users"

urlpatterns = [
    path("signup/", users.views.SignupView.as_view(), name="signup"),
    path(
        "login/",
        views.LoginView.as_view(
            template_name="users/login.html",
            form_class=users.forms.CustomLoginForm,
        ),
        name="login",
    ),
    path(
        "logout/",
        views.LogoutView.as_view(
            template_name="users/logout.html",
        ),
        name="logout",
    ),

]
