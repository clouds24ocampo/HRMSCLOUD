// The ready-made Company Handbook for an information technology company: software, hardware, cloud, servers,
// networks, digital security and Wi-Fi services, under Philippine law. Installed from the Handbook page by HR.
import { PART1, type Chapter } from "./part1";
import { PART2 } from "./part2";
import { PART3 } from "./part3";
import { PART4 } from "./part4";

export const IT_HANDBOOK: (Chapter & { sortOrder: number })[] = [...PART1, ...PART2, ...PART3, ...PART4].map((c, i) => ({ ...c, sortOrder: i + 1 }));

export const fill = (text: string, companyName: string) => text.replaceAll("{{COMPANY}}", companyName);
