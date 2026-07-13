from django import forms
from django.contrib import admin
from django.contrib.gis.geos import Point

from .models import ChargingSlot, ChargingStation


class ChargingStationAdminForm(forms.ModelForm):
    latitude = forms.FloatField(
        label='Latitude', min_value=-90, max_value=90,
        widget=forms.NumberInput(attrs={'step': 'any', 'placeholder': 'e.g. 12.9716'}),
    )
    longitude = forms.FloatField(
        label='Longitude', min_value=-180, max_value=180,
        widget=forms.NumberInput(attrs={'step': 'any', 'placeholder': 'e.g. 77.5946'}),
    )
    amenities = forms.CharField(
        label='Amenities', required=False,
        help_text='Comma-separated list (e.g. WiFi, Restroom, Cafe)',
        widget=forms.TextInput(attrs={'placeholder': 'WiFi, Restroom, Cafe'}),
    )

    class Meta:
        model = ChargingStation
        fields = ['name', 'address', 'latitude', 'longitude', 'amenities', 'status']
        widgets = {'status': forms.Select()}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance.pk and self.instance.location:
            self.fields['latitude'].initial = self.instance.location.y
            self.fields['longitude'].initial = self.instance.location.x
        if self.instance.pk and self.instance.amenities:
            self.fields['amenities'].initial = ', '.join(self.instance.amenities)

    def clean_amenities(self):
        value = self.cleaned_data.get('amenities', '')
        if not value:
            return []
        return [a.strip() for a in value.split(',') if a.strip()]

    def save(self, commit=True):
        instance = super().save(commit=False)
        lat = self.cleaned_data.get('latitude')
        lng = self.cleaned_data.get('longitude')
        if lat is not None and lng is not None:
            instance.location = Point(lng, lat)
        instance.source = 'ECOCHARGE'
        instance.ocm_id = None
        if commit:
            instance.save()
        return instance


@admin.register(ChargingStation)
class ChargingStationAdmin(admin.ModelAdmin):
    form = ChargingStationAdminForm
    list_display = ('name', 'owner', 'status', 'created_at')
    list_filter = ('status',)
    search_fields = ('name', 'address')

    def save_model(self, request, obj, form, change):
        if not change:
            obj.owner = request.user
        super().save_model(request, obj, form, change)

@admin.register(ChargingSlot)
class ChargingSlotAdmin(admin.ModelAdmin):
    list_display = ('station', 'slot_type', 'status', 'rate_per_kwh')
    list_filter = ('slot_type', 'status')
