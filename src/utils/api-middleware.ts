import { NextResponse } from 'next/server';
import { auth } from "~/auth"
import type { Session } from "next-auth";
import { previewBotRequest } from "@/preview/server";

export type ApiContext<T = Record<string, string>> = {
  params: T;
};

export async function withAuth<T = Record<string, string>>(
  handler: (session: Session & { user: Session['user'] & { id: string } }, context: ApiContext<T>) => Promise<Response>,
  context: Partial<ApiContext<T>> = { params: {} as T }
) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.authError) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    return await handler(session as Session & { user: Session['user'] & { id: string } }, context as ApiContext<T>);
  } catch (error) {
    console.error("Error occurred:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function makeApiRequest(url: string, options: RequestInit = {}) {
  const target = new URL(url, "http://preview.local");
  const endpoint = target.pathname.split("/").filter(Boolean).pop() || "";
  const params = Object.fromEntries([...target.searchParams].filter(([key]) => key !== "auth"));
  const body = typeof options.body === "string" ? JSON.parse(options.body) : undefined;
  const response = await previewBotRequest(endpoint, params, body, options.method || "GET");
  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`);
  }
  return response.json();
}
