import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Trophy, Target, TrendingUp, Calendar, Mail, BarChart3, LogOut, Award } from "lucide-react";
import { storage, getInitials } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/BrandLogo";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function Profile() {
  const navigate = useNavigate();
  const user = storage.getUser();
  const history = useMemo(() => storage.getHistory(), []);

  if (!user) {
    navigate("/");
    return null;
  }

  const total = history.length;
  const avg = total ? Math.round(history.reduce((s, h) => s + h.score, 0) / total) : 0;
  const wins = history.filter((h) => h.score >= 70).length;
  const best = total ? Math.max(...history.map((h) => h.score)) : 0;
  const joined = new Date(user.joinedDate).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const handleLogout = () => {
    storage.clearUser();
    navigate("/");
  };

  return (
    <main className="min-h-screen p-4 sm:p-6 lg:p-8">
      <header className="max-w-3xl mx-auto flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/setup")}>
            <ArrowLeft className="size-4" />
          </Button>
          <BrandLogo size="md" />
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button variant="ghost" size="icon" onClick={handleLogout} title="Sign out">
            <LogOut className="size-4" />
          </Button>
        </div>
      </header>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="max-w-3xl mx-auto space-y-6"
      >
        {/* Profile header card */}
        <section className="glass-strong rounded-3xl p-6 sm:p-8 text-center sm:text-left">
          <div className="flex flex-col sm:flex-row items-center gap-5">
            <div className="size-24 rounded-full bg-gradient-brand flex items-center justify-center text-3xl font-display font-bold text-primary-foreground shadow-glow shrink-0">
              {getInitials(user.name) || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl font-display font-bold mb-1">
                <span className="text-gradient">{user.name}</span>
              </h1>
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-sm text-muted-foreground justify-center sm:justify-start">
                <span className="flex items-center gap-1.5 justify-center">
                  <Mail className="size-3.5" /> {user.email}
                </span>
                <span className="flex items-center gap-1.5 justify-center">
                  <Calendar className="size-3.5" /> Joined {joined}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Stats grid */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard icon={Target} label="Total Quizzes" value={total} />
          <StatCard icon={Trophy} label="Wins (70%+)" value={wins} />
          <StatCard icon={TrendingUp} label="Avg Score" value={`${avg}%`} />
          <StatCard icon={Award} label="Best Score" value={`${best}%`} />
        </section>

        {/* Recent rooms / history snapshot */}
        <section className="glass-strong rounded-3xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-lg">Recent Activity</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate("/stats")}>
              <BarChart3 className="size-4 mr-1.5" />
              View all
            </Button>
          </div>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No quizzes yet. Take one to fill your profile!
            </p>
          ) : (
            <ul className="space-y-2">
              {history.slice(0, 5).map((h) => (
                <li
                  key={h.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl bg-secondary/40 hover:bg-secondary/60 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{h.topic}</div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {h.difficulty} • {new Date(h.date).toLocaleDateString()}
                    </div>
                  </div>
                  <div
                    className={`font-display font-bold ${
                      h.score >= 70 ? "text-success" : h.score >= 40 ? "text-warning" : "text-destructive"
                    }`}
                  >
                    {h.score}%
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Creator credit */}
        <p className="text-center text-xs text-muted-foreground/60 pt-4 pb-2 tracking-wide">
          Created by Priyanshu Gupta
        </p>
      </motion.div>
    </main>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: string | number;
}) {
  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.02 }}
      transition={{ type: "spring", stiffness: 300 }}
      className="glass rounded-2xl p-4 sm:p-5"
    >
      <Icon className="size-5 text-primary mb-2" />
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="font-display font-bold text-2xl sm:text-3xl truncate">{value}</div>
    </motion.div>
  );
}
