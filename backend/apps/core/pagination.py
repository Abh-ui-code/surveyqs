from rest_framework.pagination import PageNumberPagination


class PageSizePagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 200


class LargePageSizePagination(PageSizePagination):
    """For reference-table pickers (choice lists, geography nodes) only."""

    max_page_size = 1000
