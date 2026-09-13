import { AppNav } from "@/components/AppNav";
import { requireSession } from "@/lib/session";

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const session = await requireSession();
  return (
    <div className="flex min-h-full flex-col">
      <AppNav user={{ name: session.user.name, email: session.user.email, image: session.user.image }} />
      <main className="flex-1 pt-6">{children}</main>
    </div>
  );
}
