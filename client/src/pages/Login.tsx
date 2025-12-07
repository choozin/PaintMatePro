import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isResetLoading, setIsResetLoading] = useState(false);

  const [, setLocation] = useLocation();
  const { signIn, sendPasswordReset } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await signIn(email, password);
      setLocation('/');
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: t('common.error'),
        description: error.message || "Invalid email or password",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsResetLoading(true);

    try {
      await sendPasswordReset(resetEmail);
      toast({
        title: "Password Reset Email Sent",
        description: "Please check your inbox for instructions.",
      });
      setIsResetDialogOpen(false);
      setResetEmail("");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Password Reset Failed",
        description: error.message || "Failed to send password reset email.",
      });
    } finally {
      setIsResetLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2">
          <CardTitle className="text-3xl font-bold text-center">{t('app.name')}</CardTitle>
          <CardDescription className="text-center">
            {t('auth.login_description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">{t('auth.email')}</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                data-testid="input-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t('auth.password')}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                data-testid="input-password"
              />
              <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" className="px-0 text-sm font-normal justify-start">
                    {t('auth.forgot_password')}
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>{t('auth.reset_password')}</DialogTitle>
                    <DialogDescription>
                      {t('auth.reset_description')}
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handlePasswordReset} className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="resetEmail">{t('auth.email')}</Label>
                      <Input
                        id="resetEmail"
                        type="email"
                        placeholder="you@company.com"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        required
                      />
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={isResetLoading}>
                        {isResetLoading ? t('auth.sending') : t('auth.send_reset')}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
            <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-login">
              {isLoading ? t('auth.signing_in') : t('auth.sign_in_button')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
