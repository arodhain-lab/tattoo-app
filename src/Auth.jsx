import { useState } from "react";
import { supabase } from "./supabaseClient";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

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
      setMessage("Compte créé. Vérifie ton email si demandé.");
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

      <button className="secondary-button" onClick={handleSignUp} disabled={loading}>
        {loading ? "Chargement..." : "Créer un compte"}
      </button>

      {message ? <p style={{ marginTop: 12 }}>{message}</p> : null}
    </div>
  );
}