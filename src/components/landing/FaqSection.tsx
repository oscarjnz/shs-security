import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Reveal } from "@/components/ui/Reveal";
import { FAQS } from "@/content/faq";


export function FaqSection() {
  return (
    <section id="preguntas-frecuentes" className="border-t border-border/60 py-16 scroll-mt-14">
      <div className="mx-auto max-w-3xl px-4">
        <Reveal>
          <h2 className="text-center text-2xl font-bold text-foreground">
            Preguntas frecuentes
          </h2>
        </Reveal>

        <Reveal delay={80} className="mt-8">
          <Accordion type="single" collapsible className="w-full">
            {FAQS.map((item, i) => (
              <AccordionItem key={item.q} value={`item-${i}`} className="border-border/60">
                <AccordionTrigger className="text-left text-sm font-semibold text-foreground">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  );
}
