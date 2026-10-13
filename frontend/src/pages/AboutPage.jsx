import React from 'react';
import {
  Award, BookOpenCheck, BriefcaseBusiness, Building2, Compass, FlaskConical,
  GraduationCap, HeartHandshake, Lightbulb, ShieldCheck, Sparkles, Target
} from 'lucide-react';
import PublicSiteLayout from '../components/public/PublicSiteLayout';
import { aboutContent } from '../content/aboutContent';

const pillars = [
  { icon: BookOpenCheck, iconClass: 'bg-blue-50 text-blue-700', ...aboutContent.pillars[0] },
  { icon: FlaskConical, iconClass: 'bg-violet-50 text-violet-700', ...aboutContent.pillars[1] },
  { icon: BriefcaseBusiness, iconClass: 'bg-amber-50 text-amber-700', ...aboutContent.pillars[2] },
  { icon: GraduationCap, iconClass: 'bg-emerald-50 text-emerald-700', ...aboutContent.pillars[3] },
  { icon: ShieldCheck, iconClass: 'bg-rose-50 text-rose-700', ...aboutContent.pillars[4] },
  { icon: Sparkles, iconClass: 'bg-sky-50 text-sky-700', ...aboutContent.pillars[5] }
];

export default function AboutPage() {
  return (
    <PublicSiteLayout activePage="About">
      <section className="relative isolate overflow-hidden bg-[#102a4d] text-white">
        <div className="absolute -right-20 -top-32 -z-10 h-96 w-96 rounded-full bg-blue-400/15 blur-3xl" />
        <div className="absolute -bottom-36 left-1/4 -z-10 h-80 w-80 rounded-full bg-amber-300/10 blur-3xl" />
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:py-28">
          <div className="max-w-3xl animate-[fade-in-up_.7s_ease-out_both]">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold tracking-wide text-blue-100">
              <Building2 className="h-4 w-4 text-amber-300" /> ABOUT VNRVJIET
            </span>
            <h1 className="mt-6 text-4xl font-black leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              About <span className="text-amber-300">VNRVJIET</span>
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-blue-100/85 sm:text-lg">
              A learning community shaped by academic purpose, a spirit of inquiry, and a commitment to developing tomorrow’s leaders.
            </p>
            <a href="#our-story" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-3 text-sm font-extrabold text-[#102a4d] shadow-lg transition hover:-translate-y-0.5 hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
              Discover our story <Compass className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      <section id="our-story" className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[.7fr_1.3fr] lg:gap-16 lg:py-20">
        <div className="lg:sticky lg:top-32 lg:self-start">
          <span className="text-xs font-black uppercase tracking-[.2em] text-[#b8892c]">Our story</span>
          <h2 className="mt-3 text-3xl font-black leading-tight text-[#12305a] sm:text-4xl dark:text-slate-100">A vision that continues to grow</h2>
          <div className="mt-6 h-1 w-16 rounded-full bg-amber-400" />
          <div className="mt-8 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-2xl font-black text-[#12305a] dark:text-slate-100">1995</div>
              <div className="mt-1 text-xs font-semibold text-slate-500">Institute established</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-2xl font-black text-[#12305a] dark:text-slate-100">A++</div>
              <div className="mt-1 text-xs font-semibold text-slate-500">NAAC accreditation</div>
            </div>
          </div>
        </div>
        <div className="space-y-5 text-sm leading-7 text-slate-600 sm:text-base sm:leading-8">
          {aboutContent.story.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
          <div className="rounded-2xl border-l-4 border-amber-400 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <Award className="mt-1 h-5 w-5 shrink-0 text-[#b8892c]" />
              <p className="font-semibold text-[#12305a] dark:text-slate-100">
                Undergraduate, postgraduate, and doctoral learning come together in a community committed to research, innovation, and holistic development.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="our-purpose" className="bg-white py-16 sm:py-20 dark:bg-slate-950">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-black uppercase tracking-[.2em] text-[#b8892c]">Our purpose</span>
            <h2 className="mt-3 text-3xl font-black text-[#12305a] sm:text-4xl dark:text-slate-100">Vision &amp; Mission</h2>
            <p className="mt-3 text-sm text-slate-500">A shared direction for learning, discovery, and meaningful contribution.</p>
          </div>
          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            <article className="rounded-3xl border border-blue-100 bg-gradient-to-br from-[#12305a] to-[#1b467e] p-7 text-white shadow-xl shadow-blue-950/10 sm:p-9">
              <Compass className="h-7 w-7 text-amber-300" />
              <h3 className="mt-5 text-xl font-black">Our Vision</h3>
              <p className="mt-3 text-sm leading-7 text-blue-100">{aboutContent.vision}</p>
            </article>
            <article className="rounded-3xl border border-slate-200 bg-[#f8fafc] p-7 shadow-lg shadow-slate-900/5 sm:p-9 dark:border-slate-700 dark:bg-slate-900">
              <Target className="h-7 w-7 text-[#b8892c]" />
              <h3 className="mt-5 text-xl font-black text-[#12305a] dark:text-slate-100">Our Mission</h3>
              <ul className="mt-4 space-y-3">
                {aboutContent.mission.map(item => (
                  <li key={item} className="flex gap-3 text-sm leading-6 text-slate-600">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />{item}
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-20">
        <div className="rounded-3xl border border-amber-200/80 bg-white p-7 shadow-xl shadow-amber-900/5 sm:p-9">
          <HeartHandshake className="h-7 w-7 text-[#b8892c]" />
          <span className="mt-5 block text-xs font-black uppercase tracking-[.2em] text-[#b8892c]">Our commitment</span>
          <h2 className="mt-2 text-2xl font-black text-[#12305a] dark:text-slate-100">Quality Policy</h2>
          <p className="mt-4 text-sm leading-7 text-slate-600">{aboutContent.qualityPolicy}</p>
        </div>
        <div className="rounded-3xl bg-[#12305a] p-7 text-white shadow-xl shadow-blue-950/10 sm:p-9">
          <Lightbulb className="h-7 w-7 text-amber-300" />
          <h2 className="mt-5 text-2xl font-black">Our Objectives</h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {aboutContent.objectives.map(item => (
              <li key={item} className="flex gap-2 text-sm leading-6 text-blue-100">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300" />{item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="bg-[#eef3f8] py-16 sm:py-20 dark:bg-slate-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center">
            <span className="text-xs font-black uppercase tracking-[.2em] text-[#b8892c]">What we stand for</span>
            <h2 className="mt-3 text-3xl font-black text-[#12305a] sm:text-4xl dark:text-slate-100">The pillars that guide us</h2>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pillars.map(({ icon: Icon, title, description, iconClass }) => (
              <article key={title} className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl">
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl transition group-hover:scale-105 ${iconClass}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-extrabold text-[#12305a] dark:text-slate-100">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
              </article>
            ))}
          </div>
          <p className="mx-auto mt-8 max-w-3xl text-center text-xs leading-5 text-slate-500">
            Vision, mission, quality policy, and objectives on this page are editable proposed copy and should be replaced with officially approved institutional wording.
          </p>
        </div>
      </section>

      <div id="faculty" className="sr-only">Faculty information is available through the department directory.</div>
    </PublicSiteLayout>
  );
}
