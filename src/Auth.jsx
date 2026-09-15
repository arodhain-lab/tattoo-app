import { useState } from "react";
import { supabase } from "./supabaseClient";

export default function Auth() {
  // Connexion
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Création de compte
  const [showSignUpModal, setShowSignUpModal] = useState(false);
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [signUpPasswordConfirm, setSignUpPasswordConfirm] = useState("");
  const [signUpMessage, setSignUpMessage] = useState("");

  // Affichage / masquage des mots de passe de création
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [showSignUpPasswordConfirm, setShowSignUpPasswordConfirm] =
    useState(false);

  // Message général
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // Confirmation après création
  const [showAccountCreatedModal, setShowAccountCreatedModal] =
    useState(false);

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

  async function handleSignUp() {
    setSignUpMessage("");

    const cleanEmail = signUpEmail.trim();

    if (!cleanEmail) {
      setSignUpMessage("Veuillez renseigner votre adresse email.");
      return;
    }

    if (!signUpPassword) {
      setSignUpMessage("Veuillez choisir un mot de passe.");
      return;
    }

    if (signUpPassword.length < 6) {
      setSignUpMessage(
        "Le mot de passe doit contenir au minimum 6 caractères."
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

    // Vérifie côté Supabase Auth si l'adresse est déjà enregistrée.
    const { data: emailAlreadyExists, error: emailCheckError } =
      await supabase.rpc("email_exists", {
        check_email: cleanEmail,
      });

    if (emailCheckError) {
      console.error("Erreur vérification email :", emailCheckError);
      setSignUpMessage(
        "Impossible de vérifier cette adresse email pour le moment. Veuillez réessayer."
      );
      setLoading(false);
      return;
    }

    if (emailAlreadyExists === true) {
      setSignUpMessage(
        "Cette adresse email est déjà enregistrée. Connectez-vous avec votre compte existant."
      );
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password: signUpPassword,
    });

    if (error) {
      setSignUpMessage(error.message);
      setLoading(false);
      return;
    }

    setLoading(false);

    // Ferme la fenêtre de création
    setShowSignUpModal(false);

    // Préremplit l'adresse email sur la page de connexion
    setEmail(cleanEmail);
    setPassword("");

    // Vide les champs de création
    setSignUpEmail("");
    setSignUpPassword("");
    setSignUpPasswordConfirm("");
    setSignUpMessage("");
    setShowSignUpPassword(false);
    setShowSignUpPasswordConfirm(false);

    // Affiche la grande confirmation
    setShowAccountCreatedModal(true);
  }

  async function handleSignIn() {
    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Connexion réussie.");
    }

    setLoading(false);
  }

  const overlayStyle = {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 99999,
    padding: "20px",
    boxSizing: "border-box",
  };

  const modalStyle = {
    width: "100%",
    maxWidth: "520px",
    maxHeight: "90vh",
    overflowY: "auto",
    background: "linear-gradient(145deg, #161616 0%, #050505 100%)",
    border: "2px solid #d6a514",
    borderRadius: "28px",
    padding: "38px 30px",
    boxSizing: "border-box",
    boxShadow:
      "0 0 25px rgba(214, 165, 20, 0.45), 0 20px 60px rgba(0, 0, 0, 0.8)",
  };

  const modalInputStyle = {
    width: "100%",
    boxSizing: "border-box",
    marginBottom: "14px",
  };

  const passwordWrapperStyle = {
    position: "relative",
    width: "100%",
    marginBottom: "14px",
  };

  const passwordInputStyle = {
    width: "100%",
    boxSizing: "border-box",
    marginBottom: 0,
    paddingRight: "50px",
  };

  const eyeButtonStyle = {
    position: "absolute",
    right: "12px",
    top: "50%",
    transform: "translateY(-50%)",
    width: "34px",
    height: "34px",
    padding: 0,
    margin: 0,
    border: "none",
    background: "transparent",
    boxShadow: "none",
    color: "#333333",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  };

  const offerStyle = {
    border: "1px solid #d6a514",
    borderRadius: "16px",
    padding: "18px",
    marginBottom: "24px",
    textAlign: "center",
    background:
      "linear-gradient(145deg, rgba(214,165,20,0.14), rgba(214,165,20,0.04))",
    boxShadow: "0 0 14px rgba(214, 165, 20, 0.12)",
  };

  return (
    <>
      {/* =========================
          CONNEXION
      ========================== */}
      <div className="card" style={{ maxWidth: 420, margin: "40px auto" }}>
        <h2>Connexion</h2>

        <input
          type="email"
          placeholder="Adresse email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />

        <input
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !loading) {
              handleSignIn();
            }
          }}
        />

        <button onClick={handleSignIn} disabled={loading}>
          {loading ? "Chargement..." : "Se connecter"}
        </button>

        <button
          className="secondary-button"
          onClick={openSignUpModal}
          disabled={loading}
        >
          Créer un compte
        </button>

        {message ? <p style={{ marginTop: 12 }}>{message}</p> : null}
      </div>

      {/* =========================
          FENÊTRE CRÉATION COMPTE
      ========================== */}
      {showSignUpModal && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h2
              style={{
                color: "#f5b82e",
                fontSize: "32px",
                margin: "0 0 10px 0",
                textAlign: "center",
              }}
            >
              Créer un compte
            </h2>

            {/* OFFRE COMMERCIALE */}
            <div style={offerStyle}>
              <div
                style={{
                  color: "#f5b82e",
                  fontSize: "23px",
                  fontWeight: "bold",
                  marginBottom: "8px",
                }}
              >
                30 jours d&apos;essai gratuit
              </div>

              <div
                style={{
                  color: "#ffffff",
                  fontSize: "15px",
                  lineHeight: "1.5",
                  marginBottom: "10px",
                }}
              >
                Profitez de l&apos;accès complet à l&apos;application pendant
                30 jours.
              </div>

              <div
                style={{
                  color: "#ffffff",
                  fontSize: "16px",
                  lineHeight: "1.5",
                }}
              >
                Puis à partir de{" "}
                <strong
                  style={{
                    color: "#f5b82e",
                    fontSize: "21px",
                  }}
                >
                  9,90 € TTC / mois
                </strong>
              </div>

              <div
                style={{
                  color: "#bbbbbb",
                  fontSize: "13px",
                  marginTop: "5px",
                }}
              >
                Formule Solo : 1 tatoueur — 9,90 € / mois
                <br />
                Tatoueur supplémentaire : +8 € / mois
                <br />
                Abonnement annuel Solo : 99 € / an
                <br />
                Remise annuelle équivalente pour les formules multi-tatoueurs
                <br />
                <span style={{ display: "inline-block", marginTop: "7px" }}>
                  Tarifs TTC · Sans engagement
                </span>
              </div>
            </div>

            <p
              style={{
                color: "#cccccc",
                fontSize: "15px",
                lineHeight: "1.5",
                textAlign: "center",
                margin: "0 0 28px 0",
              }}
            >
              Renseignez votre adresse email et choisissez votre mot de passe.
            </p>

            <label
              style={{
                display: "block",
                color: "#f5b82e",
                fontWeight: "bold",
                marginBottom: "7px",
              }}
            >
              Adresse email
            </label>

            <input
              type="email"
              placeholder="Votre adresse email"
              value={signUpEmail}
              onChange={(e) => setSignUpEmail(e.target.value)}
              autoComplete="email"
              style={modalInputStyle}
              autoFocus
            />

            <label
              style={{
                display: "block",
                color: "#f5b82e",
                fontWeight: "bold",
                marginBottom: "7px",
              }}
            >
              Mot de passe
            </label>

            <div style={passwordWrapperStyle}>
              <input
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
                  setShowSignUpPassword((currentValue) => !currentValue)
                }
                style={eyeButtonStyle}
                aria-label={
                  showSignUpPassword
                    ? "Masquer le mot de passe"
                    : "Afficher le mot de passe"
                }
              >
                {showSignUpPassword ? (
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
                )}
              </button>
            </div>

            <label
              style={{
                display: "block",
                color: "#f5b82e",
                fontWeight: "bold",
                marginBottom: "7px",
              }}
            >
              Confirmez votre mot de passe
            </label>

            <div style={passwordWrapperStyle}>
              <input
                type={showSignUpPasswordConfirm ? "text" : "password"}
                placeholder="Saisissez à nouveau votre mot de passe"
                value={signUpPasswordConfirm}
                onChange={(e) => setSignUpPasswordConfirm(e.target.value)}
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
                    (currentValue) => !currentValue
                  )
                }
                style={eyeButtonStyle}
                aria-label={
                  showSignUpPasswordConfirm
                    ? "Masquer le mot de passe"
                    : "Afficher le mot de passe"
                }
              >
                {showSignUpPasswordConfirm ? (
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
                )}
              </button>
            </div>

            {signUpMessage ? (
              <div
                style={{
                  marginTop: "8px",
                  marginBottom: "18px",
                  padding: "12px 14px",
                  border: "1px solid #d6a514",
                  borderRadius: "10px",
                  backgroundColor: "rgba(214, 165, 20, 0.1)",
                  color: "#f5b82e",
                  fontSize: "14px",
                  lineHeight: "1.4",
                }}
              >
                {signUpMessage}
              </div>
            ) : null}

            <button
              onClick={handleSignUp}
              disabled={loading}
              style={{
                width: "100%",
                padding: "15px 20px",
                marginTop: signUpMessage ? "0" : "12px",
                border: "none",
                borderRadius: "14px",
                background:
                  "linear-gradient(180deg, #f7c64b 0%, #d99d08 100%)",
                color: "#000000",
                fontSize: "17px",
                fontWeight: "bold",
                cursor: loading ? "default" : "pointer",
                opacity: loading ? 0.7 : 1,
                boxShadow: "0 4px 12px rgba(218, 157, 8, 0.35)",
              }}
            >
              {loading
                ? "Création en cours..."
                : "Commencer mes 30 jours gratuits"}
            </button>

            <button
              className="secondary-button"
              onClick={closeSignUpModal}
              disabled={loading}
              style={{
                width: "100%",
                marginTop: "12px",
              }}
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* =========================
          COMPTE CRÉÉ
      ========================== */}
      {showAccountCreatedModal && (
        <div style={overlayStyle}>
          <div
            style={{
              ...modalStyle,
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: "52px",
                marginBottom: "10px",
                color: "#f5b82e",
              }}
            >
              ✓
            </div>

            <h2
              style={{
                color: "#f5b82e",
                fontSize: "32px",
                margin: "0 0 15px 0",
              }}
            >
              Compte créé !
            </h2>

            <div
              style={{
                border: "1px solid #d6a514",
                borderRadius: "14px",
                padding: "15px",
                marginBottom: "22px",
                backgroundColor: "rgba(214, 165, 20, 0.1)",
              }}
            >
              <div
                style={{
                  color: "#f5b82e",
                  fontSize: "21px",
                  fontWeight: "bold",
                  marginBottom: "5px",
                }}
              >
                Votre essai gratuit de 30 jours est prêt
              </div>

              <div
                style={{
                  color: "#cccccc",
                  fontSize: "14px",
                }}
              >
                À l&apos;issue de la période d&apos;essai : à partir de{" "}
                <strong style={{ color: "#ffffff" }}>
                  9,90 € TTC / mois en Solo
                </strong>
                <br />
                +8 € / mois par tatoueur supplémentaire
                <br />
                ou 99 € / an pour la formule Solo
              </div>
            </div>

            <p
              style={{
                color: "#ffffff",
                fontSize: "20px",
                lineHeight: "1.5",
                marginBottom: "15px",
              }}
            >
              <strong>
                Activez maintenant votre compte grâce à l&apos;email reçu.
              </strong>
            </p>

            <p
              style={{
                color: "#cccccc",
                fontSize: "16px",
                lineHeight: "1.5",
                marginBottom: "30px",
              }}
            >
              Cliquez sur le lien présent dans l&apos;email pour confirmer votre
              adresse et activer votre compte.
              <br />
              <br />
              Pensez à vérifier vos courriers indésirables si vous ne trouvez
              pas l&apos;email.
            </p>

            <button
              onClick={() => setShowAccountCreatedModal(false)}
              style={{
                width: "100%",
                padding: "15px 20px",
                border: "none",
                borderRadius: "14px",
                background:
                  "linear-gradient(180deg, #f7c64b 0%, #d99d08 100%)",
                color: "#000000",
                fontSize: "17px",
                fontWeight: "bold",
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(218, 157, 8, 0.35)",
              }}
            >
              J&apos;ai compris
            </button>
          </div>
        </div>
      )}
    </>
  );
}