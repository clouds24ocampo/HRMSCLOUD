"use client";

import { useKeptForm } from "@/components/useKeptForm";
import { Alert, Field, SubmitButton } from "@/components/Fields";
import { inputClass } from "@/components/ui";
import { saveIdDesign, uploadPhoto } from "./actions";

export function PhotoForm({ employeeId }: { employeeId: string }) {
  const f = useKeptForm(uploadPhoto.bind(null, employeeId));
  return (
    <form {...f.formProps} encType="multipart/form-data" className="space-y-3">
      <label className="block text-sm font-medium">
        Profile picture (PNG or JPEG, up to 3 MB)
        <input type="file" name="photo" required accept="image/png,image/jpeg" capture="user" className={`${inputClass} file:mr-3 file:rounded-md file:border-0 file:bg-brand/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand`} />
      </label>
      {f.state?.error && <Alert kind="error">{f.state.error}</Alert>}
      {f.state?.ok && <Alert kind="success">{f.state.ok}</Alert>}
      <SubmitButton pending={f.pending}>Upload picture</SubmitButton>
    </form>
  );
}

type Design = { title: string; accent: string; showPosition: boolean; showDepartment: boolean; showHireDate: boolean; showEmployeeNo: boolean; signatoryName: string; signatoryTitle: string; footer: string };

export function IdDesignForm({ d }: { d: Design }) {
  const f = useKeptForm(saveIdDesign);
  const box = (name: keyof Design, label: string) => (
    <label className="flex items-center gap-2 text-sm font-medium">
      <input type="checkbox" name={name} defaultChecked={d[name] as boolean} className="h-4 w-4 accent-brand" /> {label}
    </label>
  );
  return (
    <form {...f.formProps} encType="multipart/form-data" className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Card title" id="title" required maxLength={40} defaultValue={d.title} />
        <label className="block text-sm font-medium">
          Color
          <input type="color" name="accent" defaultValue={d.accent} className="mt-1 block h-11 w-full cursor-pointer rounded-lg border border-line bg-surface p-1" />
        </label>
      </div>
      <fieldset className="grid gap-2 sm:grid-cols-2">
        <legend className="mb-1 text-sm font-medium">Show on the card</legend>
        {box("showPosition", "Position")}
        {box("showDepartment", "Department")}
        {box("showHireDate", "Date hired (start date)")}
        {box("showEmployeeNo", "Employee number")}
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Signatory name" id="signatoryName" maxLength={80} defaultValue={d.signatoryName} placeholder="Juan Dela Cruz" />
        <Field label="Signatory title" id="signatoryTitle" maxLength={80} defaultValue={d.signatoryTitle} placeholder="HR Manager" />
      </div>
      <label className="block text-sm font-medium">
        Signatory signature (PNG or JPEG, optional; leave empty to keep the current one)
        <input type="file" name="signature" accept="image/png,image/jpeg" className={`${inputClass} file:mr-3 file:rounded-md file:border-0 file:bg-brand/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand`} />
      </label>
      <Field label="Footer (optional)" id="footer" maxLength={160} defaultValue={d.footer} placeholder="If found, please return to…" />
      {f.state?.error && <Alert kind="error">{f.state.error}</Alert>}
      {f.state?.ok && <Alert kind="success">{f.state.ok}</Alert>}
      <SubmitButton pending={f.pending}>Save ID design</SubmitButton>
    </form>
  );
}
