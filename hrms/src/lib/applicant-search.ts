// One definition of "this applicant matches what HR typed": name, email or applicant number, any part, any letter case.
// Used by the search bar, the applicant list, the exam results and the commitment results.
export const applicantMatch = (q: string) => {
  const t = q.trim().slice(0, 60);
  return t
    ? { OR: [{ name: { contains: t, mode: "insensitive" as const } }, { email: { contains: t, mode: "insensitive" as const } }, { profile: { applicantNo: { contains: t, mode: "insensitive" as const } } }] }
    : {};
};
