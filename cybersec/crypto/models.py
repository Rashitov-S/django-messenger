import django.db.models
import users.models


class SignalIdentity(django.db.models.Model):
    user = django.db.models.OneToOneField(
        users.models.User,
        on_delete=django.db.models.CASCADE,
        related_name="signal_identity"
    )
    public_key = django.db.models.BinaryField()
    registration_id = django.db.models.IntegerField()
    created_at = django.db.models.DateTimeField(auto_now_add=True)
    is_trusted = django.db.models.BooleanField(default=True)

    def __str__(self):
        return f"SignalIdentity(user={self.user.id})"


class SignalSignedPreKey(django.db.models.Model):
    user = django.db.models.ForeignKey(
        users.models.User,
        on_delete=django.db.models.CASCADE,
        related_name="signal_signed_prekeys"
    )
    key_id = django.db.models.PositiveIntegerField()
    public_key = django.db.models.BinaryField()
    signature = django.db.models.BinaryField()
    created_at = django.db.models.DateTimeField(auto_now_add=True)
    is_active = django.db.models.BooleanField(default=True)

    class Meta:
        unique_together = ("user", "key_id")


class SignalOneTimePreKey(django.db.models.Model):
    user = django.db.models.ForeignKey(
        users.models.User,
        on_delete=django.db.models.CASCADE,
        related_name="signal_one_time_prekeys"
    )
    key_id = django.db.models.PositiveIntegerField()
    public_key = django.db.models.BinaryField()
    is_used = django.db.models.BooleanField(default=False)
    created_at = django.db.models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "key_id")


class SignalPreKeyRequest(django.db.models.Model):
    sender = django.db.models.ForeignKey(users.models.User, on_delete=django.db.models.CASCADE,
                                         related_name="prekey_requests_sent")
    receiver = django.db.models.ForeignKey(users.models.User, on_delete=django.db.models.CASCADE,
                                           related_name="prekey_requests_received")
    created_at = django.db.models.DateTimeField(auto_now_add=True)

    # class Meta:
    #     unique_together = ("sender", "receiver")


class SignalMessage(django.db.models.Model):
    ciphertext = django.db.models.BinaryField()
    created_at = django.db.models.DateTimeField(auto_now_add=True)
    signal_type = django.db.models.PositiveSmallIntegerField()
