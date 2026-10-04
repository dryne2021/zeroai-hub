import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getExpertProfile, requireRole } from "@/lib/auth";
import { Container } from "@/components/ui";
import { WelcomeForm } from "@/components/expert-welcome-form";
import { HumanMadeBadge } from "@/components/seal";

export const metadata: Metadata = { title: "Welcome" };

export default async function ExpertWelcomePage() {
  const user = await requireRole("expert", "/expert/welcome");
  const profile = await getExpertProfile(user.id);
  if (!profile || profile.status !== "approved") redirect("/expert");
  if (profile.onboarded_at) redirect("/expert");

  return (
    <Container className="max-w-2xl py-10 sm:py-14">
      <HumanMadeBadge />
      <h1 className="mt-4 text-3xl font-bold">Welcome to ZeroAI Hub, {user.profile.full_name?.split(" ")[0] || "there"}</h1>
      <p className="mt-2 text-muted">
        Your account was set up by the ZeroAI Hub team. Before you start, choose your own password
        {profile.pledge_signed_at ? "." : " and sign the no-AI pledge."}
      </p>
      <div className="panel mt-8 p-5 sm:p-8">
        <WelcomeForm fullName={user.profile.full_name || ""} needsPledge={!profile.pledge_signed_at} />
      </div>
    </Container>
  );
}
