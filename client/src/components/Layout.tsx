import { ReactNode } from "react";
import { Link } from "wouter";
import { Mic2, UserCircle } from "lucide-react";
import { motion } from "framer-motion";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Premium ambient background blur */}
      <div className="absolute top-0 inset-x-0 h-96 bg-primary/5 blur-[120px] -z-10 pointer-events-none" />
      
      <header className="sticky top-0 z-50 glass-panel border-x-0 border-t-0 border-b-white/10 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-blue-400 flex items-center justify-center shadow-lg shadow-primary/20 group-hover:shadow-primary/40 transition-all duration-300">
              <Mic2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-display font-bold text-lg leading-tight text-gradient">Aura</h1>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Speech Trainer</p>
            </div>
          </Link>
          
          <div className="flex items-center gap-4">
            <div className="h-9 w-9 rounded-full bg-secondary border border-border flex items-center justify-center text-muted-foreground hover:text-white transition-colors cursor-pointer">
              <UserCircle className="w-5 h-5" />
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-8 md:py-12 flex flex-col">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="flex-1 flex flex-col"
        >
          {children}
        </motion.div>
      </main>
      
      <footer className="py-6 text-center text-sm text-muted-foreground border-t border-white/5">
        <p>© {new Date().getFullYear()} Aura AI Interview Trainer</p>
      </footer>
    </div>
  );
}
