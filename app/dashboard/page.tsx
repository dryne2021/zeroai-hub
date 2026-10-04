import { redirect } from "next/navigation";
import { homeFor, requireUser } from "@/lib/auth";

export default async function DashboardRedirect() {
  const user = await requireUser("/dashboard");
  redirect(homeFor(user.profile.role));
}
