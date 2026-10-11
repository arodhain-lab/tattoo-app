import { useState } from "react";
import { supabase } from "./supabaseClient";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showSignUpModal, setShowSignUpModal] = useState(false);
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [signUpPasswordConfirm, setSignUpPasswordConfirm] = useState("");
  const [signUpMessage, setSignUpMessage] = useState("");

  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [showSignUpPasswordConfirm, setShowSignUpPasswordConfirm] =
    useState(false);

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAccountCreatedModal, setShowAccountCreatedModal] =
    useState(false);

  // ========================================
  // PALETTE NOIR / BEIGE / CHAMPAGNE
  // ========================================

  const theme = {
    black: "#08090a",
    panel: "#141516",
    panelLight: "#22201d",
    champagne: "#e8d4b5",
    champagneLight: "#f3e8d7",
    champagneDark: "#c6aa83",
    beige: "#f1e7d8",
    muted: "#c9bdad",
    border: "#bca784",
    textDark: "#211c16",
    error: "#f0b7aa",
  };

  // ========================================
  // GESTION DES FENÊTRES
  // ========================================

  function openSignUpModal() {
    setSignUpEmail("");
    setSignUpPassword("");
    setSignUpPasswordConfirm("");
    setSignUpMessage("");
    setMessage("");
    setShowSignUpPassword(false);
    setShowSignUpPasswordConfirm(false);
    setShowSignUpModal(true);
  }

  function closeSignUpModal() {
    if (loading) return;

    setShowSignUpModal(false);
    setSignUpMessage("");
    setShowSignUpPassword(false);
    setShowSignUpPasswordConfirm(false);
  }

  // ========================================
  // CRÉATION DE COMPTE
  // ========================================

  async function handleSignUp() {
    setSignUpMessage("");

    const cleanEmail = signUpEmail.trim().toLowerCase();

    if (!cleanEmail) {
      setSignUpMessage("Veuillez renseigner votre adresse email.");
      return;
    }

    if (!signUpPassword) {
      setSignUpMessage("Veuillez choisir un mot de passe.");
      return;
    }

    if (
      signUpPassword.length < 8 ||
      !/[A-Za-z]/.test(signUpPassword) ||
      !/[0-9]/.test(signUpPassword)
    ) {
      setSignUpMessage(
        "Le mot de passe doit contenir au moins 8 caractères, dont des lettres et des chiffres."
      );
      return;
    }

    if (!signUpPasswordConfirm) {
      setSignUpMessage("Veuillez confirmer votre mot de passe.");
      return;
    }

    if (signUpPassword !== signUpPasswordConfirm) {
      setSignUpMessage(
        "Les deux mots de passe ne correspondent pas. Vérifiez votre saisie."
      );
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.signUp({
        email: cleanEmail,
        password: signUpPassword,
      });

      if (error) {
        const detail = String(error.message || "");

        const duplicate =
          /already registered|already exists|user already|email.*registered|email.*exists/i.test(
            detail
          );

        setSignUpMessage(
          duplicate
            ? "Si cette adresse peut être utilisée, un email de confirmation vous sera envoyé. Si vous possédez déjà un compte, connectez-vous."
            : detail
        );

        return;
      }

      setShowSignUpModal(false);

      setEmail(cleanEmail);
      setPassword("");

      setSignUpEmail("");
      setSignUpPassword("");
      setSignUpPasswordConfirm("");
      setSignUpMessage("");

      setShowSignUpPassword(false);
      setShowSignUpPasswordConfirm(false);

      setShowAccountCreatedModal(true);
    } catch {
      setSignUpMessage(
        "Une erreur est survenue. Veuillez réessayer."
      );
    } finally {
      setLoading(false);
    }
  }

  // ========================================
  // CONNEXION
  // ========================================

  async function handleSignIn() {
    if (loading) return;

    setLoading(true);
    setMessage("");

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setMessage(error.message);
      } else {
        setMessage("Connexion réussie.");
      }
    } catch {
      setMessage(
        "Impossible de se connecter pour le moment."
      );
    } finally {
      setLoading(false);
    }
  }

  // ========================================
  // STYLES CHAMPAGNE
  // ========================================

  const overlayStyle = {
    position: "fixed",
    inset: 0,
    width: "100%",
    height: "100%",
    background: "rgba(0, 0, 0, 0.88)",
    backdropFilter: "blur(7px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 99999,
    padding: "16px",
    boxSizing: "border-box",
  };

  const modalStyle = {
    width: "100%",
    maxWidth: "520px",
    maxHeight: "90vh",
    overflowY: "auto",
    background:
      "linear-gradient(155deg, #22201d 0%, #141516 55%, #090909 100%)",
    border: `1px solid ${theme.border}`,
    borderRadius: "20px",
    padding: "30px 24px",
    boxSizing: "border-box",
    boxShadow: "0 24px 65px rgba(0, 0, 0, 0.65)",
    color: theme.beige,
    fontFamily: "Georgia, 'Times New Roman', serif",
  };

  const titleStyle = {
    color: theme.champagneLight,
    fontFamily: "Georgia, 'Times New Roman', serif",
    fontSize: "32px",
    fontWeight: 500,
    lineHeight: 1.2,
    margin: "0 0 22px",
    textAlign: "center",
  };

  const labelStyle = {
    display: "block",
    color: theme.champagne,
    fontSize: "15px",
    fontWeight: 600,
    marginBottom: "7px",
  };

  const modalInputStyle = {
    display: "block",
    width: "100%",
    minHeight: "48px",
    boxSizing: "border-box",
    margin: "0 0 16px",
    padding: "12px 14px",
    background: "#f5f0e8",
    color: theme.textDark,
    border: `1px solid ${theme.border}`,
    borderRadius: "10px",
    fontSize: "16px",
    fontFamily: "Arial, sans-serif",
    boxShadow: "none",
  };

  const passwordWrapperStyle = {
    position: "relative",
    width: "100%",
    marginBottom: "16px",
  };

  const passwordInputStyle = {
    ...modalInputStyle,
    marginBottom: 0,
    paddingRight: "50px",
  };

  const eyeButtonStyle = {
    position: "absolute",
    right: "9px",
    top: "50%",
    transform: "translateY(-50%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "38px",
    height: "38px",
    minWidth: "38px",
    minHeight: "38px",
    margin: 0,
    padding: 0,
    background: "transparent",
    backgroundImage: "none",
    color: "#5a4b38",
    border: "none",
    borderRadius: "8px",
    boxShadow: "none",
    cursor: "pointer",
    zIndex: 2,
  };

  const primaryButtonStyle = {
    display: "block",
    width: "100%",
    minHeight: "48px",
    padding: "13px 18px",
    marginTop: "12px",
    background:
      "linear-gradient(180deg, #f3e8d7 0%, #ddc6a5 100%)",
    backgroundImage:
      "linear-gradient(180deg, #f3e8d7 0%, #ddc6a5 100%)",
    color: theme.textDark,
    WebkitTextFillColor: theme.textDark,
    border: `1px solid ${theme.champagneDark}`,
    borderRadius: "12px",
    fontSize: "15px",
    fontWeight: 700,
    fontFamily: "Arial, sans-serif",
    boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
    cursor: "pointer",
  };

  const secondaryButtonStyle = {
    ...primaryButtonStyle,
    background: "#181818",
    backgroundImage: "none",
    color: theme.champagneLight,
    WebkitTextFillColor: theme.champagneLight,
    border: `1px solid ${theme.border}`,
    boxShadow: "none",
  };

  const offerStyle = {
    border: `1px solid ${theme.border}`,
    borderRadius: "14px",
    padding: "20px 16px",
    marginBottom: "24px",
    textAlign: "center",
    background:
      "linear-gradient(145deg, rgba(188,167,132,0.13), rgba(188,167,132,0.035))",
  };

  const messageStyle = {
    marginTop: "10px",
    marginBottom: "16px",
    padding: "12px 14px",
    border: `1px solid ${theme.border}`,
    borderRadius: "10px",
    background: "rgba(188,167,132,0.10)",
    color: theme.champagneLight,
    fontSize: "14px",
    lineHeight: 1.5,
  };

  // ========================================
  // AFFICHAGE / MASQUAGE MOT DE PASSE
  // ========================================

  function EyeIcon({ visible }) {
    return visible ? (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 3l18 18" />
        <path d="M10.6 10.6a2 2 0 002.8 2.8" />
        <path d="M9.9 4.2A10.6 10.6 0 0112 4c5.5 0 9 8 9 8a17.5 17.5 0 01-2.1 3.2" />
        <path d="M6.6 6.6C4.4 8.1 3 12 3 12s3.5 8 9 8a9.7 9.7 0 004.1-.9" />
      </svg>
    ) : (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }

  // ========================================
  // INTERFACE
  // ========================================

  return (
    <>
      {/* =====================================
          PAGE DE CONNEXION
      ===================================== */}

      <div
        className="card"
        style={{
          maxWidth: "420px",
          margin: "40px auto",
          padding: "30px 24px",
          background:
            "linear-gradient(145deg, #22201d, #101112)",
          border: `1px solid ${theme.border}`,
          borderRadius: "18px",
          color: theme.beige,
          boxShadow: "0 16px 42px rgba(0,0,0,0.35)",
        }}
      >
        <h2 style={titleStyle}>Connexion</h2>

        <input
          type="email"
          placeholder="Adresse email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          aria-label="Adresse email"
        />

        <input
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          aria-label="Mot de passe"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !loading) {
              handleSignIn();
            }
          }}
        />

        <button
          type="button"
          onClick={handleSignIn}
          disabled={loading}
          style={primaryButtonStyle}
        >
          {loading ? "Chargement..." : "Se connecter"}
        </button>

        <button
          type="button"
          onClick={openSignUpModal}
          disabled={loading}
          style={secondaryButtonStyle}
        >
          Créer un compte
        </button>

        {message && (
          <p
            role="status"
            style={{
              marginTop: "16px",
              color: theme.champagneLight,
              lineHeight: 1.5,
            }}
          >
            {message}
          </p>
        )}
      </div>

      {/* =====================================
          FENÊTRE CRÉATION DE COMPTE
      ===================================== */}

      {showSignUpModal && (
        <div style={overlayStyle}>
          <div
            style={modalStyle}
            role="dialog"
            aria-modal="true"
            aria-label="Créer un compte"
          >
            <h2 style={titleStyle}>Créer un compte</h2>

            {/* OFFRE D'ESSAI */}

            <div style={offerStyle}>
              <div
                style={{
                  color: theme.champagneLight,
                  fontSize: "24px",
                  fontWeight: 600,
                  marginBottom: "12px",
                }}
              >
                30 jours d'essai gratuit
              </div>

              <p
                style={{
                  color: theme.beige,
                  fontSize: "15px",
                  lineHeight: 1.6,
                  margin: "0 0 12px",
                }}
              >
                Profitez de l'accès complet à l'application
                pendant 30 jours.
              </p>

              <p
                style={{
                  color: theme.beige,
                  fontSize: "16px",
                  lineHeight: 1.5,
                  margin: "0 0 12px",
                }}
              >
                Puis à partir de
                <br />
                <strong
                  style={{
                    display: "inline-block",
                    marginTop: "6px",
                    color: theme.champagneLight,
                    fontSize: "24px",
                  }}
                >
                  9,90 € TTC / mois
                </strong>
              </p>

              <div
                style={{
                  color: theme.muted,
                  fontSize: "13px",
                  lineHeight: 1.7,
                }}
              >
                Formule Solo : 1 membre de l'équipe
                <br />
                9,90 € / mois
                <br />
                Membre supplémentaire : +8 € / mois
                <br />
                Abonnement annuel Solo : 99 € / an
                <br />
                Remise annuelle équivalente pour les
                formules multi-membres
                <br />
                <span
                  style={{
                    display: "inline-block",
                    marginTop: "8px",
                    color: theme.champagne,
                  }}
                >
                  Tarifs TTC · Sans engagement
                </span>
              </div>
            </div>

            {/* ADRESSE EMAIL */}

            <label style={labelStyle} htmlFor="signup-email">
              Adresse email
            </label>

            <input
              id="signup-email"
              type="email"
              placeholder="Votre adresse email"
              value={signUpEmail}
              onChange={(e) => setSignUpEmail(e.target.value)}
              autoComplete="email"
              style={modalInputStyle}
            />

            {/* MOT DE PASSE */}

            <label style={labelStyle} htmlFor="signup-password">
              Mot de passe
            </label>

            <div style={passwordWrapperStyle}>
              <input
                id="signup-password"
                type={showSignUpPassword ? "text" : "password"}
                placeholder="Choisissez votre mot de passe"
                value={signUpPassword}
                onChange={(e) => setSignUpPassword(e.target.value)}
                autoComplete="new-password"
                style={passwordInputStyle}
              />

              <button
                type="button"
                onClick={() =>
                  setShowSignUpPassword((value) => !value)
                }
                style={eyeButtonStyle}
                aria-label={
                  showSignUpPassword
                    ? "Masquer le mot de passe"
                    : "Afficher le mot de passe"
                }
              >
                <EyeIcon visible={showSignUpPassword} />
              </button>
            </div>

            {/* CONFIRMATION MOT DE PASSE */}

            <label
              style={labelStyle}
              htmlFor="signup-password-confirm"
            >
              Confirmez votre mot de passe
            </label>

            <div style={passwordWrapperStyle}>
              <input
                id="signup-password-confirm"
                type={
                  showSignUpPasswordConfirm
                    ? "text"
                    : "password"
                }
                placeholder="Saisissez à nouveau votre mot de passe"
                value={signUpPasswordConfirm}
                onChange={(e) =>
                  setSignUpPasswordConfirm(e.target.value)
                }
                autoComplete="new-password"
                style={passwordInputStyle}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !loading) {
                    handleSignUp();
                  }
                }}
              />

              <button
                type="button"
                onClick={() =>
                  setShowSignUpPasswordConfirm(
                    (value) => !value
                  )
                }
                style={eyeButtonStyle}
                aria-label={
                  showSignUpPasswordConfirm
                    ? "Masquer le mot de passe"
                    : "Afficher le mot de passe"
                }
              >
                <EyeIcon
                  visible={showSignUpPasswordConfirm}
                />
              </button>
            </div>

            {/* MESSAGE D'ERREUR */}

            {signUpMessage && (
              <div role="alert" style={messageStyle}>
                {signUpMessage}
              </div>
            )}

            {/* VALIDATION */}

            <button
              type="button"
              onClick={handleSignUp}
              disabled={loading}
              style={{
                ...primaryButtonStyle,
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading
                ? "Création en cours..."
                : "Commencer mes 30 jours gratuits"}
            </button>

            <button
              type="button"
              onClick={closeSignUpModal}
              disabled={loading}
              style={secondaryButtonStyle}
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* =====================================
          CONFIRMATION DE CRÉATION
      ===================================== */}

      {showAccountCreatedModal && (
        <div style={overlayStyle}>
          <div
            style={{
              ...modalStyle,
              textAlign: "center",
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Demande enregistrée"
          >
            <div
              style={{
                fontSize: "52px",
                marginBottom: "12px",
                color: theme.champagneLight,
              }}
            >
              ✓
            </div>

            <h2 style={titleStyle}>
              Demande enregistrée
            </h2>

            <div style={offerStyle}>
              <div
                style={{
                  color: theme.champagneLight,
                  fontSize: "22px",
                  fontWeight: 600,
                  marginBottom: "12px",
                }}
              >
                Découvrez votre essai gratuit
                de 30 jours
              </div>

              <div
                style={{
                  color: theme.beige,
                  fontSize: "14px",
                  lineHeight: 1.7,
                }}
              >
                À l'issue de la période d'essai :
                <br />
                <strong
                  style={{
                    color: theme.champagneLight,
                    fontSize: "17px",
                  }}
                >
                  À partir de 9,90 € TTC / mois
                  en Solo
                </strong>
                <br />
                +8 € / mois par membre supplémentaire
                <br />
                ou 99 € / an pour la formule Solo
              </div>
            </div>

            <p
              style={{
                color: theme.champagneLight,
                fontSize: "19px",
                lineHeight: 1.5,
                marginBottom: "16px",
              }}
            >
              <strong>
                Consultez votre messagerie pour
                poursuivre votre inscription.
              </strong>
            </p>

            <p
              style={{
                color: theme.muted,
                fontSize: "15px",
                lineHeight: 1.7,
                marginBottom: "25px",
              }}
            >
              Si un email de confirmation vous est
              adressé, cliquez sur le lien pour
              activer votre compte.
              <br />
              <br />
              Si vous possédez déjà un compte,
              utilisez la connexion.
              <br />
              <br />
              Pensez à vérifier vos courriers
              indésirables si vous ne trouvez pas
              l'email.
            </p>

            <button
              type="button"
              onClick={() =>
                setShowAccountCreatedModal(false)
              }
              style={primaryButtonStyle}
            >
              J'ai compris
            </button>
          </div>
        </div>
      )}
    </>
  );
}