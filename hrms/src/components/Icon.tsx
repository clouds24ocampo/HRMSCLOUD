import {
  Activity, AlarmClock, AlertCircle, AlertTriangle, Archive, ArrowRightLeft, Ban, Banknote, BarChart3, Bell, BellRing, BookOpen, Building2, CalendarDays,
  CalendarRange, Briefcase, Camera, Car, Check, CheckCircle2, CheckSquare, Circle, CircleDot, ClipboardList, Clock, CloudRain, Coffee, Compass, Factory, FileText, Flag, FolderKanban, FolderOpen, GanttChart, Gift, HandHeart, Handshake, GraduationCap,
  History, Home, Hospital, IdCard, Image as ImageIcon, KeyRound, Landmark, Laptop, LayoutDashboard, LayoutGrid, LifeBuoy, LineChart, List, ListChecks, LogIn, LogOut, MapPin,
  Megaphone, Menu, MessageSquare, PartyPopper, Paperclip, Pencil, PenLine, Package, PauseCircle, Phone, Palmtree, Pin, Play, Plus, Presentation, Printer, Receipt, RefreshCw, Rocket,
  Save, ScrollText, Search, Send, Settings, ShoppingBag, Smartphone, Square, Stethoscope, Table, Tag, Target, Thermometer, Timer, Toilet, Truck, User, Users, Utensils, Video, Wind, Wrench, X, XCircle, Zap, type LucideIcon,
} from "lucide-react";

// One place that decides which picture stands for what. Code refers to an icon by name (menu data, labels), never by an emoji,
// so the whole app can be restyled here and a missing name is a type error.
const ICONS = {
  // navigation
  home: Home, employee: User, contract: FileText, handbook: BookOpen, organization: Building2, recruitment: Target, documents: FolderOpen,
  policies: ScrollText, id: IdCard, schedule: CalendarDays, dtr: Timer, overtime: AlarmClock, leave: Palmtree, dailyReport: ClipboardList,
  worksync: FolderKanban, payroll: Landmark, payslip: Receipt, cashAdvance: Banknote, incentive: Gift, performance: LineChart,
  learning: GraduationCap, chat: MessageSquare, requests: BellRing, announcement: Megaphone, reports: BarChart3, analytics: Compass,
  settings: Settings, users: KeyRound, audit: ListChecks, menu: Menu, notification: Bell,
  // actions and labels
  phone: Phone, video: Video, attach: Paperclip, camera: Camera, image: ImageIcon, refresh: RefreshCw, save: Save, sign: PenLine,
  send: Send, ban: Ban, pin: Pin, clock: Clock, week: CalendarRange, warning: AlertTriangle, coffee: Coffee, laptop: Laptop,
  smartphone: Smartphone, location: MapPin, edit: Pencil, celebrate: PartyPopper, table: Table, cards: LayoutGrid, people: Users,
  tag: Tag, history: History, search: Search, print: Printer, add: Plus, move: ArrowRightLeft, done: CheckCircle2, archive: Archive,
  comment: MessageSquare, flag: Flag, checked: CheckSquare, unchecked: Square, file: FileText, list: List, close: X, timeline: GanttChart, dashboard: LayoutDashboard,
  // time stamp types and live status (stored by name in StampType.icon)
  login: LogIn, logout: LogOut, meal: Utensils, restroom: Toilet, clinic: Stethoscope, car: Car, teach: Presentation, tools: Wrench,
  hospital: Hospital, box: Package, pause: PauseCircle, play: Play, stop: Square, rain: CloudRain, heat: Thermometer, storm: Wind,
  quake: Activity, prayer: HandHeart, power: Zap, sos: LifeBuoy, notIn: Circle, working: CircleDot, ok: Check, late: AlertCircle, noShow: XCircle,
  // industries
  government: Landmark, shop: ShoppingBag, factory: Factory, business: Briefcase, transport: Truck, partners: Handshake, startup: Rocket,
} as const satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;
export const isIconName = (v: string): v is IconName => Object.hasOwn(ICONS, v);

/** Size for an icon that sits in a line of text. */
export const ICON_INLINE = "inline h-4 w-4 align-text-bottom";

export function Icon({ name, className = "h-[1.125rem] w-[1.125rem]" }: { name: IconName; className?: string }) {
  const Glyph = ICONS[name];
  return <Glyph aria-hidden strokeWidth={1.75} className={className} />;
}

/** A stored icon value: an icon name, or (rows saved before icons had names) a plain text symbol. */
export function StampIcon({ value, className }: { value: string; className?: string }) {
  return isIconName(value) ? <Icon name={value} className={className} /> : <span aria-hidden>{value}</span>;
}
