"use client";

import { useRouter } from "next/router";
import { type FocusEvent, useEffect, useRef, useState } from "react";
import { Progress } from "@components/ui/progress";
import { Card } from "@components/ui/card";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { Button } from "@components/ui/button";
import { ImageIcon, Loader2, LoaderCircleIcon, Upload, X } from "lucide-react";
import MarkdownInput from "@components/ui/markdown-input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@components/ui/dialog";
import { useWebContext } from "@context/auth";
import { Alert, AlertDescription } from "@components/ui/alert";
import { deleteCookie, getCookie } from "@utils/cookies";
import { toast } from "@hooks/use-toast";
import Head from "next/head";

interface ValidatedUser {
    id: string;
    username: string;
    avatar: string;
}

export default function SubmitPage() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [dragActive, setDragActive] = useState(false);
    const [formData, setFormData] = useState({
        title: "",
        file: null,
        fileUrl: "",
        description: "",
        contributors: [""],
        sourceLink: "",
        validatedUsers: {} as Record<string, ValidatedUser>
    });
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [previewUrl, setPreviewUrl] = useState("");
    const [isLoadingPreview, setIsLoadingPreview] = useState(false);
    const [validSource, setValidSource] = useState(false);
    const [urlError, setUrlError] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [shakeError, setShakeError] = useState(false);
    const [isBanned, setIsBanned] = useState(false);
    const [notifications, setNotifications] = useState<any[]>([]);
    const { authorizedUser, isAuthenticated, isLoading } = useWebContext();

    const isValidImageUrl = (url: string) => {
        if (!url) return false;
        const validExtensions = [".png", ".gif", ".webp", ".jpg", ".jpeg"];
        return validExtensions.some((ext) => url.toLowerCase().endsWith(ext));
    };

    useEffect(() => {
        const token = getCookie("_dtoken");

        if (isAuthenticated === false && token) {
            deleteCookie("_dtoken");
            router.push("/");
            return;
        }

        // Check if user is banned and fetch notifications
        if (isAuthenticated && authorizedUser) {
            setIsBanned(authorizedUser.bannedFromSubmissions || false);

            const fetchNotifications = async () => {
                try {
                    const response = await fetch("/api/user/notifications", {
                        headers: {
                            Authorization: `Bearer ${getCookie("_dtoken")}`
                        }
                    });
                    if (response.ok) {
                        const data = await response.json();
                        setNotifications(data);
                    }
                } catch (error) {
                    console.error("Failed to fetch notifications:", error);
                }
            };

            fetchNotifications();
        }
    }, [router, isAuthenticated, authorizedUser]);

    useEffect(() => {
        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            if (step > 1) event.preventDefault();
        };

        window.addEventListener("beforeunload", handleBeforeUnload);

        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload);
        };
    }, [step]);

    const totalSteps = 4;
    const progress = (step / totalSteps) * 100;

    const updateFormData = (field: string, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    function validateStep(step: number, data: typeof formData) {
        const newErrors: Record<string, string> = {};
        if (step === 1) {
            if (data.title.trim().length < 3) newErrors.title = "Title must be longer than 3 characters.";
            if (data.title.trim().length > 40) newErrors.title = "Title must be 40 characters or less.";
        }
        if (step === 2 && !data.description.trim()) newErrors.description = "Description is required.";
        if (step === 3 && !data.file) newErrors.file = "Preview image is required.";
        if (step === 4) {
            if (!data.sourceLink.trim()) {
                newErrors.sourceLink = "Source link is required.";
            }
        }
        return newErrors;
    }

    const nextStep = () => {
        if (errors.file) {
            setShakeError(true);
            setTimeout(() => setShakeError(false), 500);
            return;
        }

        const stepErrors = validateStep(step, formData);
        if (Object.keys(stepErrors).length > 0) {
            setErrors(stepErrors);
            setShakeError(true);
            setTimeout(() => setShakeError(false), 500);
            return;
        }

        if (step === totalSteps) return handleSubmit(formData);
        setStep(step + 1);
    };

    const prevStep = () => {
        if (step > 1) setStep(step - 1);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        setDragActive(true);
    };

    const handleDragLeave = () => {
        setDragActive(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileChange(e.dataTransfer.files[0]);
        }
    };

    const handleFileChange = (file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            setFormData((prev) => ({ ...prev, file: e.target.result }));
        };
        reader.readAsDataURL(file);
    };

    const handleSubmit = async (form) => {
        setSubmitting(true);
        const finalErrors = validateStep(step, form);
        if (Object.keys(finalErrors).length > 0) {
            setErrors(finalErrors);
            return;
        }

        form.contributors = [authorizedUser.id, ...new Set(form.contributors)];

        form.validatedUsers = {
            ...form.validatedUsers,
            [authorizedUser.id]: {
                id: authorizedUser.id,
                username: authorizedUser.global_name,
                avatar: authorizedUser.avatar,
                github_name: authorizedUser.githubAccount
            }
        };

        const response = await fetch("/api/submit/theme", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${getCookie("_dtoken")}`
            },
            body: JSON.stringify(form)
        });

        if (response.ok) {
            const data = await response.json();
            router.push(`/theme/submitted/${data.id}`);
        } else {
            setSubmitting(false);
            const data = await response.json();
            toast({
                title: "Failed to submit",
                description: data.message || "An error occurred while submitting your theme. Please try again later.",
                variant: "destructive"
            });
        }
    };

    const fetchPreview = async (url: string) => {
        setIsLoadingPreview(true);
        try {
            const response = await fetch(`/api/preview/screenshot?url=${encodeURIComponent(url)}`);
            const buffer = await response.arrayBuffer();
            const base64Image = btoa(new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ""));
            setFormData((prev) => ({
                ...prev,
                file: `data:image/png;base64,${base64Image}`
            }));
            setShowPreviewModal(false);
        } catch (error) {
            console.error("Failed to fetch preview:", error);
            setErrors((prevErrors) => ({ ...prevErrors, file: "Failed to generate preview. Please try again." }));
        } finally {
            setIsLoadingPreview(false);
        }
    };

    const isValidSourceUrl = (url: string) => {
        if (!url) return true;
    };

    const validateDiscordUsers = async (userIds: string[]) => {
        try {
            const response = await fetch("/api/user/isValid", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${getCookie("_dtoken")}`
                },
                body: JSON.stringify({ users: userIds })
            });

            if (!response.ok) return [];

            const data = await response.json();
            return data.users as ValidatedUser[];
        } catch (error) {
            console.error("Failed to validate users:", error);
            return [];
        }
    };

    const ContributorInputs = () => {
        const [isValidating, setIsValidating] = useState(false);
        const [validationError, setValidationError] = useState("");
        const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
        const [bulkInput, setBulkInput] = useState("");

        const validateAndAddUser = async (userId: string) => {
            if (!userId.trim()) return;
            setIsValidating(true);
            setValidationError("");

            const validUsers = await validateDiscordUsers([userId]);
            if (validUsers.length > 0) {
                const validUser = validUsers[0];
                setFormData((prev) => ({
                    ...prev,
                    validatedUsers: {
                        ...prev.validatedUsers,
                        [userId]: validUser
                    }
                }));
            } else {
                setValidationError(`Invalid Discord ID: ${userId}`);
            }
            setIsValidating(false);
        };

        const handleBulkInput = async (e: FocusEvent<HTMLInputElement>) => {
            const value = e.target.value;
            if (!value) return;

            const newIds = value.split(/[\s,]+/).filter((id) => id.trim());
            setBulkInput("");

            setIsValidating(true);
            const validUsers = await validateDiscordUsers(newIds);

            if (validUsers.length > 0) {
                const newValidatedUsers = validUsers.reduce(
                    (acc, user) => {
                        acc[user.id] = user;
                        return acc;
                    },
                    {} as Record<string, ValidatedUser>
                );

                setFormData((prev) => ({
                    ...prev,
                    contributors: [...new Set([...prev.contributors, ...validUsers.map((u) => u.id)])],
                    validatedUsers: { ...prev.validatedUsers, ...newValidatedUsers }
                }));
            }
            setIsValidating(false);
        };

        return (
            <div className="space-y-2 mt-2">
                {formData.contributors
                    .filter((id) => id)
                    .map((contributorId, index) => (
                        <div key={`contributor-${index}`} className="flex items-center gap-2">
                            <div className="flex-1 select-none flex items-center gap-2 p-2 border border-muted rounded">
                                {formData.validatedUsers[contributorId] ? (
                                    <div className="flex items-center gap-2 min-w-0">
                                        <img src={`https://cdn.discordapp.com/avatars/${contributorId}/${formData.validatedUsers[contributorId].avatar}.png`} className="w-8 h-8 rounded-full flex-shrink-0" draggable={false} alt={formData.validatedUsers[contributorId].username} />
                                        <span className="truncate">{formData.validatedUsers[contributorId].username}</span>
                                        <span className="text-muted-foreground text-sm truncate flex-shrink-0">({contributorId})</span>
                                    </div>
                                ) : (
                                    <Input
                                        value={contributorId}
                                        disabled={submitting}
                                        onChange={(e) => {
                                            const newContributors = [...formData.contributors];
                                            newContributors[index] = e.target.value;
                                            setFormData((prev) => ({
                                                ...prev,
                                                contributors: newContributors
                                            }));
                                        }}
                                        onBlur={(e) => validateAndAddUser(e.target.value)}
                                        placeholder="Discord User ID"
                                        ref={(el) => { inputRefs.current[index] = el; }}
                                    />
                                )}
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                disabled={submitting}
                                onClick={() => {
                                    setFormData((prev) => ({
                                        ...prev,
                                        contributors: prev.contributors.filter((_, i) => i !== index)
                                    }));
                                }}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}

                <div className="flex flex-col gap-2">
                    <Input value={bulkInput} onChange={(e) => setBulkInput(e.target.value)} onBlur={handleBulkInput} placeholder="Type multiple IDs separated by spaces..." className="italic" disabled={isValidating || submitting} />
                    {isValidating && <p className="text-sm text-muted-foreground">Validating users...</p>}
                    {validationError && (
                        <Alert className={`mt-2 border-red-600/20 bg-red-500/10 ${shakeError ? "shake" : ""}`}>
                            <AlertDescription className="text-sm">{validationError}</AlertDescription>
                        </Alert>
                    )}
                </div>
            </div>
        );
    };

    return (
        <>
            <Head>
                <meta name="viewport" content="initial-scale=1, width=device-width" />
                <meta name="keywords" content="discord themes, custom discord themes, discord css, Vencord themes, vencord themes, discord customization, theme submission" />
                <meta name="theme-color" content="#1a1b26" />
                <meta name="application-name" content="Theme Library" />
                <meta name="description" content="Submit your custom Discord theme to our library. Share your creative Discord CSS themes with the community for Vencord, Vencord and other Discord mods." />
                <meta property="og:type" content="website" />
                <meta property="og:url" content="https://themes.equicord.org/" />
                <meta property="og:title" content="Submit Your Discord Theme | Theme Library" />
                <meta property="og:description" content="Share your custom Discord theme with our community. Submit your creative Discord CSS themes for Vencord, Vencord and other Discord mods." />
                <title>Submit Your Discord Theme | Theme Library</title>
                <link rel="icon" href="/favicon.ico" />
            </Head>
            <div className="min-h-screen">
                {!isLoading &&
                    (isAuthenticated ? (
                        <div className="container mx-auto px-2 md:px-6 py-10 max-w-6xl">

                            {isBanned && (
                                <Alert className="mb-6 border-red-600/30 bg-red-500/10">
                                    <AlertDescription className="text-red-600">
                                        <span className="font-semibold">You have been banned from submitting themes.</span>
                                        {authorizedUser?.banReason && <span> Reason: {authorizedUser.banReason}</span>}
                                    </AlertDescription>
                                </Alert>
                            )}

                            <div className="mb-10">
                                <h1 className="text-4xl font-bold tracking-tight mb-3">Submit Your Theme</h1>
                                <p className="text-lg text-muted-foreground">Share your creative Discord theme with the community. Follow the steps below to submit your theme.</p>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

                                <aside className="lg:col-span-1">
                                    <div className="sticky top-8 bg-card/80 border border-border rounded-2xl shadow-md p-6">
                                        <h2 className="font-semibold mb-6 text-lg">Progress</h2>
                                        <Progress value={progress} className="h-2 mb-8" />
                                        <ol className="space-y-3">
                                            {["Title", "Description", "Cover Image", "Attribution"].map((label, index) => (
                                                <li key={label}>
                                                    <div className={`flex items-center gap-3 ${step === index + 1 ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 transition-all ${step >= index + 1 ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{index + 1}</div>
                                                        <span className="text-sm">{label}</span>
                                                    </div>
                                                </li>
                                            ))}
                                        </ol>
                                    </div>
                                </aside>


                                <main className="lg:col-span-3">
                                    {isBanned ? (
                                        <Card className="p-8 bg-card/90 border border-border rounded-2xl shadow-lg">
                                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                                <div className="text-red-500 text-5xl mb-4">🚫</div>
                                                <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
                                                <p className="text-muted-foreground mb-4">You are currently banned from submitting themes.</p>
                                                {authorizedUser?.banReason && <p className="text-sm text-red-600 mb-6">Reason: {authorizedUser.banReason}</p>}
                                                <Button variant="outline" onClick={() => router.push("/")}>
                                                    Return to Home
                                                </Button>
                                            </div>
                                        </Card>
                                    ) : (
                                        <>
                                            <div className="space-y-8">

                                                {step === 1 && (
                                                    <Card className="p-8 bg-card/90 border border-border rounded-2xl shadow-lg">
                                                        <div className="mb-8">
                                                            <h2 className="text-2xl font-bold mb-2">Theme Title</h2>
                                                            <p className="text-muted-foreground">Give your theme a clear, descriptive name that helps others find it.</p>
                                                        </div>
                                                        <div className="space-y-4">
                                                            <div className="space-y-2">
                                                                <Label htmlFor="title" className="text-base font-medium">
                                                                    Title *
                                                                </Label>
                                                                <Input id="title" value={formData.title} onChange={(e) => updateFormData("title", e.target.value)} placeholder="e.g., Dark Midnight Theme, Ocean Breeze, Cyberpunk Vibes..." className="text-base h-12" />
                                                                {errors.title && (
                                                                    <Alert className={`mt-2 border-red-600/20 bg-red-500/10 ${shakeError ? "shake" : ""}`}>
                                                                        <AlertDescription className="text-sm">{errors.title}</AlertDescription>
                                                                    </Alert>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </Card>
                                                )}


                                                {step === 2 && (
                                                    <Card className="p-8 bg-card/90 border border-border rounded-2xl shadow-lg">
                                                        <div className="mb-8">
                                                            <h2 className="text-2xl font-bold mb-2">Theme Description</h2>
                                                            <p className="text-muted-foreground">Write a compelling description about your theme. This will appear on the theme cards across the site.</p>
                                                        </div>
                                                        <div className="space-y-4">
                                                            <MarkdownInput defaultContent={formData.description} onChange={(value) => updateFormData("description", value)} lines={5} />
                                                            {errors.description && (
                                                                <Alert className={`mt-2 border-red-600/20 bg-red-500/10 ${shakeError ? "shake" : ""}`}>
                                                                    <AlertDescription className="text-sm">{errors.description}</AlertDescription>
                                                                </Alert>
                                                            )}
                                                        </div>
                                                    </Card>
                                                )}


                                                {step === 3 && (
                                                    <Card className="p-8 bg-card/90 border border-border rounded-2xl shadow-lg">
                                                        <div className="mb-8">
                                                            <h2 className="text-2xl font-bold mb-2">Theme Preview Image</h2>
                                                            <p className="text-muted-foreground">Upload a preview image or generate one from your theme URL. This helps users see what your theme looks like.</p>
                                                        </div>
                                                        <div className="space-y-6">

                                                            {formData.file && (
                                                                <div className="space-y-2">
                                                                    <p className="text-sm font-medium text-foreground">Current Preview</p>
                                                                    <img draggable={false} width={854} height={480} src={formData.file} alt="Uploaded preview" className="rounded-lg w-full h-auto object-cover border border-border" />
                                                                </div>
                                                            )}


                                                            <div className="space-y-3">
                                                                <p className="text-sm font-medium text-foreground">Upload Image</p>
                                                                <div className={`border-2 ${dragActive ? "border-primary bg-primary/5" : "border-input"} transition-all duration-200 border-dashed rounded-lg p-8 text-center bg-muted/30`} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
                                                                    <Input type="file" accept="image/png, image/gif, image/webp" onChange={(e) => handleFileChange(e.target.files[0])} className="hidden" id="file-upload" />
                                                                    <Label htmlFor="file-upload" className="flex flex-col select-none items-center justify-center cursor-pointer">
                                                                        <Upload className="w-10 h-10 text-muted-foreground mb-3" />
                                                                        <p className="text-base font-medium mb-1">Drag and drop or click to select</p>
                                                                        <p className="text-sm text-muted-foreground">PNG, GIF, WEBP (Recommended: 854x480px)</p>
                                                                    </Label>
                                                                </div>
                                                            </div>


                                                            <div className="space-y-3">
                                                                <p className="text-sm font-medium text-foreground">Or Load from URL</p>
                                                                <div className="flex gap-2">
                                                                    <Input
                                                                        value={formData.fileUrl}
                                                                        onChange={(e) => {
                                                                            setUrlError(false);
                                                                            updateFormData("fileUrl", e.target.value);
                                                                        }}
                                                                        placeholder="https://example.com/preview.png"
                                                                        className={`flex-1 h-10 ${urlError ? "border-red-500" : ""}`}
                                                                    />
                                                                    <Button
                                                                        variant="outline"
                                                                        onClick={() => {
                                                                            if (isValidImageUrl(formData.fileUrl)) {
                                                                                setUrlError(false);
                                                                                updateFormData("file", formData.fileUrl);
                                                                            } else {
                                                                                setUrlError(true);
                                                                            }
                                                                        }}
                                                                        className="h-10"
                                                                    >
                                                                        Load
                                                                    </Button>
                                                                </div>
                                                                {urlError && (
                                                                    <Alert className={`border-red-600/20 bg-red-500/10 ${shakeError ? "shake" : ""}`}>
                                                                        <AlertDescription className="text-sm">Please enter a valid image URL (PNG, GIF, WEBP, JPG)</AlertDescription>
                                                                    </Alert>
                                                                )}
                                                            </div>


                                                            <div className="space-y-3 pt-4 border-t border-border">
                                                                <p className="text-sm font-medium text-foreground">Generate from Theme URL</p>
                                                                <Button variant="outline" onClick={() => setShowPreviewModal(true)} className="w-full">
                                                                    Generate Preview from Theme
                                                                </Button>
                                                                <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
                                                                    <DialogContent>
                                                                        <DialogHeader>
                                                                            <DialogTitle>Generate Theme Preview</DialogTitle>
                                                                        </DialogHeader>
                                                                        <p className="text-sm text-muted-foreground">Enter the URL of your theme file to automatically generate a preview screenshot.</p>
                                                                        <div className="space-y-4">
                                                                            <Input placeholder="https://raw.githubusercontent.com/..." value={previewUrl} onChange={(e) => setPreviewUrl(e.target.value)} className="h-10" />
                                                                            <Button onClick={() => fetchPreview(previewUrl)} disabled={isLoadingPreview || !previewUrl || !(previewUrl.startsWith("/api/") || previewUrl.startsWith("https://") || previewUrl.startsWith("http://"))} className="w-full h-10">
                                                                                {isLoadingPreview ? (
                                                                                    <>
                                                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                                                        Generating Preview...
                                                                                    </>
                                                                                ) : (
                                                                                    "Generate Preview"
                                                                                )}
                                                                            </Button>
                                                                        </div>
                                                                    </DialogContent>
                                                                </Dialog>
                                                            </div>

                                                            {errors.file && (
                                                                <Alert className={`border-red-600/20 bg-red-500/10 ${shakeError ? "shake" : ""}`}>
                                                                    <AlertDescription className="text-sm">{errors.file}</AlertDescription>
                                                                </Alert>
                                                            )}
                                                        </div>
                                                    </Card>
                                                )}


                                                {step === 4 && (
                                                    <div className="space-y-6">

                                                        <Card className="p-8 bg-card/90 border border-border rounded-2xl shadow-lg">
                                                            <div className="mb-8">
                                                                <h2 className="text-2xl font-bold mb-2">Theme Contributors</h2>
                                                                <p className="text-muted-foreground">Add Discord User IDs of anyone else who contributed to your theme.</p>
                                                            </div>
                                                            <div className="space-y-4">
                                                                <ContributorInputs />
                                                            </div>
                                                        </Card>


                                                        <Card className="p-8 bg-card/90 border border-border rounded-2xl shadow-lg">
                                                            <div className="mb-8">
                                                                <h2 className="text-2xl font-bold mb-2">Theme Source</h2>
                                                                <p className="text-muted-foreground">Provide a direct link to your theme source. This will be used as the download link for users.</p>
                                                            </div>
                                                            <div className="space-y-4">
                                                                <Alert className="border-blue-600/20 bg-blue-500/10">
                                                                    <AlertDescription className="text-sm">
                                                                        <span className="font-semibold">Requirement:</span> Your CSS file must include metadata at the top (e.g., <code className="bg-black/20 px-1.5 py-0.5 rounded text-xs">/* @name Theme Name */</code>)
                                                                    </AlertDescription>
                                                                </Alert>
                                                                <div className="space-y-2">
                                                                    <Label htmlFor="source" className="text-base font-medium">
                                                                        Source URL *
                                                                    </Label>
                                                                    <Input
                                                                        id="source"
                                                                        className={`h-10 ${!formData.sourceLink ? "border-red-500" : ""}`}
                                                                        value={formData.sourceLink}
                                                                        disabled={submitting}
                                                                        onChange={(e) => {
                                                                            const value = e.target.value;
                                                                            setValidSource(isValidSourceUrl(value));
                                                                            updateFormData("sourceLink", value);
                                                                        }}
                                                                        placeholder="https://raw.githubusercontent.com/username/repo/main/theme.css"
                                                                    />
                                                                    <p className="text-xs text-muted-foreground">Supported: GitHub, GitLab & custom instances</p>
                                                                </div>
                                                                {errors.sourceLink && (
                                                                    <Alert className={`border-red-600/20 bg-red-500/10 ${shakeError ? "shake" : ""}`}>
                                                                        <AlertDescription className="text-sm">{errors.sourceLink}</AlertDescription>
                                                                    </Alert>
                                                                )}
                                                            </div>
                                                        </Card>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex justify-between gap-4 mt-10 pt-8 border-t border-border">
                                                <Button variant="outline" onClick={prevStep} disabled={step === 1 || submitting} className="h-11 px-6">
                                                    Previous Step
                                                </Button>
                                                <Button disabled={submitting} onClick={nextStep} className="h-11 px-8 min-w-[140px]">
                                                    {step === totalSteps ? (
                                                        submitting ? (
                                                            <>
                                                                <LoaderCircleIcon className="h-4 w-4 mr-2 animate-spin" />
                                                                Submitting...
                                                            </>
                                                        ) : (
                                                            "Submit Theme"
                                                        )
                                                    ) : (
                                                        "Next Step"
                                                    )}
                                                </Button>
                                            </div>
                                        </>
                                    )}
                                </main>
                            </div>
                        </div>
                    ) : (
                        <div className="flex justify-center items-center min-h-screen">
                            <p className="text-2xl">Redirecting...</p>
                        </div>
                    ))}
            </div>
        </>
    );
}
