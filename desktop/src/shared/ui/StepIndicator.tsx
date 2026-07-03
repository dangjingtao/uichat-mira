interface StepItem {
  step: number;
  label: string;
}

interface StepIndicatorProps {
  currentStep: number;
  steps: StepItem[];
  className?: string;
}

export function StepIndicator({
  currentStep,
  steps,
  className = "",
}: StepIndicatorProps) {
  return (
    <div
      className={`flex flex-wrap items-center justify-center gap-4 rounded-ui-panel border border-border bg-surface-primary px-6 py-4 shadow-shadow-sm ${className}`}
    >
      {steps.map((item, index) => {
        const active = item.step === currentStep;
        const completed = item.step < currentStep;

        return (
          <div key={item.step} className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              <span
                className={`inline-flex min-w-[56px] items-center justify-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                  active
                    ? "bg-primary text-white"
                    : completed
                      ? "bg-primary/10 text-primary"
                      : "border border-border bg-surface-secondary text-text-tertiary"
                }`}
              >
                {active ? `STEP ${item.step}` : item.step}
              </span>
              <span
                className={`text-sm font-medium ${
                  active || completed ? "text-text-primary" : "text-text-tertiary"
                }`}
              >
                {item.label}
              </span>
            </div>

            {index < steps.length - 1 ? (
              <div className="h-px w-12 bg-border" />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
