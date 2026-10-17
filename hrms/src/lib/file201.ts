// The 201 file: the employee's personnel record. Common Philippine private-sector requirements (pre-employment checklists of
// DOLE-registered employers; SSS, PhilHealth, Pag-IBIG and BIR registration; NBI and barangay clearances).
// Each upload is an EmployeeDocument in the "201 File" category whose title is the requirement title, so versions stack per item.
//   required: true  -> the employee must upload it (HR may upload it for them, optional for HR)
//   required: false -> only when it applies (married, has dependents, worked elsewhere this year, licensed profession)
export const FILE_201_CATEGORY = "201 File";

export const FILE_201: { title: string; required: boolean; hint: string }[] = [
  { title: "Resume / Curriculum Vitae", required: true, hint: "Latest copy" },
  { title: "Personal Data Sheet", required: true, hint: "Filled-out employee information sheet" },
  { title: "2x2 ID Photo", required: true, hint: "White background, recent" },
  { title: "PSA Birth Certificate", required: true, hint: "PSA-issued copy" },
  { title: "Valid Government IDs", required: true, hint: "Two IDs, front and back, in one file" },
  { title: "NBI Clearance", required: true, hint: "Issued within the last 6 months" },
  { title: "Barangay Clearance", required: true, hint: "From your current barangay" },
  { title: "SSS Number (E-1 / ID / UMID)", required: true, hint: "Proof of your SSS number" },
  { title: "PhilHealth ID / MDR", required: true, hint: "Member Data Record or ID" },
  { title: "Pag-IBIG MID Number", required: true, hint: "Member's Data Form or ID" },
  { title: "TIN (BIR Form 1902 / 1905 / TIN ID)", required: true, hint: "Proof of your Tax Identification Number" },
  { title: "Transcript of Records / Diploma", required: true, hint: "Highest education attained" },
  { title: "Medical / Pre-employment Exam", required: true, hint: "Results and fit-to-work certificate" },
  { title: "Police Clearance", required: false, hint: "If the company asks for it" },
  { title: "Certificate of Employment (previous employer)", required: false, hint: "If you worked before" },
  { title: "BIR Form 2316 (previous employer, this year)", required: false, hint: "If you worked elsewhere this year" },
  { title: "PSA Marriage Certificate", required: false, hint: "If married" },
  { title: "Birth Certificates of Dependents", required: false, hint: "If you have dependents" },
  { title: "PRC License / Certificates", required: false, hint: "Licensed professions and trainings" },
  { title: "Signed Employment Contract", required: false, hint: "Uploaded by HR" },
];

export const REQUIRED_201 = FILE_201.filter((r) => r.required).map((r) => r.title);
export const isFile201Title = (t: string) => FILE_201.some((r) => r.title === t);

// Pure: which required items have no active upload yet.
export const missing201 = (uploadedTitles: Iterable<string>) => {
  const have = new Set(uploadedTitles);
  return REQUIRED_201.filter((t) => !have.has(t));
};
