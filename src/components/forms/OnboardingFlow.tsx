"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Zod v4 — use z.number() with valueAsNumber in form inputs
const Step1Schema = z.object({
  first_name: z.string().min(1, "Prénom requis"),
  birth_date: z.string().min(1, "Date de naissance requise"),
  sex: z.enum(["M", "F", "X"]),
  weight_kg: z.number().optional(),
  height_cm: z.number().optional(),
  level: z.enum(["beginner", "intermediate", "advanced", "elite"]),
  weekly_hours_avg: z.number().optional(),
});

const Step3Schema = z.object({
  garmin_email: z.string().optional(),
  garmin_password: z.string().optional(),
});

type Step1Data = z.infer<typeof Step1Schema>;
type Step3Data = z.infer<typeof Step3Schema>;

const DISCIPLINES = [
  { id: "swim", label: "Natation" },
  { id: "bike", label: "Vélo" },
  { id: "run", label: "Course à pied" },
];

const LEVELS = [
  { value: "beginner", label: "Débutant" },
  { value: "intermediate", label: "Intermédiaire" },
  { value: "advanced", label: "Avancé" },
  { value: "elite", label: "Elite" },
];

export function OnboardingFlow() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [step1Data, setStep1Data] = useState<Step1Data | null>(null);
  const [selectedDisciplines, setSelectedDisciplines] = useState<string[]>(["swim", "bike", "run"]);
  const [loading, setLoading] = useState(false);

  const form1 = useForm<Step1Data>({ resolver: zodResolver(Step1Schema) });
  const form3 = useForm<Step3Data>({ resolver: zodResolver(Step3Schema) });

  function toggleDiscipline(id: string) {
    setSelectedDisciplines(prev =>
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    );
  }

  function onStep1(data: Step1Data) {
    setStep1Data(data);
    setStep(2);
  }

  function onStep2() {
    if (selectedDisciplines.length === 0) {
      toast.error("Sélectionnez au moins une discipline");
      return;
    }
    setStep(3);
  }

  async function submitProfile(garminEmail?: string, garminPassword?: string) {
    if (!step1Data) return;
    setLoading(true);

    try {
      const profileRes = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...step1Data,
          available_disciplines: selectedDisciplines,
        }),
      });
      if (!profileRes.ok) throw new Error("Erreur lors de la sauvegarde du profil");

      if (garminEmail && garminPassword) {
        const garminRes = await fetch("/api/garmin/connect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: garminEmail, password: garminPassword }),
        });
        if (!garminRes.ok) {
          toast.warning("Profil sauvegardé mais connexion Garmin échouée. Configurez-la depuis votre profil.");
        }
      }

      toast.success("Profil configuré !");
      router.push("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Une erreur est survenue";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function onStep3(data: Step3Data) {
    await submitProfile(data.garmin_email, data.garmin_password);
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 mb-6">
        {[1, 2, 3].map(s => (
          <div
            key={s}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              s <= step ? "bg-zinc-900" : "bg-zinc-200"
            }`}
          />
        ))}
      </div>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Votre profil</CardTitle>
            <CardDescription>Dites-nous qui vous êtes</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form1.handleSubmit(onStep1)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">Prénom</Label>
                <Input id="first_name" {...form1.register("first_name")} />
                {form1.formState.errors.first_name && (
                  <p className="text-sm text-red-500">{form1.formState.errors.first_name.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="birth_date">Date de naissance</Label>
                  <Input id="birth_date" type="date" {...form1.register("birth_date")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sex">Sexe</Label>
                  <Select
                    defaultValue="M"
                    onValueChange={(v) => form1.setValue("sex", v as "M" | "F" | "X")}
                  >
                    <SelectTrigger id="sex"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M">Homme</SelectItem>
                      <SelectItem value="F">Femme</SelectItem>
                      <SelectItem value="X">Autre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="weight_kg">Poids (kg)</Label>
                  <Input
                    id="weight_kg"
                    type="number"
                    step="0.1"
                    {...form1.register("weight_kg", { valueAsNumber: true })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="height_cm">Taille (cm)</Label>
                  <Input
                    id="height_cm"
                    type="number"
                    {...form1.register("height_cm", { valueAsNumber: true })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Niveau</Label>
                  <Select
                    defaultValue="beginner"
                    onValueChange={(v) => form1.setValue("level", v as Step1Data["level"])}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LEVELS.map(l => (
                        <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="weekly_hours_avg">Heures/semaine</Label>
                  <Input
                    id="weekly_hours_avg"
                    type="number"
                    step="0.5"
                    {...form1.register("weekly_hours_avg", { valueAsNumber: true })}
                  />
                </div>
              </div>

              <Button type="submit" className="w-full">Suivant</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Vos disciplines</CardTitle>
            <CardDescription>Quelles disciplines pratiquez-vous ?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex gap-3">
              {DISCIPLINES.map(d => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => toggleDiscipline(d.id)}
                  className={`flex-1 py-3 px-4 rounded-lg border-2 text-sm font-medium transition-colors ${
                    selectedDisciplines.includes(d.id)
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-200 hover:border-zinc-400"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                Retour
              </Button>
              <Button onClick={onStep2} className="flex-1">
                Suivant
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Connexion Garmin</CardTitle>
            <CardDescription>
              Optionnel — connectez votre compte Garmin pour synchroniser vos activités.
              Vos identifiants sont chiffrés AES-256.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form3.handleSubmit(onStep3)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="garmin_email">Email Garmin Connect</Label>
                <Input id="garmin_email" type="email" {...form3.register("garmin_email")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="garmin_password">Mot de passe Garmin Connect</Label>
                <Input id="garmin_password" type="password" {...form3.register("garmin_password")} />
              </div>

              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => setStep(2)} className="flex-1">
                  Retour
                </Button>
                <Button type="submit" className="flex-1" disabled={loading}>
                  {loading ? "Sauvegarde..." : "Terminer"}
                </Button>
              </div>
              <button
                type="button"
                className="w-full text-sm text-zinc-400 hover:text-zinc-600"
                onClick={() => submitProfile()}
                disabled={loading}
              >
                Passer cette étape
              </button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
