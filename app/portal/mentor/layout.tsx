import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageShell } from "@/components/page-shell";
import { MentorSidebar } from "@/components/mentor-sidebar";

export default async function MentorLayout({
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
    .select("full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!staff || staff.role !== "mentor") redirect("/dashboard");

  return (
    <PageShell particles={false} theme="v0" scene3d className="flex min-h-screen flex-col sm:flex-row">
      <MentorSidebar name={staff.full_name} />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-10 sm:py-8">{children}</main>
    </PageShell>
  );
}
