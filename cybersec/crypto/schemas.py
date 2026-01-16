from ninja import Schema
from typing import List


class OneTimePreKeySchema(Schema):
    key_id: int
    public_key: str


class SignedPreKeySchema(Schema):
    key_id: int
    public_key: str
    signature: str


class KeyUploadSchema(Schema):
    identity_key: str
    registration_id: int
    signed_prekey: SignedPreKeySchema
    one_time_prekeys: List[OneTimePreKeySchema]


class OneTimePreKeyUploadSchema(Schema):
    one_time_prekeys: List[OneTimePreKeySchema]
