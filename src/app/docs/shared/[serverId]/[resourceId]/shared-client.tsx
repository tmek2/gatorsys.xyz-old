"use client";

import { DocumentReader } from "@/components/document-reader";

export function SharedDocumentClient({
  serverId,
  resourceId,
}: {
  serverId: string;
  resourceId: string;
}) {
  return (
    <DocumentReader
      apiPath={`/api/docs/shared/${serverId}/${resourceId}`}
      parentId={serverId}
    />
  );
}
