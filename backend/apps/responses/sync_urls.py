from django.urls import path

from apps.responses import sync_views

urlpatterns = [
    path("bootstrap/", sync_views.SyncBootstrapView.as_view(), name="sync-bootstrap"),
    path("assignments/", sync_views.SyncAssignmentsView.as_view(), name="sync-assignments"),
    path("packages/<uuid:version_id>/", sync_views.SyncPackageView.as_view(), name="sync-package"),
    path("batch/", sync_views.SyncBatchView.as_view(), name="sync-batch"),
    path("attachments/", sync_views.SyncAttachmentUploadView.as_view(), name="sync-attachment"),
    path("heartbeat/", sync_views.SyncHeartbeatView.as_view(), name="sync-heartbeat"),
]
