
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { GoogleReCaptchaProvider } from "react-google-recaptcha-v3";
import App from "./App.tsx";
import "./styles/globals.css";

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '';

// Only activate reCAPTCHA when a valid site key is provided.
// Without a key, GoogleReCaptchaProvider errors and breaks the app.
const AppWithRecaptcha = RECAPTCHA_SITE_KEY
  ? (
    <GoogleReCaptchaProvider reCaptchaKey={RECAPTCHA_SITE_KEY} useEnterprise={false}>
      <App />
    </GoogleReCaptchaProvider>
  )
  : <App />;

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    {AppWithRecaptcha}
  </BrowserRouter>
);
  