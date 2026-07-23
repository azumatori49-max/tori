import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default function Home() {
  redirect(getSession() ? "/dashboard" : "/login");
}
