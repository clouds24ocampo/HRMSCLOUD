import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

// The Pipeline tab opens on the first working stage.
export default async function PipelineIndex() {
  await requireUser("/recruitment");
  redirect("/recruitment/pipeline/screening");
}
