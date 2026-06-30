import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import { supabase } from "./supabaseClient";
import Auth from "./Auth";
import "./App.css";


const SCHOOL_HOLIDAYS = {
  "2025-2026": {
    A: [
      { label: "Vacances de la Toussaint", start: "2025-10-18", end: "2025-11-02" },
      { label: "Vacances de Noël", start: "2025-12-20", end: "2026-01-04" },
      { label: "Vacances d'hiver", start: "2026-02-07", end: "2026-02-22" },
      { label: "Vacances de printemps", start: "2026-04-04", end: "2026-04-19" },
      { label: "Pont de l'Ascension", start: "2026-05-14", end: "2026-05-17" },
      { label: "Vacances d'été", start: "2026-07-04", end: "2026-08-31" },
    ],
    B: [
      { label: "Vacances de la Toussaint", start: "2025-10-18", end: "2025-11-02" },
      { label: "Vacances de Noël", start: "2025-12-20", end: "2026-01-04" },
      { label: "Vacances d'hiver", start: "2026-02-14", end: "2026-03-01" },
      { label: "Vacances de printemps", start: "2026-04-11", end: "2026-04-26" },
      { label: "Pont de l'Ascension", start: "2026-05-14", end: "2026-05-17" },
      { label: "Vacances d'été", start: "2026-07-04", end: "2026-08-31" },
    ],
    C: [
      { label: "Vacances de la Toussaint", start: "2025-10-18", end: "2025-11-02" },
      { label: "Vacances de Noël", start: "2025-12-20", end: "2026-01-04" },
      { label: "Vacances d'hiver", start: "2026-02-21", end: "2026-03-08" },
      { label: "Vacances de printemps", start: "2026-04-18", end: "2026-05-03" },
      { label: "Pont de l'Ascension", start: "2026-05-14", end: "2026-05-17" },
      { label: "Vacances d'été", start: "2026-07-04", end: "2026-08-31" },
    ],
  },
  "2026-2027": {
    A: [
      { label: "Vacances de la Toussaint", start: "2026-10-17", end: "2026-11-01" },
      { label: "Vacances de Noël", start: "2026-12-19", end: "2027-01-03" },
      { label: "Vacances d'hiver", start: "2027-02-13", end: "2027-02-28" },
      { label: "Vacances de printemps", start: "2027-04-10", end: "2027-04-25" },
      { label: "Vacances d'été", start: "2027-07-03", end: "2027-08-31" },
    ],
    B: [
      { label: "Vacances de la Toussaint", start: "2026-10-17", end: "2026-11-01" },
      { label: "Vacances de Noël", start: "2026-12-19", end: "2027-01-03" },
      { label: "Vacances d'hiver", start: "2027-02-20", end: "2027-03-07" },
      { label: "Vacances de printemps", start: "2027-04-24", end: "2027-05-09" },
      { label: "Vacances d'été", start: "2027-07-03", end: "2027-08-31" },
    ],
    C: [
      { label: "Vacances de la Toussaint", start: "2026-10-17", end: "2026-11-01" },
      { label: "Vacances de Noël", start: "2026-12-19", end: "2027-01-03" },
      { label: "Vacances d'hiver", start: "2027-02-06", end: "2027-02-21" },
      { label: "Vacances de printemps", start: "2027-04-17", end: "2027-05-02" },
      { label: "Vacances d'été", start: "2027-07-03", end: "2027-08-31" },
    ],
  },
};

function pad(number) {
  return String(number).padStart(2, "0");
}

