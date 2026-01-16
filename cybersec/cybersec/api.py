from crypto.api import router as crypto_router
from chat.api import router as chat_router
from users.api import router as users_router

from ninja import NinjaAPI

api = NinjaAPI()

api.add_router("/crypto/", crypto_router)
api.add_router("/chat/", chat_router)
api.add_router("/users/", users_router)
