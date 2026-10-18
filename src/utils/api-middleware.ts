import { NextResponse } from 'next/server';
import { auth } from "~/auth"
import type { Session } from "next-auth";
import { getSiteUrl } from "@/utils/site-url";

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
  // Ensure URL is valid
  try {
    new URL(url);
  } catch (e) {
    const baseUrl = getSiteUrl();
    url = `${baseUrl}${url.startsWith('/') ? url : `/${url}`}`;
  }

  const response = await fetch(url, {
    ...options,
    signal: options.signal ?? AbortSignal.timeout(25_000),
    credentials: 'same-origin',
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    }
  });

  if (!response.ok) {
    console.error("API request failed", {
      method: options.method || "GET",
      status: response.status,
    });
    throw new Error(`API request failed with status ${response.status}`);
  }

  return response.json();
}
