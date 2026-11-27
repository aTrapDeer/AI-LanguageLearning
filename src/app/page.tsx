import { FinalCta } from "@/components/landing/final-cta";
import { Habits } from "@/components/landing/habits";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Languages } from "@/components/landing/languages";
import { Practice } from "@/components/landing/practice";
import { SiteFooter } from "@/components/landing/site-footer";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <Hero />
      <HowItWorks />
      <Languages />
      <Practice />
      <Habits />
      <FinalCta />
      <SiteFooter />
    </div>
  );
}
