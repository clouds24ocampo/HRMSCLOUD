"use client";

import { useKeptForm } from "@/components/useKeptForm";
import { Alert, Field, SubmitButton } from "@/components/Fields";
import { inputClass } from "@/components/ui";
import { saveIdDesign, saveIdDetails, uploadPhoto } from "./actions";

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

type Design = { title: string; showPosition: boolean; showDepartment: boolean; showHireDate: boolean; showEmployeeNo: boolean; hasLogo: boolean; signatoryName: string; signatoryTitle: string; footer: string; address: string; terms: string; validYears: number };

export function IdDesignForm({ d }: { d: Design }) {
  const f = useKeptForm(saveIdDesign);
  const box = (name: keyof Design, label: string) => (
    <label className="flex items-center gap-2 text-sm font-medium">
      <input type="checkbox" name={name} defaultChecked={d[name] as boolean} className="h-4 w-4 accent-brand" /> {label}
    </label>
  );
  return (
    <form {...f.formProps} encType="multipart/form-data" className="space-y-4">
      <div className="space-y-2">
        <label className="block text-sm font-medium">
          Company logo (PNG or JPEG, up to 3 MB; a square picture on a plain or transparent background works best)
          <input type="file" name="logo" accept="image/png,image/jpeg" className={`${inputClass} file:mr-3 file:rounded-md file:border-0 file:bg-brand/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand`} />
        </label>
        {d.hasLogo && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="removeLogo" className="h-4 w-4 accent-brand" /> Remove the current logo (the company initials are shown instead)
          </label>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Card title" id="title" required maxLength={40} defaultValue={d.title} />
        <p className="self-end pb-2 text-sm text-muted">The card uses the colors of the Philippine flag.</p>
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
      <Field label="Company address (front of the card)" id="address" maxLength={200} defaultValue={d.address} placeholder="Unit 106-C, Gissele Park Building, EDSA, Pasay City" />
      <label className="block text-sm font-medium">
        Terms and conditions (back of the card, one point per line)
        <textarea name="terms" rows={5} maxLength={1500} defaultValue={d.terms} className={inputClass} />
      </label>
      <Field label="ID validity (years from the issue date)" id="validYears" type="number" min={1} max={10} defaultValue={d.validYears} required />
      <Field label="Footer (optional)" id="footer" maxLength={160} defaultValue={d.footer} placeholder="If found, please return to…" />
      {f.state?.error && <Alert kind="error">{f.state.error}</Alert>}
      {f.state?.ok && <Alert kind="success">{f.state.ok}</Alert>}
      <SubmitButton pending={f.pending}>Save ID design</SubmitButton>
    </form>
  );
}

type Numbers = { sss: string; philhealth: string; tin: string; pagibig: string; idIssuedOn: string };

// HR adds the government numbers that print on the back of the ID, and the date it was issued.
export function IdDetailsForm({ employeeId, v, validYears }: { employeeId: string; v: Numbers; validYears: number }) {
  const f = useKeptForm(saveIdDetails.bind(null, employeeId));
  return (
    <form {...f.formProps} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="SSS #" id="sss" inputMode="numeric" defaultValue={v.sss} placeholder="34-1234567-8" maxLength={20} />
        <Field label="PhilHealth #" id="philhealth" inputMode="numeric" defaultValue={v.philhealth} placeholder="12-345678901-2" maxLength={20} />
        <Field label="TIN #" id="tin" inputMode="numeric" defaultValue={v.tin} placeholder="123-456-789" maxLength={20} />
        <Field label="Pag-IBIG #" id="pagibig" inputMode="numeric" defaultValue={v.pagibig} placeholder="1234-5678-9012" maxLength={20} />
      </div>
      <Field label={`ID date issued (valid for ${validYears} ${validYears === 1 ? "year" : "years"})`} id="idIssuedOn" type="date" defaultValue={v.idIssuedOn} />
      <p className="text-xs text-muted">Printed on the back of the ID. Only this person and HR see them in full; supervisors see them hidden.</p>
      {f.state?.error && <Alert kind="error">{f.state.error}</Alert>}
      {f.state?.ok && <Alert kind="success">{f.state.ok}</Alert>}
      <SubmitButton pending={f.pending}>Save numbers and dates</SubmitButton>
    </form>
  );
}
