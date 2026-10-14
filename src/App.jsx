import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import { Capacitor } from "@capacitor/core";
import { supabase } from "./supabaseClient";
import Auth from "./Auth";
import "./App.css";

// Contrôle natif uniquement : le navigateur Android conserve le paiement web.
function isNativeAndroid() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}



// LOGILYA — fenêtres de dialogue personnalisées, communes à tous les métiers.
// Elles remplacent les boîtes natives du navigateur sans changer les règles métier.
function logilyaDialog(message, options = {}) {
  return new Promise((resolve) => {
    const confirmMode = options.confirm === true;
    const overlay = document.createElement("div");
    overlay.className = "logilya-dialog-overlay";
    const dialog = document.createElement("section");
    dialog.className = "logilya-dialog";
    dialog.setAttribute("role", confirmMode ? "alertdialog" : "dialog");
    dialog.setAttribute("aria-modal", "true");

    const top = document.createElement("div");
    top.className = "logilya-dialog-top";
    const badge = document.createElement("span");
    badge.className = "logilya-dialog-badge";
    badge.textContent = options.danger ? "!" : confirmMode ? "?" : "i";
    const title = document.createElement("h3");
    title.className = "logilya-dialog-title";
    title.textContent = options.title || (confirmMode ? "Confirmation" : "Information");
    title.id = `logilya-dialog-title-${Date.now()}`;
    dialog.setAttribute("aria-labelledby", title.id);
    top.append(badge, title);

    const body = document.createElement("p");
    body.className = "logilya-dialog-message";
    body.textContent = String(message ?? ""); // textContent évite toute injection HTML.

    const actions = document.createElement("div");
    actions.className = "logilya-dialog-actions";
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const close = (result) => {
      document.removeEventListener("keydown", onKeyDown, true);
      overlay.remove();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
      resolve(result);
    };
    const makeButton = (label, secondary, action) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = secondary ? "logilya-dialog-button logilya-dialog-secondary" : "logilya-dialog-button logilya-dialog-primary";
      button.textContent = label;
      button.addEventListener("click", action);
      return button;
    };
    let cancelButton = null;
    if (confirmMode) {
      cancelButton = makeButton(options.cancelLabel || "Annuler", true, () => close(false));
      actions.append(cancelButton);
    }
    const acceptButton = makeButton(options.confirmLabel || (confirmMode ? "Confirmer" : "Compris"), false, () => close(true));
    actions.append(acceptButton);
    dialog.append(top, body, actions);
    overlay.append(dialog);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay && !options.preventBackdropClose) close(false);
    });
    const onKeyDown = (event) => {
      if (event.key === "Escape" && !options.preventEscapeClose) { event.preventDefault(); close(false); }
      if (event.key === "Tab") {
        const first = cancelButton || acceptButton;
        const last = acceptButton;
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.body.append(overlay);
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown, true);
    (cancelButton || acceptButton).focus();
  });
}

function showLogilyaAlert(message) {
  // Même signature que showLogilyaAlert(), mais affichage non bloquant et stylisé.
  return logilyaDialog(message, { title: "LOGILYA", confirmLabel: "Fermer" });
}

function showLogilyaConfirm(message, options = {}) {
  return logilyaDialog(message, { confirm: true, preventBackdropClose: true, ...options });
}

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

