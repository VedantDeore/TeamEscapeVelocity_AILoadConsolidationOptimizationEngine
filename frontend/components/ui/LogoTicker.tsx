"use client";

const LOGOS = [
  { src: "/logos/nextjs.png",                          alt: "Next.js"        },
  { src: "/logos/Python_logo_and_wordmark.svg",        alt: "Python"         },
  { src: "/logos/Supabase_Logo.png",                   alt: "Supabase"       },
  { src: "/logos/google-or-tools.jpg",                 alt: "Google OR-Tools"},
  { src: "/logos/Scikit_learn_logo_small.svg.png",     alt: "scikit-learn"   },
  { src: "/logos/tailwind-css-logo-vector.png",        alt: "Tailwind CSS"   },
  { src: "/logos/groq-logo.png",                       alt: "Groq"           },
  { src: "/logos/DeepSeek-Logo.png",                   alt: "DeepSeek"       },
  { src: "/logos/Hf-logo-with-title.svg",              alt: "Hugging Face"   },
  { src: "/logos/Vercel_logo_2025.svg",                alt: "Vercel"         },
  { src: "/logos/render-logo-png_seeklogo-532232.png", alt: "Render"         },
];

export default function LogoTicker() {
  return (
    <div className="ltk-root">
      <p className="ltk-heading">Powered by</p>
      <div className="ltk-viewport">
        <div className="ltk-track" aria-hidden="true">
          {[...LOGOS, ...LOGOS].map((logo, i) => (
            <img
              key={i}
              src={logo.src}
              alt={logo.alt}
              draggable={false}
              className="ltk-logo"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
