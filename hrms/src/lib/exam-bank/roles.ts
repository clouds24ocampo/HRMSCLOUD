// What each starter position is about, in English and Tagalog: a one-line summary and five duties.
// Shown to applicants on the careers page and in the applicant portal. Each pair is [English, Tagalog].
export type RoleInfo = { summary: [string, string]; duties: [string, string][] };

export const ROLE_INFO: Record<string, RoleInfo> = {
  "Software Engineer: Front End": {
    summary: ["Build the screens people use: fast, accessible web interfaces for our products.", "Gumagawa ng mga screen na ginagamit ng mga tao: mabilis at madaling gamitin na web interface para sa aming mga produkto."],
    duties: [
      ["Turn designs into responsive web pages using HTML, CSS and JavaScript.", "Gawing responsive na web page ang mga disenyo gamit ang HTML, CSS at JavaScript."],
      ["Build reusable components with a modern framework such as React.", "Gumawa ng mga component na magagamit muli gamit ang modernong framework tulad ng React."],
      ["Connect screens to the back end through APIs.", "Ikonekta ang mga screen sa back end sa pamamagitan ng API."],
      ["Make pages fast, accessible and working on all devices and browsers.", "Gawing mabilis, madaling gamitin ng lahat at gumagana sa lahat ng device at browser ang mga page."],
      ["Test your work, fix bugs and take part in code reviews.", "I-test ang trabaho, ayusin ang mga bug at makilahok sa code review."],
    ],
  },
  "Software Engineer: Back End": {
    summary: ["Build the services, APIs and databases behind our products.", "Gumagawa ng mga serbisyo, API at database na nasa likod ng aming mga produkto."],
    duties: [
      ["Design and build secure, reliable APIs.", "Magdisenyo at gumawa ng ligtas at maaasahang mga API."],
      ["Design database tables and write efficient queries.", "Magdisenyo ng mga database table at magsulat ng mabilis na query."],
      ["Handle login, permissions and protection of user data.", "Asikasuhin ang login, mga pahintulot at proteksyon ng datos ng user."],
      ["Find and fix performance problems and errors in production.", "Hanapin at ayusin ang mga problema sa bilis at mga error sa production."],
      ["Write automated tests and document how the services work.", "Sumulat ng automated test at i-document kung paano gumagana ang mga serbisyo."],
    ],
  },
  "Software Engineer: Full Stack": {
    summary: ["Work across the whole product, from the screen to the server and database.", "Gumagawa sa buong produkto, mula sa screen hanggang sa server at database."],
    duties: [
      ["Build features end to end: interface, API and database.", "Buuin ang mga feature mula simula hanggang dulo: interface, API at database."],
      ["Choose simple, maintainable solutions for each part of the system.", "Pumili ng simple at madaling panatilihing solusyon para sa bawat bahagi ng sistema."],
      ["Fix problems wherever they are in the system.", "Ayusin ang mga problema saan man ito sa sistema."],
      ["Work with designers, testers and other developers.", "Makipagtulungan sa mga designer, tester at iba pang developer."],
      ["Review code and help release new versions safely.", "Mag-review ng code at tumulong sa ligtas na paglabas ng mga bagong bersyon."],
    ],
  },
  "Software Engineer: DevOps": {
    summary: ["Automate how we build, release and run our systems, and keep them reliable and secure.", "I-automate kung paano namin binubuo, inilalabas at pinapatakbo ang aming mga sistema, at panatilihin itong maaasahan at ligtas."],
    duties: [
      ["Build and maintain automated build, test and deployment pipelines (CI/CD).", "Bumuo at mag-maintain ng automated na build, test at deployment pipeline (CI/CD)."],
      ["Manage servers and cloud resources with code (infrastructure as code).", "Pamahalaan ang mga server at cloud resource gamit ang code (infrastructure as code)."],
      ["Monitor systems, set alerts and respond when something fails.", "Magmonitor ng mga sistema, mag-set ng alert at tumugon kapag may pumalya."],
      ["Manage backups, secrets and access so data stays safe.", "Pamahalaan ang mga backup, secret at access para manatiling ligtas ang datos."],
      ["Help developers release faster with fewer problems.", "Tulungan ang mga developer na maglabas ng bagong bersyon nang mas mabilis at mas kaunti ang problema."],
    ],
  },
  "Mobile App Developer": {
    summary: ["Build and maintain the Android and iOS apps people carry in their pockets.", "Gumagawa at nag-aalaga ng mga Android at iOS app na dala ng mga tao sa kanilang bulsa."],
    duties: [
      ["Build app screens and features for Android, iOS or both.", "Gumawa ng mga screen at feature ng app para sa Android, iOS o pareho."],
      ["Connect the app to our servers and keep data working even offline.", "Ikonekta ang app sa aming server at panatilihing gumagana ang datos kahit offline."],
      ["Make the app fast, battery-friendly and easy to use on different phones.", "Gawing mabilis, matipid sa baterya at madaling gamitin ang app sa iba't ibang phone."],
      ["Fix crashes found in reports and test on real devices.", "Ayusin ang mga crash mula sa report at mag-test sa totoong device."],
      ["Publish updates to the app stores.", "Mag-publish ng mga update sa app store."],
    ],
  },
  "QA Engineer (Software Tester)": {
    summary: ["Make sure every release works well before it reaches our users.", "Tiyaking maayos ang bawat release bago ito makarating sa aming mga user."],
    duties: [
      ["Write and run test cases for new features and fixes.", "Sumulat at magpatakbo ng mga test case para sa mga bagong feature at ayos."],
      ["Report bugs clearly with the steps to reproduce them.", "Iulat nang malinaw ang mga bug kasama ang mga hakbang para ito ay maulit."],
      ["Retest fixes and check that old features still work (regression).", "I-retest ang mga ayos at tiyaking gumagana pa rin ang mga lumang feature (regression)."],
      ["Build automated tests for repetitive checks.", "Gumawa ng automated test para sa paulit-ulit na pagsusuri."],
      ["Work with developers and the business to define when a feature is ready.", "Makipagtulungan sa mga developer at sa negosyo para linawin kung kailan handa na ang isang feature."],
    ],
  },
  "UI/UX Designer": {
    summary: ["Design products that are easy, clear and pleasant to use.", "Nagdidisenyo ng mga produktong madali, malinaw at kaaya-ayang gamitin."],
    duties: [
      ["Talk to users to understand their needs and problems.", "Kausapin ang mga user para maunawaan ang kanilang pangangailangan at problema."],
      ["Create user flows, wireframes and interactive prototypes.", "Gumawa ng user flow, wireframe at interactive na prototype."],
      ["Design clean screens that follow our design system and accessibility rules.", "Magdisenyo ng malinis na screen na sumusunod sa aming design system at mga patakaran sa accessibility."],
      ["Test designs with real users and improve them.", "I-test ang mga disenyo sa totoong user at pagbutihin ito."],
      ["Hand over designs to developers and check the final result.", "Ibigay ang mga disenyo sa mga developer at suriin ang pinal na resulta."],
    ],
  },
  "Data Analyst": {
    summary: ["Turn company data into clear answers that help us make decisions.", "Ginagawang malinaw na sagot ang datos ng kumpanya para makatulong sa pagpapasya."],
    duties: [
      ["Collect and clean data from different sources.", "Mangolekta at maglinis ng datos mula sa iba't ibang pinagmulan."],
      ["Write SQL queries and analyze trends and patterns.", "Sumulat ng SQL query at suriin ang mga trend at pattern."],
      ["Build dashboards and reports for managers.", "Gumawa ng dashboard at ulat para sa mga manager."],
      ["Explain findings in plain language and recommend actions.", "Ipaliwanag ang mga natuklasan sa simpleng salita at magrekomenda ng aksyon."],
      ["Check that data is accurate and protect private information.", "Tiyaking tama ang datos at protektahan ang pribadong impormasyon."],
    ],
  },
  "Database Administrator": {
    summary: ["Keep our databases fast, secure and always recoverable.", "Pinananatiling mabilis, ligtas at laging mababawi ang aming mga database."],
    duties: [
      ["Install, configure and update database systems.", "Mag-install, mag-configure at mag-update ng mga database system."],
      ["Run and test backups and restores.", "Magpatakbo at mag-test ng mga backup at restore."],
      ["Tune slow queries and manage indexes.", "Ayusin ang mabagal na query at pamahalaan ang mga index."],
      ["Control who can access which data.", "Kontrolin kung sino ang may access sa anong datos."],
      ["Monitor health, plan capacity and handle database incidents.", "Magmonitor ng kalusugan ng sistema, magplano ng kapasidad at asikasuhin ang mga insidente sa database."],
    ],
  },
  "Cybersecurity Analyst": {
    summary: ["Protect our systems and data from attacks and mistakes.", "Pinoprotektahan ang aming mga sistema at datos laban sa mga atake at pagkakamali."],
    duties: [
      ["Monitor alerts and logs to spot suspicious activity.", "Magmonitor ng mga alert at log para makita ang kahina-hinalang gawain."],
      ["Scan for weaknesses and follow up on fixes.", "Mag-scan ng mga kahinaan at tiyaking naaayos ito."],
      ["Respond to security incidents and write down what was learned.", "Tumugon sa mga insidente sa seguridad at itala ang mga natutunan."],
      ["Review access rights and security settings.", "Suriin ang mga access right at security setting."],
      ["Train staff to avoid phishing and follow the Data Privacy Act.", "Sanayin ang mga empleyado na iwasan ang phishing at sundin ang Data Privacy Act."],
    ],
  },
  "IT Support Specialist": {
    summary: ["Be the first line of help for staff with computers, accounts and tools.", "Unang tumutulong sa mga empleyado sa kanilang computer, account at mga gamit."],
    duties: [
      ["Answer tickets and calls and solve everyday technical problems.", "Sagutin ang mga ticket at tawag at ayusin ang pang-araw-araw na problemang teknikal."],
      ["Set up laptops, phones, printers and user accounts.", "Mag-set up ng laptop, telepono, printer at account ng user."],
      ["Reset passwords after confirming the person's identity.", "Mag-reset ng password matapos tiyakin ang pagkakakilanlan ng tao."],
      ["Keep an inventory of equipment and software licenses.", "Magtala ng imbentaryo ng kagamitan at lisensya ng software."],
      ["Escalate hard problems with clear notes and explain solutions simply.", "I-escalate ang mahihirap na problema na may malinaw na tala at ipaliwanag nang simple ang solusyon."],
    ],
  },
  "Systems Administrator": {
    summary: ["Run our servers and internal systems so everything stays available.", "Pinapatakbo ang aming mga server at panloob na sistema para laging magamit."],
    duties: [
      ["Install, patch and monitor servers (Linux and Windows).", "Mag-install, mag-patch at magmonitor ng mga server (Linux at Windows)."],
      ["Manage users, groups and permissions.", "Pamahalaan ang mga user, grupo at pahintulot."],
      ["Run backups and test restores.", "Magpatakbo ng backup at mag-test ng restore."],
      ["Automate routine tasks with scripts.", "I-automate ang mga regular na gawain gamit ang script."],
      ["Document systems and respond to outages.", "I-document ang mga sistema at tumugon sa mga outage."],
    ],
  },
  "Cloud Engineer": {
    summary: ["Design and run our cloud infrastructure so it is secure, scalable and cost-aware.", "Nagdidisenyo at nagpapatakbo ng aming cloud infrastructure na ligtas, kayang lumaki at matipid."],
    duties: [
      ["Build cloud networks, servers and storage with code (such as Terraform).", "Bumuo ng cloud network, server at storage gamit ang code (tulad ng Terraform)."],
      ["Set up scaling, load balancing and availability across zones.", "Mag-set up ng scaling, load balancing at availability sa maraming zone."],
      ["Control access with least-privilege roles and encryption.", "Kontrolin ang access gamit ang mga role na minimum lamang ang pahintulot at encryption."],
      ["Watch costs and remove waste.", "Bantayan ang gastos at tanggalin ang aksaya."],
      ["Plan backups and disaster recovery.", "Magplano ng backup at disaster recovery."],
    ],
  },
  "Business Analyst (IT)": {
    summary: ["Connect the business with the technical team by defining what needs to be built.", "Nag-uugnay sa negosyo at sa technical team sa pamamagitan ng paglilinaw kung ano ang bubuuin."],
    duties: [
      ["Gather requirements by interviewing users and managers.", "Mangalap ng requirements sa pamamagitan ng pakikipanayam sa mga user at manager."],
      ["Write user stories and acceptance criteria.", "Sumulat ng user story at acceptance criteria."],
      ["Map business processes and find improvements.", "I-map ang mga proseso ng negosyo at humanap ng pagpapabuti."],
      ["Support testing and user acceptance before release.", "Suportahan ang testing at user acceptance bago ang release."],
      ["Manage change requests with stakeholders.", "Pamahalaan ang mga hiling na pagbabago kasama ang mga stakeholder."],
    ],
  },
  "IT Project Manager": {
    summary: ["Lead IT projects from plan to delivery, on time and within budget.", "Pinamumunuan ang mga proyektong IT mula plano hanggang maihatid, nasa oras at nasa badyet."],
    duties: [
      ["Define scope, schedule, budget and milestones.", "Itakda ang saklaw, iskedyul, badyet at mga milestone."],
      ["Lead the team using Agile practices like sprints and daily standups.", "Pamunuan ang team gamit ang Agile tulad ng sprint at daily standup."],
      ["Track risks and issues and decide how to respond.", "Subaybayan ang mga panganib at isyu at magpasya kung paano tutugon."],
      ["Report progress to stakeholders honestly and regularly.", "Mag-ulat ng progreso sa mga stakeholder nang tapat at regular."],
      ["Review lessons learned after each project.", "Repasuhin ang mga natutunan pagkatapos ng bawat proyekto."],
    ],
  },
  "Network Administrator": {
    summary: ["Design, secure and maintain our office and site networks.", "Nagdidisenyo, nagsisiguro at nag-aalaga ng aming office at site network."],
    duties: [
      ["Configure switches, routers, Wi-Fi and VLANs.", "Mag-configure ng switch, router, Wi-Fi at VLAN."],
      ["Manage IP addressing, DNS and DHCP.", "Pamahalaan ang IP addressing, DNS at DHCP."],
      ["Set up firewall rules and VPN access.", "Mag-set up ng firewall rules at VPN access."],
      ["Monitor network traffic and fix outages.", "Magmonitor ng trapiko ng network at ayusin ang mga outage."],
      ["Keep network diagrams and device configurations backed up.", "Panatilihing may backup ang mga network diagram at configuration ng device."],
    ],
  },
  "Safety Officer": {
    summary: ["Keep workers safe and the company compliant with occupational safety and health rules (RA 11058).", "Pinananatiling ligtas ang mga manggagawa at sumusunod ang kumpanya sa mga patakaran sa kaligtasan at kalusugan sa trabaho (RA 11058)."],
    duties: [
      ["Inspect the workplace and identify hazards before accidents happen.", "Siyasatin ang lugar ng trabaho at tukuyin ang mga panganib bago may maaksidente."],
      ["Lead safety orientations and toolbox talks.", "Manguna sa mga safety orientation at toolbox talk."],
      ["Check that workers use the proper protective equipment (PPE).", "Tiyaking tama ang gamit na protective equipment (PPE) ng mga manggagawa."],
      ["Investigate incidents and near misses and recommend fixes.", "Imbestigahan ang mga insidente at near miss at magrekomenda ng solusyon."],
      ["Prepare emergency plans, drills and safety reports.", "Maghanda ng emergency plan, drill at ulat sa kaligtasan."],
    ],
  },
  "Office Staff": {
    summary: ["Keep daily office work running smoothly.", "Pinapanatiling maayos ang pang-araw-araw na gawain sa opisina."],
    duties: [
      ["Answer calls and emails and welcome visitors.", "Sumagot ng tawag at email at salubungin ang mga bisita."],
      ["Encode, check and file documents and records.", "Mag-encode, mag-check at mag-file ng mga dokumento at record."],
      ["Prepare letters, reports and spreadsheets.", "Gumawa ng mga liham, ulat at spreadsheet."],
      ["Schedule meetings and keep minutes.", "Mag-iskedyul ng meeting at magtala ng minutes."],
      ["Keep office supplies in stock.", "Panatilihing may sapat na gamit sa opisina."],
    ],
  },
  "Marketing Staff": {
    summary: ["Help people discover and choose our products and services.", "Tinutulungan ang mga tao na matuklasan at piliin ang aming mga produkto at serbisyo."],
    duties: [
      ["Plan and post content on social media and other channels.", "Magplano at mag-post ng content sa social media at iba pang channel."],
      ["Write clear, truthful ad copy and promotions.", "Sumulat ng malinaw at tapat na ad copy at promosyon."],
      ["Track results such as reach, clicks and sales, and report them.", "Subaybayan ang resulta tulad ng reach, click at benta, at iulat ito."],
      ["Research customers and competitors.", "Mag-research tungkol sa mga customer at kakumpitensya."],
      ["Protect customers' personal data and follow the Data Privacy Act.", "Protektahan ang personal na datos ng mga customer at sundin ang Data Privacy Act."],
    ],
  },
  "Human Resources Staff": {
    summary: ["Support employees through hiring, records, pay and workplace rules.", "Sinusuportahan ang mga empleyado sa pag-hire, mga record, sahod at mga patakaran sa trabaho."],
    duties: [
      ["Post jobs, screen applicants and schedule interviews.", "Mag-post ng trabaho, i-screen ang mga aplikante at mag-iskedyul ng interview."],
      ["Prepare employment records (201 files) and onboarding.", "Maghanda ng mga employment record (201 file) at onboarding."],
      ["Track attendance, leave and benefits (SSS, PhilHealth, Pag-IBIG).", "Subaybayan ang attendance, leave at benepisyo (SSS, PhilHealth, Pag-IBIG)."],
      ["Support payroll with accurate, confidential data.", "Suportahan ang payroll gamit ang tama at kumpidensyal na datos."],
      ["Handle employee concerns fairly and follow the Labor Code.", "Asikasuhin nang patas ang mga hinaing ng empleyado at sundin ang Labor Code."],
    ],
  },
  "Field Helper": {
    summary: ["Assist the field crew with tools, materials and basic tasks on site.", "Tumutulong sa field crew sa mga gamit, materyales at pangunahing gawain sa site."],
    duties: [
      ["Carry, prepare and organize tools and materials.", "Magbuhat, maghanda at mag-ayos ng mga gamit at materyales."],
      ["Help with digging, cable pulling and other site tasks as instructed.", "Tumulong sa paghuhukay, paghila ng kable at iba pang gawain sa site ayon sa utos."],
      ["Follow safety rules and wear protective equipment at all times.", "Sundin ang mga patakaran sa kaligtasan at laging magsuot ng protective equipment."],
      ["Keep the work area clean and store tools properly after work.", "Panatilihing malinis ang lugar ng trabaho at itago nang maayos ang mga gamit pagkatapos."],
      ["Follow the crew leader's instructions and report problems right away.", "Sundin ang utos ng lider ng crew at agad iulat ang mga problema."],
    ],
  },
  "Field Network Engineer": {
    summary: ["Install and repair customer and site network connections in the field.", "Nag-i-install at nag-aayos ng koneksyon ng network ng mga customer at site sa field."],
    duties: [
      ["Install and test fiber and copper cables, routers and access points.", "Mag-install at mag-test ng fiber at copper na kable, router at access point."],
      ["Splice and measure fiber links with tools like an OTDR.", "Mag-splice at sukatin ang fiber link gamit ang mga kagamitan tulad ng OTDR."],
      ["Troubleshoot outages on site and restore service quickly.", "Ayusin ang mga outage sa site at ibalik agad ang serbisyo."],
      ["Label cables and record the work done.", "Lagyan ng label ang mga kable at itala ang nagawa."],
      ["Work safely at heights and follow site rules.", "Magtrabaho nang ligtas sa matataas na lugar at sundin ang patakaran ng site."],
    ],
  },
  "Field Line Man": {
    summary: ["Build and maintain electrical lines safely so customers have power.", "Nagtatayo at nag-aalaga ng mga linya ng kuryente nang ligtas para may kuryente ang mga customer."],
    duties: [
      ["Install and repair poles, wires, insulators and transformers.", "Mag-install at mag-ayos ng poste, kawad, insulator at transformer."],
      ["Follow lockout/tagout and grounding procedures before working on lines.", "Sundin ang lockout/tagout at grounding bago magtrabaho sa mga linya."],
      ["Climb and work at heights using proper safety equipment.", "Umakyat at magtrabaho sa taas gamit ang tamang safety equipment."],
      ["Respond to outages and restore power safely.", "Tumugon sa mga brownout at ibalik nang ligtas ang kuryente."],
      ["Inspect lines and report defects.", "Siyasatin ang mga linya at iulat ang mga sira."],
    ],
  },
  "Quality Officer": {
    summary: ["Make sure our products and services meet the required quality standards.", "Tinitiyak na natutugunan ng aming mga produkto at serbisyo ang kinakailangang pamantayan sa kalidad."],
    duties: [
      ["Inspect products and processes against standards (ISO 9001).", "Siyasatin ang mga produkto at proseso ayon sa pamantayan (ISO 9001)."],
      ["Record and investigate non-conformances and customer complaints.", "Itala at imbestigahan ang mga non-conformance at reklamo ng customer."],
      ["Lead corrective and preventive actions (CAPA).", "Manguna sa corrective at preventive actions (CAPA)."],
      ["Run internal audits and keep documents under control.", "Magsagawa ng internal audit at panatilihing kontrolado ang mga dokumento."],
      ["Track quality data and suggest improvements.", "Subaybayan ang datos ng kalidad at magmungkahi ng pagpapabuti."],
    ],
  },
  "Admin Staff": {
    summary: ["Handle the administrative work that keeps the company organized.", "Hinahawakan ang mga gawaing administratibo na nagpapanatiling maayos ang kumpanya."],
    duties: [
      ["Process purchase requests, orders and supplier documents.", "Iproseso ang mga purchase request, order at dokumento ng supplier."],
      ["Manage petty cash, receipts and liquidation.", "Pamahalaan ang petty cash, resibo at liquidation."],
      ["Maintain filing, records and the equipment inventory.", "Panatilihin ang filing, mga record at imbentaryo ng kagamitan."],
      ["Arrange travel, meetings and schedules for managers.", "Mag-ayos ng biyahe, meeting at iskedyul para sa mga manager."],
      ["Keep confidential records secure.", "Panatilihing ligtas ang kumpidensyal na mga record."],
    ],
  },
};

// The four text fields stored on a job posting. Duties are one per line.
export function roleFields(title: string) {
  const r = ROLE_INFO[title];
  return r
    ? { description: r.summary[0], descriptionTl: r.summary[1], duties: r.duties.map((d) => d[0]).join("\n"), dutiesTl: r.duties.map((d) => d[1]).join("\n") }
    : null;
}
