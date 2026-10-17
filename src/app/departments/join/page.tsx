import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { NO_INDEX } from "@/utils/no-index";

/** Customer content — see `NO_INDEX`. */
export const metadata: Metadata = { robots: NO_INDEX };

export default async function DepartmentJoinPage() {
  redirect("/servers?join=1");
}