function getTodayDateOnly() {
  const today = new Date();
  return `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
}

const formatAppointmentTime = (dateString) => {
  if (!dateString) return "";

  const date = new Date(dateString);

  return date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

function toDate(value) {
  if (!value) return null;

  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split("-").map(Number);
      return new Date(year, month - 1, day);
    }

    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
      const [datePart, timePart] = value.split("T");
      const [year, month, day] = datePart.split("-").map(Number);
      const [hours, minutes] = timePart.slice(0, 5).split(":").map(Number);
      return new Date(year, month - 1, day, hours, minutes);
    }
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function formatDateTime(value) {
  const date = toDate(value);
  if (!date) return "Non planifié";

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatDateOnly(value) {
  const date = toDate(value);
  if (!date) return "Date non renseignée";

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
  }).format(date);
}

function formatTimeOnly(value) {
  const date = toDate(value);
  if (!date) return "--:--";

  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDateTimeLocalInput(value) {
  const date = toDate(value);
  if (!date) return "";

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatClientName(client) {
  if (!client) return "Client supprimé";
  return `${client.firstName || ""} ${client.lastName || ""}`.trim() || "Sans nom";
}

function normalizeString(str) {
  return (str || "")
    .normalize("NFD") // décompose les accents
    .replace(/[\u0300-\u036f]/g, "") // supprime les accents
    .toLowerCase();
}

function formatDuration(hours, minutes) {
  const h = Number(hours) || 0;
  const m = Number(minutes) || 0;

  if (h === 0 && m === 0) return "Non renseignée";
  if (h > 0 && m > 0) return `${h} h ${m} min`;
  if (h > 0) return `${h} h`;
  return `${m} min`;
}

function formatCurrency(value) {
  const numeric = Number(value) || 0;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(numeric);
}

function getStartOfWeek(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  let dayOfWeek = date.getDay();
  if (dayOfWeek === 0) dayOfWeek = 7;
  date.setDate(date.getDate() - (dayOfWeek - 1));
  return date;
}

function formatDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addDays(date, count) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + count);
  return copy;
}

function getWeekDays(selectedDate) {
  const start = getStartOfWeek(selectedDate);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

function getMonthMatrix(selectedDate) {
  const [year, month] = selectedDate.split("-").map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);

  let firstWeekDay = firstDay.getDay();
  if (firstWeekDay === 0) firstWeekDay = 7;

  const cells = [];

  for (let i = 1; i < firstWeekDay; i += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    cells.push(new Date(year, month - 1, day));
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

function getEasterDate(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return new Date(year, month - 1, day);
}

function getFrenchPublicHolidays(year) {
  const easter = getEasterDate(year);
  const easterMonday = addDays(easter, 1);
  const ascension = addDays(easter, 39);
  const pentecostMonday = addDays(easter, 50);

  return [
    { label: "Jour de l'An", date: `${year}-01-01` },
    { label: "Lundi de Pâques", date: formatDateKey(easterMonday) },
    { label: "Fête du Travail", date: `${year}-05-01` },
    { label: "Victoire 1945", date: `${year}-05-08` },
    { label: "Ascension", date: formatDateKey(ascension) },
    { label: "Lundi de Pentecôte", date: formatDateKey(pentecostMonday) },
    { label: "Fête nationale", date: `${year}-07-14` },
    { label: "Assomption", date: `${year}-08-15` },
    { label: "Toussaint", date: `${year}-11-01` },
    { label: "Armistice", date: `${year}-11-11` },
    { label: "Noël", date: `${year}-12-25` },
  ];
}

function getSchoolHolidayRanges(zone) {
  return Object.values(SCHOOL_HOLIDAYS)
    .flatMap((schoolYear) => schoolYear[zone] || [])
    .map((item) => ({
      ...item,
      type: "holiday",
    }));
}

function isDateBetween(dateKey, startKey, endKey) {
  return dateKey >= startKey && dateKey <= endKey;
}

function getSpecialDayInfo(dateKey, schoolZone) {
  const year = Number(dateKey.slice(0, 4));
  const publicHolidays = [
    ...getFrenchPublicHolidays(year - 1),
    ...getFrenchPublicHolidays(year),
    ...getFrenchPublicHolidays(year + 1),
  ];

  const matchedHoliday = publicHolidays.find((item) => item.date === dateKey);
  if (matchedHoliday) {
    return {
      type: "publicHoliday",
      label: matchedHoliday.label,
    };
  }

  const schoolRanges = getSchoolHolidayRanges(schoolZone);
  const matchedSchoolHoliday = schoolRanges.find((item) =>
    isDateBetween(dateKey, item.start, item.end)
  );

  if (matchedSchoolHoliday) {
    return {
      type: "schoolHoliday",
      label: matchedSchoolHoliday.label,
    };
  }

  return null;
}

function getAppointmentDurationInMinutes(appointmentItem) {
  const hours = Number(appointmentItem.durationHours) || 0;
  const minutes = Number(appointmentItem.durationMinutes) || 0;
  const total = hours * 60 + minutes;
  return total > 0 ? total : 60;
}

function getMinutesSinceStartOfDay(dateValue, startHour) {
  const date = toDate(dateValue);
  if (!date) return 0;
  return (date.getHours() - startHour) * 60 + date.getMinutes();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

const ACOMPTE_TYPE = "ACOMPTE";

const MONTH_DAY_LABELS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

function isAcompteAppointment(appointmentItem) {
  return appointmentItem?.title === ACOMPTE_TYPE;
}


function getDepositsForAppointment(appointments, appointmentId) {
  return appointments.filter(
    (appointmentItem) =>
      isAcompteAppointment(appointmentItem) &&
      String(appointmentItem.linkedAppointmentId) === String(appointmentId)
  );
}

function getTotalDepositsForAppointment(appointments, appointmentId) {
  return getDepositsForAppointment(appointments, appointmentId).reduce(
    (sum, appointmentItem) => sum + (Number(appointmentItem.price) || 0),
    0
  );
}

function getDisplayedPrice(appointmentItem, appointments) {
  if (!appointmentItem) return 0;

  if (isAcompteAppointment(appointmentItem)) {
    return Number(appointmentItem.price) || 0;
  }

  const originalPrice = Number(appointmentItem.price) || 0;
  const totalDeposits = getTotalDepositsForAppointment(appointments, appointmentItem.id);

  return Math.max(0, originalPrice - totalDeposits);
}

function buildSystemDepositNotes(appointments, appointmentItem) {
  if (!appointmentItem || isAcompteAppointment(appointmentItem)) return "";

  const deposits = getDepositsForAppointment(appointments, appointmentItem.id);

  if (deposits.length === 0) return "";

  return deposits
    .map((deposit) => {
      const depositAmount = Number(deposit.price) || 0;
      const originalTotal =
        Number(deposit.originalTotalBeforeDeposit) || Number(appointmentItem.price) || 0;

      return `ACOMPTE ENREGISTRÉ (non supprimable) : ${formatCurrency(
        depositAmount
      )} versés le ${formatDateTime(deposit.paymentDate || deposit.appointment)} par ${
        deposit.paymentMethod || "mode non renseigné"
      } - montant total avant acompte : ${formatCurrency(originalTotal)}`;
    })
    .join(" | ");
}

function sanitizePhoneNumber(phone) {
  return (phone || "").replace(/[^\d+]/g, "");
}

function getClientPhone(client) {
  return sanitizePhoneNumber(client?.phone || "");
}

export default function App() {
  const [session, setSession] = useState(null);
  const [searchAppointmentQuery, setSearchAppointmentQuery] = useState("");
  const [loadingSession, setLoadingSession] = useState(true);
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [setupComplete, setSetupComplete] = useState(false);
  const [page, setPage] = useState("home");
  const [pageHistory, setPageHistory] = useState([]);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState(null);
  const [selectedClientId, setSelectedClientId] = useState(null);
  function normalizeSearchText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }
  const [data, setData] = useState({
    clients: [],
    appointments: [],
    artists: [],
    closedDays: [],
    appointmentTypes: ["TATTOO", "PIERCING", "VENTE", "ACOMPTE"],
  });

 const openAppointmentDetails = (appointmentItem) => {
  setSelectedAppointmentId(appointmentItem.id);

  if (appointmentItem.appointment) {
    setSelectedDate(appointmentItem.appointment.slice(0, 10));
  }

  navigateTo("appointment-details");
};

const openClientDetails = (client) => {
  setSelectedClientId(client.id);
  navigateTo("client-details");
};

const openClientAppointments = (clientId) => {
  setSelectedClientId(clientId);
  navigateTo("client-appointments");
};

const evaluateSetup = (artistsList, servicesList) => {
  const hasArtists = (artistsList || []).length > 0;
  const hasServices = (servicesList || []).some(
    (service) => service?.name?.trim()?.toUpperCase() !== ACOMPTE_TYPE
  );
  const ok = hasArtists && hasServices;

  setSetupComplete(ok);
  setCheckingSetup(false);

  return ok;
};

  const [selectedDate, setSelectedDate] = useState(getTodayDateOnly());
  const [agendaView, setAgendaView] = useState("month");
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [showMobileWeek, setShowMobileWeek] = useState(false);
  const [schoolZone, setSchoolZone] = useState("B");
  const [revenueArtistFilter, setRevenueArtistFilter] = useState("all");
  const [agendaArtistFilter, setAgendaArtistFilter] = useState("all");

  const [clientSearch, setClientSearch] = useState("");
  const [appointmentSearch, setAppointmentSearch] = useState("");
  const [exportStartDate, setExportStartDate] = useState("");
  const [exportEndDate, setExportEndDate] = useState("");
  const [appointmentClientSearch, setAppointmentClientSearch] = useState("");
  const [expandedClientId, setExpandedClientId] = useState(null);

  const [clientForm, setClientForm] = useState({
    lastName: "",
    firstName: "",
    phone: "",
    notes: "",
  });

  const [showQuickClientForm, setShowQuickClientForm] = useState(false);
const [quickClientForm, setQuickClientForm] = useState({
  lastName: "",
  firstName: "",
  phone: "",
  notes: "",
});

  const [artistForm, setArtistForm] = useState({
    name: "",
    color: "#111111",
  });

   const [appointmentForm, setAppointmentForm] = useState({
     clientId: "",
  artistId: "",
  title: "",
  project: "",
  notes: "",
  appointment: "",
  price: "",
  saleAmount: "",
  serviceAmount: "",
  durationHours: "",
  durationMinutes: "",
  cancelled: false,
  saleAmount: "",
  serviceAmount: "",
  linkedAppointmentId: "",
     paymentMethod: "",
     paymentCbAmount: "",
     paymentCashAmount: "",
     paymentDate: "",
     originalTotalBeforeDeposit: "",
   });

  const [editingClientId, setEditingClientId] = useState(null);
  const [editingAppointmentId, setEditingAppointmentId] = useState(null);
  const [editingArtistId, setEditingArtistId] = useState(null);
  const [serviceForm, setServiceForm] = useState({
    name: "",
    category: "PRESTATION",
  });

  const [editingServiceName, setEditingServiceName] = useState(null);

  const DAY_START_HOUR = 8;
  const DAY_END_HOUR = 20;
  const HOUR_HEIGHT = 80;
  const TOTAL_DAY_MINUTES = (DAY_END_HOUR - DAY_START_HOUR) * 60;
  const DAY_COLUMN_HEIGHT = (DAY_END_HOUR - DAY_START_HOUR) * HOUR_HEIGHT;

  const [showSuccess, setShowSuccess] = useState(false);

  const navigateTo = (newPage) => {
    setPageHistory((prev) => [...prev, page]);
    setPage(newPage);
  };

  const goBack = () => {
    if (pageHistory.length === 0) {
      setPage("home");
      return;
    }

    const previousPage = pageHistory[pageHistory.length - 1];

    setPageHistory((prev) => prev.slice(0, -1));
    setPage(previousPage);
  };


useEffect(() => {
  supabase.auth.getSession().then(({ data }) => {
    setSession(data.session ?? null);
    setLoadingSession(false);
  });

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, newSession) => {
    setSession(newSession ?? null);
  });

  return () => subscription.unsubscribe();
}, []);

useEffect(() => {
  if (!session) return;
  loadSupabaseData();
}, [session]);

  useEffect(() => {
  const handleResize = () => {
    const mobile = window.innerWidth <= 768;
    setIsMobile(mobile);

    if (!mobile) {
      setShowMobileWeek(false);
    }
  };

  handleResize();
  window.addEventListener("resize", handleResize);


  return () => window.removeEventListener("resize", handleResize);
}, []);

  useEffect(() => {
  if (isMobile && !showMobileWeek && agendaView === "week") {
    setAgendaView("day");
  }
}, [isMobile, showMobileWeek, agendaView]);

  const clients = data.clients || [];
  const appointments = data.appointments || [];
  const artists = data.artists || [];
  const closedDays = data.closedDays || [];
  const filteredAppointmentClients = useMemo(() => {
    const q = normalizeString(appointmentClientSearch);

    return clients
      .filter((client) => {
        if (!q) return true;

        const searchableText = normalizeString(
          `${client.firstName || ""} ${client.lastName || ""} ${client.phone || ""}`
        );

        return searchableText.includes(q);
      })
      .slice()
      .sort((a, b) => formatClientName(a).localeCompare(formatClientName(b)));
  }, [clients, appointmentClientSearch]);
  const appointmentTypes = data.appointmentTypes || [];
  const getAppointmentTypeName = (type) =>
    typeof type === "string" ? type : type?.name || "";

  const getAppointmentTypeCategory = (typeName) => {
    const found = appointmentTypes.find(
      (type) => getAppointmentTypeName(type) === typeName
    );

    return typeof found === "string"
      ? "PRESTATION"
      : found?.category || "PRESTATION";
  };

  const canFinishSetup =
    artists.length > 0 &&
    appointmentTypes.some(
      (type) =>
        getAppointmentTypeName(type).trim().toUpperCase() !== ACOMPTE_TYPE
    );

  const loadAllAppointments = async () => {
    let allAppointments = [];
    let from = 0;
    const pageSize = 1000;

    while (true) {
      const { data, error } = await supabase
        .from("appointments")
        .select(`
          *,
          client:clients (
            id,
            last_name,
            first_name,
            phone,
            notes
          )
        `)
        .eq("user_id", session.user.id)
        .order("appointment", { ascending: true })
        .range(from, from + pageSize - 1);

      if (error) {
        return { data: null, error };
      }

      allAppointments = [...allAppointments, ...(data || [])];

      if (!data || data.length < pageSize) {
        break;
      }

      from += pageSize;
    }

    return { data: allAppointments, error: null };
  };

  const loadAllClients = async () => {
    let allClients = [];
    let from = 0;
    const pageSize = 1000;

    while (true) {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("user_id", session.user.id)
        .order("last_name", { ascending: true })
        .range(from, from + pageSize - 1);

      if (error) {
        return { data: null, error };
      }

      allClients = [...allClients, ...(data || [])];

      if (!data || data.length < pageSize) break;

      from += pageSize;
    }

    return { data: allClients, error: null };
  };

  const loadSupabaseData = async () => {
    if (!session) return;

  setCheckingSetup(true);

const [
  { data: clients, error: clientsError },
  { data: artists, error: artistsError },
  { data: appointments, error: appointmentsError },
  { data: services, error: servicesError },
  { data: closedDays, error: closedDaysError },
] = await Promise.all([
  loadAllClients(),

  supabase
    .from("artists")
    .select("*")
    .eq("user_id", session.user.id)
    .order("name", { ascending: true }),

  loadAllAppointments(),

    supabase
        .from("services")
        .select("*")
        .eq("user_id", session.user.id)
        .order("name", { ascending: true }),

      supabase
        .from("closed_days")
        .select("*")
        .eq("user_id", session.user.id)
        .order("day", { ascending: true }),
    ]);

console.log("SESSION USER ID =", session.user.id);
console.log("RDV BRUTS SUPABASE =", appointments);
console.log("ERREUR RDV =", appointmentsError);

  const firstError =
    clientsError ||
    artistsError ||
    appointmentsError ||
    servicesError ||
    closedDaysError;

    if (firstError) {
      alert(firstError.message);
      setCheckingSetup(false);
      return;
    }

  setData({
    clients: (clients || []).map((client) => ({
      id: client.id,
      lastName: client.last_name,
      firstName: client.first_name,
      phone: client.phone,
      notes: client.notes,
    })),
    artists: (artists || []).map((artist) => ({
      id: artist.id,
      name: artist.name,
      color: artist.color,
    })),
    appointments: (appointments || []).map((appointment) => ({
      id: appointment.id,
      clientId: appointment.client_id,
      client: appointment.client
        ? {
            id: appointment.client.id,
            lastName: appointment.client.last_name,
            firstName: appointment.client.first_name,
            phone: appointment.client.phone,
            notes: appointment.client.notes,
          }
        : null,
      artistId: appointment.artist_id,
      title: appointment.title,
      project: appointment.project,
      notes: appointment.notes,
      appointment: formatDateTimeLocalInput(appointment.appointment),
      price: appointment.price ?? "",
      durationHours: appointment.duration_hours ?? "",
      durationMinutes: appointment.duration_minutes ?? "",
      cancelled: appointment.cancelled,
      linkedAppointmentId: appointment.linked_appointment_id ?? "",
      paymentMethod: appointment.payment_method || "",
      paymentCbAmount: appointment.payment_cb_amount ?? "",
      paymentCashAmount: appointment.payment_cash_amount ?? "",
      paymentDate: appointment.payment_date || "",
      originalTotalBeforeDeposit: appointment.original_total_before_deposit ?? "",
      saleAmount: appointment.sale_amount ?? "",
      serviceAmount: appointment.service_amount ?? "",
    })),
    closedDays: (closedDays || []).map((item) => ({
      id: item.id,
      day: item.day,
    })),
    appointmentTypes: [
      ...(services || []).map((service) => ({
        name: service.name,
        category: service.category || "PRESTATION",
      })),
      { name: "ACOMPTE", category: "ACOMPTE" },
    ],
  });
    evaluateSetup(artists || [], services || []);
};

  const appointmentsWithClient = useMemo(() => {
    return appointments
      .map((appointmentItem) => {
        const client =
          appointmentItem.client ||
          clients.find((c) => String(c.id) === String(appointmentItem.clientId));

        const artist = artists.find(
          (a) => String(a.id) === String(appointmentItem.artistId)
        );

        return {
          ...appointmentItem,
          client,
          artist,
          clientName: formatClientName(client),
          clientPhone: client?.phone || "",
          artistName: artist?.name || "Tatoueur non attribué",
          artistColor: artist?.color || "#111111",
          title: appointmentItem.title || appointmentItem.project || "",
        };
      })
      .sort((a, b) => {
        const aValue = a.appointment || "";
        const bValue = b.appointment || "";
        return aValue.localeCompare(bValue);
      });
  }, [appointments, clients, artists]);

  const filteredClients = useMemo(() => {
  const q = normalizeString(clientSearch.trim());
  if (!q) return clients;

  return clients.filter((client) => {
    const clientAppointmentsText = appointmentsWithClient
      .filter(
        (appointmentItem) =>
          String(appointmentItem.clientId) === String(client.id)
      )
      .map((appointmentItem) =>
        [
          appointmentItem.title,
          appointmentItem.project,
          appointmentItem.notes,
          appointmentItem.artistName,
          appointmentItem.appointment,
          appointmentItem.price,
        ].join(" ")
      )
      .join(" ");

    const searchableText = normalizeString(
      [
        client.lastName,
        client.firstName,
        client.phone,
        client.notes,
        clientAppointmentsText,
      ].join(" ")
    );

    return searchableText.includes(q);
  });
}, [clients, clientSearch, appointmentsWithClient]);

  const filteredAppointments = useMemo(() => {
    const q = normalizeString(appointmentSearch.trim());
    if (!q) return appointmentsWithClient;

    return appointmentsWithClient.filter((appointmentItem) =>
      normalizeString(
        [
          appointmentItem.clientName,
          appointmentItem.clientPhone,
          appointmentItem.artistName,
          appointmentItem.title,
          appointmentItem.project,
          appointmentItem.notes,
          appointmentItem.appointment,
          appointmentItem.price,
          appointmentItem.durationHours,
          appointmentItem.durationMinutes,
        ].join(" ")
      ).includes(q)
    );
  }, [appointmentsWithClient, appointmentSearch]);

    const eligibleLinkedAppointments = useMemo(() => {
    if (!appointmentForm.clientId) return [];

    const currentAppointmentDate = toDate(appointmentForm.appointment);

    return appointmentsWithClient.filter((appointmentItem) => {
      if (!appointmentItem.appointment) return false;
      if (appointmentItem.title === ACOMPTE_TYPE) return false;
      if (String(appointmentItem.clientId) !== String(appointmentForm.clientId)) return false;

      if (
        editingAppointmentId !== null &&
        appointmentItem.id === editingAppointmentId
      ) {
        return false;
      }

      const appointmentDate = toDate(appointmentItem.appointment);
      if (!appointmentDate) return false;

      if (!currentAppointmentDate) {
        return appointmentDate > new Date();
      }

      return appointmentDate > currentAppointmentDate;
    });
  }, [
    appointmentsWithClient,
    appointmentForm.clientId,
    appointmentForm.appointment,
    editingAppointmentId,
  ]);

  const agendaAppointments = useMemo(() => {
    if (agendaArtistFilter === "all") return appointmentsWithClient;

    return appointmentsWithClient.filter(
      (appointmentItem) => String(appointmentItem.artistId) === String(agendaArtistFilter)
    );
  }, [appointmentsWithClient, agendaArtistFilter]);

  const searchedAppointments = useMemo(() => {
  const q = normalizeSearchText(searchAppointmentQuery);

  if (!q) return appointments;

  return appointments.filter((appointment) => {
    const client = clients.find((c) => c.id === appointment.clientId);
    const artist = artists.find((a) => a.id === appointment.artistId);

    const appointmentDate = appointment.appointment
      ? new Date(appointment.appointment)
      : null;

    const dateText = appointmentDate
      ? appointmentDate.toLocaleDateString("fr-FR")
      : "";

    const timeText = appointmentDate
      ? appointmentDate.toLocaleTimeString("fr-FR", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";

    const searchableText = normalizeSearchText(`
      ${appointment.title}
      ${appointment.project}
      ${appointment.notes}
      ${appointment.price}
      ${appointment.paymentMethod}
      ${appointment.originalTotalBeforeDeposit}
      ${dateText}
      ${timeText}
      ${client?.firstName}
      ${client?.lastName}
      ${artist?.name}
    `);

    return searchableText.includes(q);
  });
}, [searchAppointmentQuery, appointments, clients, artists]);

const selectedDayAppointments = useMemo(() => {
  return agendaAppointments.filter((appointmentItem) => {
    if (!appointmentItem.appointment) return false;

    const date = toDate(appointmentItem.appointment);
    if (!date) return false;

    return formatDateKey(date) === selectedDate;
  });
}, [agendaAppointments, selectedDate]);

  const selectedDayRevenue = useMemo(() => {
    return selectedDayAppointments
      .filter((appointmentItem) => !appointmentItem.cancelled)
      .reduce(
        (sum, appointmentItem) => sum + getDisplayedPrice(appointmentItem, appointments),
        0
      );
  }, [selectedDayAppointments, appointments]);

  const selectedDayRevenueBox = (
    <div className="agenda-day-revenue-box gold-line-glow">
      <span>Jour</span>
      <strong>{formatCurrency(selectedDayRevenue)}</strong>
    </div>
  );

  const weekDays = useMemo(() => getWeekDays(selectedDate), [selectedDate]);
  const monthCells = useMemo(() => getMonthMatrix(selectedDate), [selectedDate]);

  const timeSlots = useMemo(() => {
    const slots = [];

    for (let hour = DAY_START_HOUR; hour <= DAY_END_HOUR; hour += 1) {
      slots.push({
        label: `${pad(hour)}:00`,
        minutesFromStart: (hour - DAY_START_HOUR) * 60,
        isHalfHour: false,
      });

      if (hour !== DAY_END_HOUR) {
        slots.push({
          label: `${pad(hour)}:30`,
          minutesFromStart: (hour - DAY_START_HOUR) * 60 + 30,
          isHalfHour: true,
        });
      }
    }

    return slots;
  }, [DAY_START_HOUR, DAY_END_HOUR]);

const appointmentsByDate = useMemo(() => {
  const map = {};

  agendaAppointments.forEach((appointmentItem) => {
    if (!appointmentItem.appointment) return;

    const date = toDate(appointmentItem.appointment);
    if (!date) return;
    
    const key = formatDateKey(date);

    if (!map[key]) {
      map[key] = [];
    }

    map[key].push(appointmentItem);
  });

  Object.keys(map).forEach((key) => {
    map[key].sort((a, b) =>
      String(a.appointment || "").localeCompare(String(b.appointment || ""))
    );
  });

  return map;
}, [agendaAppointments]);

  const homeAgendaTitle = useMemo(() => {
    if (agendaView === "day") {
      return `Vue du jour — ${formatDateOnly(selectedDate)}`;
    }

    if (agendaView === "week") {
      const start = weekDays[0];
      const end = weekDays[6];

      return `Vue de la semaine — ${formatDateOnly(start)} au ${formatDateOnly(end)}`;
    }

    const [year, month] = selectedDate.split("-").map(Number);
    const monthDate = new Date(year, month - 1, 1);

    return new Intl.DateTimeFormat("fr-FR", {
      month: "long",
      year: "numeric",
    }).format(monthDate);
  }, [agendaView, selectedDate, weekDays]);

  const monthViewTitle = useMemo(() => {
    const [year, month] = selectedDate.split("-").map(Number);
    const monthDate = new Date(year, month - 1, 1);

    return new Intl.DateTimeFormat("fr-FR", {
      month: "long",
      year: "numeric",
    }).format(monthDate);
  }, [selectedDate]);

const selectedAppointmentDetails = useMemo(() => {
  if (selectedAppointmentId === null) return null;

  return (
    appointmentsWithClient.find(
      (appointmentItem) =>
        String(appointmentItem.id) === String(selectedAppointmentId)
    ) || null
  );
}, [selectedAppointmentId, appointmentsWithClient]);

const selectedClientDetails = useMemo(() => {
  if (selectedClientId === null) return null;

  return (
    clients.find((client) => String(client.id) === String(selectedClientId)) || null
  );
}, [selectedClientId, clients]);

const selectedClientAppointments = useMemo(() => {
  if (!selectedClientId) return [];

  return appointmentsWithClient
    .filter(
      (appointmentItem) =>
        String(appointmentItem.clientId) === String(selectedClientId)
    )
    .sort(
      (a, b) =>
        new Date(b.appointment || 0) - new Date(a.appointment || 0)
    );
}, [selectedClientId, appointmentsWithClient]);

const revenueStats = useMemo(() => {
  let scopedAppointments = appointmentsWithClient.filter(
    (item) => item.appointment && !item.cancelled
  );

  if (revenueArtistFilter !== "all") {
    scopedAppointments = scopedAppointments.filter(
      (item) => String(item.artistId) === revenueArtistFilter
    );
  }

  const selectedWeekDays = getWeekDays(selectedDate).map((d) => formatDateKey(d));
  const [selectedYear, selectedMonth] = selectedDate.split("-");

  const dayTotal = scopedAppointments.reduce((sum, item) => {
    return item.appointment.slice(0, 10) === selectedDate
      ? sum + getDisplayedPrice(item, appointments)
      : sum;
  }, 0);

  const weekTotal = scopedAppointments.reduce((sum, item) => {
    return selectedWeekDays.includes(item.appointment.slice(0, 10))
      ? sum + getDisplayedPrice(item, appointments)
      : sum;
  }, 0);

  const monthTotal = scopedAppointments.reduce((sum, item) => {
    const [year, month] = item.appointment.slice(0, 7).split("-");
    return year === selectedYear && month === selectedMonth
      ? sum + getDisplayedPrice(item, appointments)
      : sum;
  }, 0);

  return {
    dayTotal,
    weekTotal,
    monthTotal,
  };
}, [appointmentsWithClient, appointments, selectedDate, revenueArtistFilter]);

const globalStats = useMemo(() => {
  const activeAppointments = appointments.filter((item) => !item.cancelled);
  const activeAppointmentsWithDate = activeAppointments.filter((item) => item.appointment);

  const totalRevenue = activeAppointmentsWithDate.reduce(
    (sum, item) => sum + getDisplayedPrice(item, appointments),
    0
  );

  return {
    clientsCount: clients.length,
    artistsCount: artists.length,
    appointmentsCount: appointments.length,
    activeAppointmentsCount: activeAppointments.length,
    servicesCount: appointmentTypes.filter(
      (type) => getAppointmentTypeName(type) !== ACOMPTE_TYPE
    ).length,
    totalRevenue,
   };
}, [clients, artists, appointments, appointmentTypes]);

  const resetClientForm = () => {
    setClientForm({
      lastName: "",
      firstName: "",
      phone: "",
      notes: "",
    });
    setEditingClientId(null);
  };

  const resetQuickClientForm = () => {
  setQuickClientForm({
    lastName: "",
    firstName: "",
    phone: "",
    notes: "",
  });
  setShowQuickClientForm(false);
};

  const resetArtistForm = () => {
    setArtistForm({
      name: "",
      color: "#111111",
    });
    setEditingArtistId(null);
  };

const resetAppointmentForm = () => {
  setAppointmentForm({
    clientId: "",
    artistId: "",
    title: "",
    project: "",
    notes: "",
    appointment: "",
    price: 0,
    saleAmount: "",
    serviceAmount: "",
    durationHours: "",
    durationMinutes: "",
    cancelled: false,
    linkedAppointmentId: "",
    paymentMethod: "",
    paymentCbAmount: "",
    paymentCashAmount: "",
    paymentDate: "",
    originalTotalBeforeDeposit: "",
  });
  setEditingAppointmentId(null);
};

const openNewAppointmentForm = () => {
  resetAppointmentForm();
  setAppointmentClientSearch("");

  setAppointmentForm({
    clientId: "",
    artistId: "",
    title: "",
    project: "",
    notes: "",
    appointment: `${selectedDate}T10:00`,
    price: 0,
    saleAmount: "",
    serviceAmount: "",
    durationHours: "",
    durationMinutes: "",
    cancelled: false,
    linkedAppointmentId: "",
    paymentMethod: "",
    paymentCbAmount: "",
    paymentCashAmount: "",
    paymentDate: "",
    originalTotalBeforeDeposit: "",    
  });

  navigateTo("appointments");
};

const saveClient = async () => {
  const lastName = clientForm.lastName.trim();
  const firstName = clientForm.firstName.trim();

  if (!lastName || !firstName) {
    alert("Erreur : nom et prénom obligatoires.");
    return;
  }

  if (!session?.user) {
    alert("Erreur : utilisateur non connecté.");
    return;
  }

  const payload = {
    user_id: session.user.id,
    last_name: lastName,
    first_name: firstName,
    phone: clientForm.phone.trim(),
    notes: clientForm.notes.trim(),
  };

  if (editingClientId !== null) {
    const { data: updatedClient, error } = await supabase
      .from("clients")
      .update(payload)
      .eq("id", editingClientId)
      .eq("user_id", session.user.id)
      .select()
      .single();

    if (error) {
      alert("Erreur modification : " + error.message);
      return;
    }

    await loadSupabaseData();

    alert("Cliente modifiée.");
    resetClientForm();
    setSelectedClientId(updatedClient.id);
    navigateTo("client-details");
    return;
  }

  const { data: insertedClient, error } = await supabase
    .from("clients")
    .insert(payload)
    .select()
    .single();

  if (error) {
    alert("Erreur création : " + error.message);
    return;
  }

  if (!insertedClient?.id) {
    alert("Erreur : Supabase n'a pas renvoyé la cliente créée.");
    return;
  }

  const clientForApp = {
    id: insertedClient.id,
    lastName: insertedClient.last_name,
    firstName: insertedClient.first_name,
    phone: insertedClient.phone,
    notes: insertedClient.notes,
  };

  setData((prev) => ({
    ...prev,
    clients: [...prev.clients, clientForApp],
  }));

  setClientSearch("");
  resetClientForm();
  setSelectedClientId(insertedClient.id);
  navigateTo("client-details");

  alert("Cliente créée : " + insertedClient.first_name + " " + insertedClient.last_name);
};



const importClientsFromCsv = async (event) => {
  const file = event.target.files?.[0];
  if (!file || !session?.user) return;

  Papa.parse(file, {
      header: true,
      delimiter: ";",
      skipEmptyLines: true,
    complete: async (results) => {
      const rows = results.data;

      const clientsToInsert = rows
        .map((row) => ({
          user_id: session.user.id,
          last_name: (row.NOM || row.nom || row.lastName || row.last_name || "").trim(),
          first_name: (row.PRENOM || row.prenom || row.firstName || row.first_name || "").trim(),
          phone: (row.TELEPHONE || row.telephone || row.phone || "").trim(),
          notes: (row.NOTES || row.notes || "").trim(),
        }))
        .filter((client) => client.last_name || client.first_name || client.phone);

      if (clientsToInsert.length === 0) {
        alert("Aucun client valide trouvé. Le CSV doit contenir au minimum nom et prénom.");
        return;
      }

      const { error } = await supabase
        .from("clients")
        .insert(clientsToInsert);

      if (error) {
        alert(error.message);
        return;
      }

      await loadSupabaseData();
      alert(`${clientsToInsert.length} fiche(s) client importée(s).`);

      event.target.value = "";
    },
    error: (error) => {
      alert(`Erreur CSV : ${error.message}`);
    },
  });
};

const downloadClientsCsvTemplate = () => {
  const csvContent =
    "NOM;PRENOM;TELEPHONE;NOTES\r\n" +
    "Dupont;Marie;0612345678;Projet tatouage floral\r\n";

  const blob = new Blob(["\uFEFF" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "modele-import-clients.csv";
  link.click();

  URL.revokeObjectURL(url);
};

const normalizeImportText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const getCsvValue = (row, possibleNames) => {
  const foundKey = Object.keys(row).find((key) =>
    possibleNames.includes(normalizeImportText(key))
  );

  return foundKey ? String(row[foundKey] || "").trim() : "";
};

const parseCsvDate = (value) => {
  const cleaned = String(value || "").trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;

  const match = cleaned.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  if (!match) return "";

  const [, day, month, year] = match;
  return `${year}-${pad(month)}-${pad(day)}`;
};

const parseCsvTime = (value) => {
  const cleaned = String(value || "").trim().replace("h", ":");

  const match = cleaned.match(/^(\d{1,2})(?::(\d{1,2}))?$/);
  if (!match) return "";

  const hours = Number(match[1]);
  const minutes = Number(match[2] || 0);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return "";

  return `${pad(hours)}:${pad(minutes)}`;
};

const parseCsvDuration = (value) => {
  const cleaned = String(value || "").toLowerCase().trim();

  if (!cleaned) {
    return { durationHours: null, durationMinutes: null };
  }

  const hourMatch = cleaned.match(/(\d+)\s*h/);
  const minuteMatch = cleaned.match(/(\d+)\s*(min|mn)/);

  if (hourMatch || minuteMatch) {
    return {
      durationHours: hourMatch ? Number(hourMatch[1]) : 0,
      durationMinutes: minuteMatch ? Number(minuteMatch[1]) : 0,
    };
  }

  const numeric = Number(cleaned.replace(",", "."));
  if (!Number.isFinite(numeric)) {
    return { durationHours: null, durationMinutes: null };
  }

  if (numeric > 10) {
    return {
      durationHours: Math.floor(numeric / 60),
      durationMinutes: numeric % 60,
    };
  }

  return {
    durationHours: Math.floor(numeric),
    durationMinutes: Math.round((numeric % 1) * 60),
  };
};

const parseCsvPrice = (value) => {
  const cleaned = String(value || "")
    .replace("€", "")
    .replace(",", ".")
    .trim();

  if (!cleaned) return null;

  const price = Number(cleaned);
  return Number.isFinite(price) ? price : null;
};

const cleanClientSearchName = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, " ")
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .sort()
    .join(" ");

const findClientFromCsvName = (clientName) => {
  const searched = cleanClientSearchName(clientName);

  return clients.find((client) => {
    const fullName = cleanClientSearchName(
      `${client.firstName || ""} ${client.lastName || ""}`
    );

    return searched === fullName;
  });
};

const findArtistFromCsvName = (artistName) => {
  const searched = normalizeImportText(artistName);
  if (!searched) return artists[0] || null;

  return (
    artists.find((artist) => normalizeImportText(artist.name) === searched) ||
    null
  );
};

const findAppointmentTypeFromCsv = (typeName) => {
  const searched = normalizeImportText(typeName);

  if (!searched) {
    return (
      appointmentTypes.find(
        (type) => getAppointmentTypeName(type) !== ACOMPTE_TYPE
      )?.name || ""
    );
  }

  return (
    appointmentTypes.find(
      (type) => normalizeImportText(getAppointmentTypeName(type)) === searched
    )?.name ||
    typeName.trim().toUpperCase()
  );
};

const downloadAppointmentsCsvTemplate = () => {
  const csvContent =
    "DATE;HEURE;NOM DU PROJET;CLIENT;DUREE;PRIX;NOTES DU RENDEZ VOUS;TATOUEUR;TYPE DE PRESTATION\r\n" +
    "25/06/2026;14:30;Tatouage floral;Marie Dupont;2h30;180;Avant-bras intérieur;Angel;TATTOO\r\n";

  const blob = new Blob(["\uFEFF" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "modele-import-rendez-vous.csv";
  link.click();

  URL.revokeObjectURL(url);
};

const exportAppointmentsCsv = () => {
  if (!exportStartDate || !exportEndDate) {
    alert("Veuillez renseigner une date de début et une date de fin.");
    return;
  }

  if (exportStartDate > exportEndDate) {
    alert("La date de début ne peut pas être après la date de fin.");
    return;
  }

  const appointmentsToExport = appointmentsWithClient
    .filter((appointmentItem) => {
      if (!appointmentItem.appointment) return false;
      if (appointmentItem.cancelled) return false;
      if (isAcompteAppointment(appointmentItem)) return false;

      const appointmentDate = appointmentItem.appointment.slice(0, 10);

      return appointmentDate >= exportStartDate && appointmentDate <= exportEndDate;
    })
    .sort((a, b) =>
      String(a.appointment || "").localeCompare(String(b.appointment || ""))
    );

  if (appointmentsToExport.length === 0) {
    alert("Aucun rendez-vous trouvé sur cette période.");
    return;
  }

  const escapeCsv = (value) => {
    const text = String(value ?? "");
    return `"${text.replace(/"/g, '""')}"`;
  };

  const header = [
    "DATE",
    "HEURE",
    "CLIENT",
    "TELEPHONE",
    "TATOUEUR",
    "TYPE",
    "PROJET",
    "PRIX TOTAL",
    "PRESTATION",
    "VENTE",
    "MONTANT CB",
    "MONTANT ESPECES",
    "MOYEN DE PAIEMENT",
  ];

  const rows = appointmentsToExport.map((appointmentItem) => {
    const total = getDisplayedPrice(appointmentItem, appointments);
    const category = getAppointmentTypeCategory(appointmentItem.title);

    const saleAmount =
      category === "VENTE"
        ? total
        : Number(appointmentItem.saleAmount) || 0;

    const serviceAmount =
      category === "PRESTATION"
        ? total
        : category === "PRESTATION + VENTE"
        ? Math.max(0, total - saleAmount)
        : 0;

    const cbAmount = Number(appointmentItem.paymentCbAmount) || 0;
    const cashAmount = Number(appointmentItem.paymentCashAmount) || 0;

    return [
      formatDateOnly(appointmentItem.appointment),
      formatTimeOnly(appointmentItem.appointment),
      appointmentItem.clientName || "",
      appointmentItem.clientPhone || "",
      appointmentItem.artistName || "",
      appointmentItem.title || "",
      appointmentItem.project || "",
      total.toString().replace(".", ","),
      serviceAmount.toString().replace(".", ","),
      saleAmount.toString().replace(".", ","),
      cbAmount.toString().replace(".", ","),
      cashAmount.toString().replace(".", ","),
      appointmentItem.paymentMethod || "",
    ];
  });

  const csvContent = [
    header.map(escapeCsv).join(";"),
    ...rows.map((row) => row.map(escapeCsv).join(";")),
  ].join("\r\n");

  const blob = new Blob(["\uFEFF" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `export-rendez-vous-${exportStartDate}-au-${exportEndDate}.csv`;
  link.click();

  URL.revokeObjectURL(url);
};

const importAppointmentsFromCsv = async (event) => {
  const file = event.target.files?.[0];
  if (!file || !session?.user) return;

  Papa.parse(file, {
    header: true,
    delimiter: ";",
    skipEmptyLines: true,
    encoding: "ISO-8859-1",

    complete: async (results) => {
      const rows = results.data;
      const validAppointments = [];
      const rejectedRows = [];

      const { data: allClients, error: clientsFetchError } = await supabase
        .from("clients")
        .select("*")
        .eq("user_id", session.user.id);

      if (clientsFetchError) {
        alert("Erreur lecture clients : " + clientsFetchError.message);
        return;
      }

      const { data: allArtists, error: artistsFetchError } = await supabase
        .from("artists")
        .select("*")
        .eq("user_id", session.user.id);

      if (artistsFetchError) {
        alert("Erreur lecture tatoueurs : " + artistsFetchError.message);
        return;
      }

      const defaultArtist = allArtists?.[0];

      if (!defaultArtist) {
        alert("Erreur : aucun tatoueur trouvé dans Supabase.");
        return;
      }

      const cleanWords = (value) =>
        String(value || "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-zA-Z0-9]/g, " ")
          .toLowerCase()
          .split(" ")
          .filter(Boolean);

      const findClient = (clientName, clientsList) => {
        const searchedWords = cleanWords(clientName);

        return clientsList.find((client) => {
          const dbWords = cleanWords(
            `${client.first_name || ""} ${client.last_name || ""}`
          );

          return searchedWords.every((word) => dbWords.includes(word));
        });
      };

      let clientsCache = [...(allClients || [])];

      for (const [index, row] of rows.entries()) {
        const lineNumber = index + 2;

        const date = parseCsvDate(getCsvValue(row, ["date"]));
        const time = parseCsvTime(getCsvValue(row, ["heure"]));

        const project = getCsvValue(row, [
          "nom du projet",
          "projet",
          "project",
        ]);

        const clientName = getCsvValue(row, [
          "client",
          "nom client",
          "nom et prenom",
          "nom prenom",
        ]);

        const priceText = getCsvValue(row, ["prix", "tarif", "price"]);

        const notes = getCsvValue(row, [
          "notes du rendez vous",
          "notes du rendez-vous",
          "notes",
        ]);

        const typeName = getCsvValue(row, [
          "type de prestation",
          "prestation",
          "type",
        ]);

        if (!date || !time) {
          rejectedRows.push(`Ligne ${lineNumber} : date ou heure invalide`);
          continue;
        }

        if (!clientName) {
          rejectedRows.push(`Ligne ${lineNumber} : client vide`);
          continue;
        }

        let matchedClient = findClient(clientName, clientsCache);

        if (!matchedClient) {
          const parts = clientName.trim().split(/\s+/);
          const firstName = parts[0] || "Client";
          const lastName = parts.slice(1).join(" ") || "à compléter";

          const { data: createdClient, error: createClientError } = await supabase
            .from("clients")
            .insert({
              user_id: session.user.id,
              first_name: firstName,
              last_name: lastName,
              phone: "",
              notes: "Créé automatiquement lors de l'import RDV",
            })
            .select()
            .single();

          if (createClientError) {
            rejectedRows.push(
              `Ligne ${lineNumber} : client introuvable et création impossible "${clientName}" : ${createClientError.message}`
            );
            continue;
          }

          matchedClient = createdClient;
          clientsCache.push(createdClient);
        }

        const price = parseCsvPrice(priceText) ?? 0;
        const appointmentType = findAppointmentTypeFromCsv(typeName) || "TATTOO";

        validAppointments.push({
          user_id: session.user.id,
          client_id: matchedClient.id,
          artist_id: defaultArtist.id,
          title: appointmentType,
          project: project || "Rendez-vous importé",
          notes,
          appointment: `${date}T${time}:00`,
          price,
          duration_hours: null,
          duration_minutes: null,
          cancelled: false,
          linked_appointment_id: null,
          payment_method: null,
          payment_date: null,
          original_total_before_deposit: null,
        });
      }

      if (validAppointments.length === 0) {
        alert("Aucun RDV valide à importer.\n\n" + rejectedRows.join("\n"));
        event.target.value = "";
        return;
      }

      const { data: insertedAppointments, error: insertError } = await supabase
        .from("appointments")
        .insert(validAppointments)
        .select();

      if (insertError) {
        alert("Erreur insertion RDV Supabase : " + insertError.message);
        return;
      }

      const { data: checkJune, error: checkError } = await supabase
        .from("appointments")
        .select("*")
        .eq("user_id", session.user.id)
        .gte("appointment", "2026-06-01T00:00:00")
        .lt("appointment", "2026-07-01T00:00:00");

      if (checkError) {
        alert("RDV insérés, mais vérification impossible : " + checkError.message);
        return;
      }

      await loadSupabaseData();

      setAgendaArtistFilter("all");
      setSelectedDate("2026-06-01");
      setAgendaView("month");
      navigateTo("agenda");

      alert(
        `${insertedAppointments?.length || 0} RDV envoyés à Supabase.\n` +
          `${checkJune?.length || 0} RDV trouvés dans Supabase sur juin 2026.\n\n` +
          `${rejectedRows.length} ligne(s) ignorée(s).\n\n` +
          (rejectedRows.length ? rejectedRows.join("\n") : "Aucune ligne ignorée.")
      );

      event.target.value = "";
    },

    error: (error) => {
      alert("Erreur lecture CSV : " + error.message);
    },
  });
};

const saveQuickClient = async () => {
  if (!quickClientForm.lastName.trim() || !quickClientForm.firstName.trim()) return;
  if (!session?.user) return;

  const { data: insertedClient, error } = await supabase
    .from("clients")
    .insert({
      user_id: session.user.id,
      last_name: quickClientForm.lastName.trim(),
      first_name: quickClientForm.firstName.trim(),
      phone: quickClientForm.phone.trim(),
      notes: quickClientForm.notes.trim(),
    })
    .select()
    .single();

  if (error) {
    alert(error.message);
    return;
  }

  await loadSupabaseData();

  setAppointmentForm((prev) => ({
    ...prev,
    clientId: String(insertedClient.id),
  }));

  resetQuickClientForm();
};

const saveArtist = async () => {
  if (!artistForm.name.trim()) return;
  if (!session?.user) return;

  if (editingArtistId !== null) {
    const { error } = await supabase
      .from("artists")
      .update({
        name: artistForm.name.trim(),
        color: artistForm.color,
      })
      .eq("id", editingArtistId)
      .eq("user_id", session.user.id);

    if (error) {
      alert(error.message);
      return;
    }
  } else {
    const { error } = await supabase.from("artists").insert({
      user_id: session.user.id,
      name: artistForm.name.trim(),
      color: artistForm.color,
    });

    if (error) {
      alert(error.message);
      return;
    }
  }

  await loadSupabaseData();
  resetArtistForm();
};

  const editArtist = (artist) => {
    setArtistForm({
      name: artist.name || "",
      color: artist.color || "#111111",
    });
    setEditingArtistId(artist.id);
    navigateTo("artists");
  };

const deleteArtist = async (artistId) => {
  if (!session?.user) return;

  const hasAppointments = appointments.some(
    (appointmentItem) => String(appointmentItem.artistId) === String(artistId)
  );

  if (hasAppointments) {
    alert("Suppression impossible : ce tatoueur possède encore un ou plusieurs rendez-vous.");
    return;
  }

  const confirmDelete = window.confirm(
    "Confirmez-vous la suppression de ce tatoueur ?"
  );

  if (!confirmDelete) return;

  const { error } = await supabase
    .from("artists")
    .delete()
    .eq("id", artistId)
    .eq("user_id", session.user.id);

  if (error) {
    alert(error.message);
    return;
  }

  await loadSupabaseData();

  if (editingArtistId === artistId) {
    resetArtistForm();
  }

  if (revenueArtistFilter === String(artistId)) {
    setRevenueArtistFilter("all");
  }
};

  const resetServiceForm = () => {
  setServiceForm({
    name: "",
    category: "PRESTATION",
  });
  setEditingServiceName(null);
};

const saveService = async () => {
  const cleanedName = serviceForm.name.trim().toUpperCase();
  if (!cleanedName) return;
  if (!session?.user) return;

  if (editingServiceName === ACOMPTE_TYPE) return;

  if (editingServiceName !== null) {
    if (cleanedName === ACOMPTE_TYPE && editingServiceName !== ACOMPTE_TYPE) {
      return;
    }

    const { error } = await supabase
      .from("services")
      .update({
        name: cleanedName,
        category: serviceForm.category,
      })
      .eq("name", editingServiceName)
      .eq("user_id", session.user.id);

    if (error) {
      alert(error.message);
      return;
    }
  } else {
    if (
      appointmentTypes.some(
        (type) => getAppointmentTypeName(type) === cleanedName
      )
    ) {
      return;
    }

    const { error } = await supabase.from("services").insert({
      user_id: session.user.id,
      name: cleanedName,
      category: serviceForm.category,
    });

    if (error) {
      alert(error.message);
      return;
    }
  }

  await loadSupabaseData();
  resetServiceForm();
  };

const editService = (service) => {
  const serviceName = service.name || service;

  if (serviceName === ACOMPTE_TYPE) {
    return;
  }

  setServiceForm({
    name: serviceName || "",
    category: service.category || "PRESTATION",
  });

  setEditingServiceName(serviceName);
  navigateTo("services");
};

const deleteService = async (serviceName) => {
  const serviceNameValue = getAppointmentTypeName(serviceName);

  if (serviceNameValue === ACOMPTE_TYPE) return;
  if (!session?.user) return;

  if (serviceHasAppointments(serviceNameValue)) {
    alert("Suppression impossible : cette prestation est utilisée dans un ou plusieurs rendez-vous.");
    return;
  }

  const { error } = await supabase
    .from("services")
    .delete()
    .eq("name", serviceNameValue)
    .eq("user_id", session.user.id);

  if (error) {
    alert(error.message);
    return;
  }

  await loadSupabaseData();

  if (editingServiceName === serviceNameValue) {
    resetServiceForm();
  }
};

  const editClient = (client) => {
    setClientForm({
      lastName: client.lastName || "",
      firstName: client.firstName || "",
      phone: client.phone || "",
      notes: client.notes || "",
    });
    setEditingClientId(client.id);
    navigateTo("client-form");
  };

const deleteClient = async (clientId) => {
  if (!session?.user) return;

  const hasAppointments = appointments.some(
    (appointmentItem) => String(appointmentItem.clientId) === String(clientId)
  );

  if (hasAppointments) {
    alert("Suppression impossible : ce client possède encore un ou plusieurs rendez-vous.");
    return;
  }

  const confirmDelete = window.confirm(
    "Confirmez-vous la suppression de cette fiche client ?"
  );

  if (!confirmDelete) return;

  const { error } = await supabase
    .from("clients")
    .delete()
    .eq("id", clientId)
    .eq("user_id", session.user.id);

  if (error) {
    alert(error.message);
    return;
  }

  await loadSupabaseData();
    
  if (String(selectedClientId) === String(clientId)) {
    setSelectedClientId(null);
    navigateTo("clients");
  }

  if (editingClientId === clientId) {
    resetClientForm();
  }

  if (expandedClientId === clientId) {
    setExpandedClientId(null);
  }
};

const saveAppointment = async () => {
  if (!appointmentForm.clientId) {
    alert("Client obligatoire.");
    return;
  }

  if (!appointmentForm.artistId) {
    alert("Tatoueur obligatoire.");
    return;
  }

  if (!appointmentForm.title) {
    alert("Type de prestation obligatoire.");
    return;
  }

  if (!appointmentForm.project.trim()) {
    alert("Nom du projet obligatoire.");
    return;
  }

  if (!appointmentForm.appointment) {
    alert("Date et heure obligatoires.");
    return;
  }

  if (!session?.user) return;
  const currentEditingAppointment =
  editingAppointmentId !== null
    ? appointments.find(
        (appointmentItem) => String(appointmentItem.id) === String(editingAppointmentId)
      )
    : null;

if (
  editingAppointmentId !== null &&
  currentEditingAppointment &&
  currentEditingAppointment.title !== ACOMPTE_TYPE &&
  appointmentForm.title === ACOMPTE_TYPE
) {
  alert("Impossible de transformer un rendez-vous classique en acompte. Créez un acompte séparément.");
  return;
}

if (
  editingAppointmentId !== null &&
  currentEditingAppointment &&
  currentEditingAppointment.title === ACOMPTE_TYPE &&
  appointmentForm.title !== ACOMPTE_TYPE
) {
  alert("Impossible de transformer un acompte en rendez-vous classique.");
  return;
}

  if (appointmentForm.title === ACOMPTE_TYPE) {
    if (!appointmentForm.linkedAppointmentId) {
      alert("Vous devez obligatoirement lier l'acompte à un rendez-vous futur du même client.");
      return;
    }

    if (!appointmentForm.paymentMethod.trim()) {
      alert("Vous devez renseigner le mode de paiement de l'acompte.");
      return;
    }

    if (!appointmentForm.appointment) {
      alert("Vous devez renseigner la date et l'heure de versement de l'acompte.");
      return;
    }

    if (!appointmentForm.appointment) {
      alert("Vous devez renseigner la date et l'heure de versement de l'acompte.");
      return;
    }

    const linkedAppointment = appointments.find(
      (appointmentItem) =>
        String(appointmentItem.id) === String(appointmentForm.linkedAppointmentId)
    );

    if (!linkedAppointment) {
      alert("Le rendez-vous lié est introuvable.");
      return;
    }

    if (linkedAppointment.title === ACOMPTE_TYPE) {
      alert("Un acompte ne peut pas être lié à un autre acompte.");
      return;
    }

    if (String(linkedAppointment.clientId) !== String(appointmentForm.clientId)) {
      alert("L'acompte doit être lié à un rendez-vous du même client.");
      return;
    }

    const acompteDate = toDate(appointmentForm.appointment);
    const linkedDate = toDate(linkedAppointment.appointment);

    if (!acompteDate || !linkedDate || linkedDate <= acompteDate) {
      alert("Le rendez-vous lié doit être postérieur à l'acompte.");
      return;
    }

    const depositAmount = Number(appointmentForm.price) || 0;
    const linkedPrice = Number(linkedAppointment.price) || 0;

    if (depositAmount <= 0) {
      alert("Le montant de l'acompte doit être supérieur à 0.");
      return;
    }

    if (linkedPrice > 0 && depositAmount > linkedPrice) {
      alert("Le montant de l'acompte ne peut pas dépasser le tarif du rendez-vous lié.");
      return;
    }
  }

  const linkedAppointment =
    appointmentForm.title === ACOMPTE_TYPE
      ? appointments.find(
          (appointmentItem) =>
            String(appointmentItem.id) === String(appointmentForm.linkedAppointmentId)
        )
      : null;

  const appointmentPrice =
    appointmentForm.price === "" ? 0 : Number(appointmentForm.price);

  let paymentCbAmount = 0;
  let paymentCashAmount = 0;

  const appointmentCategory = getAppointmentTypeCategory(
    appointmentForm.title
  );

  let saleAmount = 0;
  let serviceAmount = 0;

  if (appointmentCategory === "VENTE") {
    saleAmount = appointmentPrice;
    serviceAmount = 0;
  } else if (appointmentCategory === "PRESTATION + VENTE") {
    saleAmount = Number(appointmentForm.saleAmount) || 0;

    if (saleAmount > appointmentPrice) {
      alert("Le montant vente ne peut pas dépasser le montant total.");
      return;
    }
  
    serviceAmount = appointmentPrice - saleAmount;
  } else {
    saleAmount = 0;
    serviceAmount = appointmentPrice;
  }

  if (appointmentForm.paymentMethod === "CB") {
    paymentCbAmount = appointmentPrice;
  }

  if (appointmentForm.paymentMethod === "ESPÈCES") {
    paymentCashAmount = appointmentPrice;
  }

  if (appointmentForm.paymentMethod === "CB + ESPÈCES") {
    paymentCbAmount = Number(appointmentForm.paymentCbAmount) || 0;

    if (paymentCbAmount > appointmentPrice) {
      alert("Le montant CB ne peut pas dépasser le montant total du rendez-vous.");
      return;
    }

    paymentCashAmount = Math.max(0, appointmentPrice - paymentCbAmount);
  }    

  const payload = {
    user_id: session.user.id,
    client_id: Number(appointmentForm.clientId),
    artist_id: Number(appointmentForm.artistId),
    title: appointmentForm.title.trim(),
    project: appointmentForm.project.trim(),
    notes: appointmentForm.notes.trim(),
    appointment: appointmentForm.appointment,
    price: appointmentPrice,
    sale_amount: saleAmount,
    service_amount: serviceAmount,
    duration_hours:
      appointmentForm.durationHours === "" ? null : Number(appointmentForm.durationHours),
    duration_minutes:
      appointmentForm.durationMinutes === "" ? null : Number(appointmentForm.durationMinutes),
    cancelled: appointmentForm.cancelled || false,
    linked_appointment_id:
      appointmentForm.title === ACOMPTE_TYPE
        ? Number(appointmentForm.linkedAppointmentId)
        : null,
    payment_method: appointmentForm.paymentMethod.trim() || null,
    payment_cb_amount: paymentCbAmount,
    payment_cash_amount: paymentCashAmount,
    payment_date:
      appointmentForm.title === ACOMPTE_TYPE
        ? appointmentForm.appointment
        : null,
    original_total_before_deposit:
      appointmentForm.title === ACOMPTE_TYPE
        ? Number(linkedAppointment?.price) || 0
        : null,
  };

  if (editingAppointmentId !== null) {
    const { error } = await supabase
      .from("appointments")
      .update(payload)
      .eq("id", editingAppointmentId)
      .eq("user_id", session.user.id);

    if (error) {
      alert(error.message);
      return;
    }
  } else { 
    const { error } = await supabase.from("appointments").insert(payload);

    if (error) {
      alert(error.message);
      return;
    }
  }

  await loadSupabaseData();

  const appointmentDate = appointmentForm.appointment.slice(0, 10);

  setSelectedDate(appointmentDate);

  setShowSuccess(true);

  setTimeout(() => {
    setShowSuccess(false);
    resetAppointmentForm();

    if (pageHistory.includes("agenda")) {
      setPage("agenda");
    } else {
      goBack();
    }
  }, 1500);
};

  const editAppointment = (appointmentItem) => {
    setAppointmentForm({
      clientId: String(appointmentItem.clientId || ""),
      artistId: String(appointmentItem.artistId || ""),
      title: appointmentItem.title || "",
      project: appointmentItem.project || "",
      notes: appointmentItem.notes || "",
      appointment: formatDateTimeLocalInput(appointmentItem.appointment),
      price: appointmentItem.price ?? "",
      saleAmount: "",
      serviceAmount: "",
      durationHours: appointmentItem.durationHours ?? "",
      durationMinutes: appointmentItem.durationMinutes ?? "",
      cancelled: appointmentItem.cancelled || false,
      linkedAppointmentId: appointmentItem.linkedAppointmentId
        ? String(appointmentItem.linkedAppointmentId)
        : "",
      paymentMethod: appointmentItem.paymentMethod || "",
      paymentCbAmount: appointmentItem.paymentCbAmount ?? "",
      paymentCashAmount: appointmentItem.paymentCashAmount ?? "",
      paymentDate: appointmentItem.paymentDate || "",
      originalTotalBeforeDeposit: appointmentItem.originalTotalBeforeDeposit ?? "",
      saleAmount: appointmentItem.saleAmount ?? "",
      serviceAmount: appointmentItem.serviceAmount ?? "",
    });

    if (appointmentItem.appointment) {
      setSelectedDate(appointmentItem.appointment.slice(0, 10));
    }

    setEditingAppointmentId(appointmentItem.id);
    navigateTo("appointments");
  };

const deleteAppointment = async (appointmentId) => {
  if (!session?.user) return;

  const appointmentToDelete = appointments.find(
    (appointmentItem) => String(appointmentItem.id) === String(appointmentId)
  );

  if (!appointmentToDelete) {
    alert("Rendez-vous introuvable.");
    return;
  }

  const linkedDeposits = getDepositsForAppointment(appointments, appointmentId);

  if (linkedDeposits.length > 0) {
    const confirmDeleteDeposit = window.confirm(
      "Attention : un ou plusieurs acomptes sont liés à ce rendez-vous.\n\nVoulez-vous supprimer l'acompte également ?"
    );

    if (confirmDeleteDeposit) {
      const confirmFinalDelete = window.confirm(
        "Confirmation finale : vous allez supprimer le rendez-vous ET le ou les acomptes liés.\n\nConfirmer la suppression ?"
      );

      if (!confirmFinalDelete) return;

      const depositIds = linkedDeposits.map((deposit) => deposit.id);

      const { error: depositsError } = await supabase
        .from("appointments")
        .delete()
        .in("id", depositIds)
        .eq("user_id", session.user.id);

      if (depositsError) {
        alert(depositsError.message);
        return;
      }

      const { error: appointmentError } = await supabase
        .from("appointments")
        .delete()
        .eq("id", appointmentId)
        .eq("user_id", session.user.id);

      if (appointmentError) {
        alert(appointmentError.message);
        return;
      }

            await loadSupabaseData();

                  if (editingAppointmentId === appointmentId) {
                    resetAppointmentForm();
                  }

                  if (String(selectedAppointmentId) === String(appointmentId)) {
                    setSelectedAppointmentId(null);
                    navigateTo("agenda");
                  }

                  return;
    }

    const confirmDeleteOnlyAppointment = window.confirm(
      "L'acompte lié sera conservé.\n\nConfirmez-vous la suppression du rendez-vous seul ?"
    );

    if (!confirmDeleteOnlyAppointment) return;

    const { error } = await supabase
      .from("appointments")
      .delete()
      .eq("id", appointmentId)
      .eq("user_id", session.user.id);

    if (error) {
      alert(error.message);
      return;
    }

        await loadSupabaseData();

            if (editingAppointmentId === appointmentId) {
              resetAppointmentForm();
            }

            if (String(selectedAppointmentId) === String(appointmentId)) {
              setSelectedAppointmentId(null);
              navigateTo("agenda");
            }

            return;
  }

  const confirmDelete = window.confirm(
    "Confirmez-vous la suppression de ce rendez-vous ?"
  );

  if (!confirmDelete) return;

  const { error } = await supabase
    .from("appointments")
    .delete()
    .eq("id", appointmentId)
    .eq("user_id", session.user.id);

  if (error) {
    alert(error.message);
    return;
  }

    await loadSupabaseData();

  if (editingAppointmentId === appointmentId) {
    resetAppointmentForm();
  }

  if (String(selectedAppointmentId) === String(appointmentId)) {
    setSelectedAppointmentId(null);
    navigateTo("agenda");
  }
};

  const toggleClientProjects = (clientId) => {
    setExpandedClientId((prev) => (prev === clientId ? null : clientId));
  };

const getClientAppointments = (clientId) => {
  return appointmentsWithClient
    .filter((appointmentItem) => appointmentItem.clientId === clientId)
    .sort((a, b) => (b.appointment || "").localeCompare(a.appointment || ""));
};

  const clientHasAppointments = (clientId) => {
  return appointments.some(
    (appointmentItem) => String(appointmentItem.clientId) === String(clientId)
  );
};

const serviceHasAppointments = (serviceName) => {
  return appointments.some(
    (appointmentItem) => appointmentItem.title === serviceName
  );
};

const isClosedDay = (dateKey) => {
  return closedDays.some((item) => item.day === dateKey);
};

const toggleClosedDay = async (dateKey) => {
  if (!session?.user) return;

  const existing = closedDays.find(
    (item) => item.day === dateKey
  );

  if (existing) {
    const { error } = await supabase
      .from("closed_days")
      .delete()
      .eq("id", existing.id);

    if (error) {
      alert(error.message);
      return;
    }
  } else {
    const { error } = await supabase
      .from("closed_days")
      .insert({
        user_id: session.user.id,
        day: dateKey,
      });

    if (error) {
      alert(error.message);
      return;
    }
  }

  await loadSupabaseData();
};

const artistHasAppointments = (artistId) => {
  return appointments.some(
    (appointmentItem) => String(appointmentItem.artistId) === String(artistId)
  );
};

const goPrevious = () => {
  if (agendaView === "month") {
    const [year, month] = selectedDate.split("-").map(Number);
    const date = new Date(year, month - 2, 1);
    setSelectedDate(formatDateKey(date));
    return;
  }

  if (agendaView === "week") {
    const [year, month, day] = selectedDate.split("-").map(Number);
    const date = addDays(new Date(year, month - 1, day), -7);
    setSelectedDate(formatDateKey(date));
    return;
  }

  const [year, month, day] = selectedDate.split("-").map(Number);
  const date = new Date(year, month - 1, day - 1);
  setSelectedDate(formatDateKey(date));
};

const goNext = () => {
  if (agendaView === "month") {
    const [year, month] = selectedDate.split("-").map(Number);
    const date = new Date(year, month, 1);
    setSelectedDate(formatDateKey(date));
    return;
  }

  if (agendaView === "week") {
    const [year, month, day] = selectedDate.split("-").map(Number);
    const date = addDays(new Date(year, month - 1, day), 7);
    setSelectedDate(formatDateKey(date));
    return;
  }

  const [year, month, day] = selectedDate.split("-").map(Number);
  const date = new Date(year, month - 1, day + 1);
  setSelectedDate(formatDateKey(date));
};

  const renderSpecialDayBadge = (dateKey) => {
    const info = getSpecialDayInfo(dateKey, schoolZone);
    if (!info) return null;

    return (
      <div
        className={`special-day-badge ${
          info.type === "publicHoliday" ? "public-holiday-badge" : "school-holiday-badge"
        }`}
      >
        {info.label}
      </div>
    );
  };



  if (loadingSession) {
    return (
      <div className="container">
        <div className="card">Chargement...</div>
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  if (checkingSetup) {
    return (
      <div className="container">
        <div className="card">Chargement de la configuration...</div>
      </div>
    );
  }

  if (!setupComplete && page !== "artists" && page !== "services") {
    return (
      <div className="container">
        <div className="card">
          <h1>Configuration initiale</h1>
          <p>
            Avant d’utiliser l’application, vous devez ajouter au moins un tatoueur
            et au moins une prestation.
          </p>

          <div className="setup-status">
            <p>
              <strong>Tatoueurs :</strong> {artists.length > 0 ? "OK" : "À compléter"}
            </p>
            <p>
              <strong>Prestations :</strong> {canFinishSetup ? "OK" : "À compléter"}
            </p>
          </div>

          <div className="action-buttons" style={{ marginBottom: "16px" }}>
            <button onClick={() => navigateTo("artists")}>
              Configurer les tatoueurs
            </button>
            <button onClick={() => navigateTo("services")}>
              Configurer les prestations
            </button>
          </div>

          <button
            onClick={() => {
              if (!canFinishSetup) {
                alert("Ajoute au moins un tatoueur et une prestation.");
                return;
              }
              setSetupComplete(true);
              navigateTo("home");
            }}
            disabled={!canFinishSetup}
          >
            Commencer à utiliser l’application
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      {showSuccess && (
        <div className="success-overlay">
          <div className="success-box">✔ RDV enregistré</div>
        </div>
      )}

      {page !== "home" && setupComplete && (
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginBottom: "16px",
          }}
        >
          <button className="back-button" onClick={goBack}>
            ← Retour
          </button>
        </div>
      )}

      {!setupComplete && (
        <div className="card" style={{ marginBottom: "16px" }}>
          <h2>Configuration requise</h2>
          <p>
            Vous devez d’abord créer au moins un tatoueur et une prestation avant
            d’utiliser le reste de l’application.
          </p>

          <div className="action-buttons">
            <button onClick={() => navigateTo("artists")}>Tatoueurs</button>
            <button onClick={() => navigateTo("services")}>Prestations</button>
          </div>
        </div>
      )}

      {page === "home" && setupComplete && (
        <section className="card home-card">
          <h2>Accueil</h2>
          <div
            className="home-menu-grid"
            style={
              isMobile
                ? {
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "12px",
                  }
                : undefined
            }
          >

            <button
              className="home-menu-button home-menu-primary home-menu-logo-button"
              onClick={() => {
                setAgendaView("month");
                navigateTo("agenda");
              }}
            >
              <div className="home-menu-logo-wrap">
                <img
                  src="/icons/agenda.png"
                  alt="Agenda"
                  className="home-menu-full-logo"
                />
              </div>
            </button>

            <button
              className="home-menu-button home-menu-primary home-menu-logo-button"
              onClick={() => navigateTo("revenue")}
            >
              <div className="home-menu-logo-wrap">
                <img
                  src="/icons/ca.png"
                  alt="Chiffre d'affaires"
                  className="home-menu-full-logo"
                />
              </div>
            </button>

            <button
              className="home-menu-button home-menu-primary home-menu-logo-button"
              onClick={() => navigateTo("clients")}
            >
              <div className="home-menu-logo-wrap">
                <img
                  src="/icons/fiches-clients.png"
                  alt="Fiches clients"
                  className="home-menu-full-logo"
                />
              </div>
            </button>

            <button
              className="home-menu-button home-menu-primary home-menu-logo-button"
              onClick={() => navigateTo("searchAppointments")}
            >
              <div className="home-menu-logo-wrap">
                <img
                  src="/icons/search-rdv.png"
                  alt="Rechercher un rendez-vous"
                  className="home-menu-full-logo"
                />
              </div>
            </button>

            <button
              className="home-menu-button home-menu-primary home-menu-logo-button"
              onClick={() => navigateTo("stats")}
            >
              <div className="home-menu-logo-wrap">
                <img
                  src="/icons/statistiques.png"
                  alt="Statistiques"
                  className="home-menu-full-logo"
                />
              </div>
            </button>

            <button
              className="home-menu-button home-menu-primary home-menu-logo-button"
              onClick={() => navigateTo("settings")}
            >
              <div className="home-menu-logo-wrap">
                <img
                  src="/icons/settings.png"
                  alt="Paramètres"
                  className="home-menu-full-logo"
                />
              </div>
            </button>
          </div>
        </section>
      )}

      {page === "agenda" && setupComplete && (
        <>
          <div className="home-layout">
            <section className="card agenda-main-card">
              <div className="agenda-topbar agenda-topbar-compact">
                <div className="agenda-title-row">
                  <div className="agenda-title-block">
                    <h2 className="planning-title" translate="no">
                      PLANNING
                    </h2>
                  </div>

                  <button
                    type="button"
                    className="btn-add-rdv-inline"
                    onClick={openNewAppointmentForm}
                  >
                    <span className="plus">+</span>
                  </button>
                </div>
              </div>

              <div className="agenda-toolbar">
                <div className="view-switch">
                  <button
                    type="button"
                    className={agendaView === "day" ? "active-view" : ""}
                    onClick={() => {
                      setAgendaView("day");
                      setShowMobileWeek(false);
                    }}
                  >
                    Vue jour
                  </button>

                  {!isMobile && (
                    <button
                      type="button"
                      className={agendaView === "week" ? "active-view" : ""}
                      onClick={() => setAgendaView("week")}
                    >
                      Vue semaine
                    </button>
                  )}

                  {isMobile && (
                    <button
                      type="button"
                      className={showMobileWeek ? "active-view" : ""}
                      onClick={() => {
                        if (showMobileWeek) {
                          setShowMobileWeek(false);
                          setAgendaView("day");
                        } else {
                          setShowMobileWeek(true);
                          setAgendaView("week");
                        }
                      }}
                    >
                      {showMobileWeek ? "Masquer semaine" : "Voir semaine"}
                    </button>
                  )}

                  <button
                    type="button"
                    className={agendaView === "month" ? "active-view" : ""}
                    onClick={() => {
                      setAgendaView("month");
                      setShowMobileWeek(false);
                    }}
                  >
                    Vue mois
                  </button>
                </div>

                <div className="agenda-controls">
                  {agendaView === "day" ? (
                    <>
                      <div className="agenda-date-navigation">
                        <button
                          type="button"
                          className="nav-arrow-button"
                          onClick={goPrevious}
                        >
                          ←
                        </button>

                        <input
                          type="date"
                          className="agenda-date-input"
                          value={selectedDate}
                          onChange={(e) => setSelectedDate(e.target.value)}
                        />

                        <button
                          type="button"
                          className="nav-arrow-button"
                          onClick={goNext}
                        >
                          →
                        </button>
                      </div>

                      <div className="agenda-artist-row">
                        <select
                          className="agenda-artist-filter"
                          value={agendaArtistFilter}
                          onChange={(e) => setAgendaArtistFilter(e.target.value)}
                        >
                          <option value="all">Tous les tatoueurs</option>
                          {artists
                            .slice()
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map((artist) => (
                              <option key={artist.id} value={artist.id}>
                                {artist.name}
                              </option>
                            ))}
                        </select>
                      </div>
                    </>
                  ) : agendaView === "week" ? (
                    <div className="agenda-nav-buttons">
                      <button
                        type="button"
                        className="nav-arrow-button"
                        onClick={goPrevious}
                      >
                        ←
                      </button>

                      <select
                        className="agenda-artist-filter"
                        value={agendaArtistFilter}
                        onChange={(e) => setAgendaArtistFilter(e.target.value)}
                      >
                        <option value="all">Tous les tatoueurs</option>
                        {artists
                          .slice()
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map((artist) => (
                            <option key={artist.id} value={artist.id}>
                              {artist.name}
                            </option>
                          ))}
                      </select>

                      <button type="button" className="nav-arrow-button" onClick={goNext}>
                        →
                      </button>
                    </div>
                  ) : null}
                </div>
                 <div className="closed-day-toggle">
                 <label>
                   <input
                     type="checkbox"
                     checked={isClosedDay(selectedDate)}
                     onChange={() => toggleClosedDay(selectedDate)}
                   />
                   Journée en congés
                </label>
               </div>
              </div>

              {agendaView === "day" && (
                <div
                  className={`agenda-panel ${
                    isClosedDay(selectedDate) ? "closed-day-panel" : ""
                  }`}
                >
                  <h3>Planning du jour</h3>

                  {renderSpecialDayBadge(selectedDate)}

                  {selectedDayAppointments.length === 0 ? (
                    <>
                      <p>Aucun rendez-vous pour cette date.</p>
                      {selectedDayRevenueBox}
                    </>
                  ) : (
                    <>
                      {selectedDayAppointments.map((appointmentItem) => (
                        <button
                          key={appointmentItem.id}
                          type="button"
                          className={`agenda-item month-day-appointment-card ${
                            appointmentItem.cancelled ? "cancelled-appointment" : ""
                          }`}
                          style={{
                            borderLeft: `6px solid ${appointmentItem.artistColor || "#111111"}`,
                            backgroundColor: appointmentItem.cancelled ? "#d3d3d3" : "",
                          }}
                          onClick={() => openAppointmentDetails(appointmentItem)}
                        >
                          <div className="month-rdv-card-content">
                            <div className="month-rdv-topline">
                              <span className="month-rdv-time">
                                {formatTimeOnly(appointmentItem.appointment)}
                              </span>
                        
                              <span className="month-rdv-price">
                                {appointmentItem.price !== ""
                                  ? formatCurrency(getDisplayedPrice(appointmentItem, appointments))
                                  : "Non renseigné"}
                              </span>
                            </div>
                        
                            <div className="month-rdv-description">
                              {appointmentItem.project || appointmentItem.title || "Sans descriptif"}
                            </div>
                        
                            <div className="month-rdv-client">
                              <strong>Client :</strong> {appointmentItem.clientName}
                            </div>
                          </div>
                        </button>
                      ))}

                      {selectedDayRevenueBox}
                    </>
                  )}
                </div>
              )}

              {agendaView === "week" && (!isMobile || showMobileWeek) && (
                <div className="month-split-layout">
                  <div className="month-top-section">
                    <div className="month-view-title">
                      Semaine du {formatDateOnly(weekDays[0])} au{" "}
                      {formatDateOnly(weekDays[6])}
                    </div>

                    <div className="month-weekdays-row">
                      {weekDays.map((day) => {
                        const key = formatDateKey(day);
                        const isSelected = key === selectedDate;
                        const specialDayInfo = getSpecialDayInfo(key, schoolZone);
                        const isToday = key === getTodayDateOnly();
                        const items = appointmentsByDate[key] || [];
                        const closed = isClosedDay(key);

                        return (
                          <button
                            key={key}
                            type="button"
                            className={`month-cell month-cell-compact week-day-cell ${
                              isSelected ? "selected-cell" : ""
                            } ${isToday ? "today-cell" : ""} ${
                              closed ? "closed-day-cell" : ""
                            } ${
                              specialDayInfo?.type === "publicHoliday"
                                ? "public-holiday-cell"
                                : specialDayInfo?.type === "schoolHoliday"
                                ? "school-holiday-cell"
                                : ""
                            }`}
                            onClick={() => setSelectedDate(key)}
                          >
                            <div className="week-day-square-content">
                              <span className="week-day-number">{day.getDate()}</span>

                              <span className="week-day-label">
                                {new Intl.DateTimeFormat("fr-FR", {
                                  weekday: "short",
                                }).format(day)}
                              </span>

                              {items.length > 0 && <span className="month-day-marker"></span>}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="month-bottom-section">
                    <div className="month-selected-day-header">
                      <h3>Rendez-vous du {formatDateOnly(selectedDate)}</h3>
                      {renderSpecialDayBadge(selectedDate)}
                    </div>

                    <div className="month-day-appointments-list">
                      {selectedDayAppointments.length === 0 ? (
                        <>
                          <p>Aucun rendez-vous pour cette date.</p>
                          {selectedDayRevenueBox}
                        </>
                      ) : (
                        <>
                          {selectedDayAppointments.map((appointment) => (
                            <button
                              key={appointment.id}
                              className={`agenda-item month-day-appointment-card ${
                                appointment.cancelled ? "cancelled-appointment" : ""
                              }`}
                              onClick={() => openAppointmentDetails(appointment)}
                              type="button"
                              style={{
                                borderLeft: `6px solid ${appointment.artistColor || "#111111"}`,
                                backgroundColor: appointment.cancelled ? "#d3d3d3" : "",
                              }}
                            >
                              <div className="month-rdv-card-content">
                                <div className="month-rdv-topline">
                                  <span className="month-rdv-time">
                                    {formatTimeOnly(appointment.appointment)}
                                  </span>

                                  <span className="month-rdv-price">
                                    {appointment.price !== ""
                                      ? formatCurrency(
                                          getDisplayedPrice(appointment, appointments)
                                        )
                                      : "Non renseigné"}
                                  </span>
                                </div>

                                <div className="month-rdv-description">
                                  {appointment.project ||
                                    appointment.title ||
                                    "Sans descriptif"}
                                </div>

                                <div className="month-rdv-client">
                                  <strong>Client :</strong> {appointment.clientName}
                                </div>
                              </div>
                            </button>
                          ))}

                          {selectedDayRevenueBox}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {agendaView === "month" && (
                <div className="month-split-layout">
                  <div className="month-top-section">
                    <div className="month-controls">
                      <div className="month-navigation">
                        <button
                          type="button"
                          className="nav-arrow-button"
                          onClick={goPrevious}
                        >
                          ←
                        </button>

                        <div className="month-title-centered">{monthViewTitle}</div>

                        <button type="button" className="nav-arrow-button" onClick={goNext}>
                          →
                        </button>
                      </div>

                      <div className="month-artist-row">
                        <select
                          className="agenda-artist-filter"
                          value={agendaArtistFilter}
                          onChange={(e) => setAgendaArtistFilter(e.target.value)}
                        >
                          <option value="all">Tous les tatoueurs</option>
                          {artists
                            .slice()
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map((artist) => (
                              <option key={artist.id} value={artist.id}>
                                {artist.name}
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>

                    <div className="month-weekdays-row">
                      {["L", "M", "M", "J", "V", "S", "D"].map((label, index) => (
                        <div key={`${label}-${index}`} className="month-weekday-cell">
                          {label}
                        </div>
                      ))}
                    </div>

                    <div className="month-grid month-grid-compact">
                      {monthCells.map((cell, index) => {
                        if (!cell) {
                          return (
                            <div
                              key={`empty-${index}`}
                              className="month-cell empty-cell"
                            ></div>
                          );
                        }

                        const key = formatDateKey(cell);
                        const items = appointmentsByDate[key] || [];
                        const isSelected = key === selectedDate;
                        const specialDayInfo = getSpecialDayInfo(key, schoolZone);
                        const isToday = key === getTodayDateOnly();
                        const closed = isClosedDay(key);

                        return (
                          <button
                            key={key}
                            type="button"
                            className={`month-cell month-cell-compact week-day-cell ${
                              isSelected ? "selected-cell" : ""
                            } ${isToday ? "today-cell" : ""} ${
                              closed ? "closed-day-cell" : ""
                            } ${
                              specialDayInfo?.type === "publicHoliday"
                                ? "public-holiday-cell"
                                : specialDayInfo?.type === "schoolHoliday"
                                ? "school-holiday-cell"
                                : ""
                            }`}
                            onClick={() => setSelectedDate(key)}
                          >
                            <div className="month-day-number-wrap">
                              <span className="month-day-number">{cell.getDate()}</span>
                              {items.length > 0 && <span className="month-day-marker"></span>}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="month-bottom-section">
                    <div className="month-selected-day-header">
                      <h3>Rendez-vous du {formatDateOnly(selectedDate)}</h3>
                      {renderSpecialDayBadge(selectedDate)}
                    </div>

                    <div className="month-day-appointments-list">
                      {selectedDayAppointments.length === 0 ? (
                        <>
                          <p>Aucun rendez-vous pour cette date.</p>
                          {selectedDayRevenueBox}
                        </>
                      ) : (
                        <>
                          {selectedDayAppointments.map((appointment) => (
                            <button
                              key={appointment.id}
                              className={`agenda-item month-day-appointment-card ${
                                appointment.cancelled ? "cancelled-appointment" : ""
                              }`}
                              onClick={() => openAppointmentDetails(appointment)}
                              type="button"
                              style={{
                                borderLeft: `6px solid ${appointment.artistColor || "#111111"}`,
                                backgroundColor: appointment.cancelled ? "#d3d3d3" : "",
                              }}
                            >
                              <div className="month-rdv-card-content">
                                <div className="month-rdv-topline">
                                  <span className="month-rdv-time">
                                    {formatTimeOnly(appointment.appointment)}
                                  </span>
                    
                                  <span className="month-rdv-price">
                                    {appointment.price !== ""
                                      ? formatCurrency(
                                          getDisplayedPrice(appointment, appointments)
                                        )
                                      : "Non renseigné"}
                                  </span>
                                </div>
                    
                                <div className="month-rdv-description">
                                  {appointment.project ||
                                    appointment.title ||
                                    "Sans descriptif"}
                                </div>
                    
                                <div className="month-rdv-client">
                                  <strong>Client :</strong> {appointment.clientName}
                                </div>
                              </div>
                            </button>
                          ))}

                          {selectedDayRevenueBox}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        </>
      )}

      {page === "revenue" && setupComplete && (
        <section className="card">
          <div className="revenue-header">
            <div>
              <h2>Chiffre d’affaires</h2>
              <p className="muted-text">
                Calculé selon la date affichée et le tatoueur sélectionné
              </p>
            </div>

            <select
              value={revenueArtistFilter}
              onChange={(e) => setRevenueArtistFilter(e.target.value)}
              className="compact-select"
            >
              <option value="all">Tous les tatoueurs</option>
              {artists.map((artist) => (
                <option key={artist.id} value={artist.id}>
                  {artist.name}
                </option>
              ))}
            </select>
          </div>

          <div className="action-buttons" style={{ marginBottom: "16px" }}>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>

          <div className="revenue-stats">
            <div className="revenue-box gold-line-glow">
              <span>Jour</span>
              <strong>{formatCurrency(revenueStats.dayTotal)}</strong>
            </div>
            <div className="revenue-box gold-line-glow">
              <span>Semaine</span>
              <strong>{formatCurrency(revenueStats.weekTotal)}</strong>
            </div>
            <div className="revenue-box gold-line-glow">
              <span>Mois</span>
              <strong>{formatCurrency(revenueStats.monthTotal)}</strong>
            </div>
          </div>
        </section>
      )}

      {page === "settings" && setupComplete && (
        <section className="card">
          <h2>Paramètres</h2>
          <p className="muted-text">Gérez les données principales de l’application</p>

          <div className="card inner-card" style={{ marginBottom: "16px" }}>
            <h3>Vacances scolaires</h3>
            <p className="muted-text">
              Sélectionnez la zone scolaire utilisée dans l’agenda
            </p>

            <select
              value={schoolZone}
              onChange={(e) => setSchoolZone(e.target.value)}
              className="zone-select"
            >
              <option value="A">Zone scolaire A</option>
              <option value="B">Zone scolaire B</option>
              <option value="C">Zone scolaire C</option>
            </select>
          </div>

                    <div className="card inner-card" style={{ marginBottom: "16px" }}>
                      <h3>Import des rendez-vous</h3>
                      <p className="muted-text">
                        Téléchargez le modèle CSV puis importez vos rendez-vous.
                        Les clients doivent déjà exister dans les fiches clients.
                      </p>

                      <div className="action-buttons">                      
                        <button type="button" onClick={downloadAppointmentsCsvTemplate}>
                          Télécharger modèle CSV RDV
                        </button>

                        <label className="button-link" style={{ cursor: "pointer" }}>
                          Importer RDV CSV
                          <input
                            type="file"
                            accept=".csv"
                            onChange={importAppointmentsFromCsv}
                            style={{ display: "none" }}
                          />
                        </label>
                      </div>
                    </div>

                    <div className="card inner-card" style={{ marginBottom: "16px" }}>
                      <h3>Export des rendez-vous</h3>
                      <p className="muted-text">
                        Exportez les rendez-vous sur une période donnée au format CSV.
                      </p>
                    
                      <div className="form-grid">
                        <label>
                          Date de début
                          <input
                            type="date"
                            value={exportStartDate}
                            onChange={(e) => setExportStartDate(e.target.value)}
                          />
                        </label>

                        <label>
                          Date de fin
                          <input
                            type="date"
                            value={exportEndDate}
                            onChange={(e) => setExportEndDate(e.target.value)}
                          />
                        </label>
                      </div>

                      <div className="action-buttons">
                        <button type="button" onClick={exportAppointmentsCsv}>
                          Exporter les RDV CSV
                        </button>
                      </div>
                    </div>

          <div className="home-menu-grid">
            <button className="home-menu-button" onClick={() => navigateTo("services")}>
              <span className="home-menu-icon">🧾</span>
              <span className="home-menu-title">Prestations</span>
              <span className="home-menu-subtitle">
                Ajouter ou modifier les types de prestations
              </span>
            </button>

            <button className="home-menu-button" onClick={() => navigateTo("artists")}>
              <span className="home-menu-icon">🎨</span>
              <span className="home-menu-title">Tatoueurs</span>
              <span className="home-menu-subtitle">
                Ajouter ou modifier les tatoueurs
              </span>
            </button>

            <button className="home-menu-button" onClick={() => navigateTo("clients")}>
              <span className="home-menu-icon">👤</span>
              <span className="home-menu-title">Fiches clients</span>
              <span className="home-menu-subtitle">
                Créer une nouvelle fiche client
              </span>
            </button>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginTop: "24px",
            }}
          >
            <button
              className="logout-button"
              onClick={() => supabase.auth.signOut()}
            >
              Déconnexion
            </button>
          </div>
        </section>
      )}

      {page === "services" && (
        <section className="card">
          <h2>Prestations</h2>

          <div className="form-grid">
            <input
              type="text"
              placeholder="Nom de la prestation"
              value={serviceForm.name}
              onChange={(e) =>
                setServiceForm({ ...serviceForm, name: e.target.value })
              }
            />

            <select
              value={serviceForm.category}
              onChange={(e) =>
                setServiceForm({
                  ...serviceForm,
                  category: e.target.value,
                })
              }
            >
              <option value="PRESTATION">Prestation</option>
              <option value="VENTE">Vente</option>
              <option value="PRESTATION + VENTE">Prestation + vente</option>
            </select>
      
            <button type="button" onClick={saveService}>
              {editingServiceName ? "Modifier la prestation" : "Ajouter la prestation"}
            </button>
      
            {editingServiceName && (
              <button type="button" onClick={resetServiceForm}>
                Annuler
              </button>
            )}
          </div>
      
          <div className="appointments-list">
            {appointmentTypes.map((type) => (
              <div key={type.name} className="card inner-card">
                <h3>{type.name}</h3>
                <p>Catégorie : {type.category || "PRESTATION"}</p>

                {type.name !== ACOMPTE_TYPE && (
                  <div className="action-buttons">
                    <button onClick={() => editService(type)}>
                      Modifier
                    </button>

                    <button onClick={() => deleteService(type)}>
                      Supprimer
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {page === "artists" && (
        <section className="card">
          <h2>Tatoueurs</h2>
      
          <div className="form-grid">
            <input
              type="text"
              placeholder="Nom du tatoueur"
              value={artistForm.name}
              onChange={(e) =>
                setArtistForm({ ...artistForm, name: e.target.value })
              }
            />
      
            <input
              type="color"
              value={artistForm.color}
              onChange={(e) =>
                setArtistForm({ ...artistForm, name: e.target.value })
              }
            />
      
            <button type="button" onClick={saveArtist}>
              {editingArtistId ? "Modifier le tatoueur" : "Ajouter le tatoueur"}
            </button>
      
            {editingArtistId && (
              <button type="button" onClick={resetArtistForm}>
                Annuler
              </button>
            )}
          </div>

          <div className="appointments-list">
            {artists.map((artist) => (
              <div key={artist.id} className="card inner-card">
                <h3>{artist.name}</h3>

                <div className="action-buttons">
                  <button type="button" onClick={() => editArtist(artist)}>
                    Modifier
                  </button>
      
                  <button type="button" onClick={() => deleteArtist(artist.id)}>
                    Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {page === "searchAppointments" && setupComplete && (
        <section className="card">
          <h2>Rechercher un rendez-vous</h2>
          <p className="muted-text">
            Recherchez par nom, prénom, descriptif, date, heure, tatoueur, notes, etc.
          </p>

          <input
            type="text"
            placeholder="Ex : Léa, rose, Angel, 12/05/2026, 14:30..."
            value={searchAppointmentQuery}
            onChange={(e) => setSearchAppointmentQuery(e.target.value)}
            className="search-input"
            style={{ marginBottom: "16px" }}
          />

          {searchedAppointments.length === 0 ? (
            <p>Aucun rendez-vous trouvé.</p>
          ) : (
            <div className="appointments-list">
              {searchedAppointments.map((appointment) => {
                const client = clients.find((c) => c.id === appointment.clientId);
                const artist = artists.find((a) => a.id === appointment.artistId);
      
                const appointmentDate = appointment.appointment
                  ? new Date(appointment.appointment)
                  : null;
      
                return (
                  <div
                    key={appointment.id}
                    className="card"
                    style={{ marginBottom: "12px", cursor: "pointer" }}
                    onClick={() => openAppointmentDetails(appointment)}
                  >
                    <h3 style={{ marginBottom: "8px" }}>
                      {appointment.title || "Rendez-vous"}
                    </h3>
      
                    <p style={{ margin: "4px 0" }}>
                      <strong>Client :</strong>{" "}
                      {client
                        ? `${client.firstName || ""} ${client.lastName || ""}`.trim()
                        : "Non renseigné"}
                    </p>
      
                    <p style={{ margin: "4px 0" }}>
                      <strong>Date :</strong>{" "}
                      {appointmentDate
                        ? appointmentDate.toLocaleDateString("fr-FR")
                        : "Non renseignée"}
                      {" - "}
                      {appointmentDate
                        ? appointmentDate.toLocaleTimeString("fr-FR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : ""}
                    </p>
      
                    <p style={{ margin: "4px 0" }}>
                      <strong>Tatoueur :</strong> {artist?.name || "Non renseigné"}
                    </p>
      
                    {appointment.project && (
                      <p style={{ margin: "4px 0" }}>
                        <strong>Descriptif :</strong> {appointment.project}
                      </p>
                    )}

                    {appointment.notes && (
                      <p style={{ margin: "4px 0" }}>
                        <strong>Notes :</strong> {appointment.notes}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {page === "stats" && setupComplete && (
        <section className="card">
          <h2>Statistiques</h2>
          <p className="muted-text">Vue globale de l’activité</p>

          <div className="stats-grid">
            <div className="stats-box">
              <span>Clients</span>
              <strong>{globalStats.clientsCount}</strong>
            </div>

            <div className="stats-box">
              <span>Tatoueurs</span>
              <strong>{globalStats.artistsCount}</strong>
            </div>

            <div className="stats-box">
              <span>Prestations</span>
              <strong>{globalStats.servicesCount}</strong>
            </div>

            <div className="stats-box">
              <span>Rendez-vous</span>
              <strong>{globalStats.appointmentsCount}</strong>
            </div>

            <div className="stats-box">
              <span>Rendez-vous actifs</span>
              <strong>{globalStats.activeAppointmentsCount}</strong>
            </div>

            <div className="stats-box">
              <span>CA total enregistré</span>
              <strong>{formatCurrency(globalStats.totalRevenue)}</strong>
            </div>
          </div>
        </section>
      )}

      {page === "client-appointments" && (
        <section className="card">
          <h2>
            Rendez-vous de {formatClientName(selectedClientDetails)}
          </h2>

          {selectedClientAppointments.length === 0 ? (
            <p>Aucun rendez-vous trouvé.</p>
          ) : (
            <div className="client-appointments-list">
              {selectedClientAppointments.map((appointment) => (
                <div
                  key={appointment.id}
                  className="history-box client-appointment-card"
                  onClick={() => openAppointmentDetails(appointment)}
                  style={{ cursor: "pointer" }}
                >
                  <div className="client-appointment-title">
                    {appointment.project}
                  </div>
      
                  <div>{formatDateTime(appointment.appointment)}</div>
      
                  <div>{appointment.artistName}</div>
      
                  <div>
                    {formatCurrency(
                      getDisplayedPrice(appointment, appointments)
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {page === "client-details" && setupComplete && selectedClientDetails && (
        <section className="card">
          <h2>Détail de la fiche client</h2>

          <div className="client-box">
            <h3>{formatClientName(selectedClientDetails)}</h3>
            <p>
              <strong>Nom :</strong> {selectedClientDetails.lastName || "Non renseigné"}
            </p>
            <p>
              <strong>Prénom :</strong>{" "}
              {selectedClientDetails.firstName || "Non renseigné"}
            </p>
            <p>
              <strong>Téléphone :</strong>{" "}
              {selectedClientDetails.phone || "Non renseigné"}
            </p>
            <p>
              <strong>Notes :</strong> {selectedClientDetails.notes || "Aucune note"}
            </p>
            <p>
              <strong>Nombre de rendez-vous liés :</strong>{" "}
              {getClientAppointments(selectedClientDetails.id).length}
            </p>

            {getClientPhone(selectedClientDetails) && (
              <div className="action-buttons" style={{ marginTop: "16px" }}>
                <a
                  href={`tel:${getClientPhone(selectedClientDetails)}`}
                  className="button-link"
                >
                  Appeler
                </a>

                <a
                  href={`sms:${getClientPhone(selectedClientDetails)}`}
                  className="button-link"
                >
                  SMS
                </a>
              </div>
            )}
          </div>

          <button
            onClick={() => openClientAppointments(selectedClientDetails.id)}
          >
            📅 Voir les rendez-vous du client
          </button>

          <div className="action-buttons" style={{ marginTop: "20px" }}>
            <button onClick={() => editClient(selectedClientDetails)}>Modifier</button>

            <button
              onClick={() => deleteClient(selectedClientDetails.id)}
              disabled={clientHasAppointments(selectedClientDetails.id)}
              title={
                clientHasAppointments(selectedClientDetails.id)
                  ? "Suppression impossible : ce client a des rendez-vous"
                  : "Supprimer cette fiche client"
              }
            >
              Supprimer
            </button>
          </div>
        </section>
      )}

      {page === "appointment-details" && setupComplete && selectedAppointmentDetails && (
        <section className="card">
          <h2>Détail du rendez-vous</h2>

          <div className="client-box">
            <h3>
              {selectedAppointmentDetails.project ||
                selectedAppointmentDetails.title ||
                "Rendez-vous"}
            </h3>
      
            <p>
              <strong>Client :</strong>{" "}
              {selectedAppointmentDetails.client ? (
                <button
                  type="button"
                  className="inline-link-button"
                  onClick={() => {
                    setSelectedClientId(selectedAppointmentDetails.client.id);
                    navigateTo("client-details");
                  }}
                >
                  {selectedAppointmentDetails.clientName}
                </button>
              ) : (
                selectedAppointmentDetails.clientName || "Non renseigné"
              )}
            </p>
      
            {getClientPhone(selectedAppointmentDetails.client) && (
              <div className="action-buttons" style={{ marginTop: "12px" }}>
                <a
                  href={`tel:${getClientPhone(selectedAppointmentDetails.client)}`}
                  className="button-link"
                >
                  Appeler
                </a>
      
                <a
                  href={`sms:${getClientPhone(selectedAppointmentDetails.client)}`}
                  className="button-link"
                >
                  Envoyer SMS
                </a>
              </div>
            )}

            <p><strong>Tatoueur :</strong> {selectedAppointmentDetails.artistName || "Non renseigné"}</p>
            <p><strong>Type :</strong> {selectedAppointmentDetails.title || "Non renseigné"}</p>
            <p><strong>Date :</strong> {formatDateTime(selectedAppointmentDetails.appointment)}</p>
            <p><strong>Durée :</strong> {formatDuration(selectedAppointmentDetails.durationHours, selectedAppointmentDetails.durationMinutes)}</p>
      
            <p>
              <strong>Tarif total :</strong>{" "}
              {selectedAppointmentDetails.price !== ""
                ? formatCurrency(getDisplayedPrice(selectedAppointmentDetails, appointments))
                : "Non renseigné"}
            </p>
      
            <div style={{ marginTop: "22px", paddingTop: "16px", borderTop: "1px solid rgba(245, 190, 65, 0.35)" }}>
              <p>
                <strong>Mode de paiement :</strong>{" "}
                {selectedAppointmentDetails.paymentMethod || "Non renseigné"}
                {selectedAppointmentDetails.paymentMethod === "CB + ESPÈCES" &&
                  ` (${formatCurrency(selectedAppointmentDetails.paymentCbAmount)} en CB + ${formatCurrency(selectedAppointmentDetails.paymentCashAmount)} en espèces)`}
              </p>
      
              {(() => {
                const category = getAppointmentTypeCategory(selectedAppointmentDetails.title);
                const total = getDisplayedPrice(selectedAppointmentDetails, appointments);

                const saleAmount =
                  category === "VENTE"
                    ? total
                    : Number(selectedAppointmentDetails.saleAmount) || 0;

                const serviceAmount =
                  category === "PRESTATION"
                    ? total
                    : category === "PRESTATION + VENTE"
                    ? Math.max(0, total - saleAmount)
                    : 0;

                return (
                  <>
                    <p>
                      <strong>Catégorie :</strong> {category}
                    </p>
              
                    {category === "PRESTATION" && (
                      <p>
                        <strong>Montant prestation :</strong> {formatCurrency(serviceAmount)}
                      </p>
                    )}
              
                    {category === "VENTE" && (
                      <p>
                        <strong>Montant vente :</strong> {formatCurrency(saleAmount)}
                      </p>
                    )}
              
                    {category === "PRESTATION + VENTE" && (
                      <>
                        <p>
                          <strong>Montant prestation :</strong> {formatCurrency(serviceAmount)}
                        </p>
              
                        <p>
                          <strong>Montant vente :</strong> {formatCurrency(saleAmount)}
                        </p>
                      </>
                    )}
                  </>
                );
              })()}
            </div>
      
            <div style={{ marginTop: "22px", paddingTop: "16px", borderTop: "1px solid rgba(245, 190, 65, 0.35)" }}>
              <p>
                <strong>Notes :</strong>{" "}
                {[selectedAppointmentDetails.notes, buildSystemDepositNotes(appointments, selectedAppointmentDetails)]
                  .filter(Boolean)
                  .join(" | ") || "Aucune note"}
              </p>
            </div>
          </div>

          <div className="action-buttons" style={{ marginTop: "20px" }}>
            <button onClick={() => editAppointment(selectedAppointmentDetails)}>
              Modifier
            </button>
      
            <button onClick={() => deleteAppointment(selectedAppointmentDetails.id)}>
              Supprimer
            </button>
          </div>
        </section>
      )}    

      {page === "appointments" && setupComplete && (
  <div className="grid">
    <section className="card form-card">
      <h2>
        {editingAppointmentId !== null
          ? "Modifier un rendez-vous"
          : "Créer un rendez-vous"}
      </h2>

      <div className="field-header">
        <span className="field-header-label">Client</span>

        <button
          type="button"
          className="inline-link-button"
          onClick={() => setShowQuickClientForm((prev) => !prev)}
        >
          {showQuickClientForm ? "Fermer" : "+ Nouveau client"}
        </button>
      </div>

      <input
        type="text"
        placeholder="Rechercher un client par nom ou prénom..."
        value={appointmentClientSearch}
        onChange={(e) => setAppointmentClientSearch(e.target.value)}
      />

      <select
        value={appointmentForm.clientId}
        onChange={(e) =>
          setAppointmentForm({
            ...appointmentForm,
            clientId: e.target.value,
          })
        }
      >
        <option value="">Sélectionner un client</option>

        {filteredAppointmentClients.map((client) => (
          <option key={client.id} value={client.id}>
            {formatClientName(client)}
          </option>
        ))}
      </select>

      {showQuickClientForm && (
        <div className="card inner-card">
          <h3>Créer une fiche client sans quitter le rendez-vous</h3>

          <input
            type="text"
            placeholder="Nom"
            value={quickClientForm.lastName}
            onChange={(e) =>
              setQuickClientForm({
                ...quickClientForm,
                lastName: e.target.value,
              })
            }
          />

          <input
            type="text"
            placeholder="Prénom"
            value={quickClientForm.firstName}
            onChange={(e) =>
              setQuickClientForm({
                ...quickClientForm,
                firstName: e.target.value,
              })
            }
          />

          <input
            type="text"
            placeholder="Téléphone"
            value={quickClientForm.phone}
            onChange={(e) =>
              setQuickClientForm({
                ...quickClientForm,
                phone: e.target.value,
              })
            }
          />

          <textarea
            placeholder="Notes client"
            value={quickClientForm.notes}
            onChange={(e) =>
              setQuickClientForm({
                ...quickClientForm,
                notes: e.target.value,
              })
            }
          />

          <div className="action-buttons">
            <button type="button" onClick={saveQuickClient}>
              Ajouter ce client
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={resetQuickClientForm}
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      <select
        value={appointmentForm.artistId}
        onChange={(e) =>
          setAppointmentForm({
            ...appointmentForm,
            artistId: e.target.value,
          })
        }
      >
        <option value="">Sélectionner un tatoueur</option>
        {artists
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((artist) => (
            <option key={artist.id} value={artist.id}>
              {artist.name}
            </option>
          ))}
      </select>

      <select
        value={appointmentForm.title}
        onChange={(e) =>
          setAppointmentForm({
            ...appointmentForm,
            title: e.target.value,
          })
        }
      >
        <option value="">Sélectionner un type de prestation</option>
        {appointmentTypes.map((type) => (
          <option key={type.name} value={type.name}>
            {type.name}
          </option>
        ))}
      </select>

      {appointmentForm.title === ACOMPTE_TYPE && (
        <>
          <select
            value={appointmentForm.linkedAppointmentId}
            onChange={(e) =>
              setAppointmentForm({
                ...appointmentForm,
                linkedAppointmentId: e.target.value,
              })
            }
          >
            <option value="">Sélectionner le rendez-vous futur à lier</option>
            {eligibleLinkedAppointments.map((appointmentItem) => (
              <option key={appointmentItem.id} value={appointmentItem.id}>
                {formatDateTime(appointmentItem.appointment)} — {appointmentItem.project} —{" "}
                {appointmentItem.price !== ""
                  ? formatCurrency(appointmentItem.price)
                  : "Sans tarif"}
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Mode de paiement de l'acompte"
            value={appointmentForm.paymentMethod}
            onChange={(e) =>
              setAppointmentForm({
                ...appointmentForm,
                paymentMethod: e.target.value,
              })
            }
          />
        </>
      )}

      <input
        type="text"
        placeholder="Nom du projet"
        value={appointmentForm.project}
        onChange={(e) =>
          setAppointmentForm({
            ...appointmentForm,
            project: e.target.value,
          })
        }
      />

      <input
        type="datetime-local"
        value={appointmentForm.appointment}
        onChange={(e) =>
          setAppointmentForm({
            ...appointmentForm,
            appointment: e.target.value,
          })
        }
      />

      <div className="form-field">
        <label className="input-label">Montant</label>

        <div className="input-with-suffix">
          <input
            type="number"
            min="0"
            step="0.01"
            value={appointmentForm.price}
            onChange={(e) =>
              setAppointmentForm({
                ...appointmentForm,
                price: e.target.value,
              })
            }
            className="price-input"
          />
          <span className="input-suffix">€</span>
        </div>
      </div>

      {getAppointmentTypeCategory(appointmentForm.title) === "PRESTATION + VENTE" && (
        <div className="form-field">
          <label className="input-label">Montant vente</label>

          <div className="input-with-suffix">
            <input
              type="number"
              min="0"
              step="0.01"
              value={appointmentForm.saleAmount}
              onChange={(e) =>
                setAppointmentForm({
                  ...appointmentForm,
                  saleAmount: e.target.value,
                })
              }
              className="price-input"
            />
            <span className="input-suffix">€</span>
          </div>

          <p>
            Prestation calculée :{" "}
            <strong>
              {formatCurrency(
                Math.max(
                  0,
                  Number(appointmentForm.price) -
                    Number(appointmentForm.saleAmount || 0)
                )
              )}
            </strong>
          </p>
        </div>
      )}

      <div className="duration-row">
        <div className="input-with-suffix">
          <input
            type="number"
            min="0"
            value={appointmentForm.durationHours}
            onChange={(e) =>
              setAppointmentForm({
                ...appointmentForm,
                durationHours: e.target.value,
              })
            }
            className="price-input"
          />
          <span className="input-suffix">H</span>
        </div>

        <div className="input-with-suffix">
          <input
            type="number"
            min="0"
            max="59"
            value={appointmentForm.durationMinutes}
            onChange={(e) =>
              setAppointmentForm({
                ...appointmentForm,
                durationMinutes: e.target.value,
              })
            }
            className="price-input"
          />
          <span className="input-suffix">min</span>
        </div>
      </div>

      <select
        value={appointmentForm.paymentMethod}
        onChange={(e) => {
          const paymentMethod = e.target.value;
          const total = Number(appointmentForm.price) || 0;

          setAppointmentForm({
            ...appointmentForm,
            paymentMethod,
            paymentCbAmount:
              paymentMethod === "CB" ? total : paymentMethod === "CB + ESPÈCES" ? appointmentForm.paymentCbAmount : "",
            paymentCashAmount:
              paymentMethod === "ESPÈCES" ? total : paymentMethod === "CB + ESPÈCES" ? appointmentForm.paymentCashAmount : "",
          });
        }}
      >
        <option value="">Moyen de paiement non renseigné</option>
        <option value="CB">CB</option>
        <option value="ESPÈCES">Espèces</option>
        <option value="CB + ESPÈCES">CB + Espèces</option>
        <option value="VIREMENT">Virement</option>
      </select>

      {appointmentForm.paymentMethod === "CB + ESPÈCES" && (
        <div className="form-field">
          <label className="input-label">Montant payé en CB</label>

          <div className="input-with-suffix">
            <input
              type="number"
              min="0"
              step="0.01"
              value={appointmentForm.paymentCbAmount}
              onChange={(e) => {
                const cbAmount = Number(e.target.value) || 0;
                const total = Number(appointmentForm.price) || 0;
                const cashAmount = Math.max(0, total - cbAmount);

                setAppointmentForm({
                  ...appointmentForm,
                  paymentCbAmount: e.target.value,
                  paymentCashAmount: cashAmount,
                });
              }}
              className="price-input"
            />
            <span className="input-suffix">€</span>
          </div>

          <p>
            Espèces calculées automatiquement :{" "}
            <strong>{formatCurrency(appointmentForm.paymentCashAmount)}</strong>
          </p>
        </div>
      )}

      <textarea
        placeholder="Notes du rendez-vous"
        value={appointmentForm.notes}
        onChange={(e) =>
          setAppointmentForm({
            ...appointmentForm,
            notes: e.target.value,
          })
        }
      />

      {editingAppointmentId !== null && (
        <label className="cancel-checkbox">
          <input
            type="checkbox"
            checked={appointmentForm.cancelled || false}
            onChange={(e) =>
              setAppointmentForm({
                ...appointmentForm,
                cancelled: e.target.checked,
              })
            }
          />
          Annulé
        </label>
      )}

      <button type="button" onClick={saveAppointment}>
        {editingAppointmentId !== null
          ? "Enregistrer les modifications"
          : "Ajouter le rendez-vous"}
      </button>

      {editingAppointmentId !== null && (
        <button
          className="secondary-button full-width"
          onClick={resetAppointmentForm}
        >
          Annuler la modification
        </button>
      )}
    </section>
  </div>
)}

{page === "client-form" && setupComplete && (
  <section className="card">
    <h2>
      {editingClientId !== null
        ? "Modifier la fiche client"
        : "Nouvelle fiche client"}
    </h2>

    <div className="form-grid">
      <input
        type="text"
        placeholder="Nom"
        value={clientForm.lastName}
        onChange={(e) =>
          setClientForm({ ...clientForm, lastName: e.target.value })
        }
      />

      <input
        type="text"
        placeholder="Prénom"
        value={clientForm.firstName}
        onChange={(e) =>
          setClientForm({ ...clientForm, firstName: e.target.value })
        }
      />

      <input
        type="tel"
        placeholder="Téléphone"
        value={clientForm.phone}
        onChange={(e) =>
          setClientForm({ ...clientForm, phone: e.target.value })
        }
      />

      <textarea
        placeholder="Notes"
        value={clientForm.notes}
        onChange={(e) =>
          setClientForm({ ...clientForm, notes: e.target.value })
        }
      />

      <button type="button" onClick={saveClient}>
        {editingClientId !== null
          ? "Enregistrer les modifications"
          : "Créer la fiche client"}
      </button>

      <button
        type="button"
        className="secondary-button"
        onClick={() => {
          resetClientForm();
          navigateTo("clients");
        }}
      >
        Annuler
      </button>
    </div>
  </section>
)}
      
      {page === "clients" && setupComplete && (
        <section className="card list-card">
          <h2>Fiches clients</h2>

          <div className="action-buttons" style={{ marginBottom: "16px" }}>
            <button
              onClick={() => {
                resetClientForm();
               navigateTo("client-form");
              }}
            >
              + Nouvelle fiche client
            </button>

            <button type="button" onClick={downloadClientsCsvTemplate}>
              Télécharger modèle CSV
            </button>

            <label className="button-link" style={{ cursor: "pointer" }}>
              Importer CSV
              <input
                type="file"
                accept=".csv"
                onChange={importClientsFromCsv}
                style={{ display: "none" }}
              />
            </label>
          </div>

          <input
            type="text"
            placeholder="Rechercher un client..."
            value={clientSearch}
            onChange={(e) => setClientSearch(e.target.value)}
          />

          <div className="clients-list">
            {filteredClients.length === 0 ? (
              <p>Aucun client trouvé.</p>
            ) : (
              filteredClients
                .slice()
                .sort((a, b) => formatClientName(a).localeCompare(formatClientName(b)))
                .map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    className="client-box"
                    onClick={() => openClientDetails(client)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                  >
                    <h3 style={{ margin: 0 }}>{formatClientName(client)}</h3>
                  </button>
                ))
            )}
          </div>
        </section>
      )}
    </div>
  );
}