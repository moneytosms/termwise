"use client";

import { Children, useEffect, useState, type ReactNode } from "react";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from "@/components/ui/carousel";
import { cn } from "@/lib/utils";

/** One class per slide, opening on `start` (the class running now or next). */
export function TodayCarousel({ start, children }: { start: number; children: ReactNode }) {
  const slides = Children.toArray(children);
  const [api, setApi] = useState<CarouselApi>();
  const [selected, setSelected] = useState(start);

  useEffect(() => {
    if (!api) return;
    const sync = () => setSelected(api.selectedScrollSnap());
    api.on("select", sync);
    return () => { api.off("select", sync); };
  }, [api]);

  return (
    <>
      <Carousel setApi={setApi} opts={{ startIndex: start }} className="md:mx-12">
        <CarouselContent role="list" aria-label="Today's periods">
          {slides.map((s, i) => <CarouselItem key={i} role="listitem">{s}</CarouselItem>)}
        </CarouselContent>
        <CarouselPrevious className="hidden md:inline-flex" />
        <CarouselNext className="hidden md:inline-flex" />
      </Carousel>
      {slides.length > 1 && (
        <div className="mt-3 flex justify-center gap-1.5">
          {slides.map((_, i) => (
            <button key={i} type="button" aria-label={`Class ${i + 1} of ${slides.length}`} aria-current={i === selected}
              onClick={() => api?.scrollTo(i)}
              className={cn("h-1.5 rounded-full transition-all", i === selected ? "w-4 bg-data" : "w-1.5 bg-border")} />
          ))}
        </div>
      )}
    </>
  );
}
