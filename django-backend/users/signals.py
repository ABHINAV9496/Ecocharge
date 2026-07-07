from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model

User = get_user_model()


@receiver(post_save, sender=User)
def set_super_admin_role(sender, instance, created, **kwargs):
    if instance.is_superuser and instance.role != User.Role.SUPER_ADMIN:
        User.objects.filter(pk=instance.pk).update(role=User.Role.SUPER_ADMIN)
