import { motion } from "framer-motion";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, User, Sparkles, Target, BarChart3, Zap, CheckCircle2 } from "lucide-react";
import { storage } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/BrandLogo";

export default function Auth() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState({ name: false, email: false });

  const nameError = touched.name && name.trim().length < 2 ? "Please enter at least 2 characters" : "";
  const emailError =
    touched.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? "Please enter a valid email" : "";

  const isValid = name.trim().length >= 2 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) {
      setTouched({ name: true, email: true });
      return;
    }
    storage.setUser({
      name: name.trim(),
      email: email.trim(),
      joinedDate: new Date().toISOString(),
    });
    navigate("/setup");
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-5xl grid lg:grid-cols-2 gap-8 lg:gap-12 items-center"
      >
        {/* Left panel — desktop only */}
        <section className="hidden lg:block space-y-8">
          <BrandLogo size="lg" />
          <div className="space-y-4">
            <h1 className="text-5xl font-display font-bold leading-tight">
              Test your knowledge.
              <br />
              <span className="text-gradient">Challenge your limits.</span>
            </h1>
            <p className="text-lg text-muted-foreground">
              AI-generated quizzes on any topic, tailored to your difficulty level.
            </p>
          </div>
          <ul className="space-y-4">
            {[
              { icon: Zap, title: "AI-Generated Questions", desc: "Powered by Gemini for accuracy" },
              { icon: Target, title: "Topic-Specific Quizzes", desc: "Pick anything — we'll quiz you on it" },
              { icon: BarChart3, title: "Track Your Progress", desc: "See your scores improve over time" },
            ].map((f, i) => (
              <motion.li
                key={f.title}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.1 }}
                className="flex items-start gap-4 glass rounded-2xl p-4"
              >
                <div className="bg-gradient-brand rounded-xl p-2.5 shadow-glow shrink-0">
                  <f.icon className="size-5 text-primary-foreground" />
                </div>
                <div>
                  <div className="font-semibold">{f.title}</div>
                  <div className="text-sm text-muted-foreground">{f.desc}</div>
                </div>
              </motion.li>
            ))}
          </ul>
        </section>

        {/* Form */}
        <section className="glass-strong rounded-3xl p-6 sm:p-10 shadow-glow-strong">
          <div className="lg:hidden mb-6 flex justify-center">
            <BrandLogo size="md" />
          </div>
          <h2 className="text-3xl font-display font-bold mb-2">Welcome! Let's get started</h2>
          <p className="text-muted-foreground mb-8">
            Enter your details to begin your quiz journey
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-2">Full Name</label>
              <div className="relative">
                <User className="size-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                  placeholder="Jane Doe"
                  className="w-full bg-input border border-border rounded-xl pl-11 pr-11 py-3.5 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 transition-all placeholder:text-muted-foreground"
                />
                {!nameError && name.trim().length >= 2 && (
                  <CheckCircle2 className="size-4 absolute right-4 top-1/2 -translate-y-1/2 text-success" />
                )}
              </div>
              {nameError && <p className="mt-1.5 text-sm text-destructive">{nameError}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <div className="relative">
                <Mail className="size-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                  placeholder="jane@example.com"
                  className="w-full bg-input border border-border rounded-xl pl-11 pr-11 py-3.5 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 transition-all placeholder:text-muted-foreground"
                />
                {!emailError && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && (
                  <CheckCircle2 className="size-4 absolute right-4 top-1/2 -translate-y-1/2 text-success" />
                )}
              </div>
              {emailError && <p className="mt-1.5 text-sm text-destructive">{emailError}</p>}
            </div>

            <Button
              type="submit"
              disabled={!isValid}
              className="w-full h-14 text-base font-semibold bg-gradient-brand hover:opacity-90 hover:scale-[1.02] transition-all shadow-glow disabled:opacity-40 disabled:scale-100"
            >
              <Sparkles className="size-4 mr-2" />
              Continue to Quiz
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              No password needed — your progress is saved locally on this device.
            </p>
          </form>
        </section>
      </motion.div>
    </main>
  );
}
