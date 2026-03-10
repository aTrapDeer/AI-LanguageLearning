import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getAccountSetupStatus } from "@/lib/database";

function resolveCallbackPath(callbackUrl: string | undefined) {
  if (!callbackUrl) {
    return "/dashboard";
  }

  if (callbackUrl.startsWith("/")) {
    return callbackUrl;
  }

  try {
    const url = new URL(callbackUrl);
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/dashboard";
  }
}

export default async function PostLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { callbackUrl } = await searchParams;
  const targetPath = resolveCallbackPath(callbackUrl);

  if (targetPath.startsWith("/login") || targetPath.startsWith("/register") || targetPath.startsWith("/auth/post-login")) {
    redirect("/dashboard");
  }

  const isAccountSetupComplete = await getAccountSetupStatus(session.user.id);

  if (!isAccountSetupComplete) {
    redirect("/account-setup");
  }

  redirect(targetPath);
}
