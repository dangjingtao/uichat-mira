interface WelcomePanelProps {
  visible: boolean;
  stateKey: string;
  hero: React.ReactNode;
  badge?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
}

function WelcomePanel({
  visible,
  stateKey,
  hero,
  badge,
  title,
  description,
}: WelcomePanelProps) {
  return (
    <div
      key={stateKey}
      className={`mx-auto mb-8 w-full max-w-[70rem] px-1 transition-all duration-500 ease-out ${
        visible
          ? "animate-in fade-in slide-in-from-top-2 translate-y-0 opacity-100"
          : "pointer-events-none h-0 -translate-y-[10px] overflow-hidden opacity-0"
      }`}
    >
      <div className="relative min-h-[18rem] w-full overflow-hidden rounded-ui-hero lg:min-h-[26rem]">
        {hero}

        <div className="relative z-[1] flex min-h-[18rem] max-w-[32rem] flex-col justify-center gap-4 px-2 py-4 lg:min-h-[26rem] lg:max-w-[34rem] lg:justify-start lg:pt-[5.4rem]">
          {badge}
          <div className="space-y-4">
            <div className="max-w-[15ch] font-serif text-[30px] font-semibold tracking-tight text-text-primary sm:text-[38px] sm:leading-[1.16] lg:max-w-[15ch] lg:text-[42px]">
              {title}
            </div>
            {description ? (
              <div className="max-w-[30rem] text-[15px] leading-7 text-text-secondary lg:max-w-[26rem]">
                {description}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default WelcomePanel;
