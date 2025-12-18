import django.db.models
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.utils.translation import gettext as _


class UserManager(BaseUserManager):
    def create_user(self, username, password=None, public_key=None):
        if not username:
            raise ValueError("Username is required")

        user = self.model(
            username=username,
            public_key=public_key,
        )

        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, username, password):
        user = self.model(
            username=username,
            is_staff=True,
            is_superuser=True,
        )
        user.set_password(password)
        user.save(using=self._db)
        return user


class User(
    django.contrib.auth.models.AbstractBaseUser,
    django.contrib.auth.models.PermissionsMixin,
):
    public_key = django.db.models.BinaryField(null=True, blank=True)

    username = django.db.models.CharField(
        max_length=32,
        unique=True,
        verbose_name="логин",
    )

    is_staff = django.db.models.BooleanField(
        _("staff status"),
        default=False,
        help_text=_("Designates whether the user can log into this admin site."),
    )
    is_active = django.db.models.BooleanField(
        _("active"),
        default=True,
        help_text=_(
            "Designates whether this user should be treated as active. "
            "Unselect this instead of deleting accounts."
        ),
    )

    USERNAME_FIELD = "username"
    objects = UserManager()

    class Meta:
        verbose_name = "Пользователь"
        verbose_name_plural = "Пользователи"

    def __str__(self):
        return self.username
