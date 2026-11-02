"use client";

import { useKeptForm } from "@/components/useKeptForm";
import { Alert, Field, SubmitButton } from "@/components/Fields";
import { inputClass } from "@/components/ui";
import { saveMyContact, saveMyNumbers, uploadMyPhoto } from "./actions";

const Msg = ({ s }: { s: { error?: string; ok?: string } | undefined }) => (
  <>
    {s?.error && <Alert kind="error">{s.error}</Alert>}
    {s?.ok && <Alert kind="success">{s.ok}</Alert>}
  </>
);

export function ContactForm({ v }: { v: { phone: string; address: string; birthDate: string } }) {
  const f = useKeptForm(saveMyContact);
  return (
    <form {...f.formProps} className="space-y-3">
      <Field label="Mobile number" id="phone" type="tel" autoComplete="tel" defaultValue={v.phone} placeholder="+639171234567" maxLength={30} />
      <Field label="Home address" id="address" autoComplete="street-address" defaultValue={v.address} placeholder="Street, barangay, city, province" maxLength={200} />
      <Field label="Date of birth" id="birthDate" type="date" defaultValue={v.birthDate} />
      <Msg s={f.state} />
      <SubmitButton pending={f.pending}>Save my details</SubmitButton>
    </form>
  );
}

export function NumbersForm({ v }: { v: { sss: string; philhealth: string; tin: string; pagibig: string } }) {
  const f = useKeptForm(saveMyNumbers);
  return (
    <form {...f.formProps} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="SSS #" id="sss" inputMode="numeric" defaultValue={v.sss} placeholder="34-1234567-8" maxLength={20} />
        <Field label="PhilHealth #" id="philhealth" inputMode="numeric" defaultValue={v.philhealth} placeholder="12-345678901-2" maxLength={20} />
        <Field label="TIN #" id="tin" inputMode="numeric" defaultValue={v.tin} placeholder="123-456-789" maxLength={20} />
        <Field label="Pag-IBIG #" id="pagibig" inputMode="numeric" defaultValue={v.pagibig} placeholder="1234-5678-9012" maxLength={20} />
      </div>
      <p className="text-xs text-muted">Type numbers only; the dashes are added for you. They are used for your payslip reports and printed on the back of your ID. Only you, HR and payroll see them in full.</p>
      <Msg s={f.state} />
      <SubmitButton pending={f.pending}>Save my numbers</SubmitButton>
    </form>
  );
}

export function MyPhotoForm() {
  const f = useKeptForm(uploadMyPhoto);
  return (
    <form {...f.formProps} encType="multipart/form-data" className="space-y-3">
      <label className="block text-sm font-medium">
        Profile picture (PNG or JPEG, up to 3 MB)
        <input type="file" name="photo" required accept="image/png,image/jpeg" capture="user" className={`${inputClass} file:mr-3 file:rounded-md file:border-0 file:bg-brand/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand`} />
      </label>
      <Msg s={f.state} />
      <SubmitButton pending={f.pending}>Upload picture</SubmitButton>
    </form>
  );
}
