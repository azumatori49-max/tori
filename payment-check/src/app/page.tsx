import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default function Home() {
  const session = getSession();
  if (!session) redirect("/login");
  if (session.mustChange) redirect("/change-password");
  redirect(session.role === "hq" ? "/dashboard" : "/store");
}
