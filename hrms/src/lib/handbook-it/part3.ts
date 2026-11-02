// IT company handbook, part 3: information security, acceptable use, intellectual property, service delivery,
// digital security work, Wi-Fi and network services, and health and safety.
import type { Chapter } from "./part1";

export const PART3: Chapter[] = [
  {
    slug: "information-security",
    title: "14. Information Security Policy",
    content: `14.1 Purpose
Information security protects the confidentiality (only the right people see it), integrity (it is correct and unaltered) and availability (it is there when needed) of Company and customer information. Everyone is responsible for it. The Company aims to follow recognized standards such as ISO/IEC 27001, ISO/IEC 27701 (privacy) and the NIST Cybersecurity Framework, and to keep records that can show this to customers, auditors and regulators.

14.2 Roles
- Management: approves this policy, provides resources and accepts residual risk in writing.
- Information Security Lead / CISO: runs the security program, risk assessments, monitoring, audits and incident response.
- Data Protection Officer: privacy compliance (Chapter 13).
- Managers: make sure their teams follow the rules and have only the access they need.
- Every employee: follow the rules, complete training and report incidents.

14.3 Data classification
- Public: approved for release (for example, marketing material).
- Internal: for use inside the Company (for example, internal procedures).
- Confidential: could harm the Company or a customer if disclosed (for example, source code, contracts, pricing, customer lists, network diagrams, vulnerability reports).
- Restricted: the highest sensitivity (for example, credentials, encryption keys, Personal Data, sensitive personal information, Customer Data in production, security assessment results).
Label documents and systems with their class. Handle each class as its rules require: Confidential and Restricted data is encrypted, shared only on a need-to-know basis, and never sent to personal accounts.

14.4 Access control
(a) Least privilege and need-to-know: you get only the access your role needs, approved by your manager and the system owner, and recorded.
(b) Unique accounts: every person has their own account. Shared or generic accounts are not allowed except where approved and controlled (for example, break-glass accounts that are logged and reviewed).
(c) Joiners, movers, leavers: access is granted at the start, changed when you change roles, and removed on or before your last day. Managers tell IT and HR of changes immediately.
(d) Privileged and administrator accounts are separate from day-to-day accounts, are protected by multi-factor authentication, and are logged. Administrator access to production systems is time-limited where possible.
(e) Access is reviewed at least every quarter for privileged access and every six months for other access.

14.5 Passwords and authentication
- Use multi-factor authentication (MFA) wherever it is available, and always for email, VPN, cloud consoles, code repositories, remote access and administrator accounts.
- Passwords must be long (at least 12 characters, longer for privileged accounts), unique to each service, and kept in the Company-approved password manager.
- Never share a password, write it where others can see it, send it in chat or email, or use a work password for a personal account.
- If you think a password or token is exposed, change it and report it immediately.
- Secrets (keys, tokens, certificates, database passwords) are kept in a secrets manager or vault. Never put them in source code, tickets, chat or documents.

14.6 Devices and endpoint security
(a) Use only Company-approved devices for Company work, unless BYOD is approved (Section 8.6).
(b) Devices must have full-disk encryption, a screen lock of at most five (5) minutes, current operating system patches, and the Company's endpoint protection (anti-malware or EDR) and device management turned on. Do not disable or bypass them.
(c) Do not install software that is not approved. Only licensed software may be used.
(d) Lost or stolen devices must be reported at once, at any time of day, so that IT can lock or wipe them.
(e) Removable storage (USB drives, external disks) is disabled by default. Use it only with approval, with encryption, for a stated purpose.
(f) Clean desk and clear screen: do not leave Confidential material on desks, whiteboards or screens. Shred paper that is no longer needed.

14.7 Email, messaging and phishing
(a) Be careful with links, attachments and requests for passwords, payments or data, especially urgent ones. Check the sender. If in doubt, do not click, and report it with the "report phishing" button or to the Security team.
(b) A request to change bank details or pay an invoice must be verified by a call to a known number.
(c) Use Company email and approved chat tools for Company business. Do not forward Company email to personal accounts.
(d) Attachments with Restricted data are encrypted, and the password is sent through a separate channel.
(e) If you click a bad link or open a bad file, report it at once. Quick reporting protects everyone and is not punished; hiding it is.

14.8 Network and remote access
Connect to Company networks only through approved methods. Do not connect unauthorized devices or access points (rogue Wi-Fi, switches, hotspots) to the Company network. Use the VPN or zero-trust access for remote work. Public Wi-Fi must not be used for Confidential work without the VPN.

14.9 Cloud and third-party services
Do not put Company or customer data into any cloud service, file-sharing site, AI tool, code-sharing site or software-as-a-service tool unless it has been approved by Security (and the DPO where Personal Data is involved). Using unapproved services ("shadow IT") is a violation.

14.10 Backups and recovery
Critical data is backed up according to the 3-2-1 rule (three copies, on two kinds of media, one off-site or in another region), backups are encrypted, and restores are tested at least twice a year. Backup access is restricted and logged. Backups are not used as an archive.

14.11 Logging and monitoring
Security-relevant events (sign-ins, privilege changes, administrator actions, data access, network and firewall events) are logged, protected from change, and reviewed. Logs are kept for the period the policy and the law require (see Chapter 25). Logs may contain Personal Data and are handled under Chapter 13.

14.12 Vulnerability and patch management
The Company scans for vulnerabilities regularly and patches according to risk. Targets: critical vulnerabilities on internet-facing systems within seven (7) days, high within thirty (30) days, others as scheduled, unless an approved exception with compensating controls exists. Penetration tests are done at least yearly on critical systems.

14.13 Change management
Changes to production systems follow the change procedure: request, risk review, approval, test, schedule, rollback plan, implementation and review. Emergency changes are allowed with after-the-fact approval and documentation. Nobody makes undocumented changes to production.

14.14 Secure development
(a) Source code is kept in the Company's approved repositories. Access is limited, and code is reviewed by another person before it is merged (the four-eyes rule).
(b) Developers follow secure coding practice (for example the OWASP Top 10 and ASVS), use dependency and secret scanning, and fix security defects before release.
(c) Production data is not used in development or testing, unless masked and approved.
(d) Third-party and open-source components are used only under licenses the Company allows (Section 16.7), and are tracked (software bill of materials).
(e) Releases are built and deployed by controlled pipelines, with logging and a rollback path.

14.15 Physical security
Offices, server rooms and data centers have controlled access: badges, visitor logs and escorts, CCTV where lawful, environmental protection (fire, water, power, cooling) and equipment inventory. Tailgating is not allowed. Visitors never get unsupervised access to server rooms or work areas with Confidential data.

14.16 Business continuity and disaster recovery
Critical services have continuity and recovery plans with set recovery time and recovery point objectives, tested at least once a year (see Chapter 29).

14.17 Third parties and suppliers
Suppliers and contractors who touch Company or customer data are assessed before use, and bound by written agreements for confidentiality, security, privacy (a data processing agreement where needed), incident notice, audit rights and return or deletion of data.

14.18 Security training
All Personnel complete security and privacy awareness training when they join and at least once a year, and role-based training (for example, secure coding or incident response) where it applies. Phishing exercises may be run; results are used to train, not to shame.

14.19 Reporting security incidents
Report any security event or suspicion immediately, 24 hours a day, to the Security team (hotline, email and chat channel listed in the contacts section). Examples: lost device, phishing, malware, suspicious logins, unexpected data access, a customer reporting a problem, a misconfigured system, an exposed secret. Incidents follow the response plan: detect, report, contain, investigate, eradicate, recover, notify (customers, NPC, law enforcement as required), and learn.

14.20 Exceptions and violations
Exceptions need a written, time-limited approval from the Information Security Lead, with the risk accepted by the system owner. Violations are handled under Chapter 11. A violation that is deliberate, hides an incident, or causes loss is a serious or grave offense.`,
  },
  {
    slug: "acceptable-use",
    title: "15. Acceptable Use of Company Systems, Internet, AI Tools and Social Media",
    content: `15.1 Company Systems are for business
Company Systems belong to the Company and are provided for work. Limited, reasonable personal use is tolerated if it does not interfere with work, use significant resources, breach this Handbook, or create risk. The Company may withdraw it at any time.

15.2 Prohibited uses (examples)
- Illegal activity of any kind, including piracy, hacking, and any act listed in the Cybercrime Prevention Act (illegal access, illegal interception, data and system interference, misuse of devices, computer-related fraud, identity theft).
- Accessing, copying, changing or deleting any system or data without authority.
- Downloading, installing or using unlicensed software, cracked software or pirated content.
- Installing hacking, scanning, sniffing, password-cracking or remote-control tools, except for authorized security work approved in writing (Chapter 18).
- Cryptocurrency mining, running personal servers or services, or bypassing network filters, proxies, VPN controls or security tools.
- Sending spam, chain messages, malware or harassing, obscene, discriminatory, defamatory or threatening content.
- Using Company Systems for a personal business, gambling, or for political campaigning.
- Using someone else's account or letting someone use yours.
- Connecting personal devices to the Company network without approval.

15.3 Email and messages
Company email and chat are Company records. They may be reviewed as set out in Chapter 26. Keep messages professional. Do not rely on chat or email to make binding contracts or commitments unless authorized to (Chapter 23).

15.4 Artificial intelligence tools
(a) Use only AI tools that the Company has approved for the kind of data involved.
(b) Do not enter Restricted or Confidential information, customer data, Personal Data, credentials, or unreleased source code into any public or unapproved AI tool.
(c) You are responsible for the work you submit, including anything an AI tool produces. Check it for accuracy, security, bias, and license and copyright problems before using it.
(d) Do not present AI output as verified fact, or use it to make decisions about people (hiring, discipline, pay) without human review.
(e) Disclose AI use to customers where the contract or law requires.

15.5 Software licensing and open source
Use only software for which the Company holds a license, and follow its terms. Open-source software is used under Section 16.7.

15.6 Social media
See Section 9.9.

15.7 Personal devices and accounts
Do not use personal email, personal cloud storage, personal messaging accounts or personal AI accounts for Company work, unless approved under BYOD.

15.8 No expectation of privacy on Company Systems
You have no expectation of privacy in Company Systems or in business communications on them. The Company monitors in line with Chapter 26, which states what is monitored and why, and applies the Data Privacy Act's principles of transparency and proportionality. By acknowledging this Handbook, you confirm that you were told of this monitoring and that you understand it.

15.9 Consequences
Breaches of this chapter are disciplinary offenses. Illegal acts will also be reported to the authorities, and the Company may claim damages.`,
  },
  {
    slug: "intellectual-property",
    title: "16. Intellectual Property, Trade Secrets and Confidentiality",
    content: `16.1 Why this matters
Our software, designs, methods and know-how are the Company's most valuable assets, along with its customers' trust. They are protected by the Intellectual Property Code (RA 8293), the Civil Code, the Revised Penal Code (Article 292, revelation of industrial secrets), the Data Privacy Act, and by contract. Disclosing or taking them can lead to dismissal, damages, and criminal prosecution.

16.2 What is Confidential Information
Everything that is not public and that the Company or a customer or partner treats as confidential, including: source code, object code, algorithms, architecture, designs, specifications, test data, product plans and roadmaps; network diagrams, configurations, credentials, security findings and vulnerabilities; customer and supplier lists, contracts, pricing, proposals and margins; financial, tax, legal and strategic information; employee and Personal Data; and information received from customers and partners under an NDA.

16.3 Your duty of confidentiality
(a) Use Confidential Information only for the Company's business and as your job requires.
(b) Do not disclose it to anyone outside the Company, or to anyone inside who does not need it, unless authorized.
(c) Do not copy, download, photograph, forward or store it outside Company Systems.
(d) Do not use it for your own benefit, for another employer or for any other business, during or after employment.
(e) This duty lasts while you work for the Company and after, for as long as the information stays confidential. For trade secrets, it has no end date.
(f) The duty does not stop you from reporting a crime or a legal violation to a government authority, giving testimony when the law requires it, or exercising a right that the law protects. Tell Legal before disclosing under a legal order, when the law allows.

16.4 Company ownership of work
(a) All work you create for the Company belongs to the Company: software, source and object code, documentation, designs, inventions, data, configurations, databases, reports, trademarks, domain names and other work, including drafts and ideas ("Work Product").
(b) This applies to work that is (i) part of your regular duties, (ii) assigned to you, (iii) created with Company time, equipment, facilities, information or money, or (iv) related to the Company's business or its research, even if done outside working hours.
(c) By signing this Handbook and your IP assignment agreement, you assign to the Company, to the fullest extent allowed by law, all rights, titles and interests in Work Product, and agree to sign any document and do any act that is needed to record, register or enforce the Company's rights. Under the Intellectual Property Code, a work created in the course of regularly assigned duties belongs to the employer unless there is a contrary agreement, and the written assignment makes ownership clear for all work described in (b).
(d) You waive any claim to moral rights, to the extent that the law allows, and agree that the Company may change, adapt and use Work Product without credit.
(e) Pre-existing work: list in writing, before you start, any software or work that you own and want to exclude. If you use pre-existing work in Company Work Product, you grant the Company a perpetual, worldwide, royalty-free license to use it.

16.5 Customer ownership
Where a customer contract says that the customer owns the deliverables, the Company's rights are passed on as the contract says. Our tools, libraries, methods and know-how that we had before, or that are not specific to the customer, remain the Company's unless the contract clearly says otherwise. Only authorized contract signatories may agree to a change.

16.6 Trade secrets and code security
Source code and critical design documents are Restricted. They are kept only in approved repositories, never on personal devices or accounts, never posted to public sites (including public code repositories, forums and AI tools), and never shared with anyone outside the Company without a signed agreement and approval.

16.7 Open source
Use of open-source software is allowed only under licenses that the Company has approved. Do not mix code under strong copyleft licenses (for example GPL or AGPL) into proprietary products, and do not publish Company code as open source, without Legal's approval. Keep a record of the components and licenses that you use. Contributions to outside open-source projects during work time or using Company information need prior approval.

16.8 Third-party intellectual property
Respect other people's rights. Do not use or copy software, images, fonts, text, data or code that you are not licensed to use. Do not bring confidential information or code from a former employer or any other party. If you are unsure whether you may use something, ask Legal.

16.9 Inventions and patents
You must promptly disclose to the Company any invention, improvement or discovery connected with the Company's business. The Company decides whether to file for protection, at its cost, and you give the help that it needs.

16.10 Returning and not keeping material
On request or on separation, return all Confidential Information, Work Product and copies, and delete any copies on personal devices and accounts, with written confirmation. Do not keep any copy of source code, customer data, credentials, contracts or customer lists.

16.11 Non-solicitation and fair competition after employment
For the period stated in your agreement, which is reasonable in time, place and scope, you will not: (a) solicit or deal with customers that you served or about whom you obtained Confidential Information, in a way that uses that information; or (b) induce employees or contractors of the Company to leave. A restriction on working for a competitor applies only if it is in your written agreement, and only to the extent that it is reasonable and allowed by law.

16.12 Remedies
The Company may seek court orders (injunctions), damages, the return of property and profits, and may file criminal complaints for breach of these duties. The Company's rights under this chapter are in addition to any other right it has under the law. They survive the end of your employment.`,
  },
  {
    slug: "service-delivery",
    title: "17. Delivering Software, Cloud, Server, Hardware and Network Services",
    content: `17.1 Purpose
How we deliver our services decides whether customers can trust us, and how much risk the Company carries. These standards apply to every project and service.

17.2 Contracts and scope first
(a) Do not start paid work, give access, or make promises without a signed contract or an approved work order that states scope, deliverables, schedule, price, acceptance, support, service levels, liability and data protection terms.
(b) Only authorized signatories sign (Chapter 23). Do not make verbal or email promises beyond the contract.
(c) Changes in scope go through a written change request, with its price and schedule effect, approved before the work begins.
(d) Record customer approvals, acceptance and sign-offs in writing and keep them.

17.3 Software development
- Follow the Company's development life cycle: requirements, design, secure coding, peer review, testing (unit, integration, security and acceptance), release approval, deployment and support.
- Use version control for everything, including infrastructure code. Write meaningful commit messages and keep the history.
- Keep documentation current: architecture, setup, operations, known issues and user guides.
- Test before release. Do not release software with known critical defects or security flaws without written risk acceptance by the product owner and the Information Security Lead.
- Respect licenses and keep a software bill of materials.
- Do not leave back doors, hard-coded credentials, hidden functions, test accounts or data collection that is not in the specification.

17.4 Cloud services
- Design for security and resilience: least-privilege roles, MFA, network segmentation, encryption at rest and in transit, logging, backups, multi-zone design where the SLA needs it.
- Use infrastructure as code and review changes. Tag resources with an owner, customer and environment. Keep production and non-production accounts separate.
- Understand the shared responsibility model: the cloud provider secures the platform; we and the customer secure what we configure and the data.
- Control costs: set budgets and alerts, and turn off unused resources.
- Keep Customer Data only in the regions and services that the contract allows.

17.5 Servers, hosting and data centers
- Build servers from hardened, documented baselines. Remove default accounts and unneeded services.
- Patch on schedule (Section 14.12). Monitor capacity, health and security events around the clock for services that need it.
- Use maintenance windows and notify customers in advance of planned downtime, as the contract requires.
- Keep an inventory of servers, owners, versions and licenses.
- Protect racks and server rooms physically, and keep access and environmental logs.
- Do the backup and restore tests that the contract requires and keep the evidence.

17.6 Hardware
- Buy from authorized and reputable sources, avoid counterfeit and gray-market equipment, and keep invoices, warranties and serial numbers.
- Tag and record each asset (location, owner, status). Count and check the inventory at least yearly.
- Equipment that is repaired, returned (RMA) or resold is wiped of data first, using a recognized method, and the wipe is recorded.
- Dispose of electronic waste only through DENR-accredited handlers, consistent with RA 6969 and related rules, and with certificates of disposal. Storage media that held Confidential data are destroyed or securely wiped before they leave our control.
- Radio and wireless equipment must have the NTC type approval or permit where required.

17.7 Networks
- Design networks with segmentation, redundancy, secure management (separate management network, MFA, no default credentials, encrypted protocols such as SSH and HTTPS), and documented configurations.
- Keep up-to-date network diagrams, IP plans and configuration backups. Treat them as Confidential.
- Make changes through change control with a rollback plan, in agreed windows.
- Monitor availability, performance and security. Keep logs as required (Chapter 19).
- Operate only under the licenses, registrations and permits that apply, and follow NTC and DICT rules.

17.8 Working in customer environments
- Work only on the systems and accounts that you were authorized to touch, within the written scope.
- Follow the customer's security and site rules in addition to ours. Protect the customer's data as if it were ours.
- Use Company-provided accounts, and never keep the customer's credentials in personal notes or chat. Return or delete them at the end.
- Do not take or copy customer data except as the contract allows. Never use customer systems for your own tests, or personal use.
- Report any incident or discovery of a problem to the customer promptly and as the contract requires, through the Company's agreed channel.

17.9 Service levels, incidents and communication
- Know the service levels in your contract and meet them. Record incidents and their causes, and report them to the customer on time.
- Be factual, timely and clear in customer communication. Do not blame others or speculate. Do not admit liability in writing or orally unless authorized.
- After a major incident, carry out a blameless review, record the lessons and track the fixes.

17.10 Quality and records
Keep records of design decisions, approvals, tests, deployments, incidents and support, as evidence of what was done and why. These records protect the Company and our customers.

17.11 Warranties, liability and statements
Do not give warranties, guarantees, performance claims or compatibility claims that are not in the approved contract or documentation. Do not state that a product or service is "100% secure", "unhackable", or "guaranteed". Marketing and sales claims must be accurate and approved.`,
  },
  {
    slug: "digital-security-services",
    title: "18. Digital Security Services: Authorization, Ethics and the Law",
    content: `18.1 Why this chapter exists
Our digital security work gives us powerful access and skills. The same acts that protect a customer can be crimes when done without permission. The Cybercrime Prevention Act (RA 10175) punishes illegal access, illegal interception, data interference, system interference, misuse of devices, computer-related fraud and identity theft. The Anti-Wiretapping Act (RA 4200) and the Data Privacy Act also apply. Authorization, scope and ethics are what separate our work from a crime.

18.2 No authorization, no work
(a) Never scan, probe, test, access, intercept or try to break any system, network, account, application or device unless you have written authorization from the system owner, signed by a person who has the authority to give it, and approved by the Company.
(b) The authorization (rules of engagement) must state: who the owner is, what is in scope and what is not, the dates and times, the methods allowed and forbidden, the contacts for emergencies, how data will be handled, and who receives the results.
(c) Stay inside the scope. If you find something out of scope or something unexpected, stop and tell your lead.
(d) Authorization from a customer's employee who does not own the system, or by chat or by phone only, is not enough.
(e) Testing of third-party systems that the customer uses (for example, a cloud provider or a software-as-a-service vendor) needs the provider's permission and compliance with their rules.

18.3 Conduct rules
- Do no harm: avoid denial of service, data loss and disruption unless the contract expressly allows and the customer accepts the risk. Have a backup and rollback.
- Minimize the data you touch. If you encounter Personal Data, access only what you must, do not copy it unless needed as evidence, and handle it under Chapter 13.
- Do not exploit, keep, sell or disclose vulnerabilities, credentials or data you find. Report them only to the customer through the agreed channel.
- Do not use customer findings or data for marketing, research or publication without written permission, and without removing identifying data.
- Do not take part in offensive activity, surveillance, stalking, doxxing, malware creation or distribution, or credential theft, outside an authorized and lawful engagement.
- Do not intercept communications. Network monitoring and security tools may only capture traffic that is covered by the customer's lawful authority, the contract and the law.

18.4 Tools and lab
Security tools (scanners, exploit frameworks, packet capture, password-cracking tools) are dual-use. They are kept in controlled environments, used only for authorized work, licensed, and logged. Testing is done from Company-managed systems, not personal devices. Malware samples are handled only in isolated labs with approved procedures.

18.5 Evidence and incident response
When you respond to an incident or collect evidence: keep a record of who did what and when; preserve the original data and work on copies; keep a chain of custody; do not change the evidence; and keep findings confidential and shared on a need-to-know basis. Contact Legal before you hand anything to law enforcement or anyone else.

18.6 Vulnerability handling
Report vulnerabilities in the Company's own products through the vulnerability disclosure procedure. When we find a vulnerability in someone else's product while doing authorized work, we report it to the customer, and any wider disclosure follows the contract, coordinated disclosure practice and the law. Do not publish or sell findings.

18.7 Customer security data
Reports, scan results, logs, credentials and architecture details that we obtain for a customer are Restricted and the customer's property. They are stored in protected, access-controlled locations, shared only with authorized recipients, and deleted or returned at the end of the contract as agreed.

18.8 Conflicts of interest
Do not do security work for a customer where you have a personal interest or relationship that could affect your independence, without disclosure and approval. Do not offer or accept anything of value that could influence a security assessment or its results.

18.9 Competence and truthfulness
Take only work that you are qualified to do and that the Company has agreed to deliver. Report results honestly, including what we could not test. Do not exaggerate threats to sell services, and do not claim certifications, credentials or capabilities that you do not have.

18.10 Consequences
Testing without authorization, going beyond scope, misusing access, or disclosing customer security data is a grave offense, and may also be a crime. The Company may report it to the authorities and claim damages from the person responsible.`,
  },
  {
    slug: "wifi-network-services",
    title: "19. Wi-Fi and Network Services: Standards and Legal Duties",
    content: `19.1 Scope
This chapter covers the Wi-Fi and network used by the Company itself, and the Wi-Fi and network services that we design, install, run or support for customers.

19.2 Company Wi-Fi
(a) Staff Wi-Fi uses strong authentication (WPA3 or WPA2-Enterprise with 802.1X and individual credentials, where possible). Shared passwords are not used for staff networks.
(b) Guest Wi-Fi is separate from the staff network and from servers. Guests cannot reach internal systems. It has bandwidth limits, content filtering where appropriate, and accepted terms of use.
(c) Devices are registered or enrolled before they join the staff network. Unmanaged devices go to the guest network.
(d) Only IT installs and manages access points. Unauthorized or "rogue" access points, hotspots and routers are removed.
(e) Wi-Fi is monitored for rogue devices, attacks and misuse. Radio settings are optimized (channels and power), and areas are surveyed.

19.3 Standards for customer Wi-Fi and network projects
- Do a survey and design before installing, and write the design, bill of materials, IP plan and test plan.
- Use secure defaults: no default passwords, current firmware, management over encrypted protocols, management network separated, unused services and ports disabled, SSIDs and VLANs that match the design, and segmentation for guest, staff, IoT and payment systems.
- Test and document the results: coverage, speed, roaming, failover and security. Give the customer the as-built documents and the credentials by a secure method.
- Make clear in the contract who is responsible for what: maintenance, monitoring, firmware, support hours and response times.
- Do not collect or look at the customer's users' traffic, except as the contract states and the law allows.

19.4 Legal duties of an internet or network service provider
Where the Company provides internet access, hosting or other services to the public or to customers:
(a) Licenses and permits: keep the licenses, registrations, permits and type approvals required by the NTC, the DICT and other agencies, and use frequencies and equipment only as authorized (Public Telecommunications Policy Act, Radio Control Law and related rules).
(b) Preservation of data: when required by law, preserve traffic data and subscriber information for the period that the Cybercrime Prevention Act requires (at least six (6) months), and preserve content data when a law enforcement order requires it. Only Legal and the DPO may handle such orders.
(c) Disclosure only on lawful order: do not give customer data or traffic to anyone, including police, without verifying a valid legal order, such as a court warrant, and referring it to Legal. The Anti-Wiretapping Act and the Data Privacy Act forbid unauthorized interception and disclosure.
(d) Data privacy: logs and customer registration data are Personal Data. Collect only what is needed, secure it, keep it only as long as needed, and tell customers in a privacy notice.
(e) SIM-based and registration services: follow the SIM Registration Act and the rules of the NTC where they apply.
(f) Acceptable use for customers: customer contracts must include acceptable use terms, and the right to suspend service for illegal activity, abuse or security risk, after due notice as the contract provides.
(g) Takedown and abuse handling: handle complaints about illegal content or abuse through the Legal function and the abuse process.

19.5 Network operations
- Monitoring: monitor uptime, performance, capacity and security around the clock for services that require it. Alert and escalate by the runbook.
- Changes: use change control. Back up the configuration before changes. Apply a rollback plan.
- Outages: follow the incident process, communicate with affected customers promptly, record the cause, and review it.
- Security: apply the controls in Chapter 14, including filtering, protection against denial-of-service attacks, secure routing and management access, and logging.

19.6 What you must not do
- Do not capture, record or view the content of customers' or employees' communications, except as an authorized and lawful part of the work and subject to Chapters 13 and 18.
- Do not change a customer's network, Wi-Fi password or device settings without a ticket or authorization.
- Do not share Wi-Fi passwords or network details with anyone not authorized.
- Do not use customer Wi-Fi or network access for personal purposes.
- Do not use Company or customer networks for illegal activity.

19.7 Records
Keep network diagrams, configurations, change records, incident records and test results. They are Confidential and kept as Chapter 25 requires.`,
  },
  {
    slug: "health-safety-environment",
    title: "20. Health, Safety and Environment (RA 11058)",
    content: `20.1 Policy
The Company provides a safe and healthy workplace, and every worker has the right to be safe at work. We follow the Occupational Safety and Health Standards Law (RA 11058), its Implementing Rules (DOLE Department Order 198-18) and the Occupational Safety and Health Standards.

20.2 Responsibilities
- The Company provides a safe workplace, an OSH program, safety officers, a safety and health committee, protective equipment, training, medical and first aid, and reports to DOLE as required.
- Supervisors enforce safety rules and stop unsafe work.
- Workers follow the rules, use protective equipment, report hazards, accidents and illnesses, and take part in drills and training. Workers have the right to know the hazards, to be trained, to report to the authorities, and to refuse unsafe work where there is imminent danger, as the law provides, and without punishment.

20.3 OSH program and training
The Company has a written OSH program, a trained safety officer (according to the size and risk of the workplace), and a safety and health committee. Every worker takes the mandatory eight-hour basic OSH orientation, and further training for their job. Contractors and visitors are told of the rules.

20.4 Hazards specific to our work
- Offices: ergonomics (workstation, posture, screen breaks), slips and trips, cables, fire exits.
- Server rooms and data centers: electrical hazards, noise, heat, cold, fire suppression gases (know the alarm and the exit), heavy equipment, restricted access, lifting.
- Field work (poles, towers, rooftops, ceilings, ducts, trenches): working at heights needs a harness, anchor points and training; ladders must be inspected and used properly; electrical lockout and tagout; protective gear; do not work alone in dangerous areas; look for overhead lines and underground utilities; stop work in lightning, strong wind or heavy rain.
- Fiber and lasers: never look into the end of a live fiber or a laser; use eye protection and approved tools.
- Confined spaces and manholes: no entry without a permit, gas testing, ventilation and a standby person.
- Vehicles: only licensed and authorized drivers, seat belts, no phone use while driving, vehicle checks.
- Batteries, UPS and chemicals: handle and store as the safety data sheet says.
- Lifting: use proper technique and equipment; get help for heavy items.

20.5 Protective equipment
The Company provides required protective equipment free of charge for hazardous work. You must wear and take care of it, and report damage. Not wearing required equipment is a violation.

20.6 Accidents, injuries and illness
Report every accident, injury, near miss and work-related illness to your supervisor at once. Give first aid and call for emergency help. The Company investigates, finds the causes, takes action, and reports to DOLE and other agencies using the required forms and deadlines. No worker is punished for reporting in good faith.

20.7 Fire, earthquake and emergencies
Know the exits, assembly areas, fire extinguishers and first-aid stations. Take part in drills. In an alarm, stop work, leave calmly by the nearest safe exit, and go to the assembly area. Do not use elevators in a fire. Do not go back for belongings. Wait for the all-clear.

20.8 Health programs
The Company supports annual health checks and programs for health and wellness as policy provides, and follows the rules on mental health (RA 11036), HIV and AIDS (RA 11166), tuberculosis, hepatitis B, and a drug-free workplace (RA 9165), as set out in Chapter 10.

20.9 Environment
Reduce waste and energy use. Dispose of electronic waste, batteries and other hazardous waste only through accredited handlers (RA 6969, RA 9003 and DENR rules), with records. Do not dump electronic equipment in ordinary trash.

20.10 Weather and calamity
When there is a typhoon, flood, earthquake, outage or other calamity, your safety comes first. Follow the Company's announcements and work-suspension rules, which follow government and DOLE advisories. Tell your supervisor of your status and keep the Company informed. Critical services follow the continuity plan (Chapter 29), and no employee is required to risk their life.`,
  },
  {
    slug: "company-property",
    title: "21. Company Property, Expenses, Travel and Vehicles",
    content: `21.1 Company property
Company property includes devices, tools, equipment, vehicles, cards, tokens, keys, supplies, software and data. It is given to you to do your work, and you are accountable for it.

21.2 Your responsibilities
- Sign the property or asset issuance form when you receive property. Use it only for business, take care of it, and keep it secure. Never lend it.
- Report loss, theft or damage at once (and to Security if it holds data).
- Return it when you no longer need it, on request or when you leave.
- Do not alter, repair, sell, pawn or dispose of Company property.

21.3 Loss and damage
If property is lost or damaged because of your negligence or wrongdoing, the Company may require you to pay or replace it, after an investigation that gives you a chance to explain. Deductions from wages follow Section 6.3 and the law, and are not made without your written authorization or a lawful basis.

21.4 Expenses and reimbursement
- Spend carefully, only for business, and within approved budgets.
- Get approval before large or unusual expenses.
- Submit claims promptly with official receipts and a clear business purpose. Do not claim personal expenses, split a purchase to avoid approval, or alter receipts: it is fraud.
- Cash advances must be liquidated by the due date. Unliquidated amounts may be deducted from pay as you have agreed or the law allows.

21.5 Travel
Business travel needs approval in advance. Follow the travel policy on class, hotel, per diem and booking. Protect devices and data while traveling: carry laptops as hand baggage, use a privacy screen, avoid public charging ports and public Wi-Fi without the VPN. For high-risk destinations, ask Security before you go.

21.6 Company vehicles
Only authorized, licensed drivers may drive Company vehicles, only for business, and following traffic laws. Traffic fines for violations are the driver's responsibility. Report accidents at once.

21.7 Purchases and vendors
Purchases follow the procurement policy: written requests, approvals, competitive quotations above the limits, and conflict-of-interest checks. Do not order, sign or commit to a supplier unless you are authorized.

21.8 Property inspection
The Company may inspect Company property, lockers, vehicles and Company-issued devices, in line with Chapter 26, and with respect to your dignity and rights.`,
  },
  {
    slug: "anti-corruption-fair-dealing",
    title: "22. Anti-Bribery, Anti-Corruption and Fair Dealing",
    content: `22.1 Policy
The Company wins business on merit. We do not bribe, take bribes, or help anyone else to do so, anywhere and with anyone, in the private or the public sector.

22.2 What is prohibited
- Offering, giving, asking for or accepting money, gifts, favors, commissions, kickbacks, hospitality or anything of value to influence a business or official decision, or to get an improper advantage.
- Facilitation payments (small payments to speed up routine government action).
- Using a third party (agent, consultant, reseller) to do any of these.
- Falsifying books, records or invoices to hide a payment or its purpose.
- Fixing prices, bid-rigging, dividing markets or customers, or sharing competitively sensitive information with competitors, which breach the Philippine Competition Act (RA 10667).

22.3 Dealing with government
Dealings with public officials and employees are strictly regulated by the Anti-Graft and Corrupt Practices Act (RA 3019), the Code of Conduct and Ethical Standards for Public Officials and Employees (RA 6713), the Revised Penal Code on bribery, and the procurement rules (RA 12009). Do not give any gift, meal, entertainment, travel or favor to a public official or their relative without approval from Legal. Follow the rules of the procurement process. Never offer or promise a job, contract or benefit to influence a decision. Make sure that agents and partners agree to follow these rules.

22.4 Gifts and hospitality
Follow Section 9.6, and register gifts above the limit. Never give or accept cash. Anything given or accepted must be modest, infrequent, transparent and legal.

22.5 Fair competition and accurate selling
Compete honestly: do not give false or misleading information about competitors, our own products, security claims or capabilities. Do not obtain a competitor's confidential information improperly, or use confidential information of a former employer.

22.6 Money laundering and sanctions
Know your customers and partners. Do not accept payments from, or deal with, anyone you suspect of using the Company to hide the proceeds of crime. Report suspicious transactions to Legal or Finance. Follow the Anti-Money Laundering Act (RA 9160, as amended) where it applies, and applicable sanctions and export-control laws.

22.7 Records and reporting
Keep accurate books and records. Every payment must be properly authorized, recorded and supported. Report any request for a bribe or a suspected violation at once through the channels in Section 9.10. No one is punished for refusing to pay a bribe, even if it costs the Company business.

22.8 Consequences
Violations lead to dismissal and may lead to criminal prosecution of the individuals and the Company.`,
  },
];