function getSpecialDayInfo(dateKey) {
  const year = Number(dateKey.slice(0, 4));
  const publicHolidays = [
    ...getFrenchPublicHolidays(year - 1),
    ...getFrenchPublicHolidays(year),
    ...getFrenchPublicHolidays(year + 1),
  ];
  const matchedHoliday = publicHolidays.find((item) => item.date === dateKey);
  return matchedHoliday ? { type: "publicHoliday", label: matchedHoliday.label } : null;
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

// Professions : identifiants stables enregistrés dans profiles.profession.
const PROFESSIONS = [
  { id: "tatouage", label: "Tatouage", suggestions: ["TATOUAGE", "RETOUCHE", "DEVIS TATOUAGE", "ACOMPTE"] },
  { id: "piercing", label: "Piercing", suggestions: ["PIERCING", "CHANGEMENT DE BIJOU", "VENTE DE BIJOUX", "CONSULTATION"] },
  { id: "tatouage_piercing", label: "Tatouage + Piercing", suggestions: ["TATOUAGE", "RETOUCHE", "PIERCING", "CHANGEMENT DE BIJOU", "VENTE DE BIJOUX", "DEVIS TATOUAGE", "ACOMPTE"] },
  { id: "coiffure", label: "Coiffure", suggestions: ["COUPE FEMME", "COUPE HOMME", "BRUSHING", "COLORATION"] },
  { id: "barbier", label: "Barbier", suggestions: ["COUPE", "TAILLE DE BARBE", "RASAGE"] },
  { id: "esthetique", label: "Esthétique", suggestions: ["EPILATION", "SOIN DU VISAGE", "SOIN DU CORPS"] },
  { id: "onglerie", label: "Onglerie", suggestions: ["POSE COMPLETE", "REMPLISSAGE", "DEPOSE", "NAIL ART"] },
  { id: "massage", label: "Massage et bien-être", suggestions: ["MASSAGE", "SOIN BIEN-ETRE", "CONSULTATION"] },
  { id: "autre", label: "Autre activité", suggestions: ["PRESTATION", "CONSULTATION", "VENTE"] },
];
const getProfession = (id) => PROFESSIONS.find((item) => item.id === id) || null;


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


const CGV_VERSION = "2026-10-12";
const DPA_VERSION = "DPA-2026-10-12-v2";

function ConditionsGeneralesContent() {
  return (
<div style={{ maxHeight: "65vh", overflowY: "auto", lineHeight: 1.65, paddingRight: "8px" }}>
                    <p className="muted-text" style={{ fontSize: "0.9em" }}>Conditions générales d’utilisation et de vente — version du 12 octobre 2026 — application professionnelle LOGILYA.</p>
                    <h4>1. Objet et champ d’application</h4>
                    <p>Les présentes conditions générales d’utilisation et de vente (« Conditions générales ») régissent l’accès et l’utilisation de l’application de gestion professionnelle éditée par LOGILYA, ainsi que la souscription des abonnements associés. Elles s’adressent aux professionnels agissant pour les besoins de leur activité. Elles s’appliquent sans préjudice des dispositions légales impératives et des conditions particulières expressément convenues par écrit.</p>
                    <h4>2. Identité de l’éditeur</h4>
                    <p>L’application est éditée par l’EURL LOGILYA, représentée par Angélique THILL, dont le siège social est situé 9, Grande Rue, Les Ombraies, 55260 Lignières-sur-Aire, France. SIREN : 108 539 420. Contact : contact@logilya.fr. Les informations complémentaires d’immatriculation figurent, lorsqu’elles sont applicables, dans les mentions légales de l’application.</p>
                    <h4>3. Description du service</h4>
                    <p>LOGILYA propose un logiciel en ligne destiné notamment à la gestion des rendez-vous, des fiches clients, des membres de l’équipe, des prestations, des congés et de certaines données de suivi d’activité. Les fonctionnalités accessibles dépendent de la version du service et des options souscrites. Le service constitue un outil de gestion : il ne se substitue ni aux obligations professionnelles, comptables, fiscales ou réglementaires de l’utilisateur, ni à ses propres vérifications.</p>
                    <h4>4. Création du compte et sécurité</h4>
                    <p>L’accès au service suppose la création d’un compte et la communication d’informations exactes et à jour. L’utilisateur est responsable de la confidentialité de ses identifiants, de l’utilisation de son compte et des droits qu’il accorde aux personnes de son équipe. Il informe sans délai LOGILYA de toute suspicion d’accès non autorisé. LOGILYA peut mettre en œuvre des mesures de sécurité proportionnées, notamment une suspension temporaire en cas de risque avéré pour le service ou les données.</p>
                    <h4>5. Essai gratuit et souscription</h4>
                    <p>Lorsqu’elle est proposée, la période d’essai gratuite est de 30 jours, selon les conditions affichées au moment de l’inscription. À son terme, l’accès aux fonctionnalités soumises à abonnement peut être suspendu en l’absence de souscription. Le choix d’une formule et la validation du paiement emportent souscription aux conditions tarifaires et à la périodicité expressément présentées avant confirmation de la commande.</p>
                    <h4>6. Prix et modalités de paiement</h4>
                    <p>À la date de rédaction des présentes, les tarifs affichés dans l’application sont de 9,90 € TTC par mois pour un membre de l’équipe, puis 8 € supplémentaires par mois et par membre ajouté ; l’offre annuelle est affichée à 99 € par an pour un membre, puis 80 € supplémentaires par an et par membre ajouté. Le prix, les taxes applicables, le nombre de membres autorisés et la période de facturation opposables sont ceux récapitulés lors de la souscription. Le paiement et la gestion de l’abonnement sont assurés au moyen d’un prestataire de paiement tiers. Aucun prélèvement ne peut être exigé au titre d’une option non commandée.</p>
                    <h4>7. Renouvellement, modification et résiliation</h4>
                    <p>Les abonnements sont proposés selon une périodicité mensuelle ou annuelle, renouvelable dans les conditions indiquées lors de la commande. L’utilisateur peut gérer son abonnement depuis l’espace de facturation accessible dans l’application, notamment demander sa résiliation ou modifier le nombre de membres lorsque cette option est disponible. Sauf disposition impérative ou condition plus favorable affichée lors de la commande, la résiliation prend effet à l’échéance de la période déjà réglée, sans remboursement automatique au prorata. Toute modification tarifaire applicable à un renouvellement sera portée à la connaissance de l’utilisateur dans un délai permettant, le cas échéant, de résilier avant son entrée en vigueur.</p>
                    <h4>8. Retard de paiement et suspension</h4>
                    <p>En cas d’échec ou de retard de paiement, LOGILYA peut inviter l’utilisateur à régulariser la situation et, après information appropriée, suspendre l’accès aux fonctionnalités payantes dans les conditions prévues par le service. L’application peut prévoir un délai technique de régularisation ; celui-ci ne constitue pas une garantie de crédit. La suspension ne dispense pas du paiement des sommes contractuellement exigibles. Les dispositions légales applicables aux retards de paiement entre professionnels demeurent réservées.</p>
                    <h4>9. Obligations de l’utilisateur</h4>
                    <p>L’utilisateur s’engage à utiliser le service conformément à sa destination, aux lois applicables et aux droits des tiers. Il lui appartient notamment d’obtenir les informations et autorisations nécessaires à la collecte de données relatives à ses clients et collaborateurs, d’en vérifier l’exactitude, de respecter ses obligations d’information et de confidentialité, et de ne pas introduire de contenu illicite, malveillant ou portant atteinte à des droits de propriété intellectuelle. Toute tentative d’accès non autorisé, de perturbation du service ou de contournement de ses limitations est interdite.</p>
                    <h4>10. Disponibilité, maintenance et évolution</h4>
                    <p>LOGILYA met en œuvre des moyens raisonnables pour assurer la disponibilité et la sécurité du service. Des interruptions peuvent néanmoins résulter d’opérations de maintenance, de mises à jour, de défaillances de réseaux ou de prestataires techniques, ou d’événements échappant à son contrôle. LOGILYA peut faire évoluer l’interface et les fonctionnalités, sous réserve de ne pas priver abusivement l’utilisateur des caractéristiques essentielles du service souscrit. Aucun taux de disponibilité garanti n’est stipulé par les présentes.</p>
                    <h4>11. Données professionnelles, sauvegardes et réversibilité</h4>
                    <p>Les données saisies par l’utilisateur restent sous sa responsabilité et ne deviennent pas la propriété de LOGILYA du seul fait de leur hébergement. L’utilisateur est invité à procéder régulièrement aux exports proposés par l’application et à conserver les documents nécessaires à son activité. Avant une résiliation ou une suppression de compte, il lui appartient d’exporter les données accessibles. Les modalités techniques de restitution, de conservation puis d’effacement des données après la fin du contrat doivent être précisées dans la documentation contractuelle et la politique de confidentialité ; les présentes ne garantissent pas une durée de conservation ou un format d’export non expressément annoncé.</p>
                    <h4>12. Protection des données personnelles</h4>
                    <p>Pour les données de ses propres clients et membres de l’équipe qu’il saisit dans le logiciel, l’utilisateur agit en principe en qualité de responsable du traitement et LOGILYA en qualité de sous-traitant, dans les limites des opérations réalisées pour son compte. LOGILYA agit séparément comme responsable du traitement des données nécessaires à la gestion des comptes, de la facturation et de ses obligations légales. Les parties s’engagent à respecter le RGPD et la réglementation applicable. Les modalités obligatoires de sous-traitance au titre de l’article 28 du RGPD doivent être formalisées dans un accord de traitement des données distinct, notamment pour les mesures de sécurité, sous-traitants ultérieurs, transferts éventuels, assistance, conservation et suppression. Une politique de confidentialité distincte doit informer les personnes concernées.</p>
                    <h4>13. Prestataires techniques</h4>
                    <p>Le fonctionnement de l’application repose notamment sur Vercel pour son déploiement et Supabase pour les services de base de données et d’authentification ; le paiement de l’abonnement peut faire intervenir Stripe. Ces prestataires agissent dans le cadre de leurs services respectifs. Leur intervention ne dispense pas LOGILYA de ses obligations contractuelles et légales. La base de données principale Supabase est déployée dans la région West EU (Ireland), eu-west-1, en Irlande. Cette localisation ne signifie pas que tous les traitements, accès de support ou transferts de chaque prestataire restent exclusivement dans l’Espace économique européen ; ces flux doivent être appréciés au regard des contrats et configurations effectifs.</p>
                    <h4>14. Propriété intellectuelle et licence</h4>
                    <p>L’application, son code, son interface, ses éléments graphiques et sa documentation demeurent protégés par les droits de propriété intellectuelle de leurs titulaires. Sous réserve du paiement de l’abonnement lorsqu’il est dû, LOGILYA concède à l’utilisateur un droit personnel, non exclusif, non transférable et limité à la durée de son accès, pour ses besoins professionnels internes. Toute reproduction, distribution, revente, mise à disposition à des tiers, extraction substantielle ou décompilation non autorisée est interdite, sauf exceptions prévues par la loi.</p>
                    <h4>15. Responsabilité</h4>
                    <p>Chaque partie répond des dommages directs résultant d’un manquement qui lui est imputable, dans les conditions du droit applicable. LOGILYA ne saurait être tenue responsable des erreurs de saisie, des décisions de gestion prises sur la base des données enregistrées, d’une utilisation non conforme du service ou des conséquences d’une indisponibilité imputable exclusivement à un tiers ou à un cas de force majeure, sous réserve de ses propres obligations. Aucune stipulation des présentes n’exclut ni ne limite une responsabilité dont l’exclusion ou la limitation serait interdite par la loi, notamment en cas de faute lourde ou dolosive.</p>
                    <h4>16. Assistance et réclamations</h4>
                    <p>Pour toute demande d’assistance, difficulté technique ou réclamation relative à l’abonnement, l’utilisateur peut écrire à contact@logilya.fr en précisant les informations nécessaires au traitement de sa demande, sans transmettre de mot de passe. LOGILYA s’efforce de répondre dans un délai raisonnable, sans engagement contractuel de délai de résolution sauf accord distinct.</p>
                    <h4>17. Modification des conditions générales</h4>
                    <p>LOGILYA peut actualiser les présentes Conditions générales pour tenir compte d’évolutions légales, techniques ou commerciales. Toute modification substantielle affectant un abonnement en cours doit être communiquée sur un support durable ou par un moyen approprié avant son entrée en vigueur, avec indication des droits dont dispose l’utilisateur. Les modifications ne peuvent produire d’effet rétroactif contraire à la loi ou aux engagements contractuels déjà acquis.</p>
                    <h4>18. Droit applicable et différends</h4>
                    <p>Les présentes Conditions générales sont soumises au droit français, sous réserve des règles impératives éventuellement applicables. En cas de différend, les parties recherchent prioritairement une solution amiable par écrit. À défaut, les juridictions compétentes sont déterminées conformément aux règles de procédure applicables ; aucune clause attributive de compétence n’est stipulée par les présentes.</p>
                    <p style={{ fontSize: "0.9em", borderTop: "1px solid rgba(180,155,105,0.35)", paddingTop: "12px" }}><strong>Information importante :</strong> ces conditions doivent être validées avant leur mise en production, en particulier les modalités de résiliation, la réversibilité des données et l’accord de sous-traitance RGPD.</p>
                  </div>
  );
}


function PolitiqueConfidentialiteContent() {
  return (
    <div style={{ maxHeight: "65vh", overflowY: "auto", lineHeight: 1.7, paddingRight: 8 }}>
      <p className="muted-text">Politique de confidentialité LOGILYA — version du 12 octobre 2026.</p>
      <h4>1. Responsable du traitement et contact</h4>
      <p>Pour la création des comptes professionnels, l'administration du service, la facturation et l'assistance, le responsable du traitement est l'EURL LOGILYA, représentée par Angélique THILL, 9, Grande Rue, Les Ombraies, 55260 Lignières-sur-Aire, France, SIREN 108 539 420. Contact : <a href="mailto:contact@logilya.fr">contact@logilya.fr</a>.</p>
      <h4>2. Répartition des responsabilités</h4>
      <p>Chaque professionnel utilisant l'application détermine les finalités et les moyens essentiels du traitement des données de ses propres clients, rendez-vous et membres de l'équipe : il est en principe responsable de ces traitements. LOGILYA intervient alors comme sous-traitant technique, sur instruction du professionnel. Un accord de sous-traitance conforme à l'article 28 du RGPD doit encadrer ces opérations. Cette politique informe principalement les titulaires de comptes LOGILYA ; les professionnels doivent informer séparément leurs propres clients et collaborateurs.</p>
      <h4>3. Catégories de données</h4>
      <p>Selon l'utilisation du service, peuvent être traitées : adresse électronique et identifiants de compte, informations de connexion et de sécurité, données de souscription et de facturation, demandes au support, preuves d'acceptation des conditions générales, ainsi que les informations professionnelles saisies par les utilisateurs (noms, coordonnées, rendez-vous, prestations, notes, membres de l'équipe et indisponibilités). Les informations de paiement sont traitées via le prestataire de paiement ; LOGILYA n'a pas vocation à conserver les numéros complets de carte bancaire.</p>
      <h4>4. Finalités et bases juridiques</h4>
      <p>La gestion des comptes, l'accès au logiciel, l'exécution des abonnements et le support reposent principalement sur l'exécution du contrat ou les mesures précontractuelles. Les factures et pièces comptables sont traitées pour respecter les obligations légales. La prévention des abus, la sécurité du service et la défense des droits de LOGILYA reposent, selon les cas, sur l'intérêt légitime. Les communications commerciales facultatives, si elles sont mises en place, feront l'objet des informations et choix requis par la réglementation. Pour les données des clients du professionnel, la base juridique est déterminée par ce dernier.</p>
      <h4>5. Destinataires et prestataires</h4>
      <p>Les données sont accessibles aux personnes habilitées dans la limite de leurs fonctions et aux prestataires nécessaires à l'exploitation du service, notamment Supabase (authentification et base de données), Vercel (hébergement et déploiement) et Stripe (gestion des paiements et abonnements), selon les services effectivement utilisés. Les données ne sont pas vendues. Les engagements et sous-traitants ultérieurs de ces prestataires doivent être vérifiés dans leurs documents contractuels.</p>
      <h4>6. Hébergement et transferts internationaux</h4>
      <p>La base de données et l’authentification du projet principal sont configurées chez Supabase dans la région West EU (Ireland), eu-west-1, en Irlande (Union européenne). Vercel assure le déploiement de l’application et Stripe les paiements et abonnements. Cette implantation de la base n’exclut pas des accès techniques, traitements ou transferts internationaux liés aux prestataires. Les pays concernés, fondements juridiques de transfert et garanties contractuelles applicables doivent être vérifiés dans leurs documents et configurations à jour ; LOGILYA ne garantit pas un traitement exclusivement européen.</p>
      <h4>7. Durées de conservation</h4>
      <p>Les données de compte sont conservées pendant la relation contractuelle, puis pendant les délais nécessaires au respect des obligations légales ou à la défense des droits. Les documents comptables sont conservés pendant les durées légalement imposées, généralement dix ans pour les pièces comptables. Les preuves d'acceptation des conditions sont conservées aussi longtemps que nécessaire pour établir les droits et obligations contractuels. Les données métier hébergées pour le compte des professionnels sont soumises aux instructions contractuelles et aux modalités de restitution et de suppression qui doivent être précisées dans l'accord de sous-traitance. Le projet Supabase Pro dispose de sauvegardes automatiques quotidiennes de base de données, avec un historique visible sur sept jours au moins à la date du 12 octobre 2026. Une suppression de compte retire les données actives concernées, sous réserve des données devant être légalement conservées ; des copies peuvent subsister temporairement dans les sauvegardes jusqu’à leur rotation. Les durées exactes des journaux, sauvegardes et données conservées par chaque prestataire doivent être confirmées avant publication.</p>
      <h4>8. Sécurité</h4>
      <p>LOGILYA met en œuvre des mesures organisationnelles et techniques adaptées aux risques, notamment la gestion des accès et les mécanismes de sécurité proposés par ses prestataires. Aucun système ne pouvant garantir une sécurité absolue, les utilisateurs doivent protéger leurs identifiants, limiter les accès et signaler rapidement toute anomalie à contact@logilya.fr. Les procédures de notification des violations de données sont régies par les obligations du RGPD et l'accord de sous-traitance.</p>
      <h4>9. Droits des personnes</h4>
      <p>Dans les conditions prévues par le RGPD, les personnes concernées disposent de droits d'accès, de rectification, d'effacement, de limitation, d'opposition et, dans certains cas, de portabilité. Elles peuvent également retirer leur consentement lorsqu'un traitement repose sur celui-ci. Pour les données de compte LOGILYA, les demandes peuvent être adressées à <a href="mailto:contact@logilya.fr">contact@logilya.fr</a>. Pour les données enregistrées par un professionnel concernant ses clients ou son équipe, il convient de contacter prioritairement ce professionnel, responsable du traitement. Une vérification d'identité proportionnée peut être demandée.</p>
      <h4>10. Réclamation auprès de la CNIL</h4>
      <p>Toute personne concernée peut introduire une réclamation auprès de la Commission nationale de l'informatique et des libertés (CNIL), autorité française de contrôle, si elle estime que ses droits ne sont pas respectés.</p>
      <h4>11. Cookies et traceurs</h4>
      <p>Le service peut utiliser des mécanismes techniques nécessaires à l'authentification, à la sécurité et au maintien de la session. Si des traceurs non essentiels (mesure d'audience non exemptée, publicité, etc.) sont ajoutés, une information spécifique et, lorsque requis, un recueil préalable du consentement seront mis en place. Un inventaire technique des traceurs effectivement utilisés doit être maintenu.</p>
      <h4>12. Mise à jour de la politique</h4>
      <p>LOGILYA peut modifier cette politique pour refléter les évolutions du service, de ses prestataires ou de la réglementation. La version actualisée est rendue accessible dans l'application et les changements importants sont signalés par un moyen approprié.</p>
      <p className="muted-text" style={{ borderTop: "1px solid rgba(180,155,105,0.35)", paddingTop: 12, fontSize: "0.9em" }}><strong>Avant publication définitive :</strong> confirmer les régions d'hébergement et transferts, la liste des sous-traitants, les durées de conservation/suppression et les traceurs réellement utilisés ; conclure l'accord de sous-traitance RGPD avec les professionnels. Ce document ne remplace pas cet accord.</p>
    </div>
  );
}


function AccordSousTraitanceContent() {
  return (
    <div style={{ maxHeight: "65vh", overflowY: "auto", lineHeight: 1.7, paddingRight: 10 }}>
      <p className="muted-text">Accord de sous-traitance des données personnelles (DPA) — version du 12 octobre 2026, v2 — annexe contractuelle aux CGU/CGV de LOGILYA.</p>
      <h4>1. Parties et portée contractuelle</h4>
      <p>Le présent accord est conclu entre le professionnel titulaire du compte LOGILYA (le « Responsable de traitement ») et l’EURL LOGILYA, représentée par Angélique THILL, 9, Grande Rue, Les Ombraies, 55260 Lignières-sur-Aire, France, SIREN 108 539 420, contact@logilya.fr (le « Sous-traitant »). Il régit les traitements de données personnelles réalisés par LOGILYA pour le compte du Responsable de traitement dans le cadre du logiciel de gestion professionnelle. Il complète les CGU/CGV et prévaut sur celles-ci pour les obligations relevant de l’article 28 du RGPD.</p>
      <h4>2. Objet, durée et instructions documentées</h4>
      <p>Les opérations de sous-traitance ont pour objet l’hébergement, l’organisation, la consultation, la mise à jour, la sauvegarde technique et la restitution des données renseignées par le professionnel. Elles durent pendant la mise à disposition du service et, le cas échéant, pendant les opérations de restitution ou de suppression. LOGILYA traite ces données uniquement sur instruction documentée du Responsable de traitement, constituée notamment par le présent accord, les fonctionnalités utilisées et les demandes écrites, sauf obligation légale contraire. Dans ce dernier cas, LOGILYA informe préalablement le Responsable de traitement, sauf interdiction légale. LOGILYA avertit sans délai le Responsable de traitement si une instruction lui paraît constituer une violation du RGPD ou d’une autre disposition applicable en matière de protection des données.</p>
      <h4>3. Description des traitements — annexe A</h4>
      <p><strong>Finalités :</strong> gestion des fiches clients, coordonnées, rendez-vous, prestations, membres de l’équipe, plannings, congés et informations professionnelles associées, selon les fonctionnalités activées. <strong>Opérations :</strong> collecte par saisie du professionnel, enregistrement, structuration, hébergement, consultation, modification, export et effacement. <strong>Personnes concernées :</strong> clients et prospects du professionnel, membres de son équipe et contacts professionnels enregistrés. <strong>Catégories de données :</strong> identité, coordonnées, informations de rendez-vous, prestations, notes et données professionnelles associées. Le Responsable de traitement détermine les finalités et la base légale de ses traitements.</p>
      <p><strong>Données sensibles :</strong> le logiciel n’est pas destiné, par défaut, à recueillir des données relevant de l’article 9 du RGPD (notamment données de santé). Le professionnel s’interdit d’y saisir de telles données sans avoir vérifié la licéité du traitement, sa nécessité, les mesures de sécurité appropriées et l’adéquation du service. Aucune garantie d’hébergement de données de santé au sens du droit français n’est donnée par le présent accord.</p>
      <h4>4. Confidentialité des personnes autorisées</h4>
      <p>LOGILYA veille à ce que les personnes autorisées à traiter les données pour son compte soient soumises à un engagement de confidentialité ou à une obligation légale appropriée, et reçoivent des instructions adaptées à leurs fonctions. L’accès aux données doit être limité aux besoins opérationnels et de support légitimes.</p>
      <h4>5. Mesures techniques et organisationnelles — annexe B</h4>
      <p>LOGILYA met en œuvre des mesures appropriées au risque, conformément à l’article 32 du RGPD, notamment : authentification et contrôle des accès, séparation logique des comptes, restrictions d’accès aux données par utilisateur, communications chiffrées lorsqu’elles transitent sur les réseaux publics, gestion des habilitations, mises à jour de sécurité, suivi des incidents et recours aux mécanismes de sécurité des prestataires. Les sauvegardes quotidiennes de la base Supabase Pro ont été constatées le 12 octobre 2026 ; une restauration complète n’a pas été testée. Les modalités concrètes de journalisation, de chiffrement au repos, de restauration et de conservation doivent être vérifiées et documentées dans les procédures techniques de LOGILYA ; le présent accord ne prétend pas qu’un dispositif non vérifié est déjà opérationnel.</p>
      <h4>6. Sous-traitants ultérieurs — annexe C</h4>
      <p>Le Responsable de traitement autorise de manière générale le recours aux prestataires nécessaires au fonctionnement du service, notamment <strong>Supabase</strong> (base de données, authentification et services associés) et <strong>Vercel</strong> (hébergement et déploiement de l’application), dans la mesure où ils ont effectivement accès à des données traitées pour son compte. <strong>Stripe</strong> intervient pour les paiements et la facturation ; sa qualification et son périmètre de traitement doivent être appréciés selon les flux réels et ses conditions contractuelles, sans le qualifier automatiquement de sous-traitant ultérieur pour les fiches clients.</p>
      <p>LOGILYA impose à ses sous-traitants ultérieurs des obligations de protection des données substantiellement équivalentes à celles du présent accord, conformément à l’article 28 du RGPD, et demeure responsable de leur exécution dans les conditions légales. Toute addition ou remplacement de sous-traitant ultérieur est annoncé par un moyen approprié avec un délai raisonnable permettant au Responsable de traitement de formuler une objection motivée ; les modalités pratiques de notification et d’objection devront être définies dans la documentation contractuelle.</p>
      <h4>7. Localisation et transferts internationaux</h4>
      <p>La base de données principale Supabase est configurée dans la région West EU (Ireland), eu-west-1, en Irlande. Les accès d’administration, les traitements de Vercel et de Stripe et les éventuels transferts hors de l’Espace économique européen dépendent des configurations et contrats effectifs des prestataires. LOGILYA ne réalise de transfert soumis au chapitre V du RGPD que sur un fondement valide (décision d’adéquation, clauses contractuelles types accompagnées, si nécessaire, de garanties supplémentaires, ou autre mécanisme légal). La liste vérifiée des pays et mécanismes de transfert doit être communiquée au Responsable de traitement avant la mise en production définitive de cet accord.</p>
      <h4>8. Assistance au Responsable de traitement</h4>
      <p>Compte tenu de la nature du traitement et des informations à sa disposition, LOGILYA aide raisonnablement le Responsable de traitement à répondre aux demandes d’exercice des droits (accès, rectification, effacement, limitation, portabilité, opposition), et l’assiste dans ses obligations de sécurité, notification de violations, analyses d’impact et consultations préalables lorsqu’elles sont requises. Toute demande reçue directement concernant les données d’un client du professionnel lui est transmise dans les meilleurs délais, sans réponse sur le fond sauf instruction ou obligation légale.</p>
      <h4>9. Violations de données personnelles</h4>
      <p>LOGILYA notifie au Responsable de traitement toute violation de données personnelles dont elle a connaissance, <strong>dans les meilleurs délais</strong>, conformément à l’article 33, paragraphe 2, du RGPD. Elle communique les informations disponibles sur la nature de l’incident, les catégories de données et personnes concernées, les conséquences probables et les mesures prises ou proposées, puis complète ces informations au fur et à mesure. Le Responsable de traitement demeure chargé d’apprécier et, le cas échéant, d’effectuer les notifications à la CNIL et aux personnes concernées dans les délais légaux.</p>
      <h4>10. Sort des données en fin de prestation</h4>
      <p>Au terme de la prestation, LOGILYA restitue ou supprime, au choix du Responsable de traitement et sous réserve des obligations légales de conservation, les données personnelles traitées pour son compte et supprime les copies existantes. Le titulaire du compte peut utiliser la fonction « Exporter toutes mes données (CSV) » dans les paramètres de l’application avant de demander la suppression de son compte. Cet export couvre les données métier accessibles du compte, notamment clients, rendez-vous, membres de l’équipe, prestations et absences, ainsi que des informations de profil limitées. La suppression du compte entraîne la perte d’accès aux données actives ; les éventuelles copies de sauvegarde sont soumises à leur cycle de conservation. Les délais opérationnels et les exceptions légales de conservation doivent être précisés dans une procédure de réversibilité communiquée avant la contractualisation définitive. Aucune suppression immédiate des sauvegardes techniques n’est promise sans validation des contraintes réelles.</p>
      <h4>11. Démonstration de conformité et audits</h4>
      <p>LOGILYA met à disposition les informations nécessaires pour démontrer le respect de ses obligations découlant de l’article 28 du RGPD et permet, dans des conditions raisonnables de confidentialité, de sécurité et de proportionnalité, les audits et inspections réalisés par le Responsable de traitement ou un auditeur mandaté par lui. Les modalités pratiques sont convenues préalablement afin de préserver les données des autres utilisateurs et la sécurité du service.</p>
      <h4>12. Obligations du Responsable de traitement</h4>
      <p>Le professionnel détermine les finalités et bases légales des traitements, informe les personnes concernées, recueille les autorisations nécessaires, veille à la pertinence et à la minimisation des données, définit les durées de conservation, gère les habilitations de son équipe et adresse à LOGILYA des instructions licites et documentées. Il conserve la responsabilité des données et contenus qu’il décide de saisir.</p>
      <h4>13. Entrée en vigueur, modifications et contact</h4>
      <p>Le présent accord entre en vigueur à la date de son acceptation expresse par le titulaire du compte, enregistrée avec sa version. Il demeure applicable pendant la durée des opérations de sous-traitance. Toute modification substantielle donne lieu à une information préalable et, lorsqu’elle le nécessite, à une nouvelle acceptation. Les questions et demandes liées à cet accord sont adressées à <a href="mailto:contact@logilya.fr">contact@logilya.fr</a>.</p>
      <p className="muted-text" style={{ borderTop: "1px solid rgba(180,155,105,0.35)", paddingTop: 12 }}><strong>Points à finaliser avant utilisation contractuelle :</strong> inventaire exact des sous-traitants et de leurs DPA, transferts internationaux, mesures de sécurité réellement activées, procédure d’incident, délais de réversibilité/suppression, ainsi que modalités de notification des changements de sous-traitants. Une validation par un professionnel du droit et une vérification technique sont recommandées.</p>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [cgvStatus, setCgvStatus] = useState("loading");
  const [cgvChecked, setCgvChecked] = useState(false);
  const [dpaChecked, setDpaChecked] = useState(false);
  const [acceptedCgv, setAcceptedCgv] = useState(false);
  const [acceptedDpa, setAcceptedDpa] = useState(false);
  const [cgvSaving, setCgvSaving] = useState(false);
  const [cgvError, setCgvError] = useState("");

  useEffect(() => {
    let active = true;
    if (!session?.user?.id) { setCgvStatus("loading"); return; }
    setCgvStatus("loading");
    setCgvChecked(false);
    setDpaChecked(false);
    (async () => {
      const { data: acceptances, error } = await supabase
        .from("legal_acceptances")
        .select("version")
        .eq("user_id", session.user.id)
        .in("version", [CGV_VERSION, DPA_VERSION]);
      if (!active) return;
      if (error) { setCgvError("Vérification des accords impossible : " + error.message); setCgvStatus("error"); return; }
      const cgvOk = (acceptances || []).some((row) => row.version === CGV_VERSION);
      const dpaOk = (acceptances || []).some((row) => row.version === DPA_VERSION);
      setAcceptedCgv(cgvOk);
      setAcceptedDpa(dpaOk);
      setCgvError("");
      setCgvStatus(cgvOk && dpaOk ? "accepted" : "required");
    })();
    return () => { active = false; };
  }, [session?.user?.id]);

  const acceptConditionsGenerales = async () => {
    if ((!acceptedCgv && !cgvChecked) || (!acceptedDpa && !dpaChecked) || !session?.user?.id || cgvSaving) return;
    setCgvSaving(true);
    setCgvError("");
    const versions = [!acceptedCgv && CGV_VERSION, !acceptedDpa && DPA_VERSION].filter(Boolean);
    const { error } = await supabase.from("legal_acceptances").upsert(
      versions.map((version) => ({ user_id: session.user.id, version })),
      { onConflict: "user_id,version", ignoreDuplicates: true }
    );
    if (error) { setCgvError("Acceptation non enregistrée : " + error.message); }
    else { setAcceptedCgv(true); setAcceptedDpa(true); setCgvStatus("accepted"); setCgvChecked(false); setDpaChecked(false); }
    setCgvSaving(false);
  };

  const [searchAppointmentQuery, setSearchAppointmentQuery] = useState("");
  const [loadingSession, setLoadingSession] = useState(true);
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [setupComplete, setSetupComplete] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [accessAllowed, setAccessAllowed] = useState(false);
  const [accessProfile, setAccessProfile] = useState(null);
  // Le navigateur Android reste sur le parcours web ; seul Android natif est restreint.
  const isAndroidCapacitor = isNativeAndroid();
  const isTrialAccount = ["trial", "trialing"].includes(accessProfile?.subscription_status);
  const canManageStripeSubscription = !isAndroidCapacitor && !isTrialAccount &&
    Boolean(accessProfile?.stripe_subscription_id) && Boolean(accessProfile?.stripe_customer_id);
  const [professionChoice, setProfessionChoice] = useState("");
  const [professionSaving, setProfessionSaving] = useState(false);
  const [professionError, setProfessionError] = useState("");
  const currentProfession = getProfession(accessProfile?.profession);
  const saveProfession = async (selectedProfession = professionChoice) => {
    if (!session?.user?.id || !getProfession(selectedProfession) || professionSaving) return;
    setProfessionSaving(true);
    setProfessionError("");
    try {
      // RPC contrôlée côté serveur : ne donne pas le droit UPDATE sur profiles.
      const { error } = await supabase.rpc("set_my_profession", { chosen_profession: selectedProfession });
      if (error) throw error;
      setAccessProfile((previous) => ({ ...previous, profession: selectedProfession }));
      setProfessionChoice(selectedProfession);
    } catch (error) {
      setProfessionError("Enregistrement impossible : " + (error?.message || "erreur inconnue"));
    } finally {
      setProfessionSaving(false);
    }
  };
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
  const [settingsLanguage, setSettingsLanguage] = useState(() => localStorage.getItem("logilya_language") || "fr");
  const [settingsCurrency, setSettingsCurrency] = useState(() => localStorage.getItem("logilya_currency") || "EUR");
  const [settingsCurrentPassword, setSettingsCurrentPassword] = useState("");
  const [settingsNewPassword, setSettingsNewPassword] = useState("");
  const [settingsConfirmPassword, setSettingsConfirmPassword] = useState("");
  const [settingsPasswordSaving, setSettingsPasswordSaving] = useState(false);
  const [settingsLegalPanel, setSettingsLegalPanel] = useState(null);
  // Suppression de compte : simulation ou suppression réelle selon la réponse du serveur.
  const DELETION_PHRASE = "SUPPRIMER DEFINITIVEMENT MON COMPTE";
  const [accountDeletionStep, setAccountDeletionStep] = useState(0);
  const [accountDeletionPhrase, setAccountDeletionPhrase] = useState("");
  const [accountDeletionRunning, setAccountDeletionRunning] = useState(false);
  const closeAccountDeletion = () => {
    if (accountDeletionRunning) return;
    setAccountDeletionStep(0);
    setAccountDeletionPhrase("");
  };
  const submitAccountDeletionSimulation = async () => {
    if (accountDeletionRunning || accountDeletionStep !== 3 ||
        accountDeletionPhrase !== DELETION_PHRASE || accessProfile?.is_admin === true) return;

    setAccountDeletionRunning(true);
    let deletionSucceeded = false;
    try {
      const { data: result, error } = await supabase.functions.invoke("delete-account", {
        body: { confirmation: DELETION_PHRASE, finalConfirmation: true },
      });
      let response = result;
      if (error?.context?.json) {
        try { response = await error.context.json(); } catch { /* réponse non JSON */ }
      }

      // Seule une réponse explicite de suppression réelle autorise la déconnexion.
      if (response?.success === true && response?.deleted === true &&
          response?.simulation === false) {
        deletionSucceeded = true;
        // Après suppression Auth, la révocation distante peut échouer :
        // une déconnexion locale retire néanmoins la session de ce navigateur.
        try {
          const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
          if (signOutError) console.warn("Déconnexion locale :", signOutError);
        } catch (signOutError) {
          console.warn("Déconnexion après suppression :", signOutError);
        }
        setSession(null);
        setAccessProfile(null);
        setAccessAllowed(false);
        setAccountDeletionStep(0);
        setAccountDeletionPhrase("");
        // Recharge pour réinitialiser tous les états métier du compte supprimé.
        window.location.replace("/");
        return;
      }

      if (error || response?.success === false) {
        await showLogilyaAlert("Demande non exécutée : " +
          (response?.error || error?.message || "Erreur inconnue"));
      } else if (response?.simulation === true && response?.success === true) {
        await showLogilyaAlert("TEST RÉUSSI : aucune donnée ni aucun abonnement n'a été supprimé. La suppression réelle reste désactivée côté serveur.");
      } else {
        await showLogilyaAlert("Réponse inattendue du serveur. Vérifiez le compte avant de recommencer.");
      }
    } catch (error) {
      if (!deletionSucceeded) {
        await showLogilyaAlert("Vérification impossible : " + (error?.message || "Erreur inconnue"));
      }
    } finally {
      if (!deletionSucceeded) {
        setAccountDeletionRunning(false);
        setAccountDeletionStep(0);
        setAccountDeletionPhrase("");
      }
    }
  };

  const saveSettingsPreference = (key, value) => {
    localStorage.setItem(`logilya_${key}`, value);
    if (key === "language") setSettingsLanguage(value);
    if (key === "currency") setSettingsCurrency(value);
  };
  const changeAccountPassword = async () => {
    if (settingsPasswordSaving) return;
    if (!settingsCurrentPassword) { showLogilyaAlert("Saisissez votre mot de passe actuel."); return; }
    if (settingsNewPassword.length < 8 || !/[A-Za-z]/.test(settingsNewPassword) || !/[0-9]/.test(settingsNewPassword)) {
      showLogilyaAlert("Le nouveau mot de passe doit comporter au moins 8 caractères, dont des lettres et des chiffres.");
      return;
    }
    if (settingsNewPassword !== settingsConfirmPassword) { showLogilyaAlert("Les nouveaux mots de passe ne correspondent pas."); return; }
    if (settingsCurrentPassword === settingsNewPassword) { showLogilyaAlert("Le nouveau mot de passe doit être différent de l'ancien."); return; }
    setSettingsPasswordSaving(true);
    try {
      // Supabase vérifie le mot de passe actuel côté serveur quand
      // « Require current password when updating » est activé.
      const { error } = await supabase.auth.updateUser({
        password: settingsNewPassword,
        current_password: settingsCurrentPassword,
      });
      if (error) throw error;
      setSettingsCurrentPassword("");
      setSettingsNewPassword("");
      setSettingsConfirmPassword("");
      showLogilyaAlert("Votre mot de passe a été modifié avec succès.");
    } catch (error) {
      showLogilyaAlert("Impossible de modifier le mot de passe : " + (error?.message || "erreur inconnue"));
    } finally {
      setSettingsPasswordSaving(false);
    }
  };
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
    appointmentTypes: ["ACOMPTE"],
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

  // Règles de fermeture hebdomadaire et périodes de congés (stockées dans Supabase).
  const [absenceRules, setAbsenceRules] = useState([]);
  const [weeklyClosedDays, setWeeklyClosedDays] = useState([]);
  const [leaveStart, setLeaveStart] = useState(getTodayDateOnly());
  const [leaveEnd, setLeaveEnd] = useState(getTodayDateOnly());
  const [leaveArtist, setLeaveArtist] = useState("all");
  const [leaveLabel, setLeaveLabel] = useState("");
  const [savingAbsences, setSavingAbsences] = useState(false);

  const [selectedDate, setSelectedDate] = useState(getTodayDateOnly());
  const [agendaView, setAgendaView] = useState("month");
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [showMobileWeek, setShowMobileWeek] = useState(false);
  const [revenueArtistFilter, setRevenueArtistFilter] = useState("all");
  const [agendaArtistFilter, setAgendaArtistFilter] = useState("all");

  const [clientSearch, setClientSearch] = useState("");
  const [appointmentSearch, setAppointmentSearch] = useState("");
  const [fullExportRunning, setFullExportRunning] = useState(false);

  // Export complet : lecture directe de Supabase (pas seulement des données affichées).
  // Un CSV unique évite le blocage des téléchargements multiples sur mobile.
  const exportAllMyDataCsv = async () => {
    if (fullExportRunning) return;
    setFullExportRunning(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user?.id) throw new Error("Reconnectez-vous avant d'exporter vos données.");
      const userId = authData.user.id;
      const tables = ["clients", "appointments", "artists", "services", "closed_days", "absence_rules"];
      const allRows = [];
      for (const table of tables) {
        let start = 0;
        const pageSize = 500;
        while (true) {
          const { data: rows, error } = await supabase
            .from(table).select("*").eq("user_id", userId)
            .range(start, start + pageSize - 1);
          if (error) throw new Error(`Lecture ${table} impossible : ${error.message}`);
          if (!rows?.length) break;
          rows.forEach((row) => allRows.push({ type_enregistrement: table, ...row }));
          if (rows.length < pageSize) break;
          start += pageSize;
        }
      }
      // Informations de compte non sensibles ; ne jamais exporter les identifiants Stripe.
      const { data: profile, error: profileError } = await supabase
        .from("profiles").select("id,email,profession,created_at")
        .eq("id", userId).single();
      if (profileError) throw new Error(`Lecture du profil impossible : ${profileError.message}`);
      allRows.unshift({ type_enregistrement: "profil", ...profile });

      const columns = ["type_enregistrement", ...new Set(allRows.flatMap((row) => Object.keys(row)).filter((key) => key !== "type_enregistrement"))];
      const csv = Papa.unparse({ fields: columns, data: allRows.map((row) => columns.map((key) => {
        const value = row[key];
        return value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
      })) }, { delimiter: ";", newline: "\r\n", escapeFormulae: true });
      const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `organisya-pro-export-complet-${getTodayDateOnly()}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      await showLogilyaAlert(`Export terminé : ${allRows.length} enregistrements téléchargés. Conservez ce fichier en lieu sûr : il contient des données personnelles.`);
    } catch (error) {
      await showLogilyaAlert("Export impossible : " + (error?.message || "Erreur inconnue"));
    } finally {
      setFullExportRunning(false);
    }
  };

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
const [isOpeningBillingPortal, setIsOpeningBillingPortal] = useState(false);
const openBillingPortal = async () => {
  if (isNativeAndroid() || !canManageStripeSubscription || isOpeningBillingPortal) return;
  setIsOpeningBillingPortal(true);
  try {
    const { data, error } = await supabase.functions.invoke("create-billing-portal-live");
    if (error) throw error;
    if (!data?.url || !data.url.startsWith("https://billing.stripe.com/")) {
      throw new Error(data?.error || "Lien de gestion de facturation indisponible.");
    }
    // Vérifier aussi la plateforme juste avant de quitter l’application.
    if (isNativeAndroid()) return;
    window.location.assign(data.url);
  } catch (error) {
    console.error("PORTAIL DE FACTURATION :", error);
    showLogilyaAlert("Impossible d’ouvrir l’espace de facturation. Vérifiez votre abonnement ou contactez LOGILYA.");
  } finally {
    setIsOpeningBillingPortal(false);
  }
};

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
  if (isNativeAndroid() || isCreatingCheckout) return;
  setIsCreatingCheckout(true);
  try {
    const { data, error } = await supabase.functions.invoke(
      "create-checkout-session-live",
      {
        body: {
          billingInterval: checkoutBillingInterval,
          maxArtists: checkoutArtistCount,
        },
      }
    );

    if (error) {
      console.error("ERREUR STRIPE CHECKOUT :", error);
      showLogilyaAlert("Erreur Stripe Checkout : " + error.message);
      return;
    }

    if (!data?.url) {
      console.error("RÉPONSE STRIPE INVALIDE :", data);
      showLogilyaAlert(data?.error || "Stripe n'a pas renvoyé d'adresse de paiement.");
      return;
    }

    // Aucun renvoi vers le paiement depuis Android natif.
    if (isNativeAndroid()) return;
    window.location.href = data.url;
  } catch (error) {
    console.error("ERREUR STRIPE :", error);
    showLogilyaAlert("Erreur Stripe : " + error.message);
  } finally {
    setIsCreatingCheckout(false);
  }
};

const refreshSubscriptionPlan = async () => {
  setSubscriptionBillingInterval(null);
  setSubscriptionPlanError("");
  const { data, error } = await supabase.functions.invoke("get-subscription-plan-live");
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
  if (isNativeAndroid()) return;
  if (!subscriptionBillingInterval) {
    showLogilyaAlert("Impossible de vérifier le forfait. Réessayez après rechargement.");
    return;
  }
  if (!session?.user?.id) {
    showLogilyaAlert("Erreur : utilisateur non connecté.");
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
      "update-subscription-live",
      {
        body: {
          maxArtists: targetMaxArtists,
        },
      }
    );

    if (error) {
      console.error("ERREUR MODIFICATION ABONNEMENT :", error);
      showLogilyaAlert(
        "Impossible de modifier l'abonnement : " +
          (error.message || "erreur inconnue")
      );
      return;
    }

    if (!data?.success) {
      console.error("RÉPONSE MODIFICATION ABONNEMENT INVALIDE :", data);
      showLogilyaAlert(
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
      `✔ Forfait mis à jour pour ${targetMaxArtists} membres de l’équipe.`,
      2600
    );
  } catch (error) {
    console.error("ERREUR MODIFICATION STRIPE :", error);
    showLogilyaAlert(
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

useEffect(() => {
  let active = true;
  let validationSequence = 0;

  const validateSession = async (candidate) => {
    const sequence = ++validationSequence;
    if (!candidate?.access_token) {
      if (active && sequence === validationSequence) {
        setSession(null);
        setLoadingSession(false);
      }
      return;
    }

    // getUser contacte Auth et vérifie que le compte existe encore.
    const { data: verified, error } = await supabase.auth.getUser(candidate.access_token);
    if (!active || sequence !== validationSequence) return;

    if (error || !verified?.user || verified.user.id !== candidate.user?.id) {
      console.warn("Session non valide : déconnexion locale.");
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch (signOutError) {
        console.warn("Nettoyage de session :", signOutError);
      }
      if (!active || sequence !== validationSequence) return;
      setSession(null);
      setLoadingSession(false);
      return;
    }

    setSession({ ...candidate, user: verified.user });
    setLoadingSession(false);
  };

  // On n'expose pas les données métier avant vérification du compte côté serveur.
  supabase.auth.getSession().then(({ data, error }) => {
    if (!active) return;
    if (error) {
      console.error("Lecture de session :", error);
      setSession(null);
      setLoadingSession(false);
      return;
    }
    void validateSession(data?.session ?? null);
  }).catch((error) => {
    if (!active) return;
    console.error("Initialisation de session :", error);
    setSession(null);
    setLoadingSession(false);
  });

  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
    // Ne pas appeler les méthodes Auth synchroniquement dans ce callback.
    if (event === "SIGNED_OUT") {
      ++validationSequence;
      setSession(null);
      setLoadingSession(false);
    } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
      setLoadingSession(true);
      setTimeout(() => { if (active) void validateSession(newSession); }, 0);
    }
  });

  return () => {
    active = false;
    ++validationSequence;
    subscription.unsubscribe();
  };
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
      showLogilyaAlert(firstError.message);
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

  const loadAbsenceRules = async () => {
    if (!session?.user?.id) return;
    const { data: rules, error } = await supabase.from("absence_rules")
      .select("*").eq("user_id", session.user.id).order("start_date", { ascending: true });
    if (error) {
      console.error("Chargement des congés :", error);
      return;
    }
    setAbsenceRules(rules || []);
    const weekly = (rules || []).filter((r) => r.rule_type === "weekly");
    setWeeklyClosedDays(weekly.map((r) => Number(r.weekday)));
  };

  useEffect(() => {
    if (session?.user?.id && accessAllowed) loadAbsenceRules();
    else { setAbsenceRules([]); setWeeklyClosedDays([]); }
  }, [session?.user?.id, accessAllowed]);

  const dateHasAbsence = (dateKey, artistId = "all") => {
    const day = toDate(dateKey)?.getDay();
    return absenceRules.some((rule) => {
      if (rule.rule_type === "weekly") return Number(rule.weekday) === day;
      if (rule.rule_type !== "leave" || dateKey < rule.start_date || dateKey > rule.end_date) return false;
      return rule.artist_id == null || (artistId !== "all" && String(rule.artist_id) === String(artistId));
    });
  };

  // Noms des membres de l’équipe réellement absents à la date sélectionnée.
  const absentArtistsForDate = (dateKey) => artists.filter((artist) =>
    dateHasAbsence(dateKey, artist.id)
  );

  const renderLeaveNotice = (dateKey) => {
    if (agendaArtistFilter !== "all") return null;
    const absent = absentArtistsForDate(dateKey);
    if (!absent.length) return null;
    if (absent.length === artists.length) {
  return (
    <div
      role="status"
      style={{
        textAlign: "center",
        padding: "9px 12px",
        margin: "10px 0",
        border: "1px solid #a99373",
        borderRadius: 8,
        background: "rgba(196,170,128,0.10)",
        color: "inherit",
        fontSize: "0.92rem",
      }}
    >
      Toute l'équipe en congés
    </div>
  );
}
    const names = absent.map((artist) => artist.name);
    const formattedNames = names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
    return (
      <div role="status" style={{ textAlign: "center", padding: "9px 12px", margin: "10px 0", border: "1px solid #a99373", borderRadius: 8, background: "rgba(196,170,128,0.10)", color: "inherit", fontSize: "0.92rem" }}>
        {formattedNames} {names.length === 1 ? "est en congés" : "sont en congés"}
      </div>
    );
  };

  const saveWeeklyClosures = async () => {
    if (!session?.user?.id || savingAbsences) return;
    setSavingAbsences(true);
    try {
      const { error: deleteError } = await supabase.from("absence_rules").delete()
        .eq("user_id", session.user.id).eq("rule_type", "weekly");
      if (deleteError) throw deleteError;
      if (weeklyClosedDays.length) {
        const { error } = await supabase.from("absence_rules").insert(
          weeklyClosedDays.map((weekday) => ({ user_id: session.user.id, rule_type: "weekly", weekday }))
        );
        if (error) throw error;
      }
      await loadAbsenceRules();
      showMessage("✔ Fermetures hebdomadaires enregistrées.");
    } catch (error) { showLogilyaAlert("Enregistrement impossible : " + error.message); }
    finally { setSavingAbsences(false); }
  };

  const saveLeave = async () => {
    if (!session?.user?.id || savingAbsences) return;
    if (!leaveStart || !leaveEnd || leaveEnd < leaveStart) {
      showLogilyaAlert("Choisissez une date de début et une date de fin valides."); return;
    }
    setSavingAbsences(true);
    const { error } = await supabase.from("absence_rules").insert({
      user_id: session.user.id, rule_type: "leave", start_date: leaveStart,
      end_date: leaveEnd, artist_id: leaveArtist === "all" ? null : leaveArtist,
      label: leaveLabel.trim() || "Congés",
    });
    if (error) showLogilyaAlert("Enregistrement impossible : " + error.message);
    else { await loadAbsenceRules(); setLeaveLabel(""); showMessage("✔ Congés enregistrés."); }
    setSavingAbsences(false);
  };

  const deleteLeave = async (id) => {
    if (!await showLogilyaConfirm("Supprimer cette période de congés ?")) return;
    const { error } = await supabase.from("absence_rules").delete()
      .eq("id", id).eq("user_id", session.user.id).eq("rule_type", "leave");
    if (error) showLogilyaAlert(error.message);
    else await loadAbsenceRules();
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
          artistName: artist?.name || "Membre de l’équipe non attribué",
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
    <div className="agenda-day-revenue-box">
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
    showLogilyaAlert("Erreur : nom et prénom obligatoires.");
    return;
  }

  if (!session?.user) {
    showLogilyaAlert("Erreur : utilisateur non connecté.");
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
      showLogilyaAlert("Erreur modification : " + error.message);
      return;
    }

    await loadSupabaseData();

    showMessage("✔ Client(e) modifié(e).");
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
    showLogilyaAlert("Erreur création : " + error.message);
    return;
  }

  if (!insertedClient?.id) {
    showLogilyaAlert("Erreur : Supabase n'a pas renvoyé la cliente créée.");
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
        showLogilyaAlert("Aucun client valide trouvé. Le CSV doit contenir au minimum nom et prénom.");
        return;
      }

      const { error } = await supabase
        .from("clients")
        .insert(clientsToInsert);

      if (error) {
        showLogilyaAlert(error.message);
        return;
      }

      await loadSupabaseData();
      showMessage(`✔ ${clientsToInsert.length} fiche(s) client importée(s).`);

      event.target.value = "";
    },
    error: (error) => {
      showLogilyaAlert(`Erreur CSV : ${error.message}`);
    },
  });
};

const downloadClientsCsvTemplate = () => {
  const csvContent =
    "NOM;PRENOM;TELEPHONE;NOTES\r\n" +
    "Dupont;Marie;0612345678;Préférence de rendez-vous\r\n";

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
    "DATE", "HEURE", "CLIENT", "TELEPHONE", "MEMBRE DE L’ÉQUIPE", "TYPE",
    "PROJET", "PRIX TOTAL", "ACOMPTE", "PRESTATION", "VENTE",
    "MONTANT CB", "MONTANT ESPECES", "MOYEN DE PAIEMENT",
  ];
  const example = [
    "25/06/2026", "14:30", "Marie Dupont", "0612345678", "Angel",
    "PRESTATION", "Rendez-vous client", "50", "0", "50", "0", "50", "0", "CB",
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
    showLogilyaAlert("Veuillez renseigner une date de début et une date de fin.");
    return;
  }

  if (exportStartDate > exportEndDate) {
    showLogilyaAlert("La date de début ne peut pas être après la date de fin.");
    return;
  }

  if (artists.length === 0) {
    showLogilyaAlert("Aucun membre de l’équipe disponible.");
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
    showLogilyaAlert("Veuillez renseigner une date de début et une date de fin.");
    return;
  }

  if (exportStartDate > exportEndDate) {
    showLogilyaAlert("La date de début ne peut pas être après la date de fin.");
    return;
  }

  if (selectedExportArtistIds.length === 0) {
    showLogilyaAlert("Veuillez sélectionner au moins un membre de l’équipe.");
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
    "MEMBRE DE L’ÉQUIPE",
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
    showLogilyaAlert("Aucun rendez-vous trouvé sur cette période pour les membres de l’équipe sélectionnés.");
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

    // Date/heure, membre de l’équipe et projet = ceux du RDV lié.
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
        showLogilyaAlert("Erreur lecture clients : " + clientsFetchError.message);
        return;
      }

      const { data: allArtists, error: artistsFetchError } = await supabase
        .from("artists")
        .select("*")
        .eq("user_id", session.user.id);

      if (artistsFetchError) {
        showLogilyaAlert("Erreur lecture membres de l’équipe : " + artistsFetchError.message);
        return;
      }

      if (!allArtists || allArtists.length === 0) {
        showLogilyaAlert("Erreur : aucun membre de l’équipe trouvé dans Supabase.");
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
          "membre de l’équipe",
          "membre de l'equipe",
          "tatoueur", // Ancien intitulé CSV conservé pour compatibilité.
          "artiste",
          "artist",
        ]);

        const matchedArtist = findArtist(artistName);

        if (!matchedArtist) {
          rejectedRows.push(
            `Ligne ${lineNumber} : membre de l’équipe introuvable "${artistName || "case vide"}"`
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
        showLogilyaAlert("Aucun RDV valide à importer.\n\n" + rejectedRows.join("\n"));
        event.target.value = "";
        return;
      }

      const { data: insertedAppointments, error: insertError } = await supabase
        .from("appointments")
        .insert(validAppointments)
        .select();

      if (insertError) {
        showLogilyaAlert("Erreur insertion RDV Supabase : " + insertError.message);
        return;
      }

      const { data: checkJune, error: checkError } = await supabase
        .from("appointments")
        .select("*")
        .eq("user_id", session.user.id)
        .gte("appointment", "2026-06-01T00:00:00")
        .lt("appointment", "2026-07-01T00:00:00");

      if (checkError) {
        showLogilyaAlert("RDV insérés, mais vérification impossible : " + checkError.message);
        return;
      }

      await loadSupabaseData();

      setAgendaArtistFilter("all");
      setSelectedDate(validAppointments[0].appointment.slice(0, 10));
      setAgendaView("month");
      navigateTo("agenda");

      showLogilyaAlert(
        `${insertedAppointments?.length || 0} RDV envoyés à Supabase.\n` +
          `${checkJune?.length || 0} RDV trouvés dans Supabase sur juin 2026.\n\n` +
          `${rejectedRows.length} ligne(s) ignorée(s).\n\n` +
          (rejectedRows.length ? rejectedRows.join("\n") : "Aucune ligne ignorée.")
      );

      event.target.value = "";
    },

    error: (error) => {
      showLogilyaAlert("Erreur lecture CSV : " + error.message);
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
    showLogilyaAlert(error.message);
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

  // La modification d'un membre de l’équipe existant reste toujours autorisée.
  // La limite d'abonnement s'applique uniquement à la création d'un nouveau membre de l’équipe.
  if (editingArtistId === null) {
    const maxArtists = Math.max(1, Number(accessProfile?.max_artists) || 1);

    if (artists.length >= maxArtists) {
      if (isAndroidCapacitor) {
        showLogilyaAlert("La limite de membres de l’équipe autorisés pour votre compte est atteinte.");
        return;
      }
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
      showLogilyaAlert(error.message);
      return;
    }
  } else {
    const { error } = await supabase.from("artists").insert({
      user_id: session.user.id,
      name: artistForm.name.trim(),
      color: artistForm.color,
    });

    if (error) {
      showLogilyaAlert(error.message);
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
    showLogilyaAlert("Erreur : membre de l’équipe introuvable.");
    return;
  }

  const hasAppointments = appointments.some(
    (appointmentItem) => String(appointmentItem.artistId) === String(artistId)
  );

  if (hasAppointments) {
    showLogilyaAlert("Suppression impossible : ce membre de l’équipe possède encore un ou plusieurs rendez-vous.");
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
    showLogilyaAlert("Impossible de vérifier la périodicité de votre abonnement. Rechargez la page.");
    return;
  }

  setIsDeletingArtist(true);

  try {
    // On baisse d'abord le forfait Stripe. Ainsi, si Stripe refuse la modification,
    // le membre de l’équipe reste intact dans l'application.
    if (mustUpdateSubscription) {
      const { data: subscriptionData, error: subscriptionError } =
        await supabase.functions.invoke("update-subscription-live", {
          body: {
            maxArtists: targetMaxArtists,
          },
        });

      if (subscriptionError) {
        console.error("ERREUR BAISSE FORFAIT :", subscriptionError);
        showLogilyaAlert(
          "La suppression a été annulée car le forfait Stripe n'a pas pu être modifié : " +
            (subscriptionError.message || "erreur inconnue")
        );
        return;
      }

      if (!subscriptionData?.success) {
        console.error("RÉPONSE BAISSE FORFAIT INVALIDE :", subscriptionData);
        showLogilyaAlert(
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
      console.error("ERREUR SUPPRESSION MEMBRE DE L’ÉQUIPE :", deleteError);

      // Si Stripe avait déjà été baissé mais que la suppression échoue,
      // on tente de remettre immédiatement le forfait précédent.
      if (mustUpdateSubscription) {
        const { error: rollbackError } = await supabase.functions.invoke(
          "update-subscription-live",
          {
            body: {
              maxArtists: currentMaxArtists,
            },
          }
        );

        if (rollbackError) {
          console.error("ERREUR RESTAURATION FORFAIT :", rollbackError);
          showLogilyaAlert(
            "Le membre de l’équipe n'a pas été supprimé. Le forfait avait déjà été modifié et sa restauration automatique a échoué. Vérifiez l'abonnement Stripe avant de réessayer."
          );
          return;
        }
      }

      showLogilyaAlert("Le membre de l’équipe n'a pas été supprimé : " + deleteError.message);
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
        ? `✔ Membre de l’équipe supprimé. Nouveau forfait : ${targetMaxArtists} membre${targetMaxArtists > 1 ? "s" : ""} de l’équipe — ${newMonthlyPrice.toFixed(2).replace(".", ",")} € TTC / ${subscriptionPeriodLabel}.`
        : "✔ Membre de l’équipe supprimé.",
      3200
    );
  } catch (error) {
    console.error("ERREUR SUPPRESSION MEMBRE DE L’ÉQUIPE / FORFAIT :", error);
    showLogilyaAlert(
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
      showLogilyaAlert(error.message);
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
      showLogilyaAlert(error.message);
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
    showLogilyaAlert("Suppression impossible : cette prestation est utilisée dans un ou plusieurs rendez-vous.");
    return;
  }

  const { error } = await supabase
    .from("services")
    .delete()
    .eq("name", serviceNameValue)
    .eq("user_id", session.user.id);

  if (error) {
    showLogilyaAlert(error.message);
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
    showLogilyaAlert("Suppression impossible : ce client possède encore un ou plusieurs rendez-vous.");
    return;
  }

  const confirmDelete = await showLogilyaConfirm(
    "Confirmez-vous la suppression de cette fiche client ?"
  );

  if (!confirmDelete) return;

  const { error } = await supabase
    .from("clients")
    .delete()
    .eq("id", clientId)
    .eq("user_id", session.user.id);

  if (error) {
    showLogilyaAlert(error.message);
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
    showLogilyaAlert("Client obligatoire.");
    return;
  }

  if (!appointmentForm.artistId) {
    showLogilyaAlert("Membre de l’équipe obligatoire.");
    return;
  }

  if (!appointmentForm.title) {
    showLogilyaAlert("Type de prestation obligatoire.");
    return;
  }

  if (!appointmentForm.appointment) {
    showLogilyaAlert("Date et heure obligatoires.");
    return;
  }

  if (!session?.user) {
    showLogilyaAlert("Utilisateur non connecté.");
    return;
  }

  const currentEditingAppointment =
    editingAppointmentId !== null
      ? appointments.find(
          (appointmentItem) =>
            String(appointmentItem.id) === String(editingAppointmentId)
        )
      : null;

  // Contrôle au moment de l'enregistrement, y compris lors d'un déplacement de RDV.
  // Un rendez-vous déjà existant et inchangé ne redemande pas de dérogation.
  const newAppointmentDate = appointmentForm.appointment.slice(0, 10);
  const isNewOrRescheduled = !currentEditingAppointment ||
    currentEditingAppointment.appointment !== appointmentForm.appointment ||
    String(currentEditingAppointment.artistId) !== String(appointmentForm.artistId);
  if (appointmentForm.title !== ACOMPTE_TYPE && !appointmentForm.cancelled && isNewOrRescheduled) {
    // Relire les règles pour éviter d'utiliser un état local périmé.
    const { data: currentRules, error: absenceError } = await supabase
      .from("absence_rules").select("*").eq("user_id", session.user.id);
    if (absenceError) {
      showLogilyaAlert("Impossible de vérifier les congés : " + absenceError.message);
      return;
    }
    const weekday = toDate(newAppointmentDate)?.getDay();
    const conflicts = (currentRules || []).filter((rule) =>
      (rule.rule_type === "weekly" && Number(rule.weekday) === weekday) ||
      (rule.rule_type === "leave" && newAppointmentDate >= rule.start_date &&
        newAppointmentDate <= rule.end_date &&
        (rule.artist_id == null || String(rule.artist_id) === String(appointmentForm.artistId)))
    );
    const manuallyClosed = closedDays.some((item) => item.day === newAppointmentDate);
    if (conflicts.length || manuallyClosed) {
      const artistName = artists.find((a) => String(a.id) === String(appointmentForm.artistId))?.name || "Ce membre de l’équipe";
      const reason = conflicts.some((rule) => rule.rule_type === "leave") ? "en congés" : "indisponible (fermeture de l’établissement)";
      const confirmed = await showLogilyaConfirm(
        `⚠️ ${artistName} est ${reason} le ${formatDateOnly(newAppointmentDate)}.\n\n` +
        "Ce créneau est normalement bloqué.\n\n" +
        "Choisissez « Autoriser exceptionnellement » pour poursuivre, ou « Revenir » pour modifier le rendez-vous.",
        { title: "Créneau indisponible", confirmLabel: "Autoriser exceptionnellement", cancelLabel: "Revenir" }
      );
      if (!confirmed) return;
    }
  }

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

      const keepDeposit = await showLogilyaConfirm(
        `Ce rendez-vous possède ${linkedActiveDeposits.length} acompte(s) pour un total de ${formatCurrency(totalDeposits)}.\n\n` +
        `Choisissez « Acompte conservé » si l'acompte est gardé.\n` +
        `Cliquez sur « Rendu au client » si l'acompte est remboursé.`,
        { title: "Sort de l’acompte", confirmLabel: "Acompte conservé", cancelLabel: "Rendu au client", preventEscapeClose: true }
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
    showLogilyaAlert(
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
    showLogilyaAlert("Impossible de transformer un acompte en rendez-vous classique.");
    return;
  }

  if (appointmentForm.title === ACOMPTE_TYPE) {
    if (!appointmentForm.linkedAppointmentId) {
      showLogilyaAlert(
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
      showLogilyaAlert("Le rendez-vous lié est introuvable.");
      return;
    }

    if (linkedAppointment.title === ACOMPTE_TYPE) {
      showLogilyaAlert("Un acompte ne peut pas être lié à un autre acompte.");
      return;
    }

    if (
      String(linkedAppointment.clientId) !==
      String(appointmentForm.clientId)
    ) {
      showLogilyaAlert("L'acompte doit être lié à un rendez-vous du même client.");
      return;
    }

    const acompteDate = toDate(appointmentForm.appointment);
    const linkedDate = toDate(linkedAppointment.appointment);

    if (!acompteDate || !linkedDate || linkedDate <= acompteDate) {
      showLogilyaAlert("Le rendez-vous lié doit être postérieur à l'acompte.");
      return;
    }

    const depositAmount = Number(appointmentForm.price) || 0;
    const linkedPrice = Number(linkedAppointment.price) || 0;

    if (depositAmount <= 0) {
      showLogilyaAlert("Le montant de l'acompte doit être supérieur à 0.");
      return;
    }

    if (linkedPrice > 0 && depositAmount > linkedPrice) {
      showLogilyaAlert(
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
      showLogilyaAlert("Le montant vente ne peut pas être négatif.");
      return;
    }

    if (saleAmount > appointmentPrice) {
      showLogilyaAlert("Le montant vente ne peut pas dépasser le montant total.");
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
      showLogilyaAlert(
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

    showLogilyaAlert(
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
    showLogilyaAlert("Rendez-vous introuvable.");
    return;
  }

  const linkedDeposits = getDepositsForAppointment(appointments, appointmentId);

  if (linkedDeposits.length > 0) {
    const confirmDeleteDeposit = await showLogilyaConfirm(
      "Attention : un ou plusieurs acomptes sont liés à ce rendez-vous.\n\nVoulez-vous supprimer l'acompte également ?"
    );

    if (confirmDeleteDeposit) {
      const confirmFinalDelete = await showLogilyaConfirm(
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
        showLogilyaAlert(depositsError.message);
        return;
      }

      const { error: appointmentError } = await supabase
        .from("appointments")
        .delete()
        .eq("id", appointmentId)
        .eq("user_id", session.user.id);

      if (appointmentError) {
        showLogilyaAlert(appointmentError.message);
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

    const confirmDeleteOnlyAppointment = await showLogilyaConfirm(
      "L'acompte lié sera conservé.\n\nConfirmez-vous la suppression du rendez-vous seul ?"
    );

    if (!confirmDeleteOnlyAppointment) return;

    const { error } = await supabase
      .from("appointments")
      .delete()
      .eq("id", appointmentId)
      .eq("user_id", session.user.id);

    if (error) {
      showLogilyaAlert(error.message);
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

  const confirmDelete = await showLogilyaConfirm(
    "Confirmez-vous la suppression de ce rendez-vous ?"
  );

  if (!confirmDelete) return;

  const { error } = await supabase
    .from("appointments")
    .delete()
    .eq("id", appointmentId)
    .eq("user_id", session.user.id);

  if (error) {
    showLogilyaAlert(error.message);
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
  const wholeTeamAbsent =
    artists.length > 0 &&
    artists.every((artist) => dateHasAbsence(dateKey, artist.id));

  return (
    closedDays.some((item) => item.day === dateKey) ||
    dateHasAbsence(dateKey, agendaArtistFilter) ||
    wholeTeamAbsent
  );
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
      showLogilyaAlert(error.message);
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
      showLogilyaAlert(error.message);
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
    const info = getSpecialDayInfo(dateKey);
    if (!info) return null;

    return (
      <div
        className={`special-day-badge ${
          "public-holiday-badge"
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

if (cgvStatus === "loading") {
  return (
    <div className="container">
      <div className="card">Chargement...</div>
    </div>
  );
}

if (cgvStatus !== "accepted") {
    return (
      <div className="container" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="card" style={{ width: "100%", maxWidth: 850, padding: 24 }}>
          <h2 style={{ textAlign: "center" }}>Accords contractuels LOGILYA</h2>
          {cgvStatus === "loading" ? <p>Vérification de vos acceptations…</p> : (
            <>
              <p>Pour accéder à votre espace professionnel, veuillez accepter les documents contractuels qui ne l'ont pas encore été.</p>
              {!acceptedCgv && (
                <>
                  <h3>Conditions générales d’utilisation et de vente</h3>
                  <ConditionsGeneralesContent />
                  <label style={{ display: "flex", gap: 12, alignItems: "flex-start", margin: "20px 0", cursor: "pointer" }}>
                    <input type="checkbox" checked={cgvChecked} onChange={(e) => setCgvChecked(e.target.checked)} style={{ marginTop: 5 }} />
                    <span>Je reconnais avoir pris connaissance des CGU/CGV, version du 12 octobre 2026, et les accepte.</span>
                  </label>
                </>
              )}
              {!acceptedDpa && (
                <>
                  <h3>Accord de sous-traitance des données (DPA)</h3>
                  <p>En tant que professionnel responsable des données de vos clients, vous devez également accepter l'accord de sous-traitance conclu avec LOGILYA.</p>
                  <AccordSousTraitanceContent />
                  <label style={{ display: "flex", gap: 12, alignItems: "flex-start", margin: "20px 0", cursor: "pointer" }}>
                    <input type="checkbox" checked={dpaChecked} onChange={(e) => setDpaChecked(e.target.checked)} style={{ marginTop: 5 }} />
                    <span>En qualité de responsable du traitement, j'ai pris connaissance de l'accord de sous-traitance des données (DPA), version du 12 octobre 2026 (v1), et l'accepte pour mon activité professionnelle.</span>
                  </label>
                </>
              )}
              {cgvStatus === "required" && (
                <button type="button" disabled={(!acceptedCgv && !cgvChecked) || (!acceptedDpa && !dpaChecked) || cgvSaving} onClick={acceptConditionsGenerales}>
                  {cgvSaving ? "Enregistrement…" : "Accepter et accéder à l'application"}
                </button>
              )}
              {cgvError && <p role="alert" style={{ color: "#d9534f" }}>{cgvError}</p>}
              {cgvStatus === "error" && <button type="button" onClick={() => window.location.reload()}>Réessayer</button>}
              <button type="button" className="secondary-button" style={{ marginLeft: 10 }} onClick={() => supabase.auth.signOut()}>Refuser / Se déconnecter</button>
            </>
          )}
        </div>
      </div>
    );
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
    const isPaymentOverdue = subscriptionStatus === "past_due";
    const isCanceledSubscription = subscriptionStatus === "canceled";
    const isExpiredSubscription = subscriptionStatus === "active";

    const accessTitle = isPaymentOverdue
      ? "Paiement en retard : accès suspendu"
      : isCanceledSubscription
      ? "Votre abonnement est terminé"
      : isExpiredSubscription
        ? "Votre abonnement a expiré"
        : "Votre période d'essai est terminée";

    const accessIntro = isPaymentOverdue
      ? "Votre paiement de renouvellement n’a pas été réglé. Votre accès est suspendu jusqu’à régularisation."
      : isCanceledSubscription
      ? "Votre abonnement a été résilié."
      : isExpiredSubscription
        ? "Votre abonnement est arrivé à son terme."
        : "Vos 30 jours d'essai gratuit sont arrivés à leur terme.";

    const accessActionText = isPaymentOverdue
      ? "régularisez votre paiement ou contactez l’assistance. Vous pouvez également réactiver un abonnement"
      : isCanceledSubscription
      ? "réactivez votre abonnement"
      : isExpiredSubscription
        ? "renouvelez votre abonnement"
        : "activez votre abonnement";

    const accessButtonText = isPaymentOverdue
      ? "Gérer mon abonnement"
      : isCanceledSubscription
      ? "Réactiver mon abonnement"
      : isExpiredSubscription
        ? "Renouveler mon abonnement"
        : "Activer mon abonnement";

    const accessEndDate = isPaymentOverdue
      ? graceDeadline
      : isCanceledSubscription || isExpiredSubscription
      ? accessProfile?.subscription_ends_at
      : accessProfile?.trial_ends_at;

    const accessEndDateLabel = isPaymentOverdue
      ? "Fin du délai de régularisation :"
      : isCanceledSubscription
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

          {!isAndroidCapacitor && (<>
          <p style={{ fontSize: "17px", lineHeight: 1.6 }}>
            Pour continuer à utiliser l'application et retrouver vos données,{" "}
            {accessActionText} à partir de{" "}
            <strong>9,90 € TTC / mois</strong> pour 1 membre de l’équipe.
          </p>

          <p style={{ fontSize: "16px", lineHeight: 1.7 }}>
            <strong>Formule Solo :</strong> 9,90 € TTC / mois
            <br />
            <strong>Membre de l’équipe supplémentaire :</strong> +8 € / mois
            <br />
            <strong>Abonnement annuel Solo :</strong> 99 € / an
            <br />
            Remise annuelle équivalente pour les formules plusieurs membres de l’équipe.
            <br />
            <span style={{ opacity: 0.75 }}>Sans engagement</span>
          </p>

          </>)}
          {isAndroidCapacitor && (
            <p>Votre accès est suspendu. Vos données sont conservées.</p>
          )}
          {accessEndDate ? (
            <p style={{ opacity: 0.75, marginTop: "18px" }}>
              {accessEndDateLabel}{" "}
              {new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(
                new Date(accessEndDate)
              )}
            </p>
          ) : null}

          <div style={{ marginTop: "28px" }}>
            {!isAndroidCapacitor && (<button onClick={() => {
              setCheckoutBillingInterval("month");
              setCheckoutArtistCount(Math.max(1, Number(accessProfile?.max_artists) || 1));
              setShowCheckoutPlanModal(true);
            }}>
              {accessButtonText}
            </button>)}

            <button
              className="secondary-button"
              onClick={() => supabase.auth.signOut()}
              style={{ marginLeft: "10px" }}
            >
              Déconnexion
            </button>
          </div>
        </div>
        <style>{`
          .logilya-checkout-champagne select,
          .logilya-checkout-champagne select:focus,
          .logilya-checkout-champagne select:hover {
            background: #fffaf3 !important;
            background-color: #fffaf3 !important;
            color: #29231e !important;
            -webkit-text-fill-color: #29231e !important;
            border: 1px solid #a99373 !important;
            color-scheme: light;
          }
          .logilya-checkout-champagne select option {
            background: #fffaf3 !important;
            color: #29231e !important;
          }
          .logilya-checkout-champagne .logilya-checkout-cancel,
          .logilya-checkout-champagne .logilya-checkout-cancel:hover,
          .logilya-checkout-champagne .logilya-checkout-cancel:focus {
            background: #fffaf3 !important;
            background-color: #fffaf3 !important;
            color: #29231e !important;
            -webkit-text-fill-color: #29231e !important;
            border: 1px solid #a99373 !important;
            opacity: 1 !important;
          }
        `}</style>
        {!isAndroidCapacitor && showCheckoutPlanModal && (
          <div style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.86)", display: "flex",
            alignItems: "center", justifyContent: "center", padding: 16,
            overflowY: "auto"
          }}>
            <div className="logilya-checkout-champagne" role="dialog" aria-modal="true" aria-label="Choisir mon abonnement"
              style={{
                background: "linear-gradient(145deg,#f9f5ee,#e9dfd1)",
                color: "#29231e", border: "1px solid #a99373", borderRadius: 24,
                padding: "28px 24px", maxWidth: 510, width: "100%",
                boxShadow: "0 10px 45px rgba(0,0,0,.8)", textAlign: "center"
              }}>
              <h2 style={{ marginTop: 0, color: "#29231e" }}>Choisir mon abonnement</h2>
              <p>Choisissez votre durée et le nombre de membres de l’équipe.</p>
              <div style={{ display: "flex", gap: 10, margin: "22px 0" }}>
                {[
                  { value: "month", label: "Mensuel" },
                  { value: "year", label: "Annuel" },
                ].map((option) => (
                  <button key={option.value} type="button"
                    onClick={() => setCheckoutBillingInterval(option.value)}
                    style={{
                      flex: 1, padding: "14px 8px", borderRadius: 12,
                      border: "1px solid #a99373",
                      background: checkoutBillingInterval === option.value ? "#d7c0a0" : "#fffaf3",
                      color: "#29231e",
                      fontWeight: 700, cursor: "pointer"
                    }}>{option.label}</button>
                ))}
              </div>
              <label htmlFor="checkout-artist-count" style={{ display: "block", marginBottom: 10 }}>
                Nombre de membres de l’équipe
              </label>
              <select id="checkout-artist-count" value={checkoutArtistCount}
                onChange={(event) => setCheckoutArtistCount(Number(event.target.value))}
                style={{ width: "100%", padding: 12, borderRadius: 10,
                  background: "#fffaf3", color: "#29231e", border: "1px solid #a99373" }}>
                {Array.from({ length: Math.max(20, checkoutArtistCount) }, (_, index) => index + 1)
                  .map((count) => <option key={count} value={count}>{count} membre{count > 1 ? "s" : ""} de l’équipe</option>)}
              </select>
              <p style={{ marginTop: 24, fontSize: 16 }}>Montant de votre forfait</p>
              <p style={{ fontSize: 31, fontWeight: 800, margin: "8px 0", color: "#29231e" }}>
                {formatCurrency(
                  checkoutBillingInterval === "year"
                    ? 99 + (checkoutArtistCount - 1) * 80
                    : 9.9 + (checkoutArtistCount - 1) * 8
                )} TTC / {checkoutBillingInterval === "year" ? "an" : "mois"}
              </p>
              <p style={{ fontSize: 13, color: "#453d35", opacity: 1 }}>
                {checkoutBillingInterval === "year"
                  ? "99 € / an pour 1 membre de l’équipe + 80 € / an par membre supplémentaire de l’équipe."
                  : "9,90 € / mois pour 1 membre de l’équipe + 8 € / mois par membre supplémentaire de l’équipe."}
              </p>
              <div style={{ display: "flex", gap: 10, marginTop: 24, flexWrap: "wrap" }}>
                <button type="button" disabled={isCreatingCheckout}
                  onClick={testStripeCheckout} style={{ flex: "2 1 220px", background: "#d7c0a0", color: "#29231e", border: "1px solid #a99373", fontWeight: 700 }}>
                  {isCreatingCheckout ? "Redirection vers Stripe..." : "Continuer vers le paiement"}
                </button>
                <button type="button" className="logilya-checkout-cancel"
                  disabled={isCreatingCheckout}
                  onClick={() => setShowCheckoutPlanModal(false)}
                  style={{ flex: "1 1 120px", background: "#fffaf3", color: "#29231e", border: "1px solid #a99373", fontWeight: 700 }}>Annuler</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // L'activité est définie une fois par compte, après authentification et
  // validation de l'accès, avant la configuration des prestations.
  if (!currentProfession) {
    return (
      <div className="container" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <section className="card" style={{ width: "100%", maxWidth: 620, padding: 28 }}>
          <h1>Bienvenue sur LOGILYA</h1>
          <h2>Quelle est votre activité professionnelle ?</h2>
          <p>Votre choix permet de vous suggérer des prestations adaptées. Vous pourrez toujours créer vos propres prestations.</p>
          <label htmlFor="profession-initiale">Votre métier</label>
          <select id="profession-initiale" value={professionChoice} onChange={(event) => setProfessionChoice(event.target.value)}>
            <option value="">Sélectionner votre activité</option>
            {PROFESSIONS.map((profession) => (
              <option key={profession.id} value={profession.id}>{profession.label}</option>
            ))}
          </select>
          {professionError && <p role="alert" style={{ color: "#b42318" }}>{professionError}</p>}
          <button type="button" onClick={() => saveProfession()} disabled={!professionChoice || professionSaving} style={{ marginTop: 18 }}>
            {professionSaving ? "Enregistrement…" : "Valider mon activité"}
          </button>
          <button type="button" className="secondary-button" onClick={() => supabase.auth.signOut()} style={{ marginLeft: 10 }}>Déconnexion</button>
        </section>
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
            Avant d’utiliser l’application, vous devez ajouter au moins un membre de l’équipe
            et au moins une prestation.
          </p>

          <div className="setup-status">
            <p>
              <strong>Membres de l’équipe :</strong> {artists.length > 0 ? "OK" : "À compléter"}
            </p>
            <p>
              <strong>Prestations :</strong> {canFinishSetup ? "OK" : "À compléter"}
            </p>
          </div>

          <div className="action-buttons" style={{ marginBottom: "16px" }}>
            <button onClick={() => navigateTo("artists")}>
              Configurer les membres de l’équipe
            </button>
            <button onClick={() => navigateTo("services")}>
              Configurer les prestations
            </button>
          </div>

          <button
            onClick={() => {
              if (!canFinishSetup) {
                showLogilyaAlert("Ajoute au moins un membre de l’équipe et une prestation.");
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
    <div style={{width:"100%",maxWidth:560,background:"linear-gradient(145deg,#f9f5ee,#e9dfd1)",border:"1px solid #a99373",borderRadius:24,padding:"32px 24px",textAlign:"center",color:"#29231e",boxShadow:"0 15px 55px #000"}}>
      <h1 style={{color:"#29231e",fontSize:"clamp(25px,5vw,38px)",margin:"0 0 20px"}}>Paiement de votre abonnement en attente</h1>
      <p>Le renouvellement de votre abonnement n'a pas pu être réglé.</p>
      <p>Vous conservez provisoirement l'accès à votre application et à toutes vos données.</p>
      <p style={{marginTop:24}}>Temps restant avant suspension de l'accès :</p>
      <div aria-live="polite" style={{fontSize:"clamp(26px,6vw,40px)",fontWeight:800,color:"#29231e",margin:"14px 0 20px"}}>{graceDays} j {String(graceHours).padStart(2,"0")} h {String(graceMinutes).padStart(2,"0")} min</div>
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
        <h2>Supprimer ce membre de l’équipe ?</h2>

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
                  {currentMaxArtists} membre{currentMaxArtists > 1 ? "s" : ""} de l’équipe
                </strong>
                <span>
                  {subscriptionBillingInterval ? `${currentMonthlyPrice.toFixed(2).replace(".", ",")} € TTC / ${subscriptionPeriodLabel}` : "Vérification du forfait..."}
                </span>
              </div>

              <div className="subscription-modal-price" style={{ margin: 0 }}>
                <span>Nouveau forfait</span>
                <strong>
                  {targetMaxArtists} membre{targetMaxArtists > 1 ? "s" : ""} de l’équipe
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
            forfait minimum comprend 1 membre de l’équipe.
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
              ? `Supprimer et passer au forfait ${targetMaxArtists} membre${targetMaxArtists > 1 ? "s" : ""} de l’équipe`
              : "Supprimer le membre de l’équipe"}
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

{!isAndroidCapacitor && showSubscriptionModal && (
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
          {subscriptionModalData.currentMaxArtists} membre de l’équipe
          {subscriptionModalData.currentMaxArtists > 1 ? "s" : ""}
        </strong>.
      </p>

      <p>
        Choisissez le nombre total de membres de l’équipe que vous souhaitez autoriser
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
          <strong>Nombre de membres de l’équipe</strong>
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
              {artistCount} membres de l’équipe
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
          ? "Formule Solo : 99 € / an + 80 € / an par membre supplémentaire de l’équipe."
          : "Formule Solo : 9,90 € / mois + 8 € / mois par membre supplémentaire de l’équipe."}
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
            : `Passer au forfait ${selectedUpgradeArtistCount} membres de l’équipe`}
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
            Vous devez d’abord créer au moins un membre de l’équipe et une prestation avant
            d’utiliser le reste de l’application.
          </p>

          <div className="action-buttons">
            <button onClick={() => navigateTo("artists")}>Membres de l’équipe</button>
            <button onClick={() => navigateTo("services")}>Prestations</button>
          </div>
        </div>
      )}

      {page === "home" && setupComplete && (
        <section className="card home-card">
<h2 className="organizya-home-brand" aria-label="Organizya PRO" style={{ margin: "4px 0 20px", padding: 0, width: "100%", display: "flex", justifyContent: "center", alignItems: "center" }}>
            <img
              src="/icons/logo_organizia.png"
              alt="Organizya PRO"
              style={{ display: "block", width: "min(85%, 360px)", maxWidth: "100%", height: "auto", objectFit: "contain" }}
            />
          </h2>
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
                          <option value="all">Tous les membres de l’équipe</option>
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
                        <option value="all">Tous les membres de l’équipe</option>
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
              </div>

              {agendaView === "day" && renderLeaveNotice(selectedDate)}
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
                      <div className="closed-day-toggle">
  <label>
    <input
      type="checkbox"
      checked={closedDays.some((item) => item.day === selectedDate)}
      onChange={() => toggleClosedDay(selectedDate)}
    />
    Journée en congés
  </label>
</div>

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

                      <div className="closed-day-toggle">
  <label>
    <input
      type="checkbox"
      checked={closedDays.some((item) => item.day === selectedDate)}
      onChange={() => toggleClosedDay(selectedDate)}
    />
    Journée en congés
  </label>
</div>

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
                        const specialDayInfo = getSpecialDayInfo(key);
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

                    {renderLeaveNotice(selectedDate)}
                    <div className="month-day-appointments-list">
                      {selectedDayAppointments.length === 0 ? (
                        <>
                          <p>Aucun rendez-vous pour cette date.</p>
                          <div className="closed-day-toggle">
  <label>
    <input
      type="checkbox"
      checked={closedDays.some((item) => item.day === selectedDate)}
      onChange={() => toggleClosedDay(selectedDate)}
    />
    Journée en congés
  </label>
</div>

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

                          <div className="closed-day-toggle">
  <label>
    <input
      type="checkbox"
      checked={closedDays.some((item) => item.day === selectedDate)}
      onChange={() => toggleClosedDay(selectedDate)}
    />
    Journée en congés
  </label>
</div>

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
                          <option value="all">Tous les membres de l’équipe</option>
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
                        const specialDayInfo = getSpecialDayInfo(key);
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

                    {renderLeaveNotice(selectedDate)}
                    <div className="month-day-appointments-list">
                      {selectedDayAppointments.length === 0 ? (
                        <>
                          <p>Aucun rendez-vous pour cette date.</p>
                          <div className="closed-day-toggle">
  <label>
    <input
      type="checkbox"
      checked={closedDays.some((item) => item.day === selectedDate)}
      onChange={() => toggleClosedDay(selectedDate)}
    />
    Journée en congés
  </label>
</div>

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

                          <div className="closed-day-toggle">
  <label>
    <input
      type="checkbox"
      checked={closedDays.some((item) => item.day === selectedDate)}
      onChange={() => toggleClosedDay(selectedDate)}
    />
    Journée en congés
  </label>
</div>

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
                Calculé selon la date affichée et le membre de l’équipe sélectionné
              </p>
            </div>

            <select
              value={revenueArtistFilter}
              onChange={(e) => setRevenueArtistFilter(e.target.value)}
              className="compact-select"
            >
              <option value="all">Tous les membres de l’équipe</option>
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
            <div className="revenue-box">
              <span>Jour</span>
              <strong>{formatCurrency(revenueStats.dayTotal)}</strong>
            </div>
            <div className="revenue-box">
              <span>Semaine</span>
              <strong>{formatCurrency(revenueStats.weekTotal)}</strong>
            </div>
            <div className="revenue-box">
              <span>Mois</span>
              <strong>{formatCurrency(revenueStats.monthTotal)}</strong>
            </div>
          </div>
        </section>
      )}

      {page === "settings" && setupComplete && (
        <section className="card">
          <h2>Paramètres</h2>
          <p className="muted-text">Activité professionnelle : <strong>{currentProfession?.label || "Non renseignée"}</strong></p>
          <p className="muted-text">Gérez les données principales de l’application</p>

          <div className="home-menu-grid">
            <button
              className="home-menu-button settings-tattoo-button"
              onClick={() => navigateTo("services")}
            >
              <div className="settings-tattoo-logo-wrap">
                <img
                  src="/icons/prestations.png"
                  alt="Prestations"
                  className="settings-tattoo-logo"
                />
              </div>
            </button>

<button
  className="home-menu-button settings-tattoo-button"
  onClick={() => navigateTo("artists")}
>


  <div className="settings-tattoo-logo-wrap">
    <img
      src="/icons/membres_equipe.png"
      alt="Membres de l’équipe"
      className="settings-tattoo-logo"
    />
  </div>
</button>
            <button
              className="home-menu-button settings-tattoo-button"
              type="button"
              onClick={() => navigateTo("absences")}
            >
              <div className="settings-tattoo-logo-wrap">
                <img
                  src="/icons/conges.png"
                  alt="Congés"
                  className="settings-tattoo-logo"
                />
              </div>
            </button>
          </div>

                    <div className="card inner-card" style={{ marginBottom: "16px" }}>
                      <h3>Exporter toutes mes données</h3>
                      <p className="muted-text">
                        Téléchargez un fichier CSV complet contenant vos clients, rendez-vous,
                        prestations, membres de l’équipe, congés et fermetures.
                        Le fichier contient des données personnelles : conservez-le en lieu sûr.
                      </p>
                      <div className="action-buttons">
                        <button type="button" onClick={exportAllMyDataCsv} disabled={fullExportRunning}>
                          {fullExportRunning ? "Préparation de l’export…" : "Exporter toutes mes données (CSV)"}
                        </button>
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
            <h3>Abonnement</h3>
            {canManageStripeSubscription && (
              <p className="muted-text">
                Consultez vos factures, vos paiements et vos moyens de paiement,
                ou gérez votre abonnement depuis l’espace sécurisé Stripe.
              </p>
            )}
            <p><strong>Statut :</strong> {isTrialAccount ? "Essai gratuit en cours" : accessProfile?.subscription_status === "active" ? "Actif" : accessProfile?.subscription_status === "past_due" ? "Paiement en attente" : accessProfile?.subscription_status || "Non renseigné"}</p>
            {isTrialAccount && (
              <p><strong>Fin de l’essai gratuit :</strong> {formatDateOnly(accessProfile?.trial_ends_at)}</p>
            )}
            <p><strong>Membres de l’équipe inclus :</strong> {accessProfile?.max_artists || 1}</p>
            {!isTrialAccount && accessProfile?.subscription_ends_at && (
              <p><strong>Échéance indiquée :</strong> {formatDateOnly(accessProfile.subscription_ends_at)}</p>
            )}
            {canManageStripeSubscription && (
              <button type="button" disabled={isOpeningBillingPortal} onClick={openBillingPortal}>
                {isOpeningBillingPortal ? "Ouverture…" : "Gérer mon abonnement"}
              </button>
            )}
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
                            maxWidth: "680px",
                            maxHeight: "85vh",
                            overflowY: "auto",
                          }}
                        >
                          <h3>Sélection des membres de l’équipe à exporter</h3>
                          <p className="muted-text">
                            Cochez un ou plusieurs membres de l’équipe à inclure dans l'export CSV.
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


          {accessProfile?.is_admin !== true && (
            <div className="card inner-card" style={{ marginBottom: "16px", border: "1px solid #bda982" }}>
              <h3>Mon compte</h3>
              <p className="muted-text">Suppression du compte et de ses données professionnelles. Exportez vos données avant toute demande.</p>
              <button type="button" onClick={() => setAccountDeletionStep(1)}
                style={{ border: "1px solid #bda982", background: "#171717", color: "#ead4ac", padding: "12px 18px", borderRadius: 10, fontWeight: 700 }}>
                Supprimer définitivement mon compte
              </button>
              <p className="muted-text" style={{ fontSize: "0.85em", marginTop: 10 }}>Fonction en cours de test : aucune suppression réelle n'est actuellement possible.</p>
            </div>
          )}

          <div className="card inner-card" style={{ marginBottom: "16px" }}>
            <h3>Préférences et informations</h3>
            <p className="muted-text" style={{ marginBottom: "12px" }}>
              Pour sécuriser votre compte, indiquez votre mot de passe actuel puis choisissez un nouveau mot de passe d'au moins 8 caractères contenant des lettres et des chiffres.
            </p>
            <div className="form-grid">
              <label>Mot de passe actuel
                <input type="password" autoComplete="current-password" placeholder="Saisissez votre mot de passe actuel" value={settingsCurrentPassword} onChange={(e) => setSettingsCurrentPassword(e.target.value)} />
              </label>
              <label>Nouveau mot de passe
                <input type="password" autoComplete="new-password" placeholder="8 caractères minimum, lettres et chiffres" value={settingsNewPassword} onChange={(e) => setSettingsNewPassword(e.target.value)} />
              </label>
              <label>Confirmer le nouveau mot de passe
                <input type="password" autoComplete="new-password" placeholder="Confirmez le nouveau mot de passe" value={settingsConfirmPassword} onChange={(e) => setSettingsConfirmPassword(e.target.value)} />
              </label>
            </div>
            <div className="action-buttons" style={{ marginBottom: "18px" }}>
              <button type="button" disabled={settingsPasswordSaving || !settingsCurrentPassword || !settingsNewPassword || !settingsConfirmPassword} onClick={changeAccountPassword}>
                {settingsPasswordSaving ? "Modification…" : "Enregistrer le nouveau mot de passe"}
              </button>
            </div>
            <div className="form-grid">
              <label>Langue
                <select value={settingsLanguage} onChange={(e) => saveSettingsPreference("language", e.target.value)}>
                  <option value="fr">Français</option>
                </select>
              </label>
              <label>Devise
                <select value={settingsCurrency} onChange={(e) => saveSettingsPreference("currency", e.target.value)}>
                  <option value="EUR">Euro (€)</option>
                </select>
              </label>
            </div>
            <p className="muted-text">La traduction de l'interface et la conversion des montants ne sont pas encore disponibles : français et euro uniquement.</p>
            <div className="action-buttons" style={{ flexWrap: "wrap", marginTop: "16px" }}>
              <a className="button-link" href="mailto:contact@logilya.fr?subject=Support%20application%20LOGILYA">Contacter le support</a>
              <button type="button" onClick={() => setSettingsLegalPanel("Mentions légales")}>Mentions légales</button>
              <button type="button" onClick={() => setSettingsLegalPanel("Conditions générales")}>Conditions générales</button>
              <button type="button" onClick={() => setSettingsLegalPanel("Politique de confidentialité")}>Politique de confidentialité</button>
              <button type="button" onClick={() => setSettingsLegalPanel("Accord de sous-traitance (DPA)")}>Accord de sous-traitance (DPA)</button>
            </div>
          </div>
          {accountDeletionStep > 0 && accessProfile?.is_admin !== true && (
            <div className="modal-overlay" style={{ position: "fixed", inset: 0, zIndex: 10020, background: "rgba(0,0,0,0.82)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
              <section className="card" role="dialog" aria-modal="true" aria-labelledby="account-deletion-heading"
                style={{ width: "100%", maxWidth: 540, maxHeight: "90vh", overflowY: "auto", background: "#111", color: "#f4e9d8", border: "1px solid #bda982", borderRadius: 18, padding: 24 }}>
                <h3 id="account-deletion-heading" style={{ color: "#e5c99a" }}>Suppression de compte — étape {accountDeletionStep}/3</h3>
                {accountDeletionStep === 1 && <>
                  <p><strong>Attention : cette action sera irréversible une fois activée.</strong></p>
                  <p>Votre compte, vos fiches clients, vos rendez-vous, vos prestations et vos données d'équipe seront supprimés. L'abonnement Stripe devra être résilié. Certaines pièces de facturation peuvent être conservées pour respecter les obligations légales.</p>
                  <p>Avant de continuer, exportez les données dont vous avez besoin.</p>
                </>}
                {accountDeletionStep === 2 && <>
                  <p>Pour confirmer votre intention, recopiez exactement cette phrase :</p>
                  <p style={{ padding: 12, background: "#25221d", borderRadius: 8, color: "#f2d9ab", fontWeight: 700, overflowWrap: "anywhere" }}>{DELETION_PHRASE}</p>
                  <input aria-label="Phrase de confirmation de suppression" type="text" autoComplete="off" spellCheck={false}
                    value={accountDeletionPhrase} onChange={(e) => setAccountDeletionPhrase(e.target.value)}
                    placeholder="Recopiez la phrase exacte" style={{ width: "100%", boxSizing: "border-box", marginTop: 8 }} />
                </>}
                {accountDeletionStep === 3 && <>
                  <p><strong>Dernière confirmation.</strong> Vous avez confirmé vouloir supprimer définitivement votre compte et les données associées.</p>
                  <p style={{ color: "#e5c99a" }}>Si la suppression réelle est activée sur le serveur, votre compte sera supprimé et votre session sera fermée automatiquement. Sinon, seule une simulation sera effectuée.</p>
                </>}
                <div className="action-buttons" style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 20 }}>
                  <button type="button" onClick={closeAccountDeletion} disabled={accountDeletionRunning}>Annuler</button>
                  {accountDeletionStep === 1 && <button type="button" onClick={() => setAccountDeletionStep(2)}>J'ai compris, continuer</button>}
                  {accountDeletionStep === 2 && <button type="button" disabled={accountDeletionPhrase !== DELETION_PHRASE} onClick={() => setAccountDeletionStep(3)}>Continuer</button>}
                  {accountDeletionStep === 3 && <button type="button" disabled={accountDeletionRunning || accountDeletionPhrase !== DELETION_PHRASE}
                    onClick={submitAccountDeletionSimulation} style={{ background: "#d8bc8c", color: "#111", fontWeight: 700 }}>
                    {accountDeletionRunning ? "Traitement en cours…" : "Confirmer la demande de suppression"}
                  </button>}
                </div>
              </section>
            </div>
          )}
          {settingsLegalPanel && (
            <div className="modal-overlay" onClick={() => setSettingsLegalPanel(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "20px" }}>
              <div className="card" onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: "760px", maxHeight: "90vh", overflowY: "auto" }}>
                <h3>{settingsLegalPanel}</h3>
                {settingsLegalPanel === "Mentions légales" ? (
                  <div style={{ maxHeight: "65vh", overflowY: "auto", lineHeight: 1.65, paddingRight: "8px" }}>
                    <h4>1. Éditeur de l'application</h4>
                    <p>
                      L'application est éditée par <strong>LOGILYA</strong>, entreprise unipersonnelle à responsabilité limitée (EURL),
                      représentée par <strong>Angélique THILL</strong>.
                    </p>
                    <p>
                      <strong>Siège social :</strong> 9, Grande Rue, Les Ombraies, 55260 Lignières-sur-Aire, France.<br />
                      <strong>SIREN :</strong> 108 539 420<br />
                      <strong>Contact :</strong> <a href="mailto:contact@logilya.fr">contact@logilya.fr</a>
                    </p>
                    <h4>2. Hébergement et infrastructure</h4>
                    <p>
                      L'application est déployée via Vercel. Les services de base de données et d'authentification
                      reposent sur Supabase. Les informations légales complètes des prestataires d'hébergement
                      doivent être confirmées et ajoutées avant publication définitive.
                    </p>
                    <h4>3. Propriété intellectuelle</h4>
                    <p>
                      Sauf mention contraire, les textes, éléments graphiques, interfaces, marques et logiciels
                      propres à LOGILYA sont protégés par les règles applicables à la propriété intellectuelle.
                      Toute reproduction ou exploitation non autorisée est interdite, sous réserve des exceptions légales.
                    </p>
                    <h4>4. Données personnelles</h4>
                    <p>
                      Les données saisies dans l'application peuvent notamment concerner les comptes utilisateurs,
                      les membres de l'équipe, les clients et les rendez-vous. Le traitement de ces données doit être
                      détaillé dans une politique de confidentialité distincte précisant les finalités, les durées de
                      conservation, les destinataires et les modalités d'exercice des droits.
                      Pour toute question : <a href="mailto:contact@logilya.fr">contact@logilya.fr</a>.
                    </p>
                    <h4>5. Contact</h4>
                    <p>
                      Pour toute question relative à l'application ou à ces mentions légales, écrivez à
                      {" "}<a href="mailto:contact@logilya.fr">contact@logilya.fr</a>.
                    </p>
                    <p className="muted-text" style={{ fontSize: "0.85em" }}>
                      Document à compléter et à vérifier avant publication : notamment l'identifiant d'immatriculation,
                      les coordonnées légales des hébergeurs et les informations sur le traitement des données.
                    </p>
                  </div>
                ) : settingsLegalPanel === "Politique de confidentialité" ? (
                  <PolitiqueConfidentialiteContent />
                ) : settingsLegalPanel === "Accord de sous-traitance (DPA)" ? (
                  <AccordSousTraitanceContent />
                ) : (
                  <ConditionsGeneralesContent />
                )}
                <button type="button" onClick={() => setSettingsLegalPanel(null)}>Fermer</button>
              </div>
            </div>
          )}
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

      {page === "absences" && setupComplete && (
        <section className="card">
          <h2>Congés et fermetures du shop</h2>
          <p className="muted-text">Configurez les jours de fermeture habituels et les absences des membres de l’équipe. Les dates sont conservées dans votre compte.</p>
          <div className="card inner-card" style={{ marginBottom: 20 }}>
            <h3>Fermeture hebdomadaire du shop</h3>
            <p className="muted-text">Cochez les jours où le shop est systématiquement fermé, chaque semaine.</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 16 }}>
              {[{v:1,n:"Lundi"},{v:2,n:"Mardi"},{v:3,n:"Mercredi"},{v:4,n:"Jeudi"},{v:5,n:"Vendredi"},{v:6,n:"Samedi"},{v:0,n:"Dimanche"}].map((d) => (
                <label key={d.v} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input type="checkbox" checked={weeklyClosedDays.includes(d.v)}
                    onChange={() => setWeeklyClosedDays((prev) => prev.includes(d.v) ? prev.filter((v) => v !== d.v) : [...prev,d.v])}/>
                  {d.n}
                </label>
              ))}
            </div>
            <button type="button" onClick={saveWeeklyClosures} disabled={savingAbsences}>Enregistrer les fermetures habituelles</button>
          </div>
          <div className="card inner-card" style={{ marginBottom: 20 }}>
            <h3>Ajouter une période de congés</h3>
            <div className="form-grid">
              <label>Date de début<input type="date" value={leaveStart} onChange={(e) => setLeaveStart(e.target.value)}/></label>
              <label>Date de fin<input type="date" min={leaveStart} value={leaveEnd} onChange={(e) => setLeaveEnd(e.target.value)}/></label>
              <label>Membre de l’équipe concerné
                <select value={leaveArtist} onChange={(e) => setLeaveArtist(e.target.value)}>
                  <option value="all">Tous les membres de l’équipe (établissement fermé)</option>
                  {artists.map((artist) => <option key={artist.id} value={artist.id}>{artist.name}</option>)}
                </select>
              </label>
              <label>Motif (facultatif)<input type="text" value={leaveLabel} placeholder="Ex. Vacances d'été" onChange={(e) => setLeaveLabel(e.target.value)}/></label>
            </div>
            <button type="button" onClick={saveLeave} disabled={savingAbsences}>Enregistrer les congés</button>
          </div>
          <div className="card inner-card">
            <h3>Périodes enregistrées</h3>
            {absenceRules.filter((r) => r.rule_type === "leave").length === 0 ? <p className="muted-text">Aucun congé enregistré.</p> :
              absenceRules.filter((r) => r.rule_type === "leave").map((rule) => (
                <div key={rule.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, padding: "12px 0", borderBottom: "1px solid #9b8b78" }}>
                  <span><strong>{rule.label || "Congés"}</strong> — {formatDateOnly(rule.start_date)} au {formatDateOnly(rule.end_date)}<br/>
                    {rule.artist_id == null ? "Tous les membres de l’équipe" : artists.find((a) => String(a.id) === String(rule.artist_id))?.name || "Membre de l’équipe supprimé"}
                  </span>
                  <button type="button" onClick={() => deleteLeave(rule.id)}>Supprimer</button>
                </div>
              ))}
          </div>
          <p className="muted-text">Les fermetures sont visibles dans l'agenda. Les congés individuels s'affichent lors du filtrage par membre de l’équipe. Les rendez-vous existants ne sont pas supprimés.</p>
          <button type="button" onClick={() => navigateTo("settings")}>Retour aux paramètres</button>
        </section>
      )}

      {page === "services" && (
        <section className="card">
          <h2>Prestations</h2>
          <p className="muted-text">Activité : {currentProfession?.label || "Non renseignée"}. Les suggestions sont facultatives.</p>
          {!editingServiceName && (
            <div style={{ marginBottom: 18 }}>
              <label htmlFor="suggested-service">Suggestion adaptée à votre métier</label>
              <select id="suggested-service" value="" onChange={(event) => {
                if (!event.target.value) return;
                const selected = event.target.value;
                setServiceForm({ name: selected, category: selected === "VENTE" ? "VENTE" : "PRESTATION" });
              }}>
                <option value="">Choisir une suggestion (facultatif)</option>
                {(currentProfession?.suggestions || []).map((suggestion) => (
                  <option key={suggestion} value={suggestion}>{suggestion}</option>
                ))}
              </select>
            </div>
          )}

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
          <h2>Membres de l’équipe</h2>

          <div className="card inner-card" style={{ marginBottom: "18px" }}>
            <h3 style={{ marginTop: 0 }}>
              {editingArtistId ? "Modifier le membre de l’équipe" : "Créer un nouveau membre de l’équipe"}
            </h3>

            <div className="form-grid">
              <input
                type="text"
                placeholder="Nom du membre de l’équipe"
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
                  aria-label="Couleur du membre de l’équipe"
                  title="Couleur du membre de l’équipe"
                  style={{
                    width: "48px",
                    height: "48px",
                    padding: "3px",
                    borderRadius: "6px",
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                />
                <span>Couleur du membre de l’équipe</span>
              </label>

              <button type="button" onClick={saveArtist}>
                {editingArtistId ? "Enregistrer les modifications" : "Créer le membre de l’équipe"}
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
                      border: "1px solid rgba(169, 147, 115, 0.9)",
                      backgroundColor: artist.color || "#111111",
                      boxShadow: "0 0 8px rgba(169, 147, 115, 0.18)",
                      flexShrink: 0,
                    }}
                  />
                  <span>Couleur du membre de l’équipe</span>
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
            Recherchez par nom, prénom, descriptif, date, heure, membre de l’équipe, notes, etc.
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
                      <strong>Membre de l’équipe :</strong> {artist?.name || "Non renseigné"}
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
              <span>Membres de l’équipe</span>
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
                  className="client-details-button"
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

            <p><strong>Membre de l’équipe :</strong> {selectedAppointmentDetails.artistName || "Non renseigné"}</p>
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
        <option value="">Sélectionner un membre de l’équipe</option>
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
        placeholder={(["tatouage", "tatouage_piercing"].includes(accessProfile?.profession)) ? "Nom du projet (facultatif)" : "Description / motif (facultatif)"}
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
