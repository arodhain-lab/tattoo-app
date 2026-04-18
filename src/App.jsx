import { useEffect, useMemo, useState } from "react";
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
      )} versés le ${formatDateOnly(deposit.paymentDate || deposit.appointment)} par ${
        deposit.paymentMethod || "mode non renseigné"
      } - montant total avant acompte : ${formatCurrency(originalTotal)}`;
    })
    .join(" | ");
}

export default function App() {
  const [session, setSession] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [setupComplete, setSetupComplete] = useState(false);
  const [page, setPage] = useState("home");
  const [selectedAppointmentId, setSelectedAppointmentId] = useState(null);
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [data, setData] = useState({
    clients: [],
    appointments: [],
    artists: [],
    appointmentTypes: ["TATTOO", "PIERCING", "VENTE", "ACOMPTE"],
  });

 const openAppointmentDetails = (appointmentItem) => {
  setSelectedAppointmentId(appointmentItem.id);

  if (appointmentItem.appointment) {
    setSelectedDate(appointmentItem.appointment.slice(0, 10));
  }

  setPage("appointment-details");
};

const openClientDetails = (client) => {
  setSelectedClientId(client.id);
  setPage("client-details");
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
  const [agendaView, setAgendaView] = useState("week");
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [showMobileWeek, setShowMobileWeek] = useState(false);
  const [schoolZone, setSchoolZone] = useState("B");
  const [revenueArtistFilter, setRevenueArtistFilter] = useState("all");

  const [clientSearch, setClientSearch] = useState("");
  const [appointmentSearch, setAppointmentSearch] = useState("");
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
  durationHours: "",
  durationMinutes: "",
  cancelled: false,
  linkedAppointmentId: "",
     paymentMethod: "",
     paymentDate: "",
     originalTotalBeforeDeposit: "",
   });

  const [editingClientId, setEditingClientId] = useState(null);
  const [editingAppointmentId, setEditingAppointmentId] = useState(null);
  const [editingArtistId, setEditingArtistId] = useState(null);
  const [serviceForm, setServiceForm] = useState({
    name: "",
  });

  const [editingServiceName, setEditingServiceName] = useState(null);

  const DAY_START_HOUR = 8;
  const DAY_END_HOUR = 20;
  const HOUR_HEIGHT = 80;
  const TOTAL_DAY_MINUTES = (DAY_END_HOUR - DAY_START_HOUR) * 60;
  const DAY_COLUMN_HEIGHT = (DAY_END_HOUR - DAY_START_HOUR) * HOUR_HEIGHT;

  const [showSuccess, setShowSuccess] = useState(false);


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
  const appointmentTypes = data.appointmentTypes || [];
  const canFinishSetup =
  artists.length > 0 &&
  appointmentTypes.some(
    (type) => type && type.trim().toUpperCase() !== ACOMPTE_TYPE
  );
  const loadSupabaseData = async () => {
    if (!session) return;

  setCheckingSetup(true);

const [
  { data: clients, error: clientsError },
  { data: artists, error: artistsError },
  { data: appointments, error: appointmentsError },
  { data: services, error: servicesError },
] = await Promise.all([
  supabase
    .from("clients")
    .select("*")
    .eq("user_id", session.user.id)
    .order("last_name", { ascending: true }),

  supabase
    .from("artists")
    .select("*")
    .eq("user_id", session.user.id)
    .order("name", { ascending: true }),

  supabase
    .from("appointments")
    .select("*")
    .eq("user_id", session.user.id)
    .order("appointment", { ascending: true }),

  supabase
    .from("services")
    .select("*")
    .eq("user_id", session.user.id)
    .order("name", { ascending: true }),
]);

  const firstError =
    clientsError || artistsError || appointmentsError || servicesError;

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
      artistId: appointment.artist_id,
      title: appointment.title,
      project: appointment.project,
      notes: appointment.notes,
      appointment: appointment.appointment,
      price: appointment.price ?? "",
      durationHours: appointment.duration_hours ?? "",
      durationMinutes: appointment.duration_minutes ?? "",
      cancelled: appointment.cancelled,
      linkedAppointmentId: appointment.linked_appointment_id ?? "",
      paymentMethod: appointment.payment_method || "",
      paymentDate: appointment.payment_date || "",
      originalTotalBeforeDeposit: appointment.original_total_before_deposit ?? "",
    })),
    appointmentTypes: Array.from(
      new Set([...(services?.map((s) => s.name) || []), "ACOMPTE"])
    ),
  });
    evaluateSetup(artists || [], services || []);
};

  const appointmentsWithClient = useMemo(() => {
    return appointments
      .map((appointmentItem) => {
        const client = clients.find((c) => c.id === appointmentItem.clientId);
        const artist = artists.find((a) => a.id === appointmentItem.artistId);

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
    if (revenueArtistFilter === "all") return appointmentsWithClient;

    return appointmentsWithClient.filter(
      (appointmentItem) => String(appointmentItem.artistId) === revenueArtistFilter
    );
  }, [appointmentsWithClient, revenueArtistFilter]);

  const selectedDayAppointments = useMemo(() => {
    return agendaAppointments.filter(
      (appointmentItem) =>
        appointmentItem.appointment &&
        appointmentItem.appointment.slice(0, 10) === selectedDate
    );
  }, [agendaAppointments, selectedDate]);

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
      const key = appointmentItem.appointment.slice(0, 10);

      if (!map[key]) {
        map[key] = [];
      }

      map[key].push(appointmentItem);
    });

    Object.keys(map).forEach((key) => {
      map[key].sort((a, b) => (a.appointment || "").localeCompare(b.appointment || ""));
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
    servicesCount: appointmentTypes.filter((type) => type !== ACOMPTE_TYPE).length,
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
    price: "",
    durationHours: "",
    durationMinutes: "",
    cancelled: false,
    linkedAppointmentId: "",
    paymentMethod: "",
    paymentDate: "",
    originalTotalBeforeDeposit: "",
  });
  setEditingAppointmentId(null);
};

 const saveClient = async () => {
  if (!clientForm.lastName.trim() || !clientForm.firstName.trim()) return;
  if (!session?.user) return;

  if (editingClientId !== null) {
    const { error } = await supabase
      .from("clients")
      .update({
        last_name: clientForm.lastName.trim(),
        first_name: clientForm.firstName.trim(),
        phone: clientForm.phone.trim(),
        notes: clientForm.notes.trim(),
      })
      .eq("id", editingClientId)
      .eq("user_id", session.user.id);

    if (error) {
      alert(error.message);
      return;
    }
  } else {
    const { error } = await supabase.from("clients").insert({
      user_id: session.user.id,
      last_name: clientForm.lastName.trim(),
      first_name: clientForm.firstName.trim(),
      phone: clientForm.phone.trim(),
      notes: clientForm.notes.trim(),
    });

    if (error) {
      alert(error.message);
      return;
    }
  }

    const wasEditing = editingClientId !== null;
  const currentClientId = editingClientId;

  await loadSupabaseData();
  resetClientForm();

  if (wasEditing) {
    setSelectedClientId(currentClientId);
    setPage("client-details");
  } else {
    setPage("clients");
  }
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
    setPage("artists");
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
      .update({ name: cleanedName })
      .eq("name", editingServiceName)
      .eq("user_id", session.user.id);

    if (error) {
      alert(error.message);
      return;
    }
  } else {
    if (appointmentTypes.includes(cleanedName)) return;

    const { error } = await supabase.from("services").insert({
      user_id: session.user.id,
      name: cleanedName,
    });

    if (error) {
      alert(error.message);
      return;
    }
  }

  await loadSupabaseData();
  resetServiceForm();
};

const editService = (serviceName) => {
  if (serviceName === ACOMPTE_TYPE) {
    return;
  }

  setServiceForm({
    name: serviceName || "",
  });
  setEditingServiceName(serviceName);
  setPage("services");
};

const deleteService = async (serviceName) => {
  if (serviceName === ACOMPTE_TYPE) return;
  if (!session?.user) return;
  if (serviceHasAppointments(serviceName)) {
  alert("Suppression impossible : cette prestation est utilisée dans un ou plusieurs rendez-vous.");
  return;
}

  const { error } = await supabase
    .from("services")
    .delete()
    .eq("name", serviceName)
    .eq("user_id", session.user.id);

  if (error) {
    alert(error.message);
    return;
  }

  await loadSupabaseData();

  if (editingServiceName === serviceName) {
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
    setPage("client-form");
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
    setPage("clients");
  }

  if (editingClientId === clientId) {
    resetClientForm();
  }

  if (expandedClientId === clientId) {
    setExpandedClientId(null);
  }
};

const saveAppointment = async () => {
  if (
    !appointmentForm.clientId ||
    !appointmentForm.artistId ||
    !appointmentForm.title ||
    !appointmentForm.project.trim() ||
    !appointmentForm.appointment
  ) {
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

    if (!appointmentForm.paymentDate) {
      alert("Vous devez renseigner la date de versement de l'acompte.");
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

  const payload = {
    user_id: session.user.id,
    client_id: Number(appointmentForm.clientId),
    artist_id: Number(appointmentForm.artistId),
    title: appointmentForm.title.trim(),
    project: appointmentForm.project.trim(),
    notes: appointmentForm.notes.trim(),
    appointment: appointmentForm.appointment,
    price: appointmentForm.price === "" ? null : Number(appointmentForm.price),
    duration_hours:
      appointmentForm.durationHours === "" ? null : Number(appointmentForm.durationHours),
    duration_minutes:
      appointmentForm.durationMinutes === "" ? null : Number(appointmentForm.durationMinutes),
    cancelled: appointmentForm.cancelled || false,
    linked_appointment_id:
      appointmentForm.title === ACOMPTE_TYPE
        ? Number(appointmentForm.linkedAppointmentId)
        : null,
    payment_method:
      appointmentForm.title === ACOMPTE_TYPE
        ? appointmentForm.paymentMethod.trim()
        : null,
    payment_date:
      appointmentForm.title === ACOMPTE_TYPE
        ? appointmentForm.paymentDate
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

  setShowSuccess(true);

  setTimeout(() => {
    setShowSuccess(false);
    setPage("home");
  }, 1500);

  setSelectedDate(appointmentForm.appointment.slice(0, 10));
  resetAppointmentForm();
};

  const editAppointment = (appointmentItem) => {
    setAppointmentForm({
      clientId: String(appointmentItem.clientId || ""),
      artistId: String(appointmentItem.artistId || ""),
      title: appointmentItem.title || "",
      project: appointmentItem.project || "",
      notes: appointmentItem.notes || "",
      appointment: appointmentItem.appointment || "",
      price: appointmentItem.price ?? "",
      durationHours: appointmentItem.durationHours ?? "",
      durationMinutes: appointmentItem.durationMinutes ?? "",
      cancelled: appointmentItem.cancelled || false,
      linkedAppointmentId: appointmentItem.linkedAppointmentId
        ? String(appointmentItem.linkedAppointmentId)
        : "",
      paymentMethod: appointmentItem.paymentMethod || "",
      paymentDate: appointmentItem.paymentDate || "",
      originalTotalBeforeDeposit: appointmentItem.originalTotalBeforeDeposit ?? "",
    });

    if (appointmentItem.appointment) {
      setSelectedDate(appointmentItem.appointment.slice(0, 10));
    }

    setEditingAppointmentId(appointmentItem.id);
    setPage("appointments");
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
                    setPage("agenda");
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
              setPage("agenda");
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
    setPage("agenda");
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
            <button onClick={() => setPage("artists")}>
              Configurer les tatoueurs
            </button>
            <button onClick={() => setPage("services")}>
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
              setPage("home");
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
          <div className="success-box">
            ✔ RDV enregistré
          </div>
        </div>
      )}

      {page === "home" && (
        <header className="page-header">
          <div>
            <h1>Gestion tatouage</h1>
            <p className="subtitle">
              Vue d’ensemble du planning, fiches clients, tatoueurs et rendez-vous
            </p>
          </div>
        </header>
      )}
      {page !== "home" && setupComplete && (
          <div style={{ marginBottom: "16px" }}>
            <button className="back-button" onClick={() => setPage("home")}>
              ← Retour accueil
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
            <button onClick={() => setPage("artists")}>Tatoueurs</button>
            <button onClick={() => setPage("services")}>Prestations</button>
          </div>
        </div>
      )}

{page === "home" && setupComplete && (
  <section className="card home-card">
    <h2>Accueil</h2>
    <p className="muted-text">
      Choisissez une rubrique
    </p>
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
        onClick={() => setPage("appointments")}
      >
        <div className="home-menu-logo-wrap">
          <img
            src="/icons/add-rdv.png"
            alt="Ajouter un rendez-vous"
            className="home-menu-full-logo"
          />
        </div>
      </button>

      <button
        className="home-menu-button home-menu-primary home-menu-logo-button"
        onClick={() => setPage("agenda")}
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
        onClick={() => setPage("revenue")}
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
        onClick={() => setPage("clients")}
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
        onClick={() => setPage("stats")}
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
        onClick={() => setPage("settings")}
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

    <div
      style={{
        display: "flex",
        justifyContent: "flex-end",
        width: "100%",
        marginTop: "24px",
        padding: "10px",
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

    {page === "agenda" && setupComplete && (
      <>
        <div className="home-layout">
          <section className="card agenda-main-card">
            <div className="agenda-topbar">
              <div>
                <h2 translate="no">PLANNING</h2>
                <p className="muted-text">{homeAgendaTitle}</p>
              </div>

              <div className="small-actions">
                <button
                  className="btn-add-rdv"
                  onClick={() => setPage("appointments")}
                >
                  <img src="/icons/add-rdv.png" alt="Ajouter un RDV" />
                  <span>Ajouter un RDV</span>
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
            <div className="agenda-nav-buttons">
              <button
                type="button"
                className="nav-arrow-button"
                onClick={goPrevious}
              >
                ←
              </button>
              <button
                type="button"
                className="nav-arrow-button"
                onClick={goNext}
              >
                →
              </button>
            </div>

            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
        </div>

        {agendaView === "day" && (
          <div className="agenda-panel">
            <h3>Planning du jour</h3>

            {renderSpecialDayBadge(selectedDate)}

            {selectedDayAppointments.length === 0 ? (
              <p>Aucun rendez-vous pour cette date.</p>
            ) : (
              selectedDayAppointments.map((appointmentItem) => (
                <button
                  key={appointmentItem.id}
                type="button"
                  className={`agenda-item artist-bordered ${appointmentItem.cancelled ? "cancelled-appointment" : ""}`}
                  style={{
                    borderLeftColor: appointmentItem.artistColor,
                    backgroundColor: appointmentItem.cancelled ? "#d3d3d3" : "",
                  }}
                  onClick={() => openAppointmentDetails(appointmentItem)}
                >
                  <div className="agenda-item-time">
                    {formatTimeOnly(appointmentItem.appointment)}
                  </div>
                  <div className="agenda-item-content">
                    <h4 className="appointment-project-title">
                      {appointmentItem.project}
                    </h4>
                    <p><strong>Tatoueur :</strong> {appointmentItem.artistName}</p>
                    <p><strong>Titre :</strong> {appointmentItem.title || "Sans titre"}</p>
                    <p>
                      <strong>Tarif :</strong>{" "}
                      {appointmentItem.price !== ""
                        ? formatCurrency(getDisplayedPrice(appointmentItem, appointments))
                        : "Non renseigné"}
                    </p>
                    <p>
                      <strong>Durée estimée :</strong>{" "}
                      {formatDuration(
                        appointmentItem.durationHours,
                        appointmentItem.durationMinutes
                      )}
                    </p>
                    <p>
                      <strong>Notes :</strong>{" "}
                      {[appointmentItem.notes, buildSystemDepositNotes(appointments, appointmentItem)]
                        .filter(Boolean)
                        .join(" | ") || "Aucune note"}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        {agendaView === "week" && (!isMobile || showMobileWeek) && (
          <div className={`week-planner ${isMobile ? "week-planner-mobile" : ""}`}>
            <div className="week-planner-scroll">
              <div className="week-planner-header">
                <div className="week-time-header"></div>

                {weekDays.map((day) => {
                  const key = formatDateKey(day);
                  const specialDayInfo = getSpecialDayInfo(key, schoolZone);

                  return (
                    <div
                      key={key}
                      className={`week-column-header ${
                        specialDayInfo?.type === "publicHoliday"
                          ? "public-holiday-cell"
                          : specialDayInfo?.type === "schoolHoliday"
                          ? "school-holiday-cell"
                          : ""
                      }`}
                    >
                      <strong>
                        {isMobile
                          ? (() => {
                              const dayLabel = new Intl.DateTimeFormat("fr-FR", {
                                weekday: "long",
                              }).format(day);
                              return dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1);
                            })()
                          : new Intl.DateTimeFormat("fr-FR", {
                              weekday: "short",
                            }).format(day)}
                      </strong>

                      <span>
                        {isMobile
                          ? `${pad(day.getDate())}/${pad(day.getMonth() + 1)}`
                          : formatDateOnly(day)}
                      </span>

                      {specialDayInfo && (
                        <small className="special-day-text">{specialDayInfo.label}</small>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="week-planner-body">
                <div className="week-time-column" style={{ height: `${DAY_COLUMN_HEIGHT}px` }}>
                  {timeSlots
                    .filter((slot) => !(isMobile && slot.isHalfHour))
                    .map((slot) => (
                      <div
                        key={slot.label}
                        className={`week-time-slot ${slot.isHalfHour ? "half-hour-slot" : "full-hour-slot"}`}
                        style={{ top: `${(slot.minutesFromStart / 60) * HOUR_HEIGHT}px` }}
                      >
                        {slot.label}
                      </div>
                    ))}
                </div>

                {weekDays.map((day) => {
                  const key = formatDateKey(day);
                  const items = appointmentsByDate[key] || [];
                  const specialDayInfo = getSpecialDayInfo(key, schoolZone);

                  return (
                    <div
                      key={key}
                      className={`week-day-column ${
                        specialDayInfo?.type === "publicHoliday"
                          ? "public-holiday-cell"
                          : specialDayInfo?.type === "schoolHoliday"
                          ? "school-holiday-cell"
                          : ""
                      }`}
                      style={{ height: `${DAY_COLUMN_HEIGHT}px` }}
                    >
                      {Array.from({ length: DAY_END_HOUR - DAY_START_HOUR + 1 }).map((_, index) => (
                        <div
                          key={index}
                          className="week-hour-line"
                          style={{ top: `${index * HOUR_HEIGHT}px` }}
                        ></div>
                      ))}

                      {Array.from({ length: (DAY_END_HOUR - DAY_START_HOUR) * 2 }).map((_, index) => (
                        <div
                          key={`half-${index}`}
                          className="week-half-line"
                          style={{ top: `${index * (HOUR_HEIGHT / 2)}px` }}
                        ></div>
                      ))}

                      {items.map((appointmentItem) => {
                        const startMinutes = clamp(
                          getMinutesSinceStartOfDay(appointmentItem.appointment, DAY_START_HOUR),
                          0,
                          TOTAL_DAY_MINUTES
                        );

                        const durationMinutes = getAppointmentDurationInMinutes(appointmentItem);

                        const top = (startMinutes / 60) * HOUR_HEIGHT;
                        const height = Math.max(
                          (durationMinutes / 60) * HOUR_HEIGHT,
                          isMobile ? 34 : 20
                        );

                        return (
                          <button
                            key={appointmentItem.id}
                            className={`week-appointment-block ${appointmentItem.cancelled ? "cancelled-appointment" : ""}`}
                            style={{
                              top: `${top}px`,
                              height: `${height}px`,
                              backgroundColor: appointmentItem.cancelled
                                ? "#d3d3d3"
                                : appointmentItem.artistColor,
                            }}
                            onClick={() => openAppointmentDetails(appointmentItem)}
                          >
                            {isMobile ? (
                              <div className="week-chip-mobile-content">
                                <div className="week-chip-title">
                                  {appointmentItem.project || appointmentItem.title || "Sans titre"}
                                </div>

                                {appointmentItem.price !== "" && (
                                  <div className="week-chip-price">
                                    {formatCurrency(getDisplayedPrice(appointmentItem, appointments))}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="week-chip-topline">
                                <span className="week-chip-title">
                                  {appointmentItem.project || appointmentItem.title || "Sans titre"}
                                </span>
                                {appointmentItem.price !== "" && (
                                  <span className="week-chip-price">
                                    {formatCurrency(getDisplayedPrice(appointmentItem, appointments))}
                                  </span>
                                )}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {agendaView === "month" && (
          <>
            <div className="month-view-title">{monthViewTitle}</div>

            <div className="month-weekdays">
              <div>Lun</div>
              <div>Mar</div>
              <div>Mer</div>
              <div>Jeu</div>
              <div>Ven</div>
              <div>Sam</div>
              <div>Dim</div>
            </div>

            <div className="month-grid">
              {monthCells.map((cell, index) => {
                if (!cell) {
                  return <div key={`empty-${index}`} className="month-cell empty-cell"></div>;
                }

                const key = formatDateKey(cell);
                const items = appointmentsByDate[key] || [];
                const isSelected = key === selectedDate;
                const specialDayInfo = getSpecialDayInfo(key, schoolZone);

                return (
                  <button
                    key={key}
                    className={`month-cell ${isSelected ? "selected-cell" : ""} ${
                      specialDayInfo?.type === "publicHoliday"
                        ? "public-holiday-cell"
                        : specialDayInfo?.type === "schoolHoliday"
                        ? "school-holiday-cell"
                        : ""
                    }`}
                    onClick={() => {
                      setSelectedDate(key);
                      setAgendaView("day");
                    }}
                  >
                    <div className="month-cell-top">
                      <span>
                        {MONTH_DAY_LABELS[cell.getDay()]} {cell.getDate()}
                      </span>

                      {items.length > 0 && (
                        <span className="month-count">{items.length}</span>
                      )}
                    </div>

                    {specialDayInfo && (
                      <div className="month-special-label">{specialDayInfo.label}</div>
                    )}

                    <div className="month-cell-body">
                      {items.slice(0, 3).map((appointmentItem) => (
                        <div
                          key={appointmentItem.id}
                          className={`month-mini-item month-mini-item-colored ${
                            appointmentItem.cancelled ? "cancelled-appointment" : ""
                          }`}
                          style={{
                            borderLeftColor: appointmentItem.artistColor,
                            backgroundColor: appointmentItem.cancelled ? "#d3d3d3" : "",
                            cursor: "pointer",
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            openAppointmentDetails(appointmentItem);
                          }}
                        >
                          <div className="month-mini-project">
                            {formatTimeOnly(appointmentItem.appointment)} — {appointmentItem.project}
                          </div>
                        </div>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
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
    <p className="muted-text">
      Gérez les données principales de l’application
    </p>

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

    <div className="home-menu-grid">
      <button className="home-menu-button" onClick={() => setPage("services")}>
        <span className="home-menu-icon">🧾</span>
        <span className="home-menu-title">Prestations</span>
        <span className="home-menu-subtitle">Ajouter ou modifier les types de prestations</span>
      </button>

      <button className="home-menu-button" onClick={() => setPage("artists")}>
        <span className="home-menu-icon">🎨</span>
        <span className="home-menu-title">Tatoueurs</span>
        <span className="home-menu-subtitle">Ajouter ou modifier les tatoueurs</span>
      </button>

      <button className="home-menu-button" onClick={() => setPage("clients")}>
        <span className="home-menu-icon">👤</span>
        <span className="home-menu-title">Fiches clients</span>
        <span className="home-menu-subtitle">Créer une nouvelle fiche client</span>
      </button>
    </div>
  </section>
)}

{page === "stats" && setupComplete && (
  <section className="card">
    <h2>Statistiques</h2>
    <p className="muted-text">
      Vue globale de l’activité
    </p>

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

      {page === "clients" && setupComplete && (
        <section className="card list-card">
          <h2>Fiches clients</h2>

          <div className="action-buttons" style={{ marginBottom: "16px" }}>
            <button
              onClick={() => {
                resetClientForm();
                setPage("client-form");
              }}
            >
              + Nouvelle fiche client
            </button>
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

      {page === "client-details" && setupComplete && selectedClientDetails && (
  <section className="card">
    <h2>Détail de la fiche client</h2>

    <div className="client-box">
      <h3>{formatClientName(selectedClientDetails)}</h3>
      <p><strong>Nom :</strong> {selectedClientDetails.lastName || "Non renseigné"}</p>
      <p><strong>Prénom :</strong> {selectedClientDetails.firstName || "Non renseigné"}</p>
      <p><strong>Téléphone :</strong> {selectedClientDetails.phone || "Non renseigné"}</p>
      <p><strong>Notes :</strong> {selectedClientDetails.notes || "Aucune note"}</p>
      <p>
        <strong>Nombre de rendez-vous liés :</strong>{" "}
        {getClientAppointments(selectedClientDetails.id).length}
      </p>
    </div>

    <div className="action-buttons" style={{ marginTop: "20px" }}>
      <button onClick={() => editClient(selectedClientDetails)}>
        Modifier
      </button>

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

{page === "client-form" && setupComplete && (
  <section className="card form-card">
    <h2>
      {editingClientId !== null
        ? "Modifier la fiche client"
        : "Créer une fiche client"}
    </h2>

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
      type="text"
      placeholder="Téléphone"
      value={clientForm.phone}
      onChange={(e) =>
        setClientForm({ ...clientForm, phone: e.target.value })
      }
    />

    <textarea
      placeholder="Notes client"
      value={clientForm.notes}
      onChange={(e) =>
        setClientForm({ ...clientForm, notes: e.target.value })
      }
    />

    <button onClick={saveClient}>
      {editingClientId !== null
        ? "Enregistrer les modifications"
        : "Ajouter la fiche client"}
    </button>

    <button
      className="secondary-button full-width"
      onClick={() => {
        resetClientForm();
        setPage(editingClientId !== null ? "client-details" : "clients");
      }}
    >
      Annuler
    </button>
  </section>
)}

      {page === "artists" && (
        <div className="grid">
          <section className="card form-card">
            <h2>
              {editingArtistId !== null
                ? "Modifier un tatoueur"
                : "Créer un tatoueur"}
            </h2>

            <input
              type="text"
              placeholder="Nom du tatoueur"
              value={artistForm.name}
              onChange={(e) =>
                setArtistForm({ ...artistForm, name: e.target.value })
              }
            />

            <label className="color-label">
              Couleur du tatoueur
              <input
                type="color"
                value={artistForm.color}
                onChange={(e) =>
                  setArtistForm({ ...artistForm, color: e.target.value })
                }
                className="color-input"
              />
            </label>

            <button onClick={saveArtist}>
              {editingArtistId !== null
                ? "Enregistrer les modifications"
                : "Ajouter le tatoueur"}
            </button>

            {editingArtistId !== null && (
              <button className="secondary-button full-width" onClick={resetArtistForm}>
                Annuler la modification
              </button>
            )}
          </section>

          <section className="card list-card">
            <h2>Tatoueurs</h2>

            <div className="artists-list">
              {artists.length === 0 ? (
                <p>Aucun tatoueur enregistré.</p>
              ) : (
                artists.map((artist) => (
                  <div key={artist.id} className="artist-row">
                    <div className="artist-row-main">
                      <span
                        className="artist-color-dot"
                        style={{ backgroundColor: artist.color }}
                      ></span>
                      <span>{artist.name}</span>
                    </div>

                    <div className="artist-row-actions">
                      <button onClick={() => editArtist(artist)}>Modifier</button>
                      <button
                        onClick={() => deleteArtist(artist.id)}
                        disabled={artistHasAppointments(artist.id)}
                        title={
                          artistHasAppointments(artist.id)
                            ? "Suppression impossible : ce tatoueur a des rendez-vous"
                            : "Supprimer ce tatoueur"
                        }
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      )}

      {page === "services" && (
  <div className="grid">
    <section className="card form-card">
      <h2>
        {editingServiceName !== null
          ? "Modifier une prestation"
          : "Créer une prestation"}
      </h2>

      <input
        type="text"
        placeholder="Nom de la prestation"
        value={serviceForm.name}
        onChange={(e) =>
          setServiceForm({ ...serviceForm, name: e.target.value })
        }
      />

      {serviceForm.name.trim().toUpperCase() === ACOMPTE_TYPE && editingServiceName === null && (
       <p className="muted-text">La prestation ACOMPTE existe déjà et ne peut pas être recréée.</p>
      )}

      <button onClick={saveService}>
        {editingServiceName !== null
          ? "Enregistrer les modifications"
          : "Ajouter la prestation"}
      </button>

      {editingServiceName !== null && (
        <button className="secondary-button full-width" onClick={resetServiceForm}>
          Annuler la modification
        </button>
      )}
    </section>

    <section className="card list-card">
      <h2>Prestations</h2>

      <div className="artists-list">
             {appointmentTypes.length === 0 ? (
          <p>Aucune prestation enregistrée.</p>
        ) : (
          appointmentTypes.map((serviceName) => (
            <div key={serviceName} className="artist-row">
              <div className="artist-row-main">
                <span>{serviceName}</span>
              </div>

              <div className="artist-row-actions">
                {serviceName !== ACOMPTE_TYPE && (
                  <>
                    <button onClick={() => editService(serviceName)}>Modifier</button>
                    <button
                      onClick={() => deleteService(serviceName)}
                      disabled={serviceHasAppointments(serviceName)}
                      title={
                        serviceHasAppointments(serviceName)
                          ? "Suppression impossible : cette prestation est utilisée dans des rendez-vous"
                          : "Supprimer cette prestation"
                      }
                    >
                      Supprimer
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}

      </div>
    </section>
  </div>
)}

{page === "appointment-details" && setupComplete && selectedAppointmentDetails && (
  <section className="card">
    <h2>Détail du rendez-vous</h2>

    <div
      className={`client-box artist-bordered ${
        selectedAppointmentDetails.cancelled ? "cancelled-appointment" : ""
      }`}
      style={{
        borderLeftColor: selectedAppointmentDetails.artistColor,
        backgroundColor: selectedAppointmentDetails.cancelled ? "#d3d3d3" : "",
      }}
    >
      <h3>{selectedAppointmentDetails.clientName}</h3>

      <p><strong>Tatoueur :</strong> {selectedAppointmentDetails.artistName}</p>

      <p><strong>Type de prestation :</strong> {selectedAppointmentDetails.title || "Sans titre"}</p>

      <p><strong>Projet :</strong> {selectedAppointmentDetails.project || "Non renseigné"}</p>

      <p><strong>Date :</strong> {formatDateTime(selectedAppointmentDetails.appointment)}</p>

      <p>
        <strong>Tarif :</strong>{" "}
        {selectedAppointmentDetails.price !== ""
          ? formatCurrency(getDisplayedPrice(selectedAppointmentDetails, appointments))
          : "Non renseigné"}
      </p>

      <p>
        <strong>Durée estimée :</strong>{" "}
        {formatDuration(
          selectedAppointmentDetails.durationHours,
          selectedAppointmentDetails.durationMinutes
        )}
      </p>

      <p>
        <strong>Statut :</strong>{" "}
        {selectedAppointmentDetails.cancelled ? "Annulé" : "Actif"}
      </p>

      {selectedAppointmentDetails.title === ACOMPTE_TYPE && (
        <>
          <p>
            <strong>Mode de paiement :</strong>{" "}
            {selectedAppointmentDetails.paymentMethod || "Non renseigné"}
          </p>
          <p>
            <strong>Date de versement :</strong>{" "}
            {selectedAppointmentDetails.paymentDate
              ? formatDateOnly(selectedAppointmentDetails.paymentDate)
              : "Non renseignée"}
          </p>
          <p>
            <strong>Rendez-vous lié :</strong>{" "}
            {appointmentsWithClient.find(
              (item) =>
                String(item.id) === String(selectedAppointmentDetails.linkedAppointmentId)
            )?.project || "Non renseigné"}
          </p>
        </>
      )}

      <p>
        <strong>Notes :</strong>{" "}
        {[selectedAppointmentDetails.notes, buildSystemDepositNotes(appointments, selectedAppointmentDetails)]
          .filter(Boolean)
          .join(" | ") || "Aucune note"}
      </p>
    </div>

    <div className="action-buttons" style={{ marginTop: "20px" }}>
      <button onClick={() => editAppointment(selectedAppointmentDetails)}>
        Modifier
      </button>

      <button
        onClick={() => deleteAppointment(selectedAppointmentDetails.id)}
      >
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
  {clients
    .slice()
    .sort((a, b) =>
      formatClientName(a).localeCompare(formatClientName(b))
    )
    .map((client) => (
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
    <option key={type} value={type}>
      {type}
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
          {appointmentItem.price !== "" ? formatCurrency(appointmentItem.price) : "Sans tarif"}
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

    <input
      type="date"
      value={appointmentForm.paymentDate}
      onChange={(e) =>
        setAppointmentForm({
          ...appointmentForm,
          paymentDate: e.target.value,
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

            <button onClick={saveAppointment}>
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
    </div>
  );
}