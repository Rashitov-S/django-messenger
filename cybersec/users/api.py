from ninja import Router
import users.models
import users.schemas
from typing import List


router = Router()


@router.get("/user/", response=List[users.schemas.UserSchema])
def search_users(request, q: str):
    qs = users.models.User.objects.filter(username__icontains=q).exclude(id=request.user.id)[:20]
    return [{"id": u.id, "username": u.username} for u in qs]