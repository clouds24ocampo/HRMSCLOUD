-- Applicant self-service events move out of the operations log (they are recorded under "portal.").
UPDATE "AuditLog" a
SET "action" = CASE a."action"
  WHEN 'applicant.registered' THEN 'portal.registered'
  WHEN 'applicant.applied' THEN 'portal.applied'
  WHEN 'applicant.documents' THEN 'portal.documents'
  WHEN 'exam.started' THEN 'portal.exam_started'
  WHEN 'exam.submitted' THEN 'portal.exam_submitted'
  WHEN 'login.success' THEN 'portal.login'
  WHEN 'login.failed' THEN 'portal.login_failed'
  ELSE a."action"
END
FROM "User" u JOIN "Role" r ON r."id" = u."roleId"
WHERE a."actorId" = u."id" AND r."key" = 'APPLICANT';
