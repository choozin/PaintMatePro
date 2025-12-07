import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./lib/i18n";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { AuthProvider } from "@/contexts/AuthContext";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

createRoot(document.getElementById("root")!).render(
    <QueryClientProvider client={queryClient}>
        <AuthProvider>
            <TooltipProvider>
                <App />
                <Toaster />
            </TooltipProvider>
        </AuthProvider>
    </QueryClientProvider>
);
