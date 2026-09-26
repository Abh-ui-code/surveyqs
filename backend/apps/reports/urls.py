from django.urls import path

from apps.reports.views import DashboardView, ExportResponsesView, SurveySummaryView

urlpatterns = [
    path("dashboard/", DashboardView.as_view(), name="reports-dashboard"),
    path("survey-summary/", SurveySummaryView.as_view(), name="reports-survey-summary"),
    path("export/", ExportResponsesView.as_view(), name="reports-export"),
]
