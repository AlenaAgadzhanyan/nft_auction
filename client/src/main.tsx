import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ThemeProvider as NextThemesProvider } from "next-themes";

createRoot(document.getElementById("root")!).render(
  <NextThemesProvider attribute="class" defaultTheme="system" enableSystem>
    <App />
  </NextThemesProvider>
);
