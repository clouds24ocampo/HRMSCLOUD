import { requireUser } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { LocateMe } from "./LocateMe";

// Opened on the phone from the QR code the computer shows next to the time clock.
export default async function LocatePage({ params }: { params: Promise<{ token: string }> }) {
  const me = await requireUser("/locate");
  const { token } = await params;
  return (
    <div className="mx-auto max-w-md">
      <PageHeader title="Confirm your location" subtitle={`Signed in as ${me.name}. Your phone's GPS is sent once, for your next time stamp on the computer.`} />
      <Card className="space-y-3">
        <LocateMe token={token} />
        <p className="text-xs text-muted">Nothing is tracked after this. The link works once and expires in 10 minutes.</p>
      </Card>
    </div>
  );
}
