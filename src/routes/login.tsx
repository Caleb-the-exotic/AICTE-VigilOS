import { createFileRoute } from "@tanstack/react-router";
import { Bot } from "lucide-react";
import AnimatedBackground from "@/components/AnimatedBackground";
import GoogleLoginButton from "@/components/auth/GoogleLoginButton";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  return (
    <div className="min-h-screen relative grid place-items-center px-4 bg-background">
      <AnimatedBackground />
      <div className="relative z-10 w-full max-w-md glass-card glass-card-glow p-8 animate-fade-in">
        <div className="flex items-center gap-3 mb-6">
          <img src="/aicte-logo.png" alt="AICTE Emblem" className="w-11 h-11 object-contain shrink-0" />
          <div>
            <h1 className="text-lg font-bold">
              Vigil<span className="text-gradient-red">OS</span>
            </h1>
            <p className="text-xs text-muted-foreground">Sign in to continue</p>
          </div>
        </div>

        <div className="w-full flex justify-center mt-6">
          <GoogleLoginButton />
        </div>
      </div>
    </div>
  );
}

