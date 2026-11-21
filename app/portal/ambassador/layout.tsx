import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageShell } from "@/components/page-shell";
import { AmbassadorSidebar } from "@/components/ambassador-sidebar";

export default async function AmbassadorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: staff } = await supabase
    .from("staff_profiles")
    .select("full_name, role, head_title")
    .eq("id", user.id)
    .maybeSingle();

  // Guard: Chief Ambassadors, Ambassadors, and Heads belong here. Secretary
  // has their own portal; Mentors have their own separate portal.
  if (!staff || !["chief_ambassador", "ambassador", "head"].includes(staff.role)) {
    redirect("/dashboard");
  }

  return (
    <PageShell particles={false} theme="v0" scene3d className="flex min-h-screen flex-col sm:flex-row">
      <AmbassadorSidebar name={staff.full_name} roleLabel={staff.head_title || staff.role.replace("_", " ")} />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-10 sm:py-8">{children}</main>
    </PageShell>
  );
}
