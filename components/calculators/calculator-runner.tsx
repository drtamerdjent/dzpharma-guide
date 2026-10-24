"use client";

/**
 * CalculatorRunner — moteur de rendu générique d'un CalculatorDefinition.
 *
 * Le composant ne contient AUCUNE connaissance médicale : il affiche les
 * questions déclarées (Oui/Non, choix pondéré, nombre/slider), calcule le
 * score via la fonction `compute` puis affiche l'interprétation colorée
 * (vert/orange/rouge) avec le bouton « Trouver le traitement recommandé »
 * qui pré-remplit le DCI dans le dialogue Alternatives existant.
 */
import { useMemo, useState } from "react";
import { ArrowLeftRight, BookOpen, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import {
  areAllQuestionsAnswered,
  interpretScore,
  type CalculatorAnswers,
  type CalculatorAnswer,
  type CalculatorDefinition,
  type CalculatorQuestion,
  type SeverityLevel,
} from "@/lib/dzpharma/types";

interface CalculatorRunnerProps {
  definition: CalculatorDefinition;
  /** Ouvre le AlternativesDialog de la page avec la DCI pré-remplie. */
  onFindAlternatives: (dci: string, label?: string) => void;
}

const LEVEL_STYLES: Record<SeverityLevel, string> = {
  green: "border-emerald-300 bg-gradient-to-br from-emerald-50 to-white",
  orange: "border-amber-300 bg-gradient-to-br from-amber-50 to-white",
  red: "border-red-300 bg-gradient-to-br from-red-50 to-white",
};

const LEVEL_BADGE: Record<SeverityLevel, string> = {
  green: "border-emerald-300 bg-emerald-100 text-emerald-800",
  orange: "border-amber-300 bg-amber-100 text-amber-800",
  red: "border-red-300 bg-red-100 text-red-800",
};

const LEVEL_LABEL: Record<SeverityLevel, string> = {
  green: "Situation favorable",
  orange: "Prudence",
  red: "Alerte",
};

const OPTION_STYLES =
  "flex min-h-11 flex-1 cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 transition-colors has-[[data-state=checked]]:border-sky-500 has-[[data-state=checked]]:bg-sky-50 has-[[data-state=checked]]:text-sky-900";

function BooleanField({
  question,
  value,
  onChange,
  definitionId,
}: {
  question: CalculatorQuestion;
  value: CalculatorAnswer;
  onChange: (value: boolean) => void;
  definitionId: string;
}) {
  const current = value == null ? "" : value ? "oui" : "non";
  return (
    <RadioGroup
      value={current}
      onValueChange={(next) => onChange(next === "oui")}
      className="flex gap-2"
      aria-label={question.label}
    >
      <Label htmlFor={`${definitionId}-${question.id}-oui`} className={OPTION_STYLES}>
        <RadioGroupItem
          id={`${definitionId}-${question.id}-oui`}
          value="oui"
          className="border-slate-300"
        />
        Oui
      </Label>
      <Label htmlFor={`${definitionId}-${question.id}-non`} className={OPTION_STYLES}>
        <RadioGroupItem
          id={`${definitionId}-${question.id}-non`}
          value="non"
          className="border-slate-300"
        />
        Non
      </Label>
    </RadioGroup>
  );
}

function ChoiceField({
  question,
  value,
  onChange,
  definitionId,
}: {
  question: CalculatorQuestion;
  value: CalculatorAnswer;
  onChange: (value: string) => void;
  definitionId: string;
}) {
  const options = question.options ?? [];
  return (
    <RadioGroup
      value={typeof value === "string" ? value : ""}
      onValueChange={onChange}
      className="flex flex-col gap-2"
      aria-label={question.label}
    >
      {options.map((option) => (
        <Label
          key={option.value}
          htmlFor={`${definitionId}-${question.id}-${option.value}`}
          className={OPTION_STYLES}
        >
          <RadioGroupItem
            id={`${definitionId}-${question.id}-${option.value}`}
            value={option.value}
            className="border-slate-300"
          />
          {option.label}
        </Label>
      ))}
    </RadioGroup>
  );
}

function NumberField({
  question,
  value,
  onChange,
}: {
  question: CalculatorQuestion;
  value: CalculatorAnswer;
  onChange: (value: number) => void;
}) {
  const min = question.min ?? 0;
  const max = question.max ?? 100;
  const step = question.step ?? 1;

  if (question.slider) {
    const current = typeof value === "number" ? value : (min + max) / 2;
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-lg bg-sky-50 px-2.5 py-1 text-base font-extrabold tabular-nums text-sky-800">
            {current.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}
            {question.unit ? ` ${question.unit}` : ""}
          </span>
          {question.sliderLabels && (
            <span className="text-[11px] font-medium text-slate-400">
              {question.sliderLabels[0]} → {question.sliderLabels[1]}
            </span>
          )}
        </div>
        <Slider
          min={min}
          max={max}
          step={step}
          value={[current]}
          onValueChange={(values) => onChange(values[0] ?? min)}
          aria-label={question.label}
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={typeof value === "number" ? value : ""}
        onChange={(event) => {
          const raw = event.target.value;
          onChange(raw === "" ? min : Number(raw));
        }}
        placeholder={question.placeholder ?? String(min)}
        className="h-12 w-32 text-base font-semibold"
        aria-label={question.label}
      />
      {question.unit && (
        <span className="text-sm font-medium text-slate-500">{question.unit}</span>
      )}
    </div>
  );
}

export function CalculatorRunner({ definition, onFindAlternatives }: CalculatorRunnerProps) {
  const [answers, setAnswers] = useState<CalculatorAnswers>({});

  const setAnswer = (id: string, value: CalculatorAnswer) => {
    setAnswers((previous) => ({ ...previous, [id]: value }));
  };

  const complete = areAllQuestionsAnswered(definition.questions, answers);
  const score = useMemo(
    () => (complete ? definition.compute(answers) : null),
    [answers, complete, definition]
  );
  const interpretation = score == null ? null : interpretScore(definition, score);

  const formattedScore =
    score == null
      ? ""
      : Number.isInteger(score)
        ? String(score)
        : score.toLocaleString("fr-FR", { maximumFractionDigits: 1 });

  return (
    <div className="space-y-4">
      {/* Questions */}
      <ol className="space-y-4">
        {definition.questions.map((question, index) => (
          <li key={question.id} className="space-y-2">
            <div className="flex items-start gap-2">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-500">
                {index + 1}
              </span>
              <div>
                <p className="text-sm font-semibold leading-snug text-slate-800">
                  {question.label}
                </p>
                {question.help && (
                  <p className="mt-0.5 text-xs leading-snug text-slate-500">{question.help}</p>
                )}
              </div>
            </div>
            <div className="pl-7">
              {question.type === "boolean" && (
                <BooleanField
                  question={question}
                  value={answers[question.id] ?? null}
                  onChange={(value) => setAnswer(question.id, value)}
                  definitionId={definition.id}
                />
              )}
              {question.type === "choice" && (
                <ChoiceField
                  question={question}
                  value={answers[question.id] ?? null}
                  onChange={(value) => setAnswer(question.id, value)}
                  definitionId={definition.id}
                />
              )}
              {question.type === "number" && (
                <NumberField
                  question={question}
                  value={answers[question.id] ?? null}
                  onChange={(value) => setAnswer(question.id, value)}
                />
              )}
            </div>
          </li>
        ))}
      </ol>

      {/* Résultat */}
      {score != null && interpretation ? (
        <div className={`space-y-3 rounded-2xl border-2 p-4 ${LEVEL_STYLES[interpretation.level]}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Badge variant="outline" className={LEVEL_BADGE[interpretation.level]}>
              {LEVEL_LABEL[interpretation.level]}
            </Badge>
            <p className="text-2xl font-extrabold text-slate-900">
              Score : {formattedScore}
              {definition.scoreSuffix ? (
                <span className="text-sm font-semibold text-slate-500">
                  {" "}
                  {definition.scoreSuffix}
                </span>
              ) : null}
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-base font-bold text-slate-900">{interpretation.title}</p>
            <p className="text-sm leading-relaxed text-slate-700">{interpretation.message}</p>
            {interpretation.recommendation && (
              <p className="text-sm leading-relaxed text-slate-700">
                <span className="font-bold text-slate-900">Conduite à tenir : </span>
                {interpretation.recommendation}
              </p>
            )}
          </div>

          {interpretation.suggestedDci && (
            <Button
              className="h-11 w-full gap-2 text-sm font-semibold sm:w-auto"
              onClick={() =>
                onFindAlternatives(interpretation.suggestedDci as string, interpretation.suggestedLabel)
              }
            >
              <ArrowLeftRight className="h-4 w-4" aria-hidden />
              Trouver le traitement recommandé
            </Button>
          )}

          <p className="flex items-start gap-1.5 text-[10px] leading-relaxed text-slate-400">
            <BookOpen className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
            {definition.reference}
          </p>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white/70 p-3 text-center text-xs text-slate-400">
          Répondez aux {definition.questions.length} questions pour afficher le score et
          l&apos;interprétation clinique.
        </p>
      )}

      {/* Reset */}
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          className="h-9 gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-600"
          onClick={() => setAnswers({})}
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          Recommencer le calcul
        </Button>
      </div>
    </div>
  );
}
