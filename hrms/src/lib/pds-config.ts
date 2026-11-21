// The Personal Data Sheet: every section and every question, in one list. The form, the checks, the completion percent and HR's
// read-only view all read this list, so a question is added or changed in ONE place.
// Modeled on the Philippine Civil Service personal data sheet (CS Form 212) and a private-company application form:
// personal details, contact and official social media, addresses, government numbers, family, education, eligibility and licenses,
// work experience, trainings, skills, other information, references, emergency contact, and the declaration with data privacy consent.
//
// Values are stored as short text. A yes/no answer is "Yes" or "No"; a tick box is "Yes" or "".
export type FieldType = "text" | "date" | "select" | "textarea" | "tel" | "email" | "url" | "number" | "check";
export type Cond = { key: string; is?: string; not?: string }; // show this field only when another field in the same row or section has / does not have a value

export type Field = {
  key: string; label: string; type?: FieldType; required?: boolean; options?: readonly string[]; max?: number;
  placeholder?: string; hint?: string; span?: 1 | 2 | 3; showIf?: Cond; requiredIf?: Cond;
};
export type FieldsSection = { kind: "fields"; key: string; title: string; blurb?: string; fields: Field[] };
// A list of rows (children, schools, jobs ...). `min` rows are required; `none` is a tick box "I have none" that replaces the rows.
export type RowsSection = { kind: "rows"; key: string; title: string; blurb?: string; columns: Field[]; min: number; max: number; none?: string; addLabel: string; rowLabel: string };
export type Section = FieldsSection | RowsSection;

const YESNO = ["Yes", "No"] as const;
const YESNOP = ["Yes", "No", "Prefer not to say"] as const;
const SEX = ["Male", "Female"] as const;
const CIVIL = ["Single", "Married", "Widowed", "Separated", "Annulled", "Other"] as const;
const CITIZEN = ["Filipino", "Dual citizen (Filipino and other)", "Other citizenship"] as const;
const BLOOD = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Not sure"] as const;
const LEVELS = ["Elementary", "Secondary (High School)", "Senior High School", "Vocational / Trade course", "College (Bachelor's)", "Graduate Studies (Master's)", "Doctorate"] as const;
const APPT = ["Regular / Permanent", "Probationary", "Contractual", "Project-based", "Part-time", "Freelance / Self-employed", "Internship / OJT"] as const;
const TRAIN = ["Technical", "Supervisory", "Managerial", "Safety / Compliance", "Other"] as const;
const SOURCE = ["Careers page", "Facebook", "LinkedIn", "Job fair", "Referral by an employee", "Friend or relative", "School / University", "Other"] as const;
const RELATION = ["Spouse", "Parent", "Child", "Sibling", "Relative", "Friend", "Other"] as const;

