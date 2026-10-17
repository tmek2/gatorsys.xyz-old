"use client";

import { DocumentReader } from "@/components/document-reader";

export function DocumentViewerClient({
  parentId,
  departmentId,
  resourceId,
}: {
  parentId: string;
  departmentId: string;
  resourceId: string;
}) {
  return (
    <DocumentReader
      apiPath={`/api/departments/${parentId}/${departmentId}/doc/${resourceId}`}
      documentHref={(id) => `/departments/${parentId}/${departmentId}/doc/${id}`}
      editHref={(id) =>
        `/departments/${parentId}/${departmentId}?tab=resources&edit=${id}`
      }
    />
  );
}
