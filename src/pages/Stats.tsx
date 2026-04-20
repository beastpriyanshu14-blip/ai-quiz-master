import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts";
import { ArrowLeft, Trash2, Sparkles, Trophy, Target, TrendingUp, Star } from "lucide-react";
import { storage, formatTime } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/BrandLogo";
import { UserAvatar } from "@/components/UserAvatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export default function Stats() {
  const navigate = useNavigate();
  const [refreshKey, setRefreshKey] = useState(0);
  const history = useMemo(() => storage.getHistory(), [refreshKey]);

  const summary = useMemo(() => {
    if (!history.length) return null;
    const total = history.length;
    const best = Math.max(...history.map((h) => h.score));
    const avg = Math.round(history.reduce((s, h) => s + h.score, 0) / total);
    const topicCounts: Record<string, number> = {};
    history.forEach((h) => {
      topicCounts[h.topic] = (topicCounts[h.topic] || 0) + 1;
    });
    const fav = Object.entries(topicCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
    return { total, best, avg, fav };
  }, [history]);

  const chartData = useMemo(() => {
    return history
      .slice(0, 7)
      .reverse()
      .map((h) => ({
        name: h.topic.length > 12 ? h.topic.slice(0, 10) + "…" : h.topic,
        fullTopic: h.topic,
        score: h.score,
        difficulty: h.difficulty,
        date: new Date(h.date).toLocaleDateString(),
      }));
  }, [history]);

  const handleClear = () => {
    storage.clearHistory();
    setRefreshKey((k) => k + 1);
    toast.success("Quiz history cleared");
  };

  return (
    <main className="min-h-screen p-4 sm:p-6 lg:p-8">
      <header className="max-w-5xl mx-auto flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/setup")}>
            <ArrowLeft className="size-4" />
          </Button>
          <BrandLogo size="md" />
        </div>
        <UserAvatar />
      </header>

      <div className="max-w-5xl mx-auto space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center sm:text-left flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4"
        >
          <div>
            <h1 className="text-3xl sm:text-4xl font-display font-bold mb-1">
              📊 Your Quiz <span className="text-gradient">Journey</span>
            </h1>
            <p className="text-muted-foreground">Track your learning progress over time</p>
          </div>
          {history.length > 0 && (
            <span className="self-center sm:self-auto text-sm bg-primary/15 text-primary border border-primary/30 rounded-full px-4 py-1.5 font-medium">
              {history.length} {history.length === 1 ? "quiz" : "quizzes"} taken
            </span>
          )}
        </motion.div>

        {!history.length ? (
          <div className="glass-strong rounded-3xl p-12 text-center">
            <div className="text-6xl mb-4 animate-float">🚀</div>
            <h2 className="text-2xl font-display font-bold mb-2">No quizzes yet!</h2>
            <p className="text-muted-foreground mb-6">Take your first quiz to start tracking progress.</p>
            <Button
              onClick={() => navigate("/setup")}
              className="bg-gradient-brand hover:opacity-90 hover:scale-[1.02] transition-all shadow-glow"
            >
              <Sparkles className="size-4 mr-2" />
              Start Your First Quiz
            </Button>
          </div>
        ) : (
          <>
            {/* Summary */}
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <SummaryCard icon={Target} label="Total Quizzes" value={summary!.total} />
              <SummaryCard icon={Trophy} label="Best Score" value={`${summary!.best}%`} />
              <SummaryCard icon={TrendingUp} label="Avg Score" value={`${summary!.avg}%`} />
              <SummaryCard icon={Star} label="Fav Topic" value={summary!.fav} small />
            </section>

            {/* Chart */}
            <section className="glass-strong rounded-3xl p-4 sm:p-6">
              <h2 className="font-display font-bold text-xl mb-4 px-2">Recent Performance</h2>
              <div className="w-full h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="barFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(258 90% 66%)" stopOpacity={1} />
                        <stop offset="100%" stopColor="hsl(239 84% 67%)" stopOpacity={1} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `${v}%`} />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--primary) / 0.1)" }}
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--card-border))",
                        borderRadius: 12,
                      }}
                      formatter={(value: any, _name: any, props: any) => [
                        `${value}% (${props.payload.difficulty})`,
                        props.payload.fullTopic,
                      ]}
                      labelFormatter={(_l, p: any) => p?.[0]?.payload?.date}
                    />
                    <Bar dataKey="score" radius={[8, 8, 0, 0]} fill="url(#barFill)">
                      {chartData.map((_, i) => (
                        <Cell key={i} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* History table */}
            <section className="glass-strong rounded-3xl p-4 sm:p-6">
              <h2 className="font-display font-bold text-xl mb-4 px-2">Quiz History</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b border-border">
                      <th className="px-3 py-2 font-medium">Topic</th>
                      <th className="px-3 py-2 font-medium">Score</th>
                      <th className="px-3 py-2 font-medium hidden sm:table-cell">Difficulty</th>
                      <th className="px-3 py-2 font-medium hidden md:table-cell">Questions</th>
                      <th className="px-3 py-2 font-medium hidden md:table-cell">Time</th>
                      <th className="px-3 py-2 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => {
                      const scoreColor =
                        h.score >= 70 ? "text-success" : h.score >= 40 ? "text-warning" : "text-destructive";
                      return (
                        <tr key={h.id} className="border-b border-border/50 hover:bg-secondary/40 transition-colors">
                          <td className="px-3 py-3 font-medium">{h.topic}</td>
                          <td className={`px-3 py-3 font-bold ${scoreColor}`}>{h.score}%</td>
                          <td className="px-3 py-3 hidden sm:table-cell capitalize">{h.difficulty}</td>
                          <td className="px-3 py-3 hidden md:table-cell">{h.totalQuestions}</td>
                          <td className="px-3 py-3 hidden md:table-cell font-mono">{formatTime(h.timeTaken)}</td>
                          <td className="px-3 py-3 text-muted-foreground">
                            {new Date(h.date).toLocaleDateString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="flex justify-end">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive">
                    <Trash2 className="size-4 mr-2" />
                    Clear All History
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear all quiz history?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete all {history.length} quiz {history.length === 1 ? "result" : "results"} from this device. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleClear}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Yes, clear everything
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  small = false,
}: {
  icon: any;
  label: string;
  value: string | number;
  small?: boolean;
}) {
  return (
    <div className="glass rounded-2xl p-4 sm:p-5">
      <Icon className="size-5 text-primary mb-2" />
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className={`font-display font-bold truncate ${small ? "text-base sm:text-lg" : "text-2xl sm:text-3xl"}`}>
        {value}
      </div>
    </div>
  );
}
