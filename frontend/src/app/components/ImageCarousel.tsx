'use client';

import { useState, useEffect } from 'react';
import Image from "next/image";
import Img1 from '../../../public/1.png';
import Img2 from '../../../public/2.png';
import Img3 from '../../../public/3.png';


const slides = [
    { id: 1, src: "/1.png", alt: "Slide 1" },
    { id: 2, src: "/2.png", alt: "Slide 2" },
    { id: 3, src: "/3.png", alt: "Slide 3" },
    // { id: 4, src: "/4.jpg", alt: "Slide 4" },
  ];

const ImageCarousel = () => {
  const [current, setCurrent] = useState(0);

  // Auto-slide every 3 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const nextSlide = () => setCurrent((prev) => (prev + 1) % slides.length);
  const prevSlide = () => setCurrent((prev) => (prev - 1 + slides.length) % slides.length);

  return (
    <div className="relative w-full h-screen sm:h-[70vh] md:h-screen overflow-hidden rounded-xl">
      {/* Slides */}
      {slides.map((slide, index) => (
        <div
          key={slide.id}
          className={`absolute inset-0 transition-opacity duration-700 ${
            index === current ? "opacity-100" : "opacity-0"
          }`}
        >
          <Image
            src={slide.src}
            alt={slide.alt}
            fill
            priority={index === 0}
            className="object-cover"
          />
        </div>
      ))}

      {/* Navigation Buttons */}
      <div className="absolute flex justify-between items-center w-full px-4 top-1/2 -translate-y-1/2">
        <button onClick={prevSlide} className="btn btn-circle opacity-70 hover:opacity-100">
          ❮
        </button>
        <button onClick={nextSlide} className="btn btn-circle opacity-70 hover:opacity-100">
          ❯
        </button>
      </div>

      {/* Indicators */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`w-3 h-3 rounded-full transition-all ${
              i === current ? "bg-primary" : "bg-gray-400"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export default ImageCarousel;