export const PDS_SECTIONS: Section[] = [
  {
    kind: "fields", key: "personal", title: "1. Personal information", blurb: "Write your name exactly as it appears on your birth certificate and valid ID.",
    fields: [
      { key: "surname", label: "Surname / Last name", required: true, max: 60 },
      { key: "firstName", label: "First name", required: true, max: 60 },
      { key: "middleName", label: "Middle name", max: 60, hint: "Write N/A if you have none" },
      { key: "extension", label: "Name extension", placeholder: "Jr., Sr., III", max: 10 },
      { key: "nickname", label: "Nickname", max: 40 },
      { key: "birthDate", label: "Date of birth", type: "date", required: true },
      { key: "birthPlace", label: "Place of birth", required: true, max: 120, placeholder: "City / municipality, province" },
      { key: "sex", label: "Sex", type: "select", options: SEX, required: true },
      { key: "civilStatus", label: "Civil status", type: "select", options: CIVIL, required: true },
      { key: "citizenship", label: "Citizenship", type: "select", options: CITIZEN, required: true },
      { key: "citizenshipOther", label: "Other citizenship (country)", max: 60, showIf: { key: "citizenship", not: "Filipino" }, requiredIf: { key: "citizenship", not: "Filipino" } },
      { key: "heightCm", label: "Height (cm)", type: "number", max: 3 },
      { key: "weightKg", label: "Weight (kg)", type: "number", max: 3 },
      { key: "bloodType", label: "Blood type", type: "select", options: BLOOD },
      { key: "religion", label: "Religion", max: 60, hint: "Optional" },
    ],
  },
  {
    kind: "fields", key: "contact", title: "2. Contact details and official social media", blurb: "How we can reach you. Social media: give only accounts you are happy to share, as full links.",
    fields: [
      { key: "email", label: "Email address", type: "email", required: true, max: 120 },
      { key: "altEmail", label: "Alternate email", type: "email", max: 120 },
      { key: "mobile", label: "Mobile number", type: "tel", required: true, max: 20, placeholder: "09XX XXX XXXX" },
      { key: "altMobile", label: "Alternate mobile number", type: "tel", max: 20 },
      { key: "landline", label: "Landline / telephone", type: "tel", max: 20 },
      { key: "facebook", label: "Facebook profile link", type: "url", max: 200, placeholder: "https://facebook.com/yourname" },
      { key: "linkedin", label: "LinkedIn profile link", type: "url", max: 200, placeholder: "https://linkedin.com/in/yourname" },
      { key: "instagram", label: "Instagram link", type: "url", max: 200 },
      { key: "twitter", label: "X (Twitter) link", type: "url", max: 200 },
      { key: "tiktok", label: "TikTok link", type: "url", max: 200 },
      { key: "github", label: "GitHub / portfolio link", type: "url", max: 200, hint: "Developers and designers: show your work" },
      { key: "website", label: "Personal website / blog", type: "url", max: 200 },
    ],
  },
  {
    kind: "fields", key: "address", title: "3. Addresses", blurb: "Where you live now, and your permanent home address.",
    fields: [
      { key: "resHouse", label: "Present address: house / block / lot no.", required: true, max: 80 },
      { key: "resStreet", label: "Street", max: 80 },
      { key: "resSubdivision", label: "Subdivision / village", max: 80 },
      { key: "resBarangay", label: "Barangay", required: true, max: 80 },
      { key: "resCity", label: "City / municipality", required: true, max: 80 },
      { key: "resProvince", label: "Province", required: true, max: 80 },
      { key: "resZip", label: "ZIP code", required: true, max: 10 },
      { key: "permSame", label: "My permanent address is the same as my present address", type: "check", span: 3 },
      { key: "permHouse", label: "Permanent address: house / block / lot no.", max: 80, showIf: { key: "permSame", not: "Yes" }, requiredIf: { key: "permSame", not: "Yes" } },
      { key: "permStreet", label: "Street", max: 80, showIf: { key: "permSame", not: "Yes" } },
      { key: "permSubdivision", label: "Subdivision / village", max: 80, showIf: { key: "permSame", not: "Yes" } },
      { key: "permBarangay", label: "Barangay", max: 80, showIf: { key: "permSame", not: "Yes" }, requiredIf: { key: "permSame", not: "Yes" } },
      { key: "permCity", label: "City / municipality", max: 80, showIf: { key: "permSame", not: "Yes" }, requiredIf: { key: "permSame", not: "Yes" } },
      { key: "permProvince", label: "Province", max: 80, showIf: { key: "permSame", not: "Yes" }, requiredIf: { key: "permSame", not: "Yes" } },
      { key: "permZip", label: "ZIP code", max: 10, showIf: { key: "permSame", not: "Yes" }, requiredIf: { key: "permSame", not: "Yes" } },
    ],
  },
  {
    kind: "fields", key: "govIds", title: "4. Government numbers and IDs", blurb: "Needed for payroll and mandatory contributions. If you do not have a number yet, tick the box and tell HR when you get it.",
    fields: [
      { key: "noneYet", label: "I do not have all of these numbers yet", type: "check", span: 3 },
      { key: "sss", label: "SSS number", max: 20, placeholder: "00-0000000-0", requiredIf: { key: "noneYet", not: "Yes" } },
      { key: "philhealth", label: "PhilHealth number", max: 20, placeholder: "00-000000000-0", requiredIf: { key: "noneYet", not: "Yes" } },
      { key: "pagibig", label: "Pag-IBIG (HDMF) number", max: 20, placeholder: "0000-0000-0000", requiredIf: { key: "noneYet", not: "Yes" } },
      { key: "tin", label: "TIN (Tax Identification Number)", max: 20, placeholder: "000-000-000-000", requiredIf: { key: "noneYet", not: "Yes" } },
      { key: "philsys", label: "PhilSys National ID number", max: 24 },
      { key: "driversLicense", label: "Driver's license number", max: 24 },
      { key: "driversExpiry", label: "Driver's license expiry", type: "date" },
      { key: "passport", label: "Passport number", max: 20 },
      { key: "passportExpiry", label: "Passport expiry", type: "date" },
    ],
  },
  {
    kind: "fields", key: "family", title: "5. Family background", blurb: "Your parents and, if you are married, your spouse. Your mother's maiden name is needed for government records.",
    fields: [
      { key: "spouseSurname", label: "Spouse: surname", max: 60, hint: "If married" },
      { key: "spouseFirst", label: "Spouse: first name", max: 60 },
      { key: "spouseMiddle", label: "Spouse: middle name", max: 60 },
      { key: "spouseBirthDate", label: "Spouse: date of birth", type: "date" },
      { key: "spouseOccupation", label: "Spouse: occupation", max: 80 },
      { key: "spouseEmployer", label: "Spouse: employer / business", max: 100 },
      { key: "spousePhone", label: "Spouse: contact number", type: "tel", max: 20 },
      { key: "fatherSurname", label: "Father: surname", max: 60 },
      { key: "fatherFirst", label: "Father: first name", max: 60 },
      { key: "fatherMiddle", label: "Father: middle name", max: 60 },
      { key: "fatherBirthDate", label: "Father: date of birth", type: "date" },
      { key: "fatherOccupation", label: "Father: occupation", max: 80 },
      { key: "motherSurname", label: "Mother's MAIDEN surname", required: true, max: 60 },
      { key: "motherFirst", label: "Mother: first name", required: true, max: 60 },
      { key: "motherMiddle", label: "Mother: middle name", max: 60 },
      { key: "motherBirthDate", label: "Mother: date of birth", type: "date" },
      { key: "motherOccupation", label: "Mother: occupation", max: 80 },
    ],
  },
  {
    kind: "rows", key: "children", title: "6. Children", blurb: "Needed for benefits and for the 201 file.", min: 0, max: 12, none: "I have no children", addLabel: "Add a child", rowLabel: "Child",
    columns: [
      { key: "fullName", label: "Full name", required: true, max: 100 },
      { key: "birthDate", label: "Date of birth", type: "date", required: true },
    ],
  },
  {
    kind: "rows", key: "dependents", title: "7. Other dependents", blurb: "Anyone else who depends on you (parents, siblings), for benefit enrollment.", min: 0, max: 10, none: "I have no other dependents", addLabel: "Add a dependent", rowLabel: "Dependent",
    columns: [
      { key: "fullName", label: "Full name", required: true, max: 100 },
      { key: "relationship", label: "Relationship", type: "select", options: RELATION, required: true },
      { key: "birthDate", label: "Date of birth", type: "date" },
    ],
  },
  {
    kind: "rows", key: "education", title: "8. Educational background", blurb: "Start with the highest level you finished. Add every level you attended.", min: 1, max: 10, addLabel: "Add a school", rowLabel: "School",
    columns: [
      { key: "level", label: "Level", type: "select", options: LEVELS, required: true },
      { key: "school", label: "Name of school", required: true, max: 120 },
      { key: "course", label: "Degree / course / strand", max: 120 },
      { key: "from", label: "From (year)", type: "number", max: 4, required: true },
      { key: "to", label: "To (year)", type: "number", max: 4, hint: "Blank if still studying" },
      { key: "units", label: "Highest level / units earned", max: 60, hint: "If not graduated" },
      { key: "graduated", label: "Year graduated", type: "number", max: 4 },
      { key: "honors", label: "Scholarship / honors received", max: 100 },
    ],
  },
  {
    kind: "rows", key: "eligibility", title: "9. Licenses and eligibility", blurb: "PRC, TESDA, Civil Service, bar, board and other professional licenses or certifications.", min: 0, max: 10, none: "I have no license or eligibility", addLabel: "Add a license", rowLabel: "License",
    columns: [
      { key: "name", label: "License / eligibility", required: true, max: 120 },
      { key: "rating", label: "Rating", max: 20 },
      { key: "examDate", label: "Date of exam / conferment", type: "date" },
      { key: "examPlace", label: "Place of exam", max: 100 },
      { key: "licenseNo", label: "License number", max: 40 },
      { key: "validUntil", label: "Valid until", type: "date" },
    ],
  },
  {
    kind: "rows", key: "work", title: "10. Work experience", blurb: "Your most recent job first. Include internships and OJT. If you have never worked, tick the box.", min: 0, max: 12, none: "I have no work experience yet", addLabel: "Add a job", rowLabel: "Job",
    columns: [
      { key: "company", label: "Company / employer", required: true, max: 120 },
      { key: "position", label: "Position / job title", required: true, max: 100 },
      { key: "from", label: "From", type: "date", required: true },
      { key: "to", label: "To", type: "date", hint: "Blank if you still work here" },
      { key: "status", label: "Status of employment", type: "select", options: APPT },
      { key: "salary", label: "Monthly salary", max: 20 },
      { key: "address", label: "Company address", max: 160 },
      { key: "supervisor", label: "Supervisor / contact person", max: 100 },
      { key: "contact", label: "Contact number", type: "tel", max: 20 },
      { key: "reason", label: "Reason for leaving", max: 160 },
    ],
  },
  {
    kind: "rows", key: "trainings", title: "11. Trainings and seminars", blurb: "Learning and development programs, certifications and short courses.", min: 0, max: 20, none: "I have no trainings to list", addLabel: "Add a training", rowLabel: "Training",
    columns: [
      { key: "title", label: "Title of training", required: true, max: 140 },
      { key: "from", label: "From", type: "date" },
      { key: "to", label: "To", type: "date" },
      { key: "hours", label: "Number of hours", type: "number", max: 5 },
      { key: "type", label: "Type", type: "select", options: TRAIN },
      { key: "sponsor", label: "Conducted / sponsored by", max: 120 },
    ],
  },
  {
    kind: "fields", key: "skills", title: "12. Skills, achievements and activities", blurb: "What you are good at. Be specific: it helps us place you.",
    fields: [
      { key: "skills", label: "Special skills and technical skills", type: "textarea", required: true, max: 800, span: 3, hint: "Programming languages, tools, equipment, certifications you can use" },
      { key: "languages", label: "Languages and dialects spoken", max: 160, span: 3, placeholder: "Filipino, English, Cebuano" },
      { key: "hobbies", label: "Hobbies", max: 200, span: 3 },
      { key: "distinctions", label: "Non-academic distinctions and recognition", type: "textarea", max: 500, span: 3 },
      { key: "memberships", label: "Membership in associations and organizations", type: "textarea", max: 500, span: 3 },
    ],
  },
  {
    kind: "fields", key: "other", title: "13. Other information", blurb: "Answer honestly. A \"Yes\" needs details. Questions marked optional can be answered \"Prefer not to say\".",
    fields: [
      { key: "relatedInCompany", label: "Are you related to anyone who works for this company, within the fourth degree?", type: "select", options: YESNO, required: true, span: 3 },
      { key: "relatedDetails", label: "Who, and how are you related?", max: 200, span: 3, showIf: { key: "relatedInCompany", is: "Yes" }, requiredIf: { key: "relatedInCompany", is: "Yes" } },
      { key: "dismissed", label: "Have you ever been dismissed or asked to resign from a job?", type: "select", options: YESNO, required: true, span: 3 },
      { key: "dismissedDetails", label: "Please explain", max: 300, span: 3, showIf: { key: "dismissed", is: "Yes" }, requiredIf: { key: "dismissed", is: "Yes" } },
      { key: "convicted", label: "Have you ever been convicted of a crime, or do you have a pending criminal case?", type: "select", options: YESNO, required: true, span: 3 },
      { key: "convictedDetails", label: "Please explain", max: 300, span: 3, showIf: { key: "convicted", is: "Yes" }, requiredIf: { key: "convicted", is: "Yes" } },
      { key: "willingShifts", label: "Are you willing to work shifts, night work or overtime when the job needs it?", type: "select", options: YESNO, required: true, span: 3 },
      { key: "willingRelocate", label: "Are you willing to be assigned to another location or travel for work?", type: "select", options: YESNO, required: true, span: 3 },
      { key: "expectedSalary", label: "Expected monthly salary", required: true, max: 30, placeholder: "PHP 25,000" },
      { key: "availableStart", label: "Earliest date you can start", type: "date", required: true },
      { key: "source", label: "How did you learn about this job?", type: "select", options: SOURCE, required: true },
      { key: "disability", label: "Are you a person with a disability? (optional)", type: "select", options: YESNOP, span: 3, hint: "Used only to give you the support and benefits the law provides" },
      { key: "soloParent", label: "Are you a solo parent? (optional)", type: "select", options: YESNOP },
      { key: "indigenous", label: "Do you belong to an indigenous group? (optional)", type: "select", options: YESNOP },
      { key: "medical", label: "Any health condition we should know about to keep you safe at work? (optional)", type: "textarea", max: 400, span: 3 },
    ],
  },
  {
    kind: "rows", key: "references", title: "14. Character references", blurb: "At least two people who are NOT related to you and know you well (former employer, teacher, mentor, community leader).", min: 2, max: 5, addLabel: "Add a reference", rowLabel: "Reference",
    columns: [
      { key: "fullName", label: "Full name", required: true, max: 100 },
      { key: "relationship", label: "How do you know them?", required: true, max: 80 },
      { key: "company", label: "Occupation / company", max: 120 },
      { key: "address", label: "Address", max: 160 },
      { key: "contact", label: "Contact number", type: "tel", required: true, max: 20 },
      { key: "email", label: "Email", type: "email", max: 120 },
    ],
  },
  {
    kind: "fields", key: "emergency", title: "15. Person to contact in an emergency", blurb: "Someone we can call right away if something happens to you.",
    fields: [
      { key: "name", label: "Full name", required: true, max: 100 },
      { key: "relationship", label: "Relationship", type: "select", options: RELATION, required: true },
      { key: "mobile", label: "Mobile number", type: "tel", required: true, max: 20 },
      { key: "altPhone", label: "Alternate number", type: "tel", max: 20 },
      { key: "address", label: "Address", required: true, max: 200, span: 3 },
    ],
  },
  {
    kind: "fields", key: "declaration", title: "16. Declaration and data privacy consent", blurb: "Read, tick both boxes, and type your full name as your signature.",
    fields: [
      { key: "certify", label: "I declare that everything in this personal data sheet is true, complete and correct to the best of my knowledge. I understand that a false statement can be a ground for not hiring me, or for dismissal if I am hired.", type: "check", required: true, span: 3 },
      { key: "consent", label: "I consent to the company collecting, storing and using my personal information, including sensitive information such as government numbers and health information, only for recruitment, hiring, payroll, benefits and legal compliance, under the Data Privacy Act of 2012 (RA 10173). I understand I may ask to see or correct my information.", type: "check", required: true, span: 3 },
      { key: "signedName", label: "Type your full name as your signature", required: true, max: 120, span: 3 },
    ],
  },
];

export const PDS_TITLE = "Personal Data Sheet"; // the requirement it satisfies, as named in the 201 file list
