class BootstrapFormMixin:
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for field in self.visible_fields():
            field.field.widget.attrs.update(
                {
                    "class": "form-control"
                             + field.field.widget.attrs.get("class", ""),
                },
            )
