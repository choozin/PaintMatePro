import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { Loader2, Save, Mail } from 'lucide-react';

export default function Profile() {
    const { user, sendPasswordReset, updateUserProfile } = useAuth();
    const { toast } = useToast();
    const { t } = useTranslation();
    const [isPasswordLoading, setIsPasswordLoading] = React.useState(false);
    const [isProfileLoading, setIsProfileLoading] = React.useState(false);
    const [displayName, setDisplayName] = React.useState(user?.displayName || '');

    const handlePasswordReset = async () => {
        if (!user?.email) return;
        setIsPasswordLoading(true);
        try {
            await sendPasswordReset(user.email);
            toast({
                title: t('settings.profile.password_reset.success_title'),
                description: t('settings.profile.password_reset.success_description'),
            });
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: t('settings.profile.password_reset.error_title'),
                description: error.message,
            });
        } finally {
            setIsPasswordLoading(false);
        }
    };

    const handleProfileUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsProfileLoading(true);
        try {
            await updateUserProfile({ displayName });
            toast({
                title: t('settings.profile.update.success_title'),
                description: t('settings.profile.update.success_description'),
            });
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: t('settings.profile.update.error_title'),
                description: error.message,
            });
        } finally {
            setIsProfileLoading(false);
        }
    };

    return (
        <div className="container mx-auto py-8 space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">{t('settings.profile.title')}</h1>
                <p className="text-muted-foreground mt-2">{t('settings.profile.description')}</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{t('settings.profile.personal_info.title')}</CardTitle>
                    <CardDescription>{t('settings.profile.personal_info.description')}</CardDescription>
                </CardHeader>
                <form onSubmit={handleProfileUpdate}>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">{t('settings.profile.email')}</Label>
                            <Input id="email" type="email" value={user?.email || ''} disabled />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="displayName">{t('settings.profile.display_name')}</Label>
                            <Input
                                id="displayName"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                placeholder={t('settings.profile.display_name_placeholder')}
                            />
                        </div>
                    </CardContent>
                    <CardFooter className="border-t px-6 py-4">
                        <Button type="submit" disabled={isProfileLoading}>
                            {isProfileLoading ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <Save className="h-4 w-4 mr-2" />
                            )}
                            {t('settings.profile.save_changes')}
                        </Button>
                    </CardFooter>
                </form>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>{t('settings.profile.password.title')}</CardTitle>
                    <CardDescription>{t('settings.profile.password.description')}</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button
                        variant="outline"
                        onClick={handlePasswordReset}
                        disabled={isPasswordLoading}
                    >
                        {isPasswordLoading ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                            <Mail className="h-4 w-4 mr-2" />
                        )}
                        {t('settings.profile.send_reset_email')}
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
