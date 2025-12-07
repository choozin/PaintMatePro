import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { orgOperations } from "@/lib/firestore";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Upload, Palette, Image as ImageIcon, X } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export function BrandingSettings() {
    const { currentOrgId, currentOrgRole } = useAuth();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const canEdit = currentOrgRole === 'owner' || currentOrgRole === 'admin';

    const [branding, setBranding] = useState({
        companyName: '',
        companyEmail: '',
        companyPhone: '',
        companyAddress: '',
        website: '',
        primaryColor: '#000000',
        secondaryColor: '#ffffff',
        logoUrl: '',
        logoBase64: ''
    });

    useEffect(() => {
        if (!currentOrgId) return;

        async function loadSettings() {
            if (!currentOrgId) return;
            setIsLoading(true);
            try {
                const org = await orgOperations.get(currentOrgId);
                if (org && org.branding) {
                    setBranding(prev => ({ ...prev, ...org.branding }));
                }
            } catch (error) {
                console.error("Failed to load branding settings", error);
                toast({ variant: "destructive", title: "Error", description: "Failed to load branding settings." });
            } finally {
                setIsLoading(false);
            }
        }
        loadSettings();
    }, [currentOrgId]);

    const handleSave = async () => {
        if (!currentOrgId) return;
        setIsSaving(true);
        try {
            await orgOperations.update(currentOrgId, {
                branding
            });
            toast({ title: "Settings Saved", description: "Branding settings updated successfully." });
        } catch (error) {
            console.error("Failed to save settings", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to save settings." });
        } finally {
            setIsSaving(false);
        }
    };

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !currentOrgId) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            toast({ variant: "destructive", title: "Invalid File", description: "Please upload an image file." });
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            toast({ variant: "destructive", title: "File Too Large", description: "Please upload an image smaller than 5MB." });
            return;
        }

        setIsLoading(true);

        // Create a timeout promise
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Upload timed out. Please check your internet connection or try again.')), 15000);
        });

        try {
            const { uploadOrgLogo } = await import('@/lib/storage');

            // Race between upload and timeout
            const downloadURL = await Promise.race([
                uploadOrgLogo(currentOrgId, file),
                timeoutPromise
            ]) as string;

            // Convert to Base64 for PDF generation (resize & compress)
            let base64String = '';
            try {
                base64String = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const img = new Image();
                        img.onload = () => {
                            const canvas = document.createElement('canvas');
                            let width = img.width;
                            let height = img.height;
                            const MAX_WIDTH = 800;
                            const MAX_HEIGHT = 800;

                            if (width > height) {
                                if (width > MAX_WIDTH) {
                                    height *= MAX_WIDTH / width;
                                    width = MAX_WIDTH;
                                }
                            } else {
                                if (height > MAX_HEIGHT) {
                                    width *= MAX_HEIGHT / height;
                                    height = MAX_HEIGHT;
                                }
                            }

                            canvas.width = width;
                            canvas.height = height;
                            const ctx = canvas.getContext('2d');
                            ctx?.drawImage(img, 0, 0, width, height);

                            // Compress to JPEG with 0.7 quality to ensure small size
                            resolve(canvas.toDataURL('image/jpeg', 0.7));
                        };
                        img.onerror = reject;
                        img.src = event.target?.result as string;
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
            } catch (e) {
                console.warn('Failed to convert logo to base64', e);
            }

            // Auto-save the logo URL and Base64 to Firestore
            await orgOperations.update(currentOrgId, {
                branding: {
                    ...branding,
                    logoUrl: downloadURL,
                    logoBase64: base64String
                }
            });

            setBranding(prev => ({ ...prev, logoUrl: downloadURL, logoBase64: base64String }));
            toast({ title: "Logo Uploaded", description: "Logo uploaded and saved successfully." });
        } catch (error: any) {
            console.error('Logo upload error:', error);
            let errorMessage = "Failed to upload logo. Please try again.";

            if (error.code === 'storage/unauthorized') {
                errorMessage = "Permission denied. Firebase Storage might not be enabled or rules are blocking the upload.";
            } else if (error.message) {
                errorMessage = error.message;
            }

            toast({ variant: "destructive", title: "Upload Failed", description: errorMessage });
        } finally {
            setIsLoading(false);
            // Reset the input so the same file can be selected again if needed
            e.target.value = '';
        }
    };

    const removeLogo = async () => {
        if (!branding.logoUrl) return;

        try {
            // Only delete from storage if it's a Firebase Storage URL
            if (branding.logoUrl.includes('firebasestorage.googleapis.com')) {
                const { deleteOrgLogo } = await import('@/lib/storage');
                await deleteOrgLogo(branding.logoUrl);
            }

            // Auto-save removal
            await orgOperations.update(currentOrgId, {
                branding: {
                    ...branding,
                    logoUrl: '',
                    logoBase64: ''
                }
            });

            setBranding(prev => ({ ...prev, logoUrl: '', logoBase64: '' }));
            toast({ title: "Logo Removed", description: "Logo removed and settings saved." });
        } catch (error) {
            console.error('Logo removal error:', error);
            // Still remove from state even if deletion fails
            setBranding(prev => ({ ...prev, logoUrl: '' }));
            toast({ title: "Logo Removed", description: "Logo removed from settings." });
        }
    };

    if (isLoading) {
        return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Palette className="h-5 w-5" />
                    Branding & Identity
                </CardTitle>
                <CardDescription>Customize how your company appears on quotes.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                        <Label>Company Name</Label>
                        <Input
                            value={branding.companyName}
                            onChange={e => setBranding(prev => ({ ...prev, companyName: e.target.value }))}
                            disabled={!canEdit}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Website</Label>
                        <Input
                            value={branding.website}
                            onChange={e => setBranding(prev => ({ ...prev, website: e.target.value }))}
                            disabled={!canEdit}
                            placeholder="https://"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Email Address</Label>
                        <Input
                            value={branding.companyEmail}
                            onChange={e => setBranding(prev => ({ ...prev, companyEmail: e.target.value }))}
                            disabled={!canEdit}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Phone Number</Label>
                        <Input
                            value={branding.companyPhone}
                            onChange={e => setBranding(prev => ({ ...prev, companyPhone: e.target.value }))}
                            disabled={!canEdit}
                        />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                        <Label>Address</Label>
                        <Textarea
                            value={branding.companyAddress}
                            onChange={e => setBranding(prev => ({ ...prev, companyAddress: e.target.value }))}
                            disabled={!canEdit}
                            rows={2}
                        />
                    </div>
                </div>

                <Separator />

                {/* Logo Upload */}
                <div className="space-y-2">
                    <Label>Company Logo</Label>
                    <div className="flex items-start gap-4">
                        {branding.logoUrl ? (
                            <div className="relative">
                                <img
                                    src={branding.logoUrl}
                                    alt="Company Logo"
                                    className="h-24 w-24 object-contain border rounded-lg bg-muted/30 p-2"
                                />
                                {canEdit && (
                                    <Button
                                        variant="destructive"
                                        size="icon"
                                        className="absolute -top-2 -right-2 h-6 w-6"
                                        onClick={removeLogo}
                                    >
                                        <X className="h-3 w-3" />
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <div className="h-24 w-24 border-2 border-dashed rounded-lg flex items-center justify-center bg-muted/30">
                                <ImageIcon className="h-8 w-8 text-muted-foreground" />
                            </div>
                        )}
                        <div className="flex-1 space-y-2">
                            <p className="text-sm text-muted-foreground">
                                Upload your company logo to appear on quotes and PDFs.
                            </p>
                            {canEdit && (
                                <div>
                                    <Input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleLogoUpload}
                                        className="hidden"
                                        id="logo-upload"
                                    />
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => document.getElementById('logo-upload')?.click()}
                                    >
                                        <Upload className="h-4 w-4 mr-2" />
                                        {branding.logoUrl ? 'Change Logo' : 'Upload Logo'}
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <Separator />

                <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                        <Label>Primary Brand Color</Label>
                        <div className="flex gap-2">
                            <Input
                                type="color"
                                value={branding.primaryColor}
                                onChange={e => setBranding(prev => ({ ...prev, primaryColor: e.target.value }))}
                                className="w-12 h-10 p-1 cursor-pointer"
                                disabled={!canEdit}
                            />
                            <Input
                                value={branding.primaryColor}
                                onChange={e => setBranding(prev => ({ ...prev, primaryColor: e.target.value }))}
                                disabled={!canEdit}
                                className="font-mono"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Secondary Brand Color</Label>
                        <div className="flex gap-2">
                            <Input
                                type="color"
                                value={branding.secondaryColor}
                                onChange={e => setBranding(prev => ({ ...prev, secondaryColor: e.target.value }))}
                                className="w-12 h-10 p-1 cursor-pointer"
                                disabled={!canEdit}
                            />
                            <Input
                                value={branding.secondaryColor}
                                onChange={e => setBranding(prev => ({ ...prev, secondaryColor: e.target.value }))}
                                disabled={!canEdit}
                                className="font-mono"
                            />
                        </div>
                    </div>
                </div>
            </CardContent>
            {canEdit && (
                <CardFooter className="border-t px-6 py-4">
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                        Save Branding
                    </Button>
                </CardFooter>
            )}
        </Card>
    );
}
