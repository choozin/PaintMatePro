import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowRight, ShieldCheck } from "lucide-react";
import { portalOperations } from "@/lib/firestore";
import { signInAnonymously } from "@/lib/firebaseAuth";
import { toast } from "@/hooks/use-toast";

import { PortalToken } from "@/lib/firestore";

interface PortalAuthProps {
    token: string;
    projectId: string;
    tokenDoc: PortalToken;
    onAuthenticated: () => void;
}

export function PortalAuth({ token, projectId, tokenDoc, onAuthenticated }: PortalAuthProps) {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // 1. Verify Email matches Client Record (Stored in Token)
            const expectedEmail = tokenDoc.clientEmail || "";

            console.log("Portal Auth Debug:", {
                entered: email,
                expected: expectedEmail,
                tokenDoc: tokenDoc
            });

            const isValid = email.toLowerCase().trim() === expectedEmail.toLowerCase().trim();

            if (!isValid) {
                // If token has no email (legacy), we might need to fallback or fail secure.
                // For now, fail secure.
                setError("The email provided does not match our records for this project. Please use the email address where you received the link.");
                setLoading(false);
                return;
            }

            // 2. Sign In Anonymously (creates a secure session)
            await signInAnonymously();

            // 3. Persist "Session" for Portal
            // We store the token and email to skip this step next time slightly or for context
            localStorage.setItem(`portal_session_${token}`, JSON.stringify({ email, timestamp: Date.now() }));

            // 4. Callback
            toast({
                title: "Welcome Back!",
                description: "You have successfully accessed your project portal.",
            });
            onAuthenticated();

        } catch (err: any) {
            console.error("Portal Auth Error:", err);
            // Show the actual error message to help debugging (e.g. "Firebase: Error (auth/operation-not-allowed).")
            setError(`Authentication Failed: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <div className="mb-8 text-center space-y-2">
                <div className="bg-primary/10 p-4 rounded-full inline-flex mb-4">
                    <ShieldCheck className="h-8 w-8 text-primary" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight">Client Access</h1>
                <p className="text-muted-foreground max-w-sm mx-auto">
                    For security, please confirm your email address to access your project dashboard.
                </p>
            </div>

            <Card className="w-full max-w-md shadow-lg border-t-4 border-t-primary">
                <CardHeader>
                    <CardTitle>Verify Identity</CardTitle>
                    <CardDescription>Enter the email associated with this project.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email Address</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="h-11"
                            />
                        </div>

                        {error && (
                            <div className="p-3 rounded-md bg-red-50 text-red-600 text-sm border border-red-100">
                                {error}
                            </div>
                        )}

                        <Button type="submit" className="w-full h-11 text-base" disabled={loading}>
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                            Access Portal
                        </Button>

                        <p className="text-xs text-center text-muted-foreground mt-4">
                            Having trouble? Contact us at support@paintmate.com
                        </p>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
