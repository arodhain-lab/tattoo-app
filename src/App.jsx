import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import { supabase } from "./supabaseClient";
import Auth from "./Auth";
import "./App.css";


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

function formatDateTimeWithWeekday(value) {
  const date = toDate(value);
  if (!date) return "Non planifié";

  const dayLabels = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"];
  const dayLabel = dayLabels[date.getDay()];

  const datePart = new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);

  const timePart = new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

  return `${dayLabel} ${datePart}, ${timePart}`;
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

function isDateBetween(dateKey, startKey, endKey) {
  return dateKey >= startKey && dateKey <= endKey;
}

function getSpecialDayInfo(dateKey, schoolHolidays) {
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

  const matchedSchoolHoliday = schoolHolidays.find((item) =>
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
      !appointmentItem.cancelled &&
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
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [accessAllowed, setAccessAllowed] = useState(false);
  const [accessProfile, setAccessProfile] = useState(null);
  const [accessError, setAccessError] = useState("");
  const [graceNoticeDismissed, setGraceNoticeDismissed] = useState(false);
  const [graceClock, setGraceClock] = useState(Date.now());
  const graceDeadline = accessProfile?.payment_grace_ends_at || accessProfile?.payment_grace_until || accessProfile?.grace_period_ends_at || null;
  const graceRemaining = graceDeadline ? Math.max(0, new Date(graceDeadline).getTime() - graceClock) : 0;
  const isGracePeriod = accessProfile?.subscription_status === "past_due" && graceRemaining > 0;
  const graceDays = Math.floor(graceRemaining / 86400000);
  const graceHours = Math.floor((graceRemaining % 86400000) / 3600000);
  const graceMinutes = Math.floor((graceRemaining % 3600000) / 60000);
  useEffect(() => {
    const timer = window.setInterval(() => setGraceClock(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => { setGraceNoticeDismissed(false); }, [session?.user?.id, graceDeadline]);
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
  const [schoolHolidays, setSchoolHolidays] = useState([]);
  const [revenueArtistFilter, setRevenueArtistFilter] = useState("all");
  const [agendaArtistFilter, setAgendaArtistFilter] = useState("all");

  const [clientSearch, setClientSearch] = useState("");
  const [appointmentSearch, setAppointmentSearch] = useState("");
  const [exportStartDate, setExportStartDate] = useState("");
  const [exportEndDate, setExportEndDate] = useState("");
  const [showExportArtistModal, setShowExportArtistModal] = useState(false);
  const [selectedExportArtistIds, setSelectedExportArtistIds] = useState([]);
  const [cancelledDepositDecision, setCancelledDepositDecision] = useState(null);
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
const [successMessage, setSuccessMessage] = useState("");
const [isSavingAppointment, setIsSavingAppointment] = useState(false);
const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
const [subscriptionModalData, setSubscriptionModalData] = useState({
  currentMaxArtists: 1,
  nextArtistCount: 2,
  nextMonthlyPrice: 17.9,
});
const [selectedUpgradeArtistCount, setSelectedUpgradeArtistCount] = useState(2);
const [isUpdatingSubscription, setIsUpdatingSubscription] = useState(false);
const [showDeleteArtistModal, setShowDeleteArtistModal] = useState(false);
const [showCheckoutPlanModal, setShowCheckoutPlanModal] = useState(false);
const [checkoutBillingInterval, setCheckoutBillingInterval] = useState("month");
const [checkoutArtistCount, setCheckoutArtistCount] = useState(1);
const [isCreatingCheckout, setIsCreatingCheckout] = useState(false);
const [artistPendingDeletion, setArtistPendingDeletion] = useState(null);
const [isDeletingArtist, setIsDeletingArtist] = useState(false);
const [subscriptionBillingInterval, setSubscriptionBillingInterval] = useState(null);
const [subscriptionPlanError, setSubscriptionPlanError] = useState("");
const isAnnualSubscription = subscriptionBillingInterval === "year";
const getSubscriptionPrice = (count) =>
  isAnnualSubscription ? 99 + (count - 1) * 80 : 9.9 + (count - 1) * 8;
const subscriptionPeriodLabel = isAnnualSubscription ? "an" : "mois";


const showMessage = (message, duration = 1800) => {
  setSuccessMessage(message);
  setShowSuccess(true);

  setTimeout(() => {
    setShowSuccess(false);
    setSuccessMessage("");
  }, duration);
};

const testStripeCheckout = async () => {
  if (isCreatingCheckout) return;
  setIsCreatingCheckout(true);
  try {
    const { data, error } = await supabase.functions.invoke(
      "create-checkout-session",
      {
        body: {
          billingInterval: checkoutBillingInterval,
          maxArtists: checkoutArtistCount,
        },
      }
    );

    if (error) {
      console.error("ERREUR STRIPE CHECKOUT :", error);
      alert("Erreur Stripe Checkout : " + error.message);
      return;
    }

    if (!data?.url) {
      console.error("RÉPONSE STRIPE INVALIDE :", data);
      alert(data?.error || "Stripe n'a pas renvoyé d'adresse de paiement.");
      return;
    }

    window.location.href = data.url;
  } catch (error) {
    console.error("ERREUR STRIPE :", error);
    alert("Erreur Stripe : " + error.message);
  } finally {
    setIsCreatingCheckout(false);
  }
};

const refreshSubscriptionPlan = async () => {
  setSubscriptionBillingInterval(null);
  setSubscriptionPlanError("");
  const { data, error } = await supabase.functions.invoke("get-subscription-plan");
  if (error || !["month", "year"].includes(data?.billingInterval)) {
    setSubscriptionPlanError("Impossible de vérifier la périodicité de votre abonnement Stripe.");
    return;
  }
  setSubscriptionBillingInterval(data.billingInterval);
};

useEffect(() => {
  if (session?.user?.id && accessProfile?.stripe_subscription_id) {
    refreshSubscriptionPlan();
  }
}, [session?.user?.id, accessProfile?.stripe_subscription_id]);

const updateStripeArtistPlan = async () => {
  if (!subscriptionBillingInterval) {
    alert("Impossible de vérifier le forfait. Réessayez après rechargement.");
    return;
  }
  if (!session?.user?.id) {
    alert("Erreur : utilisateur non connecté.");
    return;
  }

  const currentMaxArtists = Math.max(
    1,
    Number(subscriptionModalData.currentMaxArtists) || 1
  );
  const targetMaxArtists = Math.max(
    currentMaxArtists + 1,
    Number(selectedUpgradeArtistCount) || currentMaxArtists + 1
  );

  setIsUpdatingSubscription(true);

  try {
    const { data, error } = await supabase.functions.invoke(
      "update-subscription",
      {
        body: {
          maxArtists: targetMaxArtists,
        },
      }
    );

    if (error) {
      console.error("ERREUR MODIFICATION ABONNEMENT :", error);
      alert(
        "Impossible de modifier l'abonnement : " +
          (error.message || "erreur inconnue")
      );
      return;
    }

    if (!data?.success) {
      console.error("RÉPONSE MODIFICATION ABONNEMENT INVALIDE :", data);
      alert(
        data?.error ||
          "Stripe n'a pas confirmé la modification de l'abonnement."
      );
      return;
    }

    // On relit le profil depuis Supabase : le serveur/webhook reste la source de vérité.
    const { data: refreshedProfile, error: profileError } = await supabase
      .from("profiles")
      .select(
        "*"
      )
      .eq("id", session.user.id)
      .single();

    if (profileError) {
      console.error("ERREUR RECHARGEMENT PROFIL :", profileError);
    } else if (refreshedProfile) {
      setAccessProfile(refreshedProfile);
    }

    setShowSubscriptionModal(false);
    await refreshSubscriptionPlan();

    showMessage(
      `✔ Forfait mis à jour pour ${targetMaxArtists} tatoueurs.`,
      2600
    );
  } catch (error) {
    console.error("ERREUR MODIFICATION STRIPE :", error);
    alert(
      "Erreur Stripe : " +
        (error instanceof Error ? error.message : "erreur inconnue")
    );
  } finally {
    setIsUpdatingSubscription(false);
  }
};

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

  const goHome = () => {
  setPage("home");
  setPageHistory([]);
};

const loadSchoolHolidays = async () => {
  try {
    const zoneValue = `Zone ${schoolZone}`;

    const where = encodeURIComponent(`zones="${zoneValue}"`);

    const apiUrl =
      "https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/" +
      "fr-en-calendrier-scolaire/records" +
      `?where=${where}` +
      "&order_by=start_date" +
      "&limit=100";

    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error(
        `Impossible de charger les vacances scolaires : ${response.status}`
      );
    }

    const result = await response.json();

    console.log("RÉPONSE API VACANCES :", result);

    const holidays = (result.results || [])
      .filter((item) => {
        const description = String(item.description || "").toLowerCase();

        return (
          description.includes("vacances") ||
          description.includes("pont")
        );
      })
      .map((item) => {
        const startDate = String(item.start_date || "").slice(0, 10);
        const officialEndDate = String(item.end_date || "").slice(0, 10);

        if (!startDate || !officialEndDate) {
          return null;
        }

        // La date de fin officielle correspond au jour de la reprise.
        // On retire donc un jour pour colorer uniquement les jours sans cours.
        const endDate = toDate(officialEndDate);

        if (!endDate) {
          return null;
        }

        endDate.setDate(endDate.getDate() - 1);

        return {
          label: item.description || "Vacances scolaires",
          start: startDate,
          end: formatDateKey(endDate),
          type: "holiday",
        };
      })
      .filter(Boolean);

    console.log(
      `VACANCES CHARGÉES POUR LA ZONE ${schoolZone} :`,
      holidays
    );

    setSchoolHolidays(holidays);
  } catch (error) {
    console.error("ERREUR VACANCES SCOLAIRES :", error);
    setSchoolHolidays([]);
  }
};

useEffect(() => {
  loadSchoolHolidays();
}, [schoolZone]);

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
  let cancelled = false;

  const checkCommercialAccess = async () => {
    if (!session?.user?.id) {
      setCheckingAccess(false);
      setAccessAllowed(false);
      setAccessProfile(null);
      setAccessError("");
      return;
    }

    setCheckingAccess(true);
    setAccessAllowed(false);
    setAccessProfile(null);
    setAccessError("");

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();

    if (cancelled) return;

    if (error) {
      console.error("ERREUR VÉRIFICATION ACCÈS :", error);
      setAccessError("Impossible de vérifier votre période d'essai ou votre abonnement. Veuillez réessayer.");
      setCheckingAccess(false);
      return;
    }

    // La base Supabase est désormais la source de vérité pour l'accès commercial.
    // On utilise exactement la même fonction que les politiques RLS afin d'éviter
    // qu'un compte expiré arrive par erreur sur la configuration initiale.
    const { data: allowedByDatabase, error: accessCheckError } = await supabase
      .rpc("has_active_access", { check_user_id: session.user.id });

    if (cancelled) return;

    if (accessCheckError) {
      console.error("ERREUR CONTRÔLE ACCÈS BASE :", accessCheckError);
      setAccessProfile(profile);
      setAccessAllowed(false);
      setAccessError(
        "Impossible de vérifier votre période d'essai ou votre abonnement. Veuillez réessayer."
      );
      setCheckingAccess(false);
      return;
    }

    const allowed = allowedByDatabase === true;

    setAccessProfile(profile);
    setAccessAllowed(allowed);
    setCheckingAccess(false);

    // Les données métier ne sont chargées qu'après validation de l'accès.
    if (allowed) {
      await loadSupabaseData();
    }
  };

  checkCommercialAccess();

  return () => {
    cancelled = true;
  };
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
  setCancelledDepositDecision(null);
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

    showMessage("✔ Cliente modifiée.");
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

showMessage(
  "✔ Cliente créée : " +
  insertedClient.first_name +
  " " +
  insertedClient.last_name
);
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
      showMessage(`✔ ${clientsToInsert.length} fiche(s) client importée(s).`);

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
  setShowExportArtistModal(false);
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
  const cleaned = String(value || "").trim().toLowerCase();
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;

  const numeric = cleaned.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  if (numeric) {
    const [, day, month, year] = numeric;
    return `${year}-${pad(month)}-${pad(day)}`;
  }

  // Dates françaises produites par l'export : « 1 oct. 2026 », « 8 févr. 2027 ».
  const french = cleaned.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .match(/^(\d{1,2})\s+([a-z]+)\.?\s+(\d{4})$/);
  if (!french) return "";
  const months = {
    janv: 1, janvier: 1, fevr: 2, fevrier: 2, mars: 3,
    avr: 4, avril: 4, mai: 5, juin: 6, juil: 7, juillet: 7,
    aout: 8, sept: 9, septembre: 9, oct: 10, octobre: 10,
    nov: 11, novembre: 11, dec: 12, decembre: 12,
  };
  const [, day, monthName, year] = french;
  const month = months[monthName];
  if (!month) return "";
  const date = new Date(Number(year), month - 1, Number(day));
  if (date.getFullYear() !== Number(year) || date.getMonth() !== month - 1 ||
      date.getDate() !== Number(day)) return "";
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
    return null;
  }

  return (
    appointmentTypes.find(
      (type) =>
        normalizeImportText(getAppointmentTypeName(type)) === searched
    ) || null
  );
};

const downloadAppointmentsCsvTemplate = () => {
  // Même structure et même ordre de colonnes que l'export RDV.
  const header = [
    "DATE", "HEURE", "CLIENT", "TELEPHONE", "TATOUEUR", "TYPE",
    "PROJET", "PRIX TOTAL", "ACOMPTE", "PRESTATION", "VENTE",
    "MONTANT CB", "MONTANT ESPECES", "MOYEN DE PAIEMENT",
  ];
  const example = [
    "25/06/2026", "14:30", "Marie Dupont", "0612345678", "Angel",
    "TATTOO", "Tatouage floral", "180", "0", "180", "0", "180", "0", "CB",
  ];
  const escapeCsv = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csvContent = [header, example]
    .map((row) => row.map(escapeCsv).join(";"))
    .join("\r\n") + "\r\n";

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

const openExportArtistModal = () => {
  if (!exportStartDate || !exportEndDate) {
    alert("Veuillez renseigner une date de début et une date de fin.");
    return;
  }

  if (exportStartDate > exportEndDate) {
    alert("La date de début ne peut pas être après la date de fin.");
    return;
  }

  if (artists.length === 0) {
    alert("Aucun tatoueur disponible.");
    return;
  }

  setSelectedExportArtistIds(artists.map((artist) => String(artist.id)));
  setShowExportArtistModal(true);
};

const toggleExportArtist = (artistId) => {
  const id = String(artistId);

  setSelectedExportArtistIds((prev) =>
    prev.includes(id)
      ? prev.filter((selectedId) => selectedId !== id)
      : [...prev, id]
  );
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

  if (selectedExportArtistIds.length === 0) {
    alert("Veuillez sélectionner au moins un tatoueur.");
    return;
  }

  const escapeCsv = (value) => {
    const text = String(value ?? "");
    return `"${text.replace(/"/g, '""')}"`;
  };

  const formatPhoneForCsv = (phone) => {
    const cleaned = String(phone || "").trim();
    if (!cleaned) return "";
    return `="${cleaned}"`;
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
    "ACOMPTE",
    "PRESTATION",
    "VENTE",
    "MONTANT CB",
    "MONTANT ESPECES",
    "MOYEN DE PAIEMENT",
  ];

  // Les lignes ACOMPTE ne sont JAMAIS exportées à leur date de versement.
  // Elles sont recréées ci-dessous à la date du rendez-vous auquel elles sont liées.
  const regularAppointments = appointmentsWithClient.filter((appointmentItem) => {
    if (!appointmentItem.appointment) return false;
    if (appointmentItem.cancelled) return false;
    if (appointmentItem.title === ACOMPTE_TYPE) return false;

    const appointmentDate = appointmentItem.appointment.slice(0, 10);
    const artistSelected = selectedExportArtistIds.includes(
      String(appointmentItem.artistId)
    );

    return (
      appointmentDate >= exportStartDate &&
      appointmentDate <= exportEndDate &&
      artistSelected
    );
  });

  // Acomptes actifs (= non rendus) dont le RDV lié se trouve dans la période exportée.
  // Même si le RDV a été annulé, un acompte GARDÉ reste un encaissement et doit apparaître.
  const shiftedDeposits = appointmentsWithClient
    .filter((deposit) => deposit.title === ACOMPTE_TYPE && !deposit.cancelled)
    .map((deposit) => {
      const linkedAppointment = appointmentsWithClient.find(
        (item) => String(item.id) === String(deposit.linkedAppointmentId)
      );

      if (!linkedAppointment?.appointment) return null;

      const linkedDate = linkedAppointment.appointment.slice(0, 10);
      const artistSelected = selectedExportArtistIds.includes(
        String(linkedAppointment.artistId)
      );

      if (
        linkedDate < exportStartDate ||
        linkedDate > exportEndDate ||
        !artistSelected
      ) {
        return null;
      }

      return { deposit, linkedAppointment };
    })
    .filter(Boolean);

  if (regularAppointments.length === 0 && shiftedDeposits.length === 0) {
    alert("Aucun rendez-vous trouvé sur cette période pour les tatoueurs sélectionnés.");
    return;
  }

  const rowsWithSortDate = [];

  regularAppointments.forEach((appointmentItem) => {
    const total = getDisplayedPrice(appointmentItem, appointments);
    const category = getAppointmentTypeCategory(appointmentItem.title);

    // Retire de la ventilation du RDV la partie déjà portée par les acomptes actifs.
    // Les acomptes seront ajoutés séparément, mais à la même date que ce RDV.
    const activeDeposits = getDepositsForAppointment(
      appointments,
      appointmentItem.id
    );

    const depositsSale = activeDeposits.reduce(
      (sum, deposit) => sum + (Number(deposit.saleAmount) || 0),
      0
    );
    const depositsService = activeDeposits.reduce(
      (sum, deposit) => sum + (Number(deposit.serviceAmount) || 0),
      0
    );

    let saleAmount = 0;
    let serviceAmount = 0;

    if (category === "VENTE") {
      saleAmount = total;
    } else if (category === "PRESTATION") {
      serviceAmount = total;
    } else if (category === "PRESTATION + VENTE") {
      const originalSale = Number(appointmentItem.saleAmount) || 0;
      const originalService =
        Number(appointmentItem.serviceAmount) ||
        Math.max(0, (Number(appointmentItem.price) || 0) - originalSale);

      saleAmount = Math.max(0, originalSale - depositsSale);
      serviceAmount = Math.max(0, originalService - depositsService);

      // Sécurité contre les anciennes données dont la ventilation serait incomplète.
      const ventilated = saleAmount + serviceAmount;
      if (ventilated < total) {
        serviceAmount += total - ventilated;
      } else if (ventilated > total) {
        const excess = ventilated - total;
        serviceAmount = Math.max(0, serviceAmount - excess);
      }
    }

    // Le moyen de paiement du RDV ne porte que sur le SOLDE restant après acompte.
    let cbAmount = 0;
    let cashAmount = 0;

    if (appointmentItem.paymentMethod === "CB") {
      cbAmount = total;
    } else if (appointmentItem.paymentMethod === "ESPÈCES") {
      cashAmount = total;
    } else if (appointmentItem.paymentMethod === "CB + ESPÈCES") {
      const originalPrice = Number(appointmentItem.price) || 0;
      const originalCb = Number(appointmentItem.paymentCbAmount) || 0;
      const cbRatio = originalPrice > 0 ? originalCb / originalPrice : 0;
      cbAmount = Math.min(total, Math.max(0, total * cbRatio));
      cashAmount = Math.max(0, total - cbAmount);
    }

    rowsWithSortDate.push({
      sortDate: appointmentItem.appointment,
      row: [
        formatDateOnly(appointmentItem.appointment),
        formatTimeOnly(appointmentItem.appointment),
        appointmentItem.clientName || "",
        formatPhoneForCsv(appointmentItem.clientPhone),
        appointmentItem.artistName || "",
        appointmentItem.title || "",
        appointmentItem.project || "",
        total.toString().replace(".", ","),
        "0",
        serviceAmount.toString().replace(".", ","),
        saleAmount.toString().replace(".", ","),
        cbAmount.toString().replace(".", ","),
        cashAmount.toString().replace(".", ","),
        appointmentItem.paymentMethod || "",
      ],
    });
  });

  shiftedDeposits.forEach(({ deposit, linkedAppointment }) => {
    const total = Number(deposit.price) || 0;
    const saleAmount = Number(deposit.saleAmount) || 0;
    const serviceAmount =
      Number(deposit.serviceAmount) || Math.max(0, total - saleAmount);

    let cbAmount = Number(deposit.paymentCbAmount) || 0;
    let cashAmount = Number(deposit.paymentCashAmount) || 0;

    if (deposit.paymentMethod === "CB") {
      cbAmount = total;
      cashAmount = 0;
    } else if (deposit.paymentMethod === "ESPÈCES") {
      cbAmount = 0;
      cashAmount = total;
    } else if (deposit.paymentMethod === "VIREMENT") {
      cbAmount = 0;
      cashAmount = 0;
    } else if (deposit.paymentMethod === "CB + ESPÈCES") {
      cbAmount = Number(deposit.paymentCbAmount) || 0;
      cashAmount = Math.max(0, total - cbAmount);
    }

    // Date/heure, tatoueur et projet = ceux du RDV lié.
    // Client et paiement = ceux de l'acompte.
    rowsWithSortDate.push({
      sortDate: linkedAppointment.appointment,
      row: [
        formatDateOnly(linkedAppointment.appointment),
        formatTimeOnly(linkedAppointment.appointment),
        deposit.clientName || linkedAppointment.clientName || "",
        formatPhoneForCsv(deposit.clientPhone || linkedAppointment.clientPhone),
        linkedAppointment.artistName || deposit.artistName || "",
        ACOMPTE_TYPE,
        linkedAppointment.project || deposit.project || "",
        total.toString().replace(".", ","),
        total.toString().replace(".", ","),
        serviceAmount.toString().replace(".", ","),
        saleAmount.toString().replace(".", ","),
        cbAmount.toString().replace(".", ","),
        cashAmount.toString().replace(".", ","),
        deposit.paymentMethod || "",
      ],
    });
  });

  rowsWithSortDate.sort((a, b) =>
    String(a.sortDate || "").localeCompare(String(b.sortDate || ""))
  );

  const rows = rowsWithSortDate.map((item) => item.row);

  const totals = rows.reduce(
    (acc, row) => {
      acc.total += Number(String(row[7]).replace(",", ".")) || 0;
      acc.acompte += Number(String(row[8]).replace(",", ".")) || 0;
      acc.prestation += Number(String(row[9]).replace(",", ".")) || 0;
      acc.vente += Number(String(row[10]).replace(",", ".")) || 0;
      acc.cb += Number(String(row[11]).replace(",", ".")) || 0;
      acc.especes += Number(String(row[12]).replace(",", ".")) || 0;
      return acc;
    },
    { total: 0, acompte: 0, prestation: 0, vente: 0, cb: 0, especes: 0 }
  );

  rows.push([
    "", "", "", "", "", "", "TOTAL",
    totals.total.toString().replace(".", ","),
    totals.acompte.toString().replace(".", ","),
    totals.prestation.toString().replace(".", ","),
    totals.vente.toString().replace(".", ","),
    totals.cb.toString().replace(".", ","),
    totals.especes.toString().replace(".", ","),
    "",
  ]);

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

      if (!allArtists || allArtists.length === 0) {
        alert("Erreur : aucun tatoueur trouvé dans Supabase.");
        return;
      }

      const findArtist = (artistName) => {
        const searchedArtist = normalizeImportText(artistName);

        if (!searchedArtist) {
          return null;
        }
      
        return (
          allArtists.find(
            (artist) =>
              normalizeImportText(artist.name) === searchedArtist
          ) || null
        );
      };

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
        if (normalizeImportText(getCsvValue(row, ["projet"])) === "total") continue;

        const date = parseCsvDate(getCsvValue(row, ["date"]));
        const time = parseCsvTime(getCsvValue(row, ["heure"]));

        const project = getCsvValue(row, [
          "projet",
          "nom du projet",
          "project",
        ]);

        const clientName = getCsvValue(row, [
          "client",
          "nom client",
          "nom et prenom",
          "nom prenom",
        ]);

        const priceText = getCsvValue(row, ["prix total", "prix", "tarif", "price"]);
        const phone = getCsvValue(row, ["telephone", "téléphone", "phone"]);
        const depositText = getCsvValue(row, ["acompte"]);
        const serviceText = getCsvValue(row, ["prestation"]);
        const saleText = getCsvValue(row, ["vente"]);
        const cbText = getCsvValue(row, ["montant cb"]);
        const cashText = getCsvValue(row, ["montant especes", "montant espèces"]);
        const paymentMethod = getCsvValue(row, ["moyen de paiement"]);

        const notes = getCsvValue(row, [
          "notes du rendez vous",
          "notes du rendez-vous",
          "notes",
        ]);

        const typeName = getCsvValue(row, [
          "type",
          "type de prestation",
        ]);

        const artistName = getCsvValue(row, [
          "tatoueur",
          "artiste",
          "artist",
        ]);

        const matchedArtist = findArtist(artistName);

        if (!matchedArtist) {
          rejectedRows.push(
            `Ligne ${lineNumber} : tatoueur introuvable "${artistName || "case vide"}"`
          );
          continue;
        }

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
              phone: phone.replace(/[^\d+]/g, ""),
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
        const depositAmount = parseCsvPrice(depositText) ?? 0;
        const serviceAmount = parseCsvPrice(serviceText);
        const saleAmount = parseCsvPrice(saleText);
        const cbAmount = parseCsvPrice(cbText);
        const cashAmount = parseCsvPrice(cashText);
        const matchedAppointmentType = findAppointmentTypeFromCsv(typeName);

        if (!matchedAppointmentType) {
          rejectedRows.push(
            `Ligne ${lineNumber} : type de prestation introuvable "${
              typeName || "case vide"
            }"`
          );
          continue;
        }

        const appointmentTypeName =
          getAppointmentTypeName(matchedAppointmentType);

        const appointmentCategory =
          typeof matchedAppointmentType === "string"
            ? "PRESTATION"
            : matchedAppointmentType.category || "PRESTATION";
        
                validAppointments.push({
                  user_id: session.user.id,
                  client_id: matchedClient.id,
                  artist_id: matchedArtist.id,
                  title: appointmentTypeName,
                  project: project || "Rendez-vous importé",
                  notes,
                  appointment: `${date}T${time}:00`,
                  price,
                  sale_amount: saleAmount,
                  service_amount: serviceAmount,
                  payment_cb_amount: cbAmount,
                  payment_cash_amount: cashAmount,
                  duration_hours: null,
                  duration_minutes: null,
                  cancelled: false,
                  linked_appointment_id: null,
                  payment_method: paymentMethod || null,
                  payment_date: null,
                  original_total_before_deposit: depositAmount || null,
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
      setSelectedDate(validAppointments[0].appointment.slice(0, 10));
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

  // La modification d'un tatoueur existant reste toujours autorisée.
  // La limite d'abonnement s'applique uniquement à la création d'un nouveau tatoueur.
  if (editingArtistId === null) {
    const maxArtists = Math.max(1, Number(accessProfile?.max_artists) || 1);

    if (artists.length >= maxArtists) {
      const nextArtistCount = artists.length + 1;
      const nextMonthlyPrice = getSubscriptionPrice(nextArtistCount);

      setSubscriptionModalData({
        currentMaxArtists: maxArtists,
        nextArtistCount,
        nextMonthlyPrice,
      });
      setSelectedUpgradeArtistCount(nextArtistCount);
      setShowSubscriptionModal(true);
      refreshSubscriptionPlan();

      return;
    }
  }

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

  const artist = artists.find(
    (artistItem) => String(artistItem.id) === String(artistId)
  );

  if (!artist) {
    alert("Erreur : tatoueur introuvable.");
    return;
  }

  const hasAppointments = appointments.some(
    (appointmentItem) => String(appointmentItem.artistId) === String(artistId)
  );

  if (hasAppointments) {
    alert("Suppression impossible : ce tatoueur possède encore un ou plusieurs rendez-vous.");
    return;
  }

  setArtistPendingDeletion(artist);
  setShowDeleteArtistModal(true);
  refreshSubscriptionPlan();
};

const confirmDeleteArtist = async () => {
  if (!session?.user?.id || !artistPendingDeletion || isDeletingArtist) return;

  const artistId = artistPendingDeletion.id;
  const currentMaxArtists = Math.max(
    1,
    Number(accessProfile?.max_artists) || artists.length || 1
  );
  const remainingArtistCount = Math.max(0, artists.length - 1);
  const targetMaxArtists = Math.max(1, remainingArtistCount);
  const mustUpdateSubscription = targetMaxArtists < currentMaxArtists;
  if (mustUpdateSubscription && !subscriptionBillingInterval) {
    alert("Impossible de vérifier la périodicité de votre abonnement. Rechargez la page.");
    return;
  }

  setIsDeletingArtist(true);

  try {
    // On baisse d'abord le forfait Stripe. Ainsi, si Stripe refuse la modification,
    // le tatoueur reste intact dans l'application.
    if (mustUpdateSubscription) {
      const { data: subscriptionData, error: subscriptionError } =
        await supabase.functions.invoke("update-subscription", {
          body: {
            maxArtists: targetMaxArtists,
          },
        });

      if (subscriptionError) {
        console.error("ERREUR BAISSE FORFAIT :", subscriptionError);
        alert(
          "La suppression a été annulée car le forfait Stripe n'a pas pu être modifié : " +
            (subscriptionError.message || "erreur inconnue")
        );
        return;
      }

      if (!subscriptionData?.success) {
        console.error("RÉPONSE BAISSE FORFAIT INVALIDE :", subscriptionData);
        alert(
          subscriptionData?.error ||
            "La suppression a été annulée car Stripe n'a pas confirmé le nouveau forfait."
        );
        return;
      }
    }

    const { error: deleteError } = await supabase
      .from("artists")
      .delete()
      .eq("id", artistId)
      .eq("user_id", session.user.id);

    if (deleteError) {
      console.error("ERREUR SUPPRESSION TATOUEUR :", deleteError);

      // Si Stripe avait déjà été baissé mais que la suppression échoue,
      // on tente de remettre immédiatement le forfait précédent.
      if (mustUpdateSubscription) {
        const { error: rollbackError } = await supabase.functions.invoke(
          "update-subscription",
          {
            body: {
              maxArtists: currentMaxArtists,
            },
          }
        );

        if (rollbackError) {
          console.error("ERREUR RESTAURATION FORFAIT :", rollbackError);
          alert(
            "Le tatoueur n'a pas été supprimé. Le forfait avait déjà été modifié et sa restauration automatique a échoué. Vérifiez l'abonnement Stripe avant de réessayer."
          );
          return;
        }
      }

      alert("Le tatoueur n'a pas été supprimé : " + deleteError.message);
      return;
    }

    const { data: refreshedProfile, error: profileError } = await supabase
      .from("profiles")
      .select(
        "*"
      )
      .eq("id", session.user.id)
      .single();

    if (profileError) {
      console.error("ERREUR RECHARGEMENT PROFIL :", profileError);
    } else if (refreshedProfile) {
      setAccessProfile(refreshedProfile);
    }

    await loadSupabaseData();

    if (editingArtistId === artistId) {
      resetArtistForm();
    }

    if (revenueArtistFilter === String(artistId)) {
      setRevenueArtistFilter("all");
    }

    if (agendaArtistFilter === String(artistId)) {
      setAgendaArtistFilter("all");
    }

    setShowDeleteArtistModal(false);
    setArtistPendingDeletion(null);

    const newMonthlyPrice = getSubscriptionPrice(targetMaxArtists);

    showMessage(
      mustUpdateSubscription
        ? `✔ Tatoueur supprimé. Nouveau forfait : ${targetMaxArtists} tatoueur${
            targetMaxArtists > 1 ? "s" : ""
          } — ${newMonthlyPrice.toFixed(2).replace(".", ",")} € TTC / ${subscriptionPeriodLabel}.`
        : "✔ Tatoueur supprimé.",
      3200
    );
  } catch (error) {
    console.error("ERREUR SUPPRESSION TATOUEUR / FORFAIT :", error);
    alert(
      "Erreur : " +
        (error instanceof Error ? error.message : "erreur inconnue")
    );
  } finally {
    setIsDeletingArtist(false);
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
  // Empêche plusieurs clics pendant l'enregistrement
  if (isSavingAppointment) return;

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

  if (!session?.user) {
    alert("Utilisateur non connecté.");
    return;
  }

  const currentEditingAppointment =
    editingAppointmentId !== null
      ? appointments.find(
          (appointmentItem) =>
            String(appointmentItem.id) === String(editingAppointmentId)
        )
      : null;

  let depositDecisionForCancellation = cancelledDepositDecision;

  // Si un RDV passe de actif à annulé et possède un acompte actif,
  // on demande si cet acompte est rendu ou gardé.
  if (
    editingAppointmentId !== null &&
    currentEditingAppointment &&
    currentEditingAppointment.title !== ACOMPTE_TYPE &&
    !currentEditingAppointment.cancelled &&
    appointmentForm.cancelled
  ) {
    const linkedActiveDeposits = getDepositsForAppointment(
      appointments,
      editingAppointmentId
    );

    if (linkedActiveDeposits.length > 0 && !depositDecisionForCancellation) {
      const totalDeposits = linkedActiveDeposits.reduce(
        (sum, deposit) => sum + (Number(deposit.price) || 0),
        0
      );

      const keepDeposit = window.confirm(
        `Ce rendez-vous possède ${linkedActiveDeposits.length} acompte(s) pour un total de ${formatCurrency(totalDeposits)}.\n\n` +
        `Cliquez sur OK si l'acompte est GARDÉ.\n` +
        `Cliquez sur Annuler si l'acompte est RENDU au client.`
      );

      depositDecisionForCancellation = keepDeposit ? "kept" : "returned";
      setCancelledDepositDecision(depositDecisionForCancellation);
    }
  }

  if (
    editingAppointmentId !== null &&
    currentEditingAppointment &&
    currentEditingAppointment.title !== ACOMPTE_TYPE &&
    appointmentForm.title === ACOMPTE_TYPE
  ) {
    alert(
      "Impossible de transformer un rendez-vous classique en acompte. Créez un acompte séparément."
    );
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
      alert(
        "Vous devez obligatoirement lier l'acompte à un rendez-vous futur du même client."
      );
      return;
    }


    const linkedAppointment = appointments.find(
      (appointmentItem) =>
        String(appointmentItem.id) ===
        String(appointmentForm.linkedAppointmentId)
    );

    if (!linkedAppointment) {
      alert("Le rendez-vous lié est introuvable.");
      return;
    }

    if (linkedAppointment.title === ACOMPTE_TYPE) {
      alert("Un acompte ne peut pas être lié à un autre acompte.");
      return;
    }

    if (
      String(linkedAppointment.clientId) !==
      String(appointmentForm.clientId)
    ) {
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
      alert(
        "Le montant de l'acompte ne peut pas dépasser le tarif du rendez-vous lié."
      );
      return;
    }
  }

  const linkedAppointment =
    appointmentForm.title === ACOMPTE_TYPE
      ? appointments.find(
          (appointmentItem) =>
            String(appointmentItem.id) ===
            String(appointmentForm.linkedAppointmentId)
        )
      : null;

  const appointmentPrice =
    appointmentForm.price === ""
      ? 0
      : Number(appointmentForm.price);

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
  } else if (
    appointmentCategory === "PRESTATION + VENTE" ||
    appointmentForm.title === ACOMPTE_TYPE
  ) {
    // Pour une prestation + vente ET pour un acompte, on peut ventiler
    // librement le montant total entre vente et prestation.
    saleAmount = Number(appointmentForm.saleAmount) || 0;

    if (saleAmount < 0) {
      alert("Le montant vente ne peut pas être négatif.");
      return;
    }

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
    paymentCbAmount =
      Number(appointmentForm.paymentCbAmount) || 0;

    if (paymentCbAmount > appointmentPrice) {
      alert(
        "Le montant CB ne peut pas dépasser le montant total du rendez-vous."
      );
      return;
    }

    paymentCashAmount = Math.max(
      0,
      appointmentPrice - paymentCbAmount
    );
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
      appointmentForm.durationHours === ""
        ? null
        : Number(appointmentForm.durationHours),

    duration_minutes:
      appointmentForm.durationMinutes === ""
        ? null
        : Number(appointmentForm.durationMinutes),

    cancelled: appointmentForm.cancelled || false,

    linked_appointment_id:
      appointmentForm.title === ACOMPTE_TYPE
        ? Number(appointmentForm.linkedAppointmentId)
        : null,

    payment_method:
      appointmentForm.paymentMethod.trim() || null,

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

  setIsSavingAppointment(true);

  /*
   * Vérifie si le RDV existe déjà.
   *
   * Cette vérification sert surtout sur iPhone :
   * si l'INSERT a bien atteint Supabase mais que l'iPhone
   * a perdu la réponse réseau, on évite de créer le RDV
   * une deuxième fois.
   */
  const checkAppointmentAlreadyExists = async () => {
    const { data: existing, error } = await supabase
      .from("appointments")
      .select("id")
      .eq("user_id", session.user.id)
      .eq("client_id", payload.client_id)
      .eq("artist_id", payload.artist_id)
      .eq("title", payload.title)
      .eq("project", payload.project)
      .eq("appointment", payload.appointment)
      .limit(1);

    if (error) {
      throw error;
    }

    return existing && existing.length > 0;
  };

  try {
    /*
     * ==========================
     * MODIFICATION D'UN RDV
     * ==========================
     */

    if (editingAppointmentId !== null) {
      const { error } = await supabase
        .from("appointments")
        .update(payload)
        .eq("id", editingAppointmentId)
        .eq("user_id", session.user.id);

      if (error) {
        throw error;
      }

      // Mémorise le sort de l'acompte lors de l'annulation du RDV.
      // cancelled=true sur un ACOMPTE signifie ici : acompte RENDU.
      if (
        appointmentForm.cancelled &&
        currentEditingAppointment &&
        !currentEditingAppointment.cancelled &&
        depositDecisionForCancellation
      ) {
        const linkedDepositIds = getDepositsForAppointment(
          appointments,
          editingAppointmentId
        ).map((deposit) => deposit.id);

        if (linkedDepositIds.length > 0) {
          const { error: depositUpdateError } = await supabase
            .from("appointments")
            .update({
              cancelled: depositDecisionForCancellation === "returned",
            })
            .eq("user_id", session.user.id)
            .in("id", linkedDepositIds);

          if (depositUpdateError) {
            throw depositUpdateError;
          }
        }
      }
    }

    /*
     * ==========================
     * CRÉATION D'UN RDV
     * ==========================
     */
    else {
      try {
        const { error } = await supabase
          .from("appointments")
          .insert(payload);

        if (error) {
          throw error;
        }
      } catch (firstError) {
        console.warn(
          "Première tentative d'enregistrement échouée :",
          firstError
        );

        /*
         * On attend un peu.
         *
         * Si Supabase a reçu l'INSERT mais que la réponse
         * s'est perdue, cela lui laisse le temps de terminer.
         */
        await new Promise((resolve) =>
          setTimeout(resolve, 800)
        );

let verificationSucceeded = false;
let alreadyExists = false;

/*
 * Première vérification
 */
try {
  alreadyExists = await checkAppointmentAlreadyExists();
  verificationSucceeded = true;
} catch (verificationError) {
  console.warn(
    "Première vérification impossible :",
    verificationError
  );
}

/*
 * Si la première vérification réseau a elle-même échoué,
 * on attend puis on tente une deuxième vérification.
 */
if (!verificationSucceeded) {
  await new Promise((resolve) =>
    setTimeout(resolve, 1000)
  );

  try {
    alreadyExists = await checkAppointmentAlreadyExists();
    verificationSucceeded = true;
  } catch (secondVerificationError) {
    console.warn(
      "Deuxième vérification impossible :",
      secondVerificationError
    );
  }
}

/*
 * Le rendez-vous existe :
 * le premier INSERT avait donc bien été enregistré.
 */
if (verificationSucceeded && alreadyExists) {
  console.log(
    "Le rendez-vous avait bien été enregistré malgré l'erreur réseau."
  );
}

/*
 * La vérification a réellement réussi et nous confirme
 * que le rendez-vous n'existe pas :
 * on peut retenter l'INSERT sans risque de doublon.
 */
else if (verificationSucceeded && !alreadyExists) {
  console.log(
    "Rendez-vous absent après vérification : deuxième tentative automatique..."
  );

  await new Promise((resolve) =>
    setTimeout(resolve, 500)
  );

  const { error: retryError } = await supabase
    .from("appointments")
    .insert(payload);

  if (retryError) {
    throw retryError;
  }
}

/*
 * Les deux vérifications ont échoué.
 *
 * On ne refait surtout pas l'INSERT à l'aveugle,
 * car le premier a peut-être déjà été enregistré.
 */
else {
  throw new Error(
    "Connexion instable : impossible de vérifier si le rendez-vous a été enregistré. " +
    "Par sécurité, aucune deuxième tentative n'a été effectuée. " +
    "Actualisez l'agenda avant de réessayer."
  );
}
      }
    }

    /*
     * ==========================
     * ENREGISTREMENT RÉUSSI
     * ==========================
     */

    const appointmentDate =
      appointmentForm.appointment.slice(0, 10);

    setSelectedDate(appointmentDate);

    /*
     * Le RDV est déjà enregistré.
     * Si le simple rechargement de l'agenda échoue,
     * on ne doit surtout pas considérer l'INSERT comme raté.
     */
    try {
      await loadSupabaseData();
    } catch (reloadError) {
      console.warn(
        "RDV enregistré mais rechargement des données impossible :",
        reloadError
      );
    }
setSuccessMessage("✔ RDV enregistré");
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
  } catch (error) {
    console.error(
      "ERREUR ENREGISTREMENT RDV :",
      error
    );

    alert(
      "Impossible d'enregistrer le rendez-vous.\n\n" +
        (error?.message || "Erreur réseau inconnue.")
    );
  } finally {
    setIsSavingAppointment(false);
  }
};

  const editAppointment = (appointmentItem) => {
    setCancelledDepositDecision(null);
    setAppointmentClientSearch("");
    setShowQuickClientForm(false);
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
  .eq("id", existing.id)
  .eq("user_id", session.user.id);

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
    const info = getSpecialDayInfo(dateKey, schoolHolidays);
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

  if (checkingAccess) {
    return (
      <div className="container">
        <div className="card">Vérification de votre accès...</div>
      </div>
    );
  }

  if (accessError) {
    return (
      <div className="container">
        <div className="card" style={{ maxWidth: 620, margin: "40px auto", textAlign: "center" }}>
          <h2>Impossible de vérifier votre accès</h2>
          <p>{accessError}</p>
          <button onClick={() => window.location.reload()}>Réessayer</button>
          <button className="secondary-button" onClick={() => supabase.auth.signOut()} style={{ marginLeft: "10px" }}>
            Déconnexion
          </button>
        </div>
      </div>
    );
  }

  if (!accessAllowed) {
    const subscriptionStatus = accessProfile?.subscription_status;
    const isCanceledSubscription = subscriptionStatus === "canceled";
    const isExpiredSubscription = subscriptionStatus === "active";

    const accessTitle = isCanceledSubscription
      ? "Votre abonnement est terminé"
      : isExpiredSubscription
        ? "Votre abonnement a expiré"
        : "Votre période d'essai est terminée";

    const accessIntro = isCanceledSubscription
      ? "Votre abonnement a été résilié."
      : isExpiredSubscription
        ? "Votre abonnement est arrivé à son terme."
        : "Vos 30 jours d'essai gratuit sont arrivés à leur terme.";

    const accessActionText = isCanceledSubscription
      ? "réactivez votre abonnement"
      : isExpiredSubscription
        ? "renouvelez votre abonnement"
        : "activez votre abonnement";

    const accessButtonText = isCanceledSubscription
      ? "Réactiver mon abonnement"
      : isExpiredSubscription
        ? "Renouveler mon abonnement"
        : "Activer mon abonnement";

    const accessEndDate = isCanceledSubscription || isExpiredSubscription
      ? accessProfile?.subscription_ends_at
      : accessProfile?.trial_ends_at;

    const accessEndDateLabel = isCanceledSubscription
      ? "Abonnement terminé le :"
      : isExpiredSubscription
        ? "Fin de votre abonnement :"
        : "Fin de votre période d'essai :";

    return (
      <div className="container">
        <div className="card" style={{ maxWidth: 620, margin: "40px auto", textAlign: "center", padding: "36px 28px" }}>
          <h1 style={{ marginBottom: "14px" }}>{accessTitle}</h1>

          <p style={{ fontSize: "17px", lineHeight: 1.6 }}>
            {accessIntro}
          </p>

          <p style={{ fontSize: "17px", lineHeight: 1.6 }}>
            Pour continuer à utiliser l'application et retrouver vos données,{" "}
            {accessActionText} à partir de{" "}
            <strong>9,90 € TTC / mois</strong> pour 1 tatoueur.
          </p>

          <p style={{ fontSize: "16px", lineHeight: 1.7 }}>
            <strong>Formule Solo :</strong> 9,90 € TTC / mois
            <br />
            <strong>Tatoueur supplémentaire :</strong> +8 € / mois
            <br />
            <strong>Abonnement annuel Solo :</strong> 99 € / an
            <br />
            Remise annuelle équivalente pour les formules multi-tatoueurs.
            <br />
            <span style={{ opacity: 0.75 }}>Sans engagement</span>
          </p>

          {accessEndDate ? (
            <p style={{ opacity: 0.75, marginTop: "18px" }}>
              {accessEndDateLabel}{" "}
              {new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(
                new Date(accessEndDate)
              )}
            </p>
          ) : null}

          <div style={{ marginTop: "28px" }}>
            <button onClick={() => {
              setCheckoutBillingInterval("month");
              setCheckoutArtistCount(Math.max(1, Number(accessProfile?.max_artists) || 1));
              setShowCheckoutPlanModal(true);
            }}>
              {accessButtonText}
            </button>

            <button
              className="secondary-button"
              onClick={() => supabase.auth.signOut()}
              style={{ marginLeft: "10px" }}
            >
              Déconnexion
            </button>
          </div>
        </div>
        {showCheckoutPlanModal && (
          <div style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.86)", display: "flex",
            alignItems: "center", justifyContent: "center", padding: 16,
            overflowY: "auto"
          }}>
            <div role="dialog" aria-modal="true" aria-label="Choisir mon abonnement"
              style={{
                background: "linear-gradient(145deg,#171717,#080808)",
                color: "#f1c15b", border: "1px solid #d6a529", borderRadius: 24,
                padding: "28px 24px", maxWidth: 510, width: "100%",
                boxShadow: "0 10px 45px rgba(0,0,0,.8)", textAlign: "center"
              }}>
              <h2 style={{ marginTop: 0, color: "#f5b938" }}>Choisir mon abonnement</h2>
              <p>Choisissez votre durée et le nombre de tatoueurs.</p>
              <div style={{ display: "flex", gap: 10, margin: "22px 0" }}>
                {[
                  { value: "month", label: "Mensuel" },
                  { value: "year", label: "Annuel" },
                ].map((option) => (
                  <button key={option.value} type="button"
                    onClick={() => setCheckoutBillingInterval(option.value)}
                    style={{
                      flex: 1, padding: "14px 8px", borderRadius: 12,
                      border: "1px solid #d6a529",
                      background: checkoutBillingInterval === option.value ? "#e2ad36" : "#111",
                      color: checkoutBillingInterval === option.value ? "#080808" : "#f1c15b",
                      fontWeight: 700, cursor: "pointer"
                    }}>{option.label}</button>
                ))}
              </div>
              <label htmlFor="checkout-artist-count" style={{ display: "block", marginBottom: 10 }}>
                Nombre de tatoueurs
              </label>
              <select id="checkout-artist-count" value={checkoutArtistCount}
                onChange={(event) => setCheckoutArtistCount(Number(event.target.value))}
                style={{ width: "100%", padding: 12, borderRadius: 10,
                  background: "#111", color: "#f1c15b", border: "1px solid #d6a529" }}>
                {Array.from({ length: Math.max(20, checkoutArtistCount) }, (_, index) => index + 1)
                  .map((count) => <option key={count} value={count}>{count} tatoueur{count > 1 ? "s" : ""}</option>)}
              </select>
              <p style={{ marginTop: 24, fontSize: 16 }}>Montant de votre forfait</p>
              <p style={{ fontSize: 31, fontWeight: 800, margin: "8px 0", color: "#f5b938" }}>
                {formatCurrency(
                  checkoutBillingInterval === "year"
                    ? 99 + (checkoutArtistCount - 1) * 80
                    : 9.9 + (checkoutArtistCount - 1) * 8
                )} TTC / {checkoutBillingInterval === "year" ? "an" : "mois"}
              </p>
              <p style={{ fontSize: 13, opacity: 0.8 }}>
                {checkoutBillingInterval === "year"
                  ? "99 € / an pour 1 tatoueur + 80 € / an par tatoueur supplémentaire."
                  : "9,90 € / mois pour 1 tatoueur + 8 € / mois par tatoueur supplémentaire."}
              </p>
              <div style={{ display: "flex", gap: 10, marginTop: 24, flexWrap: "wrap" }}>
                <button type="button" disabled={isCreatingCheckout}
                  onClick={testStripeCheckout} style={{ flex: "2 1 220px" }}>
                  {isCreatingCheckout ? "Redirection vers Stripe..." : "Continuer vers le paiement"}
                </button>
                <button type="button" className="secondary-button"
                  disabled={isCreatingCheckout}
                  onClick={() => setShowCheckoutPlanModal(false)}
                  style={{ flex: "1 1 120px" }}>Annuler</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
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
{isGracePeriod && !graceNoticeDismissed && (
  <div role="dialog" aria-modal="true" aria-label="Paiement en attente" style={{position:"fixed",inset:0,zIndex:10000,background:"rgba(0,0,0,.88)",display:"flex",alignItems:"center",justifyContent:"center",padding:18}}>
    <div style={{width:"100%",maxWidth:560,background:"linear-gradient(145deg,#181818,#070707)",border:"1px solid #d6a529",borderRadius:24,padding:"32px 24px",textAlign:"center",color:"#f1c15b",boxShadow:"0 15px 55px #000"}}>
      <h1 style={{color:"#f5b938",fontSize:"clamp(25px,5vw,38px)",margin:"0 0 20px"}}>Paiement de votre abonnement en attente</h1>
      <p>Le renouvellement de votre abonnement n'a pas pu être réglé.</p>
      <p>Vous conservez provisoirement l'accès à votre application et à toutes vos données.</p>
      <p style={{marginTop:24}}>Temps restant avant suspension de l'accès :</p>
      <div aria-live="polite" style={{fontSize:"clamp(26px,6vw,40px)",fontWeight:800,color:"#f5b938",margin:"14px 0 20px"}}>{graceDays} j {String(graceHours).padStart(2,"0")} h {String(graceMinutes).padStart(2,"0")} min</div>
      <p style={{fontSize:14}}>Après ce délai, l'accès sera suspendu jusqu'à la régularisation. Vos données seront conservées.</p>
      <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap",marginTop:25}}>
        
        <button type="button" className="secondary-button" onClick={() => setGraceNoticeDismissed(true)}>Continuer vers l'application</button>
      </div>
    </div>
  </div>
)}
{showSuccess && (
  <div className="success-overlay">
    <div className="success-box">{successMessage}</div>
  </div>
)}

{showDeleteArtistModal && artistPendingDeletion && (() => {
  const currentMaxArtists = Math.max(
    1,
    Number(accessProfile?.max_artists) || artists.length || 1
  );
  const remainingArtistCount = Math.max(0, artists.length - 1);
  const targetMaxArtists = Math.max(1, remainingArtistCount);
  const currentMonthlyPrice = getSubscriptionPrice(currentMaxArtists);
  const newMonthlyPrice = getSubscriptionPrice(targetMaxArtists);
  const priceChanges = targetMaxArtists < currentMaxArtists;

  return (
    <div
      className="subscription-modal-overlay"
      onClick={() => {
        if (!isDeletingArtist) {
          setShowDeleteArtistModal(false);
          setArtistPendingDeletion(null);
        }
      }}
    >
      <div
        className="subscription-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <h2>Supprimer ce tatoueur ?</h2>

        <p>
          Vous êtes sur le point de supprimer <strong>{artistPendingDeletion.name}</strong>.
        </p>

        {priceChanges ? (
          <>
            <p>
              Cette suppression entraînera également une baisse automatique de votre
              abonnement.
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px",
                margin: "20px 0",
              }}
            >
              <div className="subscription-modal-price" style={{ margin: 0 }}>
                <span>Forfait actuel</span>
                <strong>
                  {currentMaxArtists} tatoueur{currentMaxArtists > 1 ? "s" : ""}
                </strong>
                <span>
                  {subscriptionBillingInterval ? `${currentMonthlyPrice.toFixed(2).replace(".", ",")} € TTC / ${subscriptionPeriodLabel}` : "Vérification du forfait..."}
                </span>
              </div>

              <div className="subscription-modal-price" style={{ margin: 0 }}>
                <span>Nouveau forfait</span>
                <strong>
                  {targetMaxArtists} tatoueur{targetMaxArtists > 1 ? "s" : ""}
                </strong>
                <span>
                  {subscriptionBillingInterval ? `${newMonthlyPrice.toFixed(2).replace(".", ",")} € TTC / ${subscriptionPeriodLabel}` : "Vérification du forfait..."}
                </span>
              </div>
            </div>

            <p>
              Votre abonnement Stripe sera automatiquement ajusté si vous confirmez.
            </p>
          </>
        ) : (
          <p>
            Votre formule Solo reste à <strong>{subscriptionBillingInterval ? `${getSubscriptionPrice(1).toFixed(2).replace(".", ",")} € TTC / ${subscriptionPeriodLabel}` : "votre tarif actuel"}</strong>, car le
            forfait minimum comprend 1 tatoueur.
          </p>
        )}

        <p style={{ fontWeight: 700 }}>
          Cette suppression est définitive.
        </p>

        <div className="subscription-modal-actions">
          <button
            type="button"
            disabled={isDeletingArtist || (priceChanges && !subscriptionBillingInterval)}
            onClick={confirmDeleteArtist}
          >
            {isDeletingArtist
              ? "Modification en cours..."
              : priceChanges
              ? `Supprimer et passer au forfait ${targetMaxArtists} tatoueur${
                  targetMaxArtists > 1 ? "s" : ""
                }`
              : "Supprimer le tatoueur"}
          </button>

          <button
            type="button"
            className="subscription-modal-cancel"
            disabled={isDeletingArtist}
            onClick={() => {
              setShowDeleteArtistModal(false);
              setArtistPendingDeletion(null);
            }}
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
})()}

{showSubscriptionModal && (
  <div
    className="subscription-modal-overlay"
    onClick={() => {
      if (!isUpdatingSubscription) {
        setShowSubscriptionModal(false);
      }
    }}
  >
    <div
      className="subscription-modal"
      onClick={(e) => e.stopPropagation()}
    >
      <h2>Passer au forfait supérieur</h2>

      <p>
        Votre abonnement actuel comprend{" "}
        <strong>
          {subscriptionModalData.currentMaxArtists} tatoueur
          {subscriptionModalData.currentMaxArtists > 1 ? "s" : ""}
        </strong>.
      </p>

      <p>
        Choisissez le nombre total de tatoueurs que vous souhaitez autoriser
        dans l'application.
      </p>

      <div
        style={{
          display: "grid",
          gap: "8px",
          margin: "18px 0",
          textAlign: "left",
        }}
      >
        <label htmlFor="upgrade-artist-count">
          <strong>Nombre de tatoueurs</strong>
        </label>

        <select
          id="upgrade-artist-count"
          value={selectedUpgradeArtistCount}
          disabled={isUpdatingSubscription}
          onChange={(e) =>
            setSelectedUpgradeArtistCount(Number(e.target.value))
          }
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: "10px",
            fontSize: "16px",
          }}
        >
          {Array.from(
            {
              length:
                Math.max(
                  10,
                  subscriptionModalData.currentMaxArtists + 5
                ) - subscriptionModalData.currentMaxArtists,
            },
            (_, index) =>
              subscriptionModalData.currentMaxArtists + index + 1
          ).map((artistCount) => (
            <option key={artistCount} value={artistCount}>
              {artistCount} tatoueurs
            </option>
          ))}
        </select>
      </div>

      <div className="subscription-modal-price">
        <span>Nouveau tarif {isAnnualSubscription ? 'annuel' : 'mensuel'}</span>
        <strong>
          {subscriptionBillingInterval
            ? `${getSubscriptionPrice(selectedUpgradeArtistCount).toFixed(2).replace(".", ",")} € TTC / ${subscriptionPeriodLabel}`
            : "Vérification du forfait..."}
        </strong>
      </div>

      <p style={{ marginTop: "14px" }}>
        {isAnnualSubscription
          ? "Formule Solo : 99 € / an + 80 € / an par tatoueur supplémentaire."
          : "Formule Solo : 9,90 € / mois + 8 € / mois par tatoueur supplémentaire."}
        {subscriptionPlanError && <span style={{ display: "block", color: "#ff7777" }}>{subscriptionPlanError}</span>}
      </p>

      <div className="subscription-modal-actions">
        <button
          type="button"
          disabled={isUpdatingSubscription || !subscriptionBillingInterval}
          onClick={updateStripeArtistPlan}
        >
          {isUpdatingSubscription
            ? "Mise à jour en cours..."
            : `Passer au forfait ${selectedUpgradeArtistCount} tatoueurs`}
        </button>

        <button
          type="button"
          className="subscription-modal-cancel"
          disabled={isUpdatingSubscription}
          onClick={() => setShowSubscriptionModal(false)}
        >
          Annuler
        </button>
      </div>
    </div>
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
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: "10px",
            }}
          >
            {pageHistory.length > 1 && (
              <button
                className="back-button"
                onClick={goHome}
              >
                ⌂ Accueil
              </button>
            )}
          
            <button
              className="back-button"
              onClick={goBack}
            >
              ← Retour
            </button>
          </div>
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
                        const specialDayInfo = getSpecialDayInfo(key, schoolHolidays);
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

{items.some((appointment) => !appointment.cancelled) && (
  <span className="month-day-marker"></span>
)}
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
                        const specialDayInfo = getSpecialDayInfo(key, schoolHolidays);
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
{items.some((appointment) => !appointment.cancelled) && (
  <span className="month-day-marker"></span>
)}
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
                        <button type="button" onClick={openExportArtistModal}>
                          Exporter les RDV CSV
                        </button>
                      </div>
                    </div>

                    {showExportArtistModal && (
                      <div
                        className="modal-overlay"
                        onClick={() => setShowExportArtistModal(false)}
                        style={{
                          position: "fixed",
                          inset: 0,
                          background: "rgba(0, 0, 0, 0.65)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          zIndex: 9999,
                          padding: "20px",
                        }}
                      >
                        <div
                          className="card"
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            width: "100%",
                            maxWidth: "520px",
                            maxHeight: "85vh",
                            overflowY: "auto",
                          }}
                        >
                          <h3>Sélection des tatoueurs à exporter</h3>
                          <p className="muted-text">
                            Cochez un ou plusieurs tatoueurs à inclure dans l'export CSV.
                          </p>

                          <div
                            className="action-buttons"
                            style={{ marginBottom: "16px" }}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedExportArtistIds(
                                  artists.map((artist) => String(artist.id))
                                )
                              }
                            >
                              Tout sélectionner
                            </button>

                            <button
                              type="button"
                              onClick={() => setSelectedExportArtistIds([])}
                            >
                              Tout désélectionner
                            </button>
                          </div>

                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "10px",
                              marginBottom: "20px",
                            }}
                          >
                            {artists.map((artist) => {
                              const artistId = String(artist.id);
                              const checked =
                                selectedExportArtistIds.includes(artistId);

                              return (
                                <label
                                  key={artist.id}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "10px",
                                    cursor: "pointer",
                                    padding: "10px 12px",
                                    border: "1px solid rgba(255,255,255,0.15)",
                                    borderRadius: "8px",
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleExportArtist(artist.id)}
                                  />

                                  <span
                                    style={{
                                      width: "12px",
                                      height: "12px",
                                      borderRadius: "50%",
                                      background: artist.color || "#111111",
                                      flexShrink: 0,
                                    }}
                                  />

                                  <strong>{artist.name}</strong>
                                </label>
                              );
                            })}
                          </div>

                          <div className="action-buttons">
                            <button
                              type="button"
                              onClick={() => setShowExportArtistModal(false)}
                            >
                              Annuler
                            </button>

                            <button
                              type="button"
                              onClick={exportAppointmentsCsv}
                              disabled={selectedExportArtistIds.length === 0}
                            >
                              Exporter la sélection
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

          <div className="home-menu-grid">
            <button className="home-menu-button" onClick={() => navigateTo("services")}>
              <span className="home-menu-icon">🧾</span>
              <span className="home-menu-title">Prestations</span>
              <span className="home-menu-subtitle">
                Ajouter ou modifier les types de prestations
              </span>
            </button>

