import { requireUser } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { ChangePasswordForm } from "./ChangePasswordForm";
import { logout } from "@/app/login/actions";

export default async function ChangePasswordPage() {
  const user = await requireUser("/change-password");
  const forced = user.mustChangePassword;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <p className="mb-8 flex items-center gap-2 font-headline text-lg font-medium text-brand">
          <Logo className="h-6 w-6" /> HRMS
        </p>
        <h1 className="text-3xl font-bold tracking-tight">{forced ? "Choose your password" : "Change password"}</h1>
        <p className="mt-2 mb-8 text-muted">
          {forced
            ? `Welcome, ${user.name.split(" ")[0]}. Your administrator gave you a temporary password. Set your own to continue.`
            : "Other devices will be signed out when you save."}
        </p>
        <ChangePasswordForm forced={forced} />
        {forced && (
          <form action={logout} className="mt-6 text-center">
            <button className="text-sm font-medium text-muted hover:text-ink">Sign out instead</button>
          </form>
        )}
      </div>
    </main>
  );
}
