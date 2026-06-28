import contextvars

auth_token_var: contextvars.ContextVar[str] = contextvars.ContextVar(
    'auth_token', default=''
)