<button
  className="home-menu-button settings-tattoo-button"
  onClick={() => navigateTo("artists")}
>


  <div className="settings-tattoo-logo-wrap">
    <img
      src="/icons/logo_tatoueurs.png"
      alt="Tatoueurs"
      className="settings-tattoo-logo"
    />
  </div>
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

          <div className="card inner-card" style={{ marginBottom: "18px" }}>
            <h3 style={{ marginTop: 0 }}>
              {editingArtistId ? "Modifier le tatoueur" : "Créer un nouveau tatoueur"}
            </h3>

            <div className="form-grid">
              <input
                type="text"
                placeholder="Nom du tatoueur"
                value={artistForm.name}
                onChange={(e) =>
                  setArtistForm({ ...artistForm, name: e.target.value })
                }
              />

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  cursor: "pointer",
                }}
              >
                <input
                  type="color"
                  value={artistForm.color}
                  onChange={(e) =>
                    setArtistForm({ ...artistForm, color: e.target.value })
                  }
                  aria-label="Couleur du tatoueur"
                  title="Couleur du tatoueur"
                  style={{
                    width: "48px",
                    height: "48px",
                    padding: "3px",
                    borderRadius: "6px",
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                />
                <span>Couleur du tatoueur</span>
              </label>

              <button type="button" onClick={saveArtist}>
                {editingArtistId ? "Enregistrer les modifications" : "Créer le tatoueur"}
              </button>

              {editingArtistId && (
                <button type="button" onClick={resetArtistForm}>
                  Annuler
                </button>
              )}
            </div>
          </div>

          <div className="appointments-list">
            {artists.map((artist) => (
              <div key={artist.id} className="card inner-card">
                <h3>{artist.name}</h3>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    margin: "8px 0 16px",
                  }}
                >
                  <span
                    aria-label={`Couleur de ${artist.name}`}
                    title={artist.color || "#111111"}
                    style={{
                      display: "inline-block",
                      width: "32px",
                      height: "32px",
                      borderRadius: "5px",
                      border: "1px solid rgba(255, 190, 40, 0.9)",
                      backgroundColor: artist.color || "#111111",
                      boxShadow: "0 0 8px rgba(255, 190, 40, 0.18)",
                      flexShrink: 0,
                    }}
                  />
                  <span>Couleur du tatoueur</span>
                </div>

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
                      {formatDateTimeWithWeekday(appointment.appointment)}
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
    style={{
      cursor: "pointer",
      textDecoration: appointment.cancelled ? "line-through" : "none",
      opacity: appointment.cancelled ? 0.6 : 1,
    }}
  >
                  <div className="client-appointment-title">
                    {appointment.project}
                  </div>
      
                  <div>{formatDateTimeWithWeekday(appointment.appointment)}</div>
      
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
            <p><strong>Date :</strong> {formatDateTimeWithWeekday(selectedAppointmentDetails.appointment)}</p>
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
                  selectedAppointmentDetails.title === ACOMPTE_TYPE
                    ? Number(selectedAppointmentDetails.serviceAmount) || Math.max(0, total - saleAmount)
                    : category === "PRESTATION"
                    ? total
                    : category === "PRESTATION + VENTE"
                    ? Number(selectedAppointmentDetails.serviceAmount) || Math.max(0, total - saleAmount)
                    : 0;

                return (
                  <>
                    <p>
                      <strong>Catégorie :</strong> {category}
                    </p>

                    {selectedAppointmentDetails.title === ACOMPTE_TYPE && (
                      <>
                        <p>
                          <strong>Montant prestation :</strong> {formatCurrency(serviceAmount)}
                        </p>
                        <p>
                          <strong>Montant vente :</strong> {formatCurrency(saleAmount)}
                        </p>
                      </>
                    )}
              
                    {category === "PRESTATION" && selectedAppointmentDetails.title !== ACOMPTE_TYPE && (
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

      {(getAppointmentTypeCategory(appointmentForm.title) === "PRESTATION + VENTE" ||
        appointmentForm.title === ACOMPTE_TYPE) && (
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
            onChange={(e) => {
              setCancelledDepositDecision(null);
              setAppointmentForm({
                ...appointmentForm,
                cancelled: e.target.checked,
              });
            }}
          />
          Annulé
        </label>
      )}

<button
  type="button"
  onClick={saveAppointment}
  disabled={isSavingAppointment}
>
  {isSavingAppointment
    ? "Enregistrement..."
    : editingAppointmentId !== null
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
