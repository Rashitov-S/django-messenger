import base64
import binascii

from django.db import transaction
from ninja import Router
from django.contrib.auth.decorators import login_required
import crypto.schemas
import crypto.models
import users.models
from ninja.errors import HttpError

router = Router()

MAX_PREKEYS = 100


@router.post("/keys")
def set_user_keys(request, payload: crypto.schemas.KeyUploadSchema):
    user = request.user

    with transaction.atomic():
        # --- Identity Key ---
        try:
            identity_bytes = base64.b64decode(payload.identity_key)
        except (binascii.Error, ValueError):
            raise HttpError(400, "Invalid Base64 for identity key")
        crypto.models.SignalIdentity.objects.update_or_create(
            user=user,
            defaults={"public_key": identity_bytes,
                      "registration_id": payload.registration_id,
                      "is_trusted": True},
        )

        # --- Signed PreKey ---
        try:
            signed_bytes = base64.b64decode(payload.signed_prekey.public_key)
            signature_bytes = base64.b64decode(payload.signed_prekey.signature)
        except (binascii.Error, ValueError):
            raise HttpError(400, "Invalid Base64 for signed prekey or signature")

        crypto.models.SignalSignedPreKey.objects.update_or_create(
            user=user,
            key_id=payload.signed_prekey.key_id,
            defaults={
                "public_key": signed_bytes,
                "signature": signature_bytes,
                "is_active": True,
            },
        )
        crypto.models.SignalSignedPreKey.objects.filter(user=user).exclude(key_id=payload.signed_prekey.key_id).update(
            is_active=False)

        existing_count = crypto.models.SignalOneTimePreKey.objects.filter(
            user=user, is_used=False
        ).count()

        incoming_count = len(payload.one_time_prekeys)

        if existing_count + incoming_count > MAX_PREKEYS:
            return {
                "error": "prekey_limit_exceeded",
                "message": f"Too many one-time prekeys. "
                           f"Already have {existing_count}, "
                           f"trying to add {incoming_count}, "
                           f"limit is {MAX_PREKEYS}."
            }

        # --- One-Time PreKeys ---
        print(payload)
        for otp in payload.one_time_prekeys:
            try:
                otp_bytes = base64.b64decode(otp.public_key)
            except (binascii.Error, ValueError):
                raise HttpError(400, "Invalid Base64 for onetime prekey")

            crypto.models.SignalOneTimePreKey.objects.update_or_create(
                user=user,
                key_id=otp.key_id,
                defaults={"public_key": otp_bytes, "is_used": False},
            )

    return {"status": "ok"}

@router.get("/keys/status")
def get_keys_status(request):
    user = request.user

    left = crypto.models.SignalOneTimePreKey.objects.filter(user=user, is_used=False).count()

    can_upload = MAX_PREKEYS - left
    if can_upload < 0:
        can_upload = 0

    return {
        "one_time_prekeys_left": left,
        "one_time_prekeys_max": MAX_PREKEYS,
        "one_time_prekeys_can_upload": can_upload,
    }


@router.post("/keys/prekeys")
def post_user_prekeys(request, payload: crypto.schemas.OneTimePreKeyUploadSchema):
    user = request.user

    with transaction.atomic():
        existing_count = crypto.models.SignalOneTimePreKey.objects.filter(
            user=user, is_used=False
        ).count()

        incoming_count = len(payload.one_time_prekeys)

        if existing_count + incoming_count > MAX_PREKEYS:
            return {
                "error": "prekey_limit_exceeded",
                "message": f"Too many one-time prekeys. "
                           f"Already have {existing_count}, "
                           f"trying to add {incoming_count}, "
                           f"limit is {MAX_PREKEYS}."
            }

        for otp in payload.one_time_prekeys:
            otp_bytes = base64.b64decode(otp.public_key)
            obj, created = crypto.models.SignalOneTimePreKey.objects.get_or_create(
                user=user,
                key_id=otp.key_id,
                defaults={"public_key": otp_bytes, "is_used": False},
            )

            if not created:
                if obj.public_key != otp_bytes:
                    return {
                        "error": "prekey_conflict",
                        "message": f"PreKey {otp.key_id} already exists with different public key"
                    }

    return {"status": "ok"}


@router.get("/keys/{user_id}")
def get_user_keys(request, user_id: int):
    sender = request.user

    try:
        receiver = users.models.User.objects.get(id=user_id)
    except users.models.User.DoesNotExist:
        return {"error": "User not found"}

    with transaction.atomic():

        if crypto.models.SignalPreKeyRequest.objects.filter(
                sender=sender, receiver=receiver
        ).count() > 100:
            return {"error": "Prekey already issued for this user"}

        try:
            identity = crypto.models.SignalIdentity.objects.get(user=receiver)
        except crypto.models.SignalIdentity.DoesNotExist:
            return {"error": "User has no identity key"}

        identity_key_b64 = base64.b64encode(identity.public_key).decode()

        signed_prekey = (
            crypto.models.SignalSignedPreKey.objects
            .select_for_update(skip_locked=True)
            .filter(user=receiver, is_active=True)
            .first()
        )

        if not signed_prekey:
            return {"error": "User has no active signed prekey"}

        signed_prekey_b64 = base64.b64encode(signed_prekey.public_key).decode()
        signature_b64 = base64.b64encode(signed_prekey.signature).decode()

        one_time_prekey = (
            crypto.models.SignalOneTimePreKey.objects
            .select_for_update()
            .filter(user=receiver, is_used=False)
            .first()
        )

        if not one_time_prekey:
            return {"error": "No one-time prekeys available"}

        one_time_prekey.is_used = True
        one_time_prekey.save(update_fields=["is_used"])

        one_time_prekey_b64 = base64.b64encode(one_time_prekey.public_key).decode()

        crypto.models.SignalPreKeyRequest.objects.create(
            sender=sender,
            receiver=receiver
        )


    return {
        "registration_id": identity.registration_id,
        "identity_key": identity_key_b64,
        "signed_prekey": {
            "key_id": signed_prekey.key_id,
            "public_key": signed_prekey_b64,
            "signature": signature_b64
        },
        "one_time_prekey": {
            "key_id": one_time_prekey.key_id,
            "public_key": one_time_prekey_b64,
        }
    }