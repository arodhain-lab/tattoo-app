import { useState } from "react";
import { supabase } from "./supabaseClient";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAccountCreatedModal, setShowAccountCreatedModal] = useState(false);

  async function handleSignUp() {
    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
    } else {
      setShowAccountCreatedModal(true);
    }

    setLoading(false);
  }

  async function handleSignIn() {
    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Connexion réussie.");
    }

    setLoading(false);
  }

  return (
    <>
      <div className="card" style={{ maxWidth: 420, margin: "40px auto" }}>
        <h2>Connexion</h2>

        <input
          type="email"
          placeholder="Adresse email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button onClick={handleSignIn} disabled={loading}>
          {loading ? "Chargement..." : "Se connecter"}
        </button>

        <button
          className="secondary-button"
          onClick={handleSignUp}
          disabled={loading}
        >
          {loading ? "Chargement..." : "Créer un compte"}
        </button>

        {message ? <p style={{ marginTop: 12 }}>{message}</p> : null}
      </div>

      {showAccountCreatedModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(0, 0, 0, 0.88)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 99999,
            padding: "20px",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "520px",
              background:
                "linear-gradient(145deg, #161616 0%, #050505 100%)",
              border: "2px solid #d6a514",
              borderRadius: "28px",
              padding: "40px 30px",
              boxSizing: "border-box",
              textAlign: "center",
              boxShadow:
                "0 0 25px rgba(214, 165, 20, 0.45), 0 20px 60px rgba(0, 0, 0, 0.8)",
            }}
          >
            <div
              style={{
                fontSize: "52px",
                marginBottom: "10px",
              }}
            >
              ✓
            </div>

            <h2
              style={{
                color: "#f5b82e",
                fontSize: "32px",
                margin: "0 0 22px 0",
              }}
            >
              Compte créé !
            </h2>

            <p
              style={{
                color: "#ffffff",
                fontSize: "20px",
                lineHeight: "1.5",
                marginBottom: "15px",
              }}
            >
              <strong>
                Activez votre compte grâce à l&apos;email reçu.
